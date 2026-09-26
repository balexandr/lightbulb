import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FlagReason } from '@/services/flagService';
import { PreferenceBucket } from '@/services/preferencesService';
import { AIExplanation } from '@/types/news';
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
  onFlag?: (flaggedField: FlagReason, freeText?: string) => Promise<void>;
}

const FLAG_OPTIONS: { reason: FlagReason; label: string }[] = [
  { reason: 'wrong', label: 'Wrong' },
  { reason: 'off', label: 'Off' },
  { reason: 'too_persuasive', label: 'Too persuasive' },
];

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
  if (bucket.gender !== 'unspecified') parts.push(bucket.gender);

  if (parts.length === 0) {
    return 'Shown because: no preferences are set, so this is a general, audience-agnostic explanation.';
  }
  return `Shown because: ${parts.join(', ')}.`;
}

export function IlluminateModal({ visible, onClose, title, loading, fromCache, explanation, bucket, onFlag }: IlluminateModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<FlagReason | null>(null);
  const [flagText, setFlagText] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSubmitted, setFlagSubmitted] = useState(false);

  // A fresh flagging draft for each modal open, rather than leaking one
  // article's in-progress flag into the next.
  useEffect(() => {
    if (visible) {
      setFlagOpen(false);
      setFlagReason(null);
      setFlagText('');
      setFlagSubmitting(false);
      setFlagSubmitted(false);
    }
  }, [visible, title]);

  const handleFlagSubmit = async () => {
    if (!flagReason || !onFlag) return;
    setFlagSubmitting(true);
    try {
      await onFlag(flagReason, flagText.trim() || undefined);
      setFlagSubmitted(true);
      setFlagOpen(false);
    } catch {
      // Best-effort - a failed flag submission shouldn't block reading.
    } finally {
      setFlagSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialIcons name="lightbulb" size={22} color={Colors[colorScheme].text} />
            <ThemedText type="title" style={styles.headerTitle}>Illuminate</ThemedText>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={Colors[colorScheme].text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <ThemedText type="subtitle" style={styles.articleTitle} numberOfLines={4}>
            {title}
          </ThemedText>

          {fromCache && !loading && (
            <View style={[styles.cacheBadge, styles.rowWithGap]}>
              <MaterialIcons name="cached" size={14} color="#4CAF50" />
              <ThemedText style={styles.cacheText}>Cached explanation</ThemedText>
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
                <View style={[styles.sectionHeader, styles.rowWithGap]}>
                  <MaterialIcons name="description" size={16} color={Colors[colorScheme].text} />
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>What&apos;s This About?</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.summary}</ThemedText>
              </View>

              <View style={styles.section}>
                <View style={[styles.sectionHeader, styles.rowWithGap]}>
                  <MaterialIcons name="psychology" size={16} color={Colors[colorScheme].text} />
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Why Is This Happening?</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.why}</ThemedText>
              </View>

              <View style={styles.section}>
                <View style={[styles.sectionHeader, styles.rowWithGap]}>
                  <MaterialIcons name="gps-fixed" size={16} color={Colors[colorScheme].text} />
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>How Does This Affect You?</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.impact}</ThemedText>
              </View>

              <View style={styles.section}>
                <View style={[styles.sectionHeader, styles.rowWithGap]}>
                  <MaterialIcons name="verified" size={16} color={Colors[colorScheme].text} />
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Source Credibility</ThemedText>
                </View>
                <ThemedText style={styles.sectionContent}>{explanation.credibility}</ThemedText>
              </View>

              <View style={styles.transparencyBox}>
                <View style={styles.rowWithGap}>
                  <MaterialIcons name="visibility" size={14} color={Colors[colorScheme].text} />
                  <ThemedText style={styles.transparencyTitle}>Show your work</ThemedText>
                </View>
                {bucket && (
                  <ThemedText style={styles.transparencyText}>{describeBucket(bucket)}</ThemedText>
                )}
                <ThemedText style={styles.transparencyText}>
                  We send Claude this headline, its source, and — only if you&apos;ve set them — your general age
                  range and political leaning. Never your exact age, name, or location.
                </ThemedText>
              </View>

              {onFlag && (
                <View style={styles.flagSection}>
                  {flagSubmitted ? (
                    <ThemedText style={styles.flagSubmittedText}>Thanks — this has been flagged.</ThemedText>
                  ) : flagOpen ? (
                    <View style={styles.flagPanel}>
                      <ThemedText style={styles.flagPanelTitle}>What&apos;s wrong with this explanation?</ThemedText>
                      <View style={styles.flagOptionsRow}>
                        {FLAG_OPTIONS.map(option => (
                          <TouchableOpacity
                            key={option.reason}
                            style={[styles.flagOption, flagReason === option.reason && styles.flagOptionSelected]}
                            onPress={() => setFlagReason(option.reason)}
                          >
                            <ThemedText
                              style={[styles.flagOptionText, flagReason === option.reason && styles.flagOptionTextSelected]}
                            >
                              {option.label}
                            </ThemedText>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={[styles.flagInput, { color: Colors[colorScheme].text }]}
                        placeholder="Add details (optional)"
                        placeholderTextColor="rgba(128, 128, 128, 0.6)"
                        value={flagText}
                        onChangeText={setFlagText}
                        multiline
                      />
                      <TouchableOpacity
                        style={[styles.flagSubmitButton, (!flagReason || flagSubmitting) && styles.flagSubmitButtonDisabled]}
                        onPress={handleFlagSubmit}
                        disabled={!flagReason || flagSubmitting}
                      >
                        <ThemedText style={styles.flagSubmitButtonText}>
                          {flagSubmitting ? 'Submitting...' : 'Submit flag'}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setFlagOpen(true)} style={styles.rowWithGap}>
                      <MaterialIcons name="flag" size={14} color={Colors[colorScheme].text} style={{ opacity: 0.5 }} />
                      <ThemedText style={styles.flagToggleText}>Flag this explanation</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
  },
  closeButton: {
    padding: 8,
  },
  rowWithGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  flagSection: {
    marginBottom: 24,
  },
  flagToggleText: {
    fontSize: 13,
    opacity: 0.5,
  },
  flagSubmittedText: {
    fontSize: 13,
    opacity: 0.6,
  },
  flagPanel: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    gap: 10,
  },
  flagPanelTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
  },
  flagOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  flagOptionSelected: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },
  flagOptionText: {
    fontSize: 13,
    opacity: 0.8,
  },
  flagOptionTextSelected: {
    color: '#fff',
    opacity: 1,
  },
  flagInput: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 44,
  },
  flagSubmitButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
  },
  flagSubmitButtonDisabled: {
    opacity: 0.5,
  },
  flagSubmitButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
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
