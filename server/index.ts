// Load dotenv configuration before anything else (safe in all envs)
import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { registerRoutes } from "./routes";
import { createInvoicingDocumentsRouter } from "./invoicingDocumentsRouter";
import { db, pool } from "./db";
import { notificationService } from "./notification-service";
import { startCrawlerScheduler } from "./services/crawlerScheduler";
import { initializeMessagingService } from "./messaging-service";
import { storage } from "./storage";
import { ensureProfilesTable } from "./ensureDb";
import { runSchemaPreflight } from "./schemaPreflight";
import { emitHttpStatus } from "./observability/metrics";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { buildPublicProfileHtml } from "./publicProfileHtml";
import { buildWorkRequestShareHtml } from "./workRequestShareHtml";
import { affiliateAccounts, profiles, users } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicProfileTemplateCache = new Map<string, string>();

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
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Global error handlers
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
    if (process.env.NODE_ENV === "production") {
      console.error(`Missing required env: ${key}`);
      process.exit(1);
    } else {
      console.warn(
        `[DEV] Missing env ${key} – server will start but related features may fail. Do NOT rely on this in production.`
      );
    }
  }
}

const app = express();
// REQUIRED for secure cookies behind hosting proxies
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
    contentSecurityPolicy: false,
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
  const host = req.headers.host?.toLowerCase() || "";

  // If someone hits the Render URL directly or apex domain, send to canonical www host.
  if (host.includes("tradescoutai.onrender.com") || host === "thetradescout.com") {
    const targetHost = "www.thetradescout.com";
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const redirectUrl = `${protocol}://${targetHost}${req.originalUrl || ""}`;
    return res.redirect(301, redirectUrl);
  }

  next();
});

// Custom domains: treat any user-owned domain as a referral entrypoint.
// We do not serve the full app on custom domains; we redirect to the canonical host
// with ?ref=... attached so everything stays on one origin.
const CUSTOM_DOMAIN_CACHE = new Map<
  string,
  { kind: "affiliate"; ref: string; at: number } | { kind: "profile"; slug: string; at: number }
>();
const CUSTOM_DOMAIN_TTL_MS = 60 * 60 * 1000; // 1 hour

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
        const path = req.path || "/";
        if (path === "/" || path === "") {
          return res.redirect(
            301,
            `/u/${encodeURIComponent(cached.slug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
          );
        }
        return next();
      }

      const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
      const targetHost = "www.thetradescout.com";
      const url = new URL(`${protocol}://${targetHost}${req.originalUrl || "/"}`);
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
      const path = req.path || "/";
      if (path === "/" || path === "") {
        return res.redirect(
          301,
          `/u/${encodeURIComponent(profileSlug)}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`
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

    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const targetHost = "www.thetradescout.com";
    const url = new URL(`${protocol}://${targetHost}${req.originalUrl || "/"}`);
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
].map((o) => o.toLowerCase());

// Optionally extend/override CORS allowlist from env
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

// Always allow localhost dev ports (client + API) in dev
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
    // No origin (curl/server-side) → allow
    if (!origin) return callback(null, true);
    const normalized = origin.toLowerCase();

    // Temp escape hatch: allow all origins when explicitly configured
    if (allowAllCors) {
      return callback(null, true);
    }

    // Always allow localhost loopback origins on any port.
    // This keeps prod-preview working even if the server falls back to a different port.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
      return callback(null, true);
    }

    // Always allow same-host access on the API port (common for prod localhost testing)
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

// Serve uploaded files (dev + prod). In dev, this supports local file workflows and
// in-app previews; in prod, this supports staff-accessible upload links.
const uploadsPath = path.resolve(process.env.UPLOAD_DIR || "./public/uploads");
if (fs.existsSync(uploadsPath)) {
  app.use(
    "/uploads",
    express.static(uploadsPath, { maxAge: process.env.NODE_ENV === "production" ? "1y" : "0" })
  );
}

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

    // Emit HTTP status metrics (Phase 1: Observability)
    emitHttpStatus(res.statusCode, { userAgent: req.get("User-Agent"), path: req.path });

    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
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
        if (process.env.NODE_ENV === "production") {
          console.error("FATAL: Failed to create master admin in production:", err);
          throw err;
        }
        console.warn(
          "[DEV] Failed to create master admin; continuing without bootstrap head_admin:",
          (err as Error)?.message
        );
      }
    };

    await ensureMasterAdmin();
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

    // Start the crawler scheduler for auto-caching
    // Controlled by SCHEDULER_ENABLED env flag (default: false)
    if (process.env.SCHEDULER_ENABLED === "true") {
      console.log("[Scheduler] Enabling background jobs...");
      startCrawlerScheduler();
    } else {
      console.log("[Scheduler] Background jobs disabled (SCHEDULER_ENABLED != true)");
    }

    // Start birthday notification processing - runs daily at 9 AM
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
                  const { setupVite } = await import("./vite");
                  await setupVite(app, server);
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

              // 1) Serve hashed asset chunks with long cache first
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

              // 1.5) Force revalidation for app identity assets (favicons, manifest, logos)
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

              // 2) Serve other static files (index.html, icons, etc.)
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

                  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
                  const host = req.headers.host || "www.thetradescout.com";
                  const origin = `${protocol}://${host}`;

                  const slug = String(req.params.slug || "");

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

              // Shared Direct Connect request pages: server-rendered metadata for social preview
              app.get("/r/:shareToken", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
                  const host = req.headers.host || "www.thetradescout.com";
                  const origin = `${protocol}://${host}`;
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

              // 3) Catch-all handler for client-side routing, but NEVER for /api or /assets
              app.get("*", (req, res) => {
                const reqPath = req.path || "";

                if (reqPath.startsWith("/api")) {
                  return res.status(404).json({ message: "Not found" });
                }

                // If an asset was requested but not found by express.static, do NOT
                // return index.html – this would surface as a MIME-type error in the browser.
                if (reqPath.startsWith("/assets")) {
                  return res.status(404).end();
                }

                // If it looks like a file request (e.g. /favicon.ico), never fall back to index.html.
                const base = path.posix.basename(reqPath);
                if (base.includes(".")) {
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
