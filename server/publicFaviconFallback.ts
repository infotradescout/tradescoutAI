import type { Request, Response } from "express";

const LEGACY_FAVICON_PATH = "/favicon.ico";
const CANONICAL_FAVICON_PATH = "/favicon-32x32.png";

/**
 * Browsers and crawlers request /favicon.ico even when a profile page declares
 * its own icon. Keep that conventional path healthy on TradeScout and every
 * mapped profile domain by redirecting to the existing real PNG asset.
 */
export function handlePublicFaviconFallback(req: Request, res: Response): boolean {
  if (String(req.path || "") !== LEGACY_FAVICON_PATH) return false;
  const method = String(req.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  res.redirect(301, CANONICAL_FAVICON_PATH);
  return true;
}
