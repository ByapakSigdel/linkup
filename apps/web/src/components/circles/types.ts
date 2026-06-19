// View-model types for the Instagram-for-couples Circles feature. These mirror
// the EXACT shapes returned by the `/circles` API serializers
// (apps/api/src/modules/circles/circles.service.ts). Read responses as
// `res.data.data.<field>` (standard { success, data } envelope).

/** Follow relationship of the viewer's circle toward a target circle. */
export type FollowState = 'none' | 'pending' | 'accepted';

/** Post media kind. */
export type PostType = 'photo' | 'video' | 'carousel';

/** Story media kind. */
export type StoryMediaType = 'image' | 'video';

/**
 * A couple's profile (one per couple). Combines the serialized `circle` row with
 * the viewer-relative flags returned alongside it by GET /circles/:idOrHandle.
 * (`isOwner`, `followState`, `canViewPosts` are returned as siblings of `circle`
 * in the API response; see `CircleProfileResponse` for the raw wrapper.)
 */
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
  /** Viewer owns this circle (their couple created it). */
  isOwner: boolean;
  /** Viewer's follow state toward this circle. */
  followState: FollowState;
  /** Whether the viewer may see this circle's posts/stories/comments. */
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
  /** Present on discover results. */
  followState?: FollowState;
}

/**
 * A post on a couple's circle. Returned by GET /circles/:id/posts (no `circle`),
 * GET /circles/feed and POST /circles/me/posts (with `circle`).
 */
export interface CirclePost {
  id: string;
  circleId: string;
  /** Present in feed + on create; omitted in the profile grid. */
  circle?: CircleSummary;
  coupleId: string;
  authorId: string;
  caption?: string;
  type: PostType | string;
  mediaUrls: string[];
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

/** A comment on a post (GET/POST /circles/:id/posts/:postId/comments). */
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

/** An ephemeral 24h story (GET /circles/:id/stories, POST /circles/me/stories). */
export interface Story {
  id: string;
  circleId: string;
  /** Present in the `circle:story:new` realtime payload. */
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

/** A grouped tray of one circle's active stories (GET /circles/stories). */
export interface StoryTray {
  circle: CircleSummary;
  stories: Story[];
  hasUnseen: boolean;
  latestAt: string | null;
}

/** A pending follow request for the owner's private circle (GET /circles/me/requests). */
export interface FollowRequest {
  followId: string;
  circle: CircleSummary;
  createdAt: string;
}

/** A viewer of an owner's story (GET /circles/me/stories/:storyId/viewers). */
export interface StoryViewer {
  user: {
    displayName: string;
    avatarUrl?: string;
  };
  viewedAt: string;
}
