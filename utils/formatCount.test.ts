import { formatCount } from './formatCount';

describe('formatCount', () => {
  it('shows small numbers as-is', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(0)).toBe('0');
  });

  it('abbreviates thousands with one decimal', () => {
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(12_345)).toBe('12.3k');
  });

  it('drops a trailing .0 on a round thousand', () => {
    expect(formatCount(2000)).toBe('2k');
  });

  it('abbreviates millions', () => {
    expect(formatCount(1_500_000)).toBe('1.5m');
  });

  it('drops a trailing .0 on a round million', () => {
    expect(formatCount(3_000_000)).toBe('3m');
  });
});
