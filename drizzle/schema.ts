import { pgTable, text, timestamp, varchar, integer, boolean, pgEnum, index } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Monitored Facebook pages configuration
 */
export const monitoredPages = pgTable("monitored_pages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 128 }).notNull(),
  profileName: varchar("profileName", { length: 255 }).notNull(),
  profilePicture: text("profilePicture"),
  borderColor: varchar("borderColor", { length: 7 }).notNull(), // hex color
  network: varchar("network", { length: 32 }).default("facebook").notNull(),
  alertThreshold: integer("alertThreshold").default(100), // reactions threshold for alerts
  alertEnabled: boolean("alertEnabled").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type MonitoredPage = typeof monitoredPages.$inferSelect;
export type InsertMonitoredPage = typeof monitoredPages.$inferInsert;

/**
 * Managed Facebook pages (for Pages tab)
 */
export const managedPages = pgTable("managed_pages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 128 }).notNull(),
  profileName: varchar("profileName", { length: 255 }).notNull(),
  profilePicture: text("profilePicture"),
  borderColor: varchar("borderColor", { length: 7 }).notNull(), // hex color
  network: varchar("network", { length: 32 }).default("facebook").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type ManagedPage = typeof managedPages.$inferSelect;
export type InsertManagedPage = typeof managedPages.$inferInsert;

/**
 * User settings
 */
export const userSettings = pgTable("user_settings", {
  userId: varchar("userId", { length: 64 }).primaryKey(),
  fanpageKarmaToken: text("fanpageKarmaToken"),
  autoRefreshEnabled: boolean("autoRefreshEnabled").default(true),
  refreshInterval: integer("refreshInterval").default(600), // seconds (10 minutes)
  useMockData: boolean("useMockData").default(false), // Use real API by default
  isPlaying: boolean("isPlaying").default(false), // Track if monitoring is active
  // TEMPORARILY REMOVED - will add back after proper migration
  // isFetchingFromAPI: boolean("isFetchingFromAPI").default(false), // Track if currently fetching from Fanpage Karma API
  lastFetchedAt: timestamp("lastFetchedAt"), // Track when posts were last fetched
  lastAPIStatus: text("lastAPIStatus").default("success"), // Track last API call status: 'success' or 'error'
  lastDataHash: text("lastDataHash"), // Hash of last API response to detect changes
  apiSyncOffset: integer("apiSyncOffset").default(0), // Learned offset in seconds to sync with API updates
  dismissedPosts: text("dismissedPosts"), // JSON array of dismissed post IDs
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Triggered alerts history
 */
export const alerts = pgTable("alerts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  pageId: varchar("pageId", { length: 64 }).notNull(),
  postId: varchar("postId", { length: 255 }).notNull(),
  postLink: text("postLink"),
  postMessage: text("postMessage"),
  postImage: text("postImage"),
  reactionCount: integer("reactionCount").notNull(),
  threshold: integer("threshold").notNull(),
  postDate: timestamp("postDate"),
  triggeredAt: timestamp("triggeredAt").defaultNow(),
  isRead: boolean("isRead").default(false),
}, (table) => ({
  userIdIdx: index("idx_alerts_user_id").on(table.userId),
  triggeredAtIdx: index("idx_alerts_triggered_at").on(table.triggeredAt.desc()),
}));

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Cached posts data - stores fetched posts server-side
 */
export const cachedPosts = pgTable("cached_posts", {
  id: varchar("id", { length: 255 }).notNull(), // postId
  pageId: varchar("pageId", { length: 64 }).notNull(),
  pageName: varchar("pageName", { length: 255 }).notNull(),
  borderColor: varchar("borderColor", { length: 7 }).notNull(),
  profilePicture: text("profilePicture"),
  message: text("message"),
  image: text("image"),
  link: text("link"),
  postDate: timestamp("postDate").notNull(),
  reactions: integer("reactions").default(0),
  previousReactions: integer("previousReactions").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  alertThreshold: integer("alertThreshold"),
  alertEnabled: boolean("alertEnabled"),
  fetchedAt: timestamp("fetchedAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.pageId] }),
  postDateIdx: index("idx_cached_posts_post_date").on(table.postDate.desc()),
  pageIdIdx: index("idx_cached_posts_page_id").on(table.pageId),
  reactionsIdx: index("idx_cached_posts_reactions").on(table.reactions.desc()),
}));

export type CachedPost = typeof cachedPosts.$inferSelect;
export type InsertCachedPost = typeof cachedPosts.$inferInsert;

/**
 * Twitter posts cache - stores tweets from monitored lists
 */
export const twitterPosts = pgTable("twitter_posts", {
  id: varchar("id", { length: 64 }).primaryKey(), // tweet ID
  text: text("text"),
  image: text("image"),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  authorUsername: varchar("authorUsername", { length: 255 }).notNull(),
  authorAvatar: text("authorAvatar"),
  likes: integer("likes").default(0),
  retweets: integer("retweets").default(0),
  replies: integer("replies").default(0),
  views: integer("views").default(0),
  url: text("url"),
  createdAt: timestamp("createdAt").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  createdAtIdx: index("idx_twitter_posts_created_at").on(table.createdAt.desc()),
}));

export type TwitterPost = typeof twitterPosts.$inferSelect;
export type InsertTwitterPost = typeof twitterPosts.$inferInsert;

/**
 * Reddit posts cache - stores posts from monitored subreddits
 */
export const redditPosts = pgTable("reddit_posts", {
  id: varchar("id", { length: 64 }).primaryKey(), // Reddit post ID
  title: text("title").notNull(),
  author: varchar("author", { length: 255 }).notNull(),
  subreddit: varchar("subreddit", { length: 255 }).notNull(),
  upvotes: integer("upvotes").default(0),
  comments: integer("comments").default(0),
  url: text("url"),
  permalink: text("permalink"),
  thumbnail: text("thumbnail"),
  isVideo: boolean("isVideo").default(false),
  postType: varchar("postType", { length: 32 }).default("text"), // 'image', 'link', 'text'
  domain: varchar("domain", { length: 255 }),
  createdAt: timestamp("createdAt").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => ({
  createdAtIdx: index("idx_reddit_posts_created_at").on(table.createdAt.desc()),
  subredditIdx: index("idx_reddit_posts_subreddit").on(table.subreddit),
}));

export type RedditPost = typeof redditPosts.$inferSelect;
export type InsertRedditPost = typeof redditPosts.$inferInsert;

