import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';
import * as Speech from 'expo-speech';
import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CoverageComparisonModal } from '@/components/CoverageComparisonModal';
import { FilterMenu } from '@/components/FilterMenu';
import { IlluminateButton } from '@/components/IlluminateButton';
import { IlluminateModal } from '@/components/IlluminateModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DISABLED_BY_DEFAULT_SOURCES, LEAN_LABELS, RSS_FEEDS } from '@/constants/newsConfig';
import { AccentColor, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { aiService } from '@/services/aiService';
import { briefingService } from '@/services/briefingService';
import { cacheService } from '@/services/cacheService';
import { crossLeanService } from '@/services/crossLeanService';
import { engagementService } from '@/services/engagementService';
import { FlagReason, flagService } from '@/services/flagService';
import { newsService } from '@/services/newsService';
import { PreferenceBucket, preferencesService } from '@/services/preferencesService';
import { AIExplanation, NewsItem } from '@/types/news';
import { applyEngagementRanking } from '@/utils/engagementRanking';
import { logger } from '@/utils/logger';
import { computeRelevanceTeaser } from '@/utils/relevanceTeaser';
import { buildRelatedArticlesIndex } from '@/utils/storyClustering';

const BRIEFING_STORY_COUNT = 5;
type BriefingState = 'idle' | 'loading' | 'speaking' | 'error';
type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const BRIEFING_ICON: Record<BriefingState, MaterialIconName> = {
  idle: 'headset',
  loading: 'hourglass-empty',
  speaking: 'stop',
  error: 'warning',
};

const BRIEFING_LABEL: Record<BriefingState, string> = {
  idle: 'Listen to your daily briefing',
  loading: 'Preparing your briefing...',
  speaking: 'Stop briefing',
  error: 'Briefing unavailable — tap to retry',
};

export default function HomeScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [illuminateLoading, setIlluminateLoading] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [explanationBucket, setExplanationBucket] = useState<PreferenceBucket | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [readerBucket, setReaderBucket] = useState<PreferenceBucket | null>(null);

  const [rssSources, setRssSources] = useState<string[]>([]);
  const [redditSources, setRedditSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const [comparisonItem, setComparisonItem] = useState<NewsItem | null>(null);
  const [comparisonVisible, setComparisonVisible] = useState(false);

  const [briefingState, setBriefingState] = useState<BriefingState>('idle');

  const [engagementScores, setEngagementScores] = useState<Record<string, number>>({});
  // When the currently-open explanation actually became visible (loading
  // finished) - a ref, not state, since it doesn't need to trigger a
  // re-render, just be read back in handleCloseModal (§18.2).
  const explanationReadyAt = useRef<number | null>(null);

  const colorScheme = useColorScheme() ?? 'light';

  // Stop any in-progress speech if the screen unmounts - otherwise audio
  // would keep playing after the user navigates away.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    engagementService.getEngagementScores().then(setEngagementScores);
  }, []);

  // Clustered over the full fetched list, not the source-filtered one - a
  // user who's hidden a source in the filter menu should still be able to
  // discover that it covered a story they're reading elsewhere.
  const relatedArticlesIndex = useMemo(() => buildRelatedArticlesIndex(news), [news]);

  // §18.2 "cheap MVP": a light, bounded re-rank using this device's own
  // engagement history - see utils/engagementRanking.ts. Recomputed
  // whenever the feed or the tracked scores change, so it stays current
  // as the reader engages with more articles in the same session.
  const rankedNews = useMemo(
    () => applyEngagementRanking(filteredNews, engagementScores),
    [filteredNews, engagementScores]
  );

  const loadNews = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        await newsService.clearCache();
      }
      
      // Render each source's articles as soon as it finishes instead of
      // waiting for all ~13 to settle - one slow/failing source (the CORS
      // proxy web relies on is intermittently slow) no longer holds the
      // fast ones hostage. setLoading(false) fires on the very first batch
      // so the spinner clears the moment there's anything to show.
      const items = await newsService.fetchAllNews(undefined, partial => {
        setNews(partial);
        setLoading(false);
      });
      setNews(items);

      const rss = Array.from(
        new Set(items.filter(item => item.source.type === 'rss').map(item => item.source.name))
      ).sort();
      
      const reddit = Array.from(
        new Set(items.filter(item => item.source.type === 'reddit').map(item => item.source.name))
      ).sort();
      
      setRssSources(rss);
      setRedditSources(reddit);
      
      if (selectedSources.size === 0) {
        // §17.4: a hyperlocal source is only on by default for readers
        // whose region bucket matches it - everyone else can still find
        // and enable it manually in the Filter Menu.
        const preferences = await preferencesService.getPreferences();
        const userRegion = preferencesService.getPreferenceBucket(preferences).region;

        const defaultSources = [...rss, ...reddit].filter(source => {
          if (DISABLED_BY_DEFAULT_SOURCES.includes(source as any)) {
            return false;
          }
          const localRegion = RSS_FEEDS.find(feed => feed.name === source)?.localRegion;
          return !localRegion || localRegion === userRegion;
        });
        setSelectedSources(new Set(defaultSources));
      }
    } catch (error) {
      logger.error('Error loading news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedSources.size === 0) {
      setFilteredNews(news);
    } else {
      const filtered = news.filter(item => selectedSources.has(item.source.name));
      setFilteredNews(filtered);
    }
  }, [news, selectedSources]);

  // Intentionally mount-only: loadNews reads selectedSources but we only
  // want the initial fetch here, not a refetch every time filters change.
  // forceRefresh is false so a fresh cache from a previous session is used
  // instead of always hitting the network on cold start.
  useEffect(() => {
    loadNews(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §17.1: also mount-only, same tradeoff as §17.4's hyperlocal
  // default-source selection above - if the reader changes preferences on
  // the Settings tab and comes back, the on-card teaser won't reflect it
  // until next app restart. Acceptable for a cheap rule-based hint;
  // Illuminate itself (handleIlluminate) always re-reads fresh preferences.
  useEffect(() => {
    preferencesService.getPreferences().then(preferences => {
      setReaderBucket(preferencesService.getPreferenceBucket(preferences));
    });
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNews(true);
  };

  const handleOpenArticle = async (item: NewsItem) => {
    try {
      const supported = await Linking.canOpenURL(item.url);
      if (supported) {
        await Linking.openURL(item.url);
      } else {
        logger.error('Cannot open URL:', item.url);
      }
    } catch (error) {
      logger.error('Error opening URL:', error);
    }

    // §17.7 - fire-and-forget, purely descriptive tracking; never blocks
    // opening the article. Only sources tagged with a lean (§13/§17.7) can
    // register a cross-lean open - Reddit sources have no RSS_FEEDS entry.
    const sourceConfig = RSS_FEEDS.find(feed => feed.name === item.source.name);
    if (sourceConfig) {
      const preferences = await preferencesService.getPreferences();
      const bucket = preferencesService.getPreferenceBucket(preferences);
      crossLeanService.recordOpen(bucket.stance, item.source.name, sourceConfig.lean);
    }
  };

  const handleShowComparison = (item: NewsItem) => {
    setComparisonItem(item);
    setComparisonVisible(true);
  };

  const handleCloseComparison = () => {
    setComparisonVisible(false);
    setComparisonItem(null);
  };

  const renderRelevanceTeaser = (item: NewsItem) => {
    if (!readerBucket) {
      return null;
    }
    const teaser = computeRelevanceTeaser(item, readerBucket);
    if (!teaser) {
      return null;
    }

    return (
      <View style={styles.teaserBadge}>
        <Text style={styles.teaserText}>Relevant to you: {teaser.label}</Text>
      </View>
    );
  };

  // §16.3 #6: static lookup, no AI call - Reddit items have no RSS_FEEDS
  // entry (same "no entry" case §17.7's cross-lean tracking already
  // handles), so they never show a badge either. Labeled "Source: X", not
  // just "X" - this is a blanket characterization of the outlet, reused
  // on every one of its articles regardless of that article's actual
  // content (a weather story from a left-leaning-tagged outlet still
  // shows "Source: Left-leaning") - the label needs to say what it's
  // describing, or it reads as a claim about the specific article.
  const renderLeanTag = (item: NewsItem) => {
    const sourceConfig = RSS_FEEDS.find(feed => feed.name === item.source.name);
    const leanLabel = sourceConfig && LEAN_LABELS[sourceConfig.lean];
    if (!leanLabel) {
      return null;
    }
    return <ThemedText style={styles.leanTag}> • Source: {leanLabel}</ThemedText>;
  };

  const renderComparisonPill = (item: NewsItem) => {
    const related = relatedArticlesIndex.get(item.id);
    if (!related || related.length === 0) {
      return null;
    }

    return (
      <TouchableOpacity style={[styles.comparisonRow, styles.rowWithGap]} onPress={() => handleShowComparison(item)}>
        <MaterialIcons name="compare-arrows" size={14} color={Colors[colorScheme].text} style={styles.comparisonIcon} />
        <Text style={styles.comparisonText}>
          See how {related.length} other {related.length === 1 ? 'outlet' : 'outlets'} covered this
        </Text>
      </TouchableOpacity>
    );
  };

  const handleIlluminate = async (item: NewsItem) => {
    setSelectedItem(item);
    setModalVisible(true);
    setIlluminateLoading(true);
    setExplanation(null);
    setFromCache(false);

    try {
      const preferences = await preferencesService.getPreferences();
      const bucket = preferencesService.getPreferenceBucket(preferences);
      setExplanationBucket(bucket);
      const cached = await cacheService.getExplanation(item, bucket);
      if (cached.fact && cached.relevance) {
        setFromCache(true);
      }

      const result = await aiService.explainNews(item);
      setExplanation(result);
      // Dwell time starts once the explanation is actually visible, not
      // from when the modal opened - the loading spinner shouldn't count
      // toward "read fully" (§18.2).
      explanationReadyAt.current = Date.now();
    } catch (error) {
      logger.error('Error getting AI explanation:', error);
    } finally {
      setIlluminateLoading(false);
    }
  };

  const handleCloseModal = () => {
    if (selectedItem && explanationReadyAt.current !== null) {
      const dwellMs = Date.now() - explanationReadyAt.current;
      engagementService.recordIlluminateSession(selectedItem.source.name, dwellMs).then(() =>
        engagementService.getEngagementScores().then(setEngagementScores)
      );
    }
    explanationReadyAt.current = null;

    setModalVisible(false);
    setSelectedItem(null);
    setExplanation(null);
    setExplanationBucket(null);
    setFromCache(false);
  };

  const handleFlag = async (flaggedField: FlagReason, freeText?: string) => {
    if (!selectedItem || !explanationBucket) return;
    await flagService.submitFlag({ url: selectedItem.url, bucket: explanationBucket, flaggedField, freeText });
  };

  const handleToggleSource = (source: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(source)) {
      newSelected.delete(source);
    } else {
      newSelected.add(source);
    }
    setSelectedSources(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedSources(new Set([...rssSources, ...redditSources]));
  };

  const handleClearAll = () => {
    setSelectedSources(new Set());
  };

  const handleToggleFilterMenu = () => {
    setFilterMenuVisible(!filterMenuVisible);
  };

  const handleCloseFilterMenu = () => {
    setFilterMenuVisible(false);
  };

  const handleToggleBriefing = async () => {
    if (briefingState === 'speaking') {
      await Speech.stop();
      setBriefingState('idle');
      return;
    }
    if (briefingState === 'loading') {
      return;
    }

    setBriefingState('loading');
    try {
      const topStories = rankedNews.slice(0, BRIEFING_STORY_COUNT);
      const preferences = await preferencesService.getPreferences();
      const bucket = preferencesService.getPreferenceBucket(preferences);
      const script = await briefingService.getScript(topStories, bucket);

      setBriefingState('speaking');
      Speech.speak(script, {
        onDone: () => setBriefingState('idle'),
        onStopped: () => setBriefingState('idle'),
        onError: (error) => {
          logger.error('Error speaking briefing:', error);
          setBriefingState('idle');
        },
      });
    } catch (error) {
      logger.error('Error generating briefing:', error);
      setBriefingState('error');
    }
  };

  const totalSources = rssSources.length + redditSources.length;

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.stickyHeader, { zIndex: filterMenuVisible ? 1001 : 1 }]}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={handleToggleFilterMenu}
          accessibilityLabel={
            selectedSources.size < totalSources
              ? `Open source filters. ${selectedSources.size} of ${totalSources} sources selected.`
              : 'Open source filters'
          }
        >
          <MaterialIcons
            name={filterMenuVisible ? 'close' : 'filter-list'}
            size={24}
            color={selectedSources.size < totalSources ? AccentColor : Colors[colorScheme].text}
          />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={[
            styles.logo,
            { color: Colors[colorScheme].text }
          ]}>
            Lightbulb
          </Text>
          <ThemedText style={styles.subtitle}>Illuminating the news</ThemedText>
        </View>

        <View style={styles.headerRight} />
      </ThemedView>

      {filteredNews.length > 0 && (
        <TouchableOpacity
          style={styles.briefingBanner}
          onPress={handleToggleBriefing}
          disabled={briefingState === 'loading'}
        >
          <View style={styles.briefingRow}>
            <MaterialIcons name={BRIEFING_ICON[briefingState]} size={16} color={AccentColor} />
            <Text style={styles.briefingText}>{BRIEFING_LABEL[briefingState]}</Text>
          </View>
        </TouchableOpacity>
      )}

      <FlatList
        data={rankedNews}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <TouchableOpacity onPress={() => handleOpenArticle(item)}>
              <ThemedText type="defaultSemiBold" numberOfLines={3} style={styles.titleLink}>
                {item.title}
              </ThemedText>
            </TouchableOpacity>
            {renderRelevanceTeaser(item)}
            {item.imageUrl && (
              <TouchableOpacity onPress={() => handleOpenArticle(item)}>
                <View style={styles.imageContainer}>
                  <ExpoImage
                    source={{ uri: item.imageUrl }}
                    style={styles.articleImage}
                    contentFit="cover"
                    contentPosition="top"
                  />
                </View>
              </TouchableOpacity>
            )}
            <ThemedView style={styles.metadata}>
              <View style={styles.sourceContainer}>
                {item.source.icon && (
                  <Image
                    source={{ uri: item.source.icon }}
                    style={styles.sourceIcon}
                  />
                )}
                <ThemedText style={styles.source} numberOfLines={2}>
                  {item.source.name}
                  {renderLeanTag(item)}
                </ThemedText>
              </View>
              <IlluminateButton onPress={() => handleIlluminate(item)} />
            </ThemedView>
            {renderComparisonPill(item)}
          </ThemedView>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No articles from selected sources.{'\n'}
              Try selecting more sources from the filter menu.
            </ThemedText>
          </View>
        }
      />

      <IlluminateModal
        visible={modalVisible}
        onClose={handleCloseModal}
        title={selectedItem?.title || ''}
        loading={illuminateLoading}
        fromCache={fromCache}
        explanation={explanation ?? undefined}
        bucket={explanationBucket ?? undefined}
        onFlag={handleFlag}
      />

      <FilterMenu
        visible={filterMenuVisible}
        onClose={handleCloseFilterMenu}
        rssSources={rssSources}
        redditSources={redditSources}
        selectedSources={selectedSources}
        onToggleSource={handleToggleSource}
        onSelectAll={handleSelectAll}
        onClearAll={handleClearAll}
        readerRegion={readerBucket?.region ?? 'unspecified'}
      />

      <CoverageComparisonModal
        visible={comparisonVisible}
        onClose={handleCloseComparison}
        mainItem={comparisonItem}
        relatedItems={comparisonItem ? relatedArticlesIndex.get(comparisonItem.id) ?? [] : []}
        onOpenArticle={handleOpenArticle}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  hamburgerButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  briefingBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
  },
  briefingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  briefingText: {
    fontSize: 14,
    fontWeight: '600',
    color: AccentColor,
  },
  logo: {
    fontSize: 36,
    fontWeight: '200',
    letterSpacing: 2,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 6,
    letterSpacing: 0.5,
    fontWeight: '300',
  },
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  titleLink: {
    marginBottom: 4,
  },
  imageContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  articleImage: {
    width: '100%',
    height: 200,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
    flex: 1,
  },
  sourceIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    borderRadius: 2,
  },
  source: {
    fontSize: 12,
  },
  leanTag: {
    fontSize: 12,
    opacity: 0.6,
  },
  teaserBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },
  teaserText: {
    fontSize: 11,
    fontWeight: '600',
    color: AccentColor,
  },
  comparisonRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  rowWithGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comparisonIcon: {
    opacity: 0.7,
  },
  comparisonText: {
    fontSize: 12,
    opacity: 0.7,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 22,
  },
});
