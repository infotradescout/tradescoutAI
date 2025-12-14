import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { notificationService } from "./notification-service";
import { startCrawlerScheduler } from "./services/crawlerScheduler";
import { initializeMessagingService } from "./messaging-service";
import { storage } from "./storage";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

process.on('SIGINT', () => {
  console.log('Received SIGINT - ignoring (server should stay running)');
  // Don't exit - we want the server to keep running
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM - shutting down gracefully');
  process.exit(0);
});

const requiredEnv = ["DATABASE_URL", "SESSION_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

const app = express();
// REQUIRED for secure cookies behind Render/Vercel proxies
app.set("trust proxy", 1);

// Always serve on PORT (single entry for API + client); default 5000.
const PORT = parseInt(process.env.PORT || "5000", 10);

// Sentry setup (request and tracing handlers should come before other middleware)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Stripe webhooks need the raw body; route-specific raw parser lives here before global JSON parser.
app.use("/api/payments/stripe/webhook", express.raw({ type: "application/json" }));

const jsonMiddleware = express.json();
const urlencodedMiddleware = express.urlencoded({ extended: false });

// Skip JSON parsing for the Stripe webhook path to preserve the raw body for signature verification.
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payments/stripe/webhook") return next();
  jsonMiddleware(req, res, (err) => {
    if (err) return next(err);
    urlencodedMiddleware(req, res, next);
  });
});

// Deterministic CORS configuration
const rawAllowlist = process.env.CORS_ALLOWED_ORIGINS || "";
const ALLOWED_ORIGINS = rawAllowlist
  .split(",")
  .map((o) => o.trim().toLowerCase())
  .filter((o) => o.length > 0);

// Always allow known production origins
for (const origin of [
  "https://www.thetradescout.com",
  "https://tradescout-e557bv88z-tradescouts-projects.vercel.app",
]) {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    ALLOWED_ORIGINS.push(origin);
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

    await storage.createMasterAdmin(email, password, firstName, lastName);
    console.log(`[Bootstrap] Created head_admin account for ${email}`);
  };

  await ensureMasterAdmin();
  // NOTE: Ensure 'routes' is imported or defined before this point if 'registerRoutes' uses it directly.
  // If 'routes' is not implicitly available, it needs to be imported.
  // For this example, assuming 'routes' is handled within 'registerRoutes' or imported elsewhere.
  const server = await registerRoutes(app);

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
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.

  const startHttpServer = (portToUse: number) => {
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
            app.use(express.static(publicDistPath));

            // Catch all handler for client-side routing
            app.get("*", (req, res) => {
              if (req.path.startsWith("/api")) {
                return res.status(404).json({ message: "Not found" });
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
      const fallbackPort = PORT + 1;
      console.warn(
        `Port ${PORT} is in use; retrying on ${fallbackPort}. Update your browser URL accordingly.`,
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