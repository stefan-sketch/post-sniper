import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function initDatabase() {
  console.log('[Init] Connecting to database...');
  
  const sql = postgres(DATABASE_URL, {
    ssl: { rejectUnauthorized: true },
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  try {
    console.log('[Init] Creating tables...');

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT,
        email VARCHAR(320),
        "loginMethod" VARCHAR(64),
        role VARCHAR(10) DEFAULT 'user' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "lastSignedIn" TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create monitored_pages table
    await sql`
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
    `;

    // Create managed_pages table
    await sql`
      CREATE TABLE IF NOT EXISTS managed_pages (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL,
        "profileId" VARCHAR(128) NOT NULL,
        "profileName" VARCHAR(255) NOT NULL,
        "profilePicture" TEXT,
        "borderColor" VARCHAR(7) NOT NULL,
        network VARCHAR(32) DEFAULT 'facebook' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create user_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        "userId" VARCHAR(64) PRIMARY KEY,
        "fanpageKarmaToken" TEXT,
        "autoRefreshEnabled" BOOLEAN DEFAULT true,
        "refreshInterval" INTEGER DEFAULT 600,
        "useMockData" BOOLEAN DEFAULT false,
        "isPlaying" BOOLEAN DEFAULT false,
        "lastFetchedAt" TIMESTAMP,
        "lastAPIStatus" TEXT DEFAULT 'success',
        "lastDataHash" TEXT,
        "apiSyncOffset" INTEGER DEFAULT 0,
        "dismissedPosts" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create alerts table
    await sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL,
        "pageId" VARCHAR(64) NOT NULL,
        "postId" VARCHAR(255) NOT NULL,
        "postLink" TEXT,
        "postMessage" TEXT,
        "postImage" TEXT,
        "reactionCount" INTEGER NOT NULL,
        threshold INTEGER NOT NULL,
        "postDate" TIMESTAMP,
        "triggeredAt" TIMESTAMP DEFAULT NOW(),
        "isRead" BOOLEAN DEFAULT false
      )
    `;

    // Create cached_posts table
    await sql`
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
        "previousReactions" INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        "alertThreshold" INTEGER,
        "alertEnabled" BOOLEAN,
        "fetchedAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create twitter_posts table
    await sql`
      CREATE TABLE IF NOT EXISTS twitter_posts (
        id VARCHAR(64) PRIMARY KEY,
        text TEXT,
        image TEXT,
        "authorName" VARCHAR(255) NOT NULL,
        "authorUsername" VARCHAR(255) NOT NULL,
        "authorAvatar" TEXT,
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        url TEXT,
        "createdAt" TIMESTAMP NOT NULL,
        "fetchedAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('[Init] ✅ All tables created successfully!');
    
    // Verify tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('[Init] Tables in database:');
    tables.forEach((t: any) => console.log(`  - ${t.table_name}`));
    
  } catch (error) {
    console.error('[Init] ❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

initDatabase()
  .then(() => {
    console.log('[Init] Database initialization complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Init] Failed to initialize database:', error);
    process.exit(1);
  });

