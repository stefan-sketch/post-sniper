import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { twitterPosts } from "../../drizzle/schema";
import { desc, sql } from "drizzle-orm";

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_LIST_ID = "1750840026051596582";

export const twitterRouter = router({
  // Fetch tweets from Twitter API and store in database
  fetchAndStoreListTweets: publicProcedure
    .mutation(async () => {
      if (!TWITTER_API_KEY) {
        throw new Error("Twitter API key not configured");
      }

      const url = new URL("https://api.twitterapi.io/twitter/list/tweets");
      url.searchParams.append("listId", TWITTER_LIST_ID);

      const response = await fetch(url.toString(), {
        headers: {
          "x-api-key": TWITTER_API_KEY,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Twitter API error:", error);
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Store tweets in database
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      if (data.tweets && data.tweets.length > 0) {
        for (const tweet of data.tweets as any[]) {
          // Skip replies (tweets starting with @)
          if (tweet.text && tweet.text.trim().startsWith('@')) {
            continue;
          }
          
          // Get image if available (optional)
          const image = tweet.extendedEntities?.media?.[0]?.media_url_https || 
                       tweet.entities?.media?.[0]?.media_url_https || null;

          await db
            .insert(twitterPosts)
            .values({
              id: tweet.id,
              text: tweet.text,
              image,
              authorName: tweet.author?.name || "Unknown",
              authorUsername: tweet.author?.userName || "",
              authorAvatar: tweet.author?.profilePicture || "",
              likes: tweet.likeCount || 0,
              retweets: tweet.retweetCount || 0,
              replies: tweet.replyCount || 0,
              views: tweet.viewCount || 0,
              url: tweet.url || `https://twitter.com/i/web/status/${tweet.id}`,
              createdAt: new Date(tweet.createdAt),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: twitterPosts.id,
              set: {
                likes: tweet.likeCount || 0,
                retweets: tweet.retweetCount || 0,
                replies: tweet.replyCount || 0,
                views: tweet.viewCount || 0,
                updatedAt: new Date(),
              },
            });
        }
      }

      return { success: true, count: data.tweets?.length || 0 };
    }),

  // Get tweets from database
  getListTweets: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
        timeFilter: z.enum(['live', '2hr', '6hr', 'today']).optional().default('2hr'),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return { tweets: [], hasNextPage: false, nextCursor: null };
      }
      
      // Calculate time threshold based on filter
      const now = new Date();
      let timeThreshold: Date;
      
      if (input.timeFilter === 'live') {
        // LIVE: Show all tweets from last 24 hours, sorted by newest first
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (input.timeFilter === '2hr') {
        timeThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      } else if (input.timeFilter === '6hr') {
        timeThreshold = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      } else { // 'today'
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        timeThreshold = today;
      }
      
      // Fetch tweets from database
      let tweets = await db
        .select()
        .from(twitterPosts)
        .where(sql`${twitterPosts.createdAt} >= ${timeThreshold.toISOString()}`);
      
      // Sort in JavaScript for more reliable sorting
      if (input.timeFilter === 'live') {
        // Sort by newest first
        tweets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        // Sort by total engagement (likes + retweets + replies + views)
        tweets.sort((a, b) => {
          const engagementA = (a.likes || 0) + (a.retweets || 0) + (a.replies || 0) + (a.views || 0);
          const engagementB = (b.likes || 0) + (b.retweets || 0) + (b.replies || 0) + (b.views || 0);
          return engagementB - engagementA; // Descending order
        });
        
        // Debug: Log top 3 tweets with engagement data
        console.log('[Twitter] Top 3 tweets by engagement:');
        tweets.slice(0, 3).forEach((tweet, i) => {
          const total = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0) + (tweet.views || 0);
          console.log(`  ${i + 1}. Likes: ${tweet.likes}, Retweets: ${tweet.retweets}, Replies: ${tweet.replies}, Views: ${tweet.views}, Total: ${total}`);
        });
      }
      
      // Limit results after sorting
      tweets = tweets.slice(0, input.limit);

      // Transform to match expected format
      const formattedTweets = tweets.map((tweet) => ({
        id: tweet.id,
        platform: "twitter" as const,
        text: tweet.text,
        image: tweet.image,
        author: {
          name: tweet.authorName,
          username: tweet.authorUsername,
          avatar: tweet.authorAvatar,
        },
        engagement: {
          likes: tweet.likes || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0,
          views: tweet.views || 0,
        },
        url: tweet.url,
        createdAt: tweet.createdAt.toISOString(),
      }));

      return {
        tweets: formattedTweets,
        hasNextPage: false,
        nextCursor: null,
      };
    }),
});

