import { z } from 'zod';

// ============================================
// Message Validation Schemas
// ============================================

export const sendMessageSchema = z.object({
  content: z.string().max(10000, 'Message is too long'),
  messageType: z
    .enum(['text', 'photo', 'video', 'voice', 'file', 'location', 'scribble', 'poll', 'system'])
    .default('text'),
  mediaUrls: z.array(z.string().url()).optional(),
  threadId: z.string().optional(),
  isThreadStarter: z.boolean().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000, 'Message is too long'),
});

export const highlightMessageSchema = z.object({
  category: z.enum(['love', 'funny', 'important', 'celebration', 'milestone', 'custom']),
  color: z.string().optional(),
  note: z.string().max(500).optional(),
  emoji: z.string().optional(),
  isSharedWithPartner: z.boolean().default(true),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required'),
});

export const createThreadSchema = z.object({
  title: z.string().max(200, 'Thread title is too long').optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type HighlightMessageInput = z.infer<typeof highlightMessageSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type CreateThreadInput = z.infer<typeof createThreadSchema>;
