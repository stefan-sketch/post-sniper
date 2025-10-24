import { getDb, getUserSettings, getMonitoredPages, getManagedPages, createAlert } from "./db";
import { cachedPosts, InsertCachedPost } from "../drizzle/schema";
import axios from "axios";
import { eq, and } from "drizzle-orm";
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
      console.log(`[BackgroundJob] Managed pages:`, managedPages.map(p => ({ id: p.id, name: p.profileName, profileId: p.profileId })));

      const db = await getDb();
      if (!db) {
        console.error("[BackgroundJob] Database not available");
        return;
      }

      // Collect all fetched posts to calculate hash BEFORE caching
      const allFetchedPosts: any[] = [];
      let totalNewPosts = 0;
      let totalUpdatedPosts = 0;

      // Fetch posts for each page (both monitored and managed)
      for (const page of allPages) {
        try {
          const isManaged = managedPages.some(mp => mp.id === page.id);
          const pageType = isManaged ? 'MANAGED' : 'MONITORED';
          console.log(`[BackgroundJob] Fetching ${pageType} page: ${page.profileName} (${page.profileId})`);
          
          const posts = await this.fetchPostsForPage(
            page.profileId,
            apiToken
          );

          // Log sample post data to debug stale data issue
          if (posts.length > 0) {
            const samplePost = posts[0];
            console.log(`[BackgroundJob] [${pageType}] Sample post from ${page.profileName}:`, {
              id: samplePost.id,
              message: samplePost.message?.substring(0, 50),
              reactions: samplePost.kpi?.page_posts_reactions?.value || samplePost.reactions,
              timestamp: new Date().toISOString()
            });
          } else {
            console.log(`[BackgroundJob] [${pageType}] No posts found for ${page.profileName}`);
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
              .where(and(eq(cachedPosts.id, cachedPost.id), eq(cachedPosts.pageId, page.id)))
              .limit(1);
            
            const previousReactions = existingPost[0]?.reactions || cachedPost.reactions;

            // Upsert cached post with previousReactions tracking
            const wasUpdated = existingPost.length > 0;
            const metricsChanged = wasUpdated && (
              existingPost[0].reactions !== cachedPost.reactions ||
              existingPost[0].comments !== cachedPost.comments ||
              existingPost[0].shares !== cachedPost.shares
            );
            
            if (!wasUpdated) {
              totalNewPosts++;
            } else if (metricsChanged) {
              totalUpdatedPosts++;
              console.log(`[BackgroundJob] [${pageType}] Metrics updated for post ${cachedPost.id.substring(0, 20)}:`, {
                old: { reactions: existingPost[0].reactions, comments: existingPost[0].comments, shares: existingPost[0].shares },
                new: { reactions: cachedPost.reactions, comments: cachedPost.comments, shares: cachedPost.shares }
              });
            }
            
            await db
              .insert(cachedPosts)
              .values({ ...cachedPost, previousReactions })
              .onConflictDoUpdate({
                target: [cachedPosts.id, cachedPosts.pageId],
                set: {
                  previousReactions: previousReactions,
                  reactions: cachedPost.reactions,
                  comments: cachedPost.comments,
                  shares: cachedPost.shares,
                  pageName: cachedPost.pageName,
                  borderColor: cachedPost.borderColor,
                  profilePicture: cachedPost.profilePicture,
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
      console.log(`[BackgroundJob] Summary: ${totalNewPosts} new posts, ${totalUpdatedPosts} updated posts, ${allFetchedPosts.length - totalNewPosts - totalUpdatedPosts} unchanged posts`);
      
      // Fetch Twitter posts
      try {
        console.log("[BackgroundJob] Fetching Twitter posts...");
        await this.fetchTwitterPosts();
        console.log("[BackgroundJob] Twitter posts fetched successfully");
      } catch (error) {
        console.error("[BackgroundJob] Error fetching Twitter posts:", error);
      }
      
      // Fetch Reddit posts
      try {
        console.log("[BackgroundJob] Fetching Reddit posts...");
        await this.fetchRedditPosts();
        console.log("[BackgroundJob] Reddit posts fetched successfully");
      } catch (error) {
        console.error("[BackgroundJob] Error fetching Reddit posts:", error);
      }
      
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

    // Use the correct Fanpage Karma API endpoint with cache-busting timestamp
    const timestamp = Date.now();
    const url = `https://app.fanpagekarma.com/api/v1/facebook/${profileId}/posts?token=${apiToken}&period=${period}&_t=${timestamp}`;
    
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
  private async fetchTwitterPosts() {
    const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
    const TWITTER_LIST_ID = "1750840026051596582";
    
    if (!TWITTER_API_KEY) {
      console.log("[BackgroundJob] Twitter API key not configured");
      return;
    }

    const url = new URL("https://api.twitterapi.io/twitter/list/tweets");
    url.searchParams.append("listId", TWITTER_LIST_ID);

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": TWITTER_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[BackgroundJob] Twitter API error:", error);
      throw new Error(`Twitter API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Store tweets in database
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    const { twitterPosts } = await import("../drizzle/schema");
    
    if (data.tweets && data.tweets.length > 0) {
      let newTweets = 0;
      let updatedTweets = 0;
      
      for (const tweet of data.tweets as any[]) {
        // Skip replies (tweets starting with @)
        if (tweet.text && tweet.text.trim().startsWith('@')) {
          continue;
        }
        
        // Get image if available (optional)
        const image = tweet.extendedEntities?.media?.[0]?.media_url_https || 
                     tweet.entities?.media?.[0]?.media_url_https || null;

        const result = await db
          .insert(twitterPosts)
          .values({
            id: tweet.id,
            text: tweet.text,
            image,
            authorName: tweet.author?.name || "Unknown",
            authorUsername: tweet.author?.userName || "",
            authorAvatar: tweet.author?.profilePicture || "",
            likes: tweet.likeCount || 0,
            retweets: tweet.retweetCount || 0,
            replies: tweet.replyCount || 0,
            views: tweet.viewCount || 0,
            url: tweet.url || `https://twitter.com/i/web/status/${tweet.id}`,
            createdAt: new Date(tweet.createdAt),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: twitterPosts.id,
            set: {
              likes: tweet.likeCount || 0,
              retweets: tweet.retweetCount || 0,
              replies: tweet.replyCount || 0,
              views: tweet.viewCount || 0,
              updatedAt: new Date(),
            },
          });
        
        // Check if it was an insert or update (simplified - just count all as updates for now)
        updatedTweets++;
      }
      
      console.log(`[BackgroundJob] Twitter: Processed ${data.tweets.length} tweets (${updatedTweets} stored/updated)`);
    }
  }

  /**
   * Fetch Reddit posts from multiple subreddits and store in database
   */
  private async fetchRedditPosts() {
    console.log("[BackgroundJob] Fetching Reddit posts...");
    
    const subreddits = ['soccercirclejerk', 'Championship', 'PremierLeague', 'soccermemes'];
    
    // Store posts in database
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    const { redditPosts } = await import("../drizzle/schema");
    
    let totalProcessed = 0;
    let totalStored = 0;
    
    for (const subreddit of subreddits) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${subreddit}/hot.json?limit=10`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PostSniper/1.0)',
            },
          }
        );

        if (!response.ok) {
          console.warn(`[BackgroundJob] Failed to fetch r/${subreddit}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        
        if (data.data?.children) {
          for (const child of data.data.children) {
            const post = child.data;
            
            // Skip videos
            if (post.is_video || post.post_hint === 'hosted:video') {
              continue;
            }
            
            totalProcessed++;
            
            // Get the best quality image URL
            let imageUrl = null;
            
            if (post.preview?.images?.[0]?.resolutions?.length > 0) {
              const resolutions = post.preview.images[0].resolutions;
              imageUrl = resolutions[resolutions.length - 1].url.replace(/&amp;/g, '&');
            } else if (post.preview?.images?.[0]?.source?.url) {
              imageUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
            } else if (post.url && (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.gif') || post.url.endsWith('.jpeg'))) {
              imageUrl = post.url;
            } else if (post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' && post.thumbnail.startsWith('http')) {
              imageUrl = post.thumbnail;
            }
            
            // Determine post type and extract domain for links
            let postType: 'image' | 'link' | 'text' = 'text';
            let domain: string | undefined;
            
            if (imageUrl) {
              postType = 'image';
            } else if (post.url && !post.url.includes(`reddit.com/r/${post.subreddit}`)) {
              postType = 'link';
              try {
                const urlObj = new URL(post.url);
                domain = urlObj.hostname.replace('www.', '');
              } catch (e) {
                domain = post.domain || 'external link';
              }
            }
            
            // Insert or update post
            await db
              .insert(redditPosts)
              .values({
                id: post.id,
                title: post.title,
                author: post.author,
                subreddit: post.subreddit,
                upvotes: post.ups || 0,
                comments: post.num_comments || 0,
                url: post.url,
                permalink: `https://www.reddit.com${post.permalink}`,
                thumbnail: imageUrl,
                isVideo: false,
                postType,
                domain,
                createdAt: new Date(post.created_utc * 1000),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: redditPosts.id,
                set: {
                  upvotes: post.ups || 0,
                  comments: post.num_comments || 0,
                  updatedAt: new Date(),
                },
              });
            
            totalStored++;
          }
        }
      } catch (err) {
        console.warn(`[BackgroundJob] Error fetching r/${subreddit}:`, err);
      }
    }
    
    console.log(`[BackgroundJob] Reddit: Processed ${totalProcessed} posts from ${subreddits.length} subreddits (${totalStored} stored/updated)`);
  }

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

