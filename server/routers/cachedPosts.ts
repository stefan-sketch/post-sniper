import { router, publicProcedure } from "../_core/trpc";
import { getDb, getUserSettings } from "../db";
import { cachedPosts } from "../../drizzle/schema";
import { desc, and, gte } from "drizzle-orm";

const PUBLIC_USER_ID = "public";

export const cachedPostsRouter = router({
  /**
   * Get all cached posts (replaces client-side fetching)
   */
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return { posts: [], lastFetchedAt: null };
    }

    try {
      // Get all posts from last 24 hours, sorted by date desc
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const posts = await db
        .select()
        .from(cachedPosts)
        .where(gte(cachedPosts.postDate, oneDayAgo))
        .orderBy(desc(cachedPosts.postDate));

      // Get last fetched time
      const settings = await getUserSettings(PUBLIC_USER_ID);

      return {
        posts: posts.map((post) => ({
          id: post.id,
          pageId: post.pageId,
          pageName: post.pageName,
          borderColor: post.borderColor,
          profilePicture: post.profilePicture,
          message: post.message,
          image: post.image,
          link: post.link,
          postDate: post.postDate,
          reactions: post.reactions || 0,
          comments: post.comments || 0,
          shares: post.shares || 0,
          alertThreshold: post.alertThreshold,
          alertEnabled: post.alertEnabled,
        })),
        lastFetchedAt: settings?.lastFetchedAt || null,
      };
    } catch (error) {
      console.error("[CachedPosts] Error fetching posts:", error);
      return { posts: [], lastFetchedAt: null };
    }
  }),
});

