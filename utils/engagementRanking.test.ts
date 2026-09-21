import { NewsItem } from '@/types/news';

import { applyEngagementRanking } from './engagementRanking';

function makeItem(id: string, sourceName: string): NewsItem {
  return {
    id,
    title: `Story ${id}`,
    url: `https://example.com/${id}`,
    source: { name: sourceName, type: 'rss' },
    publishedAt: new Date('2024-01-01'),
  };
}

describe('applyEngagementRanking', () => {
  it('leaves order unchanged when no scores are tracked for any source', () => {
    const items = [makeItem('a', 'BBC'), makeItem('b', 'NPR'), makeItem('c', 'CBC')];
    expect(applyEngagementRanking(items, {}).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves order unchanged for a source scored exactly neutral (0.5)', () => {
    const items = [makeItem('a', 'BBC'), makeItem('b', 'NPR')];
    expect(applyEngagementRanking(items, { BBC: 0.5, NPR: 0.5 }).map(i => i.id)).toEqual(['a', 'b']);
  });

  it('moves a highly-engaged source up from its original position', () => {
    const items = [
      makeItem('a', 'CBC'), // untracked, position 0
      makeItem('b', 'CBC'), // untracked, position 1
      makeItem('c', 'CBC'), // untracked, position 2
      makeItem('d', 'CBC'), // untracked, position 3
      makeItem('e', 'BBC'), // fully engaged, position 4
    ];

    const result = applyEngagementRanking(items, { BBC: 1 });
    const newIndex = result.findIndex(i => i.id === 'e');

    expect(newIndex).toBeLessThan(4);
  });

  it('moves a consistently-dismissed source down from its original position', () => {
    const items = [
      makeItem('a', 'TechCrunch'), // consistently dismissed, position 0
      makeItem('b', 'CBC'),
      makeItem('c', 'CBC'),
      makeItem('d', 'CBC'),
      makeItem('e', 'CBC'),
    ];

    const result = applyEngagementRanking(items, { TechCrunch: 0 });
    const newIndex = result.findIndex(i => i.id === 'a');

    expect(newIndex).toBeGreaterThan(0);
  });

  it('does not move every item to the very top - the boost is bounded', () => {
    const items = Array.from({ length: 20 }, (_, i) => makeItem(String(i), 'CBC'));
    const boosted = makeItem('boosted', 'BBC');
    items.push(boosted);

    const result = applyEngagementRanking(items, { BBC: 1 });
    const boostedIndex = result.findIndex(i => i.id === 'boosted');

    // Started at index 20, a full-engagement boost of ~3 shouldn't reach index 0.
    expect(boostedIndex).toBeGreaterThan(0);
    expect(boostedIndex).toBeLessThan(20);
  });

  it('preserves the full item objects, not just ids', () => {
    const item = makeItem('a', 'BBC');
    const result = applyEngagementRanking([item], { BBC: 1 });
    expect(result[0]).toBe(item);
  });
});
