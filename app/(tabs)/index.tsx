import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CoverageComparisonModal } from '@/components/CoverageComparisonModal';
import { FilterMenu } from '@/components/FilterMenu';
import { IlluminateModal } from '@/components/IlluminateModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DISABLED_BY_DEFAULT_SOURCES, RSS_FEEDS } from '@/constants/newsConfig';
import { AccentColor, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { aiService } from '@/services/aiService';
import { briefingService } from '@/services/briefingService';
import { cacheService } from '@/services/cacheService';
import { newsService } from '@/services/newsService';
import { PreferenceBucket, preferencesService } from '@/services/preferencesService';
import { AIExplanation, NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
import { buildRelatedArticlesIndex } from '@/utils/storyClustering';

const BRIEFING_STORY_COUNT = 5;
type BriefingState = 'idle' | 'loading' | 'speaking' | 'error';

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
  
  const [rssSources, setRssSources] = useState<string[]>([]);
  const [redditSources, setRedditSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  const [comparisonItem, setComparisonItem] = useState<NewsItem | null>(null);
  const [comparisonVisible, setComparisonVisible] = useState(false);

  const [briefingState, setBriefingState] = useState<BriefingState>('idle');

  const colorScheme = useColorScheme() ?? 'light';

  // Stop any in-progress speech if the screen unmounts - otherwise audio
  // would keep playing after the user navigates away.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Clustered over the full fetched list, not the source-filtered one - a
  // user who's hidden a source in the filter menu should still be able to
  // discover that it covered a story they're reading elsewhere.
  const relatedArticlesIndex = useMemo(() => buildRelatedArticlesIndex(news), [news]);

  const loadNews = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        await newsService.clearCache();
      }
      
      const items = await newsService.fetchAllNews();
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

  const onRefresh = () => {
    setRefreshing(true);
    loadNews(true);
  };

  const handleOpenArticle = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        logger.error('Cannot open URL:', url);
      }
    } catch (error) {
      logger.error('Error opening URL:', error);
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

  const renderComparisonPill = (item: NewsItem) => {
    const related = relatedArticlesIndex.get(item.id);
    if (!related || related.length === 0) {
      return null;
    }

    return (
      <TouchableOpacity style={styles.comparisonRow} onPress={() => handleShowComparison(item)}>
        <Text style={styles.comparisonText}>
          🔀 See how {related.length} other {related.length === 1 ? 'outlet' : 'outlets'} covered this
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
    } catch (error) {
      logger.error('Error getting AI explanation:', error);
    } finally {
      setIlluminateLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
    setExplanation(null);
    setExplanationBucket(null);
    setFromCache(false);
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
      const topStories = filteredNews.slice(0, BRIEFING_STORY_COUNT);
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
        >
          <Text style={[styles.hamburgerIcon, { color: Colors[colorScheme].text }]}>
            {filterMenuVisible ? '✕' : '☰'}
          </Text>
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
        
        <View style={styles.headerRight}>
          {selectedSources.size < totalSources && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{selectedSources.size}</Text>
            </View>
          )}
        </View>
      </ThemedView>

      {filteredNews.length > 0 && (
        <TouchableOpacity
          style={styles.briefingBanner}
          onPress={handleToggleBriefing}
          disabled={briefingState === 'loading'}
        >
          <Text style={styles.briefingText}>
            {briefingState === 'loading' && '⏳ Preparing your briefing...'}
            {briefingState === 'speaking' && '⏹ Stop briefing'}
            {briefingState === 'error' && '⚠️ Briefing unavailable — tap to retry'}
            {briefingState === 'idle' && '🎧 Listen to your daily briefing'}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filteredNews}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <TouchableOpacity onPress={() => handleOpenArticle(item.url)}>
              <ThemedText type="defaultSemiBold" numberOfLines={3} style={styles.titleLink}>
                {item.title}
              </ThemedText>
            </TouchableOpacity>
            {item.imageUrl && (
              <TouchableOpacity onPress={() => handleOpenArticle(item.url)}>
                <View style={styles.imageContainer}>
                  <Image 
                    source={{ uri: item.imageUrl }}
                    style={styles.articleImage}
                    resizeMode="cover"
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
                <ThemedText style={styles.source}>{item.source.name}</ThemedText>
                {item.domain && (
                  <ThemedText style={styles.domain}> • {item.domain}</ThemedText>
                )}
              </View>
              <TouchableOpacity
                style={styles.illuminateButton}
                onPress={() => handleIlluminate(item)}
              >
                <Text style={styles.illuminateText}>💡 Illuminate</Text>
              </TouchableOpacity>
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
  hamburgerIcon: {
    fontSize: 24,
    fontWeight: '300',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  filterBadge: {
    backgroundColor: AccentColor,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  briefingBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
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
    alignItems: 'center',
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
  domain: {
    fontSize: 12,
  },
  illuminateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    marginLeft: 8,
  },
  illuminateText: {
    fontSize: 12,
    fontWeight: '600',
    color: AccentColor,
  },
  comparisonRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
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
