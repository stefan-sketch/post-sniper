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
        console.log('[Reddit] Fetching posts from Reddit API...');
        
        const subreddits = ['soccercirclejerk', 'Championship', 'PremierLeague', 'soccermemes'];
        const allPosts: any[] = [];
        
        for (const subreddit of subreddits) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(
              `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`,
              {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/json',
                  'Accept-Language': 'en-US,en;q=0.9',
                },
                signal: controller.signal,
              }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              console.warn(`[Reddit] Failed to fetch r/${subreddit}: ${response.status}`);
              continue;
            }
            
            const data = await response.json();
            const children = data.data?.children || [];
            
            const subredditPosts = children
              .filter((child: any) => !child.data.is_video && child.data.post_hint !== 'hosted:video')
              .map((child: any) => {
                const post = child.data;
                
                // Determine post type
                let postType: 'image' | 'link' | 'text' = 'text';
                let domain = post.domain;
                
                if (post.post_hint === 'image' || post.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  postType = 'image';
                } else if (post.url && post.url !== post.permalink && !post.is_self) {
                  postType = 'link';
                }
                
                // Try to extract image from preview
                let thumbnail = null;
                if (post.preview?.images?.[0]?.source?.url) {
                  thumbnail = post.preview.images[0].source.url.replace(/&amp;/g, '&');
                } else if (post.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                  thumbnail = post.url;
                } else if (post.thumbnail && post.thumbnail.startsWith('http')) {
                  thumbnail = post.thumbnail;
                }
                
                return {
                  id: post.id,
                  title: post.title,
                  author: post.author,
                  subreddit: post.subreddit,
                  upvotes: post.ups || 0,
                  comments: post.num_comments || 0,
                  created: post.created_utc * 1000,
                  url: post.url || '',
                  permalink: post.permalink || '',
                  thumbnail,
                  isVideo: false,
                  postType,
                  domain,
                };
              });
            
            allPosts.push(...subredditPosts);
          } catch (err) {
            console.warn(`[Reddit] Error fetching r/${subreddit}:`, err);
          }
        }
        
        // Sort by hot (combination of upvotes and recency)
        allPosts.sort((a, b) => {
          const aScore = a.upvotes / Math.pow((Date.now() - a.created) / 3600000 + 2, 1.5);
          const bScore = b.upvotes / Math.pow((Date.now() - b.created) / 3600000 + 2, 1.5);
          return bScore - aScore;
        });
        
        console.log(`[Reddit] Successfully fetched ${allPosts.length} posts from ${subreddits.length} subreddits`);
        
        // If no posts fetched, return empty array but don't throw error
        if (allPosts.length === 0) {
          console.warn('[Reddit] No posts fetched from any subreddit');
          return [];
        }
        
        return allPosts.slice(0, input.limit);
      } catch (error) {
        console.error('[Reddit] Error fetching Reddit posts:', error);
        return [];
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

