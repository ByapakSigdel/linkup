// Small shared helpers for the Circles components.

import * as ImagePicker from 'expo-image-picker';
import type { UploadFile } from '@/lib/circles-api';

/** Relative-time formatter (mirrors @linkup/utils timeAgo). */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

/** Compact follower/like counts: 1.2K, 3M. */
export function formatCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;
export function isHandleValid(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

/** Live-normalize toward the server rule: lowercase, only a-z0-9_, max 30. */
export function sanitizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

/** Pull a server error message out of an axios error, with a fallback. */
export function errMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
      ?.response?.data?.error?.message ||
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    fallback
  );
}

/** Map an expo-image-picker asset to the upload descriptor the API expects. */
export function assetToUploadFile(
  asset: ImagePicker.ImagePickerAsset,
): UploadFile {
  const uri = asset.uri;
  const name =
    asset.fileName ?? uri.split('/').pop() ?? `upload-${Date.now()}.jpg`;
  const type =
    asset.mimeType ??
    (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  return { uri, name, type };
}
