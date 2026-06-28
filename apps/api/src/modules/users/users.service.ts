import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, count, ilike, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { StorageService } from '../media/storage.service';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { FcmService } from '../push/fcm.service';
import {
  buildAnonymizedUserFields,
  shouldPurgeCoupleData,
} from './account-deletion.helpers';

/**
 * The transaction client passed to db.transaction's callback. Drizzle does not
 * export a convenient named type for it, so we infer it from the db's own
 * transaction signature — keeps purgeCoupleData strongly typed without guessing.
 */
type PurgeTx = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]
>[0];

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly storage: StorageService,
    // All @Global providers — no module import needed (PushModule,
    // NotificationsModule, GatewayModule are @Global). Used by deleteAccount to
    // gently notify the surviving partner.
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
    private readonly fcm: FcmService,
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

  /**
   * Store an uploaded image as this user's avatar and persist the URL.
   * Works for solo users too — the file is keyed by userId (not coupleId), so
   * pairing isn't required to set a profile picture.
   */
  async updateAvatar(userId: string, file: Express.Multer.File) {
    const stored = await this.storage.store(file, userId, 'avatar');

    const [updated] = await this.db
      .update(schema.users)
      .set({ avatarUrl: stored.cdnUrl, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
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

  // ─── Account deletion (Relationship Graveyard offboarding) ──────────────────

  /**
   * Delete (tombstone) the caller's account. Destructive, so the password is
   * re-verified before anything is mutated.
   *
   * Everything that mutates state runs inside a SINGLE db.transaction, so the
   * operation is all-or-nothing: the user is never anonymized without also having
   * sessions revoked / the couple transitioned, and a both-gone purge either
   * fully completes or rolls back (the survivor stays "left"-pending) — it can
   * never half-purge. The survivor notification is fired AFTER the transaction
   * commits and is best-effort (swallows its own errors), so it can never abort
   * the deletion.
   *
   * Behaviour:
   * - already deleted → idempotent no-op.
   * - solo user (no couple) → anonymize + revoke tokens only.
   * - first partner leaving an active couple → couple becomes 'ended'
   *   (endedByUserId/survivorDecision='pending'), survivor is notified.
   * - survivor leaving an already-ended couple → survivorDecision='left'; once
   *   BOTH partners are tombstoned the couple's shared content is purged.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Idempotent: a second delete on an already-tombstoned account is a no-op.
    if (user.deletedAt) {
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Password is incorrect');
    }

    const now = new Date();

    // The survivor we must (gently) notify AFTER the tx commits. Resolved inside
    // the tx but the notification itself is deliberately fired outside it so a
    // failing socket/push/notification insert can never roll back the deletion.
    let notifySurvivorId: string | null = null;
    let notifyCoupleId: string | null = null;

    await this.db.transaction(async (tx) => {
      // 1. Anonymize the departing user into a tombstone (PII scrubbed, login
      //    impossible). The row is kept so shared NOT-NULL FKs stay valid.
      await tx
        .update(schema.users)
        .set({ ...buildAnonymizedUserFields(userId, now), updatedAt: now })
        .where(eq(schema.users.id, userId));

      // 2. Kill every session immediately — any stale access token now 401s.
      await tx
        .update(schema.refreshTokens)
        .set({ isRevoked: true })
        .where(eq(schema.refreshTokens.userId, userId));

      // 3. Solo account → nothing shared to transition.
      if (!user.coupleId) {
        return;
      }

      const [couple] = await tx
        .select()
        .from(schema.couples)
        .where(eq(schema.couples.id, user.coupleId))
        .limit(1);
      if (!couple) {
        return;
      }

      const survivorId =
        couple.partner1Id === userId ? couple.partner2Id : couple.partner1Id;

      if (couple.relationshipStatus !== 'ended') {
        // First partner to leave → transition the couple to ended. Shared rows
        // are deliberately preserved (the survivor gets a read-only memorial).
        await tx
          .update(schema.couples)
          .set({
            relationshipStatus: 'ended',
            endedAt: now,
            endedByUserId: userId,
            survivorDecision: 'pending',
            updatedAt: now,
          })
          .where(eq(schema.couples.id, couple.id));
      } else {
        // Survivor leaving an already-ended couple → record the 'left' decision.
        await tx
          .update(schema.couples)
          .set({
            survivorDecision: 'left',
            survivorDecidedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.couples.id, couple.id));
      }

      // Resolve the OTHER partner's tombstone state to decide whether both are
      // gone. We just tombstoned `userId` (deletedAt=now), so pass `now` for our
      // side and the freshly-read survivor's deletedAt for theirs.
      let survivorDeletedAt: Date | null = null;
      if (survivorId) {
        const [survivor] = await tx
          .select({ deletedAt: schema.users.deletedAt })
          .from(schema.users)
          .where(eq(schema.users.id, survivorId))
          .limit(1);
        survivorDeletedAt = survivor?.deletedAt ?? null;
      }

      if (shouldPurgeCoupleData(now, survivorDeletedAt)) {
        // BOTH partners are tombstoned → purge all shared content in FK-safe
        // order, inside this same tx (rolls back atomically on any failure).
        await this.purgeCoupleData(tx, couple.id);
      } else if (survivorId) {
        // Survivor is still live → notify them (after commit, best-effort).
        notifySurvivorId = survivorId;
        notifyCoupleId = couple.id;
      }
    });

    // Best-effort, post-commit: a failing notification must never undo the
    // already-committed deletion, so this lives OUTSIDE the transaction and
    // swallows its own errors.
    if (notifySurvivorId && notifyCoupleId) {
      await this.notifySurvivor(notifySurvivorId, notifyCoupleId, now);
    }
  }

  /**
   * Permanently delete all of a couple's shared content + the couple row, used
   * only when BOTH partners are tombstoned. Runs inside the caller's transaction.
   *
   * The children-before-parents table order in COUPLE_PURGE_ORDER is not
   * sufficient on its own: some FKs point INTO this couple from OTHER couples'
   * rows (cross-couple circle DMs / story views / follows) or from the survivor's
   * own user row (archived_couple_id), and those have no ON DELETE action. Those
   * cross-couple / survivor prerequisites (documented in
   * COUPLE_PURGE_PREREQUISITES) are cleared FIRST, then the couple-owned tables
   * are deleted children-first via the query builder.
   *
   * `tx` is intentionally typed loosely (Drizzle's transaction client type is not
   * exported in a convenient form); every statement is parameterised.
   */
  private async purgeCoupleData(
    tx: PurgeTx,
    coupleId: string,
  ): Promise<void> {
    // Resolve this couple's own circle (if it opted in) — needed for the
    // cross-couple cleanup below. One circle per couple (UNIQUE constraint).
    const [circle] = await tx
      .select({ id: schema.circles.id })
      .from(schema.circles)
      .where(eq(schema.circles.createdByCoupleId, coupleId))
      .limit(1);
    const circleId = circle?.id ?? null;

    // ── Prerequisites: dangling references INTO this couple from elsewhere ──

    // Survivor's archive pointer (archived_couple_id → couples.id, no on-delete).
    await tx
      .update(schema.users)
      .set({ archivedCoupleId: null })
      .where(eq(schema.users.archivedCoupleId, coupleId));

    if (circleId) {
      // Other couples viewing THIS couple's stories / DMing this circle. These
      // columns reference circles.id with no ON DELETE action, so the rows owned
      // by OTHER circles must go before we can delete this circle.
      await tx
        .delete(schema.circleStoryViews)
        .where(eq(schema.circleStoryViews.viewerCircleId, circleId));
      await tx
        .delete(schema.circleConversationReads)
        .where(eq(schema.circleConversationReads.circleId, circleId));
      await tx
        .delete(schema.circleConversationMessages)
        .where(eq(schema.circleConversationMessages.senderCircleId, circleId));

      // Conversations this circle is a participant in (with any other circle),
      // plus their messages/reads. circle_lo_id / circle_hi_id reference
      // circles.id with no ON DELETE action.
      const convIds = (
        await tx
          .select({ id: schema.circleConversations.id })
          .from(schema.circleConversations)
          .where(
            or(
              eq(schema.circleConversations.circleLoId, circleId),
              eq(schema.circleConversations.circleHiId, circleId),
            ),
          )
      ).map((c) => c.id);
      if (convIds.length > 0) {
        await tx
          .delete(schema.circleConversationMessages)
          .where(
            sql`${schema.circleConversationMessages.conversationId} = ANY(${convIds})`,
          );
        await tx
          .delete(schema.circleConversationReads)
          .where(
            sql`${schema.circleConversationReads.conversationId} = ANY(${convIds})`,
          );
        await tx
          .delete(schema.circleConversations)
          .where(sql`${schema.circleConversations.id} = ANY(${convIds})`);
      }

      // Follow edges in either direction (these are ON DELETE CASCADE, but
      // explicit removal keeps the purge self-contained and order-independent).
      await tx
        .delete(schema.circleFollows)
        .where(
          or(
            eq(schema.circleFollows.followerCircleId, circleId),
            eq(schema.circleFollows.followingCircleId, circleId),
          ),
        );
    }

    // ── Couple-owned content, children before parents ──

    // Chat: reactions reference this couple's messages.
    const messageIds = (
      await tx
        .select({ id: schema.messages.id })
        .from(schema.messages)
        .where(eq(schema.messages.coupleId, coupleId))
    ).map((m) => m.id);
    if (messageIds.length > 0) {
      await tx
        .delete(schema.messageReactions)
        .where(sql`${schema.messageReactions.messageId} = ANY(${messageIds})`);
    }
    await tx.delete(schema.messages).where(eq(schema.messages.coupleId, coupleId));

    // Gallery: media before its albums (album_id is SET NULL, but order is safe).
    await tx.delete(schema.media).where(eq(schema.media.coupleId, coupleId));
    await tx
      .delete(schema.mediaAlbums)
      .where(eq(schema.mediaAlbums.coupleId, coupleId));

    // Important dates: celebrations reference this couple's dates.
    const dateIds = (
      await tx
        .select({ id: schema.importantDates.id })
        .from(schema.importantDates)
        .where(eq(schema.importantDates.coupleId, coupleId))
    ).map((d) => d.id);
    if (dateIds.length > 0) {
      await tx
        .delete(schema.dateCelebrations)
        .where(sql`${schema.dateCelebrations.dateId} = ANY(${dateIds})`);
    }
    await tx
      .delete(schema.importantDates)
      .where(eq(schema.importantDates.coupleId, coupleId));

    // Photo streaks: history references this couple's streak rows.
    const streakIds = (
      await tx
        .select({ id: schema.photoStreaks.id })
        .from(schema.photoStreaks)
        .where(eq(schema.photoStreaks.coupleId, coupleId))
    ).map((s) => s.id);
    if (streakIds.length > 0) {
      await tx
        .delete(schema.streakHistory)
        .where(sql`${schema.streakHistory.streakId} = ANY(${streakIds})`);
    }
    await tx
      .delete(schema.photoStreaks)
      .where(eq(schema.photoStreaks.coupleId, coupleId));

    // Achievements.
    await tx
      .delete(schema.userAchievements)
      .where(eq(schema.userAchievements.coupleId, coupleId));

    // Creative + entertainment + comms.
    const playlistIds = (
      await tx
        .select({ id: schema.playlists.id })
        .from(schema.playlists)
        .where(eq(schema.playlists.coupleId, coupleId))
    ).map((p) => p.id);
    if (playlistIds.length > 0) {
      await tx
        .delete(schema.playlistTracks)
        .where(sql`${schema.playlistTracks.playlistId} = ANY(${playlistIds})`);
    }
    await tx.delete(schema.playlists).where(eq(schema.playlists.coupleId, coupleId));
    await tx.delete(schema.paintings).where(eq(schema.paintings.coupleId, coupleId));
    await tx.delete(schema.scribbles).where(eq(schema.scribbles.coupleId, coupleId));
    await tx
      .delete(schema.customEmojis)
      .where(eq(schema.customEmojis.coupleId, coupleId));
    await tx
      .delete(schema.soundboardSounds)
      .where(eq(schema.soundboardSounds.coupleId, coupleId));
    await tx
      .delete(schema.watchParties)
      .where(eq(schema.watchParties.coupleId, coupleId));
    await tx
      .delete(schema.callSessions)
      .where(eq(schema.callSessions.coupleId, coupleId));

    // Constellation.
    await tx
      .delete(schema.constellationStars)
      .where(eq(schema.constellationStars.coupleId, coupleId));

    // Notifications referencing this couple (couple_id nullable FK, no on-delete).
    await tx
      .delete(schema.notifications)
      .where(eq(schema.notifications.coupleId, coupleId));

    // Circles: own posts (likes/comments cascade) + stories (views cascade), then
    // the circle row itself, then invites, then the couple.
    if (circleId) {
      const postIds = (
        await tx
          .select({ id: schema.circlePosts.id })
          .from(schema.circlePosts)
          .where(eq(schema.circlePosts.coupleId, coupleId))
      ).map((p) => p.id);
      if (postIds.length > 0) {
        await tx
          .delete(schema.postLikes)
          .where(sql`${schema.postLikes.postId} = ANY(${postIds})`);
        await tx
          .delete(schema.postComments)
          .where(sql`${schema.postComments.postId} = ANY(${postIds})`);
      }
      const storyIds = (
        await tx
          .select({ id: schema.circleStories.id })
          .from(schema.circleStories)
          .where(eq(schema.circleStories.coupleId, coupleId))
      ).map((s) => s.id);
      if (storyIds.length > 0) {
        await tx
          .delete(schema.circleStoryViews)
          .where(sql`${schema.circleStoryViews.storyId} = ANY(${storyIds})`);
      }
      await tx
        .delete(schema.circlePosts)
        .where(eq(schema.circlePosts.coupleId, coupleId));
      await tx
        .delete(schema.circleStories)
        .where(eq(schema.circleStories.coupleId, coupleId));
      await tx.delete(schema.circles).where(eq(schema.circles.id, circleId));
    }

    // Invites.
    await tx
      .delete(schema.coupleInvites)
      .where(eq(schema.coupleInvites.coupleId, coupleId));

    // Finally, the couple row itself.
    await tx.delete(schema.couples).where(eq(schema.couples.id, coupleId));
  }

  /**
   * Gently let the surviving partner know their shared space has changed. Pure
   * best-effort: realtime emit is fire-and-forget, and the notification insert +
   * push swallow their own errors so this can never throw into the caller (it is
   * invoked AFTER the deletion transaction has already committed).
   */
  private async notifySurvivor(
    survivorId: string,
    coupleId: string,
    at: Date,
  ): Promise<void> {
    try {
      this.gateway.emitToUser(survivorId, 'couple:ended', {
        coupleId,
        endedAt: at.toISOString(),
      });
    } catch {
      // ignore — realtime is opportunistic.
    }

    // Gentle, non-alarming wording (never "your partner left you").
    const title = 'Your shared space has changed';
    const body =
      "Something in your shared space has changed — open LinkUp when you're ready.";

    try {
      await this.notifications.create({
        userId: survivorId,
        coupleId,
        type: 'relationship_ended',
        title,
        body,
        actionType: 'navigate',
        actionData: { route: 'memorial' },
      });
    } catch {
      // ignore — the survivor still discovers the change on next app open.
    }

    try {
      if (this.fcm.enabled) {
        const [survivor] = await this.db
          .select({ fcmToken: schema.users.fcmToken })
          .from(schema.users)
          .where(eq(schema.users.id, survivorId))
          .limit(1);
        if (survivor?.fcmToken) {
          await this.fcm.sendToToken(survivor.fcmToken, title, body, {
            type: 'relationship_ended',
          });
        }
      }
    } catch {
      // ignore — push delivery is best-effort.
    }
  }
}
