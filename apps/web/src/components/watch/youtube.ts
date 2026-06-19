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

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0] ?? '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

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
    // Not a valid URL.
  }

  const match = value.match(/[A-Za-z0-9_-]{11}/);
  return match ? match[0] : null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiPromise: Promise<any> | null = null;

/**
 * Load the YouTube IFrame Player API exactly once and resolve with the global
 * `YT` namespace when it is ready. Subsequent calls reuse the same promise.
 */
export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API requires a browser'));
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    // Chain onto any pre-existing handler so we don't clobber it.
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}
