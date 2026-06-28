// ============================================
// Couple Types
// ============================================

/** Survivor's choice on an ended couple (the relationship-memorial fork). */
export type SurvivorDecision = 'pending' | 'archived_solo' | 'left';

export interface Couple {
  id: string;

  // Partners
  partner1Id: string;
  partner2Id: string;

  // Couple profile
  coupleName?: string;
  coupleAvatarUrl?: string;
  anniversaryDate?: string;
  relationshipStatus: 'dating' | 'engaged' | 'married' | 'other' | 'ended';

  // Relationship lifecycle (set once a partner deletes their account)
  endedAt?: string | null;
  endedByUserId?: string | null;
  survivorDecision?: SurvivorDecision | null;
  survivorDecidedAt?: string | null;

  // Pairing
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  isPaired: boolean;

  // Stats
  messageCount: number;
  mediaCount: number;
  streakCurrent: number;
  streakLongest: number;
  daysTogetherCount: number;

  // Settings
  sharedThemeId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CoupleInvite {
  id: string;
  coupleId: string;
  inviterId: string;
  inviteCode: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
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

  // Reminders
  reminderDaysBefore: number[];
  reminderEnabled: boolean;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
