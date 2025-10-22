-- Create twitter_posts table
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
);

-- Create index on createdAt for faster queries
CREATE INDEX IF NOT EXISTS idx_twitter_posts_created_at ON twitter_posts("createdAt" DESC);

