import { Platform } from 'react-native';

import { getCorsProxyUrl, getRequestHeaders } from './networkUtils';

describe('getCorsProxyUrl', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('routes through the allorigins CORS proxy on web', () => {
    Platform.OS = 'web';
    const url = getCorsProxyUrl('https://example.com/feed.xml?a=1&b=2');
    expect(url).toBe(
      `https://api.allorigins.win/raw?url=${encodeURIComponent('https://example.com/feed.xml?a=1&b=2')}`
    );
  });

  it('returns the URL unchanged on native platforms', () => {
    Platform.OS = 'ios';
    expect(getCorsProxyUrl('https://example.com/feed.xml')).toBe('https://example.com/feed.xml');

    Platform.OS = 'android';
    expect(getCorsProxyUrl('https://example.com/feed.xml')).toBe('https://example.com/feed.xml');
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
