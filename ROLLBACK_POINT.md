# Rollback Point: v1.0-stable

**Created:** October 24, 2025  
**Commit:** 891c044  
**Tag:** v1.0-stable

## Features Included

This stable release includes all the following working features:

### Image & Media
- ✅ Image expansion modals (lightbox) for all feeds using React portals
- ✅ Images display centered across entire app viewport
- ✅ Click images to view full-size in modal
- ✅ Reddit GIF support in comments
- ✅ External link buttons on all feed cards

### Twitter/X Feed
- ✅ Automatic time-based scheduling (8am-midnight UK time)
- ✅ No manual play/pause button needed
- ✅ API rate limit conservation during off-hours
- ✅ Redesigned Twitter cards (verified badges, username below name)

### Create Post Dialog
- ✅ Close button (X) - top-left, discards all progress
- ✅ Minimize button (-) - top-left, preserves state
- ✅ Green pulsing "Continue Post" floating button when minimized
- ✅ Smart backdrop behavior - clicking outside minimizes (doesn't close)
- ✅ ESC key minimizes instead of closing
- ✅ Full state preservation when minimized

### Reddit Feed
- ✅ Top 25 comments sorted by popularity
- ✅ Scrollable comments section with custom scrollbar
- ✅ GIF rendering in comments
- ✅ Compact "Newest" sort button

### UI/UX Improvements
- ✅ Centered column headers in 3-column mode
- ✅ Consistent button sizing across all feeds
- ✅ Removed discovery icon from Popular column
- ✅ Time filter dropdown positioned next to social buttons

## How to Rollback

If you need to return to this stable state:

```bash
# View available tags
git tag -l

# Rollback to this stable point
git checkout v1.0-stable

# Or create a new branch from this point
git checkout -b rollback-branch v1.0-stable

# Or reset main to this point (DESTRUCTIVE - use with caution)
git reset --hard v1.0-stable
git push origin main --force
```

## Deployment Status

- ✅ All changes committed
- ✅ Pushed to GitHub (main branch)
- ✅ Tagged as v1.0-stable
- ✅ Railway auto-deployment triggered

## Recent Commits Included

1. `891c044` - Remove Twitter play/pause button, add automatic pause midnight-8am UK time
2. `bded854` - Make backdrop/ESC minimize dialog instead of closing, only X button closes and discards
3. `360c17e` - Remove discovery icon from Popular column header
4. `08d9159` - Move close/minimize buttons to top-left, change floating button to green with Continue Post text
5. `091bc31` - Add minimize and close buttons to create post dialog with pulsing floating button
6. `6d3bd30` - Add GIF parsing and display support for Reddit comments
7. `d98e8a7` - Fix image modals to display centered across whole app using portals, resize Twitter play/pause button
8. `166d57e` - Redesign Twitter cards: remove timestamp, add verified badge, improve layout
9. `a033681` - Restore image modals for all feeds and fix Reddit comment scrolling
10. `f2628f8` - Update Reddit comments to fetch top 25 and sort by popularity

## Notes

This is a stable, fully-tested release with all major features working correctly. Use this as a safe rollback point if future changes introduce issues.

