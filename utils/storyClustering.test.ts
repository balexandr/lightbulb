import { NewsItem } from '@/types/news';

import { buildRelatedArticlesIndex, groupRelatedArticles, titleSimilarity } from './storyClustering';

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: overrides.id ?? 'id-1',
    title: 'A headline',
    url: 'https://example.com/a',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-06-01T12:00:00Z'),
    ...overrides,
  };
}

describe('titleSimilarity', () => {
  it('returns 1 for identical titles', () => {
    expect(titleSimilarity('Senate passes new climate bill', 'Senate passes new climate bill')).toBe(1);
  });

  it('returns 0 for titles sharing no significant words', () => {
    expect(titleSimilarity('Senate passes climate bill', 'Local bakery wins award')).toBe(0);
  });

  it('ignores stopwords and short words when comparing', () => {
    // Shares only stopwords/short words ("the", "for", "a", "on") - no real overlap.
    expect(titleSimilarity('The vote is for a new law', 'A ban is on the old rule')).toBe(0);
  });

  it('scores partial overlap between 0 and 1', () => {
    const score = titleSimilarity(
      'Senate passes sweeping climate legislation after months of debate',
      'House approves climate legislation following lengthy negotiations'
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

describe('groupRelatedArticles', () => {
  it('clusters articles from different sources covering the same story', () => {
    const bbc = makeItem({ id: 'bbc', title: 'Senate passes sweeping climate legislation', source: { name: 'BBC', type: 'rss' } });
    const npr = makeItem({ id: 'npr', title: 'Senate passes sweeping climate legislation bill', source: { name: 'NPR', type: 'rss' } });

    const clusters = groupRelatedArticles([bbc, npr]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].map(item => item.id).sort()).toEqual(['bbc', 'npr']);
  });

  it('does not cluster unrelated headlines', () => {
    const bbc = makeItem({ id: 'bbc', title: 'Senate passes sweeping climate legislation', source: { name: 'BBC', type: 'rss' } });
    const npr = makeItem({ id: 'npr', title: 'Local bakery wins national award', source: { name: 'NPR', type: 'rss' } });

    expect(groupRelatedArticles([bbc, npr])).toEqual([]);
  });

  it('does not cluster two articles from the same source, even with similar titles', () => {
    const first = makeItem({ id: 'a', title: 'Senate passes sweeping climate legislation', source: { name: 'BBC', type: 'rss' } });
    const second = makeItem({ id: 'b', title: 'Senate passes sweeping climate legislation bill', source: { name: 'BBC', type: 'rss' } });

    expect(groupRelatedArticles([first, second])).toEqual([]);
  });

  it('does not cluster similar headlines published far apart in time', () => {
    const bbc = makeItem({
      id: 'bbc',
      title: 'Senate passes sweeping climate legislation',
      source: { name: 'BBC', type: 'rss' },
      publishedAt: new Date('2024-01-01T00:00:00Z'),
    });
    const npr = makeItem({
      id: 'npr',
      title: 'Senate passes sweeping climate legislation bill',
      source: { name: 'NPR', type: 'rss' },
      publishedAt: new Date('2024-06-01T00:00:00Z'),
    });

    expect(groupRelatedArticles([bbc, npr])).toEqual([]);
  });

  it('groups three or more sources covering the same story into one cluster', () => {
    const bbc = makeItem({ id: 'bbc', title: 'Senate passes sweeping climate legislation', source: { name: 'BBC', type: 'rss' } });
    const npr = makeItem({ id: 'npr', title: 'Senate passes sweeping climate legislation bill', source: { name: 'NPR', type: 'rss' } });
    const guardian = makeItem({ id: 'guardian', title: 'Senate approves sweeping climate legislation', source: { name: 'The Guardian', type: 'rss' } });

    const clusters = groupRelatedArticles([bbc, npr, guardian]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });
});

describe('buildRelatedArticlesIndex', () => {
  it('maps each clustered item to the other items in its cluster, excluding itself', () => {
    const bbc = makeItem({ id: 'bbc', title: 'Senate passes sweeping climate legislation', source: { name: 'BBC', type: 'rss' } });
    const npr = makeItem({ id: 'npr', title: 'Senate passes sweeping climate legislation bill', source: { name: 'NPR', type: 'rss' } });
    const unrelated = makeItem({ id: 'other', title: 'Local bakery wins national award', source: { name: 'CBC', type: 'rss' } });

    const index = buildRelatedArticlesIndex([bbc, npr, unrelated]);

    expect(index.get('bbc')?.map(item => item.id)).toEqual(['npr']);
    expect(index.get('npr')?.map(item => item.id)).toEqual(['bbc']);
    expect(index.has('other')).toBe(false);
  });
});
