import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import {
  DISCOVERY_LANDING_EVENT,
  PUBLIC_PROFILE_CTA_EVENT,
  PUBLIC_PROFILE_DISCOVERY_EVENT,
  sanitizeDiscoveryLandingEvent,
  sanitizePublicProfileCtaEvent,
  type PublicProfileCtaKind,
} from "@shared/discoveryLanding";
import {
  DISCOVERY_INTERNAL_SEARCH_EVENT,
  sanitizeDiscoveryInternalSearch,
} from "@shared/discoveryObservatory";
import { isStaff } from "../auth";
import { pool } from "../db";
import { storage } from "../storage";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { readPositiveIntegerEnv } from "../utils/rateLimitConfig";
import { resolveAnonymousSessionId } from "../utils/anonymousSession";
import {
  ACQUISITION_ACTIVATION_COMPLETED_EVENT,
  ACQUISITION_REGISTRATION_COMPLETED_EVENT,
  isRecognizedAutomatedAcquisitionRequest,
  stageAcquisitionDiscoverySession,
} from "../services/acquisitionMeasurement";

const DEMAND_EVENT_TYPES = [
  "demand.landing_view",
  "demand.cta_click",
  "demand.auth_view",
  "demand.signin_success",
  "demand.create_success",
  "demand.setup_complete",
  "demand.intent_submitted",
] as const;

const PRODUCT_KPI_EVENT_TYPES = [
  "first_use_guidance_viewed",
  "first_use_launcher_viewed",
  "first_use_option_clicked",
  "first_use_task_prompt_clicked",
  "homeid_started",
  "homeid_first_detail_added",
  "homeid_component_added",
  "homeid_evidence_added",
  "homeid_request_packet_created",
  "homeid_request_packet_ready",
  "homeid_direct_connect_draft_created",
  "homeid_direct_connect_request_submitted",
  "direct_connect_request_started",
  "direct_connect_request_review_opened",
  "direct_connect_homeid_link_selected",
  "direct_connect_home_record_prompt_viewed",
  "direct_connect_home_record_link_selected",
  "direct_connect_home_record_create_selected",
  "direct_connect_home_record_skipped",
  "direct_connect_request_submitted_after_home_record_skip",
  "direct_connect_request_submitted",
  "direct_connect_visible_to_contractors",
  "direct_connect_request_visible_to_contractors",
  "direct_connect_contractor_action_started",
  "direct_connect_requester_reply_viewed",
  "direct_connect_homeid_created_from_request",
  "direct_connect_homeid_updated_from_request",
  "scout_homeid_context_viewed",
  "scout_homeid_action_card_clicked",
] as const;

const PENSACOLA_COUNTY_FIPS = "12033";

const DIRECT_CONNECT_SAFE_EVENT_KEYS = new Set([
  "type",
  "surface",
  "userState",
  "viewport",
  "deviceType",
  "source",
  "homeId",
  "requestId",
  "packetId",
  "componentType",
  "category",
  "field",
  "hasBudget",
  "attachmentCount",
  "dispatchMode",
  "dispatchCount",
  "directTargets",
  "visibleContractorCount",
  "assignmentId",
  "decision",
  "responderType",
  "homeContextIntent",
  "replyCount",
  "entry",
  "section",
  "fromSection",
  "toSection",
  "reason",
  "openRequestCount",
  "isAuthenticated",
  "hasCountyFips",
  "ts",
  "ipAddress",
  "userAgent",
  "userId",
  "contractorId",
]);

// --- Direct Connect conversion-integrity lane ---------------------------
// A deliberately narrower lane than DIRECT_CONNECT_SAFE_EVENT_KEYS above:
// funnel stalls, blocked actions, and repeated-action friction, tagged
// severity "high" and reused off the same events table + endpoint. Scope is
// held strictly to Direct Connect conversion integrity -- not a general
// observability pipeline.
export const DIRECT_CONNECT_INTEGRITY_LANE = "direct_connect_conversion_integrity";

export const DIRECT_CONNECT_INTEGRITY_EVENT_NAMES = new Set([
  "direct_connect_integrity_blocked_action",
  "direct_connect_integrity_repeated_click",
  "direct_connect_integrity_repeated_submit",
  "direct_connect_integrity_request_failed",
  // Server-derived only (see server/services/directConnectFunnelIntegrity.ts).
  // Never accepted from a client-submitted payload -- see the eventName +
  // lane check in sanitizeConversionIntegrityEvent below.
  "direct_connect_funnel_step_stalled",
]);

export const SAFE_ERROR_CODES = new Set([
  "network_error",
  "timeout",
  "server_error",
  "validation_failed",
  "auth_required",
  "rate_limited",
  "unknown_error",
]);

const MAX_INTEGRITY_STRING_LENGTH = 200;

function resolveReleaseSha(): string {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    "unknown"
  );
}

/**
 * Strict allowlist for the conversion-integrity lane: builds the persisted
 * payload field-by-field from a fixed vocabulary (eventName, routeTemplate,
 * funnelStep, safeErrorCode, statusCode, blocked, retryCount, clickCount)
 * plus server-attached structural fields. Anything else -- including nested
 * objects -- is discarded, not merged. Returns null for an unknown event
 * name or a client attempt to submit the server-only stall event.
 */
export function sanitizeConversionIntegrityEvent(
  event: Record<string, unknown>,
  identity: { userId: string | null; anonymousSessionId: string | null },
  isServerDerived: boolean
): Record<string, unknown> | null {
  const eventName = typeof event.eventName === "string" ? event.eventName : "";
  if (!DIRECT_CONNECT_INTEGRITY_EVENT_NAMES.has(eventName)) return null;
  if (eventName === "direct_connect_funnel_step_stalled" && !isServerDerived) return null;

  const safe: Record<string, unknown> = { eventName, lane: DIRECT_CONNECT_INTEGRITY_LANE };

  if (typeof event.routeTemplate === "string") {
    safe.routeTemplate = event.routeTemplate.split(/[?#]/)[0].slice(0, MAX_INTEGRITY_STRING_LENGTH);
  }
  if (typeof event.funnelStep === "string") {
    safe.funnelStep = event.funnelStep.slice(0, 80);
  }
  if (typeof event.safeErrorCode === "string" && SAFE_ERROR_CODES.has(event.safeErrorCode)) {
    safe.safeErrorCode = event.safeErrorCode;
  }
  if (
    typeof event.statusCode === "number" &&
    Number.isInteger(event.statusCode) &&
    event.statusCode >= 100 &&
    event.statusCode < 600
  ) {
    safe.statusCode = event.statusCode;
  }
  if (typeof event.blocked === "boolean") {
    safe.blocked = event.blocked;
  }
  if (typeof event.retryCount === "number" && Number.isFinite(event.retryCount)) {
    safe.retryCount = Math.max(0, Math.min(9999, Math.trunc(event.retryCount)));
  }
  if (typeof event.clickCount === "number" && Number.isFinite(event.clickCount)) {
    safe.clickCount = Math.max(0, Math.min(9999, Math.trunc(event.clickCount)));
  }

  safe.severity = "high";
  safe.schema_version = typeof event.schema_version === "number" ? event.schema_version : 1;
  safe.client_build =
    typeof event.client_build === "string"
      ? event.client_build.slice(0, MAX_INTEGRITY_STRING_LENGTH)
      : "unknown";
  safe.release_sha = resolveReleaseSha();
  safe.ts = new Date().toISOString();
  if (identity.userId) safe.userId = identity.userId;
  else if (identity.anonymousSessionId) safe.anonymousSessionId = identity.anonymousSessionId;

  return safe;
}

type DemandEventType = (typeof DEMAND_EVENT_TYPES)[number];

type DemandCounts = {
  landingViews: number;
  ctaClicks: number;
  authViews: number;
  signinSuccess: number;
  createSuccess: number;
  setupComplete: number;
  intentSubmitted: number;
};

const DEMAND_EVENT_TO_KEY: Record<DemandEventType, keyof DemandCounts> = {
  "demand.landing_view": "landingViews",
  "demand.cta_click": "ctaClicks",
  "demand.auth_view": "authViews",
  "demand.signin_success": "signinSuccess",
  "demand.create_success": "createSuccess",
  "demand.setup_complete": "setupComplete",
  "demand.intent_submitted": "intentSubmitted",
};

const emptyDemandCounts = (): DemandCounts => ({
  landingViews: 0,
  ctaClicks: 0,
  authViews: 0,
  signinSuccess: 0,
  createSuccess: 0,
  setupComplete: 0,
  intentSubmitted: 0,
});

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function parseBoundedInt(raw: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function parseDateInput(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveTimeWindow(query: Record<string, unknown>): { from: Date; to: Date } {
  const to = parseDateInput(query.to) ?? new Date();
  const fromFromQuery = parseDateInput(query.from);

  if (fromFromQuery) {
    if (fromFromQuery >= to) {
      const fallback = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: fallback, to };
    }
    return { from: fromFromQuery, to };
  }

  const windowDays = parseBoundedInt(query.windowDays, 30, 1, 365);
  return { from: new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000), to };
}

function resolveHoursWindow(
  query: Record<string, unknown>,
  fallbackHours: number
): { from: Date; to: Date } {
  const to = parseDateInput(query.to) ?? new Date();
  const fromFromQuery = parseDateInput(query.from);

  if (fromFromQuery) {
    if (fromFromQuery >= to) {
      return { from: new Date(to.getTime() - fallbackHours * 60 * 60 * 1000), to };
    }
    return { from: fromFromQuery, to };
  }

  const windowHours = parseBoundedInt(query.windowHours, fallbackHours, 1, 24 * 90);
  return { from: new Date(to.getTime() - windowHours * 60 * 60 * 1000), to };
}

function sanitizeShellAnalyticsEvent(event: Record<string, unknown>): Record<string, unknown> {
  const eventType = typeof event?.type === "string" ? event.type : "";
  if (!eventType.startsWith("direct_connect_")) return event;

  const safeEvent: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (DIRECT_CONNECT_SAFE_EVENT_KEYS.has(key)) {
      safeEvent[key] = value;
    }
  }
  return safeEvent;
}

const MAX_SHELL_EVENT_BYTES = 8192;
const isProductionEnv = process.env.NODE_ENV === "production";
const noopRateLimiter: any = (_req: Request, _res: Response, next: () => void) => next();

function shellAnalyticsRateLimitKey(req: Request): string {
  const userId = (req as any)?.user?.id;
  if (userId) return `u:${userId}`;
  const anonymousSessionId = resolveAnonymousSessionId(req);
  if (anonymousSessionId) return `anon:${anonymousSessionId}`;
  return req.ip || "unknown";
}

// Telemetry must never surface a rate-limit error to the user -- silently
// drop over-limit events rather than responding with 429.
const shellAnalyticsLimiter = isProductionEnv
  ? rateLimit({
      windowMs: 60 * 1000,
      max: readPositiveIntegerEnv("ANALYTICS_SHELL_LIMIT_1M", 120),
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: shellAnalyticsRateLimitKey,
      store: createPostgresRateLimitStore({
        pool,
        prefix: "rl:analytics:shell",
        cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
      }),
      handler: (_req: Request, res: Response) => {
        res.status(204).end();
      },
    })
  : noopRateLimiter;

export function registerAnalyticsRoutes(app: Express) {
  // This endpoint is intentionally soft: it should never block UX.
  // Guests are allowed; userId is optional.
  app.post("/api/analytics/shell", shellAnalyticsLimiter, async (req: Request, res: Response) => {
    try {
      const user = (req as any)?.user ?? null;
      const userId = user?.id ?? null;
      const contractorId = user?.contractorId ?? null;
      const event = (req.body || {}) as Record<string, unknown>;

      const rawSize = Number(req.headers["content-length"]) || JSON.stringify(event).length;
      if (rawSize > MAX_SHELL_EVENT_BYTES) {
        res.status(204).end();
        return;
      }

      // Resolve signed acquisition events before ending the response so the
      // server session can carry verified landing attribution into signup.
      // Raw user-agent is used only to exclude recognized automation.
      let safeDiscoveryLanding: Record<string, unknown> | null = null;
      let safePublicProfileCta: Record<string, unknown> | null = null;
      let duplicateDiscoveryLanding = false;
      let duplicatePublicProfileDiscovery = false;
      let duplicatePublicProfileCta = false;
      const isAcquisitionEvent =
        event?.type === DISCOVERY_LANDING_EVENT || event?.type === PUBLIC_PROFILE_CTA_EVENT;
      if (isAcquisitionEvent && !isRecognizedAutomatedAcquisitionRequest(req)) {
        const verifiedAttribution = verifyDiscoveryAttributionToken(
          event.discoveryAttributionToken
        );
        if (verifiedAttribution && event.type === DISCOVERY_LANDING_EVENT) {
          safeDiscoveryLanding = sanitizeDiscoveryLandingEvent(event, {
            verifiedAttribution,
          });
          if (safeDiscoveryLanding) {
            const dedupe = stageAcquisitionDiscoverySession({
              req,
              discoveryAttributionToken: String(event.discoveryAttributionToken || ""),
              verifiedAttribution,
              safeEvent: safeDiscoveryLanding,
              milestone: "landing",
            });
            duplicateDiscoveryLanding = dedupe.duplicateLanding;
            duplicatePublicProfileDiscovery = dedupe.duplicateProfileDiscovery;
          }
        } else if (verifiedAttribution && event.type === PUBLIC_PROFILE_CTA_EVENT) {
          safePublicProfileCta = sanitizePublicProfileCtaEvent(event, {
            verifiedAttribution,
          });
          if (safePublicProfileCta) {
            const dedupe = stageAcquisitionDiscoverySession({
              req,
              discoveryAttributionToken: String(event.discoveryAttributionToken || ""),
              verifiedAttribution,
              safeEvent: safePublicProfileCta,
              milestone: "cta",
              ctaKind: safePublicProfileCta.ctaKind as PublicProfileCtaKind,
            });
            duplicatePublicProfileCta = dedupe.duplicateCta;
          }
        }
      }

      // Avoid high-volume stdout logging in production.
      // If you need diagnostics, enable sampling via ANALYTICS_SHELL_LOG_SAMPLE_RATE (0..1).
      try {
        const sampleRate = Number(process.env.ANALYTICS_SHELL_LOG_SAMPLE_RATE || 0);
        if (
          Number.isFinite(sampleRate) &&
          sampleRate > 0 &&
          Math.random() < Math.min(1, sampleRate)
        ) {
          console.log("[Analytics][Shell]", {
            userId,
            type: typeof event?.type === "string" ? event.type : null,
            path: typeof (event as any)?.path === "string" ? (event as any).path : null,
          });
        }
      } catch {
        // ignore
      }

      res.status(204).end();

      // Best-effort persistence into the generic events table.
      // Never block UX on analytics writes.
      try {
        const isIntegrityLane = event.lane === DIRECT_CONNECT_INTEGRITY_LANE;

        if (isIntegrityLane) {
          const anonymousSessionId = userId ? null : resolveAnonymousSessionId(req) || null;
          const safeEvent = sanitizeConversionIntegrityEvent(
            event,
            { userId, anonymousSessionId },
            false
          );
          if (safeEvent) {
            void storage.logEvent(String(safeEvent.eventName), safeEvent).catch((persistError) => {
              console.error("[Analytics][Shell] Failed to persist integrity event", persistError);
            });
          }
          return;
        }

        // Public discovery landing: allowlisted, signed, browser-like, and
        // deduped. A business profile landing also produces the distinct
        // profile-discovery milestone from the same verified envelope.
        if (event?.type === DISCOVERY_LANDING_EVENT) {
          if (safeDiscoveryLanding && !duplicateDiscoveryLanding) {
            void storage
              .logEvent(DISCOVERY_LANDING_EVENT, safeDiscoveryLanding)
              .catch((persistError) => {
                console.error(
                  "[Analytics][Shell] Failed to persist discovery_landing",
                  persistError
                );
              });
          }
          if (
            safeDiscoveryLanding &&
            safeDiscoveryLanding.entityType !== "business_marketplace" &&
            !duplicatePublicProfileDiscovery
          ) {
            const profileDiscoveryEvent = {
              ...safeDiscoveryLanding,
              type: PUBLIC_PROFILE_DISCOVERY_EVENT,
            };
            void storage
              .logEvent(PUBLIC_PROFILE_DISCOVERY_EVENT, profileDiscoveryEvent)
              .catch((persistError) => {
                console.error(
                  "[Analytics][Shell] Failed to persist public_profile_discovered",
                  persistError
                );
              });
          }
          return;
        }

        if (event?.type === PUBLIC_PROFILE_CTA_EVENT) {
          if (safePublicProfileCta && !duplicatePublicProfileCta) {
            void storage
              .logEvent(PUBLIC_PROFILE_CTA_EVENT, safePublicProfileCta)
              .catch((persistError) => {
                console.error(
                  "[Analytics][Shell] Failed to persist public_profile_cta",
                  persistError
                );
              });
          }
          return;
        }

        // First-party directory demand. The shared sanitizer rejects contact
        // details and URLs; never enrich this lane with IP or user-agent.
        if (event?.type === DISCOVERY_INTERNAL_SEARCH_EVENT) {
          const safeEvent = sanitizeDiscoveryInternalSearch(event);
          if (safeEvent) {
            void storage
              .logEvent(DISCOVERY_INTERNAL_SEARCH_EVENT, safeEvent)
              .catch((persistError) => {
                console.error(
                  "[Analytics][Shell] Failed to persist discovery_internal_search",
                  persistError
                );
              });
          }
          return;
        }

        const ipHeader = (req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) as
          | string
          | undefined;
        const ipAddress = ipHeader?.split(",")[0]?.trim() || (req as any).ip || null;
        const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

        const enrichedEvent = sanitizeShellAnalyticsEvent({
          ...event,
          ipAddress,
          userAgent,
          userId,
          contractorId,
        });

        const eventType =
          typeof event?.type === "string" && event.type.trim().length > 0
            ? event.type
            : "shell.unknown";

        // Lifecycle projection names are server-reserved. Allowing a browser
        // to write either name could occupy the per-user unique key before the
        // canonical registration/onboarding writer records its projection.
        if (
          eventType === ACQUISITION_REGISTRATION_COMPLETED_EVENT ||
          eventType === ACQUISITION_ACTIVATION_COMPLETED_EVENT ||
          eventType === PUBLIC_PROFILE_DISCOVERY_EVENT
        ) {
          return;
        }

        void storage.logEvent(eventType, enrichedEvent).catch((persistError) => {
          console.error("[Analytics][Shell] Failed to persist event", persistError);
        });
      } catch (persistError) {
        console.error("[Analytics][Shell] Failed to schedule persist", persistError);
      }
    } catch (error) {
      console.error("Error handling shell analytics event", error);
      res.status(204).end();
    }
  });

  // Best-effort affiliate click telemetry.
  app.post("/api/analytics/affiliate-click", async (req: Request, res: Response) => {
    try {
      const user = (req as any)?.user ?? null;
      const userId = user?.id ?? null;
      const event = req.body as any;

      try {
        await storage.logEvent("affiliate.click", {
          ...event,
          userId,
          path: req.path,
          referrer: req.headers["referer"] || req.headers["referrer"] || null,
        });
      } catch (persistError) {
        console.error("[Analytics][AffiliateClick] Failed to persist", persistError);
      }

      return res.status(204).end();
    } catch (error) {
      console.error("Error handling affiliate-click analytics event", error);
      return res.status(204).end();
    }
  });

  // Internal: Scout draft funnel + latency summary
  app.get("/api/analytics/scout-drafts/summary", isStaff, async (req: any, res: Response) => {
    try {
      const now = new Date();
      const windowHoursRaw = req.query.windowHours;
      const parsedWindowHours = typeof windowHoursRaw === "string" ? Number(windowHoursRaw) : NaN;
      const safeWindowHours = Number.isFinite(parsedWindowHours)
        ? Math.min(Math.max(parsedWindowHours, 1), 24 * 30)
        : 72;

      const to = now;
      const from = new Date(to.getTime() - safeWindowHours * 60 * 60 * 1000);
      const summary = await storage.getScoutDraftAnalyticsSummary(from, to);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching Scout draft analytics summary", error);
      res.status(500).json({ message: "Failed to fetch Scout draft analytics summary" });
    }
  });

  // Internal: Outcome confirmation summary across action types
  app.get("/api/analytics/outcomes/summary", isStaff, async (req: any, res: Response) => {
    try {
      const now = new Date();
      const windowHoursRaw = req.query.windowHours;
      const parsedWindowHours = typeof windowHoursRaw === "string" ? Number(windowHoursRaw) : NaN;
      const safeWindowHours = Number.isFinite(parsedWindowHours)
        ? Math.min(Math.max(parsedWindowHours, 1), 24 * 30)
        : 72;

      const to = now;
      const from = new Date(to.getTime() - safeWindowHours * 60 * 60 * 1000);
      const summary = await storage.getOutcomeAnalyticsSummary(from, to);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching outcome analytics summary", error);
      res.status(500).json({ message: "Failed to fetch outcome analytics summary" });
    }
  });

  // Internal: demand engine summary for campaign/landing funnel health.
  app.get("/api/analytics/demand/summary", isStaff, async (req: Request, res: Response) => {
    try {
      const { from, to } = resolveTimeWindow((req.query || {}) as Record<string, unknown>);

      const [countsResult, footprintResult] = await Promise.all([
        pool.query(
          `
            SELECT event_type, COUNT(*)::int AS total
            FROM events
            WHERE event_type = ANY($1::text[])
              AND created_at >= $2
              AND created_at < $3
            GROUP BY event_type
          `,
          [DEMAND_EVENT_TYPES, from, to]
        ),
        pool.query(
          `
            SELECT
              COUNT(DISTINCT COALESCE(data->'attribution'->>'campaignKey', 'unknown'))::int AS campaigns,
              COUNT(DISTINCT COALESCE(data->'attribution'->>'variant', 'default'))::int AS variants
            FROM events
            WHERE event_type = 'demand.landing_view'
              AND created_at >= $1
              AND created_at < $2
          `,
          [from, to]
        ),
      ]);

      const counts = emptyDemandCounts();
      for (const row of countsResult.rows || []) {
        const eventType = String(row.event_type || "") as DemandEventType;
        const key = DEMAND_EVENT_TO_KEY[eventType];
        if (!key) continue;
        counts[key] = toNumber(row.total);
      }

      const footprintRow = footprintResult.rows?.[0] || {};
      const campaignsTracked = toNumber((footprintRow as any).campaigns);
      const variantsTracked = toNumber((footprintRow as any).variants);

      res.json({
        window: { from: from.toISOString(), to: to.toISOString() },
        counts,
        rates: {
          ctaFromLandingPct: pct(counts.ctaClicks, counts.landingViews),
          authFromCtaPct: pct(counts.authViews, counts.ctaClicks),
          setupFromAuthPct: pct(counts.setupComplete, counts.authViews),
          intentFromSetupPct: pct(counts.intentSubmitted, counts.setupComplete),
          intentFromLandingPct: pct(counts.intentSubmitted, counts.landingViews),
        },
        footprint: {
          campaignsTracked,
          variantsTracked,
        },
      });
    } catch (error) {
      console.error("Error fetching demand analytics summary", error);
      res.status(500).json({ message: "Failed to fetch demand analytics summary" });
    }
  });

  // Internal: per-campaign funnel breakdown ordered by landing traffic.
  app.get("/api/analytics/demand/campaigns", isStaff, async (req: Request, res: Response) => {
    try {
      const { from, to } = resolveTimeWindow((req.query || {}) as Record<string, unknown>);
      const limit = parseBoundedInt((req.query as any)?.limit, 25, 1, 200);

      const result = await pool.query(
        `
          SELECT
            COALESCE(data->'attribution'->>'campaignKey', 'unknown') AS campaign_key,
            COALESCE(data->'attribution'->>'variant', 'default') AS variant_key,
            NULLIF(MAX(COALESCE(data->'attribution'->>'utmSource', '')), '') AS utm_source,
            NULLIF(MAX(COALESCE(data->'attribution'->>'ref', '')), '') AS ref_code,
            COUNT(*) FILTER (WHERE event_type = 'demand.landing_view')::int AS landing_views,
            COUNT(*) FILTER (WHERE event_type = 'demand.cta_click')::int AS cta_clicks,
            COUNT(*) FILTER (WHERE event_type = 'demand.auth_view')::int AS auth_views,
            COUNT(*) FILTER (WHERE event_type = 'demand.signin_success')::int AS signin_success,
            COUNT(*) FILTER (WHERE event_type = 'demand.create_success')::int AS create_success,
            COUNT(*) FILTER (WHERE event_type = 'demand.setup_complete')::int AS setup_complete,
            COUNT(*) FILTER (WHERE event_type = 'demand.intent_submitted')::int AS intent_submitted,
            MAX(created_at) AS last_seen_at
          FROM events
          WHERE event_type = ANY($1::text[])
            AND created_at >= $2
            AND created_at < $3
          GROUP BY 1, 2
          ORDER BY landing_views DESC, setup_complete DESC, last_seen_at DESC
          LIMIT $4
        `,
        [DEMAND_EVENT_TYPES, from, to, limit]
      );

      const campaigns = (result.rows || []).map((row: any) => {
        const counts: DemandCounts = {
          landingViews: toNumber(row.landing_views),
          ctaClicks: toNumber(row.cta_clicks),
          authViews: toNumber(row.auth_views),
          signinSuccess: toNumber(row.signin_success),
          createSuccess: toNumber(row.create_success),
          setupComplete: toNumber(row.setup_complete),
          intentSubmitted: toNumber(row.intent_submitted),
        };

        return {
          campaignKey: String(row.campaign_key || "unknown"),
          variant: String(row.variant_key || "default"),
          utmSource: row.utm_source ? String(row.utm_source) : null,
          ref: row.ref_code ? String(row.ref_code) : null,
          counts,
          rates: {
            ctaFromLandingPct: pct(counts.ctaClicks, counts.landingViews),
            authFromCtaPct: pct(counts.authViews, counts.ctaClicks),
            setupFromAuthPct: pct(counts.setupComplete, counts.authViews),
            intentFromSetupPct: pct(counts.intentSubmitted, counts.setupComplete),
          },
          lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
        };
      });

      res.json({
        window: { from: from.toISOString(), to: to.toISOString() },
        campaigns,
      });
    } catch (error) {
      console.error("Error fetching demand analytics campaigns", error);
      res.status(500).json({ message: "Failed to fetch demand analytics campaigns" });
    }
  });

  // Internal: daily trend for demand funnel events.
  app.get("/api/analytics/demand/timeline", isStaff, async (req: Request, res: Response) => {
    try {
      const { from, to } = resolveTimeWindow((req.query || {}) as Record<string, unknown>);
      const campaignKey =
        typeof req.query.campaignKey === "string" && req.query.campaignKey.trim().length > 0
          ? req.query.campaignKey.trim()
          : null;

      const result = await pool.query(
        `
          SELECT
            date_trunc('day', created_at) AS day_bucket,
            event_type,
            COUNT(*)::int AS total
          FROM events
          WHERE event_type = ANY($1::text[])
            AND created_at >= $2
            AND created_at < $3
            AND (
              $4::text IS NULL
              OR COALESCE(data->'attribution'->>'campaignKey', 'unknown') = $4
            )
          GROUP BY 1, 2
          ORDER BY 1 ASC, 2 ASC
        `,
        [DEMAND_EVENT_TYPES, from, to, campaignKey]
      );

      const byDay = new Map<string, DemandCounts>();
      for (const row of result.rows || []) {
        const dayKey = new Date(row.day_bucket).toISOString().slice(0, 10);
        const eventType = String(row.event_type || "") as DemandEventType;
        const key = DEMAND_EVENT_TO_KEY[eventType];
        if (!key) continue;

        const existing = byDay.get(dayKey) || emptyDemandCounts();
        existing[key] = toNumber(row.total);
        byDay.set(dayKey, existing);
      }

      const points = Array.from(byDay.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([day, counts]) => ({ day, counts }));

      res.json({
        window: { from: from.toISOString(), to: to.toISOString() },
        campaignKey,
        points,
      });
    } catch (error) {
      console.error("Error fetching demand analytics timeline", error);
      res.status(500).json({ message: "Failed to fetch demand analytics timeline" });
    }
  });

  // Internal: first-use + core product KPI audit summary.
  app.get("/api/analytics/product-kpi/summary", isStaff, async (req: Request, res: Response) => {
    try {
      const { from, to } = resolveHoursWindow((req.query || {}) as Record<string, unknown>, 24 * 7);

      const [countsResult, breakdownResult] = await Promise.all([
        pool.query(
          `
            SELECT event_type, COUNT(*)::int AS total
            FROM events
            WHERE event_type = ANY($1::text[])
              AND created_at >= $2
              AND created_at < $3
            GROUP BY event_type
            ORDER BY event_type ASC
          `,
          [PRODUCT_KPI_EVENT_TYPES, from, to]
        ),
        pool.query(
          `
            SELECT
              event_type,
              COALESCE(NULLIF(data->>'surface', ''), 'unknown') AS surface,
              COALESCE(NULLIF(data->>'userState', ''), 'unknown') AS user_state,
              COALESCE(NULLIF(data->>'optionId', ''), '') AS option_id,
              COALESCE(NULLIF(data->>'targetRoute', ''), '') AS target_route,
              COALESCE(NULLIF(data->>'componentType', ''), '') AS component_type,
              COALESCE(NULLIF(data->>'actionCardType', ''), '') AS action_card_type,
              COUNT(*)::int AS total
            FROM events
            WHERE event_type = ANY($1::text[])
              AND created_at >= $2
              AND created_at < $3
            GROUP BY 1, 2, 3, 4, 5, 6, 7
            ORDER BY total DESC
            LIMIT 800
          `,
          [PRODUCT_KPI_EVENT_TYPES, from, to]
        ),
      ]);

      const countsByEvent: Record<string, number> = Object.fromEntries(
        PRODUCT_KPI_EVENT_TYPES.map((eventType) => [eventType, 0])
      );
      for (const row of countsResult.rows || []) {
        const eventType = String((row as any).event_type || "");
        const total = toNumber((row as any).total);
        if (eventType in countsByEvent) countsByEvent[eventType] = total;
      }

      const breakdowns = {
        bySurface: {} as Record<string, number>,
        byUserState: {} as Record<string, number>,
        byOptionId: {} as Record<string, number>,
        byTargetRoute: {} as Record<string, number>,
        byComponentType: {} as Record<string, number>,
        byActionCardType: {} as Record<string, number>,
      };

      for (const row of breakdownResult.rows || []) {
        const surface = String((row as any).surface || "unknown").trim() || "unknown";
        const userState = String((row as any).user_state || "unknown").trim() || "unknown";
        const optionId = String((row as any).option_id || "").trim();
        const targetRoute = String((row as any).target_route || "").trim();
        const componentType = String((row as any).component_type || "").trim();
        const actionCardType = String((row as any).action_card_type || "").trim();
        const total = toNumber((row as any).total);

        breakdowns.bySurface[surface] = (breakdowns.bySurface[surface] || 0) + total;
        breakdowns.byUserState[userState] = (breakdowns.byUserState[userState] || 0) + total;
        if (optionId)
          breakdowns.byOptionId[optionId] = (breakdowns.byOptionId[optionId] || 0) + total;
        if (targetRoute)
          breakdowns.byTargetRoute[targetRoute] =
            (breakdowns.byTargetRoute[targetRoute] || 0) + total;
        if (componentType)
          breakdowns.byComponentType[componentType] =
            (breakdowns.byComponentType[componentType] || 0) + total;
        if (actionCardType)
          breakdowns.byActionCardType[actionCardType] =
            (breakdowns.byActionCardType[actionCardType] || 0) + total;
      }

      const totalEvents = Object.values(countsByEvent).reduce((sum, value) => sum + value, 0);

      return res.json({
        window: { from: from.toISOString(), to: to.toISOString() },
        totalEvents,
        countsByEvent,
        breakdowns,
      });
    } catch (error) {
      console.error("Error fetching product KPI summary", error);
      return res.status(500).json({ message: "Failed to fetch product KPI summary" });
    }
  });

  app.get(
    "/api/analytics/pensacola-liquidity/summary",
    isStaff,
    async (req: Request, res: Response) => {
      try {
        const { from, to } = resolveHoursWindow(
          (req.query || {}) as Record<string, unknown>,
          24 * 7
        );

        const [requestCountsResult, providerActionResult, blockerResult, passiveFrictionResult] =
          await Promise.all([
            pool.query(
              `
              WITH pensacola_requests AS (
                SELECT wr.id, wr.status, wr.created_at
                FROM work_requests wr
                WHERE wr.source = 'direct_connect'
                  AND wr.county_fips = $1
                  AND wr.created_at >= $2
                  AND wr.created_at < $3
              ),
              assignment_counts AS (
                SELECT work_request_id, COUNT(*)::int AS assignment_count
                FROM work_request_assignments
                GROUP BY work_request_id
              )
              SELECT
                COUNT(*) FILTER (WHERE status <> 'draft' AND status <> 'cancelled')::int AS route_ready_count,
                COUNT(*) FILTER (
                  WHERE status IN ('routed', 'in_progress', 'pending_outcome', 'completed')
                    OR COALESCE(ac.assignment_count, 0) > 0
                )::int AS contractor_visible_count,
                COUNT(*) FILTER (
                  WHERE status = 'open'
                    AND COALESCE(ac.assignment_count, 0) = 0
                    AND created_at < now() - interval '24 hours'
                )::int AS stalled_no_provider_count,
                COUNT(*) FILTER (WHERE status IN ('draft', 'cancelled'))::int AS not_route_ready_count,
                COUNT(*) FILTER (WHERE status IN ('routed', 'in_progress', 'pending_outcome', 'completed'))::int AS routed_status_count
              FROM pensacola_requests pr
              LEFT JOIN assignment_counts ac ON ac.work_request_id = pr.id
            `,
              [PENSACOLA_COUNTY_FIPS, from, to]
            ),
            pool.query(
              `
              SELECT
                COUNT(DISTINCT wra.work_request_id)::int AS requests_with_provider_action,
                COUNT(*) FILTER (WHERE wra.status IN ('accepted', 'completed'))::int AS provider_action_count,
                COUNT(*) FILTER (WHERE wra.status = 'accepted')::int AS accepted_count,
                COUNT(*) FILTER (WHERE wra.status = 'completed')::int AS completed_count,
                COUNT(*) FILTER (WHERE wra.status = 'declined')::int AS declined_count
              FROM work_request_assignments wra
              INNER JOIN work_requests wr ON wr.id = wra.work_request_id
              WHERE wr.source = 'direct_connect'
                AND wr.county_fips = $1
                AND wr.created_at >= $2
                AND wr.created_at < $3
            `,
              [PENSACOLA_COUNTY_FIPS, from, to]
            ),
            pool.query(
              `
              SELECT
                event_type,
                COUNT(*)::int AS total
              FROM events
              WHERE event_type = ANY($1::text[])
                AND created_at >= $2
                AND created_at < $3
                AND (
                  data->>'countyFips' = $4
                  OR data->>'county' = $4
                  OR data->>'source' ILIKE '%direct-connect%'
                  OR data->>'source' ILIKE '%direct_connect%'
                )
              GROUP BY event_type
            `,
              [
                [
                  "direct_connect_request_submitted",
                  "direct_connect_visible_to_contractors",
                  "direct_connect_request_visible_to_contractors",
                  "direct_connect_contractor_action_started",
                ],
                from,
                to,
                PENSACOLA_COUNTY_FIPS,
              ]
            ),
            pool.query(
              `
              SELECT
                event_type,
                COUNT(*)::int AS total
              FROM events
              WHERE event_type = ANY($1::text[])
                AND created_at >= $2
                AND created_at < $3
                AND (
                  data->>'countyFips' = $4
                  OR data->>'source' ILIKE '%direct-connect%'
                  OR data->>'source' ILIKE '%direct_connect%'
                )
              GROUP BY event_type
            `,
              [
                [
                  "direct_connect_form_validation_blocked",
                  "direct_connect_permission_or_role_blocked",
                  "direct_connect_api_request_failed",
                  "direct_connect_funnel_step_stalled",
                ],
                from,
                to,
                PENSACOLA_COUNTY_FIPS,
              ]
            ),
          ]);

        const requests = (requestCountsResult.rows?.[0] as any) || {};
        const actions = (providerActionResult.rows?.[0] as any) || {};
        const eventCounts = Object.fromEntries(
          (blockerResult.rows || []).map((row: any) => [
            String(row.event_type || ""),
            toInt(row.total),
          ])
        );
        const frictionCounts = Object.fromEntries(
          (passiveFrictionResult.rows || []).map((row: any) => [
            String(row.event_type || ""),
            toInt(row.total),
          ])
        );

        const routeReadyCount = toInt(requests.route_ready_count);
        const contractorVisibleCount = toInt(requests.contractor_visible_count);
        const stalledNoProviderCount = toInt(requests.stalled_no_provider_count);

        return res.json({
          county: {
            countyFips: PENSACOLA_COUNTY_FIPS,
            label: "Pensacola / Escambia County",
            stateCode: "FL",
          },
          window: { from: from.toISOString(), to: to.toISOString() },
          demand: {
            routeReadyCount,
            contractorVisibleCount,
            stalledNoProviderCount,
            notRouteReadyCount: toInt(requests.not_route_ready_count),
            routedStatusCount: toInt(requests.routed_status_count),
            routedToProviderPct:
              routeReadyCount > 0
                ? Number(((contractorVisibleCount / routeReadyCount) * 100).toFixed(2))
                : 0,
            source:
              "Derived from existing work_requests and work_request_assignments where source=direct_connect and county_fips=12033.",
          },
          providerActions: {
            requestsWithProviderAction: toInt(actions.requests_with_provider_action),
            providerActionCount:
              toInt(actions.provider_action_count) +
              toInt(eventCounts.direct_connect_contractor_action_started),
            acceptedCount: toInt(actions.accepted_count),
            completedCount: toInt(actions.completed_count),
            declinedCount: toInt(actions.declined_count),
            eventBackedActionCount: toInt(eventCounts.direct_connect_contractor_action_started),
          },
          eventSignals: {
            submitted: toInt(eventCounts.direct_connect_request_submitted),
            visibleToContractors:
              toInt(eventCounts.direct_connect_visible_to_contractors) +
              toInt(eventCounts.direct_connect_request_visible_to_contractors),
            contractorActionStarted: toInt(eventCounts.direct_connect_contractor_action_started),
          },
          blockers: {
            routeReadiness: toInt(frictionCounts.direct_connect_form_validation_blocked),
            permissionOrRole: toInt(frictionCounts.direct_connect_permission_or_role_blocked),
            apiFailure: toInt(frictionCounts.direct_connect_api_request_failed),
            funnelStalled: toInt(frictionCounts.direct_connect_funnel_step_stalled),
            noAvailableProvider: stalledNoProviderCount,
            contactGate: { supported: false, count: 0 },
            paidRankingInfluence: { supported: false, count: 0 },
            fakeStatus: { supported: false, count: 0 },
          },
        });
      } catch (error) {
        console.error("Error fetching Pensacola liquidity demand summary", error);
        return res
          .status(500)
          .json({ message: "Failed to fetch Pensacola liquidity demand summary" });
      }
    }
  );

  // Internal: progressive exposure shadow-mode distribution (read-only).
  app.get(
    "/api/analytics/progressive-exposure/summary",
    isStaff,
    async (req: Request, res: Response) => {
      try {
        const { from, to } = resolveHoursWindow(
          (req.query || {}) as Record<string, unknown>,
          24 * 7
        );

        const [tierResult, reasonResult, signalResult] = await Promise.all([
          pool.query(
            `
            SELECT
              COALESCE(NULLIF(data->>'tier', ''), 'unknown') AS tier,
              COUNT(*)::int AS total
            FROM events
            WHERE event_type = 'progressive_exposure_shadow'
              AND created_at >= $1
              AND created_at < $2
            GROUP BY 1
            ORDER BY 1 ASC
          `,
            [from, to]
          ),
          pool.query(
            `
            SELECT
              reason,
              COUNT(*)::int AS total
            FROM events e
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(e.data->'reasons') = 'array' THEN e.data->'reasons'
                ELSE '[]'::jsonb
              END
            ) reason(reason)
            WHERE e.event_type = 'progressive_exposure_shadow'
              AND e.created_at >= $1
              AND e.created_at < $2
            GROUP BY 1
            ORDER BY total DESC, reason ASC
            LIMIT 10
          `,
            [from, to]
          ),
          pool.query(
            `
            SELECT
              AVG(CASE WHEN (data->>'accountAgeDays') ~ '^[0-9]+$' THEN (data->>'accountAgeDays')::int END) AS avg_account_age_days,
              AVG(CASE WHEN (data->>'meaningfulActivityCount') ~ '^[0-9]+$' THEN (data->>'meaningfulActivityCount')::int END) AS avg_meaningful_activity_count,
              COUNT(*) FILTER (WHERE (data->>'hasCompletedSetup') = 'true')::int AS setup_complete_count,
              COUNT(*) FILTER (WHERE (data->>'hasVerifiedContact') = 'true')::int AS verified_contact_count,
              COUNT(DISTINCT NULLIF(COALESCE(data->>'userId', ''), ''))::int AS unique_user_count,
              COUNT(DISTINCT NULLIF(COALESCE(data->>'sessionKey', ''), ''))::int AS unique_session_count,
              COUNT(*) FILTER (
                WHERE COALESCE(NULLIF(data->>'sessionKey', ''), '') = ''
              )::int AS missing_session_key_count,
              COUNT(*)::int AS total
            FROM events
            WHERE event_type = 'progressive_exposure_shadow'
              AND created_at >= $1
              AND created_at < $2
          `,
            [from, to]
          ),
        ]);

        const tiers = {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          unknown: 0,
        } as Record<"0" | "1" | "2" | "3" | "unknown", number>;

        for (const row of tierResult.rows || []) {
          const tier = String(row.tier || "unknown");
          const total = toNumber(row.total);
          if (tier === "0" || tier === "1" || tier === "2" || tier === "3") {
            tiers[tier] = total;
          } else {
            tiers.unknown += total;
          }
        }

        const signalRow = (signalResult.rows || [])[0] as any;
        const totalEvents = toNumber(signalRow?.total);
        const setupCompleteCount = toNumber(signalRow?.setup_complete_count);
        const verifiedContactCount = toNumber(signalRow?.verified_contact_count);
        const uniqueUsers = toNumber(signalRow?.unique_user_count);
        const uniqueSessions = toNumber(signalRow?.unique_session_count);
        const missingSessionKeyCount = toNumber(signalRow?.missing_session_key_count);
        const unknownTierPct = pct(toNumber(tiers.unknown), totalEvents);

        const thresholds = {
          minTotalEvents: 100,
          minUniqueUsers: 30,
          maxUnknownTierPct: 5,
          minVerifiedContactPct: 30,
        };

        const status = {
          totalEventsOk: totalEvents >= thresholds.minTotalEvents,
          uniqueUsersOk: uniqueUsers >= thresholds.minUniqueUsers,
          unknownTierOk: unknownTierPct <= thresholds.maxUnknownTierPct,
          verifiedContactOk:
            pct(verifiedContactCount, totalEvents) >= thresholds.minVerifiedContactPct,
        };

        const isReady =
          status.totalEventsOk &&
          status.uniqueUsersOk &&
          status.unknownTierOk &&
          status.verifiedContactOk;

        res.json({
          window: { from: from.toISOString(), to: to.toISOString() },
          totalEvents,
          tiers,
          topReasons: (reasonResult.rows || []).map((row: any) => ({
            reason: String(row.reason || "unknown"),
            count: toNumber(row.total),
          })),
          signals: {
            avgAccountAgeDays: Number(Number(signalRow?.avg_account_age_days || 0).toFixed(2)),
            avgMeaningfulActivityCount: Number(
              Number(signalRow?.avg_meaningful_activity_count || 0).toFixed(2)
            ),
            setupCompletionPct: pct(setupCompleteCount, totalEvents),
            verifiedContactPct: pct(verifiedContactCount, totalEvents),
          },
          quality: {
            uniqueUsers,
            uniqueSessions,
            eventsPerUser: uniqueUsers > 0 ? Number((totalEvents / uniqueUsers).toFixed(2)) : 0,
            eventsPerSession:
              uniqueSessions > 0 ? Number((totalEvents / uniqueSessions).toFixed(2)) : 0,
            missingSessionKeyPct: pct(missingSessionKeyCount, totalEvents),
            unknownTierPct,
          },
          readiness: {
            thresholds,
            status,
            isReady,
          },
        });
      } catch (error) {
        console.error("Error fetching progressive exposure analytics summary", error);
        res.status(500).json({ message: "Failed to fetch progressive exposure analytics summary" });
      }
    }
  );

  // Internal: progressive exposure shadow-mode daily trend by tier (read-only).
  app.get(
    "/api/analytics/progressive-exposure/timeline",
    isStaff,
    async (req: Request, res: Response) => {
      try {
        const { from, to } = resolveHoursWindow(
          (req.query || {}) as Record<string, unknown>,
          24 * 14
        );

        const result = await pool.query(
          `
            SELECT
              date_trunc('day', created_at) AS day_bucket,
              COALESCE(NULLIF(data->>'tier', ''), 'unknown') AS tier,
              COUNT(*)::int AS total
            FROM events
            WHERE event_type = 'progressive_exposure_shadow'
              AND created_at >= $1
              AND created_at < $2
            GROUP BY 1, 2
            ORDER BY 1 ASC, 2 ASC
          `,
          [from, to]
        );

        const byDay = new Map<string, Record<"0" | "1" | "2" | "3" | "unknown", number>>();

        for (const row of result.rows || []) {
          const dayKey = new Date(row.day_bucket).toISOString().slice(0, 10);
          const tier = String(row.tier || "unknown");
          const total = toNumber(row.total);

          const dayTiers = byDay.get(dayKey) || { 0: 0, 1: 0, 2: 0, 3: 0, unknown: 0 };
          if (tier === "0" || tier === "1" || tier === "2" || tier === "3") {
            dayTiers[tier] = total;
          } else {
            dayTiers.unknown += total;
          }

          byDay.set(dayKey, dayTiers);
        }

        const points = Array.from(byDay.entries())
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([day, tiers]) => ({
            day,
            tiers,
            total:
              toNumber(tiers["0"]) +
              toNumber(tiers["1"]) +
              toNumber(tiers["2"]) +
              toNumber(tiers["3"]) +
              toNumber(tiers.unknown),
          }));

        res.json({
          window: { from: from.toISOString(), to: to.toISOString() },
          points,
        });
      } catch (error) {
        console.error("Error fetching progressive exposure analytics timeline", error);
        res
          .status(500)
          .json({ message: "Failed to fetch progressive exposure analytics timeline" });
      }
    }
  );
}
