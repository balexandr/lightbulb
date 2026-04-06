import { RSS_FEEDS } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
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
    let title = extractXMLTag(itemXml, 'title');
    const link = extractXMLTag(itemXml, 'link');
    const pubDate = extractXMLTag(itemXml, 'pubDate');
    const description = extractXMLTag(itemXml, 'description');
    const contentEncoded = extractXMLTag(itemXml, 'content:encoded');
    
    // Handle CDATA in title (common in BBC and other feeds)
    if (title.includes('<![CDATA[')) {
      const cdataMatch = title.match(/<!\[CDATA\[(.*?)\]\]>/);
      if (cdataMatch) {
        title = cdataMatch[1];
      }
    }
    
    if (!title || !link) {
      return null;
    }

    const imageUrl = this.extractImageUrl(itemXml, description, contentEncoded, feedConfig);
    
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

  getLargeFavicon(feedConfig: typeof RSS_FEEDS[number]): string {
    // Map feed names to larger icon URLs
    const largeFavicons: Record<string, string> = {
      'NPR': 'https://media.npr.org/chrome_svg/npr-logo.svg',
      'BBC': 'https://static.files.bbci.co.uk/core/website/assets/static/icons/blocks/dark.b685c655a806ce38a27e.svg',
      'Ars Technica': 'https://cdn.arstechnica.net/wp-content/uploads/2016/10/cropped-ars-logo-512_480-192x192.png',
      'TechCrunch': 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png?w=180',
    };

    const largeIcon = largeFavicons[feedConfig.name];
    logger.debug(`Using large favicon for ${feedConfig.name}`, largeIcon || feedConfig.fallbackImage);
    return largeIcon || feedConfig.fallbackImage;
  }

  private isValidImage(url: string): boolean {
    if (!url) return false;
    
    // Filter out tracking pixels and invalid images
    const invalidPatterns = [
      'tracking',
      'pixel',
      '1x1',
      'spacer',
      'blank',
      'transparent',
    ];
    
    const urlLower = url.toLowerCase();
    
    // Check for invalid patterns
    if (invalidPatterns.some(pattern => urlLower.includes(pattern))) {
      return false;
    }
    
    // Check minimum size if dimensions are in URL
    const sizeMatch = url.match(/(\d+)x(\d+)/);
    if (sizeMatch) {
      const width = parseInt(sizeMatch[1]);
      const height = parseInt(sizeMatch[2]);
      if (width < 50 || height < 50) {
        return false;
      }
    }
    
    return true;
  }

  private extractImageUrl(
    itemXml: string, 
    description: string,
    contentEncoded: string,
    feedConfig: typeof RSS_FEEDS[number]
  ): string | undefined {
    // Try multiple image extraction methods in order of preference
    
    // 1. Try media:content
    let imageUrl = this.extractMediaContent(itemXml);
    if (imageUrl && this.isValidImage(imageUrl)) {
      logger.debug(`Found image from media:content for ${feedConfig.name}`, imageUrl);
      return imageUrl;
    }
    
    // 2. Try media:thumbnail
    imageUrl = extractXMLAttribute(itemXml, 'media:thumbnail', 'url');
    if (imageUrl && this.isValidImage(imageUrl)) {
      logger.debug(`Found image from media:thumbnail for ${feedConfig.name}`, imageUrl);
      return imageUrl;
    }
    
    // 3. Try enclosure
    imageUrl = extractXMLAttribute(itemXml, 'enclosure', 'url');
    if (imageUrl && this.isValidImage(imageUrl)) {
      logger.debug(`Found image from enclosure for ${feedConfig.name}`, imageUrl);
      return imageUrl;
    }
    
    // 4. For NPR, extract from content:encoded
    if (contentEncoded) {
      let cleanContent = contentEncoded;
      if (contentEncoded.includes('<![CDATA[')) {
        const cdataMatch = contentEncoded.match(/<!\[CDATA\[(.*?)\]\]>/s);
        if (cdataMatch) {
          cleanContent = cdataMatch[1];
        }
      }
      
      // Extract first <img> tag from content:encoded
      const imgMatch = cleanContent.match(/<img[^>]+src=['"]([^'"]+)['"]/);
      if (imgMatch) {
        const foundUrl = imgMatch[1];
        if (this.isValidImage(foundUrl)) {
          logger.debug(`Found image from content:encoded for ${feedConfig.name}`, foundUrl);
          return foundUrl;
        }
      }
    }

    // 5. Handle CDATA in description
    if (description) {
      let cleanDescription = description;
      if (description.includes('<![CDATA[')) {
        const cdataMatch = description.match(/<!\[CDATA\[(.*?)\]\]>/s);
        if (cdataMatch) {
          cleanDescription = cdataMatch[1];
        }
      }
      
      // Extract from description HTML
      if (cleanDescription) {
        const imgMatch = cleanDescription.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch && this.isValidImage(imgMatch[1])) {
          logger.debug(`Found image from description for ${feedConfig.name}`, imgMatch[1]);
          return imgMatch[1];
        }
      }
    }

    // 6. No image found in feed XML
    logger.info(`No image found in RSS for ${feedConfig.name} article, will attempt OG resolution`);
    return undefined;
  }

  private extractMediaContent(itemXml: string): string | null {
    // NPR uses <media:content medium="image" url="...">
    const mediaContentRegex = /<media:content[^>]*medium="image"[^>]*url="([^"]+)"/i;
    const match = itemXml.match(mediaContentRegex);
    if (match) {
      return match[1];
    }

    // Also try without medium attribute
    const mediaUrlRegex = /<media:content[^>]*url="([^"]+)"[^>]*>/i;
    const urlMatch = itemXml.match(mediaUrlRegex);
    if (urlMatch) {
      return urlMatch[1];
    }

    return null;
  }
}

export const rssParser = new RSSParser();