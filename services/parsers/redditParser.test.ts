import { redditParser } from './redditParser';

function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 'abc123',
    title: 'Some headline',
    url: 'https://example.com/story',
    score: 42,
    created_utc: 1700000000,
    num_comments: 7,
    stickied: false,
    over_18: false,
    ...overrides,
  };
}

describe('RedditParser.parsePost', () => {
  it('maps a plain post to a NewsItem', () => {
    const item = redditParser.parsePost(makePost(), 'worldnews');

    expect(item.id).toBe('abc123');
    expect(item.title).toBe('Some headline');
    expect(item.url).toBe('https://example.com/story');
    expect(item.score).toBe(42);
    expect(item.commentCount).toBe(7);
    expect(item.source).toEqual({
      name: 'r/worldnews',
      icon: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
      type: 'reddit',
    });
    expect(item.publishedAt.getTime()).toBe(1700000000 * 1000);
  });

  it('prefers the post preview image and unescapes &amp;', () => {
    const item = redditParser.parsePost(
      makePost({
        preview: {
          images: [{ source: { url: 'https://example.com/img.jpg?a=1&amp;b=2' } }],
        },
      }),
      'worldnews'
    );

    expect(item.imageUrl).toBe('https://example.com/img.jpg?a=1&b=2');
  });

  it('falls back to a non-reddit thumbnail', () => {
    const item = redditParser.parsePost(
      makePost({ thumbnail: 'https://external.example.com/thumb.jpg' }),
      'worldnews'
    );

    expect(item.imageUrl).toBe('https://external.example.com/thumb.jpg');
  });

  it('ignores reddit-hosted thumbnails like "self" or "default"', () => {
    const item = redditParser.parsePost(makePost({ thumbnail: 'self' }), 'worldnews');
    expect(item.imageUrl).toBeUndefined();
  });

  it('falls back to a direct image link', () => {
    const item = redditParser.parsePost(
      makePost({ url: 'https://example.com/photo.png', thumbnail: 'self' }),
      'worldnews'
    );

    expect(item.imageUrl).toBe('https://example.com/photo.png');
  });
});

describe('RedditParser.filterValidPosts', () => {
  it('drops stickied and NSFW posts', () => {
    const posts = [
      makePost({ id: 'a' }),
      makePost({ id: 'b', stickied: true }),
      makePost({ id: 'c', over_18: true }),
      makePost({ id: 'd' }),
    ];

    const valid = redditParser.filterValidPosts(posts);
    expect(valid.map(p => p.id)).toEqual(['a', 'd']);
  });
});
