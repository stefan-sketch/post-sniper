import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const redditRouter = router({
  getPosts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(25),
    }))
    .query(async ({ input }) => {
      try {
        console.log('[Reddit] Fetching posts from r/soccercirclejerk...');
        
        // Fetch from r/soccercirclejerk using Reddit's JSON API (no auth needed)
        const response = await fetch(
          `https://www.reddit.com/r/soccercirclejerk/hot.json?limit=${input.limit}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PostSniper/1.0)',
            },
          }
        );

        console.log('[Reddit] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Reddit] API error:', response.status, errorText);
          throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[Reddit] Successfully fetched', data.data?.children?.length || 0, 'posts');
        
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

  getComments: publicProcedure
    .input(z.object({
      permalink: z.string(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      try {
        console.log('[Reddit] Fetching comments for:', input.permalink);
        
        const response = await fetch(
          `https://www.reddit.com${input.permalink}.json?limit=${input.limit}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PostSniper/1.0)',
            },
          }
        );

        console.log('[Reddit] Comments response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Reddit] Comments API error:', response.status, errorText);
          throw new Error(`Reddit API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Reddit returns [post, comments] array
        const commentsData = data[1]?.data?.children || [];
        
        const comments = commentsData
          .filter((child: any) => child.kind === 't1') // Filter out "more" objects
          .map((child: any) => {
            const comment = child.data;
            return {
              id: comment.id,
              author: comment.author,
              body: comment.body,
              score: comment.score,
              created: comment.created_utc * 1000,
            };
          });

        console.log('[Reddit] Successfully fetched', comments.length, 'comments');
        return comments;
      } catch (error) {
        console.error('Error fetching Reddit comments:', error);
        throw new Error('Failed to fetch Reddit comments');
      }
    }),
});

