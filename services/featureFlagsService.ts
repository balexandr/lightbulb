import AsyncStorage from '@react-native-async-storage/async-storage';

import { CACHE_CONFIG } from '@/constants/newsConfig';
import { DEFAULT_FEATURE_FLAGS, FeatureFlags } from '@/types/featureFlags';
import { logger } from '@/utils/logger';
import { getApiBaseUrl } from '@/utils/networkUtils';

interface CachedFlags {
  flags: FeatureFlags;
  timestamp: number;
}

export class FeatureFlagsService {
  async getFlags(): Promise<FeatureFlags> {
    const cached = await this.getCachedFlags();
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/flags`);
      if (!response.ok) {
        throw new Error(`Flags request failed (${response.status})`);
      }

      // Merge over defaults so a client ahead of the server (a flag the
      // server doesn't know about yet) still gets a safe default for it.
      const flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...(await response.json()) };
      await this.cacheFlags(flags);
      return flags;
    } catch (error: any) {
      logger.info('Falling back to default feature flags:', error.message);
      return DEFAULT_FEATURE_FLAGS;
    }
  }

  private async getCachedFlags(): Promise<FeatureFlags | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_CONFIG.FLAGS_KEY);
      if (!cached) {
        return null;
      }

      const { flags, timestamp }: CachedFlags = JSON.parse(cached);
      const age = Date.now() - timestamp;
      if (age > CACHE_CONFIG.FLAGS_DURATION) {
        return null;
      }

      return flags;
    } catch (error) {
      logger.error('Error reading cached feature flags:', error);
      return null;
    }
  }

  private async cacheFlags(flags: FeatureFlags): Promise<void> {
    try {
      const cached: CachedFlags = { flags, timestamp: Date.now() };
      await AsyncStorage.setItem(CACHE_CONFIG.FLAGS_KEY, JSON.stringify(cached));
    } catch (error) {
      logger.error('Error caching feature flags:', error);
    }
  }
}

export const featureFlagsService = new FeatureFlagsService();
