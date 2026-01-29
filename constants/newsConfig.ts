export const RSS_FEEDS = [
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
] as const;

export const REDDIT_SUBREDDITS = [
  'worldnews',
  'technology',
  'science',
  'futurology',
  'geopolitics',
  'space',
  'europe',
] as const;

export const TRUSTED_NEWS_DOMAINS = [
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
  'huffpost.com',
] as const;

export const CACHE_CONFIG = {
  NEWS_KEY: '@lightbulb_news_cache',
  EXPLANATION_PREFIX: '@lightbulb_explanation_',
  INDEX_KEY: '@lightbulb_cache_index',
  NEWS_DURATION: 5 * 60 * 1000, // 5 minutes
  EXPLANATION_EXPIRY_DAYS: 7,
} as const;

export const DEFAULT_FILTER_CONFIG = {
  requireExternalLink: true,
  requireNewsDomain: true,
  deprioritizeOneLiners: true,
  minScore: 10,
} as const;

export const API_CONFIG = {
  OPENAI_MODEL: 'gpt-4o-mini',
  RATE_LIMIT_MS: 2000,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_TOKENS: 800,
} as const;

export const DISABLED_BY_DEFAULT_SOURCES = ['TechCrunch'] as const;