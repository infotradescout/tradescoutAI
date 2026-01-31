const CACHE_NAME = 'tradescout-v20260131a';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate event - clean up legacy caches so deploys take effect immediately
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (key === CACHE_NAME) return Promise.resolve(false);
        if (key === 'tradescout-static-v1' || key.startsWith('tradescout-')) {
          return caches.delete(key);
        }
        return Promise.resolve(false);
      })
    );
    await self.clients.claim();
  })());
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(syncOfflineActions());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };

  event.waitUntil(
    self.registration.showNotification('TradeScout', options)
  );
});

function syncOfflineActions() {
  // Placeholder for actual offline action synchronization logic
  return Promise.resolve();
}
