import { Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { NewsItem } from '@/types/news';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface CoverageComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  mainItem: NewsItem | null;
  relatedItems: NewsItem[];
  onOpenArticle: (url: string) => void;
}

// §16.3 #1 - the guide's highest-leverage feature: shows how other outlets
// covered the same story, side by side. Deliberately no AI/personalization
// involved (see docs/TECHNICAL_GUIDE.md §16.1) - pure display of articles
// already fetched, clustered by utils/storyClustering.ts.
export function CoverageComparisonModal({ visible, onClose, mainItem, relatedItems, onOpenArticle }: CoverageComparisonModalProps) {
  const colorScheme = useColorScheme() ?? 'light';

  if (!mainItem) {
    return null;
  }

  const allItems = [mainItem, ...relatedItems];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>🔀 Coverage Comparison</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeButtonText}>✕</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <ThemedText style={styles.intro}>
            {allItems.length} outlets are covering a story like this one. Here&apos;s how each one framed it.
          </ThemedText>

          {allItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { borderColor: colorScheme === 'dark' ? '#333' : '#e5e5e5' }]}
              onPress={() => onOpenArticle(item.url)}
            >
              <View style={styles.cardSource}>
                {item.source.icon && (
                  <Image source={{ uri: item.source.icon }} style={styles.sourceIcon} />
                )}
                <ThemedText style={styles.sourceName}>{item.source.name}</ThemedText>
              </View>
              <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                {item.title}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  headerTitle: {
    fontSize: 22,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  intro: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardSource: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
    borderRadius: 2,
  },
  sourceName: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
