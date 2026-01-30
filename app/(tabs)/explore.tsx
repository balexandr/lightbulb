import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { preferencesService, UserPreferences } from '@/services/preferencesService';

type PoliticalStandpoint = NonNullable<UserPreferences['politicalStandpoint']>;

export default function ExploreScreen() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const colorScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const prefs = await preferencesService.getPreferences();
    setPreferences(prefs);
  };

  const handlePoliticalStandpointChange = async (standpoint: PoliticalStandpoint) => {
    const newPrefs = {
      ...preferences,
      politicalStandpoint: preferences.politicalStandpoint === standpoint ? undefined : standpoint,
    };
    setPreferences(newPrefs);
    await preferencesService.savePreferences(newPrefs);
  };

  const politicalOptions: { value: PoliticalStandpoint; label: string; description: string }[] = [
    {
      value: 'progressive',
      label: 'Progressive',
      description: 'Social justice, environmental action, structural reform',
    },
    {
      value: 'liberal',
      label: 'Liberal',
      description: 'Individual rights, social programs, regulated markets',
    },
    {
      value: 'moderate',
      label: 'Moderate',
      description: 'Balanced approach, case-by-case evaluation',
    },
    {
      value: 'conservative',
      label: 'Conservative',
      description: 'Traditional values, limited government, free markets',
    },
    {
      value: 'libertarian',
      label: 'Libertarian',
      description: 'Individual liberty, minimal government intervention',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText style={styles.subtitle}>
            Personalize how news impacts are explained to you
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Political Perspective
          </ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Get impact analysis tailored to your viewpoint while maintaining factual reporting
          </ThemedText>

          <View style={styles.optionsContainer}>
            {politicalOptions.map((option) => {
              const isSelected = preferences.politicalStandpoint === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: isSelected
                        ? Colors[colorScheme].tint
                        : colorScheme === 'dark'
                        ? '#2C2C2E'
                        : '#F2F2F7',
                      borderColor: isSelected ? Colors[colorScheme].tint : 'transparent',
                    },
                  ]}
                  onPress={() => handlePoliticalStandpointChange(option.value)}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? '#000000' : Colors[colorScheme].text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      {
                        color: isSelected
                          ? '#333333'
                          : Colors[colorScheme].text,
                        opacity: isSelected ? 1 : 0.6,
                      },
                    ]}
                  >
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {preferences.politicalStandpoint && (
            <ThemedView style={styles.infoBox}>
              <ThemedText style={styles.infoText}>
                ℹ️ Impact analysis will be tailored to a {preferences.politicalStandpoint}{' '}
                perspective while maintaining objectivity in summaries and credibility
                assessments.
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Coming Soon
          </ThemedText>
          <ThemedText style={styles.comingSoonText}>
            • Age-based relevance
            {'\n'}• Location-specific impacts
            {'\n'}• Custom interests and topics
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.7,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.9,
  },
  comingSoonText: {
    fontSize: 14,
    opacity: 0.5,
    lineHeight: 24,
  },
});
