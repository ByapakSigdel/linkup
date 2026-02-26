import { z } from 'zod';

// ============================================
// User Validation Schemas
// ============================================

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).optional(),
  phone: z.string().optional(),
});

export const updateSettingsSchema = z.object({
  themeId: z.string().optional(),

  // Notifications
  pushNotifications: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
  callNotifications: z.boolean().optional(),
  streakReminders: z.boolean().optional(),
  anniversaryReminders: z.boolean().optional(),

  // Privacy
  showOnlineStatus: z.boolean().optional(),
  showReadReceipts: z.boolean().optional(),
  showTypingIndicator: z.boolean().optional(),

  // Media
  autoDownloadMedia: z.boolean().optional(),
  mediaQuality: z.enum(['low', 'medium', 'high', 'original']).optional(),

  // Accessibility
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  reduceMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
