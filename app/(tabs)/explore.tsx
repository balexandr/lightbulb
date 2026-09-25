import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Region } from '@/constants/newsConfig';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { crossLeanService } from '@/services/crossLeanService';
import { AgeRange, GenderIdentity, preferencesService, UserPreferences } from '@/services/preferencesService';

type PoliticalStandpoint = NonNullable<UserPreferences['politicalStandpoint']>;

export default function ExploreScreen() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [crossLeanCount, setCrossLeanCount] = useState(0);
  const colorScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    loadPreferences();
    crossLeanService.getMonthlyCount().then(setCrossLeanCount);
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

  const handleAgeRangeChange = async (ageRange: AgeRange) => {
    const newPrefs = {
      ...preferences,
      ageRange: preferences.ageRange === ageRange ? undefined : ageRange,
    };
    setPreferences(newPrefs);
    await preferencesService.savePreferences(newPrefs);
  };

  const handleLocationChange = async (location: Region) => {
    const newPrefs = {
      ...preferences,
      location: preferences.location === location ? undefined : location,
    };
    setPreferences(newPrefs);
    await preferencesService.savePreferences(newPrefs);
  };

  const handleGenderChange = async (gender: GenderIdentity) => {
    const newPrefs = {
      ...preferences,
      gender: preferences.gender === gender ? undefined : gender,
    };
    setPreferences(newPrefs);
    await preferencesService.savePreferences(newPrefs);
  };

  // "Prefer not to say" isn't a stored value of its own (see
  // preferencesService.ts) - it just clears the field, same end state as
  // never having set it. Always tappable, never shown as "selected."
  const handleClearGender = async () => {
    const newPrefs = { ...preferences, gender: undefined };
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

  const ageRangeOptions: AgeRange[] = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

  const genderOptions: { value: GenderIdentity; label: string }[] = [
    { value: 'woman', label: 'Woman' },
    { value: 'man', label: 'Man' },
    { value: 'non-binary', label: 'Non-binary' },
  ];

  const locationOptions: { value: Region; label: string }[] = [
    { value: 'philadelphia', label: 'Philadelphia, PA' },
    { value: 'new-york', label: 'New York City' },
    { value: 'northeast', label: 'Northeast (other)' },
    { value: 'chicago', label: 'Chicago' },
    { value: 'midwest', label: 'Midwest (other)' },
    { value: 'washington-dc', label: 'Washington, D.C.' },
    { value: 'south', label: 'South (other)' },
    { value: 'los-angeles', label: 'Los Angeles' },
    { value: 'bay-area', label: 'Bay Area' },
    { value: 'west', label: 'West (other)' },
    { value: 'outside-us', label: 'Outside the U.S.' },
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
          <ThemedView style={styles.dataUseBox}>
            <ThemedText style={styles.dataUseText}>
              🔒 Nothing below is ever sold or shared with advertisers. These preferences stay
              on this device, and only a broad, bucketed version (never your exact answers) is
              sent to our AI provider when you request a summary — used for that one purpose,
              nothing else. See the Privacy Policy in the Legal section below for details.
            </ThemedText>
          </ThemedView>
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
                        color: isSelected ? '#333333' : Colors[colorScheme].text,
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

          {preferences.politicalStandpoint && (
            <ThemedView style={styles.crossLeanBox}>
              <ThemedText style={styles.crossLeanText}>
                {crossLeanCount === 0
                  ? "You haven't read from a differently-leaning source this month."
                  : `You've read from ${crossLeanCount} differently-leaning ${crossLeanCount === 1 ? 'source' : 'sources'} this month.`}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Age Range
          </ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Helps provide age-appropriate context and relevance
          </ThemedText>

          <View style={styles.ageRangeContainer}>
            {ageRangeOptions.map((range) => {
              const isSelected = preferences.ageRange === range;
              return (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.ageRangeButton,
                    {
                      backgroundColor: isSelected
                        ? Colors[colorScheme].tint
                        : colorScheme === 'dark'
                        ? '#2C2C2E'
                        : '#F2F2F7',
                      borderColor: isSelected ? Colors[colorScheme].tint : 'transparent',
                    },
                  ]}
                  onPress={() => handleAgeRangeChange(range)}
                >
                  <Text
                    style={[
                      styles.ageRangeText,
                      { color: isSelected ? '#000000' : Colors[colorScheme].text },
                    ]}
                  >
                    {range}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Gender
          </ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Optional - helps tailor relevance for stories where it matters. Never assumed if
            left blank.
          </ThemedText>

          <View style={styles.ageRangeContainer}>
            {genderOptions.map((option) => {
              const isSelected = preferences.gender === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.ageRangeButton,
                    {
                      backgroundColor: isSelected
                        ? Colors[colorScheme].tint
                        : colorScheme === 'dark'
                        ? '#2C2C2E'
                        : '#F2F2F7',
                      borderColor: isSelected ? Colors[colorScheme].tint : 'transparent',
                    },
                  ]}
                  onPress={() => handleGenderChange(option.value)}
                >
                  <Text
                    style={[
                      styles.ageRangeText,
                      { color: isSelected ? '#000000' : Colors[colorScheme].text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.ageRangeButton,
                {
                  backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7',
                  borderColor: 'transparent',
                },
              ]}
              onPress={handleClearGender}
            >
              <Text style={[styles.ageRangeText, { color: Colors[colorScheme].text }]}>
                Prefer not to say
              </Text>
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Location
          </ThemedText>
          <ThemedText style={styles.sectionDescription}>
            A general region, not your exact location - used for relevance and, where available,
            local news (currently Philadelphia, New York City, Chicago, Washington D.C., Los
            Angeles, and the Bay Area)
          </ThemedText>

          <View style={styles.ageRangeContainer}>
            {locationOptions.map((option) => {
              const isSelected = preferences.location === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.ageRangeButton,
                    {
                      backgroundColor: isSelected
                        ? Colors[colorScheme].tint
                        : colorScheme === 'dark'
                        ? '#2C2C2E'
                        : '#F2F2F7',
                      borderColor: isSelected ? Colors[colorScheme].tint : 'transparent',
                    },
                  ]}
                  onPress={() => handleLocationChange(option.value)}
                >
                  <Text
                    style={[
                      styles.ageRangeText,
                      { color: isSelected ? '#000000' : Colors[colorScheme].text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Coming Soon
          </ThemedText>
          <ThemedText style={styles.comingSoonText}>
            • Custom interests and topics
            {'\n'}• More hyperlocal city coverage
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Legal
          </ThemedText>
          <Link href="/privacy" style={styles.legalLink}>
            <ThemedText style={styles.legalLinkText}>Privacy Policy</ThemedText>
          </Link>
          <Link href="/terms" style={styles.legalLink}>
            <ThemedText style={styles.legalLinkText}>Terms of Service</ThemedText>
          </Link>
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
  ageRangeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ageRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    minWidth: 90,
    alignItems: 'center',
  },
  ageRangeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dataUseBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  dataUseText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.9,
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
  crossLeanBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
  },
  crossLeanText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.7,
  },
  comingSoonText: {
    fontSize: 14,
    opacity: 0.5,
    lineHeight: 24,
  },
  legalLink: {
    paddingVertical: 12,
  },
  legalLinkText: {
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
