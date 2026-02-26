import { z } from 'zod';

// ============================================
// Couple Validation Schemas
// ============================================

export const createCoupleSchema = z.object({
  coupleName: z.string().max(100, 'Couple name must be at most 100 characters').optional(),
  anniversaryDate: z.string().optional(),
  relationshipStatus: z.enum(['dating', 'engaged', 'married', 'other']).optional(),
});

export const updateCoupleSchema = z.object({
  coupleName: z.string().max(100, 'Couple name must be at most 100 characters').optional(),
  coupleAvatarUrl: z.string().url('Invalid avatar URL').optional(),
  anniversaryDate: z.string().optional(),
  relationshipStatus: z.enum(['dating', 'engaged', 'married', 'other']).optional(),
  sharedThemeId: z.string().optional(),
});

export const joinCoupleSchema = z.object({
  inviteCode: z
    .string()
    .min(1, 'Invite code is required')
    .max(20, 'Invalid invite code'),
});

export const createImportantDateSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
  date: z.string().min(1, 'Date is required'),
  type: z.enum(['anniversary', 'birthday', 'custom', 'first-date', 'engagement', 'wedding']),
  isRecurring: z.boolean().default(false),
  recurringType: z.enum(['yearly', 'monthly', 'weekly']).optional(),
  reminderDaysBefore: z.array(z.number().min(0).max(365)).default([1, 7]),
  reminderEnabled: z.boolean().default(true),
});

export type CreateCoupleInput = z.infer<typeof createCoupleSchema>;
export type UpdateCoupleInput = z.infer<typeof updateCoupleSchema>;
export type JoinCoupleInput = z.infer<typeof joinCoupleSchema>;
export type CreateImportantDateInput = z.infer<typeof createImportantDateSchema>;
