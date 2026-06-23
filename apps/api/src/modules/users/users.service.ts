import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, count, ilike, or } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        coupleId: schema.users.coupleId,
        themeId: schema.users.themeId,
        locale: schema.users.locale,
        timezone: schema.users.timezone,
        isOnline: schema.users.isOnline,
        lastSeenAt: schema.users.lastSeenAt,
        isVerified: schema.users.isVerified,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    return user || null;
  }

  async findByUsername(username: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        isOnline: schema.users.isOnline,
        lastSeenAt: schema.users.lastSeenAt,
      })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      dateOfBirth?: string;
      gender?: string;
      phone?: string;
      themeId?: string;
      locale?: string;
      timezone?: string;
    },
  ) {
    const [updated] = await this.db
      .update(schema.users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        themeId: schema.users.themeId,
        locale: schema.users.locale,
        timezone: schema.users.timezone,
      });

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    await this.db
      .update(schema.users)
      .set({
        isOnline,
        lastSeenAt: isOnline ? undefined : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  async getProfileWithStats(userId: string) {
    const user = await this.findById(userId);

    let coupleStats = null;
    let partner = null;

    if (user.coupleId) {
      const [couple] = await this.db
        .select()
        .from(schema.couples)
        .where(eq(schema.couples.id, user.coupleId))
        .limit(1);

      if (couple) {
        const partnerId =
          couple.partner1Id === userId ? couple.partner2Id : couple.partner1Id;

        if (partnerId) {
          const [p] = await this.db
            .select({
              id: schema.users.id,
              username: schema.users.username,
              displayName: schema.users.displayName,
              avatarUrl: schema.users.avatarUrl,
              bio: schema.users.bio,
              isOnline: schema.users.isOnline,
              lastSeenAt: schema.users.lastSeenAt,
            })
            .from(schema.users)
            .where(eq(schema.users.id, partnerId))
            .limit(1);
          partner = p ?? null;
        }

        // Get streak info
        const [streak] = await this.db
          .select()
          .from(schema.photoStreaks)
          .where(eq(schema.photoStreaks.coupleId, user.coupleId))
          .limit(1);

        // Get achievement count
        const achievementRows = await this.db
          .select({ cnt: count() })
          .from(schema.userAchievements)
          .where(eq(schema.userAchievements.coupleId, user.coupleId));
        const achievementCount = achievementRows[0]?.cnt ?? 0;

        // Get showcased achievements
        const showcased = await this.db
          .select({
            id: schema.userAchievements.id,
            achievementId: schema.userAchievements.achievementId,
            unlockedAt: schema.userAchievements.unlockedAt,
          })
          .from(schema.userAchievements)
          .where(
            and(
              eq(schema.userAchievements.coupleId, user.coupleId),
              eq(schema.userAchievements.isShowcased, true),
            ),
          )
          .limit(4);

        coupleStats = {
          couple,
          messageCount: couple.messageCount ?? 0,
          mediaCount: couple.mediaCount ?? 0,
          currentStreak: streak?.currentStreak ?? 0,
          longestStreak: streak?.longestStreak ?? 0,
          totalPoints: streak?.totalPoints ?? 0,
          achievementCount,
          showcasedAchievements: showcased,
        };
      }
    }

    return { user, partner, coupleStats };
  }

  async getSettings(userId: string) {
    const [settings] = await this.db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      const [newSettings] = await this.db
        .insert(schema.userSettings)
        .values({ userId })
        .returning();
      return newSettings;
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    data: {
      themeId?: string;
      pushNotifications?: boolean;
      messageNotifications?: boolean;
      callNotifications?: boolean;
      streakReminders?: boolean;
      anniversaryReminders?: boolean;
      showOnlineStatus?: boolean;
      showReadReceipts?: boolean;
      showTypingIndicator?: boolean;
      autoDownloadMedia?: boolean;
      mediaQuality?: string;
      fontSize?: string;
      reduceMotion?: boolean;
      highContrast?: boolean;
    },
  ) {
    // Ensure settings exist
    await this.getSettings(userId);

    const [updated] = await this.db
      .update(schema.userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.userSettings.userId, userId))
      .returning();

    return updated;
  }

  /** Store (or clear) the device's FCM push token for this user. */
  async updatePushToken(userId: string, token: string | null) {
    await this.db
      .update(schema.users)
      .set({ fcmToken: token, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
    return { ok: true };
  }

  async searchUsers(query: string, limit = 10) {
    if (!query || query.length < 2) return [];

    const pattern = `%${query}%`;

    return this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
      })
      .from(schema.users)
      .where(
        or(
          ilike(schema.users.username, pattern),
          ilike(schema.users.displayName, pattern),
        ),
      )
      .limit(limit);
  }
}
