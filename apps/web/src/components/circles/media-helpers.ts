// Shared media helpers for the web Circles components. Mirrors the mobile
// pickVariantUrl in mobile/src/components/circles/post-media.tsx (§1.1 image
// pipeline): grid + story avatars request the `thumb` variant, the feed requests
// `medium`, and the lightbox requests the full `original`. Old posts have no
// variant map, so every path falls back to the plain URL.

import type { MediaVariants } from './types';

/** Which size variant to request from the image pipeline. */
export type MediaSize = 'thumb' | 'medium' | 'full';

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

/**
 * Pick the best variant URL from a variants map.
 * Falls back to the base url so old posts (no variants) still render.
 */
export function pickVariantUrl(
  url: string,
  variants: MediaVariants | undefined,
  size: MediaSize,
): string {
  if (!variants) return url;
  if (size === 'thumb') return variants.thumb ?? variants.original ?? url;
  if (size === 'medium') return variants.medium ?? variants.original ?? url;
  // 'full' — prefer original, fall back to the raw url
  return variants.original ?? url;
}
