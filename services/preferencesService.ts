import AsyncStorage from '@react-native-async-storage/async-storage';

import { Region } from '@/constants/newsConfig';
import { logger } from '@/utils/logger';

export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';

// Kept as a small fixed set, same reasoning as political stance/age (§14.3)
// - and deliberately not free text, so it can only ever widen the "why
// this matters to you" framing (§14.5), never become a place for a reader
// to write in anything unbounded. "Prefer not to say" isn't its own stored
// value - it maps to leaving this field unset, same pattern as every other
// preference here (see the UI's toggle-off behavior in explore.tsx).
export type GenderIdentity = 'woman' | 'man' | 'non-binary';

export interface UserPreferences {
  politicalStandpoint?: 'progressive' | 'liberal' | 'moderate' | 'conservative' | 'libertarian';
  ageRange?: AgeRange;
  gender?: GenderIdentity;
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
export type GenderBucket = GenderIdentity | 'unspecified';

export interface PreferenceBucket {
  age: AgeBucket;
  stance: StanceBucket;
  region: RegionBucket;
  gender: GenderBucket;
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
      gender: preferences.gender ?? 'unspecified',
    };
  }
}

export const preferencesService = new PreferencesService();