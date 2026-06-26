// Small shared helpers for the web Circles DM screens (inbox + thread). Mirrors
// the mobile timeAgo/errMessage so both platforms format identically.

/** Pull a server error message out of an axios error, with a fallback. */
export function errMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message || fallback
  );
}

/** Compact relative time ("now", "5m", "3h", "2d", or a date) for inbox rows. */
export function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  try {
    const d = new Date(then);
    const now = new Date();
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return '';
  }
}

/** Clock time ("3:42 PM") for message bubbles. */
export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Friendly day label ("Today" / "Yesterday" / weekday / date) for separators. */
export function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
