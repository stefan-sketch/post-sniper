# Post Sniper Railway Deployment - Fixes Summary

## Date: October 20, 2025

## Problem
Post Sniper was deployed to Railway but was not fetching or displaying any posts from the Fanpage Karma API, despite successful API responses.

## Root Cause
**API Response Parsing Error**: The background job was looking for posts in the wrong location within the API response structure.

### Original (Incorrect) Code
```javascript
const posts = response.data?.data || [];
```

### Correct Code
```javascript
const posts = response.data?.data?.posts || [];
```

### API Response Structure
The Fanpage Karma API returns:
```json
{
  "data": {
    "posts": [
      { "id": "...", "message": "...", "kpi": {...}, ... }
    ]
  },
  "metadata": {...}
}
```

## Changes Made

### 1. Fixed API Response Parsing (`server/backgroundJob.ts`)
- **Line 187**: Changed from `response.data?.data || []` to `response.data?.data?.posts || []`
- Removed excessive debug logging
- Added simple post count logging

### 2. Removed UI Elements (`client/src/pages/Home.tsx`)
- Removed timer countdown display
- Removed green/red status indicator icon
- Kept essential controls: Settings, Play/Pause, Fetch Now, Alerts

### 3. Database Initialization (`server/initDb.ts`)
- Changed from DROP TABLE approach to CREATE TABLE IF NOT EXISTS
- Prevents data loss on every deployment
- Preserves monitored pages and settings across deployments

### 4. Environment Configuration (`server/_core/env.ts`)
- Added hardcoded Fanpage Karma API token as fallback
- Token: `2a10FtrIfe10OnZN0C5l1s1qee600GpER2RylNPNuD47RXs8frGfuB`

### 5. Railway Compatibility Fixes
- Fixed OAuth initialization to be optional
- Made environment variables optional with defaults
- Fixed production static file paths
- Fixed vite.config.ts to use `fileURLToPath` instead of `import.meta.dirname`

## Testing Checklist

When the user returns, they should:

1. ✅ Wait for Railway deployment to complete (1-2 minutes)
2. ✅ Refresh the Post Sniper URL
3. ✅ Verify the page is configured: Profile ID `114022587858511` (Football Funnys)
4. ✅ Click "Fetch Now" button (🔄)
5. ✅ Check Railway logs for: `[BackgroundJob] Fetched X posts for profile 114022587858511`
6. ✅ Verify posts appear in the Live Posts column
7. ✅ Verify posts appear in the Popular Posts column
8. ✅ Verify engagement metrics (likes, comments, shares) are displayed
9. ✅ Verify post images are loading
10. ✅ Verify clicking on posts opens Facebook links

## Expected Log Output

```
[InitDB] Initializing database tables...
[InitDB] Updated existing table schemas
[InitDB] ✅ Database tables initialized successfully!
[BackgroundJob] Starting background job service
[BackgroundJob] Fetching posts...
[BackgroundJob] Fetched X posts for profile 114022587858511
[BackgroundJob] Cached X posts for Football Funnys
[BackgroundJob] Successfully fetched and cached all posts
```

## Architecture Overview

### Data Flow
1. **Background Job** (runs every 10 minutes)
   - Fetches posts from Fanpage Karma API
   - Stores in PostgreSQL `cached_posts` table
   - Creates alerts if thresholds are exceeded

2. **Frontend** (polls every 5 seconds)
   - Queries `cachedPosts.getAll` tRPC endpoint
   - Gets posts from database (not API)
   - Displays in Live Posts and Popular Posts columns

3. **Manual Fetch** (on-demand)
   - User clicks Fetch Now button
   - Triggers immediate background job run
   - Frontend refetches from database

### Benefits
- ✅ Single API call serves all users
- ✅ Data persists across page refreshes
- ✅ No client-side API keys
- ✅ Automatic updates every 10 minutes
- ✅ Instant page loads (data from database)

## Files Modified

1. `server/backgroundJob.ts` - Fixed API response parsing
2. `client/src/pages/Home.tsx` - Removed timer and status icon
3. `server/initDb.ts` - Fixed database initialization
4. `server/_core/env.ts` - Added API token
5. `server/_core/index.ts` - Made OAuth optional
6. `server/_core/vite.ts` - Fixed production paths
7. `vite.config.ts` - Fixed import.meta.dirname issue

## Deployment Status

**Deployed to Railway**: ✅  
**Commit**: `c931231` - "Fixed API response parsing - correct path is response.data.data.posts"  
**GitHub**: https://github.com/stefan-sketch/post-sniper

## Next Steps

1. User tests the deployment
2. If working: Remove debug logging for cleaner logs
3. If not working: Check Railway logs and database connection
4. Consider adding error notifications in UI
5. Consider adding "last updated" timestamp in UI

