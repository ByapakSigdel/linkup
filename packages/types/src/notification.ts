// ============================================
// Notification Types
// ============================================

export type NotificationType =
  | 'message'
  | 'call_missed'
  | 'call_incoming'
  | 'streak_reminder'
  | 'streak_broken'
  | 'anniversary'
  | 'date_reminder'
  | 'achievement'
  // Circles (Instagram-for-couples) — follows/likes/comments
  | 'circle_follow'
  | 'circle_follow_request'
  | 'circle_follow_accepted'
  | 'circle_post_like'
  | 'circle_comment'
  | 'highlight'
  | 'media_shared'
  | 'relationship_ended'
  | 'system';

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

  // Action
  actionUrl?: string;
  actionData?: Record<string, string>;

  // Status
  isRead: boolean;
  readAt?: string;
  isDismissed: boolean;

  // Scheduling
  scheduledFor?: string;
  sentAt?: string;

  createdAt: string;
}
