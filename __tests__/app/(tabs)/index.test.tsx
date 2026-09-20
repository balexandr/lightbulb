import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, RefreshControl } from 'react-native';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { aiService } from '@/services/aiService';
import { cacheService } from '@/services/cacheService';
import { newsService } from '@/services/newsService';
import { preferencesService } from '@/services/preferencesService';
import { NewsItem } from '@/types/news';

import HomeScreen from '@/app/(tabs)/index';

jest.mock('@/services/newsService', () => ({
  newsService: {
    fetchAllNews: jest.fn(),
    clearCache: jest.fn(),
  },
}));

jest.mock('@/services/aiService', () => ({
  aiService: {
    explainNews: jest.fn(),
  },
}));

jest.mock('@/services/cacheService', () => ({
  cacheService: {
    getExplanation: jest.fn(),
  },
}));

const mockNewsService = newsService as jest.Mocked<typeof newsService>;
const mockAiService = aiService as jest.Mocked<typeof aiService>;
const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'item-1',
    title: 'A big headline',
    url: 'https://example.com/story',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('HomeScreen', () => {
  beforeEach(() => {
    mockNewsService.clearCache.mockResolvedValue();
    mockCacheService.getExplanation.mockResolvedValue({ fact: null, relevance: null });
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('shows a loading indicator, then the fetched articles', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('A big headline')).toBeTruthy());
    expect(screen.getByText('BBC')).toBeTruthy();
  });

  it('shows the empty state copy when no articles come back', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([]);

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText(/No articles from selected sources/)).toBeTruthy());
  });

  it('opens the article URL when a headline is tapped', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('A big headline'));

    fireEvent.press(screen.getByText('A big headline'));

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/story'));
  });

  it('opens the Illuminate modal and shows the AI explanation for the tapped article', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
    mockAiService.explainNews.mockResolvedValue({
      summary: 'The summary.',
      why: 'The why.',
      impact: 'The impact.',
      credibility: 'The credibility.',
    });

    render(<HomeScreen />);
    await waitFor(() => screen.getByText('A big headline'));

    fireEvent.press(screen.getByText('💡 Illuminate'));

    await waitFor(() => expect(screen.getByText('The summary.')).toBeTruthy());
    expect(mockAiService.explainNews).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
  });

  it('shows which preference bucket shaped the explanation in "show your work"', async () => {
    await preferencesService.savePreferences({ ageRange: '25-34', politicalStandpoint: 'progressive' });
    mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
    mockAiService.explainNews.mockResolvedValue({
      summary: 'The summary.',
      why: 'The why.',
      impact: 'The impact.',
      credibility: 'The credibility.',
    });

    render(<HomeScreen />);
    await waitFor(() => screen.getByText('A big headline'));

    fireEvent.press(screen.getByText('💡 Illuminate'));

    await waitFor(() => expect(screen.getByText('Shown because: age 25-34, progressive-leaning.')).toBeTruthy());
  });

  it('filters out a source once it is unchecked in the filter menu', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([
      makeItem({ id: 'bbc-item', title: 'BBC story', source: { name: 'BBC', type: 'rss' } }),
      makeItem({ id: 'npr-item', title: 'NPR story', source: { name: 'NPR', type: 'rss' }, url: 'https://example.com/npr' }),
    ]);

    render(<HomeScreen />);
    await waitFor(() => screen.getByText('BBC story'));
    expect(screen.getByText('NPR story')).toBeTruthy();

    fireEvent.press(screen.getByText('☰'));
    const nprMatches = screen.getAllByText('NPR');
    fireEvent.press(nprMatches[nprMatches.length - 1]);

    await waitFor(() => expect(screen.queryByText('NPR story')).toBeNull());
    expect(screen.getByText('BBC story')).toBeTruthy();
  });

  it('shows a coverage comparison pill only for articles with a clustered match, and opens the comparison modal', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([
      makeItem({
        id: 'bbc-item',
        title: 'Senate passes sweeping climate legislation',
        source: { name: 'BBC', type: 'rss' },
      }),
      makeItem({
        id: 'npr-item',
        title: 'Senate passes sweeping climate legislation bill',
        source: { name: 'NPR', type: 'rss' },
        url: 'https://example.com/npr',
      }),
      makeItem({
        id: 'unrelated-item',
        title: 'Local bakery wins national award',
        source: { name: 'CBC', type: 'rss' },
        url: 'https://example.com/bakery',
      }),
    ]);

    render(<HomeScreen />);
    await waitFor(() => screen.getByText('Senate passes sweeping climate legislation'));

    expect(screen.getAllByText(/See how 1 other outlet covered this/)).toHaveLength(2);

    fireEvent.press(screen.getAllByText(/See how 1 other outlet covered this/)[0]);

    await waitFor(() => expect(screen.getByText('🔀 Coverage Comparison')).toBeTruthy());
    // Appears once in the feed card behind the modal, once inside the modal.
    expect(screen.getAllByText('Senate passes sweeping climate legislation bill')).toHaveLength(2);
  });

  it('force-refreshes and clears the cache on pull-to-refresh', async () => {
    mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
    render(<HomeScreen />);
    await waitFor(() => screen.getByText('A big headline'));

    // Initial mount loads without forcing a cache clear.
    expect(mockNewsService.clearCache).not.toHaveBeenCalled();

    const refreshControl = screen.UNSAFE_getByType(RefreshControl);
    fireEvent(refreshControl, 'refresh');

    await waitFor(() => expect(mockNewsService.clearCache).toHaveBeenCalledTimes(1));
  });
});
