import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

import { FilterConfig, NewsItem, NewsSource } from '@/types/news';

const RSS_FEEDS = [
  { 
    name: 'BBC', 
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    icon: 'https://www.bbc.com/favicon.ico',
    fallbackImage: 'https://www.bbc.co.uk/iplayer/images/bbc-blocks-dark.png'
  },
  { 
    name: 'NPR', 
    url: 'https://feeds.npr.org/1001/rss.xml',
    icon: 'https://media.npr.org/chrome/favicon/favicon.ico',
    fallbackImage: 'https://prod-eks-static-assets.npr.org/chrome_svg/npr-logo-2025.svg'
  },
  { 
    name: 'Ars Technica', 
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    icon: 'https://arstechnica.com/favicon.ico',
    fallbackImage: 'https://cdn.arstechnica.net/wp-content/uploads/2016/10/cropped-ars-logo-512_480-270x270.png'
  },
  { 
    name: 'TechCrunch', 
    url: 'https://techcrunch.com/feed/',
    icon: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
    fallbackImage: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png'
  },
];

const REDDIT_SUBREDDITS = [
  'worldnews',
  'technology',
  'science',
  'futurology',
  'geopolitics',
  'space',
  'europe',
];

const NEWS_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'npr.org',
  'bbc.com',
  'bbc.co.uk',
  'nytimes.com',
  'washingtonpost.com',
  'arstechnica.com',
  'techcrunch.com',
  'news.ycombinator.com',
  'cbc.ca',
  'huffpost.com'
];

export class NewsService {
  private readonly CACHE_KEY = '@lightbulb_news_cache';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private readonly defaultFilter: FilterConfig = {
    requireExternalLink: true,
    requireNewsDomain: true,
    deprioritizeOneLiners: true,
    minScore: 10,
  };

  private getCorsProxyUrl(url: string): string {
    // Only use CORS proxy on web platform
    if (Platform.OS === 'web') {
      return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  private getHeaders(isRSS: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': isRSS 
        ? 'application/rss+xml, application/xml, text/xml, */*'
        : 'application/json',
    };

    // Only set User-Agent on native platforms (not web)
    if (Platform.OS !== 'web') {
      headers['User-Agent'] = 'Lightbulb News App/1.0';
    }

    return headers;
  }

  private parseRSSFeed(xmlText: string, feedConfig: typeof RSS_FEEDS[0]): NewsItem[] {
    const items: NewsItem[] = [];
    
    try {
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const matches = xmlText.matchAll(itemRegex);
      
      for (const match of matches) {
        const itemXml = match[1];
        
        const title = this.extractXMLTag(itemXml, 'title');
        const link = this.extractXMLTag(itemXml, 'link');
        const pubDate = this.extractXMLTag(itemXml, 'pubDate');
        const description = this.extractXMLTag(itemXml, 'description');
        
        let imageUrl = this.extractXMLAttribute(itemXml, 'media:thumbnail', 'url') || 
                       this.extractXMLAttribute(itemXml, 'media:content', 'url');
        
        if (!imageUrl && description) {
          const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }
        }

        if (!imageUrl) {
          imageUrl = feedConfig.fallbackImage;
        }
        
        if (title && link) {
          items.push({
            id: `rss-${feedConfig.name}-${link}`,
            title: this.cleanHTML(title),
            url: link,
            source: {
              name: feedConfig.name,
              icon: feedConfig.icon,
              type: 'rss',
            },
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            imageUrl: imageUrl || undefined,
            domain: this.extractDomain(link),
          });
        }
      }
    } catch (error) {
      console.error(`Error parsing RSS feed for ${feedConfig.name}:`, error);
    }
    
    return items;
  }

  private extractXMLTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractXMLAttribute(xml: string, tag: string, attribute: string): string {
    const regex = new RegExp(`<${tag}[^>]*${attribute}="([^"]+)"`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : '';
  }

  private cleanHTML(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x27;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .trim();
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  private async fetchRSSNews(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];

    console.log('🔄 Starting RSS feed fetch... Platform:', Platform.OS);

    for (const feed of RSS_FEEDS) {
      try {
        const feedUrl = this.getCorsProxyUrl(feed.url);
        console.log(`📡 Fetching RSS feed: ${feed.name}`);
        
        const response = await axios.get(feedUrl, {
          timeout: 15000,
          headers: this.getHeaders(true),
        });

        console.log(`✅ Got response from ${feed.name}, status: ${response.status}, length: ${response.data.length}`);
        const items = this.parseRSSFeed(response.data, feed);
        console.log(`📰 Parsed ${items.length} items from ${feed.name}`);
        
        if (items.length > 0) {
          console.log(`   Sample: "${items[0].title}"`);
        } else {
          console.log(`   ⚠️ No items parsed! Response preview:`, response.data.substring(0, 200));
        }
        
        allItems.push(...items);
      } catch (error: any) {
        console.error(`❌ Error fetching RSS feed ${feed.name}:`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
      }
    }

    console.log(`📊 Total RSS items fetched: ${allItems.length}`);
    return allItems;
  }

  private async fetchRedditNews(): Promise<NewsItem[]> {
    const allPosts: NewsItem[] = [];

    for (const subreddit of REDDIT_SUBREDDITS) {
      try {
        console.log(`Fetching r/${subreddit}`);
        
        // Use CORS proxy on web platform
        const redditUrl = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
        const url = this.getCorsProxyUrl(redditUrl);
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: this.getHeaders(false),
        });

        const posts = response.data.data.children
          .map((child: any) => child.data)
          .filter((post: any) => !post.stickied && !post.over_18)
          .map((post: any) => {
            const domain = this.extractDomain(post.url);
            
            return {
              id: post.id,
              title: post.title,
              url: post.url,
              score: post.score,
              source: {
                name: `r/${subreddit}`,
                icon: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
                type: 'reddit',
              } as NewsSource,
              publishedAt: new Date(post.created_utc * 1000),
              imageUrl: this.getRedditImage(post),
              domain,
              commentCount: post.num_comments,
            } as NewsItem;
          });

        console.log(`✅ Fetched ${posts.length} posts from r/${subreddit}`);
        allPosts.push(...posts);
      } catch (error) {
        console.error(`Error fetching r/${subreddit}:`, error);
      }
    }

    console.log(`🔴 Total Reddit posts fetched: ${allPosts.length}`);
    return allPosts;
  }

  private getRedditImage(post: any): string | undefined {
    if (post.preview?.images?.[0]?.source?.url) {
      return post.preview.images[0].source.url.replace(/&amp;/g, '&');
    }
    
    if (post.thumbnail && 
        post.thumbnail.startsWith('http') && 
        !post.thumbnail.includes('reddit.com')) {
      return post.thumbnail;
    }
    
    if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
      return post.url;
    }

    return undefined;
  }

  private filterPosts(posts: NewsItem[], config: FilterConfig = this.defaultFilter): NewsItem[] {
    return posts.filter(post => {
      // RSS feeds bypass filtering - they're already curated
      if (post.source.type === 'rss') {
        return true;
      }

      // Check external link requirement
      if (config.requireExternalLink && !post.url.startsWith('http')) {
        return false;
      }

      // Check news domain requirement
      if (config.requireNewsDomain && post.domain) {
        const isNewsDomain = NEWS_DOMAINS.some(domain => 
          post.domain?.includes(domain)
        );
        if (!isNewsDomain) {
          return false;
        }
      }

      // Check minimum score (use default if not specified)
      const minScoreThreshold = config.minScore ?? this.defaultFilter.minScore ?? 10;
      if (post.score !== undefined && post.score < minScoreThreshold) {
        return false;
      }

      return true;
    });
  }

  private sortPosts(posts: NewsItem[], config: FilterConfig = this.defaultFilter): NewsItem[] {
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
        console.log('Using cached news data');
        return cached;
      }

      console.log('Fetching fresh news data...');
      
      const [rssNews, redditNews] = await Promise.all([
        this.fetchRSSNews(),
        this.fetchRedditNews(),
      ]);

      console.log(`📊 Fetched ${rssNews.length} RSS items and ${redditNews.length} Reddit items`);
      
      // Debug: Count by source BEFORE filtering
      const rssBySource: Record<string, number> = {};
      rssNews.forEach(item => {
        rssBySource[item.source.name] = (rssBySource[item.source.name] || 0) + 1;
      });
      console.log('📰 RSS items by source:', rssBySource);

      const redditBySource: Record<string, number> = {};
      redditNews.forEach(item => {
        redditBySource[item.source.name] = (redditBySource[item.source.name] || 0) + 1;
      });
      console.log('🔴 Reddit items by source (BEFORE filter):', redditBySource);

      const allNews = [...rssNews, ...redditNews];
      const filtered = this.filterPosts(allNews, config);
      
      // Debug: Count AFTER filtering
      const filteredBySource: Record<string, number> = {};
      filtered.forEach(item => {
        filteredBySource[item.source.name] = (filteredBySource[item.source.name] || 0) + 1;
      });
      console.log('✅ Items by source (AFTER filter):', filteredBySource);
      
      const sorted = this.sortPosts(filtered, config);

      await this.cacheNews(sorted);

      console.log(`✅ Final: ${sorted.length} news items`);
      return sorted;
    } catch (error) {
      console.error('Error fetching news:', error);
      return [];
    }
  }

  private async getCachedNews(): Promise<NewsItem[] | null> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age > this.CACHE_DURATION) {
        await AsyncStorage.removeItem(this.CACHE_KEY);
        return null;
      }

      return data.map((item: any) => ({
        ...item,
        publishedAt: new Date(item.publishedAt),
      }));
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }

  private async cacheNews(news: NewsItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.CACHE_KEY,
        JSON.stringify({
          data: news,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error caching news:', error);
    }
  }

  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(this.CACHE_KEY);
  }
}

export const newsService = new NewsService();
