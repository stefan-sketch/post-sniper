import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import axios from "axios";
import { getDb, getUserSettings } from "../db";
import { monitoredPages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const PUBLIC_USER_ID = "public";

export const facebookRouter = router({
  // Get posts for a specific Facebook page
  getPagePosts: publicProcedure
    .input(z.object({
      pageId: z.string(), // monitored page ID
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        // Get page configuration
        const page = await db
          .select()
          .from(monitoredPages)
          .where(eq(monitoredPages.id, input.pageId))
          .limit(1);

        if (!page || page.length === 0) {
          throw new Error("Page not found");
        }

        const pageConfig = page[0];

        // Get API token from settings
        const settings = await getUserSettings(PUBLIC_USER_ID);
        const apiToken = settings?.fanpageKarmaToken;

        if (!apiToken) {
          throw new Error("Fanpage Karma API token not configured");
        }

        // Fetch posts from Fanpage Karma API
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}${month}${day}`;
        };

        const startDate = formatDate(sevenDaysAgo);
        const endDate = formatDate(today);
        const period = `${startDate}_${endDate}`;

        const url = `https://app.fanpagekarma.com/api/v1/facebook/${pageConfig.profileId}/posts?token=${apiToken}&period=${period}`;
        
        console.log(`[Facebook] Fetching posts for ${pageConfig.profileName} (${pageConfig.profileId})`);
        
        const response = await axios.get(url);
        
        if (!response.data || !response.data.data) {
          throw new Error("Invalid response from Fanpage Karma API");
        }

        const posts = response.data.data.slice(0, input.limit).map((post: any) => ({
          id: post.id,
          message: post.message || "",
          image: post.image || null,
          link: post.link || `https://facebook.com/${post.id}`,
          postDate: new Date(post.date),
          reactions: post.kpi?.reactions || 0,
          comments: post.kpi?.comments || 0,
          shares: post.kpi?.shares || 0,
          pageId: pageConfig.id,
          pageName: pageConfig.profileName,
          borderColor: pageConfig.borderColor,
          profilePicture: pageConfig.profilePicture,
        }));

        console.log(`[Facebook] Found ${posts.length} posts for ${pageConfig.profileName}`);

        return {
          success: true,
          posts,
          pageConfig: {
            id: pageConfig.id,
            name: pageConfig.profileName,
            borderColor: pageConfig.borderColor,
            profilePicture: pageConfig.profilePicture,
            publerPageId: pageConfig.publerPageId,
          },
        };
      } catch (error: any) {
        console.error("[Facebook] Error fetching posts:", error);
        return {
          success: false,
          error: error.message || "Failed to fetch posts",
          posts: [],
        };
      }
    }),
});

