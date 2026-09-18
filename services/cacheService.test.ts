import AsyncStorage from '@react-native-async-storage/async-storage';

import { CacheService } from './cacheService';
import { AIExplanation, NewsItem } from '@/types/news';

function makeItem(url: string): NewsItem {
  return {
    id: url,
    title: 'Test article',
    url,
    source: { name: 'Test', type: 'rss' },
    publishedAt: new Date(),
  };
}

function makeExplanation(): AIExplanation {
  return {
    summary: 'summary',
    why: 'why',
    impact: 'impact',
    credibility: 'credibility',
  };
}

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    cacheService = new CacheService();
  });

  it('returns null when nothing is cached', async () => {
    const result = await cacheService.getExplanation(makeItem('https://example.com/none'));
    expect(result).toBeNull();
  });

  it('round-trips a stored explanation', async () => {
    const item = makeItem('https://example.com/a');
    const explanation = makeExplanation();

    await cacheService.setExplanation(item, explanation);
    const result = await cacheService.getExplanation(item);

    expect(result).toEqual(explanation);
  });

  it('does not duplicate the index entry when the same item is cached twice', async () => {
    const item = makeItem('https://example.com/dup');

    await cacheService.setExplanation(item, makeExplanation());
    await cacheService.setExplanation(item, makeExplanation());

    const stats = await cacheService.getCacheStats();
    expect(stats.count).toBe(1);
  });

  it('expires entries older than the configured TTL', async () => {
    const item = makeItem('https://example.com/old');
    const realNow = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(realNow - 8 * 24 * 60 * 60 * 1000);
    await cacheService.setExplanation(item, makeExplanation());

    jest.spyOn(Date, 'now').mockReturnValue(realNow);
    const result = await cacheService.getExplanation(item);

    expect(result).toBeNull();
  });

  it('clearExpiredCache removes only expired entries', async () => {
    const freshItem = makeItem('https://example.com/fresh');
    const staleItem = makeItem('https://example.com/stale');
    const realNow = Date.now();

    await cacheService.setExplanation(freshItem, makeExplanation());

    jest.spyOn(Date, 'now').mockReturnValue(realNow - 8 * 24 * 60 * 60 * 1000);
    await cacheService.setExplanation(staleItem, makeExplanation());

    jest.spyOn(Date, 'now').mockReturnValue(realNow);
    await cacheService.clearExpiredCache();

    const stats = await cacheService.getCacheStats();
    expect(stats.count).toBe(1);
    expect(await cacheService.getExplanation(freshItem)).not.toBeNull();
  });

  it('clearAllCache removes every cached explanation', async () => {
    await cacheService.setExplanation(makeItem('https://example.com/one'), makeExplanation());
    await cacheService.setExplanation(makeItem('https://example.com/two'), makeExplanation());

    await cacheService.clearAllCache();

    const stats = await cacheService.getCacheStats();
    expect(stats.count).toBe(0);
  });
});
