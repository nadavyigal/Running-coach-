// Service Worker for Running Coach PWA
// Implements cache-first strategy for static assets to improve performance
// Updated: 2025-12-06 - Cleared all caches for latest UI updates

const CACHE_NAME = 'running-coach-v5-20251215';
const STATIC_CACHE = 'static-v5-20251215';

// Cache Next.js static assets on install
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/offline.html',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return Promise.all(
          STATIC_ASSETS.map(async (asset) => {
            try {
              await cache.add(asset);
            } catch (error) {
              // Best-effort: don't fail install if one asset is unavailable.
              console.warn('Failed to cache static asset:', asset, error);
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache-first strategy for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Don't cache API routes
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone))
              .catch((error) => console.warn('Failed to cache navigation response:', error));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;

          return caches.match('/offline.html');
        })
    );
    return;
  }

  // Cache-first strategy for Next.js static chunks
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request).then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              cache.put(request, responseClone).catch((error) => {
                console.warn('Failed to cache static asset:', error);
              });
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Network-first for everything else (HTML pages, data)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200 && !url.pathname.startsWith('/api/')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone))
            .catch((error) => console.warn('Failed to cache response:', error));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(request);
      })
  );
});
