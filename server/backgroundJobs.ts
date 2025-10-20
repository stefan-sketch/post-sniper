import * as db from "./db";
import { nanoid } from "nanoid";

const PUBLIC_USER_ID = "public";
let jobInterval: NodeJS.Timeout | null = null;

/**
 * Fetch and store posts from all monitored pages
 */
async function fetchAndStorePosts() {
  try {
    console.log("[Background Job] Starting post fetch...");
    
    const settings = await db.getUserSettings(PUBLIC_USER_ID);
    
    // Check if monitoring is active
    if (!settings?.isPlaying) {
      console.log("[Background Job] Monitoring is paused, skipping fetch");
      return;
    }

    const pages = await db.getMonitoredPages(PUBLIC_USER_ID);
    const apiToken = settings.fanpageKarmaToken;
    const useMockData = settings.useMockData ?? false;

    if (!apiToken && !useMockData) {
      console.log("[Background Job] No API token configured, skipping fetch");
      return;
    }

    console.log(`[Background Job] Fetching posts for ${pages.length} pages`);

    for (const page of pages) {
      try {
        let postsData: any;

        if (useMockData || !apiToken) {
          // Use mock data
          const { generateMockPosts } = await import("./mockData");
          postsData = generateMockPosts(parseInt(page.profileId));
        } else {
          // Fetch from API
          const response = await fetch(
            `https://app.fanpagekarma.com/api/v1/${page.network}/${page.profileId}/posts?token=${apiToken}&period=1d`,
            { method: "GET" }
          );

          if (!response.ok) {
            console.error(`[Background Job] Failed to fetch posts for ${page.profileName}`);
            continue;
          }

          postsData = await response.json();
        }

        // Store or update posts
        if (postsData?.posts) {
          for (const post of postsData.posts) {
            const reactions = post.kpi?.page_posts_reactions?.value || 0;
            const comments = post.kpi?.page_posts_comments_count?.value || 0;
            const shares = post.kpi?.page_posts_shares_count?.value || 0;

            await db.upsertPost({
              id: post.id,
              pageId: page.profileId,
              pageName: page.profileName,
              network: page.network,
              message: post.message,
              image: post.image,
              link: post.link,
              postDate: new Date(post.date),
              reactions,
              comments,
              shares,
              rawData: JSON.stringify(post),
              lastUpdated: new Date(),
            });

            // Check if alert should be triggered
            if (page.alertEnabled && page.alertThreshold && reactions >= page.alertThreshold) {
              const postDate = new Date(post.date);
              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
              
              // Only alert on recent posts
              if (postDate >= tenMinutesAgo) {
                // Check if alert already exists
                const existingAlert = await db.getAlertByPostId(PUBLIC_USER_ID, post.id, page.profileId);
                
                if (!existingAlert) {
                  await db.createAlert({
                    id: nanoid(),
                    userId: PUBLIC_USER_ID,
                    pageId: page.profileId,
                    postId: post.id,
                    postLink: post.link,
                    postMessage: post.message,
                    postImage: post.image,
                    reactionCount: reactions,
                    threshold: page.alertThreshold || 0,
                    postDate,
                  });
                  console.log(`[Background Job] Alert created for post ${post.id} with ${reactions} reactions`);
                }
              }
            }
          }
        }

        console.log(`[Background Job] Updated posts for ${page.profileName}`);
      } catch (error) {
        console.error(`[Background Job] Error fetching posts for ${page.profileName}:`, error);
      }
    }

    // Update lastFetchedAt timestamp
    await db.upsertUserSettings({
      userId: PUBLIC_USER_ID,
      lastFetchedAt: new Date(),
    });

    console.log("[Background Job] Post fetch completed");
  } catch (error) {
    console.error("[Background Job] Error in fetchAndStorePosts:", error);
  }
}

/**
 * Start the background job scheduler
 */
export function startBackgroundJobs() {
  if (jobInterval) {
    console.log("[Background Job] Already running");
    return;
  }

  console.log("[Background Job] Starting scheduler (10 minute interval)");
  
  // Run immediately on start
  fetchAndStorePosts();
  
  // Then run every 10 minutes
  jobInterval = setInterval(fetchAndStorePosts, 10 * 60 * 1000);
}

/**
 * Stop the background job scheduler
 */
export function stopBackgroundJobs() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log("[Background Job] Scheduler stopped");
  }
}

