import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PreferenceBucket } from '@/services/preferencesService';
import { AIExplanation } from '@/types/news';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface IlluminateModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  fromCache?: boolean;
  explanation?: AIExplanation;
  bucket?: PreferenceBucket;
}

// §17.6 "show your work" - names which bucket values actually shaped the
// "Why Is This Happening?"/"How Does This Affect You?" sections, sourced
// directly from the same PreferenceBucket used as the cache key (§15.3).
// If this ever reads like it's nudging an opinion rather than naming
// inputs, that's a signal the underlying prompt has drifted (§14.6).
function describeBucket(bucket: PreferenceBucket): string {
  const parts: string[] = [];
  if (bucket.age !== 'unspecified') parts.push(`age ${bucket.age}`);
  if (bucket.stance !== 'unspecified') parts.push(`${bucket.stance}-leaning`);
  if (bucket.region !== 'unspecified') parts.push(bucket.region);

  if (parts.length === 0) {
    return 'Shown because: no preferences are set, so this is a general, audience-agnostic explanation.';
  }
  return `Shown because: ${parts.join(', ')}.`;
}

export function IlluminateModal({ visible, onClose, title, loading, fromCache, explanation, bucket }: IlluminateModalProps) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>💡 Illuminate</ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ThemedText style={styles.closeButtonText}>✕</ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <ThemedText type="subtitle" style={styles.articleTitle} numberOfLines={4}>
            {title}
          </ThemedText>

          {fromCache && !loading && (
            <View style={styles.cacheBadge}>
              <ThemedText style={styles.cacheText}>💾 Cached explanation</ThemedText>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
              <ThemedText style={styles.loadingText}>Illuminating this story...</ThemedText>
            </View>
          ) : explanation ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>📝 What&apos;s This About?</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.summary}</ThemedText>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>🤔 Why Is This Happening?</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.why}</ThemedText>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>🎯 How Does This Affect You?</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.impact}</ThemedText>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>✓ Source Credibility</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.credibility}</ThemedText>
              </View>

              <View style={styles.transparencyBox}>
                <ThemedText style={styles.transparencyTitle}>🔍 Show your work</ThemedText>
                {bucket && (
                  <ThemedText style={styles.transparencyText}>{describeBucket(bucket)}</ThemedText>
                )}
                <ThemedText style={styles.transparencyText}>
                  We send Claude this headline, its source, and — only if you&apos;ve set them — your general age
                  range and political leaning. Never your exact age, name, or location.
                </ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>Unable to generate explanation. Please try again.</ThemedText>
            </View>
          )}
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
    fontSize: 24,
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
  articleTitle: {
    fontSize: 18,
    marginBottom: 12,
    lineHeight: 26,
  },
  cacheBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  cacheText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.85,
  },
  transparencyBox: {
    marginBottom: 24,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    gap: 6,
  },
  transparencyTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  transparencyText: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.6,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.6,
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    opacity: 0.6,
    textAlign: 'center',
  },
});
