# Rollback Instructions

## 🔄 How to Rollback to Pre-Optimization State

If you need to revert the production optimizations, you have **3 easy options**:

---

## Option 1: Rollback Using Git Tag (Recommended)

```bash
# View available tags
git tag -l

# Rollback to pre-optimization state
git checkout pre-optimization-v1.0

# If you want to make this the current main branch
git checkout main
git reset --hard pre-optimization-v1.0
git push origin main --force
```

**Tag Details:**
- **Name:** `pre-optimization-v1.0`
- **Created:** October 24, 2025
- **Description:** Rollback point before production optimizations

---

## Option 2: Rollback Using Backup Branch

```bash
# Switch to backup branch
git checkout backup-pre-optimization

# If you want to restore main from backup
git checkout main
git reset --hard backup-pre-optimization
git push origin main --force
```

**Branch Details:**
- **Name:** `backup-pre-optimization`
- **Contains:** Exact state before optimizations started

---

## Option 3: Rollback Specific Files Only

If you only want to revert specific changes:

```bash
# Revert service worker changes
git checkout pre-optimization-v1.0 -- client/public/sw.js

# Revert image optimization
git checkout pre-optimization-v1.0 -- server/routers/imageProxy.ts

# Revert CSS changes
git checkout pre-optimization-v1.0 -- client/src/index.css

# Commit the reverted changes
git commit -m "Revert specific optimization changes"
git push origin main
```

---

## 🔍 Verify Current State

To check which version you're on:

```bash
# Show current commit
git log --oneline -1

# Show all tags
git tag -l

# Show current branch
git branch
```

---

## 📊 What Gets Reverted

Rolling back will restore:

✅ Original service worker (basic caching)  
✅ Original image loading (no optimization)  
✅ Original CSS (no performance enhancements)  
✅ Original database queries (no indexes)  
✅ Original API responses (no compression)  
✅ Original post rendering (no virtual scrolling)  

---

## ⚠️ Important Notes

1. **Database Changes:** If database indexes were added, you may need to manually drop them:
   ```sql
   DROP INDEX IF EXISTS idx_cached_posts_created_at;
   DROP INDEX IF EXISTS idx_cached_posts_page_id;
   DROP INDEX IF EXISTS idx_cached_posts_engagement;
   ```

2. **Dependencies:** After rollback, run:
   ```bash
   pnpm install
   pnpm build
   ```

3. **Railway Deployment:** Railway will auto-deploy the rolled-back version after you push to main

---

## 🆘 Emergency Rollback (Railway)

If the app is broken in production:

1. Go to Railway Dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Find the last working deployment
5. Click "Redeploy" on that deployment

This immediately restores the previous working version without touching git.

---

## 📞 Need Help?

If you encounter issues during rollback:

1. Check git status: `git status`
2. Check current branch: `git branch`
3. Check recent commits: `git log --oneline -10`
4. Force clean: `git clean -fd` (removes untracked files)

---

**Created:** October 24, 2025  
**Rollback Point Commit:** `2c2d774`  
**Tag:** `pre-optimization-v1.0`  
**Backup Branch:** `backup-pre-optimization`

