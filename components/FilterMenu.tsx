import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

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
            {rssSources.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                    📰 News Outlets
                  </ThemedText>
                </View>
                {rssSources.map(source => (
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
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sourceName: {
    fontSize: 15,
  },
  applyButton: {
    margin: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F59E0B',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});