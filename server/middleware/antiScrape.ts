import type { NextFunction, Request, Response } from "express";
import { getRedisClient, isRedisConfigured } from "../utils/redisClient";

// Simple in-memory anti-scraping guard. For production, back with Redis.
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BURST_WINDOW_MS = 30 * 1000; // 30 seconds
const MAX_WINDOW_HITS = 300; // generous for normal browsing with dev tools
const MAX_BURST_HITS = 100; // allows legitimate page loads with many assets

const sensitivePathPatterns = [
  /\/api\/.*users/i,
  /\/api\/.*profiles/i,
  /\/api\/.*export/i,
  /\/api\/.*admin/i,
];

const blockedUserAgents = [
  /curl/i,
  /python-requests/i,
  /scrapy/i,
  /wget/i,
  /httpclient/i,
  /okhttp/i,
  /powershell/i,
  /postmanruntime/i,
  /java/i,
];

type Bucket = {
  hits: number[];
};

const buckets = new Map<string, Bucket>();

const isSensitivePath = (path: string): boolean =>
  sensitivePathPatterns.some((pattern) => pattern.test(path));

const cleanBucket = (bucket: Bucket, now: number) => {
  bucket.hits = bucket.hits.filter((ts) => now - ts <= WINDOW_MS);
};

const getKey = (req: Request): string => {
  const ip =
    (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "unknown";
  const ua = req.get("user-agent") || "unknown";
  return `${ip}|${ua}`;
};

async function incrementRedisCounters(
  key: string
): Promise<{ windowHits: number; burstHits: number } | null> {
  if (!isRedisConfigured()) return null;

  const client = await getRedisClient();
  if (!client) return null;

  const windowKey = `antiscrape:window:${key}`;
  const burstKey = `antiscrape:burst:${key}`;

  try {
    const windowHits = await client.incr(windowKey);
    if (windowHits === 1) {
      await client.pExpire(windowKey, WINDOW_MS);
    }

    const burstHits = await client.incr(burstKey);
    if (burstHits === 1) {
      await client.pExpire(burstKey, BURST_WINDOW_MS);
    }

    return { windowHits, burstHits };
  } catch {
    return null;
  }
}

export async function antiScrapeShield(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const ua = req.get("user-agent") || "";
  const path = req.path || req.originalUrl || "";

  // Allow internal health/monitoring checks and static assets
  const allowlistedPaths = [
    /^\/api\/health/i,
    /^\/api\/(scout|assistant)\/health/i,
    // Auth/session probes and county selectors are critical boot-time endpoints.
    // Never rate-limit these or pre-scout setup can dead-end for real users.
    /^\/api\/auth\/user$/i,
    /^\/api\/states$/i,
    /^\/api\/counties$/i,
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i, // static assets
    /^\/@vite/i, // vite HMR
    /^\/node_modules/i, // dev dependencies
  ];
  // Context-aware social cards are generated on demand despite their .png
  // suffix, so they must retain the ordinary per-client request limits.
  const isDynamicSocialPreview = /^\/images\/social\//i.test(path);
  if (!isDynamicSocialPreview && allowlistedPaths.some((p) => p.test(path))) {
    return next();
  }

  // Public discovery surfaces should remain fetchable by crawlers/tools.
  // We still apply rate limiting below, but we do not hard-block on UA here.
  const publicDiscoveryPaths = [
    /^\/$/,
    /^\/robots\.txt$/i,
    /^\/llms\.txt$/i,
    /^\/sitemap.*\.xml$/i,
    /^\/business\//i,
    /^\/trade\//i,
    /^\/city\//i,
    /^\/county\//i,
    /^\/datasets\//i,
    /^\/best\//i,
  ];
  const isPublicDiscoveryPath = publicDiscoveryPaths.some((p) => p.test(path));

  // Allow configured scraper agents or header token to bypass UA blocks (for LLM/bot crawlers)
  const allowedAgents = (process.env.SCRAPE_ALLOW_AGENTS || "scout-crawler")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const uaNormalized = ua.toLowerCase();
  const bypassToken = process.env.SCRAPE_BYPASS_TOKEN;
  const requestToken = req.get("x-scrape-token");
  const isAllowlistedAgent = allowedAgents.some((agent) => uaNormalized.includes(agent));
  const hasBypassToken = bypassToken && requestToken && requestToken === bypassToken;

  if (isAllowlistedAgent || hasBypassToken) {
    return next();
  }

  // In development, skip user agent blocking
  const isProduction = process.env.NODE_ENV === "production";

  // Block known scraping user agents early (only in production)
  const isApiPath = /^\/api\//i.test(path);
  if (
    isProduction &&
    !isPublicDiscoveryPath &&
    (isApiPath || isSensitivePath(path)) &&
    blockedUserAgents.some((pattern) => pattern.test(ua))
  ) {
    return res.status(403).json({ error: "Automated scraping is blocked." });
  }

  const key = getKey(req);
  const distributedCounters = await incrementRedisCounters(key);

  let windowHits = 0;
  let burstHits = 0;

  if (distributedCounters) {
    windowHits = distributedCounters.windowHits;
    burstHits = distributedCounters.burstHits;
  } else {
    const bucket = buckets.get(key) || { hits: [] };
    cleanBucket(bucket, now);
    bucket.hits.push(now);
    buckets.set(key, bucket);
    windowHits = bucket.hits.length;
    burstHits = bucket.hits.filter((ts) => now - ts <= BURST_WINDOW_MS).length;
  }

  const windowLimit = isSensitivePath(path) ? Math.floor(MAX_WINDOW_HITS / 3) : MAX_WINDOW_HITS;
  const burstLimit = isSensitivePath(path) ? Math.floor(MAX_BURST_HITS / 2) : MAX_BURST_HITS;

  // In development, don't log or block (too noisy with HMR)
  if (burstHits > burstLimit || windowHits > windowLimit) {
    if (process.env.NODE_ENV === "production") {
      return res.status(429).json({
        error: "Too many requests. Slow down to continue.",
      });
    }
    // In dev: silently allow
  }

  res.setHeader("X-Scout-Guard", "enabled");
  return next();
}
