// ============================================
// Social Types (Friends, Circles, Streaks, Hall of Fame)
// ============================================

export interface SingleFriend {
  id: string;
  coupleId: string;
  friendType: 'individual' | 'couple';
  friendUserId?: string;
  friendCoupleId?: string;
  status: 'pending_invite' | 'pending_approval' | 'active' | 'removed' | 'blocked';
  invitedBy: string;
  approvalStatus: {
    partner1Approved: boolean;
    partner2Approved: boolean;
  };
  displayName: string;
  avatarUrl?: string;
  permissions: FriendPermissions;
  invitedAt: string;
  connectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FriendPermissions {
  canSeePhotos: boolean;
  canSeeVideos: boolean;
  canSeeHallOfFame: boolean;
  canSeeCirclePosts: boolean;
  canComment: boolean;
  canReact: boolean;
}

export interface CoupleCircle {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  memberCount: number;
  maxMembers: number;
  isPrivate: boolean;
  members: CircleMember[];
  createdAt: string;
  updatedAt: string;
}

export interface CircleMember {
  id: string;
  circleId: string;
  coupleId: string;
  role: 'admin' | 'member';
  joinedAt: string;
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
