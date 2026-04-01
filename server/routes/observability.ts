/**
 * Observability Metrics API
 * Phase 2: Dashboard endpoint for visualizing Phase 1 metrics
 *
 * Purpose:
 * - Expose structured metrics for dashboard consumption
 * - Enable baseline capture (24-72h observation)
 * - Admin-only access (no user-facing exposure)
 *
 * Design:
 * - Read-only (no metric manipulation)
 * - Returns aggregated views for dashboards
 * - Low overhead (in-memory queries only)
 */

import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { events } from "../../shared/schema";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth";
import {
  getJobMetrics,
  getPoolMetrics,
  getHttpMetrics,
  calculateJobDurationPercentiles,
} from "../observability/metrics";
import {
  getActiveAlerts,
  getAlertHistory,
  BASELINES,
  updateBaselines,
  getBaselinesSnapshot,
  recomputeBaselinesFromObservedData,
} from "../observability/alerts";
import { sendInternalServerError } from "../utils/httpErrors";
import { getLisaFeed } from "../services/lisaRuntime";
import { getCrawlerTelemetrySummary } from "../services/crawlerTelemetryService";
import {
  getLiveStreamSnapshot,
  getLiveStreamSnapshotHistory,
  getLiveLaneEvents,
  refreshLiveStreamSnapshot,
} from "../services/liveStreamSnapshotService";
import { getSnapshotStatusSummary } from "../services/snapshotStatusService";

type RecommendedActionEnum =
  | "INCREASE_BUDGET"
  | "DECREASE_BUDGET"
  | "EXPAND_GEO"
  | "NARROW_GEO"
  | "PRIORITIZE_CALLS"
  | "SHIFT_DAYPART"
  | "ROTATE_CREATIVE"
  | "HOLD";

type IntentSignalType = "SPIKE" | "BURST" | "STEADY" | "DROP";

type DigitalDnaIntentRecord = {
  timestamp_utc: string;
  category: string;
  geo: {
    state: string | null;
    county: string | null;
    city: string | null;
  };
  window_minutes: number;
  events: {
    views: number;
    contact_attempts: number;
    repeat_sessions: number;
  };
  velocity: number;
  cluster_strength: number;
  signal_type: IntentSignalType;
  confidence: number;
  freshness_seconds: number;
  recommended_action: RecommendedActionEnum;
  action_payload: {
    google_ads: {
      campaign: string;
      budget_multiplier: number;
      geo_modifier: Record<string, number>;
      call_extension: boolean;
    };
    meta: {
      adset: string;
      budget_multiplier: number;
      radius_miles: number;
      optimize_for: "calls" | "leads" | "traffic";
    };
    radio: {
      daypart_shift: "next_2_hours" | "peak_only" | "hold";
      spots: number;
      message: "call_now_urgency" | "compare_and_book" | "awareness_hold";
    };
  };
};

const digitalDnaCooldownByGeoCategory = new Map<string, number>();

function readEvidenceMap(evidence: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!Array.isArray(evidence)) return map;
  for (const raw of evidence) {
    if (typeof raw !== "string") continue;
    const separator = raw.indexOf("=");
    if (separator <= 0) continue;
    const key = raw.slice(0, separator).trim();
    const value = raw.slice(separator + 1).trim();
    if (!key) continue;
    map[key] = value;
  }
  return map;
}

function toCount(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function toRatio0to1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

function inferCategory(item: any): string | null {
  if (typeof item?.category === "string" && item.category.trim()) {
    return item.category.trim().toLowerCase();
  }
  const text = `${String(item?.title || "")} ${String(item?.narrative || "")}`.toLowerCase();
  const known = [
    "roofing",
    "plumbing",
    "hvac",
    "electrical",
    "home builder",
    "custom home builder",
  ];
  return known.find((candidate) => text.includes(candidate)) || null;
}

function inferCity(item: any, evidence: Record<string, string>): string | null {
  if (typeof evidence.city === "string" && evidence.city.trim()) return evidence.city.trim();
  const match = `${String(item?.title || "")} ${String(item?.narrative || "")}`.match(
    / in ([A-Za-z .'-]+),\s*[A-Z]{2}\b/
  );
  return match?.[1]?.trim() || null;
}

function resolveSignalType(velocityRatio: number): IntentSignalType {
  if (velocityRatio >= 0.6) return "SPIKE";
  if (velocityRatio >= 0.3) return "BURST";
  if (velocityRatio <= -0.2) return "DROP";
  return "STEADY";
}

function resolveRecommendedAction(args: {
  signalType: IntentSignalType;
  contactAttempts: number;
  repeatSessions: number;
  velocity: number;
}): RecommendedActionEnum {
  if (args.signalType === "DROP") {
    return args.contactAttempts === 0 ? "DECREASE_BUDGET" : "ROTATE_CREATIVE";
  }
  if (args.contactAttempts >= 3) return "PRIORITIZE_CALLS";
  if (args.repeatSessions >= 3 && args.velocity >= 0.3) return "EXPAND_GEO";
  if (args.signalType === "SPIKE") return "INCREASE_BUDGET";
  if (args.signalType === "BURST") return "SHIFT_DAYPART";
  return "HOLD";
}

function buildActionPayload(args: {
  category: string;
  geoState: string | null;
  geoCounty: string | null;
  geoCity: string | null;
  recommendedAction: RecommendedActionEnum;
  clusterStrength: number;
  velocity: number;
  signalType: IntentSignalType;
}): DigitalDnaIntentRecord["action_payload"] {
  const stateToken = (args.geoState || "XX").toUpperCase();
  const campaign = `${args.category.replace(/\s+/g, "_")}_${stateToken}`;
  const geoKeyCounty = args.geoCounty || "county";
  const geoKeyCity = args.geoCity || "city";
  const baseMultiplier = 1 + Math.max(0, args.velocity) * 0.6 + args.clusterStrength * 0.3;
  const budgetMultiplier = Number(baseMultiplier.toFixed(2));

  return {
    google_ads: {
      campaign,
      budget_multiplier:
        args.recommendedAction === "DECREASE_BUDGET"
          ? 0.8
          : args.recommendedAction === "HOLD"
            ? 1
            : budgetMultiplier,
      geo_modifier: {
        [geoKeyCounty]: Number((1 + args.clusterStrength * 0.5).toFixed(2)),
        [geoKeyCity]: Number((1 + Math.max(0, args.velocity) * 0.8).toFixed(2)),
      },
      call_extension: args.recommendedAction === "PRIORITIZE_CALLS" || args.signalType === "SPIKE",
    },
    meta: {
      adset: campaign,
      budget_multiplier:
        args.recommendedAction === "DECREASE_BUDGET"
          ? 0.85
          : args.recommendedAction === "HOLD"
            ? 1
            : Number(
                (1 + Math.max(0, args.velocity) * 0.5 + args.clusterStrength * 0.2).toFixed(2)
              ),
      radius_miles: args.recommendedAction === "NARROW_GEO" ? 7 : 10,
      optimize_for: args.recommendedAction === "PRIORITIZE_CALLS" ? "calls" : "leads",
    },
    radio: {
      daypart_shift:
        args.recommendedAction === "SHIFT_DAYPART" || args.signalType === "SPIKE"
          ? "next_2_hours"
          : args.recommendedAction === "HOLD"
            ? "hold"
            : "peak_only",
      spots: args.signalType === "SPIKE" ? 4 : args.signalType === "BURST" ? 2 : 1,
      message:
        args.recommendedAction === "PRIORITIZE_CALLS"
          ? "call_now_urgency"
          : args.signalType === "DROP"
            ? "awareness_hold"
            : "compare_and_book",
    },
  };
}

function mapSnapshotToDigitalDnaRecords(args: {
  snapshot: Awaited<ReturnType<typeof getLiveStreamSnapshot>>;
  windowMinutes: number;
  minEvents: number;
  minVelocityRatio: number;
  minConfidence: number;
  maxFreshnessSeconds: number;
  cooldownMinutes: number;
}): DigitalDnaIntentRecord[] {
  const nowMs = Date.now();

  return (args.snapshot.stream || [])
    .map((item) => {
      const evidence = readEvidenceMap((item as any).evidence);
      const views = toCount(evidence.views || evidence.hits || evidence.category_views);
      const contactAttempts = toCount(
        evidence.contact_attempts || evidence.connection_attempts || evidence.contact_tries
      );
      const repeatSessions = toCount(
        evidence.repeat_sessions || evidence.repeat_visits || evidence.short_window_repeats
      );
      const totalEvents = views + contactAttempts + repeatSessions;

      const velocity = toRatio0to1(Number((item as any).baselineDeltaPct ?? 0));
      const freshnessSeconds = Math.max(
        0,
        Math.floor(
          (nowMs -
            new Date(String((item as any).timestamp || args.snapshot.generatedAt)).getTime()) /
            1000
        )
      );
      const category = inferCategory(item);
      const geoState = (item as any).stateCode || (item as any).state || null;
      const geoCounty = (item as any).countyName || (item as any).county || null;
      const geoCity = inferCity(item, evidence);

      const hasBotOnlySource = ["crawler", "bot_crawl_signals", "crawler_request_events"].includes(
        String((item as any).source || "")
      );
      if (hasBotOnlySource && contactAttempts === 0 && repeatSessions === 0) return null;

      if (!category || !geoState || !geoCounty) return null;
      if (totalEvents < args.minEvents) return null;
      if (velocity < args.minVelocityRatio) return null;
      if (freshnessSeconds > args.maxFreshnessSeconds) return null;

      const clusterStrength = Math.max(
        0,
        Math.min(
          1,
          0.45 * Math.min(1, totalEvents / 20) +
            0.35 * Math.min(1, velocity) +
            0.2 * Math.min(1, (contactAttempts + repeatSessions) / 8)
        )
      );
      const confidence = Math.max(
        0,
        Math.min(
          1,
          0.5 * clusterStrength +
            0.3 * (String((item as any).truthStatus || "") === "current" ? 1 : 0.5) +
            0.2
        )
      );

      if (confidence < args.minConfidence) return null;

      const signalType = resolveSignalType(velocity);
      const recommendedAction = resolveRecommendedAction({
        signalType,
        contactAttempts,
        repeatSessions,
        velocity,
      });

      const cooldownKey = `${category}|${geoState}|${geoCounty}`.toLowerCase();
      const lastSentAtMs = digitalDnaCooldownByGeoCategory.get(cooldownKey) || 0;
      const cooldownWindowMs = args.cooldownMinutes * 60 * 1000;
      if (nowMs - lastSentAtMs < cooldownWindowMs) return null;
      digitalDnaCooldownByGeoCategory.set(cooldownKey, nowMs);

      return {
        timestamp_utc: new Date(nowMs).toISOString(),
        category,
        geo: {
          state: geoState,
          county: geoCounty,
          city: geoCity,
        },
        window_minutes: args.windowMinutes,
        events: {
          views,
          contact_attempts: contactAttempts,
          repeat_sessions: repeatSessions,
        },
        velocity: Number(velocity.toFixed(2)),
        cluster_strength: Number(clusterStrength.toFixed(2)),
        signal_type: signalType,
        confidence: Number(confidence.toFixed(2)),
        freshness_seconds: freshnessSeconds,
        recommended_action: recommendedAction,
        action_payload: buildActionPayload({
          category,
          geoState,
          geoCounty,
          geoCity,
          recommendedAction,
          clusterStrength,
          velocity,
          signalType,
        }),
      };
    })
    .filter((record): record is DigitalDnaIntentRecord => Boolean(record));
}

export const observabilityRouter = Router();
observabilityRouter.use(isAuthenticated, isAdmin);

/**
 * GET /api/admin/observability/summary
 * Returns high-level metrics summary for dashboard overview
 */
observabilityRouter.get("/summary", (req, res) => {
  try {
    const jobNames = ["users_aggregation", "affiliates_aggregation", "trade_deals_aggregation"];
    const jobSummaries = jobNames.map((jobName) => {
      const metrics = getJobMetrics(jobName);
      const percentiles = calculateJobDurationPercentiles(jobName);
      const totalRuns = metrics.length;
      const errorCount = metrics.filter((m) => m.error).length;
      const overlapCount = metrics.filter((m) => m.overlap).length;

      const rowsWritten = metrics
        .filter((m) => m.rowsWritten !== undefined)
        .map((m) => m.rowsWritten!);

      const avgRows =
        rowsWritten.length > 0 ? rowsWritten.reduce((a, b) => a + b, 0) / rowsWritten.length : 0;

      const minRows = rowsWritten.length > 0 ? Math.min(...rowsWritten) : 0;
      const maxRows = rowsWritten.length > 0 ? Math.max(...rowsWritten) : 0;

      return {
        jobName,
        totalRuns,
        errorCount,
        overlapCount,
        duration: percentiles,
        rowsWritten: {
          min: minRows,
          avg: Math.round(avgRows),
          max: maxRows,
        },
      };
    });

    const poolMetrics = getPoolMetrics();
    const latestPool = poolMetrics[poolMetrics.length - 1] || {
      active: 0,
      idle: 0,
      waiting: 0,
    };

    const httpMetrics = getHttpMetrics();

    res.json({
      timestamp: new Date().toISOString(),
      scheduler: jobSummaries,
      dbPool: {
        current: latestPool,
        history: poolMetrics.slice(-20), // Last 20 snapshots
      },
      http: {
        statusClasses: httpMetrics,
        total: Object.values(httpMetrics).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    console.error("Observability summary failed:", error);
    sendInternalServerError(res, "Failed to fetch metrics summary", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/lisa-feed
 * Live natural-language feed of what Scout/TradeScout is producing right now.
 */
observabilityRouter.get("/lisa-feed", async (_req, res) => {
  try {
    res.json(await getLisaFeed());
  } catch (error) {
    console.error("LISA feed query failed:", error);
    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        truthNow: "LISA feed unavailable; showing fallback status.",
        dataProductionSummary: "Primary LISA runtime failed.",
        llmOptimizationSummary: "Fallback mode active until runtime recovers.",
      },
      feed: [],
      runtime: {
        mode: "tradescout_local",
        source: "observability_route_fallback",
      },
      degraded: true,
      error: String(error),
    });
  }
});

observabilityRouter.get("/crawler-telemetry", async (_req, res) => {
  try {
    res.json(await getCrawlerTelemetrySummary());
  } catch (error) {
    console.error("Crawler telemetry query failed:", error);
    sendInternalServerError(res, "Failed to fetch crawler telemetry", { error: String(error) });
  }
});

observabilityRouter.get("/snapshot-status", async (_req, res) => {
  try {
    res.json(await getSnapshotStatusSummary());
  } catch (error) {
    console.error("Snapshot status query failed:", error);
    sendInternalServerError(res, "Failed to fetch snapshot status", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream", async (req, res) => {
  try {
    const mode = String((req.query as any)?.mode || "snapshot")
      .trim()
      .toLowerCase();

    if (mode === "events") {
      res.json(
        await getLiveLaneEvents({
          lane: String((req.query as any)?.lane || ""),
          source: String((req.query as any)?.source || ""),
          stateCode: String((req.query as any)?.stateCode || ""),
          county: String((req.query as any)?.county || ""),
          since: String((req.query as any)?.since || ""),
          cursor: String((req.query as any)?.cursor || ""),
          limit: Number.parseInt(String((req.query as any)?.limit || "250"), 10),
        })
      );
      return;
    }

    res.json(
      await getLiveStreamSnapshot({
        source: String((req.query as any)?.source || ""),
        stateCode: String((req.query as any)?.stateCode || ""),
        county: String((req.query as any)?.county || ""),
        limit: Number.parseInt(String((req.query as any)?.limit || "20"), 10),
      })
    );
  } catch (error) {
    console.error("Live stream query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream/events", async (req, res) => {
  try {
    res.json(
      await getLiveLaneEvents({
        lane: String((req.query as any)?.lane || ""),
        source: String((req.query as any)?.source || ""),
        stateCode: String((req.query as any)?.stateCode || ""),
        county: String((req.query as any)?.county || ""),
        since: String((req.query as any)?.since || ""),
        cursor: String((req.query as any)?.cursor || ""),
        limit: Number.parseInt(String((req.query as any)?.limit || "250"), 10),
      })
    );
  } catch (error) {
    console.error("Live stream events query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream events", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream/intent-batch", async (req, res) => {
  try {
    const windowMinutes = Math.max(
      5,
      Math.min(120, Number.parseInt(String((req.query as any)?.window_minutes || "60"), 10))
    );
    const minEvents = Math.max(
      1,
      Math.min(100, Number.parseInt(String((req.query as any)?.min_events || "5"), 10))
    );
    const minVelocityRatio = Math.max(
      0,
      Math.min(1, Number.parseFloat(String((req.query as any)?.min_velocity_ratio || "0.3")))
    );
    const minConfidence = Math.max(
      0,
      Math.min(1, Number.parseFloat(String((req.query as any)?.min_confidence || "0.7")))
    );
    const maxFreshnessSeconds = Math.max(
      30,
      Math.min(
        3600,
        Number.parseInt(String((req.query as any)?.max_freshness_seconds || "600"), 10)
      )
    );
    const cooldownMinutes = Math.max(
      1,
      Math.min(120, Number.parseInt(String((req.query as any)?.cooldown_minutes || "15"), 10))
    );

    const snapshot = await getLiveStreamSnapshot({
      source: String((req.query as any)?.source || ""),
      stateCode: String((req.query as any)?.stateCode || ""),
      county: String((req.query as any)?.county || ""),
      limit: Number.parseInt(String((req.query as any)?.limit || "50"), 10),
    });

    const records = mapSnapshotToDigitalDnaRecords({
      snapshot,
      windowMinutes,
      minEvents,
      minVelocityRatio,
      minConfidence,
      maxFreshnessSeconds,
      cooldownMinutes,
    });

    res.json({
      generated_at: new Date().toISOString(),
      source: "live_stream_snapshot",
      contract: "digital_dna_v1",
      guardrails: {
        min_events: minEvents,
        min_velocity_ratio: minVelocityRatio,
        min_confidence: minConfidence,
        max_freshness_seconds: maxFreshnessSeconds,
        cooldown_minutes: cooldownMinutes,
      },
      records,
    });
  } catch (error) {
    console.error("Live stream intent batch query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream intent batch", {
      error: String(error),
    });
  }
});

observabilityRouter.get("/live-stream/intent-stream", async (req, res) => {
  const intervalSeconds = Math.max(
    5,
    Math.min(60, Number.parseInt(String((req.query as any)?.interval_seconds || "15"), 10))
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const streamOnce = async () => {
    try {
      const snapshot = await getLiveStreamSnapshot({
        source: String((req.query as any)?.source || ""),
        stateCode: String((req.query as any)?.stateCode || ""),
        county: String((req.query as any)?.county || ""),
        limit: Number.parseInt(String((req.query as any)?.limit || "50"), 10),
      });

      const records = mapSnapshotToDigitalDnaRecords({
        snapshot,
        windowMinutes: Math.max(
          5,
          Math.min(120, Number.parseInt(String((req.query as any)?.window_minutes || "60"), 10))
        ),
        minEvents: Math.max(
          1,
          Math.min(100, Number.parseInt(String((req.query as any)?.min_events || "5"), 10))
        ),
        minVelocityRatio: Math.max(
          0,
          Math.min(1, Number.parseFloat(String((req.query as any)?.min_velocity_ratio || "0.3")))
        ),
        minConfidence: Math.max(
          0,
          Math.min(1, Number.parseFloat(String((req.query as any)?.min_confidence || "0.7")))
        ),
        maxFreshnessSeconds: Math.max(
          30,
          Math.min(
            3600,
            Number.parseInt(String((req.query as any)?.max_freshness_seconds || "600"), 10)
          )
        ),
        cooldownMinutes: Math.max(
          1,
          Math.min(120, Number.parseInt(String((req.query as any)?.cooldown_minutes || "15"), 10))
        ),
      });

      res.write(`event: intent_batch\n`);
      res.write(
        `data: ${JSON.stringify({
          generated_at: new Date().toISOString(),
          contract: "digital_dna_v1",
          records,
        })}\n\n`
      );
    } catch (error) {
      res.write(`event: error\n`);
      res.write(
        `data: ${JSON.stringify({ message: "intent_stream_failed", error: String(error) })}\n\n`
      );
    }
  };

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\n`);
    res.write(`data: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);
  }, 15000);

  const ticker = setInterval(() => {
    void streamOnce();
  }, intervalSeconds * 1000);

  void streamOnce();

  req.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(ticker);
    res.end();
  });
});

observabilityRouter.get("/live-stream/history", async (req, res) => {
  try {
    res.json({
      history: await getLiveStreamSnapshotHistory({
        source: String((req.query as any)?.source || ""),
        stateCode: String((req.query as any)?.stateCode || ""),
        county: String((req.query as any)?.county || ""),
        limit: Number.parseInt(String((req.query as any)?.limit || "10"), 10),
        lookbackDays: Number.parseInt(String((req.query as any)?.lookbackDays || "7"), 10),
      }),
    });
  } catch (error) {
    console.error("Live stream history query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream history", { error: String(error) });
  }
});

observabilityRouter.post("/live-stream/refresh", async (req, res) => {
  try {
    res.json(
      await refreshLiveStreamSnapshot({
        source: String((req.body as any)?.source || (req.query as any)?.source || ""),
        stateCode: String((req.body as any)?.stateCode || (req.query as any)?.stateCode || ""),
        county: String((req.body as any)?.county || (req.query as any)?.county || ""),
        limit: Number.parseInt(
          String((req.body as any)?.limit || (req.query as any)?.limit || "20"),
          10
        ),
      })
    );
  } catch (error) {
    console.error("Live stream refresh failed:", error);
    sendInternalServerError(res, "Failed to refresh live stream", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream/export.csv", async (req, res) => {
  try {
    const toFileToken = (value: unknown, fallback: string) => {
      const normalized = String(value || "").trim();
      if (!normalized) return fallback;
      const safe = normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return safe || fallback;
    };

    const mode = String((req.query as any)?.mode || "snapshot")
      .trim()
      .toLowerCase();

    if (mode === "events") {
      const lane = String((req.query as any)?.lane || "");
      const source = String((req.query as any)?.source || "");
      const stateCode = String((req.query as any)?.stateCode || "");
      const county = String((req.query as any)?.county || "");
      const since = String((req.query as any)?.since || "");
      const cursor = String((req.query as any)?.cursor || "");
      const limit = Number.parseInt(String((req.query as any)?.limit || "250"), 10);

      const stream = await getLiveLaneEvents({
        lane,
        source,
        stateCode,
        county,
        since,
        cursor,
        limit,
      });

      const escapeCsv = (value: unknown) => {
        const normalized = String(value ?? "");
        if (/[",\n]/.test(normalized)) {
          return `"${normalized.replace(/"/g, '""')}"`;
        }
        return normalized;
      };

      const header = [
        "generated_at",
        "lane_filter",
        "source_filter",
        "state_filter",
        "county_filter",
        "since",
        "event_id",
        "occurred_at",
        "lane",
        "source",
        "event_type",
        "state_code",
        "county_name",
        "county_fips",
        "payload_json",
      ];
      const lines = [header.join(",")];
      for (const event of stream.events || []) {
        lines.push(
          [
            stream.generatedAt,
            stream.filters.lane || "",
            stream.filters.source || "",
            stream.filters.stateCode || "",
            stream.filters.county || "",
            stream.filters.since || "",
            event.id,
            event.occurredAt,
            event.lane,
            event.source,
            event.eventType,
            event.stateCode || "",
            event.countyName || "",
            event.countyFips || "",
            JSON.stringify(event.payload || {}),
          ]
            .map(escapeCsv)
            .join(",")
        );
      }

      const suffix = [
        "live-lane-events",
        toFileToken(lane, "all-lanes"),
        toFileToken(source, "all-sources"),
        toFileToken(stateCode, "all-states"),
        toFileToken(county, "all-counties"),
        cursor ? "paged" : "newest",
        new Date().toISOString().slice(0, 10),
      ].join("-");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
      res.status(200).send(`\uFEFF${lines.join("\n")}`);
      return;
    }

    const source = String((req.query as any)?.source || "");
    const stateCode = String((req.query as any)?.stateCode || "");
    const county = String((req.query as any)?.county || "");
    const limit = Number.parseInt(String((req.query as any)?.limit || "20"), 10);

    const snapshot = await getLiveStreamSnapshot({
      source,
      stateCode,
      county,
      limit,
    });

    const header = [
      "generated_at",
      "source_filter",
      "state_filter",
      "county_filter",
      "entry_id",
      "entry_timestamp",
      "kind",
      "priority",
      "title",
      "source",
      "state_code",
      "county_name",
      "narrative",
    ];

    const escapeCsv = (value: unknown) => {
      const normalized = String(value ?? "");
      if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
      }
      return normalized;
    };

    const lines = [header.join(",")];
    for (const item of snapshot.stream || []) {
      lines.push(
        [
          snapshot.generatedAt,
          snapshot.filters.source || "",
          snapshot.filters.stateCode || "",
          snapshot.filters.county || "",
          item.id,
          item.timestamp,
          item.kind,
          item.priority,
          item.title,
          item.source,
          item.stateCode || "",
          item.countyName || "",
          item.narrative,
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    const suffix = [
      "live-stream",
      toFileToken(source, "all-sources"),
      toFileToken(stateCode, "all-states"),
      toFileToken(county, "all-counties"),
      new Date().toISOString().slice(0, 10),
    ].join("-");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
    res.status(200).send(`\uFEFF${lines.join("\n")}`);
  } catch (error) {
    console.error("Live stream export failed:", error);
    sendInternalServerError(res, "Failed to export live stream", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/jobs/:jobName
 * Returns detailed metrics for a specific job
 */
observabilityRouter.get("/jobs/:jobName", (req, res) => {
  try {
    const { jobName } = req.params;
    const metrics = getJobMetrics(jobName);
    const percentiles = calculateJobDurationPercentiles(jobName);

    res.json({
      jobName,
      totalRuns: metrics.length,
      percentiles,
      history: metrics.slice(-50), // Last 50 runs
    });
  } catch (error) {
    console.error("Job metrics query failed:", error);
    sendInternalServerError(res, "Failed to fetch job metrics", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/pool
 * Returns DB pool health metrics
 */
observabilityRouter.get("/pool", (req, res) => {
  try {
    const poolMetrics = getPoolMetrics();

    res.json({
      current: poolMetrics[poolMetrics.length - 1] || null,
      history: poolMetrics.slice(-100), // Last 100 snapshots
    });
  } catch (error) {
    console.error("Pool metrics query failed:", error);
    sendInternalServerError(res, "Failed to fetch pool metrics", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/http
 * Returns HTTP status distribution
 */
observabilityRouter.get("/http", (req, res) => {
  try {
    const httpMetrics = getHttpMetrics();
    const total = Object.values(httpMetrics).reduce((a, b) => a + b, 0);

    res.json({
      statusClasses: httpMetrics,
      total,
      percentages: {
        "2xx": total > 0 ? ((httpMetrics["2xx"] || 0) / total) * 100 : 0,
        "4xx": total > 0 ? ((httpMetrics["4xx"] || 0) / total) * 100 : 0,
        "5xx": total > 0 ? ((httpMetrics["5xx"] || 0) / total) * 100 : 0,
      },
    });
  } catch (error) {
    console.error("HTTP metrics query failed:", error);
    sendInternalServerError(res, "Failed to fetch HTTP metrics", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/health
 * Quick health check endpoint
 */
observabilityRouter.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    phase: "Phase 3: Warn-Level Alerts",
  });
});

/**
 * GET /api/admin/observability/alerts
 * Returns active alerts and recent history
 */
observabilityRouter.get("/alerts", (req, res) => {
  try {
    const activeAlerts = getActiveAlerts();
    const history = getAlertHistory(20); // Last 20 resolved alerts

    res.json({
      active: activeAlerts,
      history,
      total: activeAlerts.length,
    });
  } catch (error) {
    console.error("Alert query failed:", error);
    sendInternalServerError(res, "Failed to fetch alerts", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/baselines
 * Returns current baseline configuration
 */
observabilityRouter.get("/baselines", (req, res) => {
  try {
    res.json(getBaselinesSnapshot());
  } catch (error) {
    console.error("Baseline query failed:", error);
    sendInternalServerError(res, "Failed to fetch baselines", { error: String(error) });
  }
});

/**
 * POST /api/admin/observability/baselines
 * Update baselines after Phase 2 capture
 */
observabilityRouter.post("/baselines", (req, res) => {
  try {
    const newBaselines = req.body;
    updateBaselines(newBaselines);
    res.json({ message: "Baselines updated", baselines: BASELINES });
  } catch (error) {
    console.error("Baseline update failed:", error);
    sendInternalServerError(res, "Failed to update baselines", { error: String(error) });
  }
});

/**
 * POST /api/admin/observability/baselines/recompute
 * Recompute baselines from observed in-memory metrics.
 */
observabilityRouter.post("/baselines/recompute", (req, res) => {
  try {
    const snapshot = recomputeBaselinesFromObservedData();
    res.json({
      message: "Baselines recomputed from observed data",
      ...snapshot,
    });
  } catch (error) {
    console.error("Baseline recompute failed:", error);
    sendInternalServerError(res, "Failed to recompute baselines", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/scout-policy
 * Returns recent Scout policy violation telemetry for admin review.
 */
observabilityRouter.get("/scout-policy", async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalCount, last7dCount] = await Promise.all([
      storage.getEventStats("scout_policy_violation_detected"),
      storage.getEventStats("scout_policy_violation_detected", { from: sevenDaysAgo, to: now }),
    ]);

    const recent = await db
      .select({
        id: events.id,
        createdAt: events.createdAt,
        data: events.data,
      })
      .from(events)
      .where(eq(events.eventType, "scout_policy_violation_detected"))
      .orderBy(desc(events.createdAt))
      .limit(25);

    res.json({
      total: totalCount,
      last7d: last7dCount,
      recent: (recent || []).map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        violationCount: (row.data as any)?.violationCount ?? 0,
        violations: (row.data as any)?.violations ?? [],
        countyCode: (row.data as any)?.countyCode ?? null,
        stateCode: (row.data as any)?.stateCode ?? null,
      })),
    });
  } catch (error) {
    console.error("Scout policy telemetry query failed:", error);
    sendInternalServerError(res, "Failed to fetch scout policy telemetry", {
      error: String(error),
    });
  }
});
