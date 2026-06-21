/**
 * Source-resolution helpers shared by the Watch Party feature. Mirrors the web
 * `resolveWatchSource` logic so a pasted value resolves to the SAME media on
 * both platforms. (The browser-only IFrame-API loader lives only on the web —
 * RN uses react-native-youtube-iframe instead.)
 */

/**
 * Extract an 11-character YouTube video id from a URL or a raw id.
 * Handles:
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/watch?v=ID
 *   - https://www.youtube.com/embed/ID
 *   - a bare 11-char id
 * Returns null if no id can be found.
 *
 * RN has no global `URL` constructor in every runtime, so we parse with
 * regular expressions rather than `new URL()`.
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const value = input.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  // youtu.be/ID
  const shortMatch = value.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch?.[1]) return shortMatch[1];

  // youtube.com/watch?v=ID  (or &v=)
  const vMatch = value.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (vMatch?.[1]) return vMatch[1];

  // youtube.com/embed/ID , /shorts/ID , /v/ID
  const pathMatch = value.match(
    /youtube\.com\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/,
  );
  if (pathMatch?.[1]) return pathMatch[1];

  const match = value.match(/[A-Za-z0-9_-]{11}/);
  return match ? match[0] : null;
}

export type WatchSourceKind = 'youtube' | 'url';

export interface ResolvedWatchMedia {
  source: WatchSourceKind;
  /** Set for YouTube. */
  videoId: string | null;
  /** Set for a direct media link. */
  videoUrl: string | null;
}

/**
 * Decide whether a pasted value is a YouTube video or a direct media link.
 * - A bare 11-char id or any youtube.com / youtu.be URL → YouTube.
 * - Any other valid http(s) URL → a direct video link (mp4/webm/… played in a
 *   native player). We trust the user's "direct link" rather than sniffing the
 *   extension, so CDN URLs with query strings work too.
 * Returns null when the value is neither.
 */
export function resolveWatchSource(input: string): ResolvedWatchMedia | null {
  if (!input) return null;
  const value = input.trim();

  // Bare YouTube id.
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return { source: 'youtube', videoId: value, videoUrl: null };
  }

  // Must be an http(s) URL.
  const httpMatch = value.match(/^https?:\/\/([^/?#]+)/i);
  if (!httpMatch?.[1]) return null;

  const host = httpMatch[1].replace(/^www\./, '').toLowerCase();
  const isYouTube =
    host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com';
  if (isYouTube) {
    const id = extractYouTubeId(value);
    return id ? { source: 'youtube', videoId: id, videoUrl: null } : null;
  }

  // Any other http(s) URL → treat as a direct media link.
  return { source: 'url', videoId: null, videoUrl: value };
}
