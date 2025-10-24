import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const redditRouter = router({
  getPosts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
    }))
    .query(async ({ input }) => {
      try {
        // Fetch from r/soccercirclejerk using Reddit's JSON API (no auth needed)
        const response = await fetch(
          `https://www.reddit.com/r/soccercirclejerk/hot.json?limit=${input.limit}`,
          {
            headers: {
              'User-Agent': 'PostSniper/1.0',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Reddit API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform Reddit data to our format
        const posts = data.data.children.map((child: any) => {
          const post = child.data;
          return {
            id: post.id,
            title: post.title,
            author: post.author,
            subreddit: post.subreddit,
            upvotes: post.ups,
            comments: post.num_comments,
            created: post.created_utc * 1000, // Convert to milliseconds
            url: post.url,
            permalink: `https://www.reddit.com${post.permalink}`,
            thumbnail: post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' 
              ? post.thumbnail 
              : null,
            isVideo: post.is_video || false,
            postHint: post.post_hint || null,
          };
        });

        return posts;
      } catch (error) {
        console.error('Error fetching Reddit posts:', error);
        throw new Error('Failed to fetch Reddit posts');
      }
    }),
});

