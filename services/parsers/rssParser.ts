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

  // Below this, an image looks visibly soft/blurry once stretched to fill
  // a full-width, 200pt-tall card (see app/(tabs)/index.tsx's
  // styles.articleImage) - well above the old 50px floor, which really only
  // ever caught literal tracking pixels, not genuinely undersized thumbnails
  // like BBC's 240x135 (see isValidImage).
  private static readonly MIN_IMAGE_DIMENSION = 300;

  private isValidImage(url: string, width?: number, height?: number): boolean {
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

    // Prefer explicit dimensions (from XML/HTML attributes the feed itself
    // provides) over guessing from the URL text - far more reliable, and
    // the reason an undersized thumbnail could previously slip through
    // unflagged whenever its URL didn't happen to contain a literal
    // "NxN" substring.
    if (width !== undefined && height !== undefined) {
      return width >= RSSParser.MIN_IMAGE_DIMENSION && height >= RSSParser.MIN_IMAGE_DIMENSION;
    }

    const sizeMatch = url.match(/(\d+)x(\d+)/);
    if (sizeMatch) {
      const urlWidth = parseInt(sizeMatch[1]);
      const urlHeight = parseInt(sizeMatch[2]);
      if (urlWidth < RSSParser.MIN_IMAGE_DIMENSION || urlHeight < RSSParser.MIN_IMAGE_DIMENSION) {
        return false;
      }
    }

    return true;
  }

  // BBC's own RSS <media:thumbnail> only ever advertises a small 240x135
  // rendition, but its CDN serves the same asset at several larger widths
  // via this URL pattern (verified directly against the live CDN) - swap
  // in a much larger one instead of accepting the undersized default.
  private upsizeIfBbcThumbnail(url: string): string {
    return url.replace(/(ichef\.bbci\.co\.uk\/ace\/standard\/)\d+(\/)/, '$1976$2');
  }

  private extractImageUrl(
    item: Record<string, unknown>,
    description: string,
    contentEncoded: string,
    feedConfig: RSSFeedConfig
  ): string | undefined {
    // Try multiple image extraction methods in order of preference

    // 1. Try media:content
    const mediaContent = this.extractMediaContent(item);
    if (mediaContent && this.isValidImage(mediaContent.url, mediaContent.width, mediaContent.height)) {
      logger.debug(`Found image from media:content for ${feedConfig.name}`, mediaContent.url);
      return mediaContent.url;
    }

    // 2. Try media:thumbnail
    const thumbnailUrl = attrOf(item['media:thumbnail'], 'url');
    if (thumbnailUrl) {
      const width = attrOf(item['media:thumbnail'], 'width');
      const height = attrOf(item['media:thumbnail'], 'height');
      const upsized = this.upsizeIfBbcThumbnail(thumbnailUrl);
      const isUpsized = upsized !== thumbnailUrl;
      // The upsized rendition is known-larger by construction - skip
      // re-validating its (now stale) original width/height attributes.
      if (isUpsized || this.isValidImage(thumbnailUrl, width ? Number(width) : undefined, height ? Number(height) : undefined)) {
        logger.debug(`Found image from media:thumbnail for ${feedConfig.name}`, upsized);
        return upsized;
      }
    }

    // 3. Try enclosure
    const enclosureUrl = attrOf(item.enclosure, 'url');
    if (enclosureUrl && this.isValidImage(enclosureUrl)) {
      logger.debug(`Found image from enclosure for ${feedConfig.name}`, enclosureUrl);
      return enclosureUrl;
    }

    // 4. For NPR and others, extract from content:encoded
    if (contentEncoded) {
      const foundUrl = this.extractFirstValidImgTag(contentEncoded);
      if (foundUrl) {
        logger.debug(`Found image from content:encoded for ${feedConfig.name}`, foundUrl);
        return foundUrl;
      }
    }

    // 5. Extract from description HTML
    if (description) {
      const foundUrl = this.extractFirstValidImgTag(description);
      if (foundUrl) {
        logger.debug(`Found image from description for ${feedConfig.name}`, foundUrl);
        return foundUrl;
      }
    }

    // 6. No image found in feed XML
    logger.info(`No image found in RSS for ${feedConfig.name} article, will attempt OG resolution`);
    return undefined;
  }

  // Scans every <img> tag in the given HTML (content:encoded or
  // description), not just the first - a feed can legitimately list a
  // tracking pixel before or after the real photo (see NPR's
  // content:encoded), so stopping at the first tag and giving up if it
  // fails validation was silently discarding perfectly good images later
  // in the same markup. Matches both quote styles - CBC's feed uses single
  // quotes, which the old description-only regex (double-quote-only)
  // never matched at all.
  private extractFirstValidImgTag(html: string): string | undefined {
    const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];

    for (const tag of imgTags) {
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch) continue;

      const url = srcMatch[1];
      const widthMatch = tag.match(/\bwidth=["']?(\d+)/i);
      const heightMatch = tag.match(/\bheight=["']?(\d+)/i);
      const width = widthMatch ? Number(widthMatch[1]) : undefined;
      const height = heightMatch ? Number(heightMatch[1]) : undefined;

      if (this.isValidImage(url, width, height)) {
        return url;
      }
    }

    return undefined;
  }

  private extractMediaContent(item: Record<string, unknown>): { url: string; width?: number; height?: number } | null {
    const candidates = asArray(item['media:content'] as any)
      .map(candidate => ({
        url: attrOf(candidate, 'url'),
        medium: attrOf(candidate, 'medium'),
        width: attrOf(candidate, 'width') ? Number(attrOf(candidate, 'width')) : undefined,
        height: attrOf(candidate, 'height') ? Number(attrOf(candidate, 'height')) : undefined,
      }))
      .filter(candidate => candidate.url);

    if (candidates.length === 0) return null;

    // Prefer ones explicitly marked as an image; within that pool (or all
    // candidates, if none are marked), prefer the largest by width - some
    // feeds (e.g. the Guardian) list several sizes with no `medium`
    // attribute and no guaranteed order, so blindly taking "the first one"
    // can silently pick the smallest rendition available.
    const imageCandidates = candidates.filter(candidate => candidate.medium === 'image');
    const pool = imageCandidates.length > 0 ? imageCandidates : candidates;
    const chosen = pool.reduce((best, candidate) => ((candidate.width ?? 0) > (best.width ?? 0) ? candidate : best));

    return chosen;
  }
}

export const rssParser = new RSSParser();
