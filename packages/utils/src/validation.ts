// ============================================
// Validation Helpers (runtime, non-Zod)
// ============================================

/**
 * Check if a string is a valid email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color);
}

/**
 * Check if a file type is an allowed image type
 */
export function isImageMimeType(mimeType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(
    mimeType,
  );
}

/**
 * Check if a file type is an allowed video type
 */
export function isVideoMimeType(mimeType: string): boolean {
  return ['video/mp4', 'video/webm', 'video/quicktime'].includes(mimeType);
}

/**
 * Check if a file type is an allowed audio type
 */
export function isAudioMimeType(mimeType: string): boolean {
  return ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'].includes(mimeType);
}

// Constants
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_BIO_LENGTH = 500;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_USERNAME_LENGTH = 30;
export const MIN_PASSWORD_LENGTH = 8;
