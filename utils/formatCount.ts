// Compact display for engagement numbers (upvotes, comment counts):
// 950 -> "950", 1500 -> "1.5k", 1000000 -> "1m". Trailing ".0" is dropped
// so a round number like 2000 reads as "2k", not "2.0k".
export function formatCount(count: number): string {
  if (count < 1000) {
    return `${count}`;
  }
  if (count < 1_000_000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
}
