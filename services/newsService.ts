import { FilterConfig, NewsItem } from '@/types/news';
import axios from 'axios';

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
  //'theguardian.com',
  'nytimes.com',
  'washingtonpost.com',
  'arstechnica.com',
];

// Decode HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&#x27;': "'",
    '&nbsp;': ' ',
    '&#8217;': "'",
    '&#8216;': "'",
    '&#8220;': '"',
    '&#8221;': '"',
  };

  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

// Extract image from RSS item
function extractImageFromRSS(itemContent: string): string | undefined {
  // Try to find media:content
  const mediaContentMatch = itemContent.match(/<media:content[^>]*url=["']([^"']+)["']/i);
  if (mediaContentMatch) return mediaContentMatch[1];

  // Try to find media:thumbnail
  const mediaThumbnailMatch = itemContent.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
  if (mediaThumbnailMatch) return mediaThumbnailMatch[1];

  // Try to find enclosure
  const enclosureMatch = itemContent.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (enclosureMatch) return enclosureMatch[1];

  // Try to find img tag in description
  const imgMatch = itemContent.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return undefined;
}

// Simple RSS parser for React Native
function parseRSS(xmlString: string): { title: string; link: string; pubDate?: string; image?: string }[] {
  const items: { title: string; link: string; pubDate?: string; image?: string }[] = [];
  
  // Match all <item> tags
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const itemMatches = xmlString.matchAll(itemRegex);
  
  for (const itemMatch of itemMatches) {
    const itemContent = itemMatch[1];
    
    // Extract title
    const titleMatch = itemContent.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/i);
    const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
    const title = decodeHTMLEntities(rawTitle);
    
    // Extract link
    const linkMatch = itemContent.match(/<link[^>]*>(.*?)<\/link>/i);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    // Extract pubDate
    const pubDateMatch = itemContent.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : undefined;

    // Extract image
    const image = extractImageFromRSS(itemContent);
    
    if (title && link) {
      items.push({ title, link, pubDate, image });
    }
  }
  
  return items;
}

export class NewsService {
  private filterConfig: FilterConfig = {
    requireExternalLinks: true,
    allowedDomains: NEWS_DOMAINS,
    deprioritizeOneLiners: true,
    deprioritizeLoadedLanguage: true,
    questionHeavyTitles: false,
  };

  async fetchRedditPosts(subreddit: string): Promise<NewsItem[]> {
    try {
      const response = await axios.get(
        `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
        {
          headers: {
            'User-Agent': 'Lightbulb/1.0',
          },
          timeout: 10000,
        }
      );
      
      const posts = response.data.data.children.map((child: any) => {
        let imageUrl: string | undefined;
        
        // Try to get preview image
        if (child.data.preview?.images?.[0]?.source?.url) {
          imageUrl = child.data.preview.images[0].source.url.replace(/&amp;/g, '&');
        } else if (child.data.thumbnail && child.data.thumbnail.startsWith('http')) {
          imageUrl = child.data.thumbnail;
        }

        // Use Reddit logo as fallback
        if (!imageUrl) {
          imageUrl = 'https://www.redditinc.com/assets/images/site/reddit-logo.png';
        }

        return {
          id: child.data.id,
          title: decodeHTMLEntities(child.data.title),
          url: child.data.url,
          source: {
            type: 'reddit' as const,
            name: `r/${subreddit}`,
            subreddit,
            icon: 'https://www.reddit.com/favicon.ico',
          },
          timestamp: new Date(child.data.created_utc * 1000),
          domain: child.data.domain,
          score: child.data.score,
          imageUrl,
        };
      });

      return posts;
    } catch (error) {
      console.error(`Error fetching r/${subreddit}:`, error);
      return [];
    }
  }

  async fetchRSSFeed(feed: { name: string; url: string; icon: string; fallbackImage: string }): Promise<NewsItem[]> {
    try {
      const response = await axios.get(feed.url, {
        headers: {
          'User-Agent': 'Lightbulb/1.0',
        },
        timeout: 15000,
      });
      
      const items = parseRSS(response.data);
      
      return items.map((item, index) => ({
        id: `${feed.name}-${index}-${Date.now()}`,
        title: item.title,
        url: item.link,
        source: {
          type: 'rss' as const,
          name: feed.name,
          url: feed.url,
          icon: feed.icon,
        },
        timestamp: item.pubDate ? new Date(item.pubDate) : new Date(),
        imageUrl: item.image || feed.fallbackImage,
      }));
    } catch (error) {
      console.error(`Error fetching RSS feed ${feed.name}:`, error);
      return [];
    }
  }

  async fetchAllNews(): Promise<NewsItem[]> {
    const redditPromises = REDDIT_SUBREDDITS.map((sub) =>
      this.fetchRedditPosts(sub)
    );
    const rssPromises = RSS_FEEDS.map((feed) => this.fetchRSSFeed(feed));

    const allResults = await Promise.all([...redditPromises, ...rssPromises]);
    const allNews = allResults.flat();

    return this.filterNews(allNews);
  }

  private filterNews(items: NewsItem[]): NewsItem[] {
    return items
      .filter((item) => {
        // Filter external links
        if (this.filterConfig.requireExternalLinks && item.source.type === 'reddit') {
          return !item.domain?.includes('reddit.com');
        }
        return true;
      })
      .filter((item) => {
        // Filter by news domains (relaxed for RSS feeds)
        if (item.source.type === 'rss') {
          return true;
        }
        if (item.domain) {
          return this.filterConfig.allowedDomains.some((domain) =>
            item.domain?.includes(domain)
          );
        }
        return true;
      })
      .filter((item) => {
        // Filter question-heavy titles
        if (this.filterConfig.questionHeavyTitles) {
          const questionWords = ['what', 'why', 'how', 'when', 'who', 'where', '?'];
          const titleLower = item.title.toLowerCase();
          return questionWords.some((word) => titleLower.includes(word));
        }
        return true;
      })
      .sort((a, b) => {
        // Deprioritize one-liners
        if (this.filterConfig.deprioritizeOneLiners) {
          const aIsOneLiner = a.title.split(' ').length < 5;
          const bIsOneLiner = b.title.split(' ').length < 5;
          if (aIsOneLiner && !bIsOneLiner) return 1;
          if (!aIsOneLiner && bIsOneLiner) return -1;
        }

        // Sort by timestamp
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }
}

export const newsService = new NewsService();