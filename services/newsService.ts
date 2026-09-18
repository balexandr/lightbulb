import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { CACHE_CONFIG, DEFAULT_FILTER_CONFIG, REDDIT_ENABLED, REDDIT_SUBREDDITS, RSS_FEEDS, RSSFeedConfig, TRUSTED_NEWS_DOMAINS } from '@/constants/newsConfig';
import { redditParser, RedditPostRaw } from '@/services/parsers/redditParser';
import { rssParser } from '@/services/parsers/rssParser';
import { FilterConfig, NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
import { getCorsProxyUrl, getRequestHeaders } from '@/utils/networkUtils';

export function deduplicatePosts(posts: NewsItem[]): NewsItem[] {
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

export function filterPosts(posts: NewsItem[], config: FilterConfig = DEFAULT_FILTER_CONFIG): NewsItem[] {
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

export function sortPosts(posts: NewsItem[], config: FilterConfig = DEFAULT_FILTER_CONFIG): NewsItem[] {
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

export class NewsService {
  private async fetchSingleRSSFeed(feed: RSSFeedConfig): Promise<NewsItem[]> {
    const feedUrl = getCorsProxyUrl(feed.url);

    const response = await axios.get(feedUrl, {
      timeout: 15000,
      headers: getRequestHeaders(true),
    });

    const items = rssParser.parseFeed(response.data, feed);

    // Resolve OG images for items that had no image in the RSS XML
    const itemsWithoutImages = items.filter(item => !item.imageUrl);
    if (itemsWithoutImages.length > 0) {
      logger.info(`Resolving OG images for ${itemsWithoutImages.length} ${feed.name} articles`);
      await this.resolveArticleImages(itemsWithoutImages);

      // Apply favicon fallback for any still unresolved
      const fallback = rssParser.getLargeFavicon(feed);
      for (const item of itemsWithoutImages) {
        if (!item.imageUrl) {
          item.imageUrl = fallback;
        }
      }
    }

    logger.success(`Fetched ${items.length} items from ${feed.name}`);
    return items;
  }

  private async fetchRSSNews(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
      RSS_FEEDS.map(feed => this.fetchSingleRSSFeed(feed))
    );

    const allItems: NewsItem[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      } else {
        logger.error(`Failed to fetch RSS feed ${RSS_FEEDS[index].name}:`, result.reason?.message ?? result.reason);
      }
    });

    return allItems;
  }

  private async fetchSingleSubreddit(subreddit: typeof REDDIT_SUBREDDITS[number]): Promise<NewsItem[]> {
    const redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
    const url = getCorsProxyUrl(redditUrl);

    const response = await axios.get(url, {
      timeout: 10000,
      headers: getRequestHeaders(false),
    });

    const validPosts = redditParser.filterValidPosts(
      response.data.data.children.map((child: { data: RedditPostRaw }) => child.data)
    );

    const posts = validPosts.map(post => redditParser.parsePost(post, subreddit));
    logger.success(`Fetched ${posts.length} posts from r/${subreddit}`);
    return posts;
  }

  private async fetchRedditNews(): Promise<NewsItem[]> {
    if (!REDDIT_ENABLED) {
      return [];
    }

    const results = await Promise.allSettled(
      REDDIT_SUBREDDITS.map(subreddit => this.fetchSingleSubreddit(subreddit))
    );

    const allPosts: NewsItem[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allPosts.push(...result.value);
      } else {
        logger.error(`Failed to fetch r/${REDDIT_SUBREDDITS[index]}:`, result.reason?.message ?? result.reason);
      }
    });

    return allPosts;
  }

  private async resolveArticleImages(items: NewsItem[]): Promise<void> {
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const ogImage = await this.fetchOgImage(item.url);
        if (ogImage) {
          item.imageUrl = ogImage;
        }
      })
    );

    const resolved = results.filter(r => r.status === 'fulfilled').length;
    logger.debug('OG image resolution', `${resolved}/${items.length} succeeded`);
  }

  private async fetchOgImage(articleUrl: string): Promise<string | undefined> {
    try {
      const url = getCorsProxyUrl(articleUrl);
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'Accept': 'text/html',
          ...(!url.includes('allorigins') && { 'User-Agent': 'Lightbulb News App/1.0' }),
        },
        // The full page is downloaded (axios has no way to stop after
        // </head>); we only limit how much of it we scan below.
        responseType: 'text',
      });

      const html = typeof response.data === 'string' ? response.data : '';
      // Limit search to the <head> section for efficiency
      const headEnd = html.indexOf('</head>');
      const headHtml = headEnd > 0 ? html.substring(0, headEnd) : html.substring(0, 10000);

      const ogMatch = headHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || headHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

      if (ogMatch?.[1]) {
        logger.debug(`Resolved OG image for ${articleUrl}`, ogMatch[1]);
        return ogMatch[1];
      }
    } catch (error: any) {
      logger.debug(`Failed to fetch OG image for ${articleUrl}`, error.message);
    }
    return undefined;
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
      const deduplicated = deduplicatePosts(allNews);
      const filtered = filterPosts(deduplicated, config);
      const sorted = sortPosts(filtered, config);

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
