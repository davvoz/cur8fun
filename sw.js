// Service Worker for cur8.fun Social Network PWA
const CACHE_NAME = 'cur8-pwa-v1.93';
const APP_VERSION = '1.0.92'; // Questa verrà sostituita automaticamente dal workflow
const BUILD_TIMESTAMP = '2025-06-27T23:00:52Z';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.js',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/css/styles.css',
  '/assets/img/logo_tra.png',
  '/assets/img/default-avatar.png'
];

// Install event - Cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Dopo aver pulito le vecchie cache, invia un messaggio a tutti i client
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: APP_VERSION,
            timestamp: BUILD_TIMESTAMP
          });
        });
      });
      return self.clients.claim();
    })
  );
});

// Message event - Handle messages from clients
self.addEventListener('message', event => {
  if (!event.data || typeof event.data !== 'object') return;

  switch (event.data.type) {
    case 'CHECK_VERSION':
      // Quando un client richiede di controllare la versione
      event.source.postMessage({
        type: 'VERSION_INFO',
        version: APP_VERSION,
        timestamp: BUILD_TIMESTAMP
      });
      break;
    
    case 'GET_VERSION_INFO':
      // Invia informazioni sulla versione
      event.source.postMessage({
        type: 'VERSION_INFO',
        version: APP_VERSION,
        timestamp: BUILD_TIMESTAMP
      });
      break;
    
    case 'SKIP_WAITING':
      // Attiva immediatamente il nuovo service worker
      self.skipWaiting();
      break;
  }
});

// Fetch event - Serve from cache first, then network
self.addEventListener('fetch', event => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('extension') ||
      // Skip steem API calls to prevent caching dynamic content
      event.request.url.includes('api.steemit.com') ||
      event.request.url.includes('api.steem.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response as it can only be consumed once
            const responseToCache = response.clone();

            // Open cache and store response for future
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })          .catch(error => {
            // Network failed, show offline page if available
            console.log('Fetch failed:', error);
            return caches.match('/offline.html').then(offlineResponse => {
              return offlineResponse || new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
          });
      })
  );
});