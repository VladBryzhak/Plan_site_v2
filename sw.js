/* =====================
   sw.js — Service Worker v3
   ===================== */

const CACHE_NAME = 'fitness-plan-v3';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/app.js',
  './manifest.json',
  './icons/main-icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
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
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  /* Пропускаємо YouTube — відео не можна кешувати */
  if (
    event.request.url.includes('youtube.com') ||
    event.request.url.includes('youtu.be') ||
    event.request.url.includes('ytimg.com') ||
    event.request.url.includes('yt3.ggpht.com')
  ) return;

  /* Пропускаємо Google Fonts (вони мають власний кеш) */
  if (event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
