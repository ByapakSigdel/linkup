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
const HOST = process.env.EXPO_PUBLIC_API_HOST;
const PORT = process.env.EXPO_PUBLIC_API_PORT || '4000';

/** Deployed backend (Cloudflare HTTPS) — the default unless an env override is set. */
const DEFAULT_ORIGIN = 'https://linkup.mahansigdel.com.np';

/**
 * Base origin. Priority:
 *   1. EXPO_PUBLIC_API_URL  — explicit full origin
 *   2. EXPO_PUBLIC_API_HOST — LAN dev over HTTP (http://HOST:PORT)
 *   3. the deployed server  — production default
 * e.g. https://linkup.mahansigdel.com.np or http://192.168.1.50:4000
 */
export const API_ORIGIN = (
  EXPLICIT_URL || (HOST ? `http://${HOST}:${PORT}` : DEFAULT_ORIGIN)
).replace(/\/+$/, '');

/** REST base, e.g. http://192.168.100.93:4000/api/v1 */
export const API_URL = `${API_ORIGIN}/api/v1`;

/** Socket.IO endpoint (same origin as REST). */
export const SOCKET_URL = API_ORIGIN;

/** Persisted-store key used by the auth store (read by the axios interceptor). */
export const AUTH_STORAGE_KEY = 'auth-storage';

/**
 * Google OAuth Web client ID. Native Google Sign-In uses this as `webClientId`
 * so the returned ID token's audience is the web client — which the backend
 * (/auth/google) accepts. Public value (also embedded in the web bundle).
 */
export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '522265029111-9n0a26dkeovi6fh3e9l4q2745pe14a4b.apps.googleusercontent.com';

/**
 * In-app updates. APP_BUILD is this binary's build number — bump it on every
 * release. The app fetches UPDATE_MANIFEST_URL (a JSON with { build, version,
 * url, notes }) and, if the server's build is higher, offers to download the new
 * APK. Lets sideloaded users update from within the app instead of re-installing.
 */
export const APP_BUILD = 8;
export const UPDATE_MANIFEST_URL = `${API_ORIGIN}/downloads/latest.json`;

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
