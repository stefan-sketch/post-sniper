# Rollback Instructions

## 📍 Available Save Points

### **Latest Save Point: October 25, 2025** ⭐
- **Tag**: `savepoint-2025-10-25`
- **Commit**: `d87f5a5`
- **Status**: ✅ **STABLE - All iOS improvements complete**

### Previous Save Points
- **Tag**: `pre-optimization-v1.0` (October 24, 2025) - Commit: `2c2d774`
- **Tag**: `rollback-2025-10-25`
- **Tag**: `rollback-2025-10-24`
- **Tag**: `stable-20251022-1900`

---

## 🔄 How to Rollback to Latest Save Point (savepoint-2025-10-25)

### Option 1: Rollback Locally (for testing)

```bash
# Navigate to project directory
cd /home/ubuntu/post-sniper

# Checkout the save point
git checkout savepoint-2025-10-25

# To return to latest version
git checkout main
```

### Option 2: Rollback Main Branch (permanent)

```bash
# Navigate to project directory
cd /home/ubuntu/post-sniper

# Reset main branch to save point
git reset --hard savepoint-2025-10-25

# Force push to GitHub (this will trigger Railway deployment)
git push origin main --force
```

### Option 3: Create a Rollback Branch

```bash
# Navigate to project directory
cd /home/ubuntu/post-sniper

# Create a new branch from save point
git checkout -b rollback-branch savepoint-2025-10-25

# Push to GitHub
git push origin rollback-branch

# Then manually deploy this branch on Railway
```

---

## 📦 What's Included in savepoint-2025-10-25

### ✅ iOS Improvements
- **Minimalistic headers** for Facebook, Twitter, Reddit
- **Centered logos** with clean toggles (no underlines)
- **NEW/POPULAR toggles** for all feeds (Facebook, Twitter, Reddit)
- **iOS image gestures**:
  - Swipe down anywhere to close
  - Pinch to zoom in/out (1x to 5x)
  - Double tap to zoom
  - Image stays centered when zooming
  - No buggy pan/drag

### ✅ Desktop Improvements
- **Full-width images** in 3-column mode (no side/bottom padding)
- **Search button** in Pages mode (far left, leads to "Coming Soon" page)
- **MATCHDAY icon** matches iOS design
- **3-column toggle** working perfectly

### ✅ UI Consistency
- **Footer height** identical on Feed and Pages views
- **Profile pictures** same size as icons (28px × 28px)
- **Gap-8 spacing** on both footers
- **Clean toggles** without underlines

### ✅ Bug Fixes
- **Reddit loading** fixed (retry logic, better headers, 10s timeout)
- **Facebook images** fill full card width in 3-column mode
- **Image zoom** smooth and centered (no buggy behavior)
- **Twitter header** simplified with minimalistic dropdown

---

## 🔍 Verify Save Point

To check the save point details:

```bash
# Show save point info
git show savepoint-2025-10-25

# See all available save points
git tag -l

# Compare current state to save point
git diff savepoint-2025-10-25..HEAD

# See commits since save point
git log savepoint-2025-10-25..main --oneline
```

---

## 🆘 Emergency Rollback (if Railway deployment is broken)

### Method 1: Railway Dashboard
1. Go to **Railway dashboard**
2. Find the **deployment from commit `d87f5a5`**
3. Click **"Redeploy"** on that specific deployment

### Method 2: Git Force Push
```bash
cd /home/ubuntu/post-sniper
git reset --hard savepoint-2025-10-25
git push origin main --force
```

Railway will auto-deploy the rolled-back version in ~2 minutes.

---

## 📊 Rollback to Older Save Points

### Rollback to pre-optimization (October 24, 2025)

```bash
# Rollback to before production optimizations
git checkout pre-optimization-v1.0

# Make it permanent
git checkout main
git reset --hard pre-optimization-v1.0
git push origin main --force
```

### Rollback to specific date

```bash
# See all tags with dates
git tag -l --format='%(refname:short) - %(creatordate:short)'

# Rollback to specific tag
git reset --hard <tag-name>
git push origin main --force
```

---

## ⚠️ Important Notes

1. **Always create a new tag before major changes**:
   ```bash
   git tag -a savepoint-YYYY-MM-DD -m "Description"
   git push origin savepoint-YYYY-MM-DD
   ```

2. **Check what will be lost before rollback**:
   ```bash
   git log savepoint-2025-10-25..HEAD --oneline
   ```

3. **Railway auto-deploys** after pushing to main

4. **Database changes** are NOT rolled back automatically

---

## 🔧 Partial Rollback (Specific Files Only)

If you only want to revert specific changes:

```bash
# Revert specific file
git checkout savepoint-2025-10-25 -- path/to/file

# Example: Revert image modal
git checkout savepoint-2025-10-25 -- client/src/components/ImageModal.tsx

# Commit the changes
git commit -m "Revert ImageModal to save point"
git push origin main
```

---

## 📝 Current State Check

```bash
# Show current commit
git log --oneline -1

# Show current branch
git branch

# Show uncommitted changes
git status

# Show recent commits
git log --oneline -10
```

---

## 🎯 What Gets Restored (savepoint-2025-10-25)

Rolling back to this save point restores:

✅ Working Reddit feed with retry logic  
✅ Minimalistic headers (Facebook, Twitter, Reddit)  
✅ iOS image gestures (swipe, pinch, zoom)  
✅ NEW/POPULAR toggles for all feeds  
✅ Consistent footer design  
✅ Full-width images in 3-column mode  
✅ Search button in Pages mode  
✅ All bug fixes up to October 25, 2025  

---

## 📞 Need Help?

If you encounter issues during rollback:

1. **Check git status**: `git status`
2. **Check current branch**: `git branch`
3. **Check recent commits**: `git log --oneline -10`
4. **Force clean**: `git clean -fd` (removes untracked files)
5. **Reset to remote**: `git fetch origin && git reset --hard origin/main`

---

## 📅 Save Point History

| Date | Tag | Commit | Description |
|------|-----|--------|-------------|
| **2025-10-25** | `savepoint-2025-10-25` | `d87f5a5` | **Latest - All iOS improvements** ⭐ |
| 2025-10-24 | `pre-optimization-v1.0` | `2c2d774` | Before production optimizations |
| 2025-10-22 | `stable-20251022-1900` | - | Stable version |

---

**Last Updated**: October 25, 2025  
**Current Stable Tag**: `savepoint-2025-10-25`  
**Current Stable Commit**: `d87f5a5`

