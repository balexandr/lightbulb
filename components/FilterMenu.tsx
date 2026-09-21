import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OutletType, RSS_FEEDS, SourceTrustInfo } from '@/constants/newsConfig';
import { AccentColor, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const REGION_LABELS: Record<string, string> = {
  philadelphia: 'Philadelphia, PA',
};

const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  'public-broadcaster': 'Public broadcaster',
  'newspaper': 'Newspaper',
  'digital-native': 'Digital-native outlet',
  'link-aggregator': 'Link aggregator',
};

// §17.2: three factual signals, not a rolled-up score - see
// constants/newsConfig.ts for why and the per-source data.
function describeTrust(trust: SourceTrustInfo): string {
  if (trust.outletType === 'link-aggregator') {
    return `${OUTLET_TYPE_LABELS[trust.outletType]} · aggregates links, no editorial process of its own`;
  }

  const parts = [OUTLET_TYPE_LABELS[trust.outletType]];
  parts.push(trust.hasCorrectionsPolicy ? 'corrections policy' : 'no published corrections policy');
  parts.push(trust.bylineTransparency ? 'bylined' : 'not consistently bylined');
  return parts.join(' · ');
}

interface FilterMenuProps {
  visible: boolean;
  onClose: () => void;
  rssSources: string[];
  redditSources: string[];
  selectedSources: Set<string>;
  onToggleSource: (source: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function FilterMenu({
  visible,
  onClose,
  rssSources,
  redditSources,
  selectedSources,
  onToggleSource,
  onSelectAll,
  onClearAll,
}: FilterMenuProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  // §17.4: sources tagged with a localRegion get their own section instead
  // of blending into the national outlet list.
  const localSources = rssSources.filter(source => RSS_FEEDS.find(feed => feed.name === source)?.localRegion);
  const nationalSources = rssSources.filter(source => !RSS_FEEDS.find(feed => feed.name === source)?.localRegion);

  const renderSourceRow = (source: string) => {
    const trust = RSS_FEEDS.find(feed => feed.name === source)?.trust;
    return (
      <TouchableOpacity
        key={source}
        style={styles.sourceItem}
        onPress={() => onToggleSource(source)}
      >
        <View style={[
          styles.checkbox,
          selectedSources.has(source) && styles.checkboxSelected,
          { borderColor: isDark ? '#666' : '#ccc' }
        ]}>
          {selectedSources.has(source) && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
        <View style={styles.sourceTextContainer}>
          <ThemedText style={styles.sourceName}>{source}</ThemedText>
          {trust && (
            <ThemedText style={styles.sourceTrust}>{describeTrust(trust)}</ThemedText>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.clickableOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
        <ThemedView style={styles.modalContent}>
          <View style={styles.header}>
            <ThemedText type="title">Filter Sources</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: Colors[colorScheme].text }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.selectAllButton]}
              onPress={onSelectAll}
            >
              <Text style={styles.selectAllButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.clearAllButton]}
              onPress={onClearAll}
            >
              <Text style={styles.clearAllButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            {localSources.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    📍 Local News
                  </ThemedText>
                </View>
                <ThemedText style={styles.methodologyNote}>
                  Hyperlocal coverage for readers in that area - set your region in Preferences to
                  have it show up in your feed by default.
                </ThemedText>
                {localSources.map(source => {
                  const region = RSS_FEEDS.find(feed => feed.name === source)?.localRegion;
                  return (
                    <View key={source}>
                      {renderSourceRow(source)}
                      {region && (
                        <ThemedText style={styles.localRegionTag}>{REGION_LABELS[region] ?? region}</ThemedText>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {nationalSources.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    📰 News Outlets
                  </ThemedText>
                </View>
                <ThemedText style={styles.methodologyNote}>
                  We show a few factual signals per source below, not a single trust score.
                </ThemedText>
                {nationalSources.map(renderSourceRow)}
              </View>
            )}

            {redditSources.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleContainer}>
                  <Image 
                    source={{ uri: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png' }} 
                    style={styles.sectionIcon}
                  />
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    Reddit Communities
                  </ThemedText>
                </View>
                {redditSources.map(source => (
                  <TouchableOpacity
                    key={source}
                    style={styles.sourceItem}
                    onPress={() => onToggleSource(source)}
                  >
                    <View style={[
                      styles.checkbox,
                      selectedSources.has(source) && styles.checkboxSelected,
                      { borderColor: isDark ? '#666' : '#ccc' }
                    ]}>
                      {selectedSources.has(source) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <ThemedText style={styles.sourceName}>{source}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={onClose}
          >
            <Text style={styles.applyButtonText}>Apply Filter</Text>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  clickableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectAllButton: {
    backgroundColor: AccentColor,
  },
  selectAllButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  clearAllButton: {
    backgroundColor: '#6B7280',
  },
  clearAllButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: AccentColor,
    borderColor: AccentColor,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sourceTextContainer: {
    flex: 1,
  },
  sourceName: {
    fontSize: 15,
  },
  sourceTrust: {
    fontSize: 11,
    opacity: 0.55,
    marginTop: 2,
  },
  methodologyNote: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 12,
    lineHeight: 16,
  },
  localRegionTag: {
    fontSize: 11,
    opacity: 0.6,
    marginLeft: 44,
    marginTop: -8,
    marginBottom: 8,
  },
  applyButton: {
    margin: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: AccentColor,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});