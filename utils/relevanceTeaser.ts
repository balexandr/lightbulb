import { REGION_LABELS, RSS_FEEDS } from '@/constants/newsConfig';
import { AgeBucket, PreferenceBucket } from '@/services/preferencesService';
import { NewsItem } from '@/types/news';

// §17.1: a cheap, rule-based "should I even care" signal shown on every
// card, before the reader taps Illuminate. Deliberately NOT an AI call -
// generating real relevance text for the entire feed on every load would
// multiply Illuminate's API cost by feed size instead of by taps, which is
// exactly the cost-model change the guide calls out as the thing to avoid.
// The full AI relevance layer (§14/§15) stays tap-gated; this teaser's only
// job is to justify the tap, not replace it.
//
// Only two signals, both chosen to be simple facts about the article rather
// than a judgment call: which region a hyperlocal source covers, and topic
// keywords tied to the two age brackets with the clearest, least-stereotyped
// correlation to a headline topic (retirement for 65+, student debt for
// 18-24). Deliberately not stance-driven - keyword-matching political topics
// against a reader's political-stance bucket, with no model reasoning
// involved, is exactly the kind of blunt instrument that could read as the
// app editorializing, which is the whole thing §14.5's guardrail exists to
// avoid elsewhere. Extend the age-topic list only with similarly
// non-stereotyped, high-confidence correlations, not speculative ones.
export interface RelevanceTeaser {
  label: string;
  reason: 'region' | 'topic';
}

interface AgeTopic {
  label: string;
  keywords: string[];
}

const AGE_TOPICS: Partial<Record<Exclude<AgeBucket, 'unspecified'>, AgeTopic>> = {
  '18-24': {
    label: 'student loans',
    keywords: ['student loan', 'student debt', 'college tuition', 'tuition'],
  },
  '65+': {
    label: 'retirement',
    keywords: ['retirement', 'social security', 'medicare', 'pension'],
  },
};

function matchesRegion(item: NewsItem, bucket: PreferenceBucket): RelevanceTeaser | null {
  if (bucket.region === 'unspecified') {
    return null;
  }

  const sourceConfig = RSS_FEEDS.find(feed => feed.name === item.source.name);
  if (sourceConfig?.localRegion !== bucket.region) {
    return null;
  }

  return { label: REGION_LABELS[bucket.region], reason: 'region' };
}

function matchesAgeTopic(item: NewsItem, bucket: PreferenceBucket): RelevanceTeaser | null {
  const topic = AGE_TOPICS[bucket.age as Exclude<AgeBucket, 'unspecified'>];
  if (!topic) {
    return null;
  }

  const title = item.title.toLowerCase();
  const matched = topic.keywords.some(keyword => title.includes(keyword));
  return matched ? { label: topic.label, reason: 'topic' } : null;
}

// Region takes priority over topic when both would match - it's the more
// concrete, factual signal (a source literally tagged as covering that
// region) versus a keyword guess.
export function computeRelevanceTeaser(item: NewsItem, bucket: PreferenceBucket): RelevanceTeaser | null {
  return matchesRegion(item, bucket) ?? matchesAgeTopic(item, bucket);
}
