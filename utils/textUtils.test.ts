import { cleanHTML, extractDomain, simpleHash } from './textUtils';

describe('cleanHTML', () => {
  it('strips tags', () => {
    expect(cleanHTML('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes named entities', () => {
    expect(cleanHTML('Tom &amp; Jerry &quot;show&quot;')).toBe('Tom & Jerry "show"');
  });

  it('decodes numeric entities', () => {
    expect(cleanHTML('&#8217;tis &#x2019;tis')).toBe('’tis ’tis');
  });

  it('trims surrounding whitespace', () => {
    expect(cleanHTML('  <p> spaced </p>  ')).toBe('spaced');
  });
});

describe('extractDomain', () => {
  it('strips the www prefix', () => {
    expect(extractDomain('https://www.bbc.co.uk/news/world')).toBe('bbc.co.uk');
  });

  it('keeps non-www hostnames as-is', () => {
    expect(extractDomain('https://techcrunch.com/feed/')).toBe('techcrunch.com');
  });

  it('returns empty string for unparseable URLs', () => {
    expect(extractDomain('not a url')).toBe('');
  });
});

describe('simpleHash', () => {
  it('is deterministic for the same input', () => {
    expect(simpleHash('https://example.com/a')).toBe(simpleHash('https://example.com/a'));
  });

  it('differs for different input', () => {
    expect(simpleHash('https://example.com/a')).not.toBe(simpleHash('https://example.com/b'));
  });

  it('never returns a negative-looking value', () => {
    expect(simpleHash('anything')).not.toMatch(/^-/);
  });
});
