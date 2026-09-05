// Load dotenv configuration before anything else (safe in all envs)
import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { isCorsNeutralPublicAssetRequest } from "./http/corsPolicy";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { registerRoutes } from "./routes";
import { registerPublicShellAliasRoutes } from "./publicShellAliasRoutes";
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
  ensureTrustLedgerEventsTable,
} from "./ensureDb";
import { runSchemaPreflight } from "./schemaPreflight";
import { getJwStonePricingSnapshot } from "./services/jwStoneDrivePricing";
import {
  HistoricalMigrationReplayRefusedError,
  runRelease399MigrationLedgerRecovery,
  runRuntimeMigrations,
} from "./runtimeMigrations";
import { assertStartupInvariants } from "./startupInvariants";
import { emitHttpStatus } from "./observability/metrics";
import { botReadOnlyGuard } from "./middleware/botReadOnlyGuard";
import { landingContractHeaders } from "./middleware/landingContractHeaders";
import {
  recordCrawlerRequestEvent,
  getLandingIntentContractForPath,
} from "./services/crawlerTelemetryService";
import {
  handleExplicitOrExistingReferral,
  attributeCleanPageViewToOwner,
} from "./services/referralAttribution";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  buildPublicProfileEarlyHtml,
  buildPublicProfileHtml,
  buildPublicProfileLlmsText,
  buildPublicProfileSitemapXml,
} from "./publicProfileHtml";
import { buildPublicHelperProfileHtml } from "./publicHelperProfileHtml";
import { buildPublicBusinessHtml } from "./publicBusinessHtml";
import { buildPublicContractorProfileHtml } from "./publicContractorProfileHtml";
import { buildPublicCommunityPostHtml } from "./publicCommunityPostHtml";
import { buildPublicGroupHtml } from "./publicGroupHtml";
import {
  buildPublicTradeCountyHtml,
  buildPublicTradeDirectoryHtml,
  buildPublicTradeOverviewHtml,
  buildPublicTradeStateHtml,
} from "./publicTradeHtml";
import { buildPublicCityHtml } from "./publicCityHtml";
import { buildPublicTradeCityHtml } from "./publicTradeCityHtml";
import { buildPublicCountyHtml } from "./publicCountyHtml";
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
import {
  applyPrivateShellNoindex,
  isPrivateAppShellPath,
} from "./privateShellIndexability";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import {
  buildJwStoneMarketplaceLlmsText,
  buildJwStoneMarketplaceSitemapXml,
  buildPublicJwStoneMarketplaceHtml,
} from "./publicJwStoneMarketplaceHtml";
import { buildPublicExchangeHtml } from "./publicExchangeHtml";
import { buildPublicExchangeListingHtml } from "./publicExchangeListingHtml";
import { buildPublicHandmadeProductHtml } from "./publicHandmadeProductHtml";
import { buildPublicProfileServiceOfferHtml } from "./publicProfileServiceOfferHtml";
import { buildPublicHomeScoutListingHtml } from "./publicHomeScoutListingHtml";
import { buildPublicHomeScoutCountyHtml } from "./publicHomeScoutCountyHtml";
import { buildPublicContractorPromoHtml } from "./publicContractorPromoHtml";
import { buildWorkRequestShareHtml } from "./workRequestShareHtml";
import { registerUploadsFallback } from "./uploadsFallback";
import { affiliateAccounts, businesses, profiles, users } from "@shared/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { closeRedisClient } from "./utils/redisClient";
import { provisionJrsAutoGlassProfile } from "./services/jrsAutoGlassProfileProvisioning";
import { provisionLaPlumbingProfile } from "./services/laPlumbingProfileProvisioning";
import { provisionIssaBuildProfile } from "./services/issaBuildProfileProvisioning";
import { provisionProFabProfile } from "./services/proFabProfileProvisioning";
import { provisionPrecisionAerialProfile } from "./services/precisionAerialProfileProvisioning";
import { provisionMouldingMillworkProfile } from "./services/mouldingMillworkProfileProvisioning";
import { provisionSteelHomePackagesProfile } from "./services/steelHomePackagesProfileProvisioning";
import { normalizeProfileGalleryItemSlug } from "@shared/profileGalleryShare";
import {
  preparePublicSeoHtmlForUserAgent,
  publicSocialMetadataCacheControl,
} from "./publicSeoHtml";
import { isSameRequestHttpOrigin, normalizeHttpOrigin } from "./utils/requestCors";
import { CANONICAL_WEB_HOST, resolvePublicOrigin } from "./utils/publicOrigin";
import { sendPublicPageNotFound, sendPublicPageRenderFailure } from "./utils/publicPageResponse";
import {
  resolveCanonicalDuplicatedAssetPath,
  resolveCurrentEntryStylesheet,
} from "./staticAssetRecovery";
import { preserveStripeWebhookRawBody } from "./paymentWebhookRoutes";
import { registerPublicProfileAppRoutes } from "./routes/public-profile-app";
import { resolveCanonicalBusinessProfileRoute } from "./services/canonicalBusinessProfileRoute";
import { canExposePublishedProfilePublicly } from "./services/ownerConfirmedDirectProfile";
import { ISSA_BUILD_LEGACY_PROFILE_SLUG, ISSA_BUILD_PROFILE_SLUG } from "@shared/issaBuildProfile";
import {
  buildPublicProfileCanonicalRedirectTarget,
  resolvePublicProfileCategoryRequest,
  resolvePublicProfileItemRequest,
  type ResolvedPublicProfileCategoryRequest,
  type ResolvedPublicProfileItemRequest,
} from "./publicProfileItemRouting";
import { serveSteelHomeBuilderProfileRoute } from "./steelHomeBuilderProfileRoute";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicProfileTemplateCache = new Map<string, string>();
function getForwardedProto(req: Request): string {
  return String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
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
      /<html[\s>]/i.test(body) &&
      /<meta\b[^>]*\bproperty\s*=\s*(["'])og:image\1/i.test(body)
    ) {
      const prepared = preparePublicSeoHtmlForUserAgent(
        body,
        String(req.headers["user-agent"] || "")
      );
      const socialMetadataCacheControl = publicSocialMetadataCacheControl(prepared);
      const existingCacheControl = String(res.getHeader("Cache-Control") || "");
      if (
        socialMetadataCacheControl &&
        req.method === "GET" &&
        res.statusCode < 400 &&
        !(req as any).user &&
        !/\b(?:no-store|private)\b/i.test(existingCacheControl)
      ) {
        // Signed card URLs rotate in short, deterministic buckets so hidden or
        // moderated content cannot remain advertised by long-lived stale HTML.
        res.setHeader("Cache-Control", socialMetadataCacheControl);
      }
      return originalSend(prepared);
    }
    return originalSend(body);
  }) as typeof res.send;

  next();
});

app.use(
  helmet({
    // Business photos and the favicon override are always loaded as
    // absolute thetradescout.com URLs, including from a business's own
    // custom domain (see the img-src comment below). Helmet's default
    // Cross-Origin-Resource-Policy: same-origin silently blocks exactly
    // that cross-origin embed regardless of CSP, so relax it here.
    crossOriginResourcePolicy: { policy: "cross-origin" },
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
        "frame-src": ["'self'", "https://js.stripe.com", "https://www.instagram.com"],
        "media-src": ["'self'", "https://thetradescout.com", "https://www.thetradescout.com"],
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
  const hostNeedsCanonical = host === "tradescoutai.onrender.com" || host === "thetradescout.com";
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
  | { kind: "profile"; slug: string; ownerUserId: string; at: number }
  | { kind: "business"; slug: string; at: number }
>();
const CUSTOM_DOMAIN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAPPED_PROFILE_DOMAIN_HOST_KEY = "mappedProfileDomainHost";
const MAPPED_PROFILE_DOMAIN_SLUG_KEY = "mappedProfileDomainSlug";

function markMappedProfileDomainRequest(req: Request, host: string, slug: string): void {
  (req as any)[MAPPED_PROFILE_DOMAIN_HOST_KEY] = host;
  (req as any)[MAPPED_PROFILE_DOMAIN_SLUG_KEY] = slug;
}

function isMappedProfileDomainSameOrigin(req: Request, origin: string): boolean {
  const mappedHost = String((req as any)[MAPPED_PROFILE_DOMAIN_HOST_KEY] || "")
    .trim()
    .toLowerCase();
  const normalizedOrigin = normalizeHttpOrigin(origin);
  if (!mappedHost || !normalizedOrigin || !isSameRequestHttpOrigin(req, origin)) return false;
  try {
    return new URL(normalizedOrigin).hostname.toLowerCase() === mappedHost;
  } catch {
    return false;
  }
}

function requestSearchSuffix(req: Request): string {
  const requestUrl = String(req.originalUrl || req.url || "");
  const queryIndex = requestUrl.indexOf("?");
  return queryIndex >= 0 ? requestUrl.slice(queryIndex) : "";
}

function customDomainCanonicalRedirectTarget(
  req: Request,
  host: string,
  canonicalPath: string
): string {
  const target = new URL(canonicalPath, `https://${host}`);
  const rawReferral = Array.isArray(req.query.ref) ? req.query.ref[0] : req.query.ref;
  const referralCode = typeof rawReferral === "string" ? rawReferral.trim() : "";
  if (referralCode) target.searchParams.set("ref", referralCode);
  const rawRequest = Array.isArray(req.query.request) ? req.query.request[0] : req.query.request;
  const requestIntent = typeof rawRequest === "string" ? rawRequest.trim() : "";
  if (requestIntent === "stone" || requestIntent === "collection") {
    target.searchParams.set("request", requestIntent);
  }
  return target.toString();
}

function profileItemPathSuffix(
  itemRequest: ResolvedPublicProfileItemRequest,
  profileBasePath: string
): string {
  const normalizedBase = profileBasePath.replace(/\/+$/, "");
  return itemRequest.canonicalPath.startsWith(`${normalizedBase}/`)
    ? itemRequest.canonicalPath.slice(normalizedBase.length)
    : itemRequest.canonicalPath;
}

function profileCategoryPathSuffix(
  categoryRequest: ResolvedPublicProfileCategoryRequest,
  profileBasePath: string
): string {
  const normalizedBase = profileBasePath.replace(/\/+$/, "");
  return categoryRequest.canonicalPath.startsWith(`${normalizedBase}/`)
    ? categoryRequest.canonicalPath.slice(normalizedBase.length)
    : categoryRequest.canonicalPath;
}

function alternateCustomDomainHost(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : `www.${host}`;
}

function isCustomDomainAuthorityRequest(req: Request): boolean {
  const requestPath = req.path || "/";
  return (
    !isCustomDomainMechanicsPath(requestPath) ||
    requestPath === "/" ||
    requestPath === "" ||
    requestPath === "/robots.txt" ||
    requestPath === "/sitemap.xml" ||
    requestPath === "/llms.txt" ||
    requestPath === "/api" ||
    requestPath.startsWith("/api/") ||
    requestPath === "/auth" ||
    requestPath.startsWith("/auth/") ||
    requestPath.startsWith("/u/")
  );
}

function redirectToCanonicalCustomDomain(req: Request, res: Response, canonicalHost: string) {
  const requestPathAndQuery = String(req.originalUrl || req.url || "/");
  const normalizedPathAndQuery = requestPathAndQuery.startsWith("/")
    ? requestPathAndQuery
    : `/${requestPathAndQuery}`;
  return res.redirect(301, `https://${canonicalHost}${normalizedPathAndQuery}`);
}

function isCustomDomainMechanicsPath(requestPath: string): boolean {
  if (requestPath === "/business-verification") return true;

  if (
    requestPath.startsWith("/api/") ||
    requestPath === "/api" ||
    requestPath.startsWith("/auth/") ||
    requestPath === "/auth" ||
    requestPath.startsWith("/r/") ||
    requestPath.startsWith("/.well-known/")
  ) {
    return true;
  }

  if (
    ["/login", "/register", "/reset-password", "/verify-email"].some(
      (pathPrefix) => requestPath === pathPrefix || requestPath.startsWith(`${pathPrefix}/`)
    )
  ) {
    return true;
  }

  if (
    [
      "/assets/",
      "/uploads/",
      "/images/",
      "/fonts/",
      "/icons/",
      "/landing/",
      "/profile-app-icons/",
      "/profile-manifests/",
      "/scoutfitters/",
    ].some((prefix) => requestPath.startsWith(prefix))
  ) {
    return true;
  }

  return (
    /^\/(?:apple-touch-icon(?:-precomposed)?|favicon(?:-\d+x\d+)?|icon-\d+(?:-maskable)?|logo|tradescout-[a-z0-9-]+)\.(?:ico|jpe?g|png|svg|webp)$/i.test(
      requestPath
    ) ||
    [
      "/about-explainer.css",
      "/firebase-messaging-sw.js",
      "/manifest.json",
      "/offline.html",
      "/service-worker.js",
      "/site.webmanifest",
      "/sw.js",
    ].includes(requestPath)
  );
}

function isSameProfileCompatibilityPath(requestPath: string, slug: string): boolean {
  const match = requestPath.match(/^\/u\/([^/]+)\/?$/);
  if (!match) return false;
  try {
    return decodeURIComponent(match[1]).toLowerCase() === slug.toLowerCase();
  } catch {
    return false;
  }
}

function isCustomDomainProfileRootCompatibilityPath(requestPath: string, slug: string): boolean {
  if (isSameProfileCompatibilityPath(requestPath, slug)) return true;

  // The SPA briefly emitted this app route after custom-domain authentication.
  // Recover saved/history URLs without turning the profile host into an app mirror.
  return requestPath === "/community-feed";
}

function redirectPublicRequestToPlatform(req: Request, res: Response): boolean {
  const requestPath = req.path || "/";
  if (isCustomDomainMechanicsPath(requestPath)) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const requestPathAndQuery = String(req.originalUrl || req.url || "/");
  const normalizedPathAndQuery = requestPathAndQuery.startsWith("/")
    ? requestPathAndQuery
    : `/${requestPathAndQuery}`;
  res.redirect(301, `https://${CANONICAL_WEB_HOST}${normalizedPathAndQuery}`);
  return true;
}

function redirectUnhandledCustomProfilePath(
  req: Request,
  res: Response,
  host: string,
  slug: string
): boolean {
  const requestPath = req.path || "/";
  if (isCustomDomainMechanicsPath(requestPath)) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const suffix = requestSearchSuffix(req);
  if (isCustomDomainProfileRootCompatibilityPath(requestPath, slug)) {
    res.redirect(301, `https://${host}/${suffix}`);
    return true;
  }

  sendPublicPageNotFound(res, "Profile page not found");
  return true;
}

// A configured profile custom domain should show
// its own URL in the address bar, not redirect through /u/:slug -- so this
// renders the same server-side HTML that route serves, in place, on the
// custom host. Falls back to the old redirect if the build isn't available
// (e.g. local dev, where dist/public doesn't exist).
async function renderProfileOnCustomDomain(
  req: Request,
  res: Response,
  host: string,
  slug: string,
  itemRequest?: ResolvedPublicProfileItemRequest | null,
  categoryRequest?: ResolvedPublicProfileCategoryRequest | null
): Promise<boolean> {
  const indexPath = path.join(process.cwd(), "dist/public", "index.html");
  const templateHtml = getCachedTemplate(indexPath);
  if (!templateHtml) return false;
  // The database-resolved Host is the authority. Forwarded host headers are
  // proxy metadata and must not be able to rewrite canonical profile output.
  const origin = `https://${host}`;
  const html =
    slug.trim().toLowerCase() === JW_STONE_PROFILE_SLUG
      ? buildPublicJwStoneMarketplaceHtml({
          templateHtml,
          origin,
          collectionUrl: `${origin}/`,
          marketplaceDomainSurface: true,
          stoneSlug:
            itemRequest?.itemType === "inventory" ? itemRequest.itemSlug : undefined,
          photo:
            itemRequest?.itemType === "inventory"
              ? String(itemRequest.imageIndex + 1)
              : undefined,
          materialSlug:
            categoryRequest?.kind === "category" ? categoryRequest.categorySlug : undefined,
        })
      : await buildPublicProfileHtml({
          slug,
          origin,
          templateHtml,
          itemSlug: itemRequest?.itemType === "inventory" ? itemRequest.itemSlug : req.query.stone,
          itemPhoto:
            itemRequest?.itemType === "inventory"
              ? String(itemRequest.imageIndex + 1)
              : req.query.photo,
          gallerySlug:
            itemRequest?.itemType === "gallery" ? itemRequest.itemSlug : req.query.gallery,
          categorySlug:
            categoryRequest?.kind === "category"
              ? categoryRequest.categorySlug
              : req.query.category,
        });
  if (!html) return false;

  // This runs in a middleware registered ahead of the app's usual CORS,
  // telemetry, and crawler-intent-header middleware (it has to, so it can
  // render before those even apply) -- so requests served here would
  // otherwise never get the bot-visibility signals every other page gets.
  // Set them explicitly instead of relying on that later middleware.
  const start = Date.now();
  const canonicalProfilePath = `/u/${encodeURIComponent(slug)}`;
  const crawlerPathOverride = itemRequest
    ? `${canonicalProfilePath}${profileItemPathSuffix(itemRequest, "/")}`
    : categoryRequest
      ? `${canonicalProfilePath}${profileCategoryPathSuffix(categoryRequest, "/")}`
      : canonicalProfilePath;
  const contract = getLandingIntentContractForPath(canonicalProfilePath);
  res.setHeader("X-TradeScout-Intent-Stage", contract.intentStage);
  res.setHeader("X-TradeScout-Audience-Hint", contract.audienceHint);
  res.setHeader("X-TradeScout-Knowledge-Hint", contract.knowledgeHint);
  res.setHeader("X-TradeScout-Action-Hint", contract.actionHint);
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.on("finish", () => {
    void recordCrawlerRequestEvent(req, res.statusCode, {
      responseTimeMs: Date.now() - start,
      responseBytes: Buffer.byteLength(html),
      pathOverride: crawlerPathOverride,
    });
  });
  res.send(html);
  return true;
}

async function serveCustomDomainProfilePath(
  req: Request,
  res: Response,
  host: string,
  slug: string,
  ownerUserId: string
): Promise<boolean> {
  const path = req.path || "/";

  // Domain routing proves control of a host, not public eligibility. Resolve
  // every custom-domain surface (HTML, robots, sitemap, and llms.txt) through
  // the same anonymous profile trust boundary before serving anything.
  const profileRecord = await storage.getProfileBySlugPublic(slug);
  if (!profileRecord) return false;
  const itemRequest = profileRecord
    ? resolvePublicProfileItemRequest({
        profile: profileRecord,
        pathname: path,
        profileBasePath: "/",
        stone: req.query.stone,
        gallery: req.query.gallery,
        photo: req.query.photo,
      })
    : { kind: "none" as const };
  const categoryRequest = profileRecord
    ? resolvePublicProfileCategoryRequest({
        profile: profileRecord,
        pathname: path,
        profileBasePath: "/",
        category: req.query.category,
      })
    : { kind: "none" as const };

  if (itemRequest.kind === "invalid-item-route") {
    sendPublicPageNotFound(res, "Profile item not found");
    return true;
  }
  if (categoryRequest.kind === "invalid-category-route") {
    sendPublicPageNotFound(res, "Profile category not found");
    return true;
  }

  const attributeProfileVisit = async (source: string) => {
    const handledExplicitOrExisting = await handleExplicitOrExistingReferral(req, res);
    if (!handledExplicitOrExisting) {
      await attributeCleanPageViewToOwner({
        req,
        res,
        ownerUserId,
        destination: req.originalUrl || "/",
        source,
        conversionType: "public_profile_view",
      });
    }
  };

  if (itemRequest.kind === "item") {
    if (itemRequest.source === "legacy-query") {
      res.redirect(301, customDomainCanonicalRedirectTarget(req, host, itemRequest.canonicalPath));
      return true;
    }
    await attributeProfileVisit("custom_domain_item");
    if (await renderProfileOnCustomDomain(req, res, host, slug, itemRequest)) return true;
    sendPublicPageRenderFailure(res, "Unable to render profile item");
    return true;
  }

  if (categoryRequest.kind === "category") {
    if (categoryRequest.source === "legacy-query") {
      res.redirect(
        301,
        customDomainCanonicalRedirectTarget(req, host, categoryRequest.canonicalPath)
      );
      return true;
    }
    await attributeProfileVisit("custom_domain_category");
    if (await renderProfileOnCustomDomain(req, res, host, slug, null, categoryRequest)) {
      return true;
    }
    sendPublicPageRenderFailure(res, "Unable to render profile category");
    return true;
  }

  if (path === "/" || path === "") {
    // The affiliate referral system otherwise never sees this request at all
    // -- this middleware runs ahead of the route stack it normally lives in
    // (server/routes.ts), and short-circuits the response before reaching
    // it. A clean visit still attributes to the profile's own owner, and an
    // explicit ?ref=... (e.g. from a share link) is still honored.
    await attributeProfileVisit("custom_domain_clean");
    if (await renderProfileOnCustomDomain(req, res, host, slug)) return true;
    sendPublicPageRenderFailure(res, "Unable to render profile");
    return true;
  }
  if (path === "/robots.txt") {
    res
      .type("text/plain")
      .send(
        `User-agent: *\nAllow: /\nAllow: /llms.txt\nDisallow: /api/\nDisallow: /admin/\nDisallow: /dashboard/\nDisallow: /scout/\nDisallow: /messages/\nDisallow: /settings/\nDisallow: /auth/\n\nSitemap: https://${host}/sitemap.xml\n`
      );
    return true;
  }
  if (path === "/sitemap.xml") {
    const sitemap =
      slug.trim().toLowerCase() === JW_STONE_PROFILE_SLUG
        ? buildJwStoneMarketplaceSitemapXml(`https://${host}`)
        : await buildPublicProfileSitemapXml({
            slug,
            origin: `https://${host}`,
          });
    if (!sitemap) return false;
    res.type("application/xml").send(sitemap);
    return true;
  }
  if (path === "/llms.txt") {
    const guidance =
      slug.trim().toLowerCase() === JW_STONE_PROFILE_SLUG
        ? buildJwStoneMarketplaceLlmsText(`https://${host}`)
        : await buildPublicProfileLlmsText({
            slug,
            origin: `https://${host}`,
          });
    if (!guidance) return false;
    res.type("text/plain").send(guidance);
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
      host === "thetradescout.com" ||
      host === CANONICAL_WEB_HOST ||
      host === "tradescoutai.onrender.com" ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return next();
    }

    const now = Date.now();
    const shouldRevalidateProfileDomain = isCustomDomainAuthorityRequest(req);
    // Root profile requests carry attribution and public identity. Re-resolve
    // them on every request so a disconnected or reassigned domain cannot keep
    // serving (or crediting) the cached owner for up to an hour.
    if (shouldRevalidateProfileDomain) CUSTOM_DOMAIN_CACHE.delete(host);
    const cached = shouldRevalidateProfileDomain ? undefined : CUSTOM_DOMAIN_CACHE.get(host);
    if (cached && now - cached.at < CUSTOM_DOMAIN_TTL_MS) {
      if (cached.kind === "profile") {
        markMappedProfileDomainRequest(req, host, cached.slug);
        if (await serveCustomDomainProfilePath(req, res, host, cached.slug, cached.ownerUserId))
          return;
        if (redirectUnhandledCustomProfilePath(req, res, host, cached.slug)) return;
        return next();
      }

      if (cached.kind === "business") {
        const path = req.path || "/";
        if (path === "/" || path === "") {
          return res.redirect(
            301,
            `https://${CANONICAL_WEB_HOST}/business/${encodeURIComponent(cached.slug)}${requestSearchSuffix(req)}`
          );
        }
        if (redirectPublicRequestToPlatform(req, res)) return;
        return next();
      }

      const targetHost = CANONICAL_WEB_HOST;
      const url = new URL(`https://${targetHost}${req.originalUrl || "/"}`);
      if (!url.searchParams.has("ref")) url.searchParams.set("ref", cached.ref);
      return res.redirect(301, url.toString());
    }

    // Profile custom domains are defined in profile seoMeta.customDomain. The
    // configured host is canonical, while its apex/www counterpart is accepted
    // only as a redirect alias. Exact matches win, and duplicate matches fail
    // closed instead of routing a host to an arbitrary profile.
    const alternateHost = alternateCustomDomainHost(host);
    const exactProfileDomains = await db
      .select({
        slug: profiles.slug,
        ownerUserId: profiles.ownerUserId,
        configuredHost: sql<string>`lower(COALESCE((${profiles.seoMeta} ->> 'customDomain'), ''))`,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .where(
        and(
          eq(profiles.status, "published" as any),
          sql`(
            lower(COALESCE((${users.preferences} ->> 'profileVisibility'), 'private')) = 'public'
            OR COALESCE(${users.preferences} -> 'publicProfileIds', '[]'::jsonb)
               @> jsonb_build_array(CAST(${profiles.id} AS text))
          )`,
          sql`lower(COALESCE((${profiles.seoMeta} ->> 'customDomain'), '')) = ${host}`
        )
      )
      .limit(2);
    // An exact profile-domain collision is unsafe to resolve by row order.
    if (exactProfileDomains.length > 1) {
      sendPublicPageNotFound(res, "Profile domain unavailable");
      return;
    }
    const profileDomain = exactProfileDomains.length === 1 ? exactProfileDomains[0] : undefined;
    const aliasProfileDomains =
      exactProfileDomains.length === 0
        ? await db
            .select({
              slug: profiles.slug,
              ownerUserId: profiles.ownerUserId,
              configuredHost: sql<string>`lower(COALESCE((${profiles.seoMeta} ->> 'customDomain'), ''))`,
            })
            .from(profiles)
            .innerJoin(users, eq(profiles.ownerUserId, users.id))
            .where(
              and(
                eq(profiles.status, "published" as any),
                sql`(
                  lower(COALESCE((${users.preferences} ->> 'profileVisibility'), 'private')) = 'public'
                  OR COALESCE(${users.preferences} -> 'publicProfileIds', '[]'::jsonb)
                     @> jsonb_build_array(CAST(${profiles.id} AS text))
                )`,
                sql`lower(COALESCE((${profiles.seoMeta} ->> 'customDomain'), '')) = ${alternateHost}`
              )
            )
            .limit(2)
        : [];
    const aliasProfileDomain =
      aliasProfileDomains.length === 1 ? aliasProfileDomains[0] : undefined;

    const profileSlug = typeof profileDomain?.slug === "string" ? profileDomain.slug.trim() : "";
    const publicProfileDomain = profileSlug
      ? await storage.getProfileBySlugPublic(profileSlug)
      : undefined;
    if (profileSlug && publicProfileDomain) {
      const ownerUserId = String(profileDomain?.ownerUserId || "");
      markMappedProfileDomainRequest(req, host, profileSlug);
      CUSTOM_DOMAIN_CACHE.set(host, { kind: "profile", slug: profileSlug, ownerUserId, at: now });
      if (await serveCustomDomainProfilePath(req, res, host, profileSlug, ownerUserId)) return;
      if (redirectUnhandledCustomProfilePath(req, res, host, profileSlug)) return;
      return next();
    }

    const [businessDomain] = await db
      .select({ slug: users.businessSlug })
      .from(users)
      .where(
        and(
          sql`${users.businessSlug} IS NOT NULL`,
          or(
            eq(users.verifiedBadge, true),
            sql`lower(COALESCE(${users.verificationStatus}, '')) = 'approved'`
          ),
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
          `https://${CANONICAL_WEB_HOST}/business/${encodeURIComponent(businessSlug)}${requestSearchSuffix(req)}`
        );
      }
      if (redirectPublicRequestToPlatform(req, res)) return;
      return next();
    }

    const [account] = await db
      .select({ referralCode: affiliateAccounts.referralCode })
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.customDomain, host))
      .limit(1);

    const ref = typeof account?.referralCode === "string" ? account.referralCode.trim() : "";
    if (ref) {
      CUSTOM_DOMAIN_CACHE.set(host, { kind: "affiliate", ref, at: now });

      const targetHost = CANONICAL_WEB_HOST;
      const url = new URL(`https://${targetHost}${req.originalUrl || "/"}`);
      if (!url.searchParams.has("ref")) url.searchParams.set("ref", ref);
      return res.redirect(301, url.toString());
    }

    // Only use the apex/www counterpart after proving this exact host is not
    // configured for a profile, business, or affiliate. That prevents an alias
    // from taking precedence over another surface's explicit domain claim.
    const aliasProfileSlug =
      typeof aliasProfileDomain?.slug === "string" ? aliasProfileDomain.slug.trim() : "";
    const aliasCanonicalHost = String(aliasProfileDomain?.configuredHost || "").trim();
    const publicAliasProfile = aliasProfileSlug
      ? await storage.getProfileBySlugPublic(aliasProfileSlug)
      : undefined;
    if (aliasProfileSlug && aliasCanonicalHost && publicAliasProfile) {
      return redirectToCanonicalCustomDomain(req, res, aliasCanonicalHost);
    }

    if (redirectPublicRequestToPlatform(req, res)) return;
    return next();
  } catch {
    if (redirectPublicRequestToPlatform(req, res)) return;
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

function corsOptionsForRequest(req: Request): cors.CorsOptions {
  return {
    origin: (origin, callback) => {
      // No origin (curl/server-side) → allow
      if (!origin) return callback(null, true);
      const normalized = origin.toLowerCase();

      // Custom domains are not a global allowlist. A browser may call the API
      // only when its HTTP(S) Origin exactly matches the current request origin,
      // including non-default port semantics.
      if (isMappedProfileDomainSameOrigin(req, origin)) {
        return callback(null, true);
      }

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

      // Static/PWA resources are public bytes, not cross-origin authority.
      // Let them respond without CORS headers instead of converting an otherwise
      // valid GET/HEAD into HTTP 500. API and auth requests still fail closed.
      if (isCorsNeutralPublicAssetRequest(req.method, req.path)) {
        return callback(null, false);
      }
      return callback(new Error(`CORS: Origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
    exposedHeaders: ["Content-Length", "ETag"],
  };
}

const corsOptionsDelegate: cors.CorsOptionsDelegate<Request> = (req, callback) => {
  callback(null, corsOptionsForRequest(req));
};

// Always vary by Origin
app.use((_, res, next) => {
  res.header("Vary", "Origin");
  next();
});

// Apply CORS before routes
app.use(cors(corsOptionsDelegate));
// Preflight handler
app.options("*", cors(corsOptionsDelegate));

// Core body parsing – MUST come before any API routes
const bodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
app.use(express.json({ limit: bodyLimit, verify: preserveStripeWebhookRawBody }));
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
    const shouldRunRelease399Recovery = runtimeMigrationMode === "repair-release-399";

    if (shouldRunRelease399Recovery) {
      await runRelease399MigrationLedgerRecovery({
        log: (msg) => log(msg, "RuntimeMigrations"),
      });
    } else if (shouldRunBootMigrations) {
      try {
        await runRuntimeMigrations({
          log: (msg) => log(msg, "RuntimeMigrations"),
        });
      } catch (err) {
        if (err instanceof HistoricalMigrationReplayRefusedError) throw err;
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

    try {
      await ensureTrustLedgerEventsTable();
    } catch (err) {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: ensureTrustLedgerEventsTable failed in production:", err);
        throw err;
      }
      console.warn(
        "[DEV] ensureTrustLedgerEventsTable failed; continuing without trust ledger:",
        (err as Error)?.message
      );
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
    // Best-effort content seeding: a bug in any one profile's provisioner
    // must never crash the whole server, since none of these are
    // auth/security-critical (unlike ensureMasterAdmin/ensureTrustLedgerEventsTable
    // above). This is what a "seller" enum-value bug in the Moulding & Millwork
    // provisioner previously took the entire production server down on.
    const provisionProfile = async (label: string, provision: () => Promise<void>) => {
      try {
        await provision();
      } catch (err) {
        console.error(`[Bootstrap] ${label} profile provisioning failed (non-fatal):`, err);
      }
    };
    await provisionProfile("JR's Auto Glass", provisionJrsAutoGlassProfile);
    await provisionProfile("LA Plumbing", provisionLaPlumbingProfile);
    await provisionProfile("ISSA Build", provisionIssaBuildProfile);
    await provisionProfile("ProFab", provisionProFabProfile);
    await provisionProfile("Precision Aerial", provisionPrecisionAerialProfile);
    await provisionProfile("Moulding & Millwork Supply", provisionMouldingMillworkProfile);
    await provisionProfile("Steel Home Project Tools", provisionSteelHomePackagesProfile);
    // Read-only integrity preflight. A failed check leaves only its Stone/profile/BidRock
    // route scope fail-closed; unrelated application surfaces may still start.
    try {
      await runSchemaPreflight();
    } catch (err) {
      console.error("[SchemaPreflight] Failed during startup (non-fatal):", err);
    }
    if (isProductionEnv) {
      try {
        const snapshot = await getJwStonePricingSnapshot({ forceRefresh: true });
        console.log("[JW Stone pricing] Canonical Drive source verified", {
          priceRows: snapshot.prices.length,
          sourceUpdatedAt: snapshot.sourceUpdatedAt,
        });
      } catch (err) {
        console.error("[JW Stone pricing] Canonical Drive source unavailable", {
          message: err instanceof Error ? err.message : "Unknown Drive pricing source error",
        });
      }
    }
    // NOTE: Ensure 'routes' is imported or defined before this point if 'registerRoutes' uses it directly.
    // If 'routes' is not implicitly available, it needs to be imported.
    // For this example, assuming 'routes' is handled within 'registerRoutes' or imported elsewhere.
    registerPublicProfileAppRoutes(app);
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
                      // A plain string-literal specifier here is statically
                      // analyzable, so esbuild inlines ./vite.ts (and the
                      // real `vite` package it imports) straight into the
                      // production bundle. That crashes Node at module-load
                      // time -- before this branch would ever run -- because
                      // the Docker image prunes devDependencies (including
                      // vite) after building. Concatenating the specifier
                      // hides it from esbuild's static import analysis, so
                      // this stays a genuine runtime-only import that's
                      // simply never reached when NODE_ENV=production.
                      const viteModuleSpecifier = "./" + "vite";
                      const { setupVite } = await import(viteModuleSpecifier);
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
                // Vite's preload dependency map contains "assets/<file>" values.
                // Browsers run Vite's helper and request "/assets/<file>", while
                // static JS crawlers can resolve the raw value relative to the
                // entry chunk and request "/assets/assets/<file>". Permanently
                // canonicalize only an existing hashed build artifact.
                app.get("/assets/assets/:assetName", (req, res, next) => {
                  const canonicalAssetPath = resolveCanonicalDuplicatedAssetPath(
                    publicDistPath,
                    req.path || ""
                  );
                  if (!canonicalAssetPath) return next();

                  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                  res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
                  res.setHeader("Surrogate-Control", "public, max-age=31536000, immutable");
                  res.setHeader("X-TradeScout-Asset-Recovery", "duplicate-prefix-canonical");
                  return res.redirect(308, canonicalAssetPath);
                });

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

                // A tab left open across a deploy can still request the prior
                // entry CSS hash. Serve the current entry stylesheet for that
                // narrow case so custom domains do not render unstyled. Never
                // substitute arbitrary JS chunks: their module graph may differ.
                app.get("/assets/:assetName", (req, res, next) => {
                  const currentStylesheet = resolveCurrentEntryStylesheet(
                    publicDistPath,
                    req.path || ""
                  );
                  if (!currentStylesheet) return next();

                  res.setHeader("Cache-Control", "no-store");
                  res.setHeader("CDN-Cache-Control", "no-store");
                  res.setHeader("Surrogate-Control", "no-store");
                  res.setHeader("X-TradeScout-Asset-Recovery", "current-entry-css");
                  res.type("text/css");
                  return res.sendFile(currentStylesheet);
                });
              }

              // Release A keeps every duplicate file while canonicalizing exact public aliases.
              // This must remain before identity and general static serving.
              registerPublicShellAliasRoutes(app);

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
                res.redirect(301, "/tradescout-social-preview.png?v=12");
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
                    const requestPath = (req.path || "/").replace(/\/+$/, "") || "/";
                    if (requestPath === "/landing" || requestPath === "/lp") {
                      return res.redirect(301, `/${requestSearchSuffix(req)}`);
                    }
                    if (requestPath.startsWith("/lp/")) {
                      return res.redirect(
                        301,
                        `${requestPath.replace(/^\/lp\//, "/landing/")}${requestSearchSuffix(req)}`
                      );
                    }

                    const landingPath = path.join(publicDistPath, "landing.html");
                    const templateHtml = getCachedTemplate(landingPath);
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

              app.get("/jw-stone", async (req, res) => {
                const origin = resolvePublicOrigin(req);
                const legacyStone =
                  typeof req.query.stone === "string" ? req.query.stone.trim().toLowerCase() : "";
                if (legacyStone) {
                  const photoParam =
                    typeof req.query.photo === "string" && /^\d+$/.test(req.query.photo)
                      ? `?photo=${req.query.photo}`
                      : "";
                  return res.redirect(
                    301,
                    `${origin}/u/${JW_STONE_PROFILE_SLUG}/stones/${encodeURIComponent(
                      legacyStone
                    )}${photoParam}`
                  );
                }
                const legacyCategory =
                  typeof req.query.category === "string"
                    ? req.query.category.trim().toLowerCase()
                    : "";
                if (legacyCategory) {
                  return res.redirect(
                    301,
                    `${origin}/u/${JW_STONE_PROFILE_SLUG}/materials/${encodeURIComponent(
                      legacyCategory
                    )}`
                  );
                }
                return res.redirect(301, `${origin}/u/${JW_STONE_PROFILE_SLUG}`);
              });
              app.get("/jw-stone/stones/:stoneSlug", async (req, res) =>
                res.redirect(
                  301,
                  `${resolvePublicOrigin(req)}/u/${JW_STONE_PROFILE_SLUG}/stones/${encodeURIComponent(
                    String(req.params.stoneSlug || "")
                  )}${requestSearchSuffix(req)}`
                )
              );
              app.get("/jw-stone/materials/:materialSlug", async (req, res) =>
                res.redirect(
                  301,
                  `${resolvePublicOrigin(req)}/u/${JW_STONE_PROFILE_SLUG}/materials/${encodeURIComponent(
                    String(req.params.materialSlug || "")
                  )}${requestSearchSuffix(req)}`
                )
              );

              // Public helper profiles: server-rendered metadata lets shared
              // portfolio links advertise the exact work photo before React loads.
              app.get("/helpers/:workerId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(503).send("Application temporarily unavailable");
                  }

                  const html = await buildPublicHelperProfileHtml({
                    workerId: String(req.params.workerId || ""),
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                    portfolioSlug: req.query.portfolio,
                  });

                  if (!html) return res.status(404).send("Helper not found");
                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (error) {
                  console.error("Error rendering public helper profile HTML:", error);
                  res.status(500).send("Failed to render helper profile");
                }
              });

              // Legacy contractor profiles: keep the normal canonical bridge to
              // a richer business profile, while exact project-photo shares retain
              // their own metadata and image preview.
              app.get("/contractors/:slug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const origin = resolvePublicOrigin(req);
                  const result = await buildPublicContractorProfileHtml({
                    slug: String(req.params.slug || ""),
                    origin,
                    templateHtml,
                    gallerySlug: req.query.gallery,
                  });

                  if (!result) return res.status(404).send("Local provider not found");
                  if (result.kind === "redirect") {
                    return res.redirect(301, `${origin}${result.location}`);
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(result.html);
                } catch (error) {
                  console.error("Error rendering public contractor profile HTML:", error);
                  res.status(500).send("Failed to render local provider profile");
                }
              });

              // Public community post detail pages provide a durable share target
              // and advertise the post's first image to social link unfurlers.
              app.get("/community/posts/:postId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const html = await buildPublicCommunityPostHtml({
                    postId: String(req.params.postId || ""),
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Community post not found");

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=86400"
                  );
                  res.send(html);
                } catch (error) {
                  console.error("Error rendering public community post HTML:", error);
                  res.status(500).send("Failed to render community post");
                }
              });

              // Public community groups: only explicitly public, active groups
              // receive server-rendered metadata for social link unfurlers.
              app.get("/group/:id", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return res.status(404).send("Application files not found");
                  }

                  const html = await buildPublicGroupHtml({
                    groupId: String(req.params.id || ""),
                    postId: typeof req.query.post === "string" ? req.query.post : null,
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                  });
                  if (!html) return res.status(404).send("Community group not found");

                  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
                  res.send(html);
                } catch (error) {
                  console.error("Error rendering public community group HTML:", error);
                  res.status(500).send("Failed to render community group");
                }
              });

              // Recover already-shared unscoped stone URLs without guessing.
              // The redirect is allowed only when exactly one public profile
              // owns both the "stones" route name and the requested item.
              app.get("/stones/:itemSlug", async (req, res) => {
                try {
                  const collection = "stones";
                  const candidates = await db
                    .select({
                      profileId: profiles.id,
                      slug: profiles.slug,
                      seoMeta: profiles.seoMeta,
                      contentBlocks: profiles.contentBlocks,
                      businessId: profiles.businessId,
                      profileOwnerUserId: profiles.ownerUserId,
                      ownerVerifiedBadge: users.verifiedBadge,
                      ownerVerificationStatus: users.verificationStatus,
                      ownerEmailVerified: users.emailVerified,
                      ownerProvider: users.provider,
                      ownerPreferences: users.preferences,
                      businessStatus: businesses.status,
                      businessOwnerUserId: businesses.ownerUserId,
                      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
                      businessSources: businesses.sources,
                      businessClaimStatus: businesses.claimStatus,
                      businessProfileData: businesses.profileData,
                    })
                    .from(profiles)
                    .innerJoin(users, eq(profiles.ownerUserId, users.id))
                    .leftJoin(businesses, eq(profiles.businessId, businesses.id))
                    .where(
                      and(
                        eq(profiles.status, "published" as any),
                        sql`EXISTS (
                          SELECT 1
                          FROM jsonb_array_elements(COALESCE(${profiles.contentBlocks}, '[]'::jsonb)) AS block
                          WHERE block ->> 'type' = 'publicDiscovery'
                            AND lower(COALESCE(block -> 'data' -> 'routes' ->> 'inventory', '')) = ${collection}
                        )`
                      )
                    );

                  const matches = candidates
                    .filter((profileRecord) =>
                      canExposePublishedProfilePublicly({
                        profileId: profileRecord.profileId,
                        businessId: profileRecord.businessId,
                        profileSlug: profileRecord.slug,
                        profileStatus: "published",
                        profileOwnerUserId: profileRecord.profileOwnerUserId,
                        ownerVerifiedBadge: profileRecord.ownerVerifiedBadge,
                        ownerVerificationStatus: profileRecord.ownerVerificationStatus,
                        ownerEmailVerified: profileRecord.ownerEmailVerified,
                        ownerProvider: profileRecord.ownerProvider,
                        ownerPreferences: profileRecord.ownerPreferences,
                        businessStatus: profileRecord.businessStatus,
                        businessOwnerUserId: profileRecord.businessOwnerUserId,
                        publicDiscoveryEnabled: profileRecord.publicDiscoveryEnabled,
                        businessSources: profileRecord.businessSources,
                        businessClaimStatus: profileRecord.businessClaimStatus,
                        businessProfileData: profileRecord.businessProfileData,
                      })
                    )
                    .map((profileRecord) => ({
                      profileRecord,
                      itemRequest: resolvePublicProfileItemRequest({
                        profile: profileRecord,
                        pathname: `/${collection}/${String(req.params.itemSlug || "")}`,
                        profileBasePath: "/",
                        photo: req.query.photo,
                      }),
                    }))
                    .filter(
                      (
                        candidate
                      ): candidate is {
                        profileRecord: (typeof candidates)[number];
                        itemRequest: ResolvedPublicProfileItemRequest;
                      } => candidate.itemRequest.kind === "item"
                    );

                  if (matches.length !== 1) {
                    return sendPublicPageNotFound(res, "Profile item not found");
                  }

                  const { profileRecord, itemRequest } = matches[0];
                  const customDomain = profileRecord.seoMeta?.customDomain?.trim().toLowerCase();
                  const destination = buildPublicProfileCanonicalRedirectTarget({
                    origin: customDomain
                      ? `https://${customDomain}`
                      : `https://${CANONICAL_WEB_HOST}`,
                    canonicalPath: customDomain
                      ? itemRequest.canonicalPath
                      : `/u/${encodeURIComponent(profileRecord.slug)}${itemRequest.canonicalPath}`,
                    referral: req.query.ref,
                    request: req.query.request,
                  });
                  if (!destination) {
                    return sendPublicPageNotFound(res, "Profile item not found");
                  }
                  return res.redirect(301, destination);
                } catch (error) {
                  console.error("Error resolving unscoped public profile item:", error);
                  return sendPublicPageRenderFailure(res, "Unable to resolve profile item");
                }
              });

              // Profile-owned item pages use one scoped route on TradeScout
              // and the same suffix on a verified custom domain.
              app.get(
                ["/u/:slug/:collection/:itemSlug", "/p/:slug/:collection/:itemSlug"],
                async (req, res) => {
                  try {
                    const indexPath = path.join(publicDistPath, "index.html");
                    const templateHtml = getCachedTemplate(indexPath);
                    if (!templateHtml) {
                      return res.status(404).send("Application files not found");
                    }

                    const origin = resolvePublicOrigin(req);
                    const slug = String(req.params.slug || "");
                    const profileRecord = await storage.getProfileBySlugPublic(slug);
                    if (!profileRecord) {
                      return sendPublicPageNotFound(res, "Profile not found");
                    }

                    const handledSteelHomeBuilder = await serveSteelHomeBuilderProfileRoute({
                      req,
                      res,
                      slug,
                      collection: req.params.collection,
                      itemSlug: req.params.itemSlug,
                      origin,
                      templateHtml,
                      renderProfileHtml: buildPublicProfileHtml,
                    });
                    if (handledSteelHomeBuilder) return;

                    const requestedBasePath = req.path.startsWith("/p/")
                      ? `/p/${encodeURIComponent(slug)}`
                      : `/u/${encodeURIComponent(slug)}`;
                    const itemRequest = resolvePublicProfileItemRequest({
                      profile: profileRecord,
                      pathname: req.path,
                      profileBasePath: requestedBasePath,
                      photo: req.query.photo,
                    });
                    const categoryRequest = resolvePublicProfileCategoryRequest({
                      profile: profileRecord,
                      pathname: req.path,
                      profileBasePath: requestedBasePath,
                    });
                    if (itemRequest.kind !== "item" && categoryRequest.kind !== "category") {
                      return sendPublicPageNotFound(res, "Profile destination not found");
                    }

                    const destinationSuffix =
                      itemRequest.kind === "item"
                        ? profileItemPathSuffix(itemRequest, requestedBasePath)
                        : categoryRequest.kind === "category"
                          ? profileCategoryPathSuffix(categoryRequest, requestedBasePath)
                          : "";
                    if (!destinationSuffix) {
                      return sendPublicPageNotFound(res, "Profile destination not found");
                    }
                    const customDomain = profileRecord.seoMeta?.customDomain?.trim().toLowerCase();
                    if (customDomain) {
                      const destination = buildPublicProfileCanonicalRedirectTarget({
                        origin: `https://${customDomain}`,
                        canonicalPath: destinationSuffix,
                        referral: req.query.ref,
                        request: req.query.request,
                      });
                      if (!destination) {
                        return sendPublicPageNotFound(res, "Profile destination not found");
                      }
                      return res.redirect(301, destination);
                    }
                    if (req.path.startsWith("/p/")) {
                      const destination = buildPublicProfileCanonicalRedirectTarget({
                        origin,
                        canonicalPath: `/u/${encodeURIComponent(slug)}${destinationSuffix}`,
                        referral: req.query.ref,
                        request: req.query.request,
                      });
                      if (!destination) {
                        return sendPublicPageNotFound(res, "Profile destination not found");
                      }
                      return res.redirect(301, destination);
                    }

                    const html = await buildPublicProfileHtml({
                      slug,
                      origin,
                      templateHtml,
                      itemSlug:
                        itemRequest.kind === "item" && itemRequest.itemType === "inventory"
                          ? itemRequest.itemSlug
                          : undefined,
                      itemPhoto:
                        itemRequest.kind === "item" && itemRequest.itemType === "inventory"
                          ? String(itemRequest.imageIndex + 1)
                          : undefined,
                      gallerySlug:
                        itemRequest.kind === "item" && itemRequest.itemType === "gallery"
                          ? itemRequest.itemSlug
                          : undefined,
                      categorySlug:
                        categoryRequest.kind === "category"
                          ? categoryRequest.categorySlug
                          : undefined,
                    });
                    if (!html) {
                      return sendPublicPageNotFound(res, "Profile destination not found");
                    }

                    res.setHeader(
                      "Cache-Control",
                      "public, max-age=300, stale-while-revalidate=86400"
                    );
                    res.send(html);
                  } catch (error) {
                    console.error("Error rendering public profile item HTML:", error);
                    sendPublicPageRenderFailure(res, "Failed to render profile item");
                  }
                }
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

                  // The old product-only profile is a URL alias, never a second
                  // public profile. Preserve item/photo context while sending
                  // every request to the canonical ISSA Build business profile.
                  if (slug.trim().toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG) {
                    return res.redirect(
                      301,
                      `${origin}/u/${ISSA_BUILD_PROFILE_SLUG}${requestSearchSuffix(req)}`
                    );
                  }

                  // A profile with an active custom-domain mapping is canonically
                  // served there -- send visitors straight to the business's
                  // own domain instead of dual-hosting the same profile under
                  // /u/:slug too.
                  const profileRecord = await storage.getProfileBySlugPublic(slug);
                  if (!profileRecord) {
                    res.setHeader("Cache-Control", "no-store");
                    return res
                      .status(404)
                      .send(buildPublicProfileEarlyHtml({ slug, origin, templateHtml }));
                  }
                  const canonicalProfileBase = `/u/${encodeURIComponent(slug)}`;
                  const itemRequest = resolvePublicProfileItemRequest({
                    profile: profileRecord,
                    pathname: canonicalProfileBase,
                    profileBasePath: canonicalProfileBase,
                    stone: req.query.stone,
                    gallery: req.query.gallery,
                    photo: req.query.photo,
                  });
                  const categoryRequest = resolvePublicProfileCategoryRequest({
                    profile: profileRecord,
                    pathname: canonicalProfileBase,
                    profileBasePath: canonicalProfileBase,
                    category: req.query.category,
                  });
                  if (itemRequest.kind === "invalid-item-route") {
                    return sendPublicPageNotFound(res, "Profile item not found");
                  }
                  if (categoryRequest.kind === "invalid-category-route") {
                    return sendPublicPageNotFound(res, "Profile category not found");
                  }
                  const customDomain = profileRecord?.seoMeta?.customDomain?.trim().toLowerCase();
                  if (itemRequest.kind === "item") {
                    const itemSuffix = profileItemPathSuffix(itemRequest, canonicalProfileBase);
                    const destination = buildPublicProfileCanonicalRedirectTarget({
                      origin: customDomain ? `https://${customDomain}` : origin,
                      canonicalPath: customDomain ? itemSuffix : itemRequest.canonicalPath,
                      referral: req.query.ref,
                      request: req.query.request,
                    });
                    if (!destination) {
                      return sendPublicPageNotFound(res, "Profile item not found");
                    }
                    return res.redirect(301, destination);
                  }
                  if (categoryRequest.kind === "category") {
                    const categorySuffix = profileCategoryPathSuffix(
                      categoryRequest,
                      canonicalProfileBase
                    );
                    const destination = buildPublicProfileCanonicalRedirectTarget({
                      origin: customDomain ? `https://${customDomain}` : origin,
                      canonicalPath: customDomain ? categorySuffix : categoryRequest.canonicalPath,
                      referral: req.query.ref,
                      request: req.query.request,
                    });
                    if (!destination) {
                      return sendPublicPageNotFound(res, "Profile category not found");
                    }
                    return res.redirect(301, destination);
                  }
                  if (customDomain && String(req.query.book || "") !== "1") {
                    return res.redirect(301, `https://${customDomain}/${requestSearchSuffix(req)}`);
                  }

                  // Keep /p/:slug as legacy path but canonicalize to /u/:slug.
                  if (req.path.startsWith("/p/")) {
                    return res.redirect(
                      301,
                      `${origin}/u/${encodeURIComponent(slug)}${requestSearchSuffix(req)}`
                    );
                  }

                  const html = await buildPublicProfileHtml({
                    slug,
                    origin,
                    templateHtml,
                    itemSlug: req.query.stone,
                    itemPhoto: req.query.photo,
                    gallerySlug: req.query.gallery,
                    categorySlug: req.query.category,
                  });

                  if (!html) {
                    res.setHeader("Cache-Control", "no-store");
                    return res
                      .status(404)
                      .send(buildPublicProfileEarlyHtml({ slug, origin, templateHtml }));
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
                  const gallerySlug = normalizeProfileGalleryItemSlug(req.query.gallery);

                  if (slug.trim().toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG) {
                    return res.redirect(
                      301,
                      `${origin}/u/${ISSA_BUILD_PROFILE_SLUG}${requestSearchSuffix(req)}`
                    );
                  }

                  // SEO: if this business has its own published, richer profile site
                  // (/u/:slug), consolidate authority there instead of serving a
                  // competing, self-canonicalized duplicate at /business/:slug.
                  try {
                    const canonicalProfile = await resolveCanonicalBusinessProfileRoute(slug);
                    if (canonicalProfile) {
                      const gallerySearch = gallerySlug
                        ? `?gallery=${encodeURIComponent(gallerySlug)}`
                        : "";
                      return res.redirect(301, `${origin}${canonicalProfile.path}${gallerySearch}`);
                    }
                  } catch (redirectCheckErr) {
                    console.error(
                      "Error checking for linked profile on /business/:slug",
                      redirectCheckErr
                    );
                  }

                  const html = await buildPublicBusinessHtml({
                    slug,
                    origin,
                    templateHtml,
                    gallerySlug,
                  });
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
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

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

                  res.setHeader("Cache-Control", "no-store");
                  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering shared work request HTML:", err);
                  res.status(500).send("Failed to render shared request");
                }
              });

              // Contractor promotions: exact promo image (or provider work-photo fallback)
              // with protected Direct Connect metadata.
              app.get("/promo/:slug", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

                  const html = await buildPublicContractorPromoHtml({
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                    slug: String(req.params.slug || ""),
                  });

                  if (!html) {
                    return sendPublicPageNotFound(res, "Contractor promotion not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=3600"
                  );
                  res.type("html").send(html);
                } catch (err) {
                  console.error("Error rendering contractor promotion page:", err);
                  return sendPublicPageRenderFailure(
                    res,
                    "Failed to render contractor promotion page"
                  );
                }
              });

              // HomeScout property detail pages: exact property photo and protected metadata.
              app.get("/homescout/listings/:listingId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

                  const html = await buildPublicHomeScoutListingHtml({
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                    listingId: String(req.params.listingId || ""),
                  });

                  if (!html) {
                    return sendPublicPageNotFound(res, "HomeScout listing not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering HomeScout listing HTML:", err);
                  return sendPublicPageRenderFailure(
                    res,
                    "Failed to render HomeScout listing page"
                  );
                }
              });

              // HomeScout county pages: resolve a canonical county label before
              // the dynamic social-card upgrader builds the final share image.
              app.get("/homescout/:stateCode/:countyFips", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

                  const html = await buildPublicHomeScoutCountyHtml({
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                    stateCode: String(req.params.stateCode || ""),
                    countyFips: String(req.params.countyFips || ""),
                  });
                  if (!html) {
                    return sendPublicPageNotFound(res, "HomeScout county not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=300, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering HomeScout county HTML:", err);
                  return sendPublicPageRenderFailure(res, "Failed to render HomeScout county page");
                }
              });

              // Handmade product detail pages: exact product photo and metadata for shared links.
              app.get("/handmade/products/:productId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

                  const html = await buildPublicHandmadeProductHtml({
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                    productId: String(req.params.productId || ""),
                  });

                  if (!html) {
                    return sendPublicPageNotFound(res, "Handmade product not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering handmade product HTML:", err);
                  return sendPublicPageRenderFailure(res, "Failed to render handmade product page");
                }
              });

              // Fixed-price profile services: exact service photo and protected-request metadata.
              app.get("/services/:offerId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

                  const html = await buildPublicProfileServiceOfferHtml({
                    origin: resolvePublicOrigin(req),
                    templateHtml,
                    offerId: String(req.params.offerId || ""),
                  });

                  if (!html) {
                    return sendPublicPageNotFound(res, "Service offer not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering profile service offer HTML:", err);
                  return sendPublicPageRenderFailure(res, "Failed to render service page");
                }
              });

              // Exchange listing detail pages: server-rendered HTML with full JSON-LD for SEO
              // MUST be registered BEFORE /exchange/:category to avoid param conflicts
              app.get("/exchange/:category/:listingId", async (req, res) => {
                try {
                  const indexPath = path.join(publicDistPath, "index.html");
                  const templateHtml = getCachedTemplate(indexPath);
                  if (!templateHtml) {
                    return sendPublicPageRenderFailure(res, "Application files not found");
                  }

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
                    return sendPublicPageNotFound(res, "Exchange listing not found");
                  }

                  res.setHeader(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=3600"
                  );
                  res.send(html);
                } catch (err) {
                  console.error("Error rendering exchange listing HTML:", err);
                  return sendPublicPageRenderFailure(res, "Failed to render exchange listing page");
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
                  if (isPrivateAppShellPath(reqPath)) {
                    const templateHtml = getCachedTemplate(indexPath);
                    if (!templateHtml) {
                      return res.status(404).send("Application files not found");
                    }
                    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
                    return res.type("text/html").send(applyPrivateShellNoindex(templateHtml));
                  }
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
