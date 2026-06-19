// ============================================
// Social Types (Circles, Streaks, Hall of Fame)
// ============================================
// Circles is "Instagram for couples": each couple opts in to ONE profile
// (a Circle), follows other couples' circles one-way (public = auto-accepted,
// private = pending request), posts to a grid, and shares 24h stories.

/** Follow relationship state of the viewer's circle toward a target circle. */
export type FollowState = 'none' | 'pending' | 'accepted';

/** A couple's public/private profile — exactly one per couple. */
export interface Circle {
  id: string;
  handle: string; // @handle, lowercase [a-z0-9_], unique
  name: string; // display name
  bio?: string; // maps to DB `description`
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

/**
 * A Circle enriched with the viewer's perspective — returned by
 * GET /circles/:idOrHandle and discover results.
 */
export interface CircleProfile extends Circle {
  isOwner: boolean;
  followState: FollowState;
  canViewPosts: boolean;
}

/** One-way follow edge between two circles (couple-to-couple). */
export interface CircleFollow {
  id: string;
  followerCircleId: string;
  followingCircleId: string;
  status: Extract<FollowState, 'pending' | 'accepted'>;
  requestedByUserId: string;
  createdAt: string;
  acceptedAt?: string;
}

/** A pending incoming follow request shown in the owner's requests inbox. */
export interface FollowRequest {
  followId: string;
  circle: CircleSummary; // the requesting circle
  createdAt: string;
}

/** Lightweight circle reference used in feed/follower/request lists. */
export interface CircleSummary {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
}

/** A photo/video post on a couple's own circle (grid item). */
export interface CirclePost {
  id: string;
  circleId: string;
  coupleId: string;
  authorId: string;
  caption?: string; // maps to DB `content` (nullable, photo-first)
  type: 'photo' | 'video' | 'carousel';
  mediaUrls: string[];
  metadata?: Record<string, unknown>;
  likeCount: number;
  commentCount: number;
  likedByMe?: boolean;
  createdAt: string;
}

/** A post in the home feed — carries the authoring circle for rendering. */
export interface FeedPost extends CirclePost {
  circle: CircleSummary;
}

/** An ephemeral 24h story owned by a circle. */
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

/** A story group for the story ring — one tray per circle. */
export interface StoryTray {
  circle: CircleSummary;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string;
}

/** Who viewed a story (owner-only viewer list). */
export interface StoryViewer {
  user: {
    displayName: string;
    avatarUrl?: string;
  };
  viewedAt: string;
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

export type AchievementType =
  | 'first_message'
  | 'message_milestone'
  | 'call_milestone'
  | 'streak_milestone'
  | 'first_scribble'
  | 'first_emoji'
  | 'anniversary'
  | 'days_together'
  | 'photo_milestone'
  | 'first_friend'
  | 'first_circle'
  | 'custom';
