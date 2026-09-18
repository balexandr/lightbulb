import { NewsItem, AIExplanation } from '@/types/news';

import { aiService } from './aiService';
import { cacheService } from './cacheService';
import { preferencesService } from './preferencesService';

jest.mock('./cacheService', () => ({
  cacheService: {
    getExplanation: jest.fn(),
    setExplanation: jest.fn(),
  },
}));

jest.mock('./preferencesService', () => ({
  preferencesService: {
    getPreferences: jest.fn(),
  },
}));

const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;
const mockPreferencesService = preferencesService as jest.Mocked<typeof preferencesService>;

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

const explanation: AIExplanation = {
  summary: 'summary',
  why: 'why',
  impact: 'impact',
  credibility: 'credibility',
};

describe('AIService.explainNews', () => {
  beforeEach(() => {
    mockPreferencesService.getPreferences.mockResolvedValue({});
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the cached explanation without calling fetch', async () => {
    mockCacheService.getExplanation.mockResolvedValue(explanation);

    const result = await aiService.explainNews(makeItem());

    expect(result).toEqual(explanation);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls /api/illuminate with the item and preferences, and caches the result', async () => {
    mockCacheService.getExplanation.mockResolvedValue(null);
    mockPreferencesService.getPreferences.mockResolvedValue({ politicalStandpoint: 'moderate' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => explanation,
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
          preferences: { politicalStandpoint: 'moderate' },
        }),
      })
    );
    expect(mockCacheService.setExplanation).toHaveBeenCalledWith(item, explanation);
  });

  it('falls back to a mock explanation when the request fails', async () => {
    mockCacheService.getExplanation.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'AI explanations are not configured on this server.' }),
    });

    const item = makeItem();
    const result = await aiService.explainNews(item);

    expect(result.summary).toContain(item.title);
    expect(mockCacheService.setExplanation).toHaveBeenCalledWith(item, result);
  });

  it('falls back to a mock explanation when fetch itself throws (e.g. offline)', async () => {
    mockCacheService.getExplanation.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    const item = makeItem();
    const result = await aiService.explainNews(item);

    expect(result.summary).toContain(item.title);
  });

  it('gives Reddit sources a Reddit-specific credibility note in the mock', async () => {
    mockCacheService.getExplanation.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('down'));

    const item = makeItem({ source: { name: 'r/worldnews', type: 'reddit' } });
    const result = await aiService.explainNews(item);

    expect(result.credibility).toMatch(/reddit/i);
  });
});
