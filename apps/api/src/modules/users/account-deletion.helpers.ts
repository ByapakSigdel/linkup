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
 *     important_dates, streak_history→photo_streaks, playlist_tracks→playlists,
 *     post_likes/post_comments→circle_posts, circle_story_views→circle_stories,
 *     circle_follows→circles, circle_conversations→circles,
 *     circle_conversation_messages/_reads→circle_conversations.
 *
 * NOTE: `media.album_id`→media_albums (ON DELETE SET NULL) means media must be
 * removed before media_albums regardless; it is ordered that way below.
 * Extend this list if a new couple-scoped table is added.
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
