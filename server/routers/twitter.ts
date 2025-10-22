import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { twitterPosts } from "../../drizzle/schema";
import { desc } from "drizzle-orm";

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
          // Only store tweets with images
          const image = tweet.extendedEntities?.media?.[0]?.media_url_https || 
                       tweet.entities?.media?.[0]?.media_url_https;
          
          if (!image) continue;

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
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return { tweets: [], hasNextPage: false, nextCursor: null };
      }
      
      const tweets = await db
        .select()
        .from(twitterPosts)
        .orderBy(desc(twitterPosts.createdAt))
        .limit(input.limit);

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

