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
import { initializeMessagingService } from "./messaging-service";
import { storage } from "./storage";
import { ensureProfilesTable } from "./ensureDb";
import { runSchemaPreflight } from "./schemaPreflight";
import { runRuntimeMigrations } from "./runtimeMigrations";
import { assertStartupInvariants } from "./startupInvariants";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { buildPublicProfileHtml } from "./publicProfileHtml";
import { buildPublicBusinessHtml } from "./publicBusinessHtml";
import { buildWorkRequestShareHtml } from "./workRequestShareHtml";
import { affiliateAccounts, profiles, users } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicProfileTemplateCache = new Map<string, string>();
const CANONICAL_WEB_HOST = "www.thetradescout.com";

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

// Override process.exit to trap explicit exits
const originalExit = process.exit;
process.exit = (code?: number) => {
  console.log(`[Diagnostic] process.exit(${code}) was called explicitly.`);
  console.trace("Call stack for process.exit:");
  return originalExit(code);
};

function log(message: string, source = "express") {
  logger.info(`[${source}] ${message}`);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  console.error("Stack:", error.stack);
});

process.on("exit", (code) => {
  console.log(`Process exiting with code: ${code}`);
  console.trace("Exit stack trace:");
});

process.on("beforeExit", (code) => {
  console.log(`Before exit with code: ${code}`);
});

const shutdown = (signal: string) => {
  console.log(`Received ${signal} - shutting down gracefully`);
  try {
    void pool.end();
  } catch (err) {
    console.error("Error closing database pool during shutdown:", err);
  }
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const requiredEnv = ["DATABASE_URL", "SESSION_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
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
        ],
      },
    },
  })
);
app.use(compression());

const PORT = parseInt(process.env.PORT || "5000", 10);

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use((req, res, next) => {
  const rawHost = (req.headers.host || "").toLowerCase();
  const host = rawHost.split(":")[0];
  const forwardedProto = getForwardedProto(req);
  const hostNeedsCanonical =
    host.includes("tradescoutai.onrender.com") || host === "thetradescout.com";
  const protocolNeedsUpgrade = host === CANONICAL_WEB_HOST && forwardedProto === "http";
  if (hostNeedsCanonical || protocolNeedsUpgrade) {
    const redirectUrl = `https://${CANONICAL_WEB_HOST}${req.originalUrl || ""}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

// Custom domains: redirect to canonical host with ?ref=... attached.
const CUSTOM_DOMAIN_CACHE = new Map<
  string,
  | { kind: "affiliate"; ref: string; at: number }
  | { kind: "profile"; slug: string; at: number }
  | { kind: "business"; slug: string; at: number }
>();
const CUSTOM_DOMAIN_TTL_MS = 60 * 60 * 1000; // 1 hour

app.use(async (req, res, next) => {
  try {
    const rawHost = (req.headers.host || "").toString().toLowerCase();
    const host = rawHost.split(":")[0];
    if (!host) return next();

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
        const path = req.path || "/";
        if (path === "/" || path === "") {
          return res.redirect(
            301,
            `/u/${encodeURIComponent(cached.slug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
          );
        }
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
      const path = req.path || "/";
      if (path === "/" || path === "") {
        return res.redirect(
          301,
          `/u/${encodeURIComponent(profileSlug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
        );
      }
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

const ALLOWED_ORIGINS: string[] = [
  "https://www.thetradescout.com",
  "https://thetradescout.com",
  "https://tradescoutai.onrender.com",
].map((o) => o.toLowerCase());

const rawAllowlist = process.env.CORS_ALLOWED_ORIGINS || "";
const allowAllCors = rawAllowlist === "*";

if (rawAllowlist && rawAllowlist !== "*") {
  for (const origin of rawAllowlist.split(",")) {
    const normalized = origin.trim().toLowerCase();
    if (!normalized) continue;
    if (!ALLOWED_ORIGINS.includes(normalized)) {
      ALLOWED_ORIGINS.push(normalized);
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  const devOrigins = ["http://localhost:3000", "http://localhost:5173", `http://localhost:${PORT}`];
  for (const devOrigin of devOrigins) {
    if (!ALLOWED_ORIGINS.includes(devOrigin)) {
      ALLOWED_ORIGINS.push(devOrigin);
    }
  }
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.toLowerCase();

    if (allowAllCors) {
      return callback(null, true);
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/.test(normalized)) {
      return callback(null, true);
    }

    const sameHostOrigins = [
      `http://localhost:${PORT}`.toLowerCase(),
      `https://localhost:${PORT}`.toLowerCase(),
    ];
    if (sameHostOrigins.includes(normalized)) {
      return callback(null, true);
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

app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const bodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "85";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("[Startup] Beginning server initialization sequence...");
    await assertStartupInvariants();

    try {
      console.log("[Startup] Verifying database connection...");
      await ensureProfilesTable();
      console.log("[Startup] Database connection verified.");
    } catch (err) {
      console.error("FATAL: ensureProfilesTable failed in production:", err);
      throw err;
    }

    try {
      console.log("[Startup] Running runtime SQL migrations...");
      await runRuntimeMigrations();
      console.log("[Startup] Runtime migrations complete.");
    } catch (err) {
      // Fail-soft: do not crash the whole app if migrations cannot run.
      // Missing tables will surface as feature degradation, but the UI should still load.
      console.error("[Startup] Runtime migrations failed (non-fatal):", err);
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

      const existingHeadAdmin = await storage.getUserByRole("head_admin");
      if (existingHeadAdmin) {
        return;
      }

      const firstName = process.env.MASTER_ADMIN_FIRST_NAME || "Super";
      const lastName = process.env.MASTER_ADMIN_LAST_NAME || "Admin";

      try {
        await storage.createMasterAdmin(email, password, firstName, lastName);
        console.log(`[Bootstrap] Created head_admin account for ${email}`);
      } catch (err) {
        console.error("FATAL: Failed to create master admin in production:", err);
        throw err;
      }
    };

    await ensureMasterAdmin();
    console.log("[Startup] Master admin verification complete.");

    try {
      console.log("[Startup] Running schema preflight checks...");
      await runSchemaPreflight();
      console.log("[Startup] Schema preflight complete.");
    } catch (err) {
      console.error("[SchemaPreflight] Failed during startup (non-fatal):", err);
    }

    console.log("[Startup] Registering application routes...");
    const server = await registerRoutes(app);
    console.log("[Startup] Routes registered successfully.");

    app.use(createInvoicingDocumentsRouter(pool));

    initializeMessagingService(server);
    console.log("[Messaging] Socket.io service initialized");

    // Start the crawler scheduler for auto-caching
    // Controlled by SCHEDULER_ENABLED env flag (default: false)
    if (process.env.SCHEDULER_ENABLED === "true") {
      console.log("[Scheduler] Enabling background jobs...");
      startCrawlerScheduler();
    } else {
      console.log("[Scheduler] Background jobs disabled (SCHEDULER_ENABLED != true)");
    }

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
    }, 60000);

    if (process.env.SENTRY_DSN) {
      app.use(Sentry.Handlers.errorHandler());
    }

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err?.message || "Internal Server Error";
      const errorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
      } catch (err) {
        // ignore logging errors
      }

      if (res.headersSent) {
        return;
      }

      res.status(status).json({
        message: status >= 500 ? "Internal Server Error" : message,
        errorId,
      });
    });

    let currentPort = PORT;

    const startHttpServer = (portToUse: number) => {
      console.log(`[Startup] Attempting to bind HTTP server to port ${portToUse}...`);
      currentPort = portToUse;
      server.listen(
        {
          port: portToUse,
          host: "0.0.0.0",
        },
        () => {
          log(`serving on port ${portToUse}`);
          console.log(`[Startup] Server is successfully listening on port ${portToUse}`);

          const workspaceRoot = process.cwd();
          const publicDistPath = path.join(workspaceRoot, "dist/public");

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
    <p>Your browser cache and service worker are being cleared for <code>${CANONICAL_WEB_HOST}</code>.</p>
    <p>If you are not redirected automatically, open <a href=\"/?__fresh=${fresh}\">the homepage</a>.</p>
  </body>
</html>`);
            });

            // Serve uploaded files
            const uploadsPath = path.resolve(process.env.UPLOAD_DIR || "./public/uploads");
            app.use("/uploads", express.static(uploadsPath, { maxAge: "1y" }));

            const assetsPath = path.join(publicDistPath, "assets");
            if (fs.existsSync(assetsPath)) {
              app.use(
                "/assets",
                express.static(assetsPath, {
                  immutable: true,
                  maxAge: "1y",
                })
              );
            }

            // Force revalidation for app identity assets (favicons, manifest, logos)
            const identityAssets = new Set([
              "/favicon.ico",
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
              res.redirect(301, "/tradescout-logo.png?v=3");
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

            app.use(
              express.static(publicDistPath, {
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

                // Legacy alias; canonical public profile URL is /u/:slug.
                if (req.path.startsWith("/p/")) {
                  return res.redirect(301, `${origin}/u/${encodeURIComponent(slug)}`);
                }

                const html = await buildPublicProfileHtml({ slug, origin, templateHtml });

                if (!html) {
                  return res.status(404).send("Profile not found");
                }

                res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
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

                const html = await buildPublicBusinessHtml({ slug, origin, templateHtml });
                if (!html) {
                  return res.status(404).send("Business not found");
                }

                res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
                res.send(html);
              } catch (err) {
                console.error("Error rendering public business HTML:", err);
                res.status(500).send("Failed to render business");
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

                res.setHeader("Cache-Control", "public, max-age=180, stale-while-revalidate=3600");
                res.send(html);
              } catch (err) {
                console.error("Error rendering shared work request HTML:", err);
                res.status(500).send("Failed to render shared request");
              }
            });

            app.get("*", (req, res) => {
              const reqPath = req.path || "";

              if (reqPath.startsWith("/api")) {
                return res.status(404).json({ message: "Not found" });
              }

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
          }
        }
      );
    };

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
