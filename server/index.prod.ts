// Load dotenv configuration before anything else (safe in all envs)
import "dotenv/config";

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
import { buildPublicProfileHtml } from "./publicProfileHtml";

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

// Override process.exit to trap explicit exits
const originalExit = process.exit;
process.exit = (code?: number) => {
  console.log(`[Diagnostic] process.exit(${code}) was called explicitly.`);
  console.trace("Call stack for process.exit:");
  return originalExit(code);
};

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
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
  const host = req.headers.host?.toLowerCase() || "";
  if (host.includes("tradescoutai.onrender.com") || host === "thetradescout.com") {
    const targetHost = "www.thetradescout.com";
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const redirectUrl = `${protocol}://${targetHost}${req.originalUrl || ""}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

const ALLOWED_ORIGINS: string[] = [
  "https://www.thetradescout.com",
  "https://thetradescout.com",
  "https://tradescoutai.onrender.com",
  "https://mealscout.us",
  "https://www.mealscout.us",
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
    try {
      console.log("[Startup] Verifying database connection...");
      await ensureProfilesTable();
      console.log("[Startup] Database connection verified.");
    } catch (err) {
      console.error("FATAL: ensureProfilesTable failed in production:", err);
      throw err;
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
            app.get("/p/:slug", async (req, res) => {
              try {
                const indexPath = path.join(publicDistPath, "index.html");
                const templateHtml = getCachedTemplate(indexPath);
                if (!templateHtml) {
                  return res.status(404).send("Application files not found");
                }

                const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
                const host = req.headers.host || "www.thetradescout.com";
                const origin = `${protocol}://${host}`;

                const html = await buildPublicProfileHtml({
                  slug: String(req.params.slug || ""),
                  origin,
                  templateHtml,
                });

                if (!html) {
                  return res.status(404).send("Profile not found");
                }

                res.setHeader("Cache-Control", "no-store");
                res.send(html);
              } catch (err) {
                console.error("Error rendering public profile HTML:", err);
                res.status(500).send("Failed to render profile");
              }
            });

            app.get("*", (req, res) => {
              const reqPath = req.path || "";

              if (reqPath.startsWith("/api")) {
                return res.status(404).json({ message: "Not found" });
              }

              if (reqPath.startsWith("/assets")) {
                return res.status(404).end();
              }

              // If it looks like a file request (e.g. /favicon.ico), never fall back to index.html.
              const base = path.posix.basename(reqPath);
              if (base.includes(".")) {
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
