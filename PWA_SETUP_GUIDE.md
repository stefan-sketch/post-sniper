# 📱 PWA Installation Guide

Your Post Sniper app is now a **Progressive Web App (PWA)**! Users can install it on their iPhone home screen and use it like a native app.

## ✨ Features

- **📱 Home Screen Icon** - Custom SDL Media logo icon
- **🚀 Full-Screen Experience** - No browser bars, looks like a native app
- **⚡ Offline Support** - Works even without internet (cached data)
- **🔔 Push Notifications** - Get alerts for trending posts
- **💾 Automatic Updates** - Updates automatically when you deploy
- **🎨 Splash Screen** - Professional loading screen

## 📲 How to Install on iPhone

1. **Open Safari** on your iPhone
2. **Visit** your app URL: `https://post-sniper-production.up.railway.app`
3. **Tap the Share button** (square with arrow pointing up) at the bottom
4. **Scroll down** and tap **"Add to Home Screen"**
5. **Customize the name** if you want (default: "Post Sniper")
6. **Tap "Add"** in the top right

That's it! The app icon will appear on your home screen.

## 🎯 How to Install on Android

1. **Open Chrome** on your Android device
2. **Visit** your app URL
3. **Tap the menu** (three dots) in the top right
4. **Tap "Add to Home screen"** or **"Install app"**
5. **Tap "Install"** in the popup

## 🖼️ Changing the Icon

To update the app icon:

1. Replace `/client/public/logo.png` with your new logo
2. Run: `pnpm generate-icons`
3. Commit and deploy

All icon sizes will be regenerated automatically!

## 🔧 Technical Details

### Files Created

- **`/client/public/manifest.json`** - PWA configuration
- **`/client/public/sw.js`** - Service worker for offline support
- **`/client/public/icons/`** - All icon sizes (72px to 512px)
- **`/client/src/utils/pwa.ts`** - PWA utilities
- **`/scripts/generate-icons.mjs`** - Icon generation script

### What Happens on Deployment

1. Service worker registers automatically in production
2. App becomes installable on iOS and Android
3. Users get prompted to install (on Android)
4. iOS users can manually add to home screen

### Offline Behavior

The service worker uses a **network-first** strategy:
- Tries to fetch fresh data from the network
- Falls back to cached data if offline
- Automatically caches new data as it's fetched

## 🎨 Customization

### Change App Name

Edit `/client/public/manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "Short Name"
}
```

### Change Theme Color

Edit `/client/public/manifest.json`:
```json
{
  "theme_color": "#22d3ee",
  "background_color": "#0a0a0a"
}
```

### Add Shortcuts

Already configured! Users can long-press the app icon to access:
- **Live Posts** - Quick access to live feed
- **Popular Posts** - Quick access to popular posts

## 🔔 Push Notifications (Future)

The PWA is already set up for push notifications. To enable:

1. Add push notification service (e.g., Firebase Cloud Messaging)
2. Request permission using `requestNotificationPermission()` from `/client/src/utils/pwa.ts`
3. Send notifications when posts meet certain criteria

## 📊 Testing

### Test PWA Features

1. **Install the app** on your iPhone
2. **Turn on Airplane Mode**
3. **Open the app** - it should still work with cached data
4. **Turn off Airplane Mode**
5. **Refresh** - new data loads automatically

### Check PWA Score

Use Chrome DevTools Lighthouse:
1. Open your app in Chrome
2. Press F12 (DevTools)
3. Go to "Lighthouse" tab
4. Select "Progressive Web App"
5. Click "Generate report"

## 🚀 Deployment

Every time you deploy to Railway:
- Service worker updates automatically
- Users get the latest version next time they open the app
- No need to reinstall

## ✅ Checklist

- [x] PWA manifest created
- [x] Service worker implemented
- [x] All icon sizes generated
- [x] iOS meta tags added
- [x] Offline support enabled
- [x] Install prompt handling
- [x] Push notification support (ready to use)
- [x] Automatic updates configured

## 🎉 You're Done!

Your app is now a fully functional PWA! Users can install it on their iPhone home screen and use it like a native app.

**Next Steps:**
1. Test the installation on your iPhone
2. Share the app with users
3. Monitor usage in Railway logs
4. Consider adding push notifications for alerts

---

**Questions?** Check the code in `/client/src/utils/pwa.ts` for PWA utilities and functions.

