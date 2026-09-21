import { briefingService } from './briefingService';
import { cacheService } from './cacheService';
import { PreferenceBucket } from './preferencesService';
import { NewsItem } from '@/types/news';

jest.mock('./cacheService', () => ({
  cacheService: {
    getFact: jest.fn(),
  },
}));

const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'id-1',
    title: 'A headline',
    url: 'https://example.com/a',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

const bucket: PreferenceBucket = { age: 'unspecified', stance: 'unspecified', region: 'unspecified' };

describe('BriefingService.getScript', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends each item with its cached fact summary, when one exists', async () => {
    mockCacheService.getFact.mockImplementation(async item =>
      item.id === 'a' ? { summary: 'cached summary for a', credibility: 'x' } : null
    );
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ script: 'A script.' }),
    });

    const items = [makeItem({ id: 'a', title: 'Story A' }), makeItem({ id: 'b', title: 'Story B' })];
    await briefingService.getScript(items, bucket);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/briefing',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { title: 'Story A', source: { name: 'BBC' }, domain: undefined, cachedSummary: 'cached summary for a' },
            { title: 'Story B', source: { name: 'BBC' }, domain: undefined, cachedSummary: undefined },
          ],
          bucket,
        }),
      })
    );
  });

  it('returns the script from a successful response', async () => {
    mockCacheService.getFact.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ script: 'Good morning.' }),
    });

    const result = await briefingService.getScript([makeItem()], bucket);
    expect(result).toBe('Good morning.');
  });

  it('throws with the server error message on a non-ok response', async () => {
    mockCacheService.getFact.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests. Please try again shortly.' }),
    });

    await expect(briefingService.getScript([makeItem()], bucket)).rejects.toThrow(
      'Too many requests. Please try again shortly.'
    );
  });

  it('throws a fallback message when the error response has no body', async () => {
    mockCacheService.getFact.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error('no body'); },
    });

    await expect(briefingService.getScript([makeItem()], bucket)).rejects.toThrow('Briefing request failed (503)');
  });
});
