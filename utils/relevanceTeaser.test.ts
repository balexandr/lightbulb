import { computeRelevanceTeaser } from './relevanceTeaser';
import { PreferenceBucket } from '@/services/preferencesService';
import { NewsItem } from '@/types/news';

const unspecifiedBucket: PreferenceBucket = { age: 'unspecified', stance: 'unspecified', region: 'unspecified', gender: 'unspecified' };

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'id-1',
    title: 'Something happened',
    url: 'https://example.com/story',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-01-01'),
    domain: 'example.com',
    ...overrides,
  };
}

describe('computeRelevanceTeaser', () => {
  it('returns null when nothing matches', () => {
    expect(computeRelevanceTeaser(makeItem(), unspecifiedBucket)).toBeNull();
  });

  it('returns null when the reader has no preferences set at all', () => {
    const item = makeItem({ title: 'How to plan for retirement in a shifting economy' });
    expect(computeRelevanceTeaser(item, unspecifiedBucket)).toBeNull();
  });

  describe('region signal', () => {
    it('matches a hyperlocal source tagged with the reader\'s region', () => {
      const item = makeItem({ source: { name: 'WHYY', type: 'rss' } });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, region: 'philadelphia' };

      expect(computeRelevanceTeaser(item, bucket)).toEqual({ label: 'Philadelphia', reason: 'region' });
    });

    it('does not match a hyperlocal source when the reader is in a different region', () => {
      const item = makeItem({ source: { name: 'WHYY', type: 'rss' } });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, region: 'midwest' };

      expect(computeRelevanceTeaser(item, bucket)).toBeNull();
    });

    it('does not match a national source even when the reader has a region set', () => {
      const item = makeItem({ source: { name: 'BBC', type: 'rss' } });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, region: 'philadelphia' };

      expect(computeRelevanceTeaser(item, bucket)).toBeNull();
    });

    it('does not match a source with no RSS_FEEDS entry (e.g. Reddit)', () => {
      const item = makeItem({ source: { name: 'r/philadelphia', type: 'reddit' } });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, region: 'philadelphia' };

      expect(computeRelevanceTeaser(item, bucket)).toBeNull();
    });
  });

  describe('age-topic signal', () => {
    it('matches a retirement-related headline for a 65+ reader', () => {
      const item = makeItem({ title: 'Social Security cost-of-living increase announced' });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, age: '65+' };

      expect(computeRelevanceTeaser(item, bucket)).toEqual({ label: 'retirement', reason: 'topic' });
    });

    it('matches a student-loan headline for an 18-24 reader', () => {
      const item = makeItem({ title: 'New student loan forgiveness rules take effect' });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, age: '18-24' };

      expect(computeRelevanceTeaser(item, bucket)).toEqual({ label: 'student loans', reason: 'topic' });
    });

    it('is case-insensitive', () => {
      const item = makeItem({ title: 'MEDICARE premiums rise next year' });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, age: '65+' };

      expect(computeRelevanceTeaser(item, bucket)).toEqual({ label: 'retirement', reason: 'topic' });
    });

    it('does not match a retirement headline for a reader outside the 65+ bucket', () => {
      const item = makeItem({ title: 'Social Security cost-of-living increase announced' });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, age: '25-34' };

      expect(computeRelevanceTeaser(item, bucket)).toBeNull();
    });

    it('has no topic keywords for age brackets outside 18-24 and 65+', () => {
      const item = makeItem({ title: 'Everything: student loan retirement medicare tuition pension' });
      const bucket: PreferenceBucket = { ...unspecifiedBucket, age: '35-44' };

      expect(computeRelevanceTeaser(item, bucket)).toBeNull();
    });

    it('never uses political stance as a signal', () => {
      const item = makeItem({ title: 'Immigration policy debate intensifies in Congress' });
      const bucket: PreferenceBucket = { age: 'unspecified', stance: 'progressive', region: 'unspecified', gender: 'unspecified' };

      expect(computeRelevanceTeaser(item, bucket)).toBeNull();
    });
  });

  it('prefers the region signal over the age-topic signal when both would match', () => {
    const item = makeItem({
      title: 'Local retirement community faces zoning dispute',
      source: { name: 'WHYY', type: 'rss' },
    });
    const bucket: PreferenceBucket = { age: '65+', stance: 'unspecified', region: 'philadelphia', gender: 'unspecified' };

    expect(computeRelevanceTeaser(item, bucket)).toEqual({ label: 'Philadelphia', reason: 'region' });
  });
});
