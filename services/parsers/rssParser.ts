import { RSS_FEEDS } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { cleanHTML, extractDomain, extractXMLAttribute, extractXMLTag } from '@/utils/textUtils';

export class RSSParser {
  parseFeed(xmlText: string, feedConfig: typeof RSS_FEEDS[number]): NewsItem[] {
    const items: NewsItem[] = [];
    
    try {
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const matches = xmlText.matchAll(itemRegex);
      
      for (const match of matches) {
        const item = this.parseItem(match[1], feedConfig);
        if (item) {
          items.push(item);
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse RSS feed for ${feedConfig.name}: ${error}`);
    }
    
    return items;
  }

  private parseItem(itemXml: string, feedConfig: typeof RSS_FEEDS[number]): NewsItem | null {
    const title = extractXMLTag(itemXml, 'title');
    const link = extractXMLTag(itemXml, 'link');
    const pubDate = extractXMLTag(itemXml, 'pubDate');
    const description = extractXMLTag(itemXml, 'description');
    
    if (!title || !link) {
      return null;
    }

    const imageUrl = this.extractImageUrl(itemXml, description, feedConfig);
    
    return {
      id: `rss-${feedConfig.name}-${link}`,
      title: cleanHTML(title),
      url: link,
      source: {
        name: feedConfig.name,
        icon: feedConfig.icon,
        type: 'rss',
      },
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
      imageUrl,
      domain: extractDomain(link),
    };
  }

  private extractImageUrl(
    itemXml: string, 
    description: string, 
    feedConfig: typeof RSS_FEEDS[number]
  ): string | undefined {
    let imageUrl = extractXMLAttribute(itemXml, 'media:thumbnail', 'url') || 
                   extractXMLAttribute(itemXml, 'media:content', 'url');
    
    if (!imageUrl && description) {
      const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }

    return imageUrl || feedConfig.fallbackImage;
  }
}

export const rssParser = new RSSParser();