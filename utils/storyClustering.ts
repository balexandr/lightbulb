import { NewsItem } from '@/types/news';

// Cheap, local, zero-API-cost heuristic per docs/TECHNICAL_GUIDE.md §16.3 #1
// ("Coverage comparison view") - no AI call needed, this only reuses
// article data already fetched. Groups articles from *different* sources
// that are plausibly covering the same underlying story, based on
// significant-word overlap in the title and publish-time proximity.
// Imperfect by design (a real clustering pass is flagged as its own
// future project in §18.1) - good enough to power "here's how other
// outlets covered this" without any new cost or infrastructure.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are',
  'was', 'were', 'with', 'at', 'by', 'from', 'as', 'it', 'its', 'this',
  'that', 'has', 'have', 'had', 'be', 'been', 'after', 'over', 'into',
  'amid', 'says', 'say', 'said', 'will', 'would', 'could', 'about', 'more',
  'than', 'what', 'who', 'why', 'how', 'not', 'but', 'his', 'her', 'their',
]);

const SIMILARITY_THRESHOLD = 0.4;
const MAX_HOURS_APART = 72;

function significantWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !STOPWORDS.has(word))
  );
}

// Jaccard similarity over each title's significant words.
export function titleSimilarity(titleA: string, titleB: string): number {
  const wordsA = significantWords(titleA);
  const wordsB = significantWords(titleB);
  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersectionSize += 1;
    }
  }

  const unionSize = wordsA.size + wordsB.size - intersectionSize;
  return intersectionSize / unionSize;
}

function hoursApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

// Groups articles into clusters of 2+ items from *different* sources that
// look like the same story. Single-pass/seed-based, not transitive closure
// - simple and good enough for a "compare coverage" prompt, not meant to be
// a precise dedup.
export function groupRelatedArticles(items: NewsItem[]): NewsItem[][] {
  const assigned = new Set<string>();
  const clusters: NewsItem[][] = [];

  for (const seed of items) {
    if (assigned.has(seed.id)) {
      continue;
    }

    const cluster = [seed];
    assigned.add(seed.id);

    for (const candidate of items) {
      if (assigned.has(candidate.id)) {
        continue;
      }
      if (candidate.source.name === seed.source.name) {
        continue;
      }
      if (hoursApart(seed.publishedAt, candidate.publishedAt) > MAX_HOURS_APART) {
        continue;
      }
      if (titleSimilarity(seed.title, candidate.title) >= SIMILARITY_THRESHOLD) {
        cluster.push(candidate);
        assigned.add(candidate.id);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

// Convenience lookup for the UI: item id -> the *other* items in its
// cluster (excluding itself), or an empty array if it's not part of one.
export function buildRelatedArticlesIndex(items: NewsItem[]): Map<string, NewsItem[]> {
  const index = new Map<string, NewsItem[]>();

  for (const cluster of groupRelatedArticles(items)) {
    for (const item of cluster) {
      index.set(item.id, cluster.filter(other => other.id !== item.id));
    }
  }

  return index;
}
