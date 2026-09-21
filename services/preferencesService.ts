import AsyncStorage from '@react-native-async-storage/async-storage';

import { Region } from '@/constants/newsConfig';
import { logger } from '@/utils/logger';

export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';

export interface UserPreferences {
  politicalStandpoint?: 'progressive' | 'liberal' | 'moderate' | 'conservative' | 'libertarian';
  ageRange?: AgeRange;
  gender?: string;
  // A coarse region, not a precise location - never city/zip (§12.4). §17.4
  // is the first consumer (surfacing a "Local News" section for
  // 'philadelphia'), but any region-tailored feature can read this.
  location?: Region;
}

// A small fixed set unrelated users share cache entries across (see
// docs/TECHNICAL_GUIDE.md §14.3) - never the raw preference values.
export type AgeBucket = AgeRange | 'unspecified';
export type StanceBucket = NonNullable<UserPreferences['politicalStandpoint']> | 'unspecified';
export type RegionBucket = Region | 'unspecified';

export interface PreferenceBucket {
  age: AgeBucket;
  stance: StanceBucket;
  region: RegionBucket;
}

const PREFERENCES_KEY = '@lightbulb_user_preferences';

class PreferencesService {
  async getPreferences(): Promise<UserPreferences> {
    try {
      const stored = await AsyncStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return {};
    } catch (error) {
      logger.error('Error loading preferences:', error);
      return {};
    }
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      logger.success('Preferences saved');
    } catch (error) {
      logger.error('Error saving preferences:', error);
    }
  }

  async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    const current = await this.getPreferences();
    current[key] = value;
    await this.savePreferences(current);
  }

  async clearPreferences(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFERENCES_KEY);
      logger.info('Preferences cleared');
    } catch (error) {
      logger.error('Error clearing preferences:', error);
    }
  }

  // Reduces raw stored preferences to the fixed bucket set used for cache
  // keys and the Illuminate API request - the UI still shows/edits the raw
  // values (§15.2), bucketing only happens at the point of use.
  getPreferenceBucket(preferences: UserPreferences): PreferenceBucket {
    return {
      age: preferences.ageRange ?? 'unspecified',
      stance: preferences.politicalStandpoint ?? 'unspecified',
      region: preferences.location ?? 'unspecified',
    };
  }
}

export const preferencesService = new PreferencesService();