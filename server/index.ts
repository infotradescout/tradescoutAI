// Load dotenv only in development - never in production ESM bundles
if (process.env.NODE_ENV !== 'production') {
  await import('dotenv/config');
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { registerRoutes } from "./routes";
import { createInvoicingDocumentsRouter } from "./invoicingDocumentsRouter";
import { pool } from "./db";
import { notificationService } from "./notification-service";
import { startCrawlerScheduler } from "./services/crawlerScheduler";
import { initializeMessagingService } from "./messaging-service";
import { storage } from "./storage";
import { ensureProfilesTable } from "./ensureDb";
import { runSchemaPreflight } from "./schemaPreflight";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
  console.trace('Exit stack trace:');
});

process.on('beforeExit', (code) => {
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

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const requiredEnv = ["DATABASE_URL", "SESSION_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    if (process.env.NODE_ENV === "production") {
      console.error(`Missing required env: ${key}`);
      process.exit(1);
    } else {
      console.warn(`[DEV] Missing env ${key} – server will start but related features may fail. Do NOT rely on this in production.`);
    }
  }
}

const app = express();
// REQUIRED for secure cookies behind hosting proxies
app.set("trust proxy", 1);

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

// Force canonical host: redirect raw Render hostname to primary domain
app.use((req, res, next) => {
  const host = req.headers.host?.toLowerCase() || "";

  // If someone hits the Render URL directly, send them to www.thetradescout.com
  if (host.includes("tradescoutai.onrender.com")) {
    const targetHost = "www.thetradescout.com";
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const redirectUrl = `${protocol}://${targetHost}${req.originalUrl || ""}`;
    return res.redirect(301, redirectUrl);
  }

  next();
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
  const devOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    `http://localhost:${PORT}`,
  ];
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      console.warn("[DEV] ensureProfilesTable failed; continuing without profiles table:", (err as Error)?.message);
    }
  }

  const ensureMasterAdmin = async () => {
    const email = process.env.MASTER_ADMIN_EMAIL;
    const password = process.env.MASTER_ADMIN_PASSWORD;
    if (!email || !password) {
      console.warn('[Bootstrap] MASTER_ADMIN_EMAIL/PASSWORD not set; skipping master admin bootstrap');
      return;
    }

    const existingHeadAdmin = await storage.getUserByRole('head_admin');
    if (existingHeadAdmin) {
      return;
    }

    const firstName = process.env.MASTER_ADMIN_FIRST_NAME || 'Super';
    const lastName = process.env.MASTER_ADMIN_LAST_NAME || 'Admin';

    try {
      await storage.createMasterAdmin(email, password, firstName, lastName);
      console.log(`[Bootstrap] Created head_admin account for ${email}`);
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: Failed to create master admin in production:", err);
        throw err;
      }
      console.warn("[DEV] Failed to create master admin; continuing without bootstrap head_admin:", (err as Error)?.message);
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
  console.log('[Messaging] Socket.io service initialized');

  // Start the crawler scheduler for auto-caching
  // TEMPORARILY DISABLED for smoke testing (pre-existing bug in hoa.ts extractor)
  // startCrawlerScheduler();

  // Start birthday notification processing - runs daily at 9 AM
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      try {
        await notificationService.processBirthdayNotifications();
        console.log('Daily birthday notifications processed');
      } catch (error) {
        console.error('Error processing birthday notifications:', error);
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

  const startHttpServer = (portToUse: number) => {
    currentPort = portToUse;
    server.listen(
      {
        port: portToUse,
        host: "0.0.0.0",
      },
      () => {
        log(`serving on port ${portToUse}`);

        // Setup vite AFTER the server is listening so the port is available
        const isProduction =
          process.env.NODE_ENV === "production" || app.get("env") === "production";
        console.log(
          `Environment check: NODE_ENV=${process.env.NODE_ENV}, app.env=${app.get(
            "env",
          )}, isProduction=${isProduction}`,
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
                console.log(
                  "[DEV] Vite skipped - API server will run without client",
                );
              } else {
                console.log("[DEV] Setting up Vite...");
                const { setupVite } = await import("./vite");
                await setupVite(app, server);
                console.log(
                  "[DEV] Vite setup complete - ready to accept connections",
                );
              }
            } catch (viteError) {
              console.error("[DEV] Failed to setup Vite:", viteError);
              console.error("[DEV] Stack:", (viteError as Error).stack);
              // Don't exit - let the server continue running without Vite
              console.log(
                "[DEV] Server will continue running without Vite dev server",
              );
            }
          })();
        } else {
          // Serve static files from dist/public (Vite build output) if available
          const workspaceRoot = process.cwd();
          const publicDistPath = path.join(workspaceRoot, "dist/public");

          // Only serve frontend if dist/public exists (allows API-only deployment)
          if (fs.existsSync(publicDistPath)) {
            console.log("Production mode - serving static files from:", publicDistPath);

            // Serve uploaded files
            const uploadsPath = path.resolve(process.env.UPLOAD_DIR || "./public/uploads");
            app.use("/uploads", express.static(uploadsPath, { maxAge: "1y" }));

            // 1) Serve hashed asset chunks with long cache first
            const assetsPath = path.join(publicDistPath, "assets");
            if (fs.existsSync(assetsPath)) {
              app.use(
                "/assets",
                express.static(assetsPath, {
                  immutable: true,
                  maxAge: "1y",
                }),
              );
            }

            // 2) Serve other static files (index.html, icons, etc.)
            app.use(express.static(publicDistPath));

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

              const indexPath = path.join(publicDistPath, "index.html");

              // Check if file exists before trying to serve
              if (fs.existsSync(indexPath)) {
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
      },
    );
  };

  // Handle port-in-use errors by falling back to the next port instead of crashing
  server.on("error", (err: any) => {
    if (err && (err as any).code === "EADDRINUSE") {
      const fallbackPort = currentPort + 1;
      console.warn(
        `Port ${currentPort} is in use; retrying on ${fallbackPort}. Update your browser URL accordingly.`,
      );
      startHttpServer(fallbackPort);
    } else {
      console.error("Server failed to start:", err);
      process.exit(1);
    }
  });

  startHttpServer(PORT);
  } catch (error) {
    console.error('FATAL ERROR during server initialization:', error);
    console.error('Stack:', (error as Error).stack);
    process.exit(1);
  }
})();