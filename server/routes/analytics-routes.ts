import type { Express, Request, Response } from "express";
import { isStaff } from "../auth";
import { pool } from "../db";
import { storage } from "../storage";

const DEMAND_EVENT_TYPES = [
  "demand.landing_view",
  "demand.cta_click",
  "demand.auth_view",
  "demand.signin_success",
  "demand.create_success",
  "demand.setup_complete",
  "demand.intent_submitted",
] as const;

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

export function registerAnalyticsRoutes(app: Express) {
  // This endpoint is intentionally soft: it should never block UX.
  // Guests are allowed; userId is optional.
  app.post("/api/analytics/shell", async (req: Request, res: Response) => {
    try {
      const user = (req as any)?.user ?? null;
      const userId = user?.id ?? null;
      const contractorId = user?.contractorId ?? null;
      const event = req.body as any;

      console.log("[Analytics][Shell]", { userId, event });

      // Best-effort persistence into the generic events table.
      // This must never throw back to the client.
      try {
        const ipHeader = (req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) as
          | string
          | undefined;
        const ipAddress = ipHeader?.split(",")[0]?.trim() || (req as any).ip || null;
        const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

        const enrichedEvent = {
          ...event,
          ipAddress,
          userAgent,
          userId,
          contractorId,
        };

        const eventType =
          typeof event?.type === "string" && event.type.trim().length > 0
            ? event.type
            : "shell.unknown";

        await storage.logEvent(eventType, enrichedEvent);
      } catch (persistError) {
        console.error("[Analytics][Shell] Failed to persist event", persistError);
      }

      res.status(204).end();
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
}
