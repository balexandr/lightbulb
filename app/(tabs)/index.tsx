import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { FilterMenu } from '@/components/FilterMenu';
import { IlluminateModal } from '@/components/IlluminateModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { aiService } from '@/services/aiService';
import { cacheService } from '@/services/cacheService';
import { newsService } from '@/services/newsService';
import { NewsItem } from '@/types/news';

export default function HomeScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [illuminateLoading, setIlluminateLoading] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [fromCache, setFromCache] = useState(false);
  
  // Source filtering
  const [rssSources, setRssSources] = useState<string[]>([]);
  const [redditSources, setRedditSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  
  const colorScheme = useColorScheme() ?? 'light';

  const loadNews = async (forceRefresh = false) => {
    try {
      console.log('🚀 loadNews called with forceRefresh:', forceRefresh);
      
      // Clear cache if force refresh
      if (forceRefresh) {
        console.log('🔄 Force refresh - clearing cache');
        await newsService.clearCache();
      }
      
      console.log('📞 Calling newsService.fetchAllNews()');
      const items = await newsService.fetchAllNews();
      console.log('📦 Got items back:', items.length);
      
      setNews(items);
      
      // Debug: Log all sources with their types
      console.log('=== SOURCE DEBUG ===');
      console.log('Total items:', items.length);
      
      const rssItems = items.filter(item => item.source.type === 'rss');
      const redditItems = items.filter(item => item.source.type === 'reddit');
      
      console.log(`RSS items: ${rssItems.length}`);
      console.log(`Reddit items: ${redditItems.length}`);
      
      // Separate RSS feeds from Reddit sources
      const rss = Array.from(
        new Set(
          items
            .filter(item => item.source.type === 'rss')
            .map(item => item.source.name)
        )
      ).sort();
      
      const reddit = Array.from(
        new Set(
          items
            .filter(item => item.source.type === 'reddit')
            .map(item => item.source.name)
        )
      ).sort();
      
      console.log('RSS Sources:', rss);
      console.log('Reddit Sources:', reddit);
      
      setRssSources(rss);
      setRedditSources(reddit);
      
      // Initialize with default sources (excluding TechCrunch)
      if (selectedSources.size === 0) {
        const defaultSources = [...rss, ...reddit].filter(
          source => source !== 'TechCrunch'
        );
        setSelectedSources(new Set(defaultSources));
      }
    } catch (error) {
      console.error('❌ Error loading news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter news based on selected sources
  useEffect(() => {
    if (selectedSources.size === 0) {
      setFilteredNews(news);
    } else {
      const filtered = news.filter(item => selectedSources.has(item.source.name));
      setFilteredNews(filtered);
    }
  }, [news, selectedSources]);

  useEffect(() => {
    console.log('🎬 Component mounted, calling loadNews');
    // Force refresh on initial load to get RSS feeds
    loadNews(true);
  }, []);

  const onRefresh = () => {
    console.log('🔄 Pull to refresh triggered');
    setRefreshing(true);
    loadNews(true); // Force refresh when user pulls down
  };

  const handleIlluminate = async (item: NewsItem) => {
    setSelectedItem(item);
    setModalVisible(true);
    setIlluminateLoading(true);
    setExplanation(null);
    setFromCache(false);

    try {
      // Check if we have it cached
      const cached = await cacheService.getExplanation(item);
      if (cached) {
        setFromCache(true);
      }
      
      const result = await aiService.explainNews(item);
      setExplanation(result);
    } catch (error) {
      console.error('Error getting AI explanation:', error);
    } finally {
      setIlluminateLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
    setExplanation(null);
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
    console.log('🍔 Hamburger clicked, current state:', filterMenuVisible);
    setFilterMenuVisible(!filterMenuVisible);
  };

  const handleCloseFilterMenu = () => {
    console.log('🚪 Closing filter menu');
    setFilterMenuVisible(false);
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

      <FlatList
        data={filteredNews}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" numberOfLines={3}>
              {item.title}
            </ThemedText>
            {item.imageUrl && (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: item.imageUrl }}
                  style={styles.articleImage}
                  resizeMode="cover"
                />
              </View>
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
        explanation={explanation}
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
    backgroundColor: '#F59E0B',
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
    color: '#F59E0B',
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
