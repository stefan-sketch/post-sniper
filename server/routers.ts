import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { nanoid } from "nanoid";
import { cachedPostsRouter } from "./routers/cachedPosts";
import { manualFetchRouter } from "./routers/manualFetch";
import { publerRouter } from "./routers/publer";

// Fixed user ID for public access
const PUBLIC_USER_ID = "public";

export const appRouter = router({
  system: systemRouter,
  cachedPosts: cachedPostsRouter,
  manualFetch: manualFetchRouter,
  publer: publerRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  pages: router({
    list: publicProcedure.query(async () => {
      return await db.getMonitoredPages(PUBLIC_USER_ID);
    }),

    create: publicProcedure
      .input(z.object({
        profileId: z.string(),
        profileName: z.string(),
        profilePicture: z.string().optional(),
        borderColor: z.string(),
        network: z.string().default("facebook"),
        alertThreshold: z.number().default(100),
        alertEnabled: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const page = await db.createMonitoredPage({
          id: nanoid(),
          userId: PUBLIC_USER_ID,
          ...input,
        });
        return page;
      }),

    update: publicProcedure
      .input(z.object({
        id: z.string(),
        profileName: z.string().optional(),
        profilePicture: z.string().optional(),
        borderColor: z.string().optional(),
        alertThreshold: z.number().optional(),
        alertEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateMonitoredPage(input.id, input);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteMonitoredPage(input.id);
        return { success: true };
      }),
  }),

  settings: router({
    get: publicProcedure.query(async () => {
      const settings = await db.getUserSettings(PUBLIC_USER_ID);
      // Return default settings if none exist
      if (!settings) {
        return {
          userId: PUBLIC_USER_ID,
          autoRefreshEnabled: true,
          refreshInterval: 600,
          useMockData: false,
          isPlaying: false,
          lastFetchedAt: null,
          lastAPIStatus: "success",
          dismissedPosts: null,
        };
      }
      return settings;
    }),

    update: publicProcedure
      .input(z.object({
        fanpageKarmaToken: z.string().optional(),
        autoRefreshEnabled: z.boolean().optional(),
        refreshInterval: z.number().optional(),
        useMockData: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertUserSettings({ userId: PUBLIC_USER_ID, ...input });
        return { success: true };
      }),

    setPlaying: publicProcedure
      .input(z.object({
        isPlaying: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertUserSettings({ userId: PUBLIC_USER_ID, isPlaying: input.isPlaying });
        return { success: true };
      }),

    updateLastFetched: publicProcedure
      .mutation(async () => {
        await db.upsertUserSettings({ userId: PUBLIC_USER_ID, lastFetchedAt: new Date() });
        return { success: true };
      }),

    dismissPost: publicProcedure
      .input(z.object({
        postId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const settings = await db.getUserSettings(PUBLIC_USER_ID);
        const dismissed = settings?.dismissedPosts ? JSON.parse(settings.dismissedPosts) : [];
        if (!dismissed.includes(input.postId)) {
          dismissed.push(input.postId);
        }
        await db.upsertUserSettings({ userId: PUBLIC_USER_ID, dismissedPosts: JSON.stringify(dismissed) });
        return { success: true };
      }),

    clearAllPosts: publicProcedure
      .mutation(async () => {
        await db.clearAllCachedPosts();
        return { success: true };
      }),
  }),

  posts: router({
    fetch: publicProcedure
      .input(z.object({
        profileId: z.string(),
        network: z.string().default("facebook"),
      }))
      .query(async ({ input }) => {
        const settings = await db.getUserSettings(PUBLIC_USER_ID);
        const useMockData = settings?.useMockData ?? false;
        const apiToken = settings?.fanpageKarmaToken;

        if (useMockData || !apiToken) {
          // Return mock data
          const { generateMockPosts } = await import("./mockData");
          return generateMockPosts(parseInt(input.profileId));
        }

        // Fetch real data from Fanpage Karma API
        // Calculate date range for last 24 hours
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const endDate = now.toISOString().split('T')[0];
        const startDate = yesterday.toISOString().split('T')[0];
        
        const response = await fetch(
          `https://app.fanpagekarma.com/api/v1/${input.network}/${input.profileId}/posts?token=${apiToken}&period=${startDate}_${endDate}`,
          { method: "GET" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch posts from Fanpage Karma API");
        }

        return await response.json();
      }),

    fetchAll: publicProcedure.query(async () => {
        const pages = await db.getMonitoredPages(PUBLIC_USER_ID);
        const settings = await db.getUserSettings(PUBLIC_USER_ID);
        const useMockData = settings?.useMockData ?? false;
        const apiToken = settings?.fanpageKarmaToken;

        if (useMockData || !apiToken) {
          // Return mock data for all pages
          const { generateMockPosts } = await import("./mockData");
          return pages.map(page => ({
            pageId: page.profileId,
            pageName: page.profileName,
            borderColor: page.borderColor,
            profilePicture: page.profilePicture,
            alertThreshold: page.alertThreshold,
            alertEnabled: page.alertEnabled,
            data: generateMockPosts(parseInt(page.profileId)),
          }));
        }

        // Fetch real data from Fanpage Karma API for all pages
        // Calculate date range for last 24 hours
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const endDate = now.toISOString().split('T')[0];
        const startDate = yesterday.toISOString().split('T')[0];
        
        const results = await Promise.allSettled(
          pages.map(async (page) => {
            const response = await fetch(
              `https://app.fanpagekarma.com/api/v1/${page.network}/${page.profileId}/posts?token=${apiToken}&period=${startDate}_${endDate}`,
              { method: "GET" }
            );

            if (!response.ok) {
              throw new Error(`Failed to fetch posts for ${page.profileName}`);
            }

            const data = await response.json();
            return {
              pageId: page.profileId,
              pageName: page.profileName,
              borderColor: page.borderColor,
              profilePicture: page.profilePicture,
              alertThreshold: page.alertThreshold,
              alertEnabled: page.alertEnabled,
              ...data,
            };
          })
        );

        return results
          .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
          .map(result => result.value);
      }),

    checkApi: publicProcedure.query(async () => {
        const settings = await db.getUserSettings(PUBLIC_USER_ID);
        const useMockData = settings?.useMockData ?? false;
        const apiToken = settings?.fanpageKarmaToken;

        // Mock data mode always returns success
        if (useMockData || !apiToken) {
          return { status: "success", message: "Using mock data" };
        }

        try {
          // Test API with a simple request
          const response = await fetch(
            `https://app.fanpagekarma.com/api/v1/facebook/6815841748/kpi?token=${apiToken}`,
            { method: "HEAD" }
          );
          
          return {
            status: response.ok ? "success" : "error",
            message: response.ok ? "API is working" : "API request failed"
          };
        } catch (error) {
          return { status: "error", message: "Failed to connect to API" };
        }
      }),
  }),

  alerts: router({
    list: publicProcedure.query(async () => {
      return await db.getAlerts(PUBLIC_USER_ID);
    }),

    create: publicProcedure
      .input(z.object({
        pageId: z.string(),
        postId: z.string(),
        postLink: z.string().optional(),
        postMessage: z.string().optional(),
        postImage: z.string().optional(),
        reactionCount: z.number(),
        threshold: z.number(),
        postDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createAlert({
          id: nanoid(),
          userId: PUBLIC_USER_ID,
          ...input,
        });
        return { success: true };
      }),

    markRead: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.markAlertAsRead(input.id);
        return { success: true };
      }),

    unreadCount: publicProcedure.query(async () => {
      return await db.getUnreadAlertCount(PUBLIC_USER_ID);
    }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteAlert(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

