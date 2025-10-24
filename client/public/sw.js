// Enhanced Service Worker with Workbox-like strategies
const CACHE_NAME = 'post-sniper-v3';
const STATIC_CACHE = 'static-v3';
const IMAGE_CACHE = 'images-v3';
const API_CACHE = 'api-v3';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install service worker and precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
  );
  self.skipWaiting();
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE, IMAGE_CACHE, API_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cache expiration helper
function isCacheExpired(response, maxAge) {
  if (!response) return true;
  
  const cachedTime = response.headers.get('sw-cache-time');
  if (!cachedTime) return true;
  
  const age = Date.now() - parseInt(cachedTime);
  return age > maxAge;
}

// Add timestamp to cached responses
function addCacheTime(response) {
  const clonedResponse = response.clone();
  const headers = new Headers(clonedResponse.headers);
  headers.append('sw-cache-time', Date.now().toString());
  
  return clonedResponse.arrayBuffer().then((buffer) => {
    return new Response(buffer, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers: headers
    });
  });
}

// Cache-First Strategy (for images)
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached && !isCacheExpired(cached, maxAge)) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseWithTime = await addCacheTime(response);
      cache.put(request, responseWithTime.clone());
      return responseWithTime;
    }
    return response;
  } catch (error) {
    if (cached) return cached; // Return stale cache on network error
    throw error;
  }
}

// Network-First Strategy (for API calls)
async function networkFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseWithTime = await addCacheTime(response);
      cache.put(request, responseWithTime.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && !isCacheExpired(cached, maxAge)) {
      console.log('[SW] Network failed, serving from cache:', request.url);
      return cached;
    }
    throw error;
  }
}

// Stale-While-Revalidate Strategy (for static resources)
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// Main fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different resource types with appropriate strategies
  
  // Images: Cache-First with 7 days expiration
  if (request.destination === 'image' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(
      cacheFirst(request, IMAGE_CACHE, 7 * 24 * 60 * 60 * 1000) // 7 days
    );
    return;
  }
  
  // API calls: Network-First with 5 minutes expiration
  if (url.pathname.startsWith('/trpc') || url.pathname.startsWith('/api')) {
    event.respondWith(
      networkFirst(request, API_CACHE, 5 * 60 * 1000) // 5 minutes
    );
    return;
  }
  
  // Static assets (CSS, JS): Stale-While-Revalidate
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    /\.(css|js)$/i.test(url.pathname)
  ) {
    event.respondWith(
      staleWhileRevalidate(request, STATIC_CACHE)
    );
    return;
  }
  
  // HTML pages: Network-First with short cache
  if (request.destination === 'document' || url.pathname === '/') {
    event.respondWith(
      networkFirst(request, STATIC_CACHE, 60 * 1000) // 1 minute
    );
    return;
  }
  
  // Default: Network-First
  event.respondWith(
    networkFirst(request, CACHE_NAME, 10 * 60 * 1000) // 10 minutes
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New post alert!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'post-alert',
    requireInteraction: false,
    actions: [
      { action: 'view', title: 'View Post' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('SDL Media', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPosts());
  }
});

async function syncPosts() {
  // Placeholder for background sync logic
  console.log('[SW] Background sync triggered');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-posts') {
    event.waitUntil(updatePosts());
  }
});

async function updatePosts() {
  // Placeholder for periodic sync logic
  console.log('[SW] Periodic sync triggered');
}

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[SW] Service Worker v3 loaded with enhanced caching strategies');

