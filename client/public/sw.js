const CACHE_NAME = 'tradescout-v20260130';
const STATIC_ASSETS = [
  '/',
  '/manifest.json?v=20260130',
  '/offline.html?v=20260130'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
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
