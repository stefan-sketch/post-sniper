import { getDb, getUserSettings, getMonitoredPages, getManagedPages, createAlert } from "./db";
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
  private intervalTask: NodeJS.Timeout | null = null;
  private dailyResetTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private isPaused = false;

  async start() {
    if (this.isRunning) {
      console.log("[BackgroundJob] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[BackgroundJob] Starting background job service with setInterval");

    // Check if monitoring is enabled
    const settings = await getUserSettings(PUBLIC_USER_ID);
    const isPlaying = settings?.isPlaying ?? false;
    
    if (isPlaying) {
      // Run immediately on start if playing
      await this.fetchAndCachePosts();
    }

    // Schedule to run every 3 minutes using setInterval
    const THREE_MINUTES = 3 * 60 * 1000; // 3 minutes in milliseconds
    console.log("[BackgroundJob] Setting up interval to run every 3 minutes");
    
    this.intervalTask = setInterval(async () => {
      try {
        // Check if monitoring is enabled before running
        const currentSettings = await getUserSettings(PUBLIC_USER_ID);
        const shouldRun = currentSettings?.isPlaying ?? false;
        
        if (shouldRun) {
          const syncOffset = currentSettings?.apiSyncOffset || 0;
          
          if (syncOffset > 0) {
            console.log(`[BackgroundJob] Delaying ${syncOffset}s to sync with API update cycle`);
            await new Promise(resolve => setTimeout(resolve, syncOffset * 1000));
          }
          
          console.log(`[BackgroundJob] Interval triggered at ${new Date().toISOString()}`);
          await this.fetchAndCachePosts();
        } else {
          console.log(`[BackgroundJob] Interval skipped (monitoring paused) at ${new Date().toISOString()}`);
        }
      } catch (error) {
        console.error(`[BackgroundJob] Interval error:`, error);
      }
    }, THREE_MINUTES);
    
    // Schedule daily reset at 6am
    // Cron expression: "0 6 * * *" = every day at 6:00 AM
    console.log("[BackgroundJob] Setting up daily reset at 6:00 AM");
    this.dailyResetTask = cron.schedule("0 6 * * *", async () => {
      try {
        console.log(`[BackgroundJob] Daily reset triggered at ${new Date().toISOString()}`);
        await this.dailyReset();
      } catch (error) {
        console.error(`[BackgroundJob] Daily reset error:`, error);
      }
    }, {
      timezone: "Europe/London"
    });
    
    console.log("[BackgroundJob] Cron jobs scheduled successfully");
  }

  stop() {
    if (this.intervalTask) {
      clearInterval(this.intervalTask);
      this.intervalTask = null;
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
      
      // Clear only managed pages posts (Pages tab), keep monitored pages (Live Posts)
      const { clearManagedPagesPosts, upsertUserSettings } = await import("./db");
      await clearManagedPagesPosts(PUBLIC_USER_ID);
      console.log("[BackgroundJob] Cleared managed pages posts");
      
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
    const { upsertUserSettings } = await import("./db");
    try {
      console.log("[BackgroundJob] Fetching posts...");
      
      // Set isFetchingFromAPI to true at the start
      // TEMPORARILY DISABLED until migration runs
      // await upsertUserSettings({ userId: PUBLIC_USER_ID, isFetchingFromAPI: true });
      
      const settings = await getUserSettings(PUBLIC_USER_ID);
      const previousHash = settings?.lastDataHash;
      const currentOffset = settings?.apiSyncOffset || 0;
      const apiToken = settings?.fanpageKarmaToken || ENV.fanpageKarmaToken;
      
      if (!apiToken) {
        console.log("[BackgroundJob] No API token configured");
        return;
      }

      // Fetch both monitored pages (Feed) and managed pages (Pages)
      const monitoredPages = await getMonitoredPages(PUBLIC_USER_ID);
      const managedPages = await getManagedPages(PUBLIC_USER_ID);
      
      // Combine both lists
      const allPages = [...monitoredPages, ...managedPages];
      
      if (allPages.length === 0) {
        console.log("[BackgroundJob] No pages configured (monitored or managed)");
        return;
      }
      
      console.log(`[BackgroundJob] Fetching posts for ${monitoredPages.length} monitored pages and ${managedPages.length} managed pages`);

      const db = await getDb();
      if (!db) {
        console.error("[BackgroundJob] Database not available");
        return;
      }

      // Collect all fetched posts to calculate hash BEFORE caching
      const allFetchedPosts: any[] = [];

      // Fetch posts for each page (both monitored and managed)
      for (const page of allPages) {
        try {
          const posts = await this.fetchPostsForPage(
            page.profileId,
            apiToken
          );

          // Log sample post data to debug stale data issue
          if (posts.length > 0) {
            const samplePost = posts[0];
            console.log(`[BackgroundJob] Sample post from ${page.profileName}:`, {
              id: samplePost.id,
              message: samplePost.message?.substring(0, 50),
              reactions: samplePost.kpi?.page_posts_reactions?.value || samplePost.reactions,
              timestamp: new Date().toISOString()
            });
          }

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
              alertThreshold: 'alertThreshold' in page ? (page.alertThreshold as number) : null,
              alertEnabled: 'alertEnabled' in page ? (page.alertEnabled as boolean) : false,
              updatedAt: new Date(),
            };

            // Get existing post to track previous reactions
            const existingPost = await db
              .select()
              .from(cachedPosts)
              .where(eq(cachedPosts.id, cachedPost.id))
              .limit(1);
            
            const previousReactions = existingPost[0]?.reactions || cachedPost.reactions;

            // Upsert cached post with previousReactions tracking
            await db
              .insert(cachedPosts)
              .values({ ...cachedPost, previousReactions })
              .onConflictDoUpdate({
                target: cachedPosts.id,
                set: {
                  previousReactions: previousReactions,
                  reactions: cachedPost.reactions,
                  comments: cachedPost.comments,
                  shares: cachedPost.shares,
                  updatedAt: new Date(),
                },
              });

            // Check if alert should be triggered (only for monitored pages)
            if (
              'alertEnabled' in page &&
              page.alertEnabled &&
              cachedPost.reactions &&
              'alertThreshold' in page &&
              cachedPost.reactions >= ((page.alertThreshold as number) || 100)
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
                  threshold: 'alertThreshold' in page ? ((page.alertThreshold as number) || 100) : 100,
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
      
      // Update lastFetchedAt and set API status to success
      await upsertUserSettings({
        userId: PUBLIC_USER_ID,
        lastFetchedAt: new Date(),
        lastAPIStatus: "success",
      });
      
      // Check if data actually changed
      const dataChanged = !previousHash || dataHash !== previousHash;
      
      if (!dataChanged) {
        console.log("[BackgroundJob] ⚠️  Data unchanged - Fanpage Karma hasn't updated yet");
        console.log("[BackgroundJob] Adjusting next poll time by +2 minutes to sync with API updates");
        
        // Adjust offset to poll 1 minute later next time
        const newOffset = (currentOffset + 60) % 300; // Keep within 5-minute window
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
      
      // Set isFetchingFromAPI to false when done
      // TEMPORARILY DISABLED until migration runs
      // await upsertUserSettings({ userId: PUBLIC_USER_ID, isFetchingFromAPI: false });
    } catch (error) {
      console.error("[BackgroundJob] Error in fetchAndCachePosts:", error);
      // Set API status to error
      await upsertUserSettings({ userId: PUBLIC_USER_ID, lastAPIStatus: "error" });
      // Set isFetchingFromAPI to false even on error
      // TEMPORARILY DISABLED until migration runs
      // await upsertUserSettings({ userId: PUBLIC_USER_ID, isFetchingFromAPI: false });
    }
  }

  private async fetchPostsForPage(profileId: string, apiToken: string) {
    // Calculate date range (only today in UK timezone)
    // UK timezone is Europe/London (GMT/BST)
    const nowUK = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Start of today in UK time
    const startDate = formatDate(nowUK);
    const endDate = formatDate(nowUK);
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

