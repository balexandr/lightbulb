import { rssParser } from './rssParser';

const feedConfig = {
  name: 'Test Feed',
  url: 'https://example.com/rss.xml',
  icon: 'https://example.com/favicon.ico',
  fallbackImage: 'https://example.com/fallback.png',
  trust: { outletType: 'digital-native' as const, hasCorrectionsPolicy: true, bylineTransparency: true },
  lean: 'not-applicable' as const,
};

function wrapFeed(itemsXml: string): string {
  return `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Feed</title>
    ${itemsXml}
  </channel>
</rss>`;
}

describe('RSSParser.parseFeed', () => {
  it('parses a basic item', () => {
    const xml = wrapFeed(`
      <item>
        <title>Hello World</title>
        <link>https://example.com/articles/hello</link>
        <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Hello World');
    expect(items[0].url).toBe('https://example.com/articles/hello');
    expect(items[0].domain).toBe('example.com');
    expect(items[0].source).toEqual({
      name: 'Test Feed',
      icon: 'https://example.com/favicon.ico',
      type: 'rss',
    });
  });

  it('unwraps CDATA titles', () => {
    const xml = wrapFeed(`
      <item>
        <title><![CDATA[Breaking: Cats & Dogs]]></title>
        <link>https://example.com/a</link>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].title).toBe('Breaking: Cats & Dogs');
  });

  it('skips items with no title or no link', () => {
    const xml = wrapFeed(`
      <item>
        <title>No link here</title>
      </item>
      <item>
        <link>https://example.com/no-title</link>
      </item>
      <item>
        <title>Valid</title>
        <link>https://example.com/valid</link>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Valid');
  });

  it('handles a feed with a single item (no array wrapping)', () => {
    const xml = wrapFeed(`
      <item>
        <title>Only One</title>
        <link>https://example.com/only-one</link>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Only One');
  });

  it('prefers media:content marked as an image', () => {
    const xml = wrapFeed(`
      <item>
        <title>Pic</title>
        <link>https://example.com/pic</link>
        <media:content medium="image" url="https://example.com/photo-600x400.jpg" />
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://example.com/photo-600x400.jpg');
  });

  it('falls back to media:thumbnail when there is no media:content', () => {
    const xml = wrapFeed(`
      <item>
        <title>Thumb</title>
        <link>https://example.com/thumb</link>
        <media:thumbnail url="https://example.com/thumb-600x400.jpg" />
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://example.com/thumb-600x400.jpg');
  });

  it('falls back to an <img> inside content:encoded', () => {
    const xml = wrapFeed(`
      <item>
        <title>Content Image</title>
        <link>https://example.com/content-image</link>
        <content:encoded><![CDATA[<p><img src="https://example.com/inline-600x400.jpg" /></p>]]></content:encoded>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://example.com/inline-600x400.jpg');
  });

  it('rejects tracking pixels and undersized images', () => {
    const xml = wrapFeed(`
      <item>
        <title>Tiny</title>
        <link>https://example.com/tiny</link>
        <media:content medium="image" url="https://example.com/tracking-pixel-1x1.gif" />
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBeUndefined();
  });

  it('rejects an image below the 300px minimum even without a matching URL-text hint', () => {
    const xml = wrapFeed(`
      <item>
        <title>Blurry</title>
        <link>https://example.com/blurry</link>
        <media:thumbnail width="240" height="135" url="https://example.com/opaque-asset-id.jpg" />
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBeUndefined();
  });

  it('upsizes an undersized BBC thumbnail instead of rejecting it', () => {
    const xml = wrapFeed(`
      <item>
        <title>BBC story</title>
        <link>https://example.com/bbc-story</link>
        <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/abc/live/photo.jpg" />
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/abc/live/photo.jpg');
  });

  it('prefers the largest media:content candidate when none is marked medium="image"', () => {
    const xml = wrapFeed(`
      <item>
        <title>Guardian-style</title>
        <link>https://example.com/guardian-style</link>
        <media:content width="140" url="https://example.com/small.jpg" />
        <media:content width="460" url="https://example.com/large.jpg" />
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://example.com/large.jpg');
  });

  it('matches single-quoted <img> tags in description HTML, not just double-quoted', () => {
    const xml = wrapFeed(`
      <item>
        <title>CBC-style</title>
        <link>https://example.com/cbc-style</link>
        <description><![CDATA[<img src='https://example.com/photo.jpg' width='620' height='349' />]]></description>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://example.com/photo.jpg');
  });

  it('skips a tracking pixel and uses the next valid <img> tag in the same content', () => {
    const xml = wrapFeed(`
      <item>
        <title>NPR-style</title>
        <link>https://example.com/npr-style</link>
        <content:encoded><![CDATA[<img src='https://example.com/real-photo-600x400.jpg' /><p>Caption</p><img src='https://example.com/tracking-pixel.png' />]]></content:encoded>
      </item>
    `);

    const items = rssParser.parseFeed(xml, feedConfig);
    expect(items[0].imageUrl).toBe('https://example.com/real-photo-600x400.jpg');
  });

  it('returns an empty list for a feed with no items', () => {
    const xml = wrapFeed('');
    expect(rssParser.parseFeed(xml, feedConfig)).toEqual([]);
  });
});

describe('RSSParser.getLargeFavicon', () => {
  it('returns a known large icon for a recognized feed name', () => {
    expect(rssParser.getLargeFavicon({ ...feedConfig, name: 'BBC' })).toContain('bbc');
  });

  it('falls back to the feed fallbackImage for unknown feeds', () => {
    expect(rssParser.getLargeFavicon(feedConfig)).toBe(feedConfig.fallbackImage);
  });
});
