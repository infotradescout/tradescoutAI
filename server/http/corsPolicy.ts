const CORS_NEUTRAL_PUBLIC_PREFIXES = [
  "/assets/",
  "/uploads/",
  "/images/",
  "/fonts/",
  "/icons/",
  "/landing/",
  "/profile-app-icons/",
  "/profile-manifests/",
  "/scoutfitters/",
];

const CORS_NEUTRAL_PUBLIC_PATHS = new Set([
  "/about-explainer.css",
  "/firebase-messaging-sw.js",
  "/manifest.json",
  "/offline.html",
  "/service-worker.js",
  "/site.webmanifest",
  "/sw.js",
]);

export function isCorsNeutralPublicAssetRequest(method: string, requestPath: string): boolean {
  const normalizedMethod = String(method || "").toUpperCase();
  if (normalizedMethod !== "GET" && normalizedMethod !== "HEAD") return false;

  const path = String(requestPath || "");
  if (CORS_NEUTRAL_PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (CORS_NEUTRAL_PUBLIC_PATHS.has(path)) return true;

  return /^\/(?:apple-touch-icon(?:-precomposed)?|favicon(?:-\d+x\d+)?|icon-\d+(?:-maskable)?|logo|tradescout-[a-z0-9-]+)\.(?:ico|jpe?g|png|svg|webp)$/i.test(
    path
  );
}
