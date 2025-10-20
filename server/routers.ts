import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,

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
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMonitoredPages(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        profileId: z.string(),
        profileName: z.string(),
        profilePicture: z.string().optional(),
        borderColor: z.string(),
        network: z.string().default("facebook"),
        alertThreshold: z.number().default(100),
        alertEnabled: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const page = await db.createMonitoredPage({
          id: nanoid(),
          userId: ctx.user.id,
          ...input,
        });
        return page;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        profileName: z.string().optional(),
        profilePicture: z.string().optional(),
        borderColor: z.string().optional(),
        alertThreshold: z.number().optional(),
        alertEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateMonitoredPage(id, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteMonitoredPage(input.id);
        return { success: true };
      }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSettings(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        fanpageKarmaToken: z.string().optional(),
        autoRefreshEnabled: z.boolean().optional(),
        refreshInterval: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserSettings({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
  }),

  posts: router({
    fetch: protectedProcedure
      .input(z.object({
        profileId: z.string(),
        network: z.string().default("facebook"),
        period: z.string().optional(), // format: YYYY-MM-DD_YYYY-MM-DD
      }))
      .query(async ({ ctx, input }) => {
        // Get user's API token
        const settings = await db.getUserSettings(ctx.user.id);
        if (!settings?.fanpageKarmaToken) {
          throw new Error("Fanpage Karma API token not configured");
        }

        // Build API URL
        const baseUrl = "https://app.fanpagekarma.com/api/v1";
        const { profileId, network, period } = input;
        let url = `${baseUrl}/${network}/${profileId}/posts?token=${settings.fanpageKarmaToken}`;
        
        if (period) {
          url += `&period=${period}`;
        }

        // Fetch posts from Fanpage Karma API
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fanpage Karma API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      }),

    fetchAll: protectedProcedure.query(async ({ ctx }) => {
      const pages = await db.getMonitoredPages(ctx.user.id);
      const settings = await db.getUserSettings(ctx.user.id);
      
      if (!settings?.fanpageKarmaToken) {
        throw new Error("Fanpage Karma API token not configured");
      }

      const baseUrl = "https://app.fanpagekarma.com/api/v1";
      const results = await Promise.allSettled(
        pages.map(async (page) => {
          const url = `${baseUrl}/${page.network}/${page.profileId}/posts?token=${settings.fanpageKarmaToken}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch posts for ${page.profileName}`);
          }
          
          const data = await response.json();
          return {
            pageId: page.id,
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

    checkApi: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getUserSettings(ctx.user.id);
      
      if (!settings?.fanpageKarmaToken) {
        return { status: "error", message: "API token not configured" };
      }

      try {
        // Test API with a simple request
        const response = await fetch(
          `https://app.fanpagekarma.com/api/v1/facebook/6815841748/kpi?token=${settings.fanpageKarmaToken}`,
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
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAlerts(ctx.user.id);
    }),

    create: protectedProcedure
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
      .mutation(async ({ ctx, input }) => {
        await db.createAlert({
          id: nanoid(),
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.markAlertAsRead(input.id);
        return { success: true };
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadAlertCount(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;

