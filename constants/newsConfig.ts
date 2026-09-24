// §17.2: a static, on-device, no-AI-call trust signal - three factual,
// independently-checkable questions rather than a single rolled-up score.
// A bare number invites "who decided this" scrutiny (docs/TECHNICAL_GUIDE.md
// §17.2); a checklist of specific claims is easier to challenge and correct.
// Self-assessed from publicly available information as of 2026-09 - verify
// before relying on it for anything beyond an in-app transparency signal,
// same caveat as §13's source list.
export type OutletType = 'public-broadcaster' | 'newspaper' | 'digital-native' | 'link-aggregator';

export interface SourceTrustInfo {
  outletType: OutletType;
  // Publishes a corrections/clarifications policy or practice.
  hasCorrectionsPolicy: boolean;
  // Articles are attributed to a named reporter, not just "Staff" or unsigned.
  bylineTransparency: boolean;
}

// §17.7: a coarse, self-assessed general characterization used only to
// detect when a reader opens a source unlike their own stated political
// stance - not a scientific rating, and individual articles from any outlet
// can cut against its general lean. 'not-applicable' is for sources that
// aren't general-interest political-news editorial outlets (tech trade
// press, link aggregators) - they never count toward or against the §17.7
// count either way. Same self-assessed caveat as §17.2/§13's source list -
// verify/revisit before leaning on this for anything beyond the in-app
// transparency framing §17.7 requires.
export type LeanTag = 'left-leaning' | 'center' | 'right-leaning' | 'not-applicable';

// §17.4: the small set of regions this app currently has (or buckets
// preferences into) - not a full state list. "philadelphia" is its own
// value rather than folded into "northeast" because it's the one region
// with an actual hyperlocal source layer right now (see RSS_FEEDS below);
// extend this as more hyperlocal layers get built, not preemptively.
export type Region = 'philadelphia' | 'northeast' | 'midwest' | 'south' | 'west' | 'outside-us';

// Short display labels for compact UI (e.g. §17.1's "Relevant to you: X"
// card badge). Deliberately separate from explore.tsx's own location-picker
// labels ("Philadelphia, PA", "Northeast (other)") - those need to read
// well as a list of choices, this needs to read well inline in a small tag.
export const REGION_LABELS: Record<Region, string> = {
  philadelphia: 'Philadelphia',
  northeast: 'the Northeast',
  midwest: 'the Midwest',
  south: 'the South',
  west: 'the West',
  'outside-us': 'outside the U.S.',
};

export interface RSSFeedConfig {
  name: string;
  url: string;
  icon: string;
  fallbackImage: string;
  trust: SourceTrustInfo;
  lean: LeanTag;
  // Set only for hyperlocal sources - grouped into their own "Local News"
  // section in the Filter Menu and auto-selected by default for readers
  // whose region bucket matches (see app/(tabs)/index.tsx).
  localRegion?: Region;
}

export const RSS_FEEDS: RSSFeedConfig[] = [
  {
    name: 'BBC',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    icon: 'https://www.bbc.com/favicon.ico',
    fallbackImage: 'https://www.bbc.co.uk/iplayer/images/bbc-blocks-dark.png',
    trust: { outletType: 'public-broadcaster', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'center',
  },
  {
    name: 'NPR',
    url: 'https://feeds.npr.org/1001/rss.xml',
    icon: 'https://media.npr.org/chrome/favicon/favicon.ico',
    fallbackImage: 'https://prod-eks-static-assets.npr.org/chrome_svg/npr-logo-2025.svg',
    trust: { outletType: 'public-broadcaster', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'left-leaning',
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    icon: 'https://arstechnica.com/favicon.ico',
    fallbackImage: 'https://cdn.arstechnica.net/wp-content/uploads/2016/10/cropped-ars-logo-512_480-270x270.png',
    trust: { outletType: 'digital-native', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'not-applicable', // tech trade press, not general political-news coverage
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    icon: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
    fallbackImage: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
    trust: { outletType: 'digital-native', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'not-applicable',
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    icon: 'https://www.theguardian.com/favicon.ico',
    fallbackImage: 'https://assets.guim.co.uk/images/guardian-logo-rss.c45beb1bafa34b347ac333af2e6fe23f.png',
    trust: { outletType: 'newspaper', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'left-leaning',
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    icon: 'https://www.aljazeera.com/favicon.ico',
    fallbackImage: 'https://www.aljazeera.com/images/logo_aje.png',
    trust: { outletType: 'public-broadcaster', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'left-leaning',
  },
  {
    name: 'CBC',
    url: 'https://www.cbc.ca/cmlink/rss-topstories',
    icon: 'https://www.cbc.ca/favicon.ico',
    fallbackImage: 'https://www.cbc.ca/favicon.ico',
    trust: { outletType: 'public-broadcaster', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'center',
  },
  {
    name: 'NYTimes',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    icon: 'https://www.nytimes.com/favicon.ico',
    fallbackImage: 'https://static01.nyt.com/images/icons/t_logo_291_black.png',
    trust: { outletType: 'newspaper', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'left-leaning',
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    icon: 'https://www.wired.com/favicon.ico',
    fallbackImage: 'https://www.wired.com/verso/static/wired/assets/favicon.ico',
    trust: { outletType: 'digital-native', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'not-applicable',
  },
  {
    name: 'Engadget',
    url: 'https://www.engadget.com/rss.xml',
    icon: 'https://www.engadget.com/apple-touch-icon.png',
    fallbackImage: 'https://www.engadget.com/apple-touch-icon.png',
    trust: { outletType: 'digital-native', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'not-applicable',
  },
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    icon: 'https://news.ycombinator.com/favicon.ico',
    fallbackImage: 'https://news.ycombinator.com/y18.svg',
    // Not a newsroom - a user-submitted link aggregator, so "corrections
    // policy" and "byline" don't map the way they do for the other sources.
    trust: { outletType: 'link-aggregator', hasCorrectionsPolicy: false, bylineTransparency: false },
    lean: 'not-applicable',
  },
  // §17.4 hyperlocal layer. Fetched and confirmed live RSS 2.0 with real
  // items as of 2026-09-21 (§11's own instruction - a search-engine result
  // isn't enough). WHYY's general feed mixes in some non-article "Newscast"
  // audio-segment stubs alongside real articles - acceptable noise, not
  // disqualifying, similar to other sources' known quirks (§8).
  {
    name: 'WHYY',
    url: 'https://whyy.org/feed/',
    icon: 'https://whyy.org/favicon.ico',
    fallbackImage: 'https://whyy.org/favicon.ico',
    trust: { outletType: 'public-broadcaster', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'center',
    localRegion: 'philadelphia',
  },
  {
    name: 'Billy Penn',
    url: 'https://billypenn.com/feed/',
    icon: 'https://billypenn.com/favicon.ico',
    fallbackImage: 'https://billypenn.com/favicon.ico',
    trust: { outletType: 'digital-native', hasCorrectionsPolicy: true, bylineTransparency: true },
    lean: 'center',
    localRegion: 'philadelphia',
  },
];

// Whether Reddit fetching is enabled is a server-driven feature flag now
// (see types/featureFlags.ts, app/api/flags+api.ts) rather than a hardcoded
// constant here - unauthenticated JSON-endpoint scraping is against
// Reddit's User Agreement (docs/TECHNICAL_GUIDE.md §12.1), so it defaults
// off, but can be flipped via a Render env var without a client rebuild.
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
  'engadget.com',
  'whyy.org',
  'billypenn.com'
] as const;

export const CACHE_CONFIG = {
  NEWS_KEY: '@lightbulb_news_cache',
  // Two independent prefixes (§15.3/§15.6): fact is cached per-article only
  // and shared by every reader; relevance is cached per-article-per-bucket.
  FACT_PREFIX: '@lightbulb_fact_',
  RELEVANCE_PREFIX: '@lightbulb_relevance_',
  INDEX_KEY: '@lightbulb_cache_index',
  NEWS_DURATION: 5 * 60 * 1000, // 5 minutes
  EXPLANATION_EXPIRY_DAYS: 7,
  FLAGS_KEY: '@lightbulb_feature_flags',
  FLAGS_DURATION: 15 * 60 * 1000, // 15 minutes
} as const;

export const DEFAULT_FILTER_CONFIG = {
  requireExternalLink: true,
  requireNewsDomain: true,
  deprioritizeOneLiners: true,
  minScore: 10,
} as const;

export const DISABLED_BY_DEFAULT_SOURCES = ['TechCrunch'] as const;
