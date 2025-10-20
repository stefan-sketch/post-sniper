import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Monitored Facebook pages configuration
 */
export const monitoredPages = mysqlTable("monitored_pages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 128 }).notNull(),
  profileName: varchar("profileName", { length: 255 }).notNull(),
  profilePicture: text("profilePicture"),
  borderColor: varchar("borderColor", { length: 7 }).notNull(), // hex color
  network: varchar("network", { length: 32 }).default("facebook").notNull(),
  alertThreshold: int("alertThreshold").default(100), // reactions threshold for alerts
  alertEnabled: boolean("alertEnabled").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type MonitoredPage = typeof monitoredPages.$inferSelect;
export type InsertMonitoredPage = typeof monitoredPages.$inferInsert;

/**
 * User settings
 */
export const userSettings = mysqlTable("user_settings", {
  userId: varchar("userId", { length: 64 }).primaryKey(),
  fanpageKarmaToken: text("fanpageKarmaToken"),
  autoRefreshEnabled: boolean("autoRefreshEnabled").default(true),
  refreshInterval: int("refreshInterval").default(600), // seconds (10 minutes)
  useMockData: boolean("useMockData").default(false), // Use real API by default
  isPlaying: boolean("isPlaying").default(false), // Track if monitoring is active
  lastFetchedAt: timestamp("lastFetchedAt"), // Track when posts were last fetched
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Triggered alerts history
 */
export const alerts = mysqlTable("alerts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  pageId: varchar("pageId", { length: 64 }).notNull(),
  postId: varchar("postId", { length: 255 }).notNull(),
  postLink: text("postLink"),
  postMessage: text("postMessage"),
  postImage: text("postImage"),
  reactionCount: int("reactionCount").notNull(),
  threshold: int("threshold").notNull(),
  postDate: timestamp("postDate"),
  triggeredAt: timestamp("triggeredAt").defaultNow(),
  isRead: boolean("isRead").default(false),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Cached posts from social media
 */
export const posts = mysqlTable("posts", {
  id: varchar("id", { length: 255 }).primaryKey(), // Post ID from social network
  pageId: varchar("pageId", { length: 64 }).notNull(),
  pageName: text("pageName").notNull(),
  network: varchar("network", { length: 32 }).default("facebook"),
  message: text("message"),
  image: text("image"),
  link: text("link"),
  postDate: timestamp("postDate").notNull(),
  reactions: int("reactions").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  rawData: text("rawData"), // Store full JSON response
  lastUpdated: timestamp("lastUpdated").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

