// Local view-model types for the Couple Circles feature. These mirror the
// shapes returned by the `/circles` API endpoints (which are richer than the
// shared `CoupleCircle` type in @linkup/types).

export interface CircleListItem {
  id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  memberCount: number;
  postCount: number;
  isAdmin: boolean;
  inviteCode?: string | null;
}

export interface CircleDetail {
  id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  inviteCode?: string | null;
  isPrivate: boolean;
  memberCount: number;
  postCount: number;
  isAdmin?: boolean;
  createdByCoupleId?: string | null;
}

export interface CircleMemberView {
  id?: string;
  coupleId: string;
  role: 'admin' | 'member';
  coupleName?: string | null;
  coupleAvatarUrl?: string | null;
  partnerNames?: string[];
}

export type CirclePostType = 'post' | 'poll' | 'event' | 'announcement';

export interface CirclePostView {
  id: string;
  content: string;
  type: CirclePostType | string;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  mediaUrls?: string[] | null;
}

export interface CircleCommentView {
  id: string;
  content: string;
  userId: string;
  createdAt: string;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
}

export interface CircleStats {
  memberCount: number;
  postCount: number;
  activityScore: number;
}
