import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  date,
  timestamp,
  json,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Users ──────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  displayName: varchar('display_name', { length: 50 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  bio: varchar('bio', { length: 500 }),
  dateOfBirth: date('date_of_birth'),
  gender: varchar('gender', { length: 20 }),
  phone: varchar('phone', { length: 20 }),
  coupleId: uuid('couple_id').references((): AnyPgColumn => couples.id),
  themeId: varchar('theme_id', { length: 50 }).default('default'),
  locale: varchar('locale', { length: 10 }).default('en'),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  isOnline: boolean('is_online').default(false),
  lastSeenAt: timestamp('last_seen_at'),
  isVerified: boolean('is_verified').default(false),
  isActive: boolean('is_active').default(true),
  deletedAt: timestamp('deleted_at'),
  archivedCoupleId: uuid('archived_couple_id').references((): AnyPgColumn => couples.id),
  fcmToken: varchar('fcm_token', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Couples ────────────────────────────────────────────────────────────────────

export const couples = pgTable('couples', {
  id: uuid('id').primaryKey().defaultRandom(),
  partner1Id: uuid('partner1_id')
    .notNull()
    .references(() => users.id),
  partner2Id: uuid('partner2_id').references(() => users.id),
  coupleName: varchar('couple_name', { length: 100 }),
  coupleAvatarUrl: text('couple_avatar_url'),
  anniversaryDate: date('anniversary_date'),
  relationshipStatus: varchar('relationship_status', { length: 20 }).default('dating'),
  endedAt: timestamp('ended_at'),
  endedByUserId: uuid('ended_by_user_id').references((): AnyPgColumn => users.id),
  // No DB default: an active couple's survivor_decision stays NULL (it only ever
  // becomes meaningful once relationshipStatus flips to 'ended'). The account-
  // deletion transaction sets it to 'pending' explicitly when ending a couple, so
  // a default would only ever plant misleading 'pending' on live, never-ended
  // rows. Client selectors treat NULL as "pending" under an ended couple.
  survivorDecision: varchar('survivor_decision', { length: 20 }),
  survivorDecidedAt: timestamp('survivor_decided_at'),
  pairingCode: varchar('pairing_code', { length: 20 }).unique(),
  pairingCodeExpiresAt: timestamp('pairing_code_expires_at'),
  isPaired: boolean('is_paired').default(false),
  messageCount: integer('message_count').default(0),
  mediaCount: integer('media_count').default(0),
  streakCurrent: integer('streak_current').default(0),
  streakLongest: integer('streak_longest').default(0),
  daysTogetherCount: integer('days_together_count').default(0),
  sharedThemeId: varchar('shared_theme_id', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Messages ───────────────────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => users.id),
  receiverId: uuid('receiver_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  messageType: varchar('message_type', { length: 20 }).default('text'),
  mediaUrls: json('media_urls').$type<string[]>(),
  threadId: uuid('thread_id'),
  isThreadStarter: boolean('is_thread_starter').default(false),
  isHighlighted: boolean('is_highlighted').default(false),
  highlightColor: varchar('highlight_color', { length: 20 }),
  highlightNote: varchar('highlight_note', { length: 500 }),
  highlightCategory: varchar('highlight_category', { length: 20 }),
  status: varchar('status', { length: 20 }).default('sent'),
  sentAt: timestamp('sent_at').defaultNow(),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  isEdited: boolean('is_edited').default(false),
  editedAt: timestamp('edited_at'),
  isDeleted: boolean('is_deleted').default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Message Reactions ──────────────────────────────────────────────────────────

export const messageReactions = pgTable('message_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id')
    .notNull()
    .references(() => messages.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  emoji: varchar('emoji', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Couple Invites ─────────────────────────────────────────────────────────────

export const coupleInvites = pgTable('couple_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  inviterId: uuid('inviter_id')
    .notNull()
    .references(() => users.id),
  inviteCode: varchar('invite_code', { length: 20 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  acceptedBy: uuid('accepted_by').references(() => users.id),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Important Dates ────────────────────────────────────────────────────────────

export const importantDates = pgTable('important_dates', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  title: varchar('title', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  date: date('date').notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  isRecurring: boolean('is_recurring').default(false),
  recurringType: varchar('recurring_type', { length: 20 }),
  reminderDaysBefore: json('reminder_days_before').$type<number[]>(),
  reminderEnabled: boolean('reminder_enabled').default(true),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── User Settings ──────────────────────────────────────────────────────────────

export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  themeId: varchar('theme_id', { length: 50 }).default('default'),
  customThemeOverrides: json('custom_theme_overrides'),
  pushNotifications: boolean('push_notifications').default(true),
  messageNotifications: boolean('message_notifications').default(true),
  callNotifications: boolean('call_notifications').default(true),
  streakReminders: boolean('streak_reminders').default(true),
  anniversaryReminders: boolean('anniversary_reminders').default(true),
  emailNotifications: boolean('email_notifications').default(false),
  reactionNotifications: boolean('reaction_notifications').default(true),
  achievementNotifications: boolean('achievement_notifications').default(true),
  circleNotifications: boolean('circle_notifications').default(true),
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false),
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }).default('22:00'),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }).default('08:00'),
  showOnlineStatus: boolean('show_online_status').default(true),
  showReadReceipts: boolean('show_read_receipts').default(true),
  showTypingIndicator: boolean('show_typing_indicator').default(true),
  autoDownloadMedia: boolean('auto_download_media').default(true),
  mediaQuality: varchar('media_quality', { length: 20 }).default('high'),
  fontSize: varchar('font_size', { length: 20 }).default('medium'),
  reduceMotion: boolean('reduce_motion').default(false),
  highContrast: boolean('high_contrast').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Refresh Tokens ─────────────────────────────────────────────────────────────

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  token: varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  isRevoked: boolean('is_revoked').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Media Albums ───────────────────────────────────────────────────────────────

export const mediaAlbums = pgTable('media_albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1000 }),
  coverMediaId: uuid('cover_media_id'),
  isShared: boolean('is_shared').default(true),
  isAuto: boolean('is_auto').default(false),
  mediaCount: integer('media_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Media ──────────────────────────────────────────────────────────────────────

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  uploaderId: uuid('uploader_id')
    .notNull()
    .references(() => users.id),
  type: varchar('type', { length: 20 }).notNull(), // photo, video, voice, file
  filename: varchar('filename', { length: 500 }).notNull(),
  originalFilename: varchar('original_filename', { length: 500 }).notNull(),
  storageKey: varchar('storage_key', { length: 1000 }).notNull().unique(),
  storageBucket: varchar('storage_bucket', { length: 100 }).default('local'),
  cdnUrl: text('cdn_url'),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  duration: integer('duration'), // seconds, for video/voice
  width: integer('width'),
  height: integer('height'),
  processingStatus: varchar('processing_status', { length: 20 }).default('completed'), // pending, processing, completed, failed
  thumbnails: jsonb('thumbnails').$type<{
    small?: string;
    medium?: string;
    large?: string;
  }>(),
  variants: jsonb('variants').$type<Record<string, string>>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  albumId: uuid('album_id').references(() => mediaAlbums.id, { onDelete: 'set null' }),
  tags: json('tags').$type<string[]>().default([]),
  caption: varchar('caption', { length: 2000 }),
  isStreakPhoto: boolean('is_streak_photo').default(false),
  streakDate: date('streak_date'),
  isFavorite: boolean('is_favorite').default(false),
  isArchived: boolean('is_archived').default(false),
  isDeleted: boolean('is_deleted').default(false),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Photo Streaks ──────────────────────────────────────────────────────────────

export const photoStreaks = pgTable('photo_streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .unique()
    .references(() => couples.id),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastPhotoDate: date('last_photo_date'),
  lastPhotoId: uuid('last_photo_id'),
  freezesAvailable: integer('freezes_available').default(2).notNull(),
  freezeHistory: jsonb('freeze_history')
    .$type<Array<{ date: string; reason: string }>>()
    .default([]),
  canRecover: boolean('can_recover').default(false),
  recoveryDeadline: timestamp('recovery_deadline'),
  totalPhotos: integer('total_photos').default(0).notNull(),
  totalPoints: integer('total_points').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active'), // active, broken, frozen
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Streak History ─────────────────────────────────────────────────────────────

export const streakHistory = pgTable('streak_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  streakId: uuid('streak_id')
    .notNull()
    .references(() => photoStreaks.id),
  eventType: varchar('event_type', { length: 30 }).notNull(), // photo_added, streak_broken, streak_frozen, streak_recovered, milestone
  streakLength: integer('streak_length').notNull(),
  photoId: uuid('photo_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Achievements ───────────────────────────────────────────────────────────────

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  category: varchar('category', { length: 30 }).notNull(), // time_based, communication, creative, memories, streaks, special_events
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  iconUrl: text('icon_url'),
  requirements: jsonb('requirements')
    .$type<{ type: string; threshold: number; metadata?: Record<string, unknown> }>()
    .notNull(),
  points: integer('points').notNull().default(10),
  rarity: varchar('rarity', { length: 20 }).default('common'), // common, uncommon, rare, epic, legendary
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── User Achievements ──────────────────────────────────────────────────────────

export const userAchievements = pgTable('user_achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  achievementId: uuid('achievement_id')
    .notNull()
    .references(() => achievements.id),
  unlockedAt: timestamp('unlocked_at').defaultNow(),
  progress: integer('progress').default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  isShowcased: boolean('is_showcased').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Notifications ──────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  coupleId: uuid('couple_id').references(() => couples.id),
  type: varchar('type', { length: 50 }).notNull(), // message, streak, achievement, date_reminder, system
  priority: varchar('priority', { length: 20 }).default('normal'), // low, normal, high, urgent
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),
  imageUrl: text('image_url'),
  iconUrl: text('icon_url'),
  actionType: varchar('action_type', { length: 50 }), // navigate, open_url, dismiss
  actionData: jsonb('action_data').$type<Record<string, unknown>>(),
  status: varchar('status', { length: 20 }).default('unread'), // unread, read, clicked, dismissed
  sentAt: timestamp('sent_at').defaultNow(),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  clickedAt: timestamp('clicked_at'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Date Celebrations ──────────────────────────────────────────────────────────

export const dateCelebrations = pgTable('date_celebrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  dateId: uuid('date_id')
    .notNull()
    .references(() => importantDates.id),
  year: integer('year').notNull(),
  celebratedAt: timestamp('celebrated_at').defaultNow(),
  activities: jsonb('activities').$type<string[]>().default([]),
  photos: json('photos').$type<string[]>().default([]),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 5+ — Social, Creative, Entertainment & Communication features
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Couple Circles (Instagram-for-couples: profiles + one-way follows) ───────────

// A couple's PUBLIC/PRIVATE profile — exactly ONE per couple (opt-in).
export const circles = pgTable(
  'circles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(), // profile display name
    handle: varchar('handle', { length: 30 }).unique(), // @handle for discover/deep-links
    description: varchar('description', { length: 1000 }), // bio (exposed as `bio` in API)
    avatarUrl: text('avatar_url'), // profile picture
    coverImageUrl: text('cover_image_url'), // profile banner
    createdByCoupleId: uuid('created_by_couple_id')
      .notNull()
      .references(() => couples.id), // OWNER couple (UNIQUE — one circle per couple)
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id), // which partner opted in
    isPrivate: boolean('is_private').default(false), // public by default
    followerCount: integer('follower_count').default(0),
    followingCount: integer('following_count').default(0),
    postCount: integer('post_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    ownerUnique: uniqueIndex('circles_owner_unique').on(table.createdByCoupleId),
  }),
);

// One-way follow edge between two CIRCLES (couple-to-couple, Instagram model).
export const circleFollows = pgTable(
  'circle_follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerCircleId: uuid('follower_circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }), // the circle doing the following
    followingCircleId: uuid('following_circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }), // the circle being followed
    status: varchar('status', { length: 20 }).notNull().default('accepted'), // accepted | pending
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id), // which partner tapped follow
    createdAt: timestamp('created_at').defaultNow(),
    acceptedAt: timestamp('accepted_at'),
  },
  (table) => ({
    pairUnique: uniqueIndex('circle_follows_pair_unique').on(
      table.followerCircleId,
      table.followingCircleId,
    ),
    followingStatusIdx: index('circle_follows_following_status_idx').on(
      table.followingCircleId,
      table.status,
    ),
    followerStatusIdx: index('circle_follows_follower_status_idx').on(
      table.followerCircleId,
      table.status,
    ),
  }),
);

// A photo/video post on a couple's OWN circle (Instagram grid item).
export const circlePosts = pgTable(
  'circle_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    coupleId: uuid('couple_id')
      .notNull()
      .references(() => couples.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    content: text('content'), // caption (nullable, photo-first); exposed as `caption` in API
    type: varchar('type', { length: 20 }).default('photo'), // photo | video | carousel
    mediaUrls: json('media_urls').$type<string[]>().default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    likeCount: integer('like_count').default(0),
    commentCount: integer('comment_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    circleCreatedIdx: index('circle_posts_circle_created_idx').on(
      table.circleId,
      table.createdAt,
    ),
  }),
);

export const postLikes = pgTable(
  'post_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => circlePosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    postUserUnique: uniqueIndex('post_likes_post_user_unique').on(table.postId, table.userId),
  }),
);

export const postComments = pgTable(
  'post_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => circlePosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    postCreatedIdx: index('post_comments_post_created_idx').on(table.postId, table.createdAt),
  }),
);

// Ephemeral 24h photo/video story owned by a couple's circle.
export const circleStories = pgTable(
  'circle_stories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    coupleId: uuid('couple_id')
      .notNull()
      .references(() => couples.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    mediaUrl: text('media_url').notNull(),
    mediaType: varchar('media_type', { length: 20 }).notNull().default('image'), // image | video
    durationMs: integer('duration_ms').default(5000),
    caption: varchar('caption', { length: 500 }),
    viewCount: integer('view_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at').notNull(), // createdAt + 24h, set server-side
  },
  (table) => ({
    circleExpiresIdx: index('circle_stories_circle_expires_idx').on(
      table.circleId,
      table.expiresAt,
    ),
    expiresIdx: index('circle_stories_expires_idx').on(table.expiresAt),
  }),
);

// Who viewed a story — powers 'seen' ring state and owner viewer list.
export const circleStoryViews = pgTable(
  'circle_story_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => circleStories.id, { onDelete: 'cascade' }),
    viewerUserId: uuid('viewer_user_id')
      .notNull()
      .references(() => users.id),
    viewerCircleId: uuid('viewer_circle_id').references(() => circles.id), // nullable: viewer may have no circle
    viewedAt: timestamp('viewed_at').defaultNow(),
  },
  (table) => ({
    storyViewerUnique: uniqueIndex('circle_story_views_story_viewer_unique').on(
      table.storyId,
      table.viewerUserId,
    ),
  }),
);

// ─── Circle Conversations (couple-to-couple DMs) ────────────────────────────────

// Ordered pair (circleLoId < circleHiId lexicographically) ensures find-or-create is race-safe.
export const circleConversations = pgTable(
  'circle_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // lo < hi (string compare) — enforced by the service before insert
    circleLoId: uuid('circle_lo_id')
      .notNull()
      .references(() => circles.id),
    circleHiId: uuid('circle_hi_id')
      .notNull()
      .references(() => circles.id),
    lastMessageAt: timestamp('last_message_at'),
    lastMessagePreview: varchar('last_message_preview', { length: 280 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    pairUnique: uniqueIndex('circle_conversations_pair_unique').on(
      table.circleLoId,
      table.circleHiId,
    ),
  }),
);

export const circleConversationMessages = pgTable(
  'circle_conversation_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => circleConversations.id),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id),
    senderCircleId: uuid('sender_circle_id')
      .notNull()
      .references(() => circles.id),
    content: text('content'),
    mediaUrls: jsonb('media_urls').$type<string[]>(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    conversationCreatedIdx: index('circle_conv_messages_conv_created_idx').on(
      table.conversationId,
      table.createdAt,
    ),
  }),
);

export const circleConversationReads = pgTable(
  'circle_conversation_reads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => circleConversations.id),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id),
    lastReadAt: timestamp('last_read_at').defaultNow(),
  },
  (table) => ({
    convCircleUnique: uniqueIndex('circle_conversation_reads_conv_circle_unique').on(
      table.conversationId,
      table.circleId,
    ),
  }),
);

// ─── Custom Emojis ──────────────────────────────────────────────────────────────

export const customEmojis = pgTable('custom_emojis', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 50 }).notNull(),
  imageUrl: text('image_url').notNull(),
  category: varchar('category', { length: 30 }).default('custom'),
  isAnimated: boolean('is_animated').default(false),
  useCount: integer('use_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── SoundBoard ─────────────────────────────────────────────────────────────────

export const soundboardSounds = pgTable('soundboard_sounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 50 }).notNull(),
  audioUrl: text('audio_url').notNull(),
  emoji: varchar('emoji', { length: 20 }),
  category: varchar('category', { length: 30 }).default('custom'),
  duration: integer('duration'),
  color: varchar('color', { length: 20 }),
  useCount: integer('use_count').default(0),
  isBuiltIn: boolean('is_built_in').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Paintings (collaborative) ──────────────────────────────────────────────────

export const paintings = pgTable('paintings', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 100 }),
  width: integer('width').default(1024),
  height: integer('height').default(768),
  backgroundColor: varchar('background_color', { length: 20 }).default('#ffffff'),
  thumbnailUrl: text('thumbnail_url'),
  imageUrl: text('image_url'),
  strokes: jsonb('strokes').$type<unknown[]>().default([]),
  status: varchar('status', { length: 20 }).default('active'), // active, completed
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Scribbles ──────────────────────────────────────────────────────────────────

export const scribbles = pgTable('scribbles', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  imageUrl: text('image_url').notNull(),
  strokes: jsonb('strokes').$type<unknown[]>().default([]),
  backgroundColor: varchar('background_color', { length: 20 }).default('#ffffff'),
  messageId: uuid('message_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Music (shared playlists) ───────────────────────────────────────────────────

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  coverUrl: text('cover_url'),
  trackCount: integer('track_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const playlistTracks = pgTable('playlist_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id')
    .notNull()
    .references(() => playlists.id, { onDelete: 'cascade' }),
  addedBy: uuid('added_by')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  artist: varchar('artist', { length: 200 }),
  album: varchar('album', { length: 200 }),
  coverUrl: text('cover_url'),
  source: varchar('source', { length: 20 }).default('youtube'), // youtube, spotify, url
  sourceId: varchar('source_id', { length: 200 }),
  url: text('url'),
  duration: integer('duration'),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Watch Party sessions ───────────────────────────────────────────────────────

export const watchParties = pgTable('watch_parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  hostId: uuid('host_id')
    .notNull()
    .references(() => users.id),
  source: varchar('source', { length: 20 }).default('youtube'), // youtube, url
  videoId: varchar('video_id', { length: 200 }),
  videoUrl: text('video_url'),
  title: varchar('title', { length: 300 }),
  status: varchar('status', { length: 20 }).default('active'), // active, ended
  createdAt: timestamp('created_at').defaultNow(),
  endedAt: timestamp('ended_at'),
});

// ─── Call sessions ──────────────────────────────────────────────────────────────

export const callSessions = pgTable('call_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references(() => couples.id),
  callerId: uuid('caller_id')
    .notNull()
    .references(() => users.id),
  calleeId: uuid('callee_id')
    .notNull()
    .references(() => users.id),
  type: varchar('type', { length: 20 }).default('voice'), // voice, video, screen
  status: varchar('status', { length: 20 }).default('ringing'), // ringing, ongoing, ended, missed, declined
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  durationSec: integer('duration_sec').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Constellation of Us ─────────────────────────────────────────────────────
export const constellationStars = pgTable('constellation_stars', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references((): AnyPgColumn => couples.id),
  constellationKey: varchar('constellation_key', { length: 40 }).notNull(),
  promptKey: varchar('prompt_key', { length: 80 }),
  kind: varchar('kind', { length: 16 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  answers: jsonb('answers').notNull().default({}),
  photoUrl: varchar('photo_url', { length: 512 }),
  posX: integer('pos_x').notNull().default(500),
  posY: integer('pos_y').notNull().default(500),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  litAt: timestamp('lit_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  promptUnique: uniqueIndex('constellation_prompt_unique')
    .on(t.coupleId, t.promptKey)
    .where(sql`${t.promptKey} is not null`),
}));

// ─── Push Devices ───────────────────────────────────────────────────────────────

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  deviceType: varchar('device_type', { length: 20 }).notNull(), // ios, android, web
  deviceToken: varchar('device_token', { length: 500 }).notNull(),
  deviceName: varchar('device_name', { length: 100 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Email Verification Codes ───────────────────────────────────────────────────

export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  code: varchar('code', { length: 10 }).notNull(),
  purpose: varchar('purpose', { length: 30 }).default('email_verification'),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Relations ──────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  couple: one(couples, {
    fields: [users.coupleId],
    references: [couples.id],
  }),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
  sentMessages: many(messages, { relationName: 'sender' }),
  receivedMessages: many(messages, { relationName: 'receiver' }),
  messageReactions: many(messageReactions),
  refreshTokens: many(refreshTokens),
  createdImportantDates: many(importantDates),
  sentInvites: many(coupleInvites, { relationName: 'inviter' }),
  uploadedMedia: many(media),
  createdAlbums: many(mediaAlbums),
  achievements: many(userAchievements),
  notifications: many(notifications),
}));

export const couplesRelations = relations(couples, ({ one, many }) => ({
  partner1: one(users, {
    fields: [couples.partner1Id],
    references: [users.id],
    relationName: 'partner1',
  }),
  partner2: one(users, {
    fields: [couples.partner2Id],
    references: [users.id],
    relationName: 'partner2',
  }),
  messages: many(messages),
  invites: many(coupleInvites),
  importantDates: many(importantDates),
  media: many(media),
  mediaAlbums: many(mediaAlbums),
  photoStreak: one(photoStreaks, {
    fields: [couples.id],
    references: [photoStreaks.coupleId],
  }),
  userAchievements: many(userAchievements),
  notifications: many(notifications),
  dateCelebrations: many(dateCelebrations),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  couple: one(couples, {
    fields: [messages.coupleId],
    references: [couples.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: 'receiver',
  }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const coupleInvitesRelations = relations(coupleInvites, ({ one }) => ({
  couple: one(couples, {
    fields: [coupleInvites.coupleId],
    references: [couples.id],
  }),
  inviter: one(users, {
    fields: [coupleInvites.inviterId],
    references: [users.id],
    relationName: 'inviter',
  }),
  acceptedByUser: one(users, {
    fields: [coupleInvites.acceptedBy],
    references: [users.id],
    relationName: 'acceptedBy',
  }),
}));

export const importantDatesRelations = relations(importantDates, ({ one, many }) => ({
  couple: one(couples, {
    fields: [importantDates.coupleId],
    references: [couples.id],
  }),
  creator: one(users, {
    fields: [importantDates.createdBy],
    references: [users.id],
  }),
  celebrations: many(dateCelebrations),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const mediaAlbumsRelations = relations(mediaAlbums, ({ one, many }) => ({
  couple: one(couples, {
    fields: [mediaAlbums.coupleId],
    references: [couples.id],
  }),
  creator: one(users, {
    fields: [mediaAlbums.createdBy],
    references: [users.id],
  }),
  mediaItems: many(media),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  couple: one(couples, {
    fields: [media.coupleId],
    references: [couples.id],
  }),
  uploader: one(users, {
    fields: [media.uploaderId],
    references: [users.id],
  }),
  album: one(mediaAlbums, {
    fields: [media.albumId],
    references: [mediaAlbums.id],
  }),
}));

// ─── Phase 4 Relations ─────────────────────────────────────────────────────────

export const photoStreaksRelations = relations(photoStreaks, ({ one, many }) => ({
  couple: one(couples, {
    fields: [photoStreaks.coupleId],
    references: [couples.id],
  }),
  history: many(streakHistory),
}));

export const streakHistoryRelations = relations(streakHistory, ({ one }) => ({
  streak: one(photoStreaks, {
    fields: [streakHistory.streakId],
    references: [photoStreaks.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  couple: one(couples, {
    fields: [userAchievements.coupleId],
    references: [couples.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  couple: one(couples, {
    fields: [notifications.coupleId],
    references: [couples.id],
  }),
}));

export const dateCelebrationsRelations = relations(dateCelebrations, ({ one }) => ({
  importantDate: one(importantDates, {
    fields: [dateCelebrations.dateId],
    references: [importantDates.id],
  }),
}));

// ─── Phase 5+ Relations ──────────────────────────────────────────────────────────

export const circlesRelations = relations(circles, ({ one, many }) => ({
  createdByCouple: one(couples, {
    fields: [circles.createdByCoupleId],
    references: [couples.id],
  }),
  followers: many(circleFollows, { relationName: 'following' }),
  following: many(circleFollows, { relationName: 'follower' }),
  posts: many(circlePosts),
  stories: many(circleStories),
  conversationsAsLo: many(circleConversations, { relationName: 'circleLoConversations' }),
  conversationsAsHi: many(circleConversations, { relationName: 'circleHiConversations' }),
}));

export const circleFollowsRelations = relations(circleFollows, ({ one }) => ({
  follower: one(circles, {
    fields: [circleFollows.followerCircleId],
    references: [circles.id],
    relationName: 'follower',
  }),
  following: one(circles, {
    fields: [circleFollows.followingCircleId],
    references: [circles.id],
    relationName: 'following',
  }),
  requestedByUser: one(users, {
    fields: [circleFollows.requestedByUserId],
    references: [users.id],
  }),
}));

export const circlePostsRelations = relations(circlePosts, ({ one, many }) => ({
  circle: one(circles, {
    fields: [circlePosts.circleId],
    references: [circles.id],
  }),
  author: one(users, {
    fields: [circlePosts.authorId],
    references: [users.id],
  }),
  likes: many(postLikes),
  comments: many(postComments),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(circlePosts, {
    fields: [postLikes.postId],
    references: [circlePosts.id],
  }),
  user: one(users, { fields: [postLikes.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(circlePosts, {
    fields: [postComments.postId],
    references: [circlePosts.id],
  }),
  user: one(users, { fields: [postComments.userId], references: [users.id] }),
}));

export const circleStoriesRelations = relations(circleStories, ({ one, many }) => ({
  circle: one(circles, {
    fields: [circleStories.circleId],
    references: [circles.id],
  }),
  couple: one(couples, {
    fields: [circleStories.coupleId],
    references: [couples.id],
  }),
  author: one(users, {
    fields: [circleStories.authorId],
    references: [users.id],
  }),
  views: many(circleStoryViews),
}));

export const circleStoryViewsRelations = relations(circleStoryViews, ({ one }) => ({
  story: one(circleStories, {
    fields: [circleStoryViews.storyId],
    references: [circleStories.id],
  }),
  viewer: one(users, {
    fields: [circleStoryViews.viewerUserId],
    references: [users.id],
  }),
  viewerCircle: one(circles, {
    fields: [circleStoryViews.viewerCircleId],
    references: [circles.id],
  }),
}));

export const customEmojisRelations = relations(customEmojis, ({ one }) => ({
  couple: one(couples, {
    fields: [customEmojis.coupleId],
    references: [couples.id],
  }),
  creator: one(users, {
    fields: [customEmojis.createdBy],
    references: [users.id],
  }),
}));

export const soundboardSoundsRelations = relations(soundboardSounds, ({ one }) => ({
  couple: one(couples, {
    fields: [soundboardSounds.coupleId],
    references: [couples.id],
  }),
}));

export const paintingsRelations = relations(paintings, ({ one }) => ({
  couple: one(couples, { fields: [paintings.coupleId], references: [couples.id] }),
  creator: one(users, { fields: [paintings.createdBy], references: [users.id] }),
}));

export const scribblesRelations = relations(scribbles, ({ one }) => ({
  couple: one(couples, { fields: [scribbles.coupleId], references: [couples.id] }),
  creator: one(users, { fields: [scribbles.createdBy], references: [users.id] }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  couple: one(couples, { fields: [playlists.coupleId], references: [couples.id] }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistTracks.playlistId],
    references: [playlists.id],
  }),
}));

export const watchPartiesRelations = relations(watchParties, ({ one }) => ({
  couple: one(couples, { fields: [watchParties.coupleId], references: [couples.id] }),
  host: one(users, { fields: [watchParties.hostId], references: [users.id] }),
}));

export const callSessionsRelations = relations(callSessions, ({ one }) => ({
  couple: one(couples, { fields: [callSessions.coupleId], references: [couples.id] }),
  caller: one(users, {
    fields: [callSessions.callerId],
    references: [users.id],
    relationName: 'caller',
  }),
  callee: one(users, {
    fields: [callSessions.calleeId],
    references: [users.id],
    relationName: 'callee',
  }),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
}));

export const verificationCodesRelations = relations(verificationCodes, ({ one }) => ({
  user: one(users, { fields: [verificationCodes.userId], references: [users.id] }),
}));

export const circleConversationsRelations = relations(circleConversations, ({ one, many }) => ({
  circleLo: one(circles, {
    fields: [circleConversations.circleLoId],
    references: [circles.id],
    relationName: 'circleLoConversations',
  }),
  circleHi: one(circles, {
    fields: [circleConversations.circleHiId],
    references: [circles.id],
    relationName: 'circleHiConversations',
  }),
  messages: many(circleConversationMessages),
  reads: many(circleConversationReads),
}));

export const circleConversationMessagesRelations = relations(
  circleConversationMessages,
  ({ one }) => ({
    conversation: one(circleConversations, {
      fields: [circleConversationMessages.conversationId],
      references: [circleConversations.id],
    }),
    senderUser: one(users, {
      fields: [circleConversationMessages.senderUserId],
      references: [users.id],
    }),
    senderCircle: one(circles, {
      fields: [circleConversationMessages.senderCircleId],
      references: [circles.id],
    }),
  }),
);

export const circleConversationReadsRelations = relations(
  circleConversationReads,
  ({ one }) => ({
    conversation: one(circleConversations, {
      fields: [circleConversationReads.conversationId],
      references: [circleConversations.id],
    }),
    circle: one(circles, {
      fields: [circleConversationReads.circleId],
      references: [circles.id],
    }),
  }),
);
