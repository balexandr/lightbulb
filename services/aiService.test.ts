import { AIExplanation, FactLayer, NewsItem, RelevanceLayer } from '@/types/news';

import { aiService } from './aiService';
import { cacheService } from './cacheService';
import { PreferenceBucket, preferencesService } from './preferencesService';

jest.mock('./cacheService', () => ({
  cacheService: {
    getExplanation: jest.fn(),
    setFact: jest.fn(),
    setRelevance: jest.fn(),
  },
}));

jest.mock('./preferencesService', () => ({
  preferencesService: {
    getPreferences: jest.fn(),
    getPreferenceBucket: jest.fn(),
  },
}));

const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;
const mockPreferencesService = preferencesService as jest.Mocked<typeof preferencesService>;

const unspecifiedBucket: PreferenceBucket = { age: 'unspecified', stance: 'unspecified', region: 'unspecified' };

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'id-1',
    title: 'Something happened',
    url: 'https://example.com/story',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-01-01'),
    domain: 'example.com',
    ...overrides,
  };
}

const fact: FactLayer = { summary: 'summary', credibility: 'credibility' };
const relevance: RelevanceLayer = { why: 'why', impact: 'impact' };
const explanation: AIExplanation = { ...fact, ...relevance };

describe('AIService.explainNews', () => {
  beforeEach(() => {
    mockPreferencesService.getPreferences.mockResolvedValue({});
    mockPreferencesService.getPreferenceBucket.mockReturnValue(unspecifiedBucket);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the cached explanation without calling fetch when both layers are cached', async () => {
    mockCacheService.getExplanation.mockResolvedValue({ fact, relevance });

    const result = await aiService.explainNews(makeItem());

    expect(result).toEqual(explanation);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requests both layers on a full cache miss, and caches both independently', async () => {
    mockCacheService.getExplanation.mockResolvedValue({ fact: null, relevance: null });
    mockPreferencesService.getPreferenceBucket.mockReturnValue({ ...unspecifiedBucket, stance: 'moderate' as any });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ fact, relevance }),
    });

    const item = makeItem();
    const result = await aiService.explainNews(item);

    expect(result).toEqual(explanation);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/illuminate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: { title: item.title, domain: item.domain, source: { name: item.source.name } },
          bucket: { ...unspecifiedBucket, stance: 'moderate' },
          needFact: true,
          needRelevance: true,
          factSummary: undefined,
        }),
      })
    );
    expect(mockCacheService.setFact).toHaveBeenCalledWith(item, fact);
    expect(mockCacheService.setRelevance).toHaveBeenCalledWith(item, { ...unspecifiedBucket, stance: 'moderate' }, relevance);
  });

  it('requests only the missing layer on a partial cache hit', async () => {
    mockCacheService.getExplanation.mockResolvedValue({ fact, relevance: null });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ relevance }),
    });

    const item = makeItem();
    const result = await aiService.explainNews(item);

    expect(result).toEqual(explanation);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/illuminate',
      expect.objectContaining({
        body: JSON.stringify({
          item: { title: item.title, domain: item.domain, source: { name: item.source.name } },
          bucket: unspecifiedBucket,
          needFact: false,
          needRelevance: true,
          factSummary: fact.summary,
        }),
      })
    );
    // The already-cached fact layer isn't re-cached - only what came back fresh.
    expect(mockCacheService.setFact).not.toHaveBeenCalled();
    expect(mockCacheService.setRelevance).toHaveBeenCalledWith(item, unspecifiedBucket, relevance);
  });

  it('falls back to a mock explanation when the request fails', async () => {
    mockCacheService.getExplanation.mockResolvedValue({ fact: null, relevance: null });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'AI explanations are not configured on this server.' }),
    });

    const item = makeItem();
    const result = await aiService.explainNews(item);

    expect(result.summary).toContain(item.title);
    expect(mockCacheService.setFact).toHaveBeenCalledWith(item, { summary: result.summary, credibility: result.credibility });
    expect(mockCacheService.setRelevance).toHaveBeenCalledWith(item, unspecifiedBucket, { why: result.why, impact: result.impact });
  });

  it('falls back to a mock explanation when fetch itself throws (e.g. offline)', async () => {
    mockCacheService.getExplanation.mockResolvedValue({ fact: null, relevance: null });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    const item = makeItem();
    const result = await aiService.explainNews(item);

    expect(result.summary).toContain(item.title);
  });

  it('gives Reddit sources a Reddit-specific credibility note in the mock', async () => {
    mockCacheService.getExplanation.mockResolvedValue({ fact: null, relevance: null });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('down'));

    const item = makeItem({ source: { name: 'r/worldnews', type: 'reddit' } });
    const result = await aiService.explainNews(item);

    expect(result.credibility).toMatch(/reddit/i);
  });
});
