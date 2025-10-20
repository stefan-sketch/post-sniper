# Railway Deployment Guide for Post Sniper 🎯

This guide will help you deploy Post Sniper to Railway with PostgreSQL database and automatic background data refreshing.

## What's Changed

### Server-Side Architecture
- **Background Job Service**: Fetches posts from Fanpage Karma API every 10 minutes automatically
- **Cached Posts**: All posts stored in PostgreSQL database for instant access
- **Shared Data**: All users see the same data (no per-user fetching)
- **Always Running**: Data refreshes even when no one is browsing the site

### Database Migration
- **From**: MySQL/SQLite
- **To**: PostgreSQL (Railway's recommended database)
- **New Table**: `cached_posts` stores all fetched posts

### Client Updates
- Client now polls cached data every 5 seconds (lightweight)
- No more client-side API calls to Fanpage Karma
- Faster page loads and better performance

## Deployment Steps

### 1. Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)

### 2. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account and select the `post-sniper` repository
4. Railway will automatically detect the configuration

### 3. Add PostgreSQL Database
1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a PostgreSQL instance
4. The `DATABASE_URL` environment variable will be automatically set

### 4. Configure Environment Variables
In your Railway project settings, add these environment variables:

```
NODE_ENV=production
DATABASE_URL=(automatically set by Railway PostgreSQL)
```

**Optional**: If you want to set a custom port (Railway handles this automatically):
```
PORT=3000
```

### 5. Initialize Database Schema
After the first deployment, you need to run the database migrations:

1. Go to your Railway project
2. Click on your service
3. Go to "Settings" → "Deploy"
4. Add a "Build Command" (if not already set):
   ```
   pnpm install && pnpm run build
   ```
5. The database schema will be created automatically on first connection

Alternatively, you can run migrations manually:
```bash
# In Railway CLI or deployment logs
pnpm db:push
```

### 6. Configure Post Sniper
1. Once deployed, visit your Railway app URL
2. Click the Settings icon (⚙️)
3. Add your Fanpage Karma API token
4. Add monitored Facebook pages with their profile IDs
5. Set alert thresholds if desired

### 7. Verify Background Job
Check the deployment logs to confirm the background job is running:
```
[BackgroundJob] Starting background job service
[BackgroundJob] Fetching posts...
[BackgroundJob] Cached X posts for [Page Name]
```

## Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | Auto-set by Railway |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `PORT` | No | Server port | `3000` |

## Database Schema

The PostgreSQL database includes these tables:

- **users**: User authentication (minimal, uses "public" user)
- **monitored_pages**: Facebook pages to monitor
- **user_settings**: App settings and API tokens
- **alerts**: Triggered alerts for high-performing posts
- **cached_posts**: ⭐ NEW - Stores all fetched posts with metadata

## Background Job Behavior

- **Frequency**: Runs every 10 minutes
- **Data Retention**: Keeps posts from last 24 hours
- **Alert Checking**: Automatically creates alerts for posts exceeding thresholds
- **API Efficiency**: Single API call per page every 10 minutes (vs. per-user calls)

## Monitoring

### Check if Background Job is Running
View Railway logs:
```
[BackgroundJob] Successfully fetched and cached all posts
```

### Check Database Status
Railway provides a built-in database dashboard:
1. Click on your PostgreSQL service
2. Go to "Data" tab
3. View `cached_posts` table

### Performance Metrics
- **Client Load**: ~5KB per poll (cached data only)
- **Server Load**: Minimal - background job runs independently
- **Database**: Optimized queries with indexes

## Troubleshooting

### Background Job Not Running
- Check Railway logs for errors
- Verify `DATABASE_URL` is set correctly
- Ensure Fanpage Karma API token is configured in settings

### No Posts Showing
- Wait 10 minutes for first background job run
- Check that monitored pages are configured
- Verify API token is valid

### Database Connection Errors
- Railway PostgreSQL must be in the same project
- Check `DATABASE_URL` environment variable
- Restart the service if needed

## Cost Estimation

Railway Pricing (as of 2025):
- **Hobby Plan**: $5/month
  - Includes: 512MB RAM, shared CPU
  - PostgreSQL: 1GB storage included
  - Perfect for Post Sniper

- **Pro Plan**: $20/month
  - Includes: 8GB RAM, dedicated resources
  - PostgreSQL: 8GB storage
  - For heavy usage

## Differences from Manus Deployment

| Feature | Manus Version | Railway Version |
|---------|---------------|-----------------|
| Database | SQLite (file-based) | PostgreSQL (managed) |
| Data Fetching | Client-side | Server-side background job |
| Scaling | Single instance | Auto-scaling ready |
| Data Sharing | Per-browser session | Global shared cache |
| Persistence | Local file | Cloud database |

## Next Steps

After successful deployment:

1. ✅ Configure your Fanpage Karma API token
2. ✅ Add monitored pages
3. ✅ Wait 10 minutes for first data fetch
4. ✅ Share the Railway URL with your team
5. ✅ Everyone sees the same real-time data!

## Support

For issues specific to:
- **Railway Platform**: [railway.app/help](https://railway.app/help)
- **Post Sniper App**: Check application logs in Railway dashboard

---

**Note**: Your current Manus deployment at https://postsniper-wgf4yeqf.manus.space/ will continue to work independently. The Railway deployment is a separate instance with its own database.

