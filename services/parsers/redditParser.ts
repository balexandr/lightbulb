import { REDDIT_SUBREDDITS } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { extractDomain } from '@/utils/textUtils';

// Shape of a Reddit "listing" child's `data` object, trimmed to the fields
// this app actually reads. Reddit's real payload has far more fields.
export interface RedditPostRaw {
  id: string;
  title: string;
  url: string;
  score: number;
  created_utc: number;
  num_comments: number;
  stickied: boolean;
  over_18: boolean;
  thumbnail?: string;
  preview?: {
    images?: { source?: { url?: string } }[];
  };
}

export class RedditParser {
  parsePost(post: RedditPostRaw, subreddit: typeof REDDIT_SUBREDDITS[number]): NewsItem {
    return {
      id: post.id,
      title: post.title,
      url: post.url,
      score: post.score,
      source: {
        name: `r/${subreddit}`,
        icon: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
        type: 'reddit',
      },
      publishedAt: new Date(post.created_utc * 1000),
      imageUrl: this.extractImage(post),
      domain: extractDomain(post.url),
      commentCount: post.num_comments,
    };
  }

  private extractImage(post: RedditPostRaw): string | undefined {
    if (post.preview?.images?.[0]?.source?.url) {
      return post.preview.images[0].source.url.replace(/&amp;/g, '&');
    }
    
    if (post.thumbnail?.startsWith('http') && !post.thumbnail.includes('reddit.com')) {
      return post.thumbnail;
    }
    
    if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
      return post.url;
    }

    return undefined;
  }

  filterValidPosts(posts: RedditPostRaw[]): RedditPostRaw[] {
    return posts.filter(post => !post.stickied && !post.over_18);
  }
}

export const redditParser = new RedditParser();