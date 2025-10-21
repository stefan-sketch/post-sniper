import { getDb, getUserSettings, getMonitoredPages, createAlert } from "./db";
import { cachedPosts, InsertCachedPost } from "../drizzle/schema";
import axios from "axios";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";
import * as cron from "node-cron";
import crypto from "crypto";

const PUBLIC_USER_ID = "public";

/**
 * Background job that fetches posts from Fanpage Karma API
 * and stores them in the database for all users to access
 */
export class BackgroundJobService {
  private cronTask: cron.ScheduledTask | null = null;
  private dailyResetTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private isPaused = false;

  async start() {
    if (this.isRunning) {
      console.log("[BackgroundJob] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[BackgroundJob] Starting background job service with node-cron");

    // Check if monitoring is enabled
    const settings = await getUserSettings(PUBLIC_USER_ID);
    const isPlaying = settings?.isPlaying ?? false;
    
    if (isPlaying) {
      // Run immediately on start if playing
      await this.fetchAndCachePosts();
    }

    // Schedule to run every 10 minutes using cron expression
    // Cron expression: "*/10 * * * *" = every 10 minutes
    console.log("[BackgroundJob] Setting up cron job to run every 10 minutes");
    
    this.cronTask = cron.schedule("*/10 * * * *", async () => {
      // Check if monitoring is enabled before running
      const currentSettings = await getUserSettings(PUBLIC_USER_ID);
      const shouldRun = currentSettings?.isPlaying ?? false;
      
      if (shouldRun) {
        const syncOffset = currentSettings?.apiSyncOffset || 0;
        
        if (syncOffset > 0) {
          console.log(`[BackgroundJob] Delaying ${syncOffset}s to sync with API update cycle`);
          await new Promise(resolve => setTimeout(resolve, syncOffset * 1000));
        }
        
        console.log(`[BackgroundJob] Cron job triggered at ${new Date().toISOString()}`);
        await this.fetchAndCachePosts();
      } else {
        console.log(`[BackgroundJob] Cron job skipped (monitoring paused) at ${new Date().toISOString()}`);
      }
    });
    
    // Schedule daily reset at 6am
    // Cron expression: "0 6 * * *" = every day at 6:00 AM
    console.log("[BackgroundJob] Setting up daily reset at 6:00 AM");
    this.dailyResetTask = cron.schedule("0 6 * * *", async () => {
      console.log(`[BackgroundJob] Daily reset triggered at ${new Date().toISOString()}`);
      await this.dailyReset();
    });
    
    console.log("[BackgroundJob] Cron jobs scheduled successfully");
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
    if (this.dailyResetTask) {
      this.dailyResetTask.stop();
      this.dailyResetTask = null;
    }
    this.isRunning = false;
    console.log("[BackgroundJob] Stopped background job service");
  }

  async dailyReset() {
    try {
      console.log("[BackgroundJob] Starting daily reset...");
      
      // Clear all cached posts
      const { clearAllCachedPosts, upsertUserSettings } = await import("./db");
      await clearAllCachedPosts();
      console.log("[BackgroundJob] Cleared all cached posts");
      
      // Turn monitoring ON (set isPlaying to true)
      await upsertUserSettings({ userId: PUBLIC_USER_ID, isPlaying: true });
      console.log("[BackgroundJob] Monitoring turned ON");
      
      // Fetch fresh posts
      await this.fetchAndCachePosts();
      
      console.log("[BackgroundJob] Daily reset completed successfully");
    } catch (error) {
      console.error("[BackgroundJob] Error in dailyReset:", error);
    }
  }

  async fetchAndCachePosts() {
    try {
      console.log("[BackgroundJob] Fetching posts...");
      
      const settings = await getUserSettings(PUBLIC_USER_ID);
      const previousHash = settings?.lastDataHash;
      const currentOffset = settings?.apiSyncOffset || 0;
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

      // Collect all fetched posts to calculate hash BEFORE caching
      const allFetchedPosts: any[] = [];

      // Fetch posts for each page
      for (const page of pages) {
        try {
          const posts = await this.fetchPostsForPage(
            page.profileId,
            apiToken
          );

          // Store posts for hash calculation
          allFetchedPosts.push(...posts);

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

      // Calculate hash of FETCHED data to detect changes
      // We'll hash the total reactions count to detect if metrics changed
      const dataHash = this.calculateDataHash(allFetchedPosts);
      
      // Update lastFetchedAt
      const { upsertUserSettings } = await import("./db");
      await upsertUserSettings({
        userId: PUBLIC_USER_ID,
        lastFetchedAt: new Date(),
      });
      
      // Check if data actually changed
      const dataChanged = !previousHash || dataHash !== previousHash;
      
      if (!dataChanged) {
        console.log("[BackgroundJob] ⚠️  Data unchanged - Fanpage Karma hasn't updated yet");
        console.log("[BackgroundJob] Adjusting next poll time by +2 minutes to sync with API updates");
        
        // Adjust offset to poll 2 minutes later next time
        const newOffset = (currentOffset + 120) % 600; // Keep within 10-minute window
        await upsertUserSettings({
          userId: PUBLIC_USER_ID,
          apiSyncOffset: newOffset,
        });
        
        console.log(`[BackgroundJob] New sync offset: ${newOffset} seconds`);
      } else {
        console.log("[BackgroundJob] ✅ Data updated - API sync is good");
        
        // Store the new hash
        await upsertUserSettings({
          userId: PUBLIC_USER_ID,
          lastDataHash: dataHash,
        });
      }
      
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

    // Use the correct Fanpage Karma API endpoint (same as original working code)
    const url = `https://app.fanpagekarma.com/api/v1/facebook/${profileId}/posts?token=${apiToken}&period=${period}`;
    
    const response = await axios.get(url);
    
    // The API response structure is: { data: { posts: [...] }, metadata: {...} }
    // Based on the original working code: pageData.data.posts
    const posts = response.data?.data?.posts || [];
    
    console.log(`[BackgroundJob] Fetched ${posts.length} posts for profile ${profileId}`);
    
    return posts;
  }
  
  /**
   * Calculate a hash of the fetched data to detect if it changed
   * Uses the sum of all post metrics (reactions, comments, shares) as a change detector
   */
  private calculateDataHash(posts: any[]): string {
    // Sum all metrics to create a signature of the current data state
    // Handle both API format (kpi.page_posts_reactions.value) and cached format (reactions)
    const totalReactions = posts.reduce((sum, p) => {
      const reactions = p.reactions ?? p.kpi?.page_posts_reactions?.value ?? 0;
      return sum + reactions;
    }, 0);
    const totalComments = posts.reduce((sum, p) => {
      const comments = p.comments ?? p.kpi?.page_posts_comments_count?.value ?? 0;
      return sum + comments;
    }, 0);
    const totalShares = posts.reduce((sum, p) => {
      const shares = p.shares ?? p.kpi?.page_posts_shares_count?.value ?? 0;
      return sum + shares;
    }, 0);
    
    const hashData = `${totalReactions}:${totalComments}:${totalShares}`;
    return crypto.createHash('md5').update(hashData).digest('hex');
  }
}

// Singleton instance
export const backgroundJobService = new BackgroundJobService();

