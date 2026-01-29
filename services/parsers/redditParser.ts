import { REDDIT_SUBREDDITS } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { extractDomain } from '@/utils/textUtils';

export class RedditParser {
  parsePost(post: any, subreddit: typeof REDDIT_SUBREDDITS[number]): NewsItem {
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

  private extractImage(post: any): string | undefined {
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

  filterValidPosts(posts: any[]): any[] {
    return posts.filter(post => !post.stickied && !post.over_18);
  }
}

export const redditParser = new RedditParser();