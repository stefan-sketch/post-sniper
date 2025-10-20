import { router, publicProcedure } from "../_core/trpc";
import { getDb, getUserSettings } from "../db";
import { cachedPosts, monitoredPages } from "../../drizzle/schema";
import { desc, and, gte, eq } from "drizzle-orm";

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
      
      // Join cached posts with monitored pages to get current page settings
      const posts = await db
        .select({
          id: cachedPosts.id,
          pageId: cachedPosts.pageId,
          pageName: monitoredPages.profileName,
          borderColor: monitoredPages.borderColor,
          profilePicture: monitoredPages.profilePicture,
          message: cachedPosts.message,
          image: cachedPosts.image,
          link: cachedPosts.link,
          postDate: cachedPosts.postDate,
          reactions: cachedPosts.reactions,
          comments: cachedPosts.comments,
          shares: cachedPosts.shares,
          alertThreshold: monitoredPages.alertThreshold,
          alertEnabled: monitoredPages.alertEnabled,
        })
        .from(cachedPosts)
        .leftJoin(monitoredPages, eq(cachedPosts.pageId, monitoredPages.id))
        .where(gte(cachedPosts.postDate, oneDayAgo))
        .orderBy(desc(cachedPosts.postDate));

      // Get last fetched time
      const settings = await getUserSettings(PUBLIC_USER_ID);

      return {
        posts: posts.map((post) => ({
          id: post.id,
          pageId: post.pageId,
          pageName: post.pageName || '',
          borderColor: post.borderColor || '#22d3ee',
          profilePicture: post.profilePicture || null,
          message: post.message,
          image: post.image,
          link: post.link,
          postDate: post.postDate,
          reactions: post.reactions || 0,
          comments: post.comments || 0,
          shares: post.shares || 0,
          alertThreshold: post.alertThreshold || 100,
          alertEnabled: post.alertEnabled ?? true,
        })),
        lastFetchedAt: settings?.lastFetchedAt || null,
      };
    } catch (error) {
      console.error("[CachedPosts] Error fetching posts:", error);
      return { posts: [], lastFetchedAt: null };
    }
  }),
});

