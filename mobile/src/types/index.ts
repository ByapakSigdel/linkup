// Ported from @linkup/types — the SAME contracts the web app + API use.

// ─── User ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  phone?: string;
  coupleId?: string;
  themeId: string;
  locale: string;
  timezone: string;
  isOnline: boolean;
  lastSeenAt?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Couple ─────────────────────────────────────────────────────────────────
export interface Couple {
  id: string;
  partner1Id: string;
  partner2Id: string;
  coupleName?: string;
  coupleAvatarUrl?: string;
  anniversaryDate?: string;
  relationshipStatus: 'dating' | 'engaged' | 'married' | 'other';
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  isPaired: boolean;
  messageCount: number;
  mediaCount: number;
  streakCurrent: number;
  streakLongest: number;
  daysTogetherCount: number;
  sharedThemeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportantDate {
  id: string;
  coupleId: string;
  title: string;
  description?: string;
  date: string;
  type: 'anniversary' | 'birthday' | 'custom' | 'first-date' | 'engagement' | 'wedding';
  isRecurring: boolean;
  recurringType?: 'yearly' | 'monthly' | 'weekly';
  reminderDaysBefore: number[];
  reminderEnabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Message ────────────────────────────────────────────────────────────────
export type MessageType =
  | 'text' | 'photo' | 'video' | 'voice' | 'file'
  | 'location' | 'scribble' | 'poll' | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type HighlightCategory =
  | 'love' | 'funny' | 'important' | 'celebration' | 'milestone' | 'custom';

export interface MessageReaction {
  userId: string;
  emoji: string;
  timestamp: string;
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface Message {
  id: string;
  coupleId: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: MessageType;
  mediaUrls?: string[];
  fileMetadata?: FileMetadata;
  linkPreview?: LinkPreview;
  threadId?: string;
  isThreadStarter?: boolean;
  threadReplyCount?: number;
  threadLastReplyAt?: string;
  isHighlighted?: boolean;
  highlightColor?: string;
  highlightNote?: string;
  highlightCategory?: HighlightCategory;
  reactions?: Record<string, MessageReaction[]>;
  status: MessageStatus;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TypingIndicator {
  coupleId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

// ─── Media ──────────────────────────────────────────────────────────────────
export type ContentVisibility =
  | 'private' | 'friends' | 'selected_friends' | 'circles' | 'friends_and_circles';

export interface MediaLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface Photo {
  id: string;
  coupleId: string;
  uploadedBy: string;
  originalUrl: string;
  thumbnailUrl: string;
  mediumUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  takenAt?: string;
  location?: MediaLocation;
  albumIds: string[];
  tags: string[];
  description?: string;
  isFavorite: boolean;
  visibility: ContentVisibility;
  uploadedAt: string;
  createdAt: string;
}

export interface Album {
  id: string;
  coupleId: string;
  name: string;
  description?: string;
  coverPhotoId?: string;
  coverPhotoUrl?: string;
  type: 'manual' | 'smart';
  photoCount: number;
  lastPhotoAddedAt?: string;
  isShared: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Social: Circles, Streaks, Hall of Fame ──────────────────────────────────
export type FollowState = 'none' | 'pending' | 'accepted';

export interface Circle {
  id: string;
  handle: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdByCoupleId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CircleProfile extends Circle {
  isOwner: boolean;
  followState: FollowState;
  canViewPosts: boolean;
}

export interface CircleSummary {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
}

export interface FollowRequest {
  followId: string;
  circle: CircleSummary;
  createdAt: string;
}

export interface CirclePost {
  id: string;
  circleId: string;
  coupleId: string;
  authorId: string;
  caption?: string;
  type: 'photo' | 'video' | 'carousel';
  mediaUrls: string[];
  metadata?: Record<string, unknown>;
  likeCount: number;
  commentCount: number;
  likedByMe?: boolean;
  createdAt: string;
}

export interface FeedPost extends CirclePost {
  circle: CircleSummary;
}

export interface Story {
  id: string;
  circleId: string;
  coupleId: string;
  authorId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  durationMs: number;
  caption?: string;
  viewCount: number;
  viewedByMe?: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface StoryTray {
  circle: CircleSummary;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
}

export interface PhotoStreak {
  id: string;
  coupleId: string;
  currentStreak: number;
  longestStreak: number;
  lastPhotoDate: string;
  lastPhotoByPartner1: boolean;
  lastPhotoByPartner2: boolean;
  totalPhotos: number;
  freezesUsed: number;
  freezesAvailable: number;
  status: 'active' | 'broken' | 'frozen';
  startedAt: string;
  brokenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type AchievementType =
  | 'first_message' | 'message_milestone' | 'call_milestone' | 'streak_milestone'
  | 'first_scribble' | 'first_emoji' | 'anniversary' | 'days_together'
  | 'photo_milestone' | 'first_friend' | 'first_circle' | 'custom';

export interface Achievement {
  id: string;
  coupleId: string;
  type: AchievementType;
  title: string;
  description: string;
  iconUrl: string;
  unlockedAt: string;
  milestone?: number;
  category: 'communication' | 'creativity' | 'streaks' | 'milestones' | 'social' | 'special';
  isNew: boolean;
  createdAt: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType =
  | 'message' | 'call_missed' | 'call_incoming' | 'streak_reminder'
  | 'streak_broken' | 'anniversary' | 'date_reminder' | 'achievement'
  | 'circle_follow' | 'circle_follow_request' | 'circle_follow_accepted'
  | 'circle_post_like' | 'circle_comment' | 'highlight' | 'media_shared' | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  userId: string;
  coupleId?: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  actionData?: Record<string, string>;
  isRead: boolean;
  status?: string;
  readAt?: string;
  isDismissed: boolean;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
}

// ─── Theme variants/decorations ──────────────────────────────────────────────
export interface ThemeVariants {
  button: 'rounded' | 'pill' | 'square' | 'organic';
  card: 'flat' | 'elevated' | 'bordered' | 'sticker';
  input: 'underline' | 'outlined' | 'filled' | 'rounded';
  nav: 'sidebar' | 'top' | 'bottom';
  messageBubble: 'rounded' | 'sharp' | 'cloud' | 'organic';
  avatar: 'circle' | 'squircle' | 'hexagon' | 'organic';
  divider: 'line' | 'wave' | 'dots' | 'zigzag' | 'none';
  container: 'clean' | 'textured' | 'gradient' | 'pattern';
}

export interface ThemeDecorations {
  backgroundPattern?: string;
  hasSectionDividers: boolean;
  hasPageOrnaments: boolean;
  animationIntensity: 'none' | 'subtle' | 'moderate' | 'playful';
  cursorStyle?: string;
  scrollbarStyle: 'default' | 'thin' | 'hidden' | 'custom';
  emptyStateStyle: 'minimal' | 'illustrated' | 'animated';
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── API envelope ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
