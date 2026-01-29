import AsyncStorage from '@react-native-async-storage/async-storage';

import { CACHE_CONFIG } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
import { simpleHash } from '@/utils/textUtils';

interface CachedExplanation {
  explanation: any;
  timestamp: number;
  url: string;
}

interface CacheIndex {
  keys: string[];
  lastCleanup: number;
}

export class CacheService {
  private async getIndex(): Promise<CacheIndex> {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_CONFIG.INDEX_KEY);
      if (!indexStr) {
        return { keys: [], lastCleanup: Date.now() };
      }
      const parsed = JSON.parse(indexStr);
      // Ensure keys is always an array
      if (!parsed.keys || !Array.isArray(parsed.keys)) {
        return { keys: [], lastCleanup: Date.now() };
      }
      return parsed;
    } catch (error) {
      logger.error('Error reading cache index:', error);
      return { keys: [], lastCleanup: Date.now() };
    }
  }

  private async updateIndex(index: CacheIndex): Promise<void> {
    try {
      // Ensure keys is an array before saving
      if (!Array.isArray(index.keys)) {
        index.keys = [];
      }
      await AsyncStorage.setItem(CACHE_CONFIG.INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      logger.error('Error updating cache index:', error);
    }
  }

  private getCacheKey(item: NewsItem): string {
    const urlHash = simpleHash(item.url);
    return `${CACHE_CONFIG.EXPLANATION_PREFIX}${urlHash}`;
  }

  async getExplanation(item: NewsItem): Promise<any | null> {
    try {
      const key = this.getCacheKey(item);
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) {
        return null;
      }

      const { explanation, timestamp }: CachedExplanation = JSON.parse(cached);
      const age = Date.now() - timestamp;
      const maxAge = CACHE_CONFIG.EXPLANATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (age > maxAge) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return explanation;
    } catch (error) {
      logger.error('Error reading explanation cache:', error);
      return null;
    }
  }

  async setExplanation(item: NewsItem, explanation: any): Promise<void> {
    try {
      const key = this.getCacheKey(item);
      const cached: CachedExplanation = {
        explanation,
        timestamp: Date.now(),
        url: item.url,
      };

      await AsyncStorage.setItem(key, JSON.stringify(cached));

      const index = await this.getIndex();
      // Double-check keys is an array
      if (!Array.isArray(index.keys)) {
        index.keys = [];
      }
      if (!index.keys.includes(key)) {
        index.keys.push(key);
        await this.updateIndex(index);
      }

      logger.success('Cached explanation');
    } catch (error) {
      logger.error('Error caching explanation:', error);
    }
  }

  async getCacheStats(): Promise<{ count: number; oldestAge: number | null }> {
    try {
      const index = await this.getIndex();
      let oldestTimestamp: number | null = null;

      for (const key of index.keys || []) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (!oldestTimestamp || timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
          }
        }
      }

      const oldestAge = oldestTimestamp 
        ? Math.floor((Date.now() - oldestTimestamp) / (1000 * 60 * 60 * 24))
        : null;

      return {
        count: (index.keys || []).length,
        oldestAge,
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { count: 0, oldestAge: null };
    }
  }

  async clearExpiredCache(): Promise<void> {
    try {
      const index = await this.getIndex();
      const maxAge = CACHE_CONFIG.EXPLANATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      const validKeys: string[] = [];

      for (const key of index.keys || []) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          if (age <= maxAge) {
            validKeys.push(key);
          } else {
            await AsyncStorage.removeItem(key);
          }
        }
      }

      const removedCount = (index.keys || []).length - validKeys.length;
      index.keys = validKeys;
      index.lastCleanup = Date.now();
      await this.updateIndex(index);

      if (removedCount > 0) {
        logger.info(`Cleared ${removedCount} expired cache entries`);
      }
    } catch (error) {
      logger.error('Error clearing expired cache:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const index = await this.getIndex();
      
      for (const key of index.keys || []) {
        await AsyncStorage.removeItem(key);
      }

      await AsyncStorage.removeItem(CACHE_CONFIG.INDEX_KEY);
      logger.info('Cleared all explanation cache');
    } catch (error) {
      logger.error('Error clearing all cache:', error);
    }
  }
}

export const cacheService = new CacheService();