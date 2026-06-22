/**
 * Backend connection config.
 *
 * The mobile app talks to the SAME backend as the web app (NestJS API +
 * Socket.IO gateway). Configure the target at build time:
 *   - Production server (domain + HTTPS):  EXPO_PUBLIC_API_URL=https://api.yourdomain.com
 *   - Production/LAN over HTTP by IP:       EXPO_PUBLIC_API_HOST=1.2.3.4 (+ optional EXPO_PUBLIC_API_PORT)
 * EXPO_PUBLIC_API_URL (a full origin) wins when set; otherwise we build
 * http://HOST:PORT, defaulting to the dev machine's LAN IP.
 */
const EXPLICIT_URL = process.env.EXPO_PUBLIC_API_URL;
const HOST = process.env.EXPO_PUBLIC_API_HOST || '192.168.100.93';
const PORT = process.env.EXPO_PUBLIC_API_PORT || '4000';

/** Base origin, e.g. https://api.yourdomain.com or http://192.168.100.93:4000 */
export const API_ORIGIN = (EXPLICIT_URL || `http://${HOST}:${PORT}`).replace(/\/+$/, '');

/** REST base, e.g. http://192.168.100.93:4000/api/v1 */
export const API_URL = `${API_ORIGIN}/api/v1`;

/** Socket.IO endpoint (same origin as REST). */
export const SOCKET_URL = API_ORIGIN;

/** Persisted-store key used by the auth store (read by the axios interceptor). */
export const AUTH_STORAGE_KEY = 'auth-storage';

/**
 * Resolve a possibly-relative media path returned by the API into an absolute
 * URL the device can load. The API returns paths like `/media/files/abc.png`.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url}`;
}
