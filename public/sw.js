self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Simple network-first strategy; pass-through for now
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
