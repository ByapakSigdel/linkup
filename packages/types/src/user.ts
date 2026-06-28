// ============================================
// User Types
// ============================================

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

  // Couple reference
  coupleId?: string;
  /** Pointer to a past couple kept read-only after the survivor chose to go solo. */
  archivedCoupleId?: string | null;
  /** Non-null once the account is tombstoned (anonymized after deletion). */
  deletedAt?: string | null;

  // Settings
  themeId: string;
  locale: string;
  timezone: string;

  // Status
  isOnline: boolean;
  lastSeenAt?: string;
  isVerified: boolean;
  isActive: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'bio' | 'isOnline' | 'lastSeenAt'> {
  couplePartnerName?: string;
  coupleSince?: string;
}

export interface UserSettings {
  id: string;
  userId: string;

  // Theme
  themeId: string;
  customThemeOverrides?: Partial<ThemeTokens>;

  // Notifications
  pushNotifications: boolean;
  messageNotifications: boolean;
  callNotifications: boolean;
  streakReminders: boolean;
  anniversaryReminders: boolean;

  // Privacy
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  showTypingIndicator: boolean;

  // Media
  autoDownloadMedia: boolean;
  mediaQuality: 'low' | 'medium' | 'high' | 'original';

  // Accessibility
  fontSize: 'small' | 'medium' | 'large';
  reduceMotion: boolean;
  highContrast: boolean;

  createdAt: string;
  updatedAt: string;
}

// Imported for reference
import type { ThemeTokens } from './theme';
