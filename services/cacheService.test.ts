import AsyncStorage from '@react-native-async-storage/async-storage';

import { CacheService } from './cacheService';
import { PreferenceBucket } from '@/services/preferencesService';
import { FactLayer, NewsItem, RelevanceLayer } from '@/types/news';

function makeItem(url: string): NewsItem {
  return {
    id: url,
    title: 'Test article',
    url,
    source: { name: 'Test', type: 'rss' },
    publishedAt: new Date(),
  };
}

function makeBucket(overrides: Partial<PreferenceBucket> = {}): PreferenceBucket {
  return { age: 'unspecified', stance: 'unspecified', region: 'unspecified', ...overrides };
}

function makeFact(): FactLayer {
  return { summary: 'summary', credibility: 'credibility' };
}

function makeRelevance(): RelevanceLayer {
  return { why: 'why', impact: 'impact' };
}

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    cacheService = new CacheService();
  });

  describe('fact layer', () => {
    it('returns null when nothing is cached', async () => {
      expect(await cacheService.getFact(makeItem('https://example.com/none'))).toBeNull();
    });

    it('round-trips a stored fact, shared across every bucket', async () => {
      const item = makeItem('https://example.com/a');
      const fact = makeFact();

      await cacheService.setFact(item, fact);

      expect(await cacheService.getFact(item)).toEqual(fact);
    });

    it('expires entries older than the configured TTL', async () => {
      const item = makeItem('https://example.com/old');
      const realNow = Date.now();

      jest.spyOn(Date, 'now').mockReturnValue(realNow - 8 * 24 * 60 * 60 * 1000);
      await cacheService.setFact(item, makeFact());

      jest.spyOn(Date, 'now').mockReturnValue(realNow);
      expect(await cacheService.getFact(item)).toBeNull();
    });
  });

  describe('relevance layer', () => {
    it('returns null when nothing is cached for that bucket', async () => {
      const item = makeItem('https://example.com/none');
      expect(await cacheService.getRelevance(item, makeBucket())).toBeNull();
    });

    it('round-trips a stored relevance layer for a given bucket', async () => {
      const item = makeItem('https://example.com/a');
      const bucket = makeBucket({ stance: 'progressive' });
      const relevance = makeRelevance();

      await cacheService.setRelevance(item, bucket, relevance);

      expect(await cacheService.getRelevance(item, bucket)).toEqual(relevance);
    });

    it('keeps different buckets independent for the same article', async () => {
      const item = makeItem('https://example.com/a');
      const left = makeBucket({ stance: 'progressive' });
      const right = makeBucket({ stance: 'conservative' });

      await cacheService.setRelevance(item, left, { why: 'left why', impact: 'left impact' });

      expect(await cacheService.getRelevance(item, left)).toEqual({ why: 'left why', impact: 'left impact' });
      expect(await cacheService.getRelevance(item, right)).toBeNull();
    });

    it('expires entries older than the configured TTL', async () => {
      const item = makeItem('https://example.com/old');
      const bucket = makeBucket();
      const realNow = Date.now();

      jest.spyOn(Date, 'now').mockReturnValue(realNow - 8 * 24 * 60 * 60 * 1000);
      await cacheService.setRelevance(item, bucket, makeRelevance());

      jest.spyOn(Date, 'now').mockReturnValue(realNow);
      expect(await cacheService.getRelevance(item, bucket)).toBeNull();
    });
  });

  describe('getExplanation', () => {
    it('returns nulls for both layers on a full miss', async () => {
      const item = makeItem('https://example.com/none');
      expect(await cacheService.getExplanation(item, makeBucket())).toEqual({ fact: null, relevance: null });
    });

    it('returns a partial hit when only the fact layer is cached', async () => {
      const item = makeItem('https://example.com/a');
      const fact = makeFact();
      await cacheService.setFact(item, fact);

      expect(await cacheService.getExplanation(item, makeBucket())).toEqual({ fact, relevance: null });
    });

    it('returns both layers once both are cached', async () => {
      const item = makeItem('https://example.com/a');
      const bucket = makeBucket();
      const fact = makeFact();
      const relevance = makeRelevance();

      await cacheService.setFact(item, fact);
      await cacheService.setRelevance(item, bucket, relevance);

      expect(await cacheService.getExplanation(item, bucket)).toEqual({ fact, relevance });
    });
  });

  it('does not duplicate the index entry when the same fact is cached twice', async () => {
    const item = makeItem('https://example.com/dup');

    await cacheService.setFact(item, makeFact());
    await cacheService.setFact(item, makeFact());

    const stats = await cacheService.getCacheStats();
    expect(stats.count).toBe(1);
  });

  it('clearExpiredCache removes only expired entries, across both fact and relevance', async () => {
    const freshItem = makeItem('https://example.com/fresh');
    const staleItem = makeItem('https://example.com/stale');
    const bucket = makeBucket();
    const realNow = Date.now();

    await cacheService.setFact(freshItem, makeFact());
    await cacheService.setRelevance(freshItem, bucket, makeRelevance());

    jest.spyOn(Date, 'now').mockReturnValue(realNow - 8 * 24 * 60 * 60 * 1000);
    await cacheService.setFact(staleItem, makeFact());
    await cacheService.setRelevance(staleItem, bucket, makeRelevance());

    jest.spyOn(Date, 'now').mockReturnValue(realNow);
    await cacheService.clearExpiredCache();

    const stats = await cacheService.getCacheStats();
    expect(stats.count).toBe(2); // freshItem's fact + relevance keys
    expect(await cacheService.getExplanation(freshItem, bucket)).toEqual({
      fact: makeFact(),
      relevance: makeRelevance(),
    });
  });

  it('clearAllCache removes every cached fact and relevance entry', async () => {
    const bucket = makeBucket();
    await cacheService.setFact(makeItem('https://example.com/one'), makeFact());
    await cacheService.setRelevance(makeItem('https://example.com/one'), bucket, makeRelevance());
    await cacheService.setFact(makeItem('https://example.com/two'), makeFact());

    await cacheService.clearAllCache();

    const stats = await cacheService.getCacheStats();
    expect(stats.count).toBe(0);
  });
});
