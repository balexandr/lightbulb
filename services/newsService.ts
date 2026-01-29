import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { CACHE_CONFIG, DEFAULT_FILTER_CONFIG, REDDIT_SUBREDDITS, RSS_FEEDS, TRUSTED_NEWS_DOMAINS } from '@/constants/newsConfig';
import { redditParser } from '@/services/parsers/redditParser';
import { rssParser } from '@/services/parsers/rssParser';
import { FilterConfig, NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
import { getCorsProxyUrl, getRequestHeaders } from '@/utils/networkUtils';

export class NewsService {
  private async fetchRSSNews(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const feedUrl = getCorsProxyUrl(feed.url);
        
        const response = await axios.get(feedUrl, {
          timeout: 15000,
          headers: getRequestHeaders(true),
        });

        const items = rssParser.parseFeed(response.data, feed);
        allItems.push(...items);
        
        logger.success(`Fetched ${items.length} items from ${feed.name}`);
      } catch (error: any) {
        logger.error(`Failed to fetch RSS feed ${feed.name}:`, error.message);
      }
    }

    return allItems;
  }

  private async fetchRedditNews(): Promise<NewsItem[]> {
    const allPosts: NewsItem[] = [];

    for (const subreddit of REDDIT_SUBREDDITS) {
      try {
        const redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
        const url = getCorsProxyUrl(redditUrl);
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: getRequestHeaders(false),
        });

        const validPosts = redditParser.filterValidPosts(
          response.data.data.children.map((child: any) => child.data)
        );

        const posts = validPosts.map(post => redditParser.parsePost(post, subreddit));
        allPosts.push(...posts);
        
        logger.success(`Fetched ${posts.length} posts from r/${subreddit}`);
      } catch (error: any) {
        logger.error(`Failed to fetch r/${subreddit}:`, error.message);
      }
    }

    return allPosts;
  }

  private deduplicatePosts(posts: NewsItem[]): NewsItem[] {
    const seen = new Map<string, NewsItem>();
    
    for (const post of posts) {
      const existing = seen.get(post.url);
      
      if (!existing) {
        // First time seeing this URL
        seen.set(post.url, post);
      } else {
        // Duplicate found - keep the one with higher score or from better source
        if (post.source.type === 'rss' && existing.source.type === 'reddit') {
          // Prefer RSS feeds over Reddit
          seen.set(post.url, post);
        } else if (post.source.type === 'reddit' && existing.source.type === 'reddit') {
          // Both Reddit - keep the one with higher score
          if ((post.score || 0) > (existing.score || 0)) {
            seen.set(post.url, post);
          }
        }
        // If existing is RSS and new is Reddit, keep existing (RSS preferred)
      }
    }
    
    const uniquePosts = Array.from(seen.values());
    const duplicateCount = posts.length - uniquePosts.length;
    
    if (duplicateCount > 0) {
      logger.info(`Removed ${duplicateCount} duplicate articles`);
    }
    
    return uniquePosts;
  }

  private filterPosts(posts: NewsItem[], config: FilterConfig = DEFAULT_FILTER_CONFIG): NewsItem[] {
    return posts.filter(post => {
      if (post.source.type === 'rss') return true;

      if (config.requireExternalLink && !post.url.startsWith('http')) {
        return false;
      }

      if (config.requireNewsDomain && post.domain) {
        const isNewsDomain = TRUSTED_NEWS_DOMAINS.some(domain => 
          post.domain?.includes(domain)
        );
        if (!isNewsDomain) return false;
      }

      const minScoreThreshold = config.minScore ?? DEFAULT_FILTER_CONFIG.minScore ?? 10;
      if (post.score !== undefined && post.score < minScoreThreshold) {
        return false;
      }

      return true;
    });
  }

  private sortPosts(posts: NewsItem[], config: FilterConfig = DEFAULT_FILTER_CONFIG): NewsItem[] {
    return posts.sort((a, b) => {
      if (config.deprioritizeOneLiners) {
        const aIsOneLiner = a.title.length < 100;
        const bIsOneLiner = b.title.length < 100;
        
        if (aIsOneLiner && !bIsOneLiner) return 1;
        if (!aIsOneLiner && bIsOneLiner) return -1;
      }

      return b.publishedAt.getTime() - a.publishedAt.getTime();
    });
  }

  async fetchAllNews(config?: FilterConfig): Promise<NewsItem[]> {
    try {
      const cached = await this.getCachedNews();
      if (cached) {
        logger.info('Using cached news data');
        return cached;
      }

      logger.info('Fetching fresh news data...');
      
      const [rssNews, redditNews] = await Promise.all([
        this.fetchRSSNews(),
        this.fetchRedditNews(),
      ]);

      const allNews = [...rssNews, ...redditNews];
      const deduplicated = this.deduplicatePosts(allNews);
      const filtered = this.filterPosts(deduplicated, config);
      const sorted = this.sortPosts(filtered, config);

      await this.cacheNews(sorted);

      logger.success(`Fetched ${sorted.length} news items (${rssNews.length} RSS, ${redditNews.length} Reddit, removed ${allNews.length - deduplicated.length} duplicates)`);
      return sorted;
    } catch (error) {
      logger.error('Error fetching news:', error);
      return [];
    }
  }

  private async getCachedNews(): Promise<NewsItem[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_CONFIG.NEWS_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > CACHE_CONFIG.NEWS_DURATION) {
        await AsyncStorage.removeItem(CACHE_CONFIG.NEWS_KEY);
        return null;
      }

      return data.map((item: any) => ({
        ...item,
        publishedAt: new Date(item.publishedAt),
      }));
    } catch (error) {
      logger.error('Error reading cache:', error);
      return null;
    }
  }

  private async cacheNews(news: NewsItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CACHE_CONFIG.NEWS_KEY,
        JSON.stringify({
          data: news,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      logger.error('Error caching news:', error);
    }
  }

  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(CACHE_CONFIG.NEWS_KEY);
    logger.info('News cache cleared');
  }
}

export const newsService = new NewsService();
