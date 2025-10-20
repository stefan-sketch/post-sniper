import { getDb } from "./db";
import { sql } from "drizzle-orm";

export async function initializeDatabase() {
  const db = await getDb();
  if (!db) {
    console.warn("[InitDB] Database not available, skipping initialization");
    return;
  }

  try {
    console.log("[InitDB] Initializing database tables...");
    
    // Drop existing tables to recreate with correct schema
    await db.execute(sql`DROP TABLE IF EXISTS cached_posts CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS monitored_pages CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS alerts CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS user_settings CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);
    console.log("[InitDB] Dropped existing tables");

    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        "loginMethod" TEXT,
        "lastSignedIn" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create monitored_pages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monitored_pages (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL,
        "profileId" VARCHAR(128) NOT NULL,
        "profileName" VARCHAR(255) NOT NULL,
        "profilePicture" TEXT,
        "borderColor" VARCHAR(7) NOT NULL,
        network VARCHAR(32) DEFAULT 'facebook' NOT NULL,
        "alertThreshold" INTEGER DEFAULT 100,
        "alertEnabled" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create user_settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        "userId" TEXT PRIMARY KEY,
        "fanpageKarmaToken" TEXT,
        "autoRefreshEnabled" BOOLEAN DEFAULT true,
        "refreshInterval" INTEGER DEFAULT 600,
        "useMockData" BOOLEAN DEFAULT false,
        "isPlaying" BOOLEAN DEFAULT false,
        "lastFetchedAt" TIMESTAMP,
        "dismissedPosts" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create alerts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "pageId" TEXT NOT NULL,
        "postId" TEXT NOT NULL,
        "postLink" TEXT,
        "postMessage" TEXT,
        "postImage" TEXT,
        "reactionCount" INTEGER NOT NULL,
        threshold INTEGER NOT NULL,
        "postDate" TIMESTAMP,
        "triggeredAt" TIMESTAMP DEFAULT NOW(),
        "isRead" BOOLEAN DEFAULT false
      )
    `);

    // Create cached_posts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cached_posts (
        id VARCHAR(255) PRIMARY KEY,
        "pageId" VARCHAR(64) NOT NULL,
        "pageName" VARCHAR(255) NOT NULL,
        "borderColor" VARCHAR(7) NOT NULL,
        "profilePicture" TEXT,
        message TEXT,
        image TEXT,
        link TEXT,
        "postDate" TIMESTAMP NOT NULL,
        reactions INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        "alertThreshold" INTEGER,
        "alertEnabled" BOOLEAN,
        "fetchedAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("[InitDB] ✅ Database tables initialized successfully!");
  } catch (error) {
    console.error("[InitDB] ❌ Failed to initialize database:", error);
  }
}

