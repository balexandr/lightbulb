export interface RSSFeedConfig {
  name: string;
  url: string;
  icon: string;
  fallbackImage: string;
}

export const RSS_FEEDS: RSSFeedConfig[] = [
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
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    icon: 'https://www.theguardian.com/favicon.ico',
    fallbackImage: 'https://assets.guim.co.uk/images/guardian-logo-rss.c45beb1bafa34b347ac333af2e6fe23f.png'
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    icon: 'https://www.aljazeera.com/favicon.ico',
    fallbackImage: 'https://www.aljazeera.com/images/logo_aje.png'
  },
  {
    name: 'CBC',
    url: 'https://www.cbc.ca/cmlink/rss-topstories',
    icon: 'https://www.cbc.ca/favicon.ico',
    fallbackImage: 'https://www.cbc.ca/favicon.ico'
  },
  {
    name: 'NYTimes',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    icon: 'https://www.nytimes.com/favicon.ico',
    fallbackImage: 'https://static01.nyt.com/images/icons/t_logo_291_black.png'
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    icon: 'https://www.wired.com/favicon.ico',
    fallbackImage: 'https://www.wired.com/verso/static/wired/assets/favicon.ico'
  },
  {
    name: 'Engadget',
    url: 'https://www.engadget.com/rss.xml',
    icon: 'https://www.engadget.com/apple-touch-icon.png',
    fallbackImage: 'https://www.engadget.com/apple-touch-icon.png'
  },
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    icon: 'https://news.ycombinator.com/favicon.ico',
    fallbackImage: 'https://news.ycombinator.com/y18.svg'
  },
];

// Reddit is off by default (unauthenticated JSON-endpoint scraping is
// against Reddit's User Agreement — see docs/TECHNICAL_GUIDE.md §12.1).
// Kept in the codebase, not deleted, in case Reddit gets re-added later
// under proper OAuth. Flip to true for local testing only.
export const REDDIT_ENABLED = false;

export const REDDIT_SUBREDDITS = [
  'worldnews',
  'technology',
  'science',
  'futurology',
  'geopolitics',
  'space',
  'europe',
  'Economics',
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
  'aljazeera.com',
  'theguardian.com',
  'wired.com',
  'engadget.com'
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

export const DISABLED_BY_DEFAULT_SOURCES = ['TechCrunch'] as const;
