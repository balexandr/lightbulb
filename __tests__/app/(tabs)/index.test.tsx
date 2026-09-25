import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, RefreshControl } from 'react-native';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import * as Speech from 'expo-speech';

import { aiService } from '@/services/aiService';
import { briefingService } from '@/services/briefingService';
import { cacheService } from '@/services/cacheService';
import { crossLeanService } from '@/services/crossLeanService';
import { engagementService } from '@/services/engagementService';
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

jest.mock('@/services/briefingService', () => ({
  briefingService: {
    getScript: jest.fn(),
  },
}));

jest.mock('@/services/engagementService', () => ({
  engagementService: {
    getEngagementScores: jest.fn(),
    recordIlluminateSession: jest.fn(),
  },
}));

jest.mock('@/services/crossLeanService', () => ({
  crossLeanService: { recordOpen: jest.fn() },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

const mockNewsService = newsService as jest.Mocked<typeof newsService>;
const mockAiService = aiService as jest.Mocked<typeof aiService>;
const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;
const mockBriefingService = briefingService as jest.Mocked<typeof briefingService>;
const mockEngagementService = engagementService as jest.Mocked<typeof engagementService>;
const mockCrossLeanService = crossLeanService as jest.Mocked<typeof crossLeanService>;
const mockSpeech = Speech as jest.Mocked<typeof Speech>;

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
    mockEngagementService.getEngagementScores.mockResolvedValue({});
    mockEngagementService.recordIlluminateSession.mockResolvedValue();
    mockCrossLeanService.recordOpen.mockResolvedValue();
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

  it('renders a fast source\'s articles immediately, before a slower source resolves', async () => {
    const fastItem = makeItem({ id: 'fast', title: 'Fast source headline', source: { name: 'BBC', type: 'rss' } });
    const slowItem = makeItem({ id: 'slow', title: 'Slow source headline', source: { name: 'NPR', type: 'rss' }, url: 'https://example.com/slow' });

    let resolveSlow: (value: typeof slowItem[]) => void;
    const slowPromise = new Promise<typeof slowItem[]>(resolve => {
      resolveSlow = resolve;
    });

    mockNewsService.fetchAllNews.mockImplementation(async (_config, onProgress) => {
      onProgress?.([fastItem]);
      const rest = await slowPromise;
      const combined = [fastItem, ...rest];
      onProgress?.(combined);
      return combined;
    });

    render(<HomeScreen />);

    await waitFor(() => expect(screen.getByText('Fast source headline')).toBeTruthy());
    expect(screen.queryByText('Slow source headline')).toBeNull();

    resolveSlow!([slowItem]);
    await waitFor(() => expect(screen.getByText('Slow source headline')).toBeTruthy());
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

  describe('engagement tracking and ranking (§18.2)', () => {
    it('records a full read when the explanation stays open past the threshold', async () => {
      const realNow = Date.now;
      mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
      mockAiService.explainNews.mockResolvedValue({
        summary: 'The summary.',
        why: 'The why.',
        impact: 'The impact.',
        credibility: 'The credibility.',
      });

      Date.now = () => 1_000_000;
      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));

      fireEvent.press(screen.getByText('💡 Illuminate'));
      await waitFor(() => screen.getByText('The summary.'));

      Date.now = () => 1_000_000 + 9_000; // 9s dwell, past the 8s "full read" threshold
      fireEvent.press(screen.getByText('✕'));

      await waitFor(() =>
        expect(mockEngagementService.recordIlluminateSession).toHaveBeenCalledWith('BBC', 9_000)
      );
      Date.now = realNow;
    });

    it('records a quick dismissal when the explanation closes almost immediately', async () => {
      const realNow = Date.now;
      mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
      mockAiService.explainNews.mockResolvedValue({
        summary: 'The summary.',
        why: 'The why.',
        impact: 'The impact.',
        credibility: 'The credibility.',
      });

      Date.now = () => 1_000_000;
      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));

      fireEvent.press(screen.getByText('💡 Illuminate'));
      await waitFor(() => screen.getByText('The summary.'));

      Date.now = () => 1_000_000 + 500; // 0.5s dwell
      fireEvent.press(screen.getByText('✕'));

      await waitFor(() =>
        expect(mockEngagementService.recordIlluminateSession).toHaveBeenCalledWith('BBC', 500)
      );
      Date.now = realNow;
    });

    it('re-ranks the feed using tracked engagement scores', async () => {
      mockEngagementService.getEngagementScores.mockResolvedValue({ NPR: 1 });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ id: 'a', title: 'Story A', source: { name: 'CBC', type: 'rss' } }),
        makeItem({ id: 'b', title: 'Story B', source: { name: 'CBC', type: 'rss' } }),
        makeItem({ id: 'c', title: 'Story C', source: { name: 'CBC', type: 'rss' } }),
        makeItem({ id: 'd', title: 'Story D', source: { name: 'CBC', type: 'rss' } }),
        makeItem({ id: 'e', title: 'Story E (NPR)', source: { name: 'NPR', type: 'rss' }, url: 'https://example.com/npr' }),
      ]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('Story E (NPR)'));

      const titles = screen.getAllByText(/^Story [A-E]/).map(node => node.props.children);
      // A fully-engaged NPR item started last (index 4) should move up.
      expect(titles.indexOf('Story E (NPR)')).toBeLessThan(4);
    });
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

  describe('cross-lean open tracking (§17.7)', () => {
    it('records an open when the source has a different lean than the reader\'s stance', async () => {
      await preferencesService.savePreferences({ politicalStandpoint: 'progressive' });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ source: { name: 'NYTimes', type: 'rss' } }),
      ]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));
      fireEvent.press(screen.getByText('A big headline'));

      await waitFor(() =>
        expect(mockCrossLeanService.recordOpen).toHaveBeenCalledWith('progressive', 'NYTimes', 'left-leaning')
      );
    });

    it('does not record an open for a source with no RSS_FEEDS entry (e.g. Reddit)', async () => {
      await preferencesService.savePreferences({ politicalStandpoint: 'conservative' });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ source: { name: 'r/worldnews', type: 'reddit' } }),
      ]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));
      fireEvent.press(screen.getByText('A big headline'));

      await waitFor(() => expect(Linking.openURL).toHaveBeenCalled());
      expect(mockCrossLeanService.recordOpen).not.toHaveBeenCalled();
    });
  });

  describe('hyperlocal default selection (§17.4)', () => {
    it('does not default-select a local source for a reader with no matching region', async () => {
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ id: 'bbc-item', title: 'BBC story', source: { name: 'BBC', type: 'rss' } }),
        makeItem({ id: 'whyy-item', title: 'WHYY story', source: { name: 'WHYY', type: 'rss' }, url: 'https://example.com/whyy' }),
      ]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('BBC story'));

      expect(screen.queryByText('WHYY story')).toBeNull();
    });

    it('default-selects a matching local source for a reader in that region', async () => {
      await preferencesService.savePreferences({ location: 'philadelphia' });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ id: 'bbc-item', title: 'BBC story', source: { name: 'BBC', type: 'rss' } }),
        makeItem({ id: 'whyy-item', title: 'WHYY story', source: { name: 'WHYY', type: 'rss' }, url: 'https://example.com/whyy' }),
      ]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('BBC story'));

      expect(screen.getByText('WHYY story')).toBeTruthy();
    });

    it('generalizes to a different hyperlocal city, without cross-matching another city\'s source', async () => {
      await preferencesService.savePreferences({ location: 'new-york' });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ id: 'whyy-item', title: 'WHYY story', source: { name: 'WHYY', type: 'rss' }, url: 'https://example.com/whyy' }),
        makeItem({ id: 'gothamist-item', title: 'Gothamist story', source: { name: 'Gothamist', type: 'rss' }, url: 'https://example.com/gothamist' }),
      ]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('Gothamist story'));

      // The NYC reader gets Gothamist by default, but not Philadelphia's WHYY.
      expect(screen.queryByText('WHYY story')).toBeNull();
    });
  });

  describe('relevance teaser (§17.1)', () => {
    it('shows a region teaser on a hyperlocal card matching the reader\'s region', async () => {
      await preferencesService.savePreferences({ location: 'philadelphia' });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ id: 'whyy-item', title: 'WHYY story', source: { name: 'WHYY', type: 'rss' }, url: 'https://example.com/whyy' }),
      ]);

      render(<HomeScreen />);

      await waitFor(() => expect(screen.getByText('Relevant to you: Philadelphia')).toBeTruthy());
    });

    it('shows a topic teaser on a matching headline for the reader\'s age bucket', async () => {
      await preferencesService.savePreferences({ ageRange: '65+' });
      mockNewsService.fetchAllNews.mockResolvedValue([
        makeItem({ title: 'Social Security cost-of-living increase announced' }),
      ]);

      render(<HomeScreen />);

      await waitFor(() => expect(screen.getByText('Relevant to you: retirement')).toBeTruthy());
    });

    it('shows no teaser when the reader has no matching preferences', async () => {
      mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));

      expect(screen.queryByText(/Relevant to you:/)).toBeNull();
    });
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

  describe('daily briefing', () => {
    it('generates a script for the top stories and speaks it', async () => {
      mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
      mockBriefingService.getScript.mockResolvedValue('Good morning, here is your briefing.');

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));

      fireEvent.press(screen.getByText('🎧 Listen to your daily briefing'));

      await waitFor(() => expect(mockBriefingService.getScript).toHaveBeenCalled());
      await waitFor(() => expect(mockSpeech.speak).toHaveBeenCalledWith(
        'Good morning, here is your briefing.',
        expect.objectContaining({ onDone: expect.any(Function) })
      ));
      await waitFor(() => expect(screen.getByText('⏹ Stop briefing')).toBeTruthy());
    });

    it('stops speech and resets to idle when tapped again while speaking', async () => {
      mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
      mockBriefingService.getScript.mockResolvedValue('A script.');

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));

      fireEvent.press(screen.getByText('🎧 Listen to your daily briefing'));
      await waitFor(() => screen.getByText('⏹ Stop briefing'));

      fireEvent.press(screen.getByText('⏹ Stop briefing'));

      expect(mockSpeech.stop).toHaveBeenCalled();
      await waitFor(() => expect(screen.getByText('🎧 Listen to your daily briefing')).toBeTruthy());
    });

    it('returns to idle and never calls speak when the briefing request fails', async () => {
      mockNewsService.fetchAllNews.mockResolvedValue([makeItem()]);
      mockBriefingService.getScript.mockRejectedValue(new Error('Too many requests.'));

      render(<HomeScreen />);
      await waitFor(() => screen.getByText('A big headline'));

      fireEvent.press(screen.getByText('🎧 Listen to your daily briefing'));

      await waitFor(() => expect(screen.getByText(/Briefing unavailable/)).toBeTruthy());
      expect(mockSpeech.speak).not.toHaveBeenCalled();
    });

    it('does not show the briefing banner when there are no articles', async () => {
      mockNewsService.fetchAllNews.mockResolvedValue([]);
      render(<HomeScreen />);

      await waitFor(() => expect(screen.getByText(/No articles from selected sources/)).toBeTruthy());
      expect(screen.queryByText('🎧 Listen to your daily briefing')).toBeNull();
    });
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
