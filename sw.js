// 专心通 Service Worker —— 离线缓存
// 策略：网络优先（保证更新即时生效），失败回退缓存（保证离线可用）
const CACHE_NAME = 'zhuanxintong-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/timer.js',
  './js/sound.js',
  './js/tasks.js',
  './js/stats.js',
  './icon.svg',
  './sw.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // 删除所有旧版本缓存（包括 v1）
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        // 网络成功：把最新版本写回缓存
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => {
        // 网络失败：回退到缓存（离线场景）
        return caches.match(event.request).then((cached) => cached || new Response('离线', { status: 503 }));
      })
  );
});
