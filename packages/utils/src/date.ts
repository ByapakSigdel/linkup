// ============================================
// Date Utilities
// ============================================

/**
 * Format a date string into a relative time description
 * e.g. "2 minutes ago", "3 hours ago", "Yesterday"
 */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (seconds < 172800) return 'Yesterday';
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} days ago`;
  }

  return formatDate(dateStr);
}

/**
 * Format a date string as "Mon DD, YYYY"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date as time only "HH:MM AM/PM"
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a date string for chat messages.
 * Today: "2:30 PM", Yesterday: "Yesterday", older: "Mon DD"
 */
export function formatChatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return formatTime(dateStr);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Calculate the number of days between two dates
 */
export function daysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
}

/**
 * Calculate days together for a couple
 */
export function daysTogether(startDateStr: string): number {
  return daysBetween(startDateStr, new Date().toISOString());
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/**
 * Get the next occurrence of a recurring date (anniversary, birthday, etc.)
 */
export function getNextOccurrence(dateStr: string): Date {
  const date = new Date(dateStr);
  const now = new Date();
  const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
  if (next <= now) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

/**
 * Days until next occurrence of a recurring date
 */
export function daysUntil(dateStr: string): number {
  const next = getNextOccurrence(dateStr);
  const now = new Date();
  return Math.ceil((next.getTime() - now.getTime()) / 86400000);
}
