import { Platform } from 'react-native';

import { getFeedProxyUrl, getRequestHeaders } from './networkUtils';

describe('getFeedProxyUrl', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('routes through the first-party /api/rss-proxy route on web', () => {
    Platform.OS = 'web';
    const url = getFeedProxyUrl('https://feeds.bbci.co.uk/news/world/rss.xml');
    expect(url).toBe(`/api/rss-proxy?url=${encodeURIComponent('https://feeds.bbci.co.uk/news/world/rss.xml')}`);
  });

  it('returns the URL unchanged on native platforms', () => {
    Platform.OS = 'ios';
    expect(getFeedProxyUrl('https://feeds.bbci.co.uk/news/world/rss.xml')).toBe('https://feeds.bbci.co.uk/news/world/rss.xml');

    Platform.OS = 'android';
    expect(getFeedProxyUrl('https://feeds.bbci.co.uk/news/world/rss.xml')).toBe('https://feeds.bbci.co.uk/news/world/rss.xml');
  });
});

describe('getRequestHeaders', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('requests RSS-flavored Accept headers when isRSS is true', () => {
    expect(getRequestHeaders(true).Accept).toBe('application/rss+xml, application/xml, text/xml, */*');
  });

  it('defaults to JSON Accept headers', () => {
    expect(getRequestHeaders().Accept).toBe('application/json');
    expect(getRequestHeaders(false).Accept).toBe('application/json');
  });

  it('adds a User-Agent on native platforms but not on web', () => {
    Platform.OS = 'ios';
    expect(getRequestHeaders()['User-Agent']).toBe('Lightbulb News App/1.0');

    Platform.OS = 'web';
    expect(getRequestHeaders()['User-Agent']).toBeUndefined();
  });
});
