import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
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
      
      console.log('[CachedPosts] Fetching posts from database...');
      
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
          previousReactions: cachedPosts.previousReactions,
          comments: cachedPosts.comments,
          shares: cachedPosts.shares,
          alertThreshold: monitoredPages.alertThreshold,
          alertEnabled: monitoredPages.alertEnabled,
        })
        .from(cachedPosts)
        .leftJoin(monitoredPages, eq(cachedPosts.pageId, monitoredPages.id))
        .where(gte(cachedPosts.postDate, oneDayAgo))
        .orderBy(desc(cachedPosts.postDate));

      console.log(`[CachedPosts] Found ${posts.length} posts in database`);
      if (posts.length > 0) {
        console.log('[CachedPosts] Sample post:', JSON.stringify(posts[0], null, 2));
      }

      // Get last fetched time
      const settings = await getUserSettings(PUBLIC_USER_ID);
      console.log('[CachedPosts] Last fetched at:', settings?.lastFetchedAt);

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
          previousReactions: post.previousReactions || 0,
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

  /**
   * Get cached posts for a specific page
   */
  getByPage: publicProcedure
    .input(z.object({
      pageId: z.string(),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return { posts: [], pageConfig: null };
      }

      try {
        // Get posts from last 7 days for this specific page
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        console.log(`[CachedPosts] Fetching posts for page ${input.pageId}...`);
        
        // Get page config
        const pageData = await db
          .select()
          .from(monitoredPages)
          .where(eq(monitoredPages.id, input.pageId))
          .limit(1);

        if (!pageData || pageData.length === 0) {
          return { posts: [], pageConfig: null };
        }

        const pageConfig = pageData[0];
        
        // Get posts for this page
        const posts = await db
          .select({
            id: cachedPosts.id,
            pageId: cachedPosts.pageId,
            message: cachedPosts.message,
            image: cachedPosts.image,
            link: cachedPosts.link,
            postDate: cachedPosts.postDate,
            reactions: cachedPosts.reactions,
            comments: cachedPosts.comments,
            shares: cachedPosts.shares,
          })
          .from(cachedPosts)
          .where(
            and(
              eq(cachedPosts.pageId, input.pageId),
              gte(cachedPosts.postDate, sevenDaysAgo)
            )
          )
          .orderBy(desc(cachedPosts.postDate))
          .limit(input.limit);

        console.log(`[CachedPosts] Found ${posts.length} posts for page ${input.pageId}`);

        return {
          posts: posts.map((post) => ({
            id: post.id,
            pageId: post.pageId,
            message: post.message,
            image: post.image,
            link: post.link,
            postDate: post.postDate,
            reactions: post.reactions || 0,
            comments: post.comments || 0,
            shares: post.shares || 0,
          })),
          pageConfig: {
            id: pageConfig.id,
            name: pageConfig.profileName,
            borderColor: pageConfig.borderColor,
            profilePicture: pageConfig.profilePicture,
          },
        };
      } catch (error) {
        console.error(`[CachedPosts] Error fetching posts for page ${input.pageId}:`, error);
        return { posts: [], pageConfig: null };
      }
    }),
});

