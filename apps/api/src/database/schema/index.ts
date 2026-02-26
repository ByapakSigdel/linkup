import { relations } from 'drizzle-orm';
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
