export interface FriendUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  isOnline?: boolean | null;
}

export interface FriendCouple {
  id: string;
  coupleName?: string | null;
  coupleAvatarUrl?: string | null;
}

export interface FriendPermissions {
  viewPhotos: boolean;
  viewVideos: boolean;
  viewMessages: boolean;
  viewAchievements: boolean;
  commentOnPosts: boolean;
}

export interface Friend {
  id: string;
  status: string;
  isOwner?: boolean;
  permissions?: Partial<FriendPermissions> | null;
  friendUser?: FriendUser | null;
  friendCouple?: FriendCouple | null;
}

export interface ReceivedInvitation {
  id: string;
  fromCouple?: FriendCouple | null;
  fromUser?: FriendUser | null;
  createdAt?: string;
}

export interface SentInvitation {
  id: string;
  toEmail?: string | null;
  toUserId?: string | null;
  status: string;
}

export interface DiscoverUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export const PERMISSION_FIELDS: {
  key: keyof FriendPermissions;
  label: string;
  description: string;
}[] = [
  { key: 'viewPhotos', label: 'View photos', description: 'See your shared photos' },
  { key: 'viewVideos', label: 'View videos', description: 'See your shared videos' },
  {
    key: 'viewMessages',
    label: 'View messages',
    description: 'See selected shared messages',
  },
  {
    key: 'viewAchievements',
    label: 'View achievements',
    description: 'See your badges and streaks',
  },
  {
    key: 'commentOnPosts',
    label: 'Comment on posts',
    description: 'Leave comments on your posts',
  },
];

export const DEFAULT_PERMISSIONS: FriendPermissions = {
  viewPhotos: true,
  viewVideos: false,
  viewMessages: false,
  viewAchievements: true,
  commentOnPosts: true,
};
