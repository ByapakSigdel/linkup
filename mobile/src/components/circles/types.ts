// View-model types for the Instagram-for-couples Circles feature. Ported 1:1
// from apps/web/src/components/circles/types.ts — they mirror the EXACT shapes
// returned by the `/circles` API serializers. Read responses as
// `res.data.data.<field>` (standard { success, data } envelope).

/** Follow relationship of the viewer's circle toward a target circle. */
export type FollowState = 'none' | 'pending' | 'accepted';

/** Post media kind. */
export type PostType = 'photo' | 'video' | 'carousel';

/** Story media kind. */
export type StoryMediaType = 'image' | 'video';

/**
 * Per-item image variant map returned by the be-image-pipeline.
 * `variants.original` is always the full-resolution CDN URL.
 * `thumb` (~256px longest edge) and `medium` (~1080px) are populated for new
 * uploads; absent on older posts (clients must fall back to the plain URL).
 */
export interface MediaVariants {
  original?: string;
  thumb?: string;
  medium?: string;
  [key: string]: string | undefined;
}

export interface CircleProfile {
  id: string;
  handle: string | null;
  name: string;
  bio?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isOwner: boolean;
  followState: FollowState;
  canViewPosts: boolean;
}

/** Raw wrapper returned by GET /circles/:idOrHandle. */
export interface CircleProfileResponse {
  circle: {
    id: string;
    handle: string | null;
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
  };
  isOwner: boolean;
  followState: FollowState;
  canViewPosts: boolean;
  /** §Phase2 DM: the TARGET circle has an accepted follow toward the viewer. */
  followsYou?: boolean;
  /** §Phase2 DM: accepted follow in BOTH directions — gates the Message button. */
  isMutual?: boolean;
}

// ─── Direct messages (mutuals-only, couple-to-couple) ──────────────────────────

/**
 * Inbox row: a conversation with another circle. Mirrors the
 * CircleDmService.listConversations / openConversation serializer.
 */
export interface CircleConversation {
  id: string;
  otherCircle: CircleSummary | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/** A single DM message. Mirrors CircleDmService.serializeMessage. */
export interface CircleDmMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderCircleId: string;
  content?: string;
  mediaUrls: string[];
  createdAt: string | null;
  senderName: string | null;
  senderAvatarUrl: string | null;
}

/** Owner-stats payload from GET /circles/me. */
export interface MyCircleResponse {
  circle: CircleProfileResponse['circle'] | null;
  stats: {
    followerCount: number;
    followingCount: number;
    postCount: number;
  } | null;
  pendingRequestCount: number;
}

/** Lightweight circle reference (followers/following/feed/story tray/requests). */
export interface CircleSummary {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl?: string;
  followState?: FollowState;
}

export interface CirclePost {
  id: string;
  circleId: string;
  circle?: CircleSummary;
  coupleId: string;
  authorId: string;
  caption?: string;
  type: PostType | string;
  mediaUrls: string[];
  /**
   * Optional per-item variant maps from the image pipeline (§1.1).
   * Index-aligned with `mediaUrls`. Absent on old posts — always fall back
   * to `mediaUrls[i]` when the desired variant is missing.
   */
  mediaObjects?: MediaVariants[];
  metadata?: Record<string, unknown>;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  createdAt: string;
}

/** Alias: feed items are CirclePost with a populated `circle`. */
export type FeedPost = CirclePost;

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  authorUsername?: string | null;
  createdAt: string;
}

export interface Story {
  id: string;
  circleId: string;
  circle?: CircleSummary;
  coupleId: string;
  authorId: string;
  mediaUrl: string;
  mediaType: StoryMediaType | string;
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
  latestAt: string | null;
}

export interface FollowRequest {
  followId: string;
  circle: CircleSummary;
  createdAt: string;
}

export interface StoryViewer {
  user: {
    displayName: string;
    avatarUrl?: string;
  };
  viewedAt: string;
}
