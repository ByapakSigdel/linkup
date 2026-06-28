// Pure helpers for account deletion / the "Relationship Graveyard" offboarding.
//
// These live in their own dependency-free file (no DB / DI / NestJS) so they can
// be unit-tested directly AND imported from users.service.ts without dragging in
// any other service — avoiding the circular-import / undefined-at-decorator-time
// DI hazard. Mirrors the circle-dm.helpers.ts pattern.

import { randomBytes } from 'crypto';

/** Exact display name a tombstoned (deleted) partner is shown as everywhere. */
export const TOMBSTONE_DISPLAY_NAME = 'Your partner';

/**
 * Field set that turns a live user row into an anonymized tombstone:
 * - PII (name, avatar, bio, phone, dob, gender, fcm token) is scrubbed.
 * - `email`/`username` are rewritten to unique, non-PII placeholders so the
 *   real address/handle is freed for re-signup while NOT-NULL + UNIQUE hold.
 * - `passwordHash` becomes a random unusable value (login impossible).
 * - `isActive=false`, `deletedAt=now` mark the row as a tombstone.
 * - `coupleId=null` detaches the departing partner from the live couple.
 *
 * The user ROW is deliberately kept (not deleted) so shared FKs that are
 * NOT NULL (`messages.senderId`, `couples.partner1Id/partner2Id`, …) stay valid.
 */
export function buildAnonymizedUserFields(userId: string, now: Date) {
  return {
    email: `deleted+${userId}@linkup.invalid`,
    username: `deleted_${userId.slice(0, 8)}`,
    displayName: TOMBSTONE_DISPLAY_NAME,
    avatarUrl: null,
    bio: null,
    phone: null,
    dateOfBirth: null,
    gender: null,
    fcmToken: null,
    passwordHash: randomBytes(32).toString('hex'),
    isActive: false as const,
    deletedAt: now,
    coupleId: null,
  };
}

/**
 * Shared couple content may be purged only once BOTH partners are tombstoned.
 * Pass each partner's `deletedAt`; returns true iff neither is still live.
 */
export function shouldPurgeCoupleData(
  partnerADeletedAt: Date | null,
  partnerBDeletedAt: Date | null,
): boolean {
  return partnerADeletedAt != null && partnerBDeletedAt != null;
}

/**
 * FK-safe order for deleting all of a couple's shared content when BOTH partners
 * are gone. Children are listed before their parents and the `couples` row is
 * ALWAYS last. Snake_case names are the literal `pgTable('…')` table names.
 *
 * Verified against apps/api/src/database/schema/index.ts — every table whose FK
 * chain reaches `couples` is present:
 *   - direct couple_id FK: messages, couple_invites, important_dates,
 *     media_albums, media, photo_streaks, user_achievements, notifications,
 *     custom_emojis, soundboard_sounds, paintings, scribbles, playlists,
 *     watch_parties, call_sessions, constellation_stars, circle_posts,
 *     circle_stories, circles (via created_by_couple_id).
 *   - chained child FK: message_reactions→messages, date_celebrations→
 *     important_dates (via date_id), streak_history→photo_streaks (via
 *     streak_id), playlist_tracks→playlists, post_likes/post_comments→
 *     circle_posts, circle_story_views→circle_stories (via story_id),
 *     circle_follows→circles, circle_conversations→circles,
 *     circle_conversation_messages/_reads→circle_conversations.
 *
 * NOTE: `media.album_id`→media_albums (ON DELETE SET NULL) means media must be
 * removed before media_albums regardless; it is ordered that way below.
 * Extend this list if a new couple-scoped table is added.
 *
 * ⚠️ TASK 4 PREREQUISITE — this array is NOT sufficient on its own. Deleting a
 * couple's `circles` row, and finally the `couples` row, will hit FK violations
 * from rows owned by OTHER couples (or from the survivor's own row) that point
 * at this couple. Before iterating this order, the purge MUST first run the
 * cross-couple / survivor cleanup described by {@link COUPLE_PURGE_PREREQUISITES}
 * (see that constant for the exact statements). Skipping them = runtime FK error.
 */
export const COUPLE_PURGE_ORDER: string[] = [
  // chat
  'message_reactions',
  'messages',
  // gallery (media before its albums; album_id is SET NULL but order kept safe)
  'media',
  'media_albums',
  // important dates
  'date_celebrations',
  'important_dates',
  // photo streaks
  'streak_history',
  'photo_streaks',
  // achievements
  'user_achievements',
  // creative + entertainment + comms
  'playlist_tracks',
  'playlists',
  'paintings',
  'scribbles',
  'custom_emojis',
  'soundboard_sounds',
  'watch_parties',
  'call_sessions',
  // constellation
  'constellation_stars',
  // notifications (couple_id nullable FK)
  'notifications',
  // circles — couple-to-couple DMs first, then story/post children, then circles
  'circle_conversation_reads',
  'circle_conversation_messages',
  'circle_conversations',
  'circle_story_views',
  'circle_stories',
  'post_likes',
  'post_comments',
  'circle_posts',
  'circle_follows',
  'circles',
  // invites
  'couple_invites',
  // the couple row last
  'couples',
];

/**
 * Cross-couple / survivor FK cleanup that MUST run inside the same purge
 * transaction BEFORE iterating {@link COUPLE_PURGE_ORDER}. These are the dangling
 * references that the children-before-parents table order does NOT cover, because
 * they live on OTHER couples' rows (or the surviving partner's own user row) and
 * point INTO the couple being purged. Without them, deleting this couple's
 * `circles` row, or finally its `couples` row, raises a Postgres FK violation.
 *
 * The Task 4 `purgeCoupleData(tx, coupleId, circleId)` implementation must run,
 * before the table-order loop:
 *
 *   1. Clear the SURVIVOR's archive pointer (users.archived_couple_id → couples.id
 *      has NO on-delete action; a survivor who chose 'archived_solo' has this set):
 *        UPDATE users SET archived_couple_id = NULL WHERE archived_couple_id = $coupleId
 *
 *   2. Remove cross-couple references into THIS couple's `circles` row (resolve
 *      $circleId = circles.id WHERE created_by_couple_id = $coupleId first). These
 *      columns have NO on-delete action, so other couples' rows pointing here block
 *      the `circles` delete:
 *        DELETE FROM circle_story_views          WHERE viewer_circle_id = $circleId
 *        DELETE FROM circle_conversation_reads    WHERE circle_id        = $circleId
 *        DELETE FROM circle_conversation_messages WHERE sender_circle_id = $circleId
 *      And the conversations this circle participates in with OTHER circles
 *      (circle_lo_id / circle_hi_id reference circles.id, no on-delete):
 *        DELETE FROM circle_conversation_messages WHERE conversation_id IN
 *          (SELECT id FROM circle_conversations WHERE circle_lo_id=$circleId OR circle_hi_id=$circleId)
 *        DELETE FROM circle_conversation_reads    WHERE conversation_id IN (…same…)
 *        DELETE FROM circle_conversations         WHERE circle_lo_id=$circleId OR circle_hi_id=$circleId
 *
 *   3. Belt-and-suspenders (already ON DELETE CASCADE, but explicit is safe):
 *        DELETE FROM circle_follows WHERE follower_circle_id = $circleId
 *                                      OR following_circle_id = $circleId
 *
 * NOTE: circle_conversations.circle_lo_id / circle_hi_id and the *_reads/_messages
 * rows for THIS couple's own side are also covered by COUPLE_PURGE_ORDER, but the
 * cross-couple rows above (where the OTHER circle owns the conversation, or another
 * couple viewed this couple's story) are NOT — hence this prerequisite set.
 *
 * Exported as documentation-as-data so the Task 4 implementer can iterate or
 * assert against it; the order within is intentional (survivor pointer, then
 * circle-scoped, then follows).
 */
export const COUPLE_PURGE_PREREQUISITES: readonly string[] = [
  'users.archived_couple_id (UPDATE → NULL where = coupleId)',
  'circle_story_views.viewer_circle_id (DELETE where = circleId)',
  'circle_conversation_reads.circle_id (DELETE where = circleId)',
  'circle_conversation_messages.sender_circle_id (DELETE where = circleId)',
  'circle_conversations.circle_lo_id|circle_hi_id (+ their messages/reads, DELETE where = circleId)',
  'circle_follows.follower_circle_id|following_circle_id (DELETE where = circleId)',
];
