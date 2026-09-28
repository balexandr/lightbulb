import { formatRelativeTime } from './relativeTime';

const NOW = new Date('2026-09-27T12:00:00Z');

describe('formatRelativeTime', () => {
  it('shows "Just now" for anything under a minute old', () => {
    expect(formatRelativeTime(new Date('2026-09-27T11:59:30Z'), NOW)).toBe('Just now');
  });

  it('shows "Just now" for a future/clock-skewed timestamp instead of a negative value', () => {
    expect(formatRelativeTime(new Date('2026-09-27T12:00:10Z'), NOW)).toBe('Just now');
  });

  it('shows minutes ago under an hour', () => {
    expect(formatRelativeTime(new Date('2026-09-27T11:45:00Z'), NOW)).toBe('15m ago');
  });

  it('shows hours ago under a day', () => {
    expect(formatRelativeTime(new Date('2026-09-27T09:00:00Z'), NOW)).toBe('3h ago');
  });

  it('shows days ago under a week', () => {
    expect(formatRelativeTime(new Date('2026-09-25T12:00:00Z'), NOW)).toBe('2d ago');
  });

  it('falls back to a month/day date a week or more out, same year', () => {
    expect(formatRelativeTime(new Date('2026-09-01T12:00:00Z'), NOW)).toBe('Sep 1');
  });

  it('includes the year when the date is from a previous year', () => {
    expect(formatRelativeTime(new Date('2025-09-01T12:00:00Z'), NOW)).toBe('Sep 1, 2025');
  });
});
