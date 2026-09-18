import AsyncStorage from '@react-native-async-storage/async-storage';

import { CACHE_CONFIG } from '@/constants/newsConfig';
import { PreferenceBucket } from '@/services/preferencesService';
import { FactLayer, NewsItem, RelevanceLayer } from '@/types/news';
import { logger } from '@/utils/logger';
import { simpleHash } from '@/utils/textUtils';

interface CachedFact {
  fact: FactLayer;
  timestamp: number;
  url: string;
}

interface CachedRelevance {
  relevance: RelevanceLayer;
  timestamp: number;
  url: string;
}

interface CacheIndex {
  keys: string[];
  lastCleanup: number;
}

export interface CachedExplanationLookup {
  fact: FactLayer | null;
  relevance: RelevanceLayer | null;
}

const MAX_AGE_MS = CACHE_CONFIG.EXPLANATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

function bucketCacheSegment(bucket: PreferenceBucket): string {
  return simpleHash(`${bucket.age}|${bucket.stance}|${bucket.region}`).toString();
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

  private async addToIndex(key: string): Promise<void> {
    const index = await this.getIndex();
    if (!Array.isArray(index.keys)) {
      index.keys = [];
    }
    if (!index.keys.includes(key)) {
      index.keys.push(key);
      await this.updateIndex(index);
    }
  }

  private getFactCacheKey(item: NewsItem): string {
    return `${CACHE_CONFIG.FACT_PREFIX}${simpleHash(item.url)}`;
  }

  private getRelevanceCacheKey(item: NewsItem, bucket: PreferenceBucket): string {
    return `${CACHE_CONFIG.RELEVANCE_PREFIX}${simpleHash(item.url)}_${bucketCacheSegment(bucket)}`;
  }

  async getFact(item: NewsItem): Promise<FactLayer | null> {
    try {
      const key = this.getFactCacheKey(item);
      const cached = await AsyncStorage.getItem(key);
      if (!cached) {
        return null;
      }

      const { fact, timestamp, url }: CachedFact = JSON.parse(cached);

      // simpleHash is a 32-bit hash, so two different URLs can collide on
      // the same cache key. Without this check a collision would silently
      // return the wrong article's fact layer.
      if (url !== item.url) {
        return null;
      }

      if (Date.now() - timestamp > MAX_AGE_MS) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return fact;
    } catch (error) {
      logger.error('Error reading fact cache:', error);
      return null;
    }
  }

  async setFact(item: NewsItem, fact: FactLayer): Promise<void> {
    try {
      const key = this.getFactCacheKey(item);
      const cached: CachedFact = { fact, timestamp: Date.now(), url: item.url };
      await AsyncStorage.setItem(key, JSON.stringify(cached));
      await this.addToIndex(key);
      logger.success('Cached fact layer');
    } catch (error) {
      logger.error('Error caching fact layer:', error);
    }
  }

  async getRelevance(item: NewsItem, bucket: PreferenceBucket): Promise<RelevanceLayer | null> {
    try {
      const key = this.getRelevanceCacheKey(item, bucket);
      const cached = await AsyncStorage.getItem(key);
      if (!cached) {
        return null;
      }

      const { relevance, timestamp, url }: CachedRelevance = JSON.parse(cached);

      if (url !== item.url) {
        return null;
      }

      if (Date.now() - timestamp > MAX_AGE_MS) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return relevance;
    } catch (error) {
      logger.error('Error reading relevance cache:', error);
      return null;
    }
  }

  async setRelevance(item: NewsItem, bucket: PreferenceBucket, relevance: RelevanceLayer): Promise<void> {
    try {
      const key = this.getRelevanceCacheKey(item, bucket);
      const cached: CachedRelevance = { relevance, timestamp: Date.now(), url: item.url };
      await AsyncStorage.setItem(key, JSON.stringify(cached));
      await this.addToIndex(key);
      logger.success('Cached relevance layer');
    } catch (error) {
      logger.error('Error caching relevance layer:', error);
    }
  }

  // Independent lookups so a caller can request only whichever layer(s)
  // are actually missing (§15.4), instead of always regenerating both.
  async getExplanation(item: NewsItem, bucket: PreferenceBucket): Promise<CachedExplanationLookup> {
    const [fact, relevance] = await Promise.all([this.getFact(item), this.getRelevance(item, bucket)]);
    return { fact, relevance };
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
      const validKeys: string[] = [];

      for (const key of index.keys || []) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          if (age <= MAX_AGE_MS) {
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
