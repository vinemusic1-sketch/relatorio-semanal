const cachePrefix = 'relatorio-semanal-';
const cacheName = cachePrefix + 'v29';
const scope = new URL(self.registration.scope);
const assets = ['/', '/index.html', '/style.css', '/app.js', '/camera.js', '/exports.js', '/stamp.js', '/manifest.webmanifest', '/rl-180.png', '/rl-192.png', '/rl-512.png'];
self.addEventListener('install', event => {
  const requests = assets.map(path => new Request(new URL('.'+path,scope),{cache:'reload'}));
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = '/'+url.pathname.slice(scope.pathname.length);
  if (event.request.method !== 'GET' || url.origin !== location.origin || (!assets.includes(path) && path !== '/stamp.js' && !path.startsWith('/ocr/'))) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    if (path.startsWith('/ocr/')) {
      const saved = await cache.match(event.request);
      if (saved) return saved;
    }
    try {
      const response = await fetch(event.request,{cache:'no-cache'});
      if (response.ok && (path.startsWith('/ocr/') || assets.includes(path))) {
        try { await cache.put(event.request,response.clone()); } catch {}
      }
      return response;
    } catch {
      return cache.match(event.request,{ignoreSearch:true});
    }
  }));
});
