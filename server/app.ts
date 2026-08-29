/**
 * Testable Express application factory
 * Exports app without starting a listener (for Supertest)
 * Runtime behavior via server/index.ts unchanged
 */

// Load test env early so module-level env reads are correct
if (process.env.NODE_ENV === "test") {
  await import("dotenv/config");
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { registerRoutes } from "./routes";
import { emitHttpStatus } from "./observability/metrics";
import { assertStartupInvariants } from "./startupInvariants";
import { recordCrawlerRequestEvent } from "./services/crawlerTelemetryService";
import { landingContractHeaders } from "./middleware/landingContractHeaders";
import {
  handleCorsOriginDeniedError,
  rejectUnsupportedCmsProbe,
} from "./http/publicRequestGuards";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { preserveStripeWebhookRawBody } from "./paymentWebhookRoutes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANONICAL_WEB_HOST = "www.thetradescout.com";

function getForwardedProto(req: Request): string {
  return String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp() {
  await assertStartupInvariants();

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

  // Basic hardening + perf
  app.use(
    helmet({
      // CSP is intentionally not enforced here; front-end surfaces may rely on inline assets.
      contentSecurityPolicy: false,
    })
  );
  app.use(compression());

  const PORT = parseInt(process.env.PORT || "5000", 10);

  // Sentry (only in non-test envs)
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== "test") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    });
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }

  // Force canonical host redirect (skip in test)
  if (process.env.NODE_ENV !== "test") {
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
  }

  // CORS setup
  const ALLOWED_ORIGINS: string[] = [
    "https://www.thetradescout.com",
    "https://thetradescout.com",
    "https://tradescoutai.onrender.com",
  ].map((o) => o.toLowerCase());

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
      if (normalized && !ALLOWED_ORIGINS.includes(normalized)) {
        ALLOWED_ORIGINS.push(normalized);
      }
    }
  }

  if (!isProductionEnv) {
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
      if (!origin) return callback(null, true);
      const normalized = origin.toLowerCase();
      if (allowAllCors) return callback(null, true);
      if (!isProductionEnv) {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
          return callback(null, true);
        }
        const sameHostOrigins = [
          `http://localhost:${PORT}`.toLowerCase(),
          `https://localhost:${PORT}`.toLowerCase(),
        ];
        if (sameHostOrigins.includes(normalized)) return callback(null, true);
      }
      if (ALLOWED_ORIGINS.includes(normalized)) return callback(null, true);
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

  // CORS denial is a client authorization failure, not a server fault. Common
  // WordPress discovery probes are unsupported paths, not application errors.
  // Both guards must run before body parsing and the application route graph.
  app.use(handleCorsOriginDeniedError);
  app.use(rejectUnsupportedCmsProbe);

  // Body parsing
  const bodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
  app.use(express.json({ limit: bodyLimit, verify: preserveStripeWebhookRawBody }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  // Request logging (skip in test)
  if (process.env.NODE_ENV !== "test") {
    const apiSlowLogMs = Number(process.env.API_SLOW_LOG_MS || 750);
    const logAllApiRequests =
      process.env.API_LOG_ALL === "true" || process.env.NODE_ENV !== "production";

    app.use((req, res, next) => {
      const start = Date.now();
      const requestPath = req.path;

      res.on("finish", () => {
        const duration = Date.now() - start;
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
  }

  app.use(landingContractHeaders);

  // Register API routes (await to ensure routes are mounted before returning app)
  const server = await registerRoutes(app);

  // Sentry error handler (only in non-test envs)
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== "test") {
    app.use(Sentry.Handlers.errorHandler());
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || "Something went wrong";
    const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (process.env.NODE_ENV !== "test") {
      console.error(`[ERROR ${errorId}]`, err);
    }

    res.status(status).json({
      message: status >= 500 ? "Internal Server Error" : message,
      errorId,
    });
  });

  return { app, server };
}
