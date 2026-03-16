/* TradeScout PWA Service Worker
 *
 * Goals:
 * - Keep installability (Chromium requires an SW that controls the page).
 * - Avoid stale HTML: use network-first for navigations.
 * - Speed up static assets: cache-first for Vite hashed assets under /assets/.
 *
 * This is intentionally conservative: we do not cache API responses.
 */

// Bump this whenever caching behavior changes to guarantee clients drop old caches.
const CACHE_VERSION = "v9-2026-03-15";
const STATIC_CACHE = `tradescout-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll([OFFLINE_URL]);
      } catch {
        // offline.html is optional; ignore if missing.
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("tradescout-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function navigationNetworkOnly(request) {
  // IMPORTANT: Do not cache HTML navigations.
  // Stale cached HTML can reference removed hashed assets after deploys, causing "old version" lock-in.
  // We prefer correctness over offline support here.
  const cache = await caches.open(STATIC_CACHE);

  try {
    return await fetch(request);
  } catch {
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!request || request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for navigations (prevents stale HTML).
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(navigationNetworkOnly(request));
    return;
  }

  // For JS/CSS app chunks, prefer network first to avoid users getting stuck on stale
  // cached bundles when a deploy happens during an active session.
  if (
    url.pathname.startsWith("/assets/") &&
    (request.destination === "script" || request.destination === "style")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for other static assets under /assets/ (images/fonts/etc).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
});
