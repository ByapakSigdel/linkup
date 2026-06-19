import {
  Injectable,
  Inject,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { ACHIEVEMENT_DEFINITIONS } from './achievement-definitions';

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Seed achievement definitions on startup (idempotent by `code`). */
  async onModuleInit() {
    try {
      const existing = await this.db
        .select({ code: schema.achievements.code })
        .from(schema.achievements);
      const existingCodes = new Set(existing.map((e) => e.code));

      const toInsert = ACHIEVEMENT_DEFINITIONS.filter(
        (d) => !existingCodes.has(d.code),
      ).map((d) => ({
        code: d.code,
        category: d.category,
        name: d.name,
        description: d.description,
        iconUrl: d.icon,
        requirements: d.requirements,
        points: d.points,
        rarity: d.rarity,
      }));

      if (toInsert.length > 0) {
        await this.db.insert(schema.achievements).values(toInsert);
        this.logger.log(`Seeded ${toInsert.length} achievement definitions`);
      }
    } catch (err) {
      this.logger.warn(`Achievement seeding skipped: ${String(err)}`);
    }
  }

  private requireCouple(coupleId: string | null | undefined): string {
    if (!coupleId) {
      throw new BadRequestException('You must be in a couple');
    }
    return coupleId;
  }

  /** Compute current progress metrics for a couple. */
  async computeMetrics(coupleId: string): Promise<Record<string, number>> {
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    const [streak] = await this.db
      .select()
      .from(schema.photoStreaks)
      .where(eq(schema.photoStreaks.coupleId, coupleId))
      .limit(1);

    const countOf = async (table: any, where: any): Promise<number> => {
      const [row] = await this.db
        .select({ c: sql<number>`count(*)::int` })
        .from(table)
        .where(where);
      return row?.c ?? 0;
    };

    const mediaCount = await countOf(
      schema.media,
      and(eq(schema.media.coupleId, coupleId), eq(schema.media.isDeleted, false)),
    );
    const highlightCount = await countOf(
      schema.messages,
      and(
        eq(schema.messages.coupleId, coupleId),
        eq(schema.messages.isHighlighted, true),
      ),
    );
    const emojiCount = await countOf(
      schema.customEmojis,
      eq(schema.customEmojis.coupleId, coupleId),
    );
    const paintingCount = await countOf(
      schema.paintings,
      eq(schema.paintings.coupleId, coupleId),
    );
    const scribbleCount = await countOf(
      schema.scribbles,
      eq(schema.scribbles.coupleId, coupleId),
    );
    const friendsCount = await countOf(
      schema.friendships,
      sql`(${schema.friendships.coupleId} = ${coupleId} OR ${schema.friendships.friendCoupleId} = ${coupleId})`,
    );
    const circlesCount = await countOf(
      schema.circleMembers,
      eq(schema.circleMembers.coupleId, coupleId),
    );

    // Days together: from anniversary date, else couple creation.
    let daysTogether = 0;
    const startStr = couple?.anniversaryDate ?? null;
    const start = startStr
      ? new Date(startStr)
      : couple?.createdAt
        ? new Date(couple.createdAt)
        : null;
    if (start) {
      daysTogether = Math.max(
        0,
        Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)),
      );
    }

    return {
      messages: couple?.messageCount ?? 0,
      media: mediaCount,
      highlights: highlightCount,
      streak_current: streak?.currentStreak ?? 0,
      streak_longest: streak?.longestStreak ?? 0,
      days_together: daysTogether,
      creative_items: emojiCount + paintingCount + scribbleCount,
      friends: friendsCount,
      circles: circlesCount,
    };
  }

  /**
   * Evaluate metrics and unlock any newly-qualified achievements for both
   * partners. Emits realtime events + notifications. Returns newly unlocked.
   */
  async syncForCouple(coupleId: string): Promise<any[]> {
    const metrics = await this.computeMetrics(coupleId);

    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);
    if (!couple) return [];

    const partnerIds = [couple.partner1Id, couple.partner2Id].filter(
      Boolean,
    ) as string[];

    const allAchievements = await this.db.select().from(schema.achievements);

    const alreadyUnlocked = await this.db
      .select()
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.coupleId, coupleId));
    const unlockedKey = new Set(
      alreadyUnlocked.map((u) => `${u.userId}:${u.achievementId}`),
    );

    const newlyUnlocked: any[] = [];

    for (const ach of allAchievements) {
      const req = ach.requirements as { type: string; threshold: number };
      const current = metrics[req.type] ?? 0;
      if (current < req.threshold) continue;

      for (const userId of partnerIds) {
        if (unlockedKey.has(`${userId}:${ach.id}`)) continue;
        const [row] = await this.db
          .insert(schema.userAchievements)
          .values({
            userId,
            coupleId,
            achievementId: ach.id,
            progress: req.threshold,
          })
          .returning();

        newlyUnlocked.push({ ...row, achievement: ach });

        this.gateway.emitToUser(userId, 'achievement:unlocked', {
          achievement: ach,
          userAchievement: row,
          points: ach.points,
        });
        await this.notifications.create({
          userId,
          coupleId,
          type: 'achievement',
          priority: 'high',
          title: '🏆 Achievement Unlocked!',
          body: `${ach.name} — ${ach.description}`,
          iconUrl: ach.iconUrl ?? undefined,
          actionType: 'navigate',
          actionData: { route: '/hall-of-fame' },
        });
      }
    }

    return newlyUnlocked;
  }

  /** All achievement definitions with unlocked state + progress for the couple. */
  async getAll(coupleId: string, userId: string, filters?: { category?: string; unlocked?: boolean }) {
    this.requireCouple(coupleId);
    await this.syncForCouple(coupleId);

    const metrics = await this.computeMetrics(coupleId);
    const all = await this.db.select().from(schema.achievements);
    const unlocked = await this.db
      .select()
      .from(schema.userAchievements)
      .where(
        and(
          eq(schema.userAchievements.coupleId, coupleId),
          eq(schema.userAchievements.userId, userId),
        ),
      );
    const unlockedMap = new Map(unlocked.map((u) => [u.achievementId, u]));

    let achievements = all.map((a) => {
      const req = a.requirements as { type: string; threshold: number };
      const current = metrics[req.type] ?? 0;
      const ua = unlockedMap.get(a.id);
      return {
        ...a,
        isUnlocked: !!ua,
        unlockedAt: ua?.unlockedAt ?? null,
        isShowcased: ua?.isShowcased ?? false,
        currentProgress: Math.min(current, req.threshold),
        requiredProgress: req.threshold,
        percentage: Math.min(100, Math.round((current / req.threshold) * 100)),
      };
    });

    if (filters?.category) {
      achievements = achievements.filter((a) => a.category === filters.category);
    }
    if (typeof filters?.unlocked === 'boolean') {
      achievements = achievements.filter((a) => a.isUnlocked === filters.unlocked);
    }

    const totalUnlocked = achievements.filter((a) => a.isUnlocked).length;
    const totalPoints = achievements
      .filter((a) => a.isUnlocked)
      .reduce((sum, a) => sum + (a.points ?? 0), 0);

    return {
      achievements,
      stats: {
        totalAvailable: all.length,
        totalUnlocked,
        totalPoints,
      },
    };
  }

  async getMine(coupleId: string, userId: string) {
    this.requireCouple(coupleId);
    await this.syncForCouple(coupleId);

    const rows = await this.db
      .select()
      .from(schema.userAchievements)
      .where(
        and(
          eq(schema.userAchievements.coupleId, coupleId),
          eq(schema.userAchievements.userId, userId),
        ),
      );

    const ids = rows.map((r) => r.achievementId);
    const defs = ids.length
      ? await this.db
          .select()
          .from(schema.achievements)
          .where(inArray(schema.achievements.id, ids))
      : [];
    const defMap = new Map(defs.map((d) => [d.id, d]));

    const merged = rows
      .map((r) => ({ ...r, achievement: defMap.get(r.achievementId) }))
      .sort(
        (a, b) =>
          new Date(b.unlockedAt ?? 0).getTime() -
          new Date(a.unlockedAt ?? 0).getTime(),
      );

    return {
      achievements: merged,
      showcased: merged.filter((m) => m.isShowcased),
      recentlyUnlocked: merged.slice(0, 5),
    };
  }

  async toggleShowcase(achievementId: string, coupleId: string, userId: string) {
    this.requireCouple(coupleId);
    const [ua] = await this.db
      .select()
      .from(schema.userAchievements)
      .where(
        and(
          eq(schema.userAchievements.achievementId, achievementId),
          eq(schema.userAchievements.userId, userId),
        ),
      )
      .limit(1);

    if (!ua) {
      throw new NotFoundException('Achievement not unlocked');
    }

    const [updated] = await this.db
      .update(schema.userAchievements)
      .set({ isShowcased: !ua.isShowcased })
      .where(eq(schema.userAchievements.id, ua.id))
      .returning();

    return { achievement: updated, isShowcased: updated?.isShowcased ?? false };
  }

  async getProgress(coupleId: string, userId: string) {
    const { achievements } = await this.getAll(coupleId, userId);
    return {
      progress: achievements
        .filter((a) => !a.isUnlocked)
        .map((a) => ({
          achievement: a,
          currentProgress: a.currentProgress,
          requiredProgress: a.requiredProgress,
          percentage: a.percentage,
        }))
        .sort((a, b) => b.percentage - a.percentage),
    };
  }
}
