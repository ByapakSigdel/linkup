/**
 * Extract an 11-character YouTube video id from a URL or a raw id.
 * Handles:
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/watch?v=ID
 *   - https://www.youtube.com/embed/ID
 *   - a bare 11-char id
 * Returns null if no id can be found.
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const value = input.trim();

  // Bare 11-char id (YouTube ids are [A-Za-z0-9_-]{11}).
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');

    // youtu.be/ID
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0] ?? '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    // youtube.com/watch?v=ID
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

      // youtube.com/embed/ID or youtube.com/shorts/ID or /v/ID
      const parts = url.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v')
      ) {
        const id = parts[1] ?? '';
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    // Not a valid URL — fall through.
  }

  // Last resort: pull the first 11-char id-looking token from the string.
  const match = value.match(/[A-Za-z0-9_-]{11}/);
  return match ? match[0] : null;
}

/** Build the canonical watch URL for a YouTube id. */
export function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
