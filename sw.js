// Service Worker for cur8.fun Social Network PWA
const CACHE_NAME = 'cur8-pwa-v1.154';
const APP_VERSION = '1.0.151';
const BUILD_TIMESTAMP = '2026-05-15T12:36:30Z';

// Solo assets statici versionati — MAI index.html o navigation HTML
const ASSETS_TO_CACHE = [
  '/index.js',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/css/styles.css',
  '/assets/img/logo_tra.png',
  '/assets/img/default-avatar.png',
  '/assets/js/steem.min.js',
  '/assets/js/steemlogin.min.js',
  '/assets/js/steem-content-renderer.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Navigation requests (HTML): network-first — sempre la versione più recente.
  // Cache solo come fallback offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        // Aggiorna la cache con la risposta fresca
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  // Cache-first per assets statici con hash/versione (steem lib, css, img)
  const isHeavyStatic = url.pathname.startsWith('/assets/') ||
                        url.pathname === '/index.js';

  if (isHeavyStatic) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
      )
    );
    return;
  }

  // Stale-while-revalidate per tutti i moduli JS dell'app (views/, services/, etc.)
  // Primo load: dalla rete + salva in cache. Reload successivi: cache istantanea + aggiorna in background.
  const isAppModule = url.origin === self.location.origin &&
                      url.pathname.endsWith('.js') &&
                      !url.pathname.startsWith('/assets/');

  if (isAppModule) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request).then(response => {
            cache.put(event.request, response.clone());
            return response;
          });
          // Serve subito dalla cache se disponibile, aggiorna in background
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Tutto il resto (API, blockchain) va sempre alla rete
});