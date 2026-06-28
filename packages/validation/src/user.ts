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

// Account deletion (the "Relationship Graveyard" offboarding). Destructive, so
// the client must explicitly confirm AND re-authenticate before the account is
// anonymized into a tombstone. Two re-auth paths:
//  - password accounts → re-enter the password (the API re-verifies it), OR
//  - OAuth-only accounts (e.g. Google sign-in, whose stored password is a random
//    value the user can never know) → supply a fresh `googleIdToken`, which the
//    API verifies and matches to the account's email.
// Exactly one credential is required; `password` defaults to '' so OAuth clients
// can omit it. The service enforces that at least one valid credential is given.
export const deleteAccountSchema = z
  .object({
    confirm: z.literal(true),
    password: z.string().default(''),
    googleIdToken: z.string().min(1).optional(),
  })
  .refine((v) => v.password.length > 0 || !!v.googleIdToken, {
    message: 'A password or Google sign-in is required to delete your account',
    path: ['password'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
