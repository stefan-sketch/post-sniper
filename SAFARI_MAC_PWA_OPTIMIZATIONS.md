# Safari Mac PWA Optimizations

## Current Status
Most iOS optimizations also benefit macOS Safari, but we can add Mac-specific improvements.

## Mac-Specific Optimizations

### 1. **Restore Higher Quality Effects** ✅
- Mac hardware can handle full-quality backdrop blur
- Restore 16px blur on desktop while keeping 8px on mobile
- Use CSS media queries to differentiate

### 2. **Trackpad Momentum Scrolling** ✅
- Already optimized with `-webkit-overflow-scrolling: touch`
- Add inertial scrolling support
- Smooth deceleration curves

### 3. **Hover States Optimization** ✅
- Desktop has hover, mobile doesn't
- Optimize hover transitions for instant feedback
- Add will-change on hover for smoother effects

### 4. **Larger Viewport Handling** ✅
- Increase Intersection Observer rootMargin for desktop
- Load more images ahead of time (desktop has more bandwidth)
- Adjust lazy loading thresholds

### 5. **Keyboard Navigation** ✅
- Add keyboard shortcuts for power users
- Arrow keys for navigation
- Cmd+K for search/command palette

### 6. **Desktop Polling** ✅
- Keep faster polling on desktop (10s vs 15s on iOS)
- Desktop users expect real-time updates
- Already implemented in Phase 1

### 7. **Multi-Column Layout Optimization** ✅
- Desktop shows 2-3 columns
- Optimize grid rendering with CSS Grid containment
- Prevent layout thrashing

### 8. **Cursor Optimization** ✅
- Add cursor: pointer to interactive elements
- Optimize cursor changes for instant feedback
- No cursor lag

## Implementation Plan

### Quick Wins (30 minutes)
1. Restore full-quality blur on desktop
2. Increase lazy loading threshold on desktop
3. Add hover will-change optimization
4. Optimize cursor changes

### Medium Impact (1 hour)
5. Add keyboard shortcuts
6. Optimize grid layout containment
7. Add focus states for accessibility

## Expected Gains

| Metric | Current | After Optimization | Improvement |
|--------|---------|-------------------|-------------|
| Blur Quality | 8px | 16px on desktop | +100% visual quality |
| Hover Response | Good | Instant | Feels native |
| Trackpad Scroll | Smooth | Buttery | Perfect |
| Keyboard Nav | None | Full support | Power user friendly |

## Notes
- Mac Safari PWA already benefits from Phase 1 & 2 iOS optimizations
- Focus on restoring quality while maintaining performance
- Add desktop-specific features (keyboard, hover)

