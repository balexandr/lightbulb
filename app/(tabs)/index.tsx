import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IlluminateModal } from '@/components/IlluminateModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { newsService } from '@/services/newsService';
import { NewsItem } from '@/types/news';

export default function HomeScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [illuminateLoading, setIlluminateLoading] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const colorScheme = useColorScheme() ?? 'light';

  const loadNews = async () => {
    try {
      const items = await newsService.fetchAllNews();
      setNews(items);
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNews();
  };

  const handleIlluminate = async (item: NewsItem) => {
    setSelectedItem(item);
    setModalVisible(true);
    setIlluminateLoading(true);
    setExplanation(null);

    // TODO: Call AI service here
    // For now, using mock data
    setTimeout(() => {
      setExplanation({
        summary: 'This is a placeholder summary of the article. It will be replaced with AI-generated content that provides a concise overview of what the article is about.',
        why: 'This is a placeholder explanation of why this is happening. The AI will provide context and background information about the events or trends described in the article.',
        impact: 'This is a placeholder for how this affects you. The AI will explain the potential consequences and relevance of this news to the reader\'s daily life.',
        credibility: 'This is a placeholder for source credibility analysis. The AI will assess the reliability of the source and any potential biases.',
      });
      setIlluminateLoading(false);
    }, 2000);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
    setExplanation(null);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.stickyHeader}>
        <Text style={[
          styles.logo,
          { color: Colors[colorScheme].text }
        ]}>
          Lightbulb
        </Text>
        <ThemedText style={styles.subtitle}>Illuminating the news</ThemedText>
      </ThemedView>
      <FlatList
        data={news}
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
      />

      <IlluminateModal
        visible={modalVisible}
        onClose={handleCloseModal}
        title={selectedItem?.title || ''}
        loading={illuminateLoading}
        explanation={explanation}
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
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
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
});
