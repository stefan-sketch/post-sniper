import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { redditPosts } from "../../drizzle/schema";
import { desc } from "drizzle-orm";

export const redditRouter = router({
  getPosts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(30),
    }))
    .query(async ({ input }) => {
      try {
        console.log('[Reddit] Fetching posts from database...');
        
        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Fetch posts from database, sorted by creation time
        const posts = await db
          .select()
          .from(redditPosts)
          .orderBy(desc(redditPosts.createdAt))
          .limit(input.limit);

        console.log(`[Reddit] Successfully fetched ${posts.length} posts from database`);
        
        // Transform to match frontend format
        return posts.map(post => ({
          id: post.id,
          title: post.title,
          author: post.author,
          subreddit: post.subreddit,
          upvotes: post.upvotes || 0,
          comments: post.comments || 0,
          created: post.createdAt.getTime(),
          url: post.url || '',
          permalink: post.permalink || '',
          thumbnail: post.thumbnail,
          isVideo: post.isVideo || false,
          postType: post.postType || 'text',
          domain: post.domain,
        }));
      } catch (error) {
        console.error('Error fetching Reddit posts:', error);
        throw new Error('Failed to fetch Reddit posts');
      }
    }),

  getComments: publicProcedure
    .input(z.object({
      permalink: z.string(),
      limit: z.number().min(1).max(50).default(25),
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
          })
          .sort((a: any, b: any) => b.score - a.score); // Sort by score (most popular first)

        console.log('[Reddit] Successfully fetched', comments.length, 'comments');
        return comments;
      } catch (error) {
        console.error('Error fetching Reddit comments:', error);
        throw new Error('Failed to fetch Reddit comments');
      }
    }),
});

