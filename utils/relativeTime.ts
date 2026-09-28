const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// A future or clock-skewed publishedAt falls into the same "< MINUTE" bucket
// as a genuinely fresh one, so it reads as "Just now" instead of negative
// minutes.
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < MINUTE) {
    return 'Just now';
  }
  if (diffMs < HOUR) {
    return `${Math.floor(diffMs / MINUTE)}m ago`;
  }
  if (diffMs < DAY) {
    return `${Math.floor(diffMs / HOUR)}h ago`;
  }
  if (diffMs < WEEK) {
    return `${Math.floor(diffMs / DAY)}d ago`;
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}
