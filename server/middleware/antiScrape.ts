import type { NextFunction, Request, Response } from "express";

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
    (req.headers["x-forwarded-for"] as string) ||
    req.ip ||
    req.socket.remoteAddress ||
    "unknown";
  const ua = req.get("user-agent") || "unknown";
  return `${ip}|${ua}`;
};

export function antiScrapeShield(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const ua = req.get("user-agent") || "";
  const path = req.path || req.originalUrl || "";

  // Allow internal health/monitoring checks and static assets
  const allowlistedPaths = [
    /^\/api\/health/i, 
    /^\/api\/(scout|assistant)\/health/i,
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i, // static assets
    /^\/@vite/i, // vite HMR
    /^\/node_modules/i, // dev dependencies
  ];
  if (allowlistedPaths.some((p) => p.test(path))) {
    return next();
  }

  // Allow configured scraper agents or header token to bypass UA blocks (for LLM/bot crawlers)
  const allowedAgents = (process.env.SCRAPE_ALLOW_AGENTS || "scout-crawler,mealscout-bot")
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
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Block known scraping user agents early (only in production)
  if (isProduction && blockedUserAgents.some((pattern) => pattern.test(ua))) {
    return res.status(403).json({ error: "Automated scraping is blocked." });
  }

  const key = getKey(req);
  const bucket = buckets.get(key) || { hits: [] };
  cleanBucket(bucket, now);
  bucket.hits.push(now);
  buckets.set(key, bucket);

  const windowHits = bucket.hits.length;
  const burstHits = bucket.hits.filter((ts) => now - ts <= BURST_WINDOW_MS).length;

  const windowLimit = isSensitivePath(path) ? Math.floor(MAX_WINDOW_HITS / 3) : MAX_WINDOW_HITS;
  const burstLimit = isSensitivePath(path) ? Math.floor(MAX_BURST_HITS / 2) : MAX_BURST_HITS;

  // In development, log but don't block
  if (burstHits > burstLimit || windowHits > windowLimit) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(429).json({
        error: "Too many requests. Slow down to continue.",
      });
    } else {
      console.log(`[AntiScrape] Rate limit hit but allowing in dev: ${windowHits}/${windowLimit} window, ${burstHits}/${burstLimit} burst`);
    }
  }

  res.setHeader("X-Scout-Guard", "enabled");
  return next();
}
