import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_LIST_ID = "1750840026051596582";

export const twitterRouter = router({
  getListTweets: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      if (!TWITTER_API_KEY) {
        throw new Error("Twitter API key not configured");
      }

      const url = new URL("https://api.twitterapi.io/twitter/list/tweets");
      url.searchParams.append("listId", TWITTER_LIST_ID);
      if (input.cursor) {
        url.searchParams.append("cursor", input.cursor);
      }

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
      
      // Transform Twitter data to match our post format
      const tweets = data.tweets?.map((tweet: any) => ({
        id: tweet.id,
        platform: "twitter" as const,
        text: tweet.text,
        image: tweet.extendedEntities?.media?.[0]?.media_url_https || tweet.entities?.media?.[0]?.media_url_https || null,
        author: {
          name: tweet.author?.name || "Unknown",
          username: tweet.author?.userName || "",
          avatar: tweet.author?.profilePicture || "",
        },
        engagement: {
          likes: tweet.likeCount || 0,
          retweets: tweet.retweetCount || 0,
          replies: tweet.replyCount || 0,
          views: tweet.viewCount || 0,
        },
        url: tweet.url || `https://twitter.com/i/web/status/${tweet.id}`,
        createdAt: tweet.createdAt,
      })) || [];

      return {
        tweets,
        hasNextPage: data.has_next_page || false,
        nextCursor: data.next_cursor || null,
      };
    }),
});

