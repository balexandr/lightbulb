import { deduplicatePosts, filterPosts, sortPosts } from './newsService';
import { NewsItem } from '@/types/news';

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: overrides.id ?? 'id-1',
    title: 'A headline',
    url: 'https://example.com/a',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('deduplicatePosts', () => {
  it('keeps a single post when there are no duplicate URLs', () => {
    const posts = [makeItem({ id: 'a', url: 'https://example.com/a' })];
    expect(deduplicatePosts(posts)).toHaveLength(1);
  });

  it('prefers RSS over reddit for the same URL, regardless of order', () => {
    const rss = makeItem({ id: 'rss', url: 'https://example.com/story', source: { name: 'BBC', type: 'rss' } });
    const reddit = makeItem({ id: 'reddit', url: 'https://example.com/story', source: { name: 'r/worldnews', type: 'reddit' } });

    expect(deduplicatePosts([reddit, rss]).map(p => p.id)).toEqual(['rss']);
    expect(deduplicatePosts([rss, reddit]).map(p => p.id)).toEqual(['rss']);
  });

  it('keeps the higher-scoring post when both duplicates are from reddit', () => {
    const low = makeItem({ id: 'low', url: 'https://example.com/story', source: { name: 'r/worldnews', type: 'reddit' }, score: 5 });
    const high = makeItem({ id: 'high', url: 'https://example.com/story', source: { name: 'r/technology', type: 'reddit' }, score: 50 });

    expect(deduplicatePosts([low, high]).map(p => p.id)).toEqual(['high']);
    expect(deduplicatePosts([high, low]).map(p => p.id)).toEqual(['high']);
  });
});

describe('filterPosts', () => {
  it('always keeps RSS posts regardless of filter config', () => {
    const rss = makeItem({ source: { name: 'BBC', type: 'rss' }, url: 'not-a-url', score: 0 });
    expect(filterPosts([rss])).toEqual([rss]);
  });

  it('drops reddit posts whose link is not external', () => {
    const post = makeItem({ source: { name: 'r/worldnews', type: 'reddit' }, url: '/r/worldnews/comments/xyz', score: 100 });
    expect(filterPosts([post], { requireExternalLink: true })).toEqual([]);
  });

  it('drops reddit posts from untrusted domains when requireNewsDomain is set', () => {
    const post = makeItem({
      source: { name: 'r/worldnews', type: 'reddit' },
      url: 'https://example.com/story',
      domain: 'randomblog.com',
      score: 100,
    });
    expect(filterPosts([post], { requireExternalLink: true, requireNewsDomain: true })).toEqual([]);
  });

  it('drops reddit posts below the minimum score threshold', () => {
    const post = makeItem({ source: { name: 'r/worldnews', type: 'reddit' }, url: 'https://reuters.com/story', domain: 'reuters.com', score: 1 });
    expect(filterPosts([post], { minScore: 10 })).toEqual([]);
  });

  it('keeps reddit posts that satisfy every configured rule', () => {
    const post = makeItem({ source: { name: 'r/worldnews', type: 'reddit' }, url: 'https://reuters.com/story', domain: 'reuters.com', score: 50 });
    expect(filterPosts([post], { requireExternalLink: true, requireNewsDomain: true, minScore: 10 })).toEqual([post]);
  });
});

describe('sortPosts', () => {
  it('sorts by publish date, newest first', () => {
    const older = makeItem({ id: 'older', publishedAt: new Date('2024-01-01') });
    const newer = makeItem({ id: 'newer', publishedAt: new Date('2024-06-01') });

    expect(sortPosts([older, newer]).map(p => p.id)).toEqual(['newer', 'older']);
  });

  it('deprioritizes one-liner titles (under 100 chars) when configured', () => {
    const longTitle = 'A'.repeat(120);
    const oneLiner = makeItem({ id: 'short', title: 'Short', publishedAt: new Date('2024-06-01') });
    const longForm = makeItem({ id: 'long', title: longTitle, publishedAt: new Date('2024-01-01') });

    const sorted = sortPosts([oneLiner, longForm], { deprioritizeOneLiners: true });
    expect(sorted.map(p => p.id)).toEqual(['long', 'short']);
  });
});
