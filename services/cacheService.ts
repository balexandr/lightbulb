import { NewsItem } from '@/types/news';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CachedExplanation {
  summary: string;
  why: string;
  impact: string;
  credibility: string;
  timestamp: number;
  articleUrl: string;
  articleTitle: string;
}

const CACHE_PREFIX = '@lightbulb_explanation_';
const CACHE_INDEX_KEY = '@lightbulb_cache_index';
const CACHE_EXPIRY_DAYS = 7; // Explanations expire after 7 days

class CacheService {
  // Generate a unique key for each article
  private getCacheKey(item: NewsItem): string {
    // Use URL as the primary identifier
    const urlHash = this.simpleHash(item.url);
    return `${CACHE_PREFIX}${urlHash}`;
  }

  // Simple hash function for URLs
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Check if cached data is still valid
  private isExpired(timestamp: number): boolean {
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return (now - timestamp) > expiryTime;
  }

  // Save explanation to cache
  async saveExplanation(
    item: NewsItem,
    explanation: {
      summary: string;
      why: string;
      impact: string;
      credibility: string;
    }
  ): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(item);
      const cachedData: CachedExplanation = {
        ...explanation,
        timestamp: Date.now(),
        articleUrl: item.url,
        articleTitle: item.title,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData));
      
      // Update cache index
      await this.updateCacheIndex(cacheKey);
      
      console.log('✅ Cached explanation for:', item.title.substring(0, 50));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }

  // Get explanation from cache
  async getExplanation(item: NewsItem): Promise<{
    summary: string;
    why: string;
    impact: string;
    credibility: string;
  } | null> {
    try {
      const cacheKey = this.getCacheKey(item);
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) {
        console.log('❌ No cache found for:', item.title.substring(0, 50));
        return null;
      }

      const cachedData: CachedExplanation = JSON.parse(cached);

      // Check if expired
      if (this.isExpired(cachedData.timestamp)) {
        console.log('⏰ Cache expired for:', item.title.substring(0, 50));
        await AsyncStorage.removeItem(cacheKey);
        await this.removeFromCacheIndex(cacheKey);
        return null;
      }

      console.log('✅ Cache hit for:', item.title.substring(0, 50));
      return {
        summary: cachedData.summary,
        why: cachedData.why,
        impact: cachedData.impact,
        credibility: cachedData.credibility,
      };
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  // Update cache index (for management)
  private async updateCacheIndex(cacheKey: string): Promise<void> {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      const index: string[] = indexStr ? JSON.parse(indexStr) : [];
      
      if (!index.includes(cacheKey)) {
        index.push(cacheKey);
        await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
      }
    } catch (error) {
      console.error('Error updating cache index:', error);
    }
  }

  // Remove from cache index
  private async removeFromCacheIndex(cacheKey: string): Promise<void> {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (!indexStr) return;

      const index: string[] = JSON.parse(indexStr);
      const newIndex = index.filter(key => key !== cacheKey);
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(newIndex));
    } catch (error) {
      console.error('Error removing from cache index:', error);
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    totalCached: number;
    totalSize: string;
    oldestEntry?: Date;
  }> {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      const index: string[] = indexStr ? JSON.parse(indexStr) : [];
      
      let oldestTimestamp = Date.now();
      let totalSize = 0;

      for (const key of index) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length;
          const cached: CachedExplanation = JSON.parse(item);
          if (cached.timestamp < oldestTimestamp) {
            oldestTimestamp = cached.timestamp;
          }
        }
      }

      return {
        totalCached: index.length,
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
        oldestEntry: index.length > 0 ? new Date(oldestTimestamp) : undefined,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalCached: 0, totalSize: '0 KB' };
    }
  }

  // Clear all expired cache entries
  async clearExpiredCache(): Promise<number> {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (!indexStr) return 0;

      const index: string[] = JSON.parse(indexStr);
      let clearedCount = 0;

      for (const key of index) {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          const cached: CachedExplanation = JSON.parse(item);
          if (this.isExpired(cached.timestamp)) {
            await AsyncStorage.removeItem(key);
            clearedCount++;
          }
        }
      }

      // Update index
      const newIndex = [];
      for (const key of index) {
        const exists = await AsyncStorage.getItem(key);
        if (exists) {
          newIndex.push(key);
        }
      }
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(newIndex));

      console.log(`🧹 Cleared ${clearedCount} expired cache entries`);
      return clearedCount;
    } catch (error) {
      console.error('Error clearing expired cache:', error);
      return 0;
    }
  }

  // Clear all cache
  async clearAllCache(): Promise<void> {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (!indexStr) return;

      const index: string[] = JSON.parse(indexStr);
      
      for (const key of index) {
        await AsyncStorage.removeItem(key);
      }

      await AsyncStorage.removeItem(CACHE_INDEX_KEY);
      console.log('🧹 Cleared all cache');
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }
}

export const cacheService = new CacheService();