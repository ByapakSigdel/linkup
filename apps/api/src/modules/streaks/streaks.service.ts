import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

const MILESTONE_DAYS = [7, 30, 100, 365] as const;
const MILESTONE_POINTS: Record<number, number> = { 7: 50, 30: 200, 100: 1000, 365: 5000 };
const DAILY_STREAK_POINTS = 10;
const MAX_FREEZES_PER_MONTH = 2;
const FREEZE_DURATION_DAYS = 3;
const RECOVERY_WINDOW_HOURS = 24;
const GRACE_PERIOD_HOURS = 3;

@Injectable()
export class StreaksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getStreak(coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    const [streak] = await this.db
      .select()
      .from(schema.photoStreaks)
      .where(eq(schema.photoStreaks.coupleId, coupleId))
      .limit(1);

    if (!streak) {
      // Create initial streak record
      const [newStreak] = await this.db
        .insert(schema.photoStreaks)
        .values({ coupleId })
        .returning();
      return newStreak;
    }

    return streak;
  }

  async contributePhoto(coupleId: string, userId: string, photoId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    const streak = await this.getStreak(coupleId, userId);
    if (!streak) {
      throw new NotFoundException('Streak not found');
    }

    const today = new Date().toISOString().split('T')[0]!;

    // Check if already contributed today
    if (streak.lastPhotoDate === today) {
      throw new BadRequestException('Photo already contributed today');
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]!;

    let newCurrentStreak = streak.currentStreak;
    let newStatus = streak.status;

    // Check if streak continues from yesterday (or grace period)
    if (streak.lastPhotoDate === yesterdayStr || streak.status === 'frozen') {
      newCurrentStreak += 1;
      newStatus = 'active';
    } else if (!streak.lastPhotoDate) {
      // First ever photo
      newCurrentStreak = 1;
      newStatus = 'active';
    } else if (streak.canRecover && streak.recoveryDeadline && new Date() < streak.recoveryDeadline) {
      // Recovery window is active
      newCurrentStreak = streak.currentStreak + 1;
      newStatus = 'active';
    } else {
      // Streak was broken, start fresh
      newCurrentStreak = 1;
      newStatus = 'active';
    }

    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

    // Calculate points
    let pointsEarned = DAILY_STREAK_POINTS;
    const milestoneReached = MILESTONE_DAYS.find(m => m === newCurrentStreak);
    if (milestoneReached) {
      pointsEarned += MILESTONE_POINTS[milestoneReached] ?? 0;
    }

    // Update streak
    const [updated] = await this.db
      .update(schema.photoStreaks)
      .set({
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastPhotoDate: today,
        lastPhotoId: photoId,
        totalPhotos: streak.totalPhotos + 1,
        totalPoints: streak.totalPoints + pointsEarned,
        status: newStatus,
        canRecover: false,
        recoveryDeadline: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.photoStreaks.id, streak.id))
      .returning();

    // Record history
    await this.db.insert(schema.streakHistory).values({
      streakId: streak.id,
      eventType: 'photo_added',
      streakLength: newCurrentStreak,
      photoId,
      metadata: { pointsEarned, milestoneReached: milestoneReached ?? null },
    });

    // Record milestone if reached
    if (milestoneReached) {
      await this.db.insert(schema.streakHistory).values({
        streakId: streak.id,
        eventType: 'milestone',
        streakLength: newCurrentStreak,
        metadata: { milestone: milestoneReached, bonusPoints: MILESTONE_POINTS[milestoneReached] },
      });
    }

    return {
      streak: updated,
      pointsEarned,
      milestoneReached: milestoneReached ?? null,
    };
  }

  async freezeStreak(coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    const streak = await this.getStreak(coupleId, userId);
    if (!streak) {
      throw new NotFoundException('Streak not found');
    }

    if (streak.freezesAvailable <= 0) {
      throw new BadRequestException('No freezes available');
    }

    if (streak.status === 'frozen') {
      throw new BadRequestException('Streak is already frozen');
    }

    if (streak.currentStreak === 0) {
      throw new BadRequestException('No active streak to freeze');
    }

    const freezeHistory = Array.isArray(streak.freezeHistory)
      ? [...streak.freezeHistory]
      : [];
    freezeHistory.push({
      date: new Date().toISOString(),
      reason: 'manual_freeze',
    });

    const [updated] = await this.db
      .update(schema.photoStreaks)
      .set({
        status: 'frozen',
        freezesAvailable: streak.freezesAvailable - 1,
        freezeHistory,
        updatedAt: new Date(),
      })
      .where(eq(schema.photoStreaks.id, streak.id))
      .returning();

    await this.db.insert(schema.streakHistory).values({
      streakId: streak.id,
      eventType: 'streak_frozen',
      streakLength: streak.currentStreak,
      metadata: { freezesRemaining: streak.freezesAvailable - 1 },
    });

    return updated;
  }

  async recoverStreak(coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    const streak = await this.getStreak(coupleId, userId);
    if (!streak) {
      throw new NotFoundException('Streak not found');
    }

    if (!streak.canRecover) {
      throw new BadRequestException('Streak cannot be recovered');
    }

    if (streak.recoveryDeadline && new Date() > streak.recoveryDeadline) {
      throw new BadRequestException('Recovery window has expired');
    }

    const [updated] = await this.db
      .update(schema.photoStreaks)
      .set({
        status: 'active',
        canRecover: false,
        recoveryDeadline: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.photoStreaks.id, streak.id))
      .returning();

    await this.db.insert(schema.streakHistory).values({
      streakId: streak.id,
      eventType: 'streak_recovered',
      streakLength: streak.currentStreak,
    });

    return updated;
  }

  async getHistory(coupleId: string, userId: string, limit = 20, offset = 0) {
    await this.verifyCoupleAccess(coupleId, userId);

    const streak = await this.getStreak(coupleId, userId);
    if (!streak) {
      return [];
    }

    return this.db
      .select()
      .from(schema.streakHistory)
      .where(eq(schema.streakHistory.streakId, streak.id))
      .orderBy(desc(schema.streakHistory.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getLeaderboard(_coupleId: string, userId: string) {
    // For now, just return top streaks globally
    // In the future, this could be filtered to circles/friends
    return this.db
      .select({
        coupleId: schema.photoStreaks.coupleId,
        currentStreak: schema.photoStreaks.currentStreak,
        longestStreak: schema.photoStreaks.longestStreak,
        totalPoints: schema.photoStreaks.totalPoints,
      })
      .from(schema.photoStreaks)
      .orderBy(desc(schema.photoStreaks.currentStreak))
      .limit(10);
  }

  private async verifyCoupleAccess(coupleId: string, userId: string) {
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    if (couple.partner1Id !== userId && couple.partner2Id !== userId) {
      throw new ForbiddenException('Not a member of this couple');
    }

    return couple;
  }
}
