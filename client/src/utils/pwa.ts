/**
 * Register the service worker for PWA functionality
 */
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('[PWA] Service Worker registered successfully:', registration.scope);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour
      
      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  }
}

/**
 * Check if the app is running as a PWA (installed)
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

/**
 * Show install prompt for PWA
 */
let deferredPrompt: any = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
  });
}

export async function showInstallPrompt() {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available');
    return false;
  }

  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`[PWA] User response to install prompt: ${outcome}`);
  
  // Clear the deferredPrompt
  deferredPrompt = null;
  
  return outcome === 'accepted';
}

/**
 * Request notification permission for push notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('[PWA] This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show a local notification
 */
export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options
    });
  }
}

