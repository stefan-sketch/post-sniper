# Migration Summary: Manus → Railway

## Overview
Post Sniper has been upgraded to support Railway deployment with PostgreSQL and server-side background jobs.

## Key Changes

### 1. Database Migration
- **Before**: MySQL/SQLite (file-based)
- **After**: PostgreSQL (cloud-managed)
- **New Schema**: Added `cached_posts` table for server-side caching

### 2. Architecture Shift
- **Before**: Client-side API calls every 10 minutes (per user)
- **After**: Server-side background job fetches data every 10 minutes (shared)

### 3. Data Flow
```
OLD: Browser → Fanpage Karma API → Display
NEW: Background Job → Fanpage Karma API → PostgreSQL → Browser
```

### 4. Benefits
✅ **Better Performance**: Cached data loads instantly  
✅ **Cost Efficient**: Single API call serves all users  
✅ **Always Fresh**: Data updates even when no one is browsing  
✅ **Scalable**: Ready for multiple users  
✅ **Reliable**: PostgreSQL ensures data persistence  

## Files Modified

### Server-Side
- `drizzle/schema.ts` - Migrated to PostgreSQL, added `cached_posts` table
- `server/db.ts` - Updated to use `postgres-js` driver
- `server/backgroundJob.ts` - NEW: Background job service
- `server/routers/cachedPosts.ts` - NEW: API for cached posts
- `server/routers.ts` - Added cachedPosts router
- `server/_core/index.ts` - Start background job on server start
- `drizzle.config.ts` - Updated to PostgreSQL dialect

### Client-Side
- `client/src/pages/Home.tsx` - Use cached posts instead of direct API calls

### Configuration
- `railway.json` - NEW: Railway deployment config
- `Procfile` - NEW: Railway start command
- `package.json` - Added `pg`, `@types/pg`, `postgres` dependencies

### Documentation
- `RAILWAY_DEPLOYMENT.md` - Complete deployment guide
- `README.railway.md` - Quick start guide
- `MIGRATION_SUMMARY.md` - This file

## Deployment Options

### Option 1: Keep Manus (Current)
- Continue using https://postsniper-wgf4yeqf.manus.space/
- Client-side fetching (works but less efficient)
- No changes needed

### Option 2: Deploy to Railway (Recommended)
- Follow `RAILWAY_DEPLOYMENT.md` guide
- Server-side background jobs
- PostgreSQL database
- Better performance and scalability

### Option 3: Run Both
- Keep Manus for testing/backup
- Use Railway for production
- Independent databases

## Migration Checklist

If deploying to Railway:

- [ ] Create Railway account
- [ ] Create new project from GitHub
- [ ] Add PostgreSQL database
- [ ] Deploy application
- [ ] Configure Fanpage Karma API token in app settings
- [ ] Add monitored pages
- [ ] Wait 10 minutes for first data fetch
- [ ] Verify background job in logs
- [ ] Test the application

## Rollback Plan

If you need to rollback to the previous version:

```bash
git checkout 11697778
```

This will restore the MySQL/client-side fetching version.

## Questions?

See `RAILWAY_DEPLOYMENT.md` for detailed instructions and troubleshooting.
