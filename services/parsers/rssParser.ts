import { XMLParser } from 'fast-xml-parser';

import { RSSFeedConfig } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
import { cleanHTML, extractDomain } from '@/utils/textUtils';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
});

// fast-xml-parser gives back a single object for a one-item list and an
// array for a multi-item list. This normalizes both to an array.
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// A tag with attributes and no text parses as { '@_attr': ... }, one with
// only text parses as a plain string. This reads either shape uniformly.
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)['#text']);
  }
  return '';
}

function attrOf(value: unknown, attribute: string): string {
  if (value && typeof value === 'object') {
    const attr = (value as Record<string, unknown>)[`@_${attribute}`];
    if (attr !== undefined) return String(attr);
  }
  return '';
}

export class RSSParser {
  parseFeed(xmlText: string, feedConfig: RSSFeedConfig): NewsItem[] {
    try {
      const parsed = xmlParser.parse(xmlText);
      const items = asArray(parsed?.rss?.channel?.item);

      const newsItems: NewsItem[] = [];
      for (const item of items) {
        const parsedItem = this.parseItem(item, feedConfig);
        if (parsedItem) {
          newsItems.push(parsedItem);
        }
      }
      return newsItems;
    } catch (error) {
      throw new Error(`Failed to parse RSS feed for ${feedConfig.name}: ${error}`);
    }
  }

  private parseItem(item: Record<string, unknown>, feedConfig: RSSFeedConfig): NewsItem | null {
    const title = textOf(item.title);
    const link = textOf(item.link);
    const pubDate = textOf(item.pubDate);
    const description = textOf(item.description);
    const contentEncoded = textOf(item['content:encoded']);

    if (!title || !link) {
      return null;
    }

    const imageUrl = this.extractImageUrl(item, description, contentEncoded, feedConfig);

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

  getLargeFavicon(feedConfig: RSSFeedConfig): string {
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
    item: Record<string, unknown>,
    description: string,
    contentEncoded: string,
    feedConfig: RSSFeedConfig
  ): string | undefined {
    // Try multiple image extraction methods in order of preference

    // 1. Try media:content
    let imageUrl = this.extractMediaContent(item);
    if (imageUrl && this.isValidImage(imageUrl)) {
      logger.debug(`Found image from media:content for ${feedConfig.name}`, imageUrl);
      return imageUrl;
    }

    // 2. Try media:thumbnail
    imageUrl = attrOf(item['media:thumbnail'], 'url');
    if (imageUrl && this.isValidImage(imageUrl)) {
      logger.debug(`Found image from media:thumbnail for ${feedConfig.name}`, imageUrl);
      return imageUrl;
    }

    // 3. Try enclosure
    imageUrl = attrOf(item.enclosure, 'url');
    if (imageUrl && this.isValidImage(imageUrl)) {
      logger.debug(`Found image from enclosure for ${feedConfig.name}`, imageUrl);
      return imageUrl;
    }

    // 4. For NPR, extract from content:encoded
    if (contentEncoded) {
      // Extract first <img> tag from content:encoded
      const imgMatch = contentEncoded.match(/<img[^>]+src=['"]([^'"]+)['"]/);
      if (imgMatch) {
        const foundUrl = imgMatch[1];
        if (this.isValidImage(foundUrl)) {
          logger.debug(`Found image from content:encoded for ${feedConfig.name}`, foundUrl);
          return foundUrl;
        }
      }
    }

    // 5. Extract from description HTML
    if (description) {
      const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch && this.isValidImage(imgMatch[1])) {
        logger.debug(`Found image from description for ${feedConfig.name}`, imgMatch[1]);
        return imgMatch[1];
      }
    }

    // 6. No image found in feed XML
    logger.info(`No image found in RSS for ${feedConfig.name} article, will attempt OG resolution`);
    return undefined;
  }

  private extractMediaContent(item: Record<string, unknown>): string | null {
    const candidates = asArray(item['media:content'] as any);

    // Prefer one explicitly marked as an image
    const imageCandidate = candidates.find(candidate => attrOf(candidate, 'medium') === 'image');
    const chosen = imageCandidate ?? candidates[0];

    const url = chosen ? attrOf(chosen, 'url') : '';
    return url || null;
  }
}

export const rssParser = new RSSParser();
