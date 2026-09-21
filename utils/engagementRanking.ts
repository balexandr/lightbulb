import { NewsItem } from '@/types/news';

// §18.2 "cheap MVP": lightly re-rank the already-sorted feed using this
// device's own engagement history - a small, bounded nudge, not a
// re-sort. A source the reader tends to fully read moves up a few
// places; one they tend to dismiss quickly moves down a few. Sources
// with no tracked score (not enough samples yet, see engagementService)
// are left exactly where they were.

const NEUTRAL_SCORE = 0.5;
// (score - 0.5) ranges -0.5..+0.5 for a valid ratio, so this bounds the
// position shift to roughly -3..+3 without an explicit clamp.
const BOOST_STRENGTH = 6;

export function applyEngagementRanking(items: NewsItem[], scores: Record<string, number>): NewsItem[] {
  return items
    .map((item, index) => {
      const score = scores[item.source.name] ?? NEUTRAL_SCORE;
      const boost = (score - NEUTRAL_SCORE) * BOOST_STRENGTH;
      return { item, sortKey: index - boost };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(entry => entry.item);
}
