import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';

export interface UserPreferences {
  politicalStandpoint?: 'progressive' | 'liberal' | 'moderate' | 'conservative' | 'libertarian';
  ageRange?: AgeRange;
  gender?: string;
  location?: string;
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
}

export const preferencesService = new PreferencesService();