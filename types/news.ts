export interface NewsSource {
  type: 'reddit' | 'rss';
  name: string;
  url?: string;
  subreddit?: string;
  icon?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: NewsSource;
  timestamp: Date;
  domain?: string;
  score?: number;
  summary?: string;
  imageUrl?: string;
  aiExplanation?: {
    what: string;
    why: string;
    impact: string;
  };
}

export interface FilterConfig {
  requireExternalLinks: boolean;
  allowedDomains: string[];
  deprioritizeOneLiners: boolean;
  deprioritizeLoadedLanguage: boolean;
  questionHeavyTitles: boolean;
}