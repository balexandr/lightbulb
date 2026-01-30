export interface NewsSource {
  name: string;
  icon?: string;
  type: 'rss' | 'reddit';
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: NewsSource;
  publishedAt: Date;
  imageUrl?: string;
  domain?: string;
  score?: number;
  commentCount?: number;
}

export interface FilterConfig {
  requireExternalLink?: boolean;
  requireNewsDomain?: boolean;
  deprioritizeOneLiners?: boolean;
  minScore?: number;
}

export interface AIExplanation {
  summary: string;
  why: string;
  impact: string;
  credibility: string;
};