// Service Worker for cur8.fun Social Network PWA
const CACHE_NAME = 'cur8-pwa-v1.123';
const APP_VERSION = '1.0.122'; // Questa verrà sostituita automaticamente dal workflow
const BUILD_TIMESTAMP = '2025-07-30T12:53:37Z';

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
// Service worker disabilitato: bypass totale di caching e fetch handling
self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  // Non gestire fetch, lascia tutto al browser
  return;
});