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

// Preference-independent: what happened, how reliable the source is. Same
// for every reader - cached per-article only (see cacheService).
export interface FactLayer {
  summary: string;
  credibility: string;
}

// Preference-dependent: why this matters to *this* reader, given their
// bucketed context - cached per-article-per-bucket (see cacheService).
export interface RelevanceLayer {
  why: string;
  impact: string;
}

// What the modal actually renders - assembled client-side from the two
// layers above (see aiService.explainNews). Same flat shape as before the
// fact/relevance split, so IlluminateModal didn't need to change.
export interface AIExplanation extends FactLayer, RelevanceLayer {}