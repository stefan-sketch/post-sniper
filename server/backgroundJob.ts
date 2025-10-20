import { getDb, getUserSettings, getMonitoredPages, createAlert } from "./db";
import { cachedPosts, InsertCachedPost } from "../drizzle/schema";
import axios from "axios";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";

const PUBLIC_USER_ID = "public";

/**
 * Background job that fetches posts from Fanpage Karma API
 * and stores them in the database for all users to access
 */
export class BackgroundJobService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  async start() {
    if (this.isRunning) {
      console.log("[BackgroundJob] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[BackgroundJob] Starting background job service");

    // Run immediately on start
    await this.fetchAndCachePosts();

    // Then run every 10 minutes
    this.intervalId = setInterval(async () => {
      await this.fetchAndCachePosts();
    }, 10 * 60 * 1000); // 10 minutes
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("[BackgroundJob] Stopped background job service");
  }

  async fetchAndCachePosts() {
    try {
      console.log("[BackgroundJob] Fetching posts...");
      
      const settings = await getUserSettings(PUBLIC_USER_ID);
      const apiToken = settings?.fanpageKarmaToken || ENV.fanpageKarmaToken;
      
      if (!apiToken) {
        console.log("[BackgroundJob] No API token configured");
        return;
      }

      const pages = await getMonitoredPages(PUBLIC_USER_ID);
      if (pages.length === 0) {
        console.log("[BackgroundJob] No monitored pages configured");
        return;
      }

      const db = await getDb();
      if (!db) {
        console.error("[BackgroundJob] Database not available");
        return;
      }

      // Fetch posts for each page
      for (const page of pages) {
        try {
          const posts = await this.fetchPostsForPage(
            page.profileId,
            apiToken
          );

          // Cache each post
          for (const post of posts) {
            const cachedPost: InsertCachedPost = {
              id: post.id,
              pageId: page.id,
              pageName: page.profileName,
              borderColor: page.borderColor,
              profilePicture: page.profilePicture || null,
              message: post.message || null,
              image: post.image || null,
              link: post.link || null,
              postDate: new Date(post.date),
              reactions: post.kpi?.page_posts_reactions?.value || 0,
              comments: post.kpi?.page_posts_comments_count?.value || 0,
              shares: post.kpi?.page_posts_shares_count?.value || 0,
              alertThreshold: page.alertThreshold || null,
              alertEnabled: page.alertEnabled || false,
              updatedAt: new Date(),
            };

            // Upsert cached post
            await db
              .insert(cachedPosts)
              .values(cachedPost)
              .onConflictDoUpdate({
                target: cachedPosts.id,
                set: {
                  reactions: cachedPost.reactions,
                  comments: cachedPost.comments,
                  shares: cachedPost.shares,
                  updatedAt: new Date(),
                },
              });

            // Check if alert should be triggered
            if (
              page.alertEnabled &&
              cachedPost.reactions &&
              cachedPost.reactions >= (page.alertThreshold || 100)
            ) {
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
              if (cachedPost.postDate >= tenMinutesAgo) {
                // Create alert (will be deduplicated by the createAlert function)
                const { nanoid } = await import("nanoid");
                await createAlert({
                  id: nanoid(),
                  userId: PUBLIC_USER_ID,
                  pageId: page.id,
                  postId: post.id,
                  postLink: post.link || null,
                  postMessage: post.message || null,
                  postImage: post.image || null,
                  reactionCount: cachedPost.reactions,
                  threshold: page.alertThreshold || 100,
                  postDate: cachedPost.postDate,
                });
              }
            }
          }

          console.log(
            `[BackgroundJob] Cached ${posts.length} posts for ${page.profileName}`
          );
        } catch (error) {
          console.error(
            `[BackgroundJob] Error fetching posts for ${page.profileName}:`,
            error
          );
        }
      }

      // Update lastFetchedAt
      const { upsertUserSettings } = await import("./db");
      await upsertUserSettings({
        userId: PUBLIC_USER_ID,
        lastFetchedAt: new Date(),
      });

      console.log("[BackgroundJob] Successfully fetched and cached all posts");
    } catch (error) {
      console.error("[BackgroundJob] Error in fetchAndCachePosts:", error);
    }
  }

  private async fetchPostsForPage(profileId: string, apiToken: string) {
    // Calculate date range (last 24 hours)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const startDate = formatDate(yesterday);
    const endDate = formatDate(now);
    const period = `${startDate}_${endDate}`;

    // Use the correct Fanpage Karma API endpoint
    const url = `https://app.fanpagekarma.com/api/v1/facebook/${profileId}/posts?token=${apiToken}&period=${period}`;
    
    const response = await axios.get(url);

    return response.data?.posts || [];
  }
}

// Singleton instance
export const backgroundJobService = new BackgroundJobService();

