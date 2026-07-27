/* オフライン動作用 Service Worker: アプリシェルをキャッシュして常にオフラインで起動できるようにする */
'use strict';

const CACHE = 'edh-life-counter-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // キャッシュ優先。ネットワークが使えるときは裏側で更新しておく。
  event.respondWith(
    caches.match(req).then(hit => {
      const fetched = fetch(req)
        .then(res => {
          // クエリ付きの URL はキャッシュを無駄に増やすので保存しない
          if (res && res.ok && new URL(req.url).origin === location.origin && !new URL(req.url).search) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match('./index.html'));
      return hit || fetched;
    })
  );
});
