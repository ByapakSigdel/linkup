// Typed client for the Instagram-for-couples Circles API. Ported from
// apps/web/src/lib/circles-api.ts. Every function wraps a route on the NestJS
// CirclesController, uses the shared axios `api` instance (auto-attaches the
// bearer token), and returns the unwrapped `data` payload from the
// { success, data } envelope.

import api from '@/lib/api';
import type {
  CircleProfileResponse,
  MyCircleResponse,
  CircleProfile,
  CircleSummary,
  CirclePost,
  FeedPost,
  Comment,
  Story,
  StoryTray,
  FollowRequest,
  StoryViewer,
  FollowState,
} from '@/components/circles/types';

// ─── Input shapes (mirror @linkup/validation zod schemas) ──────────────────────

export interface CreateCircleInput {
  handle: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
}

export interface UpdateCircleInput {
  handle?: string;
  name?: string;
  bio?: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  isPrivate?: boolean;
}

export interface CreatePostInput {
  caption?: string;
  mediaUrls: string[];
  type?: 'photo' | 'video' | 'carousel';
  metadata?: Record<string, unknown>;
}

export interface CreateStoryInput {
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  durationMs?: number;
}

/** Cursor-based pagination params shared by list endpoints. */
export interface PageParams {
  cursor?: string;
  limit?: number;
}

/** RN upload descriptor (from expo-image-picker) used in place of `File`. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Unwrap the { success, data } envelope. */
async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

function pageQuery(params?: PageParams): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  if (params?.cursor) q.cursor = params.cursor;
  if (params?.limit != null) q.limit = params.limit;
  return q;
}

// ─── Profile (opt-in) ──────────────────────────────────────────────────────────

/** POST /circles — opt-in create THIS couple's circle. */
export function createCircle(
  input: CreateCircleInput,
): Promise<{ circle: CircleProfileResponse['circle'] }> {
  return unwrap(api.post('/circles', input));
}

/** GET /circles/me — my couple's circle + owner stats (circle:null => show CTA). */
export function getMyCircle(): Promise<MyCircleResponse> {
  return unwrap(api.get('/circles/me'));
}

/** PATCH /circles/me — edit own circle. */
export function updateMyCircle(
  input: UpdateCircleInput,
): Promise<{ circle: CircleProfileResponse['circle'] }> {
  return unwrap(api.patch('/circles/me', input));
}

/** DELETE /circles/me — delete own circle. */
export function deleteMyCircle(): Promise<{ success: boolean }> {
  return unwrap(api.delete('/circles/me'));
}

/** GET /circles/:idOrHandle — view a profile by uuid or @handle. */
export function getCircle(idOrHandle: string): Promise<CircleProfileResponse> {
  return unwrap(api.get(`/circles/${encodeURIComponent(idOrHandle)}`));
}

// ─── Posts ───────────────────────────────────────────────────────────────────

/** GET /circles/:id/posts — profile grid (newest first, cursor-paginated). */
export function getCirclePosts(
  idOrHandle: string,
  params?: PageParams,
): Promise<{ posts: CirclePost[]; nextCursor: string | null }> {
  return unwrap(
    api.get(`/circles/${encodeURIComponent(idOrHandle)}/posts`, {
      params: pageQuery(params),
    }),
  );
}

/** POST /circles/me/posts — create a post on OWN circle. */
export function createPost(
  input: CreatePostInput,
): Promise<{ post: CirclePost }> {
  return unwrap(api.post('/circles/me/posts', input));
}

/** DELETE /circles/me/posts/:postId — delete own post. */
export function deletePost(postId: string): Promise<{ success: boolean }> {
  return unwrap(api.delete(`/circles/me/posts/${postId}`));
}

/** POST /circles/:id/posts/:postId/like — toggle like. */
export function toggleLike(
  idOrHandle: string,
  postId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return unwrap(
    api.post(`/circles/${encodeURIComponent(idOrHandle)}/posts/${postId}/like`),
  );
}

// ─── Comments ───────────────────────────────────────────────────────────────

/** GET /circles/:id/posts/:postId/comments — list comments (cursor-paginated). */
export function getComments(
  idOrHandle: string,
  postId: string,
  params?: PageParams,
): Promise<{ comments: Comment[]; nextCursor: string | null }> {
  return unwrap(
    api.get(`/circles/${encodeURIComponent(idOrHandle)}/posts/${postId}/comments`, {
      params: pageQuery(params),
    }),
  );
}

/** POST /circles/:id/posts/:postId/comments — add a comment. */
export function addComment(
  idOrHandle: string,
  postId: string,
  content: string,
): Promise<{ comment: Comment }> {
  return unwrap(
    api.post(`/circles/${encodeURIComponent(idOrHandle)}/posts/${postId}/comments`, {
      content,
    }),
  );
}

/** DELETE /circles/:id/posts/:postId/comments/:commentId — delete a comment. */
export function deleteComment(
  idOrHandle: string,
  postId: string,
  commentId: string,
): Promise<{ success: boolean }> {
  return unwrap(
    api.delete(
      `/circles/${encodeURIComponent(idOrHandle)}/posts/${postId}/comments/${commentId}`,
    ),
  );
}

// ─── Follows ───────────────────────────────────────────────────────────────

/** POST /circles/:id/follow — follow (public => accepted, private => pending). */
export function follow(
  idOrHandle: string,
): Promise<{ follow: { status: FollowState } }> {
  return unwrap(api.post(`/circles/${encodeURIComponent(idOrHandle)}/follow`));
}

/** DELETE /circles/:id/follow — unfollow / cancel pending request. */
export function unfollow(idOrHandle: string): Promise<{ success: boolean }> {
  return unwrap(api.delete(`/circles/${encodeURIComponent(idOrHandle)}/follow`));
}

/** GET /circles/me/followers — accepted followers of my circle. */
export function getFollowers(
  params?: PageParams,
): Promise<{ followers: CircleSummary[]; nextCursor: string | null }> {
  return unwrap(api.get('/circles/me/followers', { params: pageQuery(params) }));
}

/** GET /circles/me/following — circles my circle follows (accepted). */
export function getFollowing(
  params?: PageParams,
): Promise<{ following: CircleSummary[]; nextCursor: string | null }> {
  return unwrap(api.get('/circles/me/following', { params: pageQuery(params) }));
}

/** GET /circles/:id/followers — accepted followers of a specific circle. */
export function getCircleFollowers(
  idOrHandle: string,
  params?: PageParams,
): Promise<{ followers: CircleSummary[]; nextCursor: string | null }> {
  return unwrap(
    api.get(`/circles/${encodeURIComponent(idOrHandle)}/followers`, {
      params: pageQuery(params),
    }),
  );
}

/** GET /circles/:id/following — circles a specific circle follows (accepted). */
export function getCircleFollowing(
  idOrHandle: string,
  params?: PageParams,
): Promise<{ following: CircleSummary[]; nextCursor: string | null }> {
  return unwrap(
    api.get(`/circles/${encodeURIComponent(idOrHandle)}/following`, {
      params: pageQuery(params),
    }),
  );
}

/** GET /circles/me/requests — pending incoming follow requests (owner). */
export function getRequests(
  params?: PageParams,
): Promise<{ requests: FollowRequest[]; nextCursor: string | null }> {
  return unwrap(api.get('/circles/me/requests', { params: pageQuery(params) }));
}

/** POST /circles/me/requests/:followId/accept — accept a request. */
export function acceptRequest(
  followId: string,
): Promise<{ follow: { id: string; status: FollowState } }> {
  return unwrap(api.post(`/circles/me/requests/${followId}/accept`));
}

/** POST /circles/me/requests/:followId/decline — decline a request. */
export function declineRequest(
  followId: string,
): Promise<{ success: boolean }> {
  return unwrap(api.post(`/circles/me/requests/${followId}/decline`));
}

// ─── Feed / Discover ─────────────────────────────────────────────────────────

/** GET /circles/feed — Instagram home feed of followed circles + own. */
export function getFeed(
  params?: PageParams,
): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  return unwrap(api.get('/circles/feed', { params: pageQuery(params) }));
}

/** GET /circles/discover — find circles to follow (q searches handle/name/bio). */
export function discover(
  params?: PageParams & { q?: string },
): Promise<{ circles: CircleProfile[]; nextCursor: string | null }> {
  const query = pageQuery(params) as Record<string, string | number>;
  if (params?.q) query.q = params.q;
  return unwrap(api.get('/circles/discover', { params: query }));
}

// ─── Stories ───────────────────────────────────────────────────────────────

/** GET /circles/stories — story tray (own first, then followed). */
export function getStoryTray(): Promise<{ trays: StoryTray[] }> {
  return unwrap(api.get('/circles/stories'));
}

/** POST /circles/me/stories — add a story to MY circle. */
export function addStory(
  input: CreateStoryInput,
): Promise<{ story: Story }> {
  return unwrap(api.post('/circles/me/stories', input));
}

/** GET /circles/:id/stories — active stories for a circle. */
export function getCircleStories(
  idOrHandle: string,
): Promise<{ stories: Story[] }> {
  return unwrap(api.get(`/circles/${encodeURIComponent(idOrHandle)}/stories`));
}

/** POST /circles/stories/:storyId/view — record a view (idempotent). */
export function viewStory(storyId: string): Promise<{ viewCount: number }> {
  return unwrap(api.post(`/circles/stories/${storyId}/view`));
}

/** GET /circles/me/stories/:storyId/viewers — owner-only viewer list. */
export function getStoryViewers(
  storyId: string,
): Promise<{ viewers: StoryViewer[] }> {
  return unwrap(api.get(`/circles/me/stories/${storyId}/viewers`));
}

/** DELETE /circles/me/stories/:storyId — owner deletes own story. */
export function deleteStory(storyId: string): Promise<{ success: boolean }> {
  return unwrap(api.delete(`/circles/me/stories/${storyId}`));
}

// ─── Media upload (reused existing endpoint) ───────────────────────────────────

/**
 * POST /media/upload — multipart upload (field `file`, body `coupleId`).
 * On React Native FormData accepts a `{ uri, name, type }` descriptor.
 * Returns the uploaded media; use `.media.cdnUrl` as the post/story media URL.
 */
export async function uploadMedia(
  file: UploadFile,
  coupleId: string,
): Promise<{ media: { cdnUrl: string; [key: string]: unknown } }> {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  form.append('coupleId', coupleId);
  const res = await api.post('/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}
