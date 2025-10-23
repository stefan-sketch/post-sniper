-- Migration: Change cached_posts primary key from id to composite (id, pageId)
-- This allows the same post to exist multiple times with different pageIds
-- Needed when a Facebook page is in both monitored_pages and managed_pages

-- Drop the old primary key constraint
ALTER TABLE "cached_posts" DROP CONSTRAINT IF EXISTS "cached_posts_pkey";

-- Add the new composite primary key
ALTER TABLE "cached_posts" ADD CONSTRAINT "cached_posts_pkey" PRIMARY KEY ("id", "pageId");

