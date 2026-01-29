import { Platform } from 'react-native';

/**
 * Network utilities for handling CORS and headers
 */

export function getCorsProxyUrl(url: string): string {
  if (Platform.OS === 'web') {
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getRequestHeaders(isRSS: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': isRSS 
      ? 'application/rss+xml, application/xml, text/xml, */*'
      : 'application/json',
  };

  if (Platform.OS !== 'web') {
    headers['User-Agent'] = 'Lightbulb News App/1.0';
  }

  return headers;
}