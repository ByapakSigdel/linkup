import { nanoid } from 'nanoid';

// ============================================
// ID Generation Utilities
// ============================================

/**
 * Generate a unique ID using nanoid
 */
export function generateId(size: number = 21): string {
  return nanoid(size);
}

/**
 * Generate a short invite code (8 characters, uppercase alphanumeric)
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
