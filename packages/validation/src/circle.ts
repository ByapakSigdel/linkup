import { z } from 'zod';

// ============================================
// Circle Validation Schemas
// ============================================
// "Instagram for couples": one opt-in profile per couple, one-way follows
// (public auto-accept, private = pending request), photo posts + 24h stories.

/** Handles are lowercase [a-z0-9_], 3-30 chars; these collide with subroutes. */
export const RESERVED_HANDLES = [
  'me',
  'feed',
  'discover',
  'requests',
  'stories',
] as const;

export const handleSchema = z
  .string()
  .min(3, 'Handle must be at least 3 characters')
  .max(30, 'Handle must be at most 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Handle may only contain lowercase letters, numbers and underscores')
  .refine(
    (h) => !RESERVED_HANDLES.includes(h as (typeof RESERVED_HANDLES)[number]),
    'That handle is reserved',
  );

export const createCircleSchema = z.object({
  handle: handleSchema,
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  isPrivate: z.boolean().optional(),
});

export const updateCircleSchema = z
  .object({
    handle: handleSchema.optional(),
    name: z.string().min(1).max(100).optional(),
    bio: z.string().max(1000).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    isPrivate: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'No fields to update');

export const createCirclePostSchema = z.object({
  caption: z.string().max(2000).optional(),
  mediaUrls: z.array(z.string().url()).min(1, 'At least one media item is required').max(10),
  type: z.enum(['photo', 'video', 'carousel']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000),
});

export const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']).optional(),
  caption: z.string().max(500).optional(),
  durationMs: z.number().int().min(1000).max(60000).optional(),
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;
export type UpdateCircleInput = z.infer<typeof updateCircleSchema>;
export type CreateCirclePostInput = z.infer<typeof createCirclePostSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type CreateStoryInput = z.infer<typeof createStorySchema>;
