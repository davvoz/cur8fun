// Service Worker for cur8.fun Social Network PWA
const CACHE_NAME = 'cur8-pwa-v1.157';
const APP_VERSION = '1.0.154';
const BUILD_TIMESTAMP = '2026-05-16T00:31:13Z';

// Solo assets statici versionati — MAI index.html o navigation HTML
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/index.js',
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

  // Assets statici pesanti (immagini/librerie vendor): cache-first
  const isHeavyStatic = (url.pathname.startsWith('/assets/img/') ||
                        url.pathname.startsWith('/assets/js/'));

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

  // Script/style dell'app:
  // - normale uso: cache-first + aggiornamento in background (massime performance)
  // - su F5/reload: network-first per evitare mismatch tra moduli vecchi/nuovi
  const isAppCode = url.origin === self.location.origin &&
                    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));

  if (isAppCode) {
    const isReloadRequest = event.request.cache === 'reload' || event.request.cache === 'no-cache';

    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        if (isReloadRequest) {
          try {
            const fresh = await fetch(event.request);
            cache.put(event.request, fresh.clone());
            return fresh;
          } catch {
            const cached = await cache.match(event.request);
            if (cached) return cached;
            throw new Error('Network unavailable and no cached asset for reload request');
          }
        }

        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => null);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Tutto il resto (API, blockchain) va sempre alla rete
});