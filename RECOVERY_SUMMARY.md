# Post Sniper - Recovery Summary

**Date**: October 24, 2025  
**Status**: ✅ Repository Cloned & Environment Ready

---

## 🎯 What is Post Sniper?

Post Sniper is a **real-time social media monitoring dashboard** that tracks Facebook and Twitter posts, helping you identify viral content and respond quickly to high-engagement posts.

### Key Features
- 📊 **Live Posts Feed**: Real-time monitoring of Facebook pages
- 🔥 **Popular Posts Column**: Highlights top-performing content (top 25 with SEE MORE button)
- ⚽ **MATCHDAY Column**: Special column for match-day content
- 🎨 **Create Post Dialog**: Built-in post creation with Canva-style text editing
  - Freeform drawing tool
  - Text overlays with gradient support
  - Image cropping and editing
- 🐦 **Twitter Integration**: Monitor tweets from specific lists
- 🔔 **Smart Alerts**: Notifications when posts exceed engagement thresholds
- 📸 **Screenshot Tools**: Capture tweets and posts for sharing

---

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 19 with Wouter for routing
- **UI Library**: Radix UI + Tailwind CSS
- **State Management**: TanStack Query + tRPC
- **Key Components**:
  - `DashboardLayout.tsx` - Main layout with columns
  - `FacebookPageColumn.tsx` - Live/Popular posts display
  - `CreatePostDialog.tsx` - Post creation with image editing
  - `PostCard.tsx` - Individual post display

### Backend (Express + Node.js)
- **Framework**: Express with tRPC for type-safe APIs
- **Database**: PostgreSQL (via Drizzle ORM)
- **Background Jobs**: Node-cron for scheduled tasks
- **Key Services**:
  - `backgroundJob.ts` - Fetches posts every 3 minutes
  - `db.ts` - Database operations
  - API integrations: Fanpage Karma, Twitter

### Database Schema (PostgreSQL)
```
users              - User authentication
monitored_pages    - Facebook pages to monitor (Feed tab)
managed_pages      - Facebook pages to manage (Pages tab)
user_settings      - App configuration & API tokens
alerts             - Triggered engagement alerts
cached_posts       - Cached Facebook posts with metrics
twitter_posts      - Cached tweets
```

---

## 📦 Current State

### ✅ Successfully Recovered
- Repository cloned from GitHub
- All dependencies installed (pnpm)
- Database credentials configured
- Git credentials set up
- Working tree is clean (no uncommitted changes)

### 🔧 Environment Setup
```env
DATABASE_URL=postgresql://postgres:yIzrUQgkqISJFDyEnTwFrTuQSdjQSglA@postgres.railway.internal:5432/railway
DATABASE_PUBLIC_URL=postgresql://postgres:yIzrUQgkqISJFDyEnTwFrTuQSdjQSglA@yamabiko.proxy.rlwy.net:18550/railway
PORT=3000
NODE_ENV=development
```

### 📊 Recent Development History
Latest commits show work on:
1. **Canva-style text editing** - Separate handles for text boxes
2. **Freeform drawing tool** - Added to Create Post dialog
3. **Text overlay improvements** - Dragging, letter spacing, gradients
4. **Tweet screenshot removal** - Removed html2canvas dependency
5. **Popular column limit** - 25 posts max with SEE MORE button
6. **iOS improvements** - "Online" text next to API indicator
7. **Tweet photo copying** - Copy image button for tweets

---

## 🚀 Deployment Configuration

### Railway Setup
- **Project ID**: `264f9650-d262-40db-8a3a-75df2cef5a50`
- **Environment ID**: `cdd5d946-aaae-4203-941d-c01bbb397b81`
- **Database**: PostgreSQL (Railway managed)
- **Build Command**: `pnpm install && pnpm run build`
- **Start Command**: `pnpm db:push && NODE_ENV=production node dist/index.js`

### Background Job Configuration
- **Polling Interval**: 3 minutes (changed from 5 minutes)
- **Daily Reset**: 6:00 AM UK time
- **Timezone**: Europe/London
- **API Status Tracking**: Monitors Fanpage Karma API health

---

## 📝 Key Documentation Files

1. **DEPLOYMENT_SUMMARY.md** - Railway deployment details
2. **FIXES_SUMMARY.md** - Bug fixes and resolutions
3. **RAILWAY_DEPLOYMENT.md** - Complete deployment guide
4. **MIGRATION_SUMMARY.md** - Database migration notes
5. **PERFORMANCE_RECOMMENDATIONS.md** - Optimization tips
6. **PWA_SETUP_GUIDE.md** - Progressive Web App setup

---

## 🔍 Known Issues & Solutions

### Issue: API Response Parsing (FIXED)
- **Problem**: Posts not fetching from Fanpage Karma API
- **Cause**: Incorrect path `response.data?.data` instead of `response.data?.data?.posts`
- **Status**: ✅ Fixed in commit `c931231`

### Issue: Database Migration Conflicts (FIXED)
- **Problem**: Migration tried to CREATE TABLE on existing tables
- **Solution**: Using `drizzle-kit push` instead of regenerating migrations
- **Status**: ✅ Resolved with manual column addition

### Issue: Today-Only Filtering
- **Implementation**: Filters posts to show only today's posts in UK timezone
- **Location**: `server/backgroundJob.ts` lines 279-291
- **Status**: ✅ Working

---

## 🛠️ Available Commands

```bash
# Development
pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:push          # Push schema changes to database

# Code Quality
pnpm check            # TypeScript type checking
pnpm format           # Format code with Prettier
pnpm test             # Run tests

# Icons
pnpm generate-icons   # Generate PWA icons
```

---

## 🎯 Next Steps - What You Can Do

### Option 1: Run Locally
```bash
cd /home/ubuntu/post-sniper
pnpm dev
```
This will start the development server and you can test the app locally.

### Option 2: Check Railway Deployment
- Need to log into Railway dashboard to see deployment status
- Check if the app is running and view logs
- Get the deployed app URL

### Option 3: Continue Development
Common tasks you might want to do:
- Add new features to the Create Post dialog
- Improve the Twitter integration
- Enhance the alert system
- Add more post filtering options
- Improve the MATCHDAY column functionality

### Option 4: Fix Issues
- Check if there are any deployment errors on Railway
- Test the background job is fetching posts correctly
- Verify database connections are working

---

## 📞 Credentials Summary

### GitHub
- **Repository**: https://github.com/stefan-sketch/post-sniper
- **Token**: Configured and stored in git credentials

### Railway
- **API Token**: `027dd3d8-22a9-4db8-be2a-6c6a652e4b33`
- **Project URL**: https://railway.com/project/264f9650-d262-40db-8a3a-75df2cef5a50
- **Database**: PostgreSQL (credentials in .env)

### Database
- **Public URL**: `postgresql://postgres:yIzrUQgkqISJFDyEnTwFrTuQSdjQSglA@yamabiko.proxy.rlwy.net:18550/railway`
- **Internal URL**: `postgresql://postgres:yIzrUQgkqISJFDyEnTwFrTuQSdjQSglA@postgres.railway.internal:5432/railway`

---

## 💡 Quick Reference

### Project Structure
```
post-sniper/
├── client/              # React frontend
│   └── src/
│       ├── components/  # UI components
│       └── pages/       # Page components
├── server/              # Express backend
│   ├── _core/          # Core server functionality
│   ├── backgroundJob.ts # Scheduled post fetching
│   └── db.ts           # Database operations
├── drizzle/            # Database schema & migrations
├── shared/             # Shared types & utilities
└── scripts/            # Build & utility scripts
```

### Important Files
- `package.json` - Dependencies & scripts
- `vite.config.ts` - Frontend build configuration
- `drizzle.config.ts` - Database configuration
- `railway.json` - Railway deployment config
- `.env` - Environment variables (local)

---

## ✅ Ready to Continue!

The project is now fully set up and ready for development. All dependencies are installed, credentials are configured, and the codebase is in a clean state.

**What would you like to do next?**

