// Legacy SW self-destruct.
// Older TradeScout builds registered `/service-worker.js` with a cache-first strategy that
// could permanently pin old JS/CSS and prevent new deploys from showing up.
//
// Keep this file around so existing installs can update and then unregister cleanly.
const LEGACY_CACHE = 'tradescout-static-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k === LEGACY_CACHE).map((k) => caches.delete(k)));
    } catch (_) {
      // ignore
    }

    try {
      await self.registration.unregister();
    } catch (_) {
      // ignore
    }

    try {
      const clientsList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    } catch (_) {
      // ignore
    }
  })());
});
