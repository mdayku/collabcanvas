// CollabCanvas Service Worker - Cache Management
const CACHE_NAME = 'collabcanvas-v' + Date.now();
const STATIC_CACHE_NAME = 'collabcanvas-static-v1';

// Files that should be cached with long-term storage
const STATIC_FILES = [
  '/favicon.svg'
];

// Install event - clean up old caches
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static files');
      return cache.addAll(STATIC_FILES);
    }).then(() => {
      // Force the service worker to become active immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old versions of our cache
          if (cacheName.startsWith('collabcanvas-v') && cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - cache strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different types of requests
  if (request.method !== 'GET') {
    // Don't cache non-GET requests
    return;
  }
  
  // For HTML requests, always fetch from network to get latest version
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache HTML responses
          return response;
        })
        .catch(() => {
          // If network fails, try cache as fallback
          return caches.match(request);
        })
    );
    return;
  }
  
  // For JS/CSS with hash in filename, cache aggressively
  if (url.pathname.includes('-') && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cachedResponse;
          }
          
          return fetch(request).then((networkResponse) => {
            // Cache the response for future use
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }
  
  // For static assets, use static cache
  if (STATIC_FILES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request, { cacheName: STATIC_CACHE_NAME })
        .then((cachedResponse) => {
          return cachedResponse || fetch(request);
        })
    );
    return;
  }
  
  // For API requests or other dynamic content, always fetch from network
  event.respondWith(fetch(request));
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients when a new version is available
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION',
      version: CACHE_NAME
    });
  }
});
