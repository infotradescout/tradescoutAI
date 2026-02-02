// Legacy-rescue service worker.
// Purpose: stop "forever cache" issues from older versions by:
// - Versioning cache names
// - Clearing old caches on activate
// - Using network-first for navigations (HTML)
// - Caching only safe static asset types

const VERSION = "2026-02-01";
const CACHE_PREFIX = "tradescout-static-";
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;

const PRECACHE_URLS = ["/offline.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key === "tradescout-static-v1" || key.startsWith(CACHE_PREFIX) || key.startsWith("tradescout-v"))
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never serve cached HTML for SPA navigations; this prevents stale bundles/layout.
  const isNavigation = request.mode === "navigate" || request.destination === "document";
  if (isNavigation) {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  const isCacheableAsset = ["script", "style", "image", "font", "manifest"].includes(request.destination);
  if (!isCacheableAsset) return;

  // Stale-while-revalidate for safe static assets.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      return cached || (await networkFetch) || fetch(request);
    })(),
  );
});
