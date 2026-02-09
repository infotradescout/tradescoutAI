// Emergency service worker reset.
// Goal: guarantee clients stop serving stale UI bundles.

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("tradescout-") ||
              key.startsWith("workbox-") ||
              key.startsWith("vite-"),
          )
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Intentionally no caching.
});
