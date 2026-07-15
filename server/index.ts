// Load dotenv configuration before anything else (safe in all envs)
import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { registerRoutes } from "./routes";
import { logger } from "./services/logger";
import { createInvoicingDocumentsRouter } from "./invoicingDocumentsRouter";
import { db, pool } from "./db";
import { notificationService } from "./notification-service";
import { startCrawlerScheduler } from "./services/crawlerScheduler";
import {
  acquireSchedulerLeadership,
  releaseSchedulerLeadership,
} from "./services/schedulerLeadership";
import { initializeMessagingService } from "./messaging-service";
import { storage } from "./storage";
import {
  ensureBusinessPublicDiscoveryEnabledColumn,
  ensureDocumentsTables,
  ensureProfilesTable,
} from "./ensureDb";
import { runSchemaPreflight } from "./schemaPreflight";
import { runRuntimeMigrations } from "./runtimeMigrations";
import { assertStartupInvariants } from "./startupInvariants";
import { emitHttpStatus } from "./observability/metrics";
import { botReadOnlyGuard } from "./middleware/botReadOnlyGuard";
import { landingContractHeaders } from "./middleware/landingContractHeaders";
import {
  recordCrawlerRequestEvent,
  getLandingIntentContractForPath,
} from "./services/crawlerTelemetryService";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { buildPublicProfileHtml } from "./publicProfileHtml";
import { buildPublicBusinessHtml } from "./publicBusinessHtml";
import {
  buildPublicTradeCountyHtml,
  buildPublicTradeDirectoryHtml,
  buildPublicTradeOverviewHtml,
  buildPublicTradeStateHtml,
} from "./publicTradeHtml";
import { buildPublicCityHtml } from "./publicCityHtml";
import { buildPublicTradeCityHtml } from "./publicTradeCityHtml";
import { buildPublicCountyHtml } from "./publicCountyHtml";
import { detectActorFromUserAgent } from "./utils/requestActor";
import { buildPublicBestTradeCityHtml, buildPublicBestTradeCountyHtml } from "./publicBestHtml";
import {
  buildPublicCityRecentHtml,
  buildPublicCountyRecentHtml,
  buildPublicTradeCityRecentHtml,
  buildPublicTradeCountyRecentHtml,
} from "./publicRecentHtml";
import {
  buildPublicDatasetsCitiesHtml,
  buildPublicDatasetsCountiesHtml,
  buildPublicDatasetsLandingHtml,
  buildPublicDatasetsTradesHtml,
} from "./publicDatasetsHtml";
import { buildPublicLandingHtml } from "./publicLandingHtml";
import { buildPublicExchangeHtml } from "./publicExchangeHtml";
import { buildPublicExchangeListingHtml } from "./publicExchangeListingHtml";
import { buildWorkRequestShareHtml } from "./workRequestShareHtml";
import { registerUploadsFallback } from "./uploadsFallback";
import { affiliateAccounts, businesses, profiles, users } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { closeRedisClient } from "./utils/redisClient";
import { provisionJrsAutoGlassProfile } from "./services/jrsAutoGlassProfileProvisioning";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicProfileTemplateCache = new Map<string, string>();
const CANONICAL_WEB_HOST = "www.thetradescout.com";

function shouldRetainSeoSummaryForRequest(req: Request): boolean {
  const userAgent = String(req.headers["user-agent"] || "").trim();
  const actor = detectActorFromUserAgent(userAgent);

  // Keep pre-rendered root summaries for known bots/crawlers and social unfurl bots.
  // Human browsers should get an empty root to avoid visible text flash before React mounts.
  return actor.actorType === "bot";
}

function stripSeoRootSummaryForHumans(html: string): string {
  return html.replace(
    /<div id="root">\s*<main data-seo-[\s\S]*?<\/main>\s*<\/div>/i,
    '<div id="root"></div>'
  );
}

function getForwardedProto(req: Request): string {
  return String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function resolvePublicOrigin(req: Request): string {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  const hostOnly = host.split(":")[0].toLowerCase();
  const proto = getForwardedProto(req) || req.protocol || "https";
  const isLocal = hostOnly === "localhost" || hostOnly === "127.0.0.1";

  if (!host) return `https://${CANONICAL_WEB_HOST}`;
  if (
    hostOnly === "thetradescout.com" ||
    hostOnly === CANONICAL_WEB_HOST ||
    hostOnly.includes("tradescoutai.onrender.com")
  ) {
    return `https://${CANONICAL_WEB_HOST}`;
  }
  if (isLocal) return `${proto || "http"}://${host}`;
  return `${proto || "https"}://${host}`;
}

function getCachedTemplate(indexPath: string) {
  const cached = publicProfileTemplateCache.get(indexPath);
  if (cached) return cached;
  if (!fs.existsSync(indexPath)) return null;
  const html = fs.readFileSync(indexPath, "utf-8");
  publicProfileTemplateCache.set(indexPath, html);
  return html;
}

// Lightweight log helper (mirrors server/vite.ts without importing Vite in prod)
function log(message: string, source = "express") {
  logger.info(`[${source}] ${message}`);
}

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  console.error("Stack:", error.stack);
});

let isShuttingDown = false;
const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[lifecycle] Received ${signal}; shutting down gracefully`);
  try {
    await releaseSchedulerLeadership();
    await closeRedisClient();
    void pool.end();
  } catch (err) {
    console.error("Error closing database pool during shutdown:", err);
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

const requiredEnv = ["DATABASE_URL", "SESSION_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    if (process.env.NODE_ENV === "production") {
      console.error(`Missing required env: ${key}`);
      process.exit(1);
    } else {
      console.warn(
        `[DEV] Missing env ${key}. Startup invariants may prevent boot until this is set.`
      );
    }
  }
}

const app = express();
// REQUIRED for secure cookies behind hosting proxies
app.set("trust proxy", 1);
app.disable("x-powered-by");

let viteSetupPromise: Promise<void> | null = null;

app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

app.use((req, res, next) => {
  const originalSend = res.send.bind(res);

  res.send = ((body?: any) => {
    if (
      typeof body === "string" &&
      body.includes("data-seo-") &&
      !shouldRetainSeoSummaryForRequest(req)
    ) {
      return originalSend(stripSeoRootSummaryForHumans(body));
    }
    return originalSend(body);
  }) as typeof res.send;

  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "https://js.stripe.com",
          "https://maps.googleapis.com",
        ],
        "connect-src": [
          "'self'",
          "https://api.stripe.com",
          "https://maps.googleapis.com",
          "https://*.googleapis.com",
          "https://*.gstatic.com",
          "https://thetradescout.com",
          "https://www.thetradescout.com",
          "*.sentry.io",
        ],
        "frame-src": ["'self'", "https://js.stripe.com"],
        "img-src": [
          "'self'",
          "data:",
          "https://*.stripe.com",
          "https://maps.gstatic.com",
          "https://maps.googleapis.com",
          "https://platform-lookaside.fbsbx.com",
          "https://*.fbcdn.net",
          // Profile/business photos and the favicon override are always
          // referenced with absolute thetradescout.com URLs, including when
          // the page itself is served from a business's own custom domain.
          "https://thetradescout.com",
          "https://www.thetradescout.com",
        ],
      },
    },
  })
);
app.use(compression());

// Always serve on PORT (single entry for API + client); default 5000.
const PORT = parseInt(process.env.PORT || "5000", 10);

// Sentry setup (request and tracing handlers should come before other middleware)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Force canonical host: redirect non-canonical hosts to primary domain
app.use((req, res, next) => {
  const rawHost = (req.headers.host || "").toLowerCase();
  const host = rawHost.split(":")[0];
  const forwardedProto = getForwardedProto(req);

  // If someone hits the Render URL directly or apex domain, send to canonical www host.
  const hostNeedsCanonical =
    host.includes("tradescoutai.onrender.com") || host === "thetradescout.com";
  const protocolNeedsUpgrade = host === CANONICAL_WEB_HOST && forwardedProto === "http";
  if (hostNeedsCanonical || protocolNeedsUpgrade) {
    const redirectUrl = `https://${CANONICAL_WEB_HOST}${req.originalUrl || ""}`;
    return res.redirect(301, redirectUrl);
  }

  next();
});

// Custom domains: profile domains render the profile in place; business and
// affiliate domains redirect to the canonical host with ?ref=... attached.
const CUSTOM_DOMAIN_CACHE = new Map<
  string,
  | { kind: "affiliate"; ref: string; at: number }
  | { kind: "profile"; slug: string; at: number }
  | { kind: "business"; slug: string; at: number }
>();
const CUSTOM_DOMAIN_TTL_MS = 60 * 60 * 1000; // 1 hour

// A verified profile custom domain (e.g. jwstonelogistics.com) should show
// its own URL in the address bar, not redirect through /u/:slug -- so this
// renders the same server-side HTML that route serves, in place, on the
// custom host. Falls back to the old redirect if the build isn't available
// (e.g. local dev, where dist/public doesn't exist).
async function renderProfileOnCustomDomain(
  req: Request,
  res: Response,
  slug: string
): Promise<boolean> {
  const indexPath = path.join(process.cwd(), "dist/public", "index.html");
  const templateHtml = getCachedTemplate(indexPath);
  if (!templateHtml) return false;
  const origin = resolvePublicOrigin(req);
  const html = await buildPublicProfileHtml({ slug, origin, templateHtml });
  if (!html) return false;

  // This runs in a middleware registered ahead of the app's usual CORS,
  // telemetry, and crawler-intent-header middleware (it has to, so it can
  // render before those even apply) -- so requests served here would
  // otherwise never get the bot-visibility signals every other page gets.
  // Set them explicitly instead of relying on that later middleware.
  const start = Date.now();
  const contract = getLandingIntentContractForPath("/");
  res.setHeader("X-TradeScout-Intent-Stage", contract.intentStage);
  res.setHeader("X-TradeScout-Audience-Hint", contract.audienceHint);
  res.setHeader("X-TradeScout-Knowledge-Hint", contract.knowledgeHint);
  res.setHeader("X-TradeScout-Action-Hint", contract.actionHint);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  res.on("finish", () => {
    void recordCrawlerRequestEvent(req, res.statusCode, {
      responseTimeMs: Date.now() - start,
      responseBytes: Buffer.byteLength(html),
    });
  });
  res.send(html);
  return true;
}

// A verified profile custom domain needs its own robots.txt/sitemap.xml --
// falling through to the platform's generic ones would advertise TradeScout
// routes (/u/, /business/, /admin/, ...) that don't exist on this domain,
// and never mention the one URL that does. Returns true if the request was
// fully handled (caller should not call next()).
async function serveCustomDomainProfilePath(
  req: Request,
  res: Response,
  host: string,
  slug: string
): Promise<boolean> {
  const path = req.path || "/";
  if (path === "/" || path === "") {
    if (await renderProfileOnCustomDomain(req, res, slug)) return true;
    res.redirect(
      301,
      `/u/${encodeURIComponent(slug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
    );
    return true;
  }
  if (path === "/robots.txt") {
    res
      .type("text/plain")
      .send(`User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`);
    return true;
  }
  if (path === "/sitemap.xml") {
    const lastmod = new Date().toISOString().slice(0, 10);
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://${host}/</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>\n</urlset>\n`
      );
    return true;
  }
  return false;
}

app.use(async (req, res, next) => {
  try {
    const rawHost = (req.headers.host || "").toString().toLowerCase();
    const host = rawHost.split(":")[0];
    if (!host) return next();

    // Ignore canonical + known infra hosts
    if (
      host.endsWith("thetradescout.com") ||
      host.includes("onrender.com") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return next();
    }

    const now = Date.now();
    const cached = CUSTOM_DOMAIN_CACHE.get(host);
    if (cached && now - cached.at < CUSTOM_DOMAIN_TTL_MS) {
      if (cached.kind === "profile") {
        if (await serveCustomDomainProfilePath(req, res, host, cached.slug)) return;
        return next();
      }

      if (cached.kind === "business") {
        const path = req.path || "/";
        if (path === "/" || path === "") {
          return res.redirect(
            301,
            `/business/${encodeURIComponent(cached.slug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
          );
        }
        return next();
      }

      const targetHost = CANONICAL_WEB_HOST;
      const url = new URL(`https://${targetHost}${req.originalUrl || "/"}`);
      if (!url.searchParams.has("ref")) url.searchParams.set("ref", cached.ref);
      return res.redirect(301, url.toString());
    }

    // Profile custom domains are defined in profile seoMeta.customDomain.
    const [profileDomain] = await db
      .select({ slug: profiles.slug })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .where(
        and(
          eq(profiles.status, "published" as any),
          sql`COALESCE((${users.preferences} ->> 'profileVisibility'), 'private') = 'public'`,
          sql`lower(COALESCE((${profiles.seoMeta} ->> 'customDomain'), '')) = ${host}`
        )
      )
      .limit(1);

    const profileSlug = typeof profileDomain?.slug === "string" ? profileDomain.slug.trim() : "";
    if (profileSlug) {
      CUSTOM_DOMAIN_CACHE.set(host, { kind: "profile", slug: profileSlug, at: now });
      if (await serveCustomDomainProfilePath(req, res, host, profileSlug)) return;
      return next();
    }

    const [businessDomain] = await db
      .select({ slug: users.businessSlug })
      .from(users)
      .where(
        and(
          sql`${users.businessSlug} IS NOT NULL`,
          sql`lower(COALESCE(((${users.preferences} -> 'provisional' -> 'profileDraft' ->> 'customDomain')), '')) = ${host}`,
          sql`COALESCE(((${users.preferences} -> 'provisional' -> 'profileDraft' -> 'customDomainVerification' ->> 'state')), 'unverified') = 'verified'`
        )
      )
      .limit(1);

    const businessSlug = typeof businessDomain?.slug === "string" ? businessDomain.slug.trim() : "";
    if (businessSlug) {
      CUSTOM_DOMAIN_CACHE.set(host, { kind: "business", slug: businessSlug, at: now });
      const path = req.path || "/";
      if (path === "/" || path === "") {
        return res.redirect(
          301,
          `/business/${encodeURIComponent(businessSlug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
        );
      }
      return next();
    }

    const [account] = await db
      .select({ referralCode: affiliateAccounts.referralCode })
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.customDomain, host))
      .limit(1);

    const ref = typeof account?.referralCode === "string" ? account.referralCode.trim() : "";
    if (!ref) return next();

    CUSTOM_DOMAIN_CACHE.set(host, { kind: "affiliate", ref, at: now });

    const targetHost = CANONICAL_WEB_HOST;
    const url = new URL(`https://${targetHost}${req.originalUrl || "/"}`);
    if (!url.searchParams.has("ref")) url.searchParams.set("ref", ref);
    return res.redirect(301, url.toString());
  } catch {
    return next();
  }
});

// Core allowed origins for production surfaces
const ALLOWED_ORIGINS: string[] = [
  "https://www.thetradescout.com",
  "https://thetradescout.com",
  "https://tradescoutai.onrender.com",
  // Verified profile custom domains -- served in place (see the custom-domain
  // routing middleware above), so their own static assets/API calls need to
  // be CORS-allowed from their own origin too.
  "https://jwstonelogistics.com",
  "https://www.jwstonelogistics.com",
].map((o) => o.toLowerCase());

// Optionally extend/override CORS allowlist from env
const rawAllowlist = process.env.CORS_ALLOWED_ORIGINS || "";
const isProductionEnv =
  process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
const allowAllCorsRequested = rawAllowlist === "*";
const allowAllCors = allowAllCorsRequested && !isProductionEnv;

if (allowAllCorsRequested && isProductionEnv) {
  console.error(
    "[HTTP] Refusing CORS_ALLOWED_ORIGINS='*' in production; falling back to explicit allowlist only."
  );
}

if (rawAllowlist && rawAllowlist !== "*") {
  for (const origin of rawAllowlist.split(",")) {
    const normalized = origin.trim().toLowerCase();
    if (!normalized) continue;
    if (!ALLOWED_ORIGINS.includes(normalized)) {
      ALLOWED_ORIGINS.push(normalized);
    }
  }
}

// Always allow localhost dev ports (client + API) in dev
if (!isProductionEnv) {
  const devOrigins = ["http://localhost:3000", "http://localhost:5173", `http://localhost:${PORT}`];
  for (const devOrigin of devOrigins) {
    if (!ALLOWED_ORIGINS.includes(devOrigin)) {
      ALLOWED_ORIGINS.push(devOrigin);
    }
  }
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // No origin (curl/server-side) → allow
    if (!origin) return callback(null, true);
    const normalized = origin.toLowerCase();

    // Temp escape hatch: allow all origins when explicitly configured
    if (allowAllCors) {
      return callback(null, true);
    }

    if (!isProductionEnv) {
      // Always allow localhost loopback origins on any port in dev.
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
        return callback(null, true);
      }

      // Always allow same-host access on the API port in dev.
      const sameHostOrigins = [
        `http://localhost:${PORT}`.toLowerCase(),
        `https://localhost:${PORT}`.toLowerCase(),
      ];
      if (sameHostOrigins.includes(normalized)) {
        return callback(null, true);
      }
    }

    if (ALLOWED_ORIGINS.includes(normalized)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
  exposedHeaders: ["Content-Length", "ETag"],
};

// Always vary by Origin
app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});

// Apply CORS before routes
app.use(cors(corsOptions));
// Preflight handler
app.options("*", cors(corsOptions));

// Core body parsing – MUST come before any API routes
const bodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Serve uploads with resilient fallback (disk + R2 + extension compatibility).
registerUploadsFallback(app);

const apiSlowLogMs = Number(process.env.API_SLOW_LOG_MS || 750);
const logAllApiRequests =
  process.env.API_LOG_ALL === "true" || process.env.NODE_ENV !== "production";

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;

    // Emit HTTP status metrics (Phase 1: Observability)
    emitHttpStatus(res.statusCode, { userAgent: req.get("User-Agent"), path: req.path });
    const contentLengthHeader = res.getHeader("content-length");
    const responseBytes =
      typeof contentLengthHeader === "number"
        ? contentLengthHeader
        : typeof contentLengthHeader === "string"
          ? Number(contentLengthHeader)
          : null;
    void recordCrawlerRequestEvent(req, res.statusCode, {
      responseTimeMs: duration,
      responseBytes,
    });

    if (requestPath.startsWith("/api")) {
      const isError = res.statusCode >= 400;
      const isSlow = Number.isFinite(apiSlowLogMs) ? duration >= apiSlowLogMs : duration >= 750;
      if (logAllApiRequests || isError || isSlow) {
        log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
      }
    }
  });

  next();
});

// Bot actors are read-only by policy. Default mode is report-only for safe rollout.
app.use(botReadOnlyGuard);
app.use(landingContractHeaders);

(async () => {
  try {
    try {
      await assertStartupInvariants();
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
      console.warn(
        "[DEV] startup invariants failed; continuing with reduced capability:",
        (err as Error)?.message
      );
    }

    try {
      await ensureProfilesTable();
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: ensureProfilesTable failed in production:", err);
        throw err;
      } else {
        console.warn(
          "[DEV] ensureProfilesTable failed; continuing without profiles table:",
          (err as Error)?.message
        );
      }
    }

    // Keep SEO discovery routes resilient even if migrations were skipped.
    await ensureBusinessPublicDiscoveryEnabledColumn();

    // Runtime SQL migrations are opt-in during boot.
    // Deploy-time migrations are the canonical path; boot-time is explicit fallback only.
    const runtimeMigrationMode = String(process.env.RUNTIME_MIGRATIONS_MODE || "")
      .trim()
      .toLowerCase();
    const shouldRunBootMigrations = runtimeMigrationMode === "boot";

    if (shouldRunBootMigrations) {
      try {
        await runRuntimeMigrations({
          log: (msg) => log(msg, "RuntimeMigrations"),
        });
      } catch (err) {
        console.error("[RuntimeMigrations] Failed (non-fatal):", err);
      }
    } else {
      log("[RuntimeMigrations] Skipping boot runtime migrations (opt-in disabled).");
    }

    try {
      await ensureDocumentsTables();
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: ensureDocumentsTables failed in production:", err);
        throw err;
      } else {
        console.warn(
          "[DEV] ensureDocumentsTables failed; continuing without documents table:",
          (err as Error)?.message
        );
      }
    }

    const ensureMasterAdmin = async () => {
      const email = process.env.MASTER_ADMIN_EMAIL;
      const password = process.env.MASTER_ADMIN_PASSWORD;
      if (!email || !password) {
        console.warn(
          "[Bootstrap] MASTER_ADMIN_EMAIL/PASSWORD not set; skipping master admin bootstrap"
        );
        return;
      }

      const existingSuperAdmin = await storage.getUserByRole("super_admin");
      if (existingSuperAdmin) {
        return;
      }

      const firstName = process.env.MASTER_ADMIN_FIRST_NAME || "Super";
      const lastName = process.env.MASTER_ADMIN_LAST_NAME || "Admin";

      try {
        await storage.createMasterAdmin(email, password, firstName, lastName);
        console.log(`[Bootstrap] Created super_admin account for ${email}`);
      } catch (err) {
        if (process.env.NODE_ENV === "production") {
          console.error("FATAL: Failed to create master admin in production:", err);
          throw err;
        }
        console.warn(
          "[DEV] Failed to create master admin; continuing without bootstrap super_admin:",
          (err as Error)?.message
        );
      }
    };

    await ensureMasterAdmin();
    await provisionJrsAutoGlassProfile();
    // Best-effort, read-only schema drift check: logs but never blocks startup.
    try {
      await runSchemaPreflight();
    } catch (err) {
      console.error("[SchemaPreflight] Failed during startup (non-fatal):", err);
    }
    // NOTE: Ensure 'routes' is imported or defined before this point if 'registerRoutes' uses it directly.
    // If 'routes' is not implicitly available, it needs to be imported.
    // For this example, assuming 'routes' is handled within 'registerRoutes' or imported elsewhere.
    const server = await registerRoutes(app);

    // Attach job documents + invoicing/contract APIs after auth/session are configured
    app.use(createInvoicingDocumentsRouter(pool));

    // Initialize WebSocket messaging service
    initializeMessagingService(server);
    console.log("[Messaging] Socket.io service initialized");

    const schedulerEnabled = process.env.SCHEDULER_ENABLED === "true";
    const schedulerLeaderOnly = process.env.SCHEDULER_LEADER_ONLY === "true";
    let backgroundJobsEnabled = false;

    if (schedulerEnabled) {
      if (schedulerLeaderOnly) {
        const hasLeadership = await acquireSchedulerLeadership();
        if (hasLeadership) {
          console.log("[Scheduler] Leader lock acquired, background jobs enabled");
          startCrawlerScheduler();
          backgroundJobsEnabled = true;
        } else {
          console.log(
            "[Scheduler] Leader lock not acquired, background jobs disabled on this instance"
          );
        }
      } else {
        console.log("[Scheduler] Enabling background jobs...");
        startCrawlerScheduler();
        backgroundJobsEnabled = true;
      }
    } else {
      console.log("[Scheduler] Background jobs disabled (SCHEDULER_ENABLED != true)");
    }

    if (backgroundJobsEnabled) {
      // Run birthday notifications only on the elected scheduler instance.
      setInterval(async () => {
        const now = new Date();
        if (now.getHours() === 9 && now.getMinutes() === 0) {
          try {
            await notificationService.processBirthdayNotifications();
            console.log("Daily birthday notifications processed");
          } catch (error) {
            console.error("Error processing birthday notifications:", error);
          }
        }
      }, 60000); // Check every minute
    }

    if (process.env.SENTRY_DSN) {
      app.use(Sentry.Handlers.errorHandler());
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err?.message || "Internal Server Error";
      const errorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      // Log full error server-side (do not leak internals to clients)
      try {
        const reqAny = _req as any;
        console.error("[API ERROR]", {
          errorId,
          status,
          message,
          method: reqAny?.method,
          path: reqAny?.originalUrl || reqAny?.url,
          origin: reqAny?.headers?.origin,
          host: reqAny?.headers?.host,
          xForwardedProto: reqAny?.headers?.["x-forwarded-proto"],
          stack: err?.stack,
        });
      } catch {
        // ignore logging failures
      }

      // If Express has already started sending, delegate
      if (res.headersSent) {
        return;
      }

      // Always return a safe payload
      res.status(status).json({
        message: status >= 500 ? "Internal Server Error" : message,
        errorId,
      });
    });

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.

    // Track the last port we attempted so we can increment it if needed.
    let currentPort = PORT;
    let hasLoggedFallbackNotice = false;

    const warnOnAuthOriginMismatch = (activePort: number) => {
      const envKeys = [
        "GOOGLE_CALLBACK_URL",
        "FACEBOOK_CALLBACK_URL",
        "CLIENT_ORIGIN",
        "PUBLIC_BASE_URL",
      ] as const;

      const localhostHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
      const mismatches: Array<{ key: string; value: string; reason: string }> = [];

      for (const key of envKeys) {
        const raw = process.env[key];
        if (!raw || !raw.trim()) continue;
        try {
          const parsed = new URL(raw);
          const parsedPort =
            parsed.port && parsed.port.trim().length > 0
              ? Number(parsed.port)
              : parsed.protocol === "https:"
                ? 443
                : 80;

          if (localhostHosts.has(parsed.hostname.toLowerCase()) && parsedPort !== activePort) {
            mismatches.push({
              key,
              value: raw,
              reason: `uses ${parsed.hostname}:${parsedPort}, server bound to localhost:${activePort}`,
            });
          }
        } catch {
          mismatches.push({
            key,
            value: raw,
            reason: "not a valid absolute URL",
          });
        }
      }

      if (mismatches.length > 0) {
        console.warn("[AUTH ORIGIN WARNING] Callback/origin env mismatch detected.");
        for (const item of mismatches) {
          console.warn(`[AUTH ORIGIN WARNING] ${item.key}=${item.value} (${item.reason})`);
        }
        console.warn(
          `[AUTH ORIGIN WARNING] Fix these env keys to match the active origin http://localhost:${activePort} and restart dev server.`
        );
      }
    };

    const startHttpServer = (portToUse: number) => {
      currentPort = portToUse;
      server.listen(
        {
          port: portToUse,
          host: "0.0.0.0",
        },
        () => {
          if (portToUse !== PORT && !hasLoggedFallbackNotice) {
            console.warn(
              `[DEV] Primary port ${PORT} was unavailable. TradeScout is running on fallback port ${portToUse}.`
            );
            hasLoggedFallbackNotice = true;
          }
          log(`serving on port ${portToUse}`);
          warnOnAuthOriginMismatch(portToUse);

          // Setup vite AFTER the server is listening so the port is available
          const isProduction =
            process.env.NODE_ENV === "production" || app.get("env") === "production";
          console.log(
            `Environment check: NODE_ENV=${process.env.NODE_ENV}, app.env=${app.get(
              "env"
            )}, isProduction=${isProduction}`
          );

          if (!isProduction) {
            (async () => {
              try {
                // Set HMR environment variables to fix WebSocket connection issues
                if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
                  process.env.VITE_HMR_HOST = `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev`;
                  process.env.VITE_HMR_PORT = "443";
                  process.env.VITE_HMR_PROTOCOL = "wss";
                }
                const skipVite = process.env.SKIP_VITE === "true";
                console.log(`[DEV] Vite mode: ${skipVite ? "skipped" : "enabled"}`);
                // Vite enabled by default in dev; set SKIP_VITE=true to disable.
                if (skipVite) {
                  console.log("[DEV] Vite skipped - API server will run without client");
                } else {
                  console.log("[DEV] Setting up Vite...");
                  if (!viteSetupPromise) {
                    viteSetupPromise = (async () => {
                      const { setupVite } = await import("./vite");
                      await setupVite(app, server);
                    })();
                  } else {
                    console.warn("[DEV] Vite setup already started; skipping duplicate setup.");
                  }
                  await viteSetupPromise;
                  console.log("[DEV] Vite setup complete - ready to accept connections");
                }
              } catch (viteError) {
                console.error("[DEV] Failed to setup Vite:", viteError);
                console.error("[DEV] Stack:", (viteError as Error).stack);
                // Don't exit - let the server continue running without Vite
                console.log("[DEV] Server will continue running without Vite dev server");
              }
            })();
          } else {
            // Serve static files from dist/public (Vite build output) if available
            const workspaceRoot = process.cwd();
            const publicDistPath = path.join(workspaceRoot, "dist/public");

            // Only serve frontend if dist/public exists (allows API-only deployment)
            if (fs.existsSync(publicDistPath)) {
              console.log("Production mode - serving static files from:", publicDistPath);

              // Emergency client reset endpoint:
              // Clears browser caches / SW / storage so users can recover from a stale bundle after deploys.
              // This is intentionally a simple HTML response with a standards-based clear instruction.
              app.all("/reset", (_req, res) => {
                const fresh = Date.now();
                res.setHeader("Cache-Control", "no-store");
                res.setHeader("Clear-Site-Data", '"cache", "storage", "executionContexts"');
                res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="2;url=/?__fresh=${fresh}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Resetting TradeScout…</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;padding:24px;max-width:720px;margin:0 auto;line-height:1.5}
      code{background:#1118270d;padding:2px 6px;border-radius:6px}
    </style>
  </head>
  <body>
    <h1>Resetting TradeScout…</h1>
    <p>Your browser cache and service worker are being cleared.</p>
    <p>If you are not redirected automatically, open <a href="/?__fresh=${fresh}">the homepage</a>.</p>
  </body>
</html>`);
              });

              // Emergency appearance reset endpoint:
              // Resets saved color scheme + theme preference back to default.
              app.all("/reset-theme", (_req, res) => {
                const fresh = Date.now();
                res.setHeader("Cache-Control", "no-store");
                res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Resetting Theme…</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;padding:24px;max-width:720px;margin:0 auto;line-height:1.5}
      code{background:#1118270d;padding:2px 6px;border-radius:6px}
      .muted{opacity:.75}
    </style>
  </head>
  <body>
    <h1>Resetting theme…</h1>
    <p class="muted">Resetting your saved color scheme + theme preference back to default.</p>
    <pre id="log" class="muted">Working…</pre>
    <script>
      (async () => {
        const logEl = document.getElementById('log');
        const log = (msg) => { try { logEl.textContent += '\\n' + msg; } catch {} };
        try {
          const headers = { 'Content-Type': 'application/json' };
          const r1 = await fetch('/api/users/color-scheme', { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify({ preset: 'default' }) });
          log('color-scheme: ' + r1.status);
        } catch {
          log('color-scheme: failed');
        }
        try {
          const headers = { 'Content-Type': 'application/json' };
          const r2 = await fetch('/api/user/theme', { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify({ themePreference: 'default', customThemeColors: null }) });
          log('theme: ' + r2.status);
        } catch {
          log('theme: failed');
        }
        window.location.replace('/reset?__fresh=${fresh}');
      })();
    </script>
    <noscript>
      <p>JavaScript is required. Alternative: open <code>/profile-settings</code> and set Color Scheme preset to <code>default</code>.</p>
    </noscript>
  </body>
</html>`);
              });

              // 1) Serve hashed asset chunks with long cache first
              const assetsPath = path.join(publicDistPath, "assets");
              if (fs.existsSync(assetsPath)) {
                app.use(
                  "/assets",
                  express.static(assetsPath, {
                    immutable: true,
                    maxAge: "1y",
                    setHeaders: (res, filePath) => {
                      const lower = filePath.toLowerCase();
                      // Prevent stale camera/admin chunks from sticking on mobile clients.
                      // Hashed assets are usually safe to cache long-term, but these routes
                      // are actively iterated and must pick up fresh logic immediately.
                      if (
                        lower.includes("zero-base-fee-camera-") ||
                        lower.includes("admin-observability-")
                      ) {
                        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
                        res.setHeader("CDN-Cache-Control", "public, max-age=0, must-revalidate");
                        res.setHeader("Surrogate-Control", "public, max-age=0, must-revalidate");
                      }
                    },
                  })
                );
              }

              // 1.5) Force revalidation for app identity assets (favicons, manifest, logos)
              const identityAssets = new Set([
                "/favicon.ico",
                "/favicon.svg",
                "/favicon-16x16.png",
                "/favicon-32x32.png",
                "/favicon-48x48.png",
                "/apple-touch-icon.png",
                "/apple-touch-icon-precomposed.png",
                "/manifest.json",
                "/site.webmanifest",
                "/icon-192.png",
                "/icon-512.png",
                "/icon-192-maskable.png",
                "/icon-512-maskable.png",
                "/logo.png",
                "/tradescout-logo.png",
                "/tradescout-logo.jpg",
                "/sw.js",
                "/service-worker.js",
              ]);

              // Legacy social preview image path compatibility.
              app.get("/tradescout-logo.jpg", (_req, res) => {
                res.redirect(301, "/tradescout-social-preview.png?v=11");
              });

              app.get(Array.from(identityAssets), (req, res, next) => {
                const filePath = path.join(publicDistPath, req.path);
                if (!fs.existsSync(filePath)) return next();
                if (req.path === "/sw.js" || req.path === "/service-worker.js") {
                  res.setHeader("Cache-Control", "no-store");
                } else {
                  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
                }
                res.sendFile(filePath);
              });

              // Public entry HTML must run before express.static. The built app also contains
              // /landing assets, and static directory handling can otherwise serve the SPA shell
              // before the server-rendered CTA fallback is injected.
              app.get(
                ["/", "/landing", "/landing/", "/landing/:variant", "/lp", "/lp/", "/lp/:variant"],
                async (req, res) => {
                  try {
                    const indexPath = path.join(publicDistPath, "index.html");
                    const templateHtml = getCachedTemplate(indexPath);
                    if (!templateHtml) return res.status(404).send("Application files not found");

                    const origin = resolvePublicOrigin(req);
                    const variant =
                      typeof req.params.variant === "string" ? req.params.variant : null;
                    const html = await buildPublicLandingHtml({
                      origin,
                      templateHtml,
                      requestPath: req.originalUrl || req.path,
                      variant,
                    });

                    res.setHeader(
                      "Cache-Control",
                      "public, max-age=300, stale-while-revalidate=86400"
                    );
                    res.send(html);
                  } catch (err) {
                    console.error("Error rendering landing HTML:", err);
                    res.status(500).send("Failed to render landing page");
                  }
                }
              );

              // 2) Serve other static files (index.html, icons, etc.)
              app.use(
                express.static(publicDistPath, {
                  index: false,
                  setHeaders: (res, filePath) => {
                    if (filePath.endsWith(".html")) {
                      res.setHeader("Cache-Control", "no-store");
                    }
                  },
                })
              );

              // Public profile pages: server-rendered HTML for crawlability
              app.get(["/u/:slug", "/p/:slug"], async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const origin = resolvePublicOrigin(req);

                  const slug = String(req.params.slug || "");

                  // A profile with a verified custom domain is canonically
                  // served there -- send visitors straight to the business's
                  // own domain instead of dual-hosting the same profile under
                  // /u/:slug too.
                  const profileRecord = await storage.getProfileBySlugPublic(slug);
                  const customDomain = profileRecord?.seoMeta?.customDomain?.trim().toLowerCase();
                  if (customDomain) {
                    return res.redirect(301, `https://${customDomain}/`);
                  }

                  // Keep /p/:slug as legacy path but canonicalize to /u/:slug.
                  if (req.path.startsWith("/p/")) {
                    return res.redirect(301, `${origin}/u/${encodeURIComponent(slug)}`);
                  }

                  const html = await buildPublicProfileHtml({ slug, origin, templateHtml });

                  if (!html) {
                    return res.status(404).send("Profile not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering public profile HTML:", err);
                  res.status(500).send("Failed to render profile");
                }
              });

              // Public business pages: server-rendered HTML for crawlability
              app.get("/business/:slug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const origin = resolvePublicOrigin(req);
                  const slug = String(req.params.slug || "");

                  // SEO: if this business has its own published, richer profile site
                  // (/u/:slug), consolidate authority there instead of serving a
                  // competing, self-canonicalized duplicate at /business/:slug.
                  try {
                    const [linkedProfile] = await db
                      .select({ slug: profiles.slug })
                      .from(profiles)
                      .innerJoin(businesses, eq(businesses.id, profiles.businessId))
                      .where(
                        and(eq(businesses.slug, slug), eq(profiles.status, "published" as any))
                      )
                      .limit(1);
                    if (linkedProfile?.slug) {
                      return res.redirect(
                        301,
                        `${origin}/u/${encodeURIComponent(linkedProfile.slug)}`
                      );
                    }
                  } catch (redirectCheckErr) {
                    console.error(
                      "Error checking for linked profile on /business/:slug",
                      redirectCheckErr
                    );
                  }

                  const html = await buildPublicBusinessHtml({ slug, origin, templateHtml });
                  if (!html) {
                    return res.status(404).send("Business not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering public business HTML:", err);
                  res.status(500).send("Failed to render business");
                }
              });

              // Public trade directory pages: server-rendered HTML for crawlability
              app.get("/trade", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const html = await buildPublicTradeDirectoryHtml({ origin, templateHtml });
                  if (!html) return res.status(404).send("Trade page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade directory HTML:", err);
                  res.status(500).send("Failed to render trade page");
                }
              });

              // Best pages: verified-only within the "new & true" recency window (transparent definition)
              app.get("/best/:tradeSlug/:stateCode/city/:citySlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");
                  const citySlug = String(req.params.citySlug || "");

                  const html = await buildPublicBestTradeCityHtml({
                    tradeSlug,
                    stateCode,
                    citySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Best page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering best trade city HTML:", err);
                  res.status(500).send("Failed to render best page");
                }
              });

              app.get("/best/:tradeSlug/:stateCode/:countySlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");
                  const countySlug = String(req.params.countySlug || "");

                  const html = await buildPublicBestTradeCountyHtml({
                    tradeSlug,
                    stateCode,
                    countySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Best page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering best trade county HTML:", err);
                  res.status(500).send("Failed to render best page");
                }
              });

              app.get("/trade/:tradeSlug/:stateCode/city/:citySlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");
                  const citySlug = String(req.params.citySlug || "");

                  const html = await buildPublicTradeCityHtml({
                    tradeSlug,
                    stateCode,
                    citySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Trade page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade city HTML:", err);
                  res.status(500).send("Failed to render trade page");
                }
              });

              // Recent activity pages (safe public summaries)
              app.get("/trade/:tradeSlug/:stateCode/city/:citySlug/recent", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");
                  const citySlug = String(req.params.citySlug || "");

                  const html = await buildPublicTradeCityRecentHtml({
                    tradeSlug,
                    stateCode,
                    citySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Recent page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade city recent HTML:", err);
                  res.status(500).send("Failed to render recent page");
                }
              });

              app.get("/trade/:tradeSlug/:stateCode/:countySlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");
                  const countySlug = String(req.params.countySlug || "");

                  const html = await buildPublicTradeCountyHtml({
                    tradeSlug,
                    stateCode,
                    countySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Trade page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade county HTML:", err);
                  res.status(500).send("Failed to render trade page");
                }
              });

              app.get("/trade/:tradeSlug/:stateCode/:countySlug/recent", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");
                  const countySlug = String(req.params.countySlug || "");

                  const html = await buildPublicTradeCountyRecentHtml({
                    tradeSlug,
                    stateCode,
                    countySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Recent page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade county recent HTML:", err);
                  res.status(500).send("Failed to render recent page");
                }
              });

              app.get("/trade/:tradeSlug/:stateCode", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");
                  const stateCode = String(req.params.stateCode || "");

                  const html = await buildPublicTradeStateHtml({
                    tradeSlug,
                    stateCode,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Trade page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade state HTML:", err);
                  res.status(500).send("Failed to render trade page");
                }
              });

              app.get("/trade/:tradeSlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const tradeSlug = String(req.params.tradeSlug || "");

                  const html = await buildPublicTradeOverviewHtml({
                    tradeSlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Trade page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering trade overview HTML:", err);
                  res.status(500).send("Failed to render trade page");
                }
              });

              app.get("/city/:stateCode/:citySlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const stateCode = String(req.params.stateCode || "");
                  const citySlug = String(req.params.citySlug || "");

                  const html = await buildPublicCityHtml({
                    stateCode,
                    citySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("City page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering city HTML:", err);
                  res.status(500).send("Failed to render city");
                }
              });

              app.get("/city/:stateCode/:citySlug/recent", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const stateCode = String(req.params.stateCode || "");
                  const citySlug = String(req.params.citySlug || "");

                  const html = await buildPublicCityRecentHtml({
                    stateCode,
                    citySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Recent page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering city recent HTML:", err);
                  res.status(500).send("Failed to render recent page");
                }
              });

              app.get("/county/:stateCode/:countySlug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const stateCode = String(req.params.stateCode || "");
                  const countySlug = String(req.params.countySlug || "");

                  const html = await buildPublicCountyHtml({
                    stateCode,
                    countySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("County page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering county HTML:", err);
                  res.status(500).send("Failed to render county");
                }
              });

              app.get("/county/:stateCode/:countySlug/recent", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const stateCode = String(req.params.stateCode || "");
                  const countySlug = String(req.params.countySlug || "");

                  const html = await buildPublicCountyRecentHtml({
                    stateCode,
                    countySlug,
                    origin,
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Recent page not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering county recent HTML:", err);
                  res.status(500).send("Failed to render recent page");
                }
              });

              app.get("/datasets", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");
                  const origin = resolvePublicOrigin(req);
                  const html = await buildPublicDatasetsLandingHtml({ origin, templateHtml });
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering datasets landing HTML:", err);
                  res.status(500).send("Failed to render datasets");
                }
              });

              app.get("/datasets/trades", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");
                  const origin = resolvePublicOrigin(req);
                  const html = await buildPublicDatasetsTradesHtml({ origin, templateHtml });
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering datasets trades HTML:", err);
                  res.status(500).send("Failed to render datasets");
                }
              });

              app.get("/datasets/counties", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");
                  const origin = resolvePublicOrigin(req);
                  const html = await buildPublicDatasetsCountiesHtml({ origin, templateHtml });
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering datasets counties HTML:", err);
                  res.status(500).send("Failed to render datasets");
                }
              });

              app.get("/datasets/cities", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");
                  const origin = resolvePublicOrigin(req);
                  const html = await buildPublicDatasetsCitiesHtml({ origin, templateHtml });
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering datasets cities HTML:", err);
                  res.status(500).send("Failed to render datasets");
                }
              });

              // Shared Direct Connect request pages: server-rendered metadata for social preview
              app.get("/r/:shareToken", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const origin = resolvePublicOrigin(req);
                  const shareToken = String(req.params.shareToken || "");

                  const html = await buildWorkRequestShareHtml({
                    shareToken,
                    origin,
                    templateHtml,
                  });

                  if (!html) {
                    return res.status(404).send("Shared request not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=180, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering shared work request HTML:", err);
                  res.status(500).send("Failed to render shared request");
                }
              });

              // Exchange listing detail pages: server-rendered HTML with full JSON-LD for SEO
              // MUST be registered BEFORE /exchange/:category to avoid param conflicts
              app.get("/exchange/:category/:listingId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");

                  const origin = resolvePublicOrigin(req);
                  const categoryParam = String(req.params.category || "");
                  const listingId = String(req.params.listingId || "");

                  const html = await buildPublicExchangeListingHtml({
                    origin,
                    templateHtml,
                    categoryParam,
                    listingId,
                  });

                  if (!html) {
                    // Listing not found — fall through to SPA (React will show 404)
                    res.setHeader("Cache-Control", "no-store");
                    return res.sendFile(indexPath);
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering exchange listing HTML:", err);
                  // Fall through to SPA on error
                  const indexPath = path.join(publicDistPath, "index.html");
                  if (fs.existsSync(indexPath)) {
                    res.setHeader("Cache-Control", "no-store");
                    res.sendFile(indexPath);
                  } else {
                    res.status(500).send("Failed to render exchange listing page");
                  }
                }
              });

              // Exchange pages: inject correct OG tags per category/item/promo
              app.get(["/exchange", "/exchange/:category"], async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) return res.status(404).send("Application files not found");
                  const origin = resolvePublicOrigin(req);
                  const categorySlug =
                    typeof req.params.category === "string" ? req.params.category : null;
                  const html = await buildPublicExchangeHtml({
                    origin,
                    templateHtml,
                    requestUrl: req.originalUrl || req.path,
                    categorySlug,
                  });
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering exchange HTML:", err);
                  // Fall through to SPA on error
                  const indexPath = path.join(publicDistPath, "index.html");
                  if (fs.existsSync(indexPath)) {
                    res.setHeader("Cache-Control", "no-store");
                    res.sendFile(indexPath);
                  } else {
                    res.status(500).send("Failed to render exchange page");
                  }
                }
              });

              // 3) Catch-all handler for client-side routing, but NEVER for /api or /assets
              app.get("*", (req, res) => {
                const reqPath = req.path || "";

                if (reqPath.startsWith("/api")) {
                  return res.status(404).json({ message: "Not found" });
                }

                // If an asset was requested but not found by express.static, do NOT
                // return index.html – this would surface as a MIME-type error in the browser.
                if (reqPath.startsWith("/assets")) {
                  // Avoid caching missing hashed chunks. Some CDNs/proxies will cache 404s,
                  // which can make a partial deploy look "permanently broken".
                  res.setHeader("Cache-Control", "no-store");
                  res.setHeader("CDN-Cache-Control", "no-store");
                  res.setHeader("Surrogate-Control", "no-store");
                  return res.status(404).end();
                }

                // If it looks like a file request (e.g. /favicon.ico), never fall back to index.html.
                const base = path.posix.basename(reqPath);
                if (base.includes(".")) {
                  res.setHeader("Cache-Control", "no-store");
                  res.setHeader("CDN-Cache-Control", "no-store");
                  res.setHeader("Surrogate-Control", "no-store");
                  return res.status(404).end();
                }

                const indexPath = path.join(publicDistPath, "index.html");

                // Check if file exists before trying to serve
                if (fs.existsSync(indexPath)) {
                  res.setHeader("Cache-Control", "no-store");
                  res.sendFile(indexPath, (err) => {
                    if (err) {
                      console.error("Error serving index.html:", err);
                      res.status(500).send("Error loading application");
                    }
                  });
                } else {
                  console.error("index.html not found at:", indexPath);
                  res.status(404).send("Application files not found");
                }
              });
            } else {
              console.log("Production mode - API only (no dist/public found)");
              // API-only mode: no frontend serving, just API routes
            }
          }
        }
      );
    };

    // Handle port-in-use errors by falling back to the next port instead of crashing
    server.on("error", (err: any) => {
      if (err && (err as any).code === "EADDRINUSE") {
        const fallbackPort = currentPort + 1;
        console.warn(
          `Port ${currentPort} is in use; retrying on ${fallbackPort}. Update your browser URL accordingly.`
        );
        startHttpServer(fallbackPort);
      } else {
        console.error("Server failed to start:", err);
        process.exit(1);
      }
    });

    startHttpServer(PORT);
  } catch (error) {
    console.error("FATAL ERROR during server initialization:", error);
    console.error("Stack:", (error as Error).stack);
    process.exit(1);
  }
})();
