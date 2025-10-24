-- Performance Optimization Indexes
-- Created: 2025-10-24
-- Purpose: Improve query performance for frequently accessed data

-- Index for cached_posts queries by creation time (most common sort)
CREATE INDEX IF NOT EXISTS idx_cached_posts_created_at 
ON cached_posts(created_at DESC);

-- Index for cached_posts queries by page_id
CREATE INDEX IF NOT EXISTS idx_cached_posts_page_id 
ON cached_posts(page_id);

-- Composite index for engagement sorting (reactions + comments + shares)
-- Note: MySQL doesn't support expression indexes, so we'll add this in application layer

-- Composite index for common query pattern (page_id + created_at)
CREATE INDEX IF NOT EXISTS idx_cached_posts_page_created 
ON cached_posts(page_id, created_at DESC);

-- Index for managed_posts queries by creation time
CREATE INDEX IF NOT EXISTS idx_managed_posts_created_at 
ON managed_posts(created_at DESC);

-- Index for managed_posts queries by page_id
CREATE INDEX IF NOT EXISTS idx_managed_posts_page_id 
ON managed_posts(page_id);

-- Composite index for managed_posts (page_id + created_at)
CREATE INDEX IF NOT EXISTS idx_managed_posts_page_created 
ON managed_posts(page_id, created_at DESC);

-- Index for managed_pages queries by user_id
CREATE INDEX IF NOT EXISTS idx_managed_pages_user_id 
ON managed_pages(user_id);

-- Index for managed_pages queries by profile_id
CREATE INDEX IF NOT EXISTS idx_managed_pages_profile_id 
ON managed_pages(profile_id);

-- Show created indexes
SHOW INDEX FROM cached_posts;
SHOW INDEX FROM managed_posts;
SHOW INDEX FROM managed_pages;

