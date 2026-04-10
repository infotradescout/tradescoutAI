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
import {
  getCrawlerTelemetrySummary,
  getCrawlerIntentHistory,
} from "../services/crawlerTelemetryService";
import {
  buildLiveStreamSnapshot,
  getLiveStreamSnapshot,
  getLiveStreamSnapshotHistory,
  getLiveLaneEvents,
  refreshLiveStreamSnapshot,
  type LiveLaneEvent,
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
  lineage?: {
    pipeline: "event_native" | "snapshot_derived";
    lane: string[];
    actor_types: string[];
    event_families: string[];
    event_count: number;
    window_start_utc: string;
    window_end_utc: string;
    event_ids_sample: string[];
  };
};

const digitalDnaCooldownByGeoCategory = new Map<string, number>();

type IntentParitySample = {
  timestamp_utc: string;
  scope: {
    source: string;
    stateCode: string;
    county: string;
    window_minutes: number;
  };
  event_native_count: number;
  snapshot_derived_count: number;
  overlap_count: number;
  overlap_ratio: number;
};

const intentParitySamples: IntentParitySample[] = [];
const INTENT_PARITY_MAX_SAMPLES = 5000;
let intentAutomationReadyStreak = 0;

type IntentAutomationStatus =
  | "disabled"
  | "collecting_samples"
  | "parity_below_target"
  | "ready_for_event_native_cutover";

type IntentAutomationState = {
  enabled: boolean;
  cutover_active: boolean;
  status: IntentAutomationStatus;
  evaluated_at: string | null;
  last_transition_at: string | null;
  reason: string;
  ready_streak: number;
  config: {
    lookback_hours: number;
    min_samples: number;
    target_overlap: number;
    cutover_ready_streak: number;
    allow_rollback: boolean;
  };
  last_run: {
    triggered_by: string;
    generated_at: string;
    records: number;
    parity_recorded: boolean;
    parity_overlap: number | null;
  } | null;
};

const intentAutomationState: IntentAutomationState = {
  enabled: true,
  cutover_active: false,
  status: "collecting_samples",
  evaluated_at: null,
  last_transition_at: null,
  reason: "automation_not_evaluated",
  ready_streak: 0,
  config: {
    lookback_hours: 24,
    min_samples: 12,
    target_overlap: 0.8,
    cutover_ready_streak: 3,
    allow_rollback: false,
  },
  last_run: null,
};

function parseBooleanEnv(value: unknown, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parseIntentAutomationConfig() {
  const enabled = parseBooleanEnv(process.env.INTENT_AUTOMATION_ENABLED, true);
  const lookbackHours = Math.max(
    1,
    Math.min(168, Number.parseInt(process.env.INTENT_AUTOMATION_LOOKBACK_HOURS || "24", 10))
  );
  const minSamples = Math.max(
    1,
    Math.min(10000, Number.parseInt(process.env.INTENT_AUTOMATION_MIN_SAMPLES || "12", 10))
  );
  const targetOverlap = Math.max(
    0,
    Math.min(1, Number.parseFloat(process.env.INTENT_AUTOMATION_TARGET_OVERLAP || "0.8"))
  );
  const cutoverReadyStreak = Math.max(
    1,
    Math.min(100, Number.parseInt(process.env.INTENT_AUTOMATION_READY_STREAK || "3", 10))
  );
  const allowRollback = parseBooleanEnv(process.env.INTENT_AUTOMATION_ALLOW_ROLLBACK, false);

  return {
    enabled,
    lookbackHours,
    minSamples,
    targetOverlap,
    cutoverReadyStreak,
    allowRollback,
  };
}

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

function parseCategoryFromText(text: string): string | null {
  const normalized = String(text || "").toLowerCase();
  const known = [
    "roofing",
    "plumbing",
    "hvac",
    "electrical",
    "home builder",
    "custom home builder",
  ];
  return known.find((candidate) => normalized.includes(candidate)) || null;
}

function inferEventCategory(event: LiveLaneEvent): string | null {
  const payload = event.payload || {};
  if (typeof payload.intent === "string" && payload.intent.trim()) {
    const parsed = parseCategoryFromText(payload.intent);
    if (parsed) return parsed;
  }
  if (typeof payload.path === "string" && payload.path.trim()) {
    const parsed = parseCategoryFromText(payload.path);
    if (parsed) return parsed;
  }
  if (typeof payload.route === "string" && payload.route.trim()) {
    const parsed = parseCategoryFromText(payload.route);
    if (parsed) return parsed;
  }
  return parseCategoryFromText(`${event.eventType} ${JSON.stringify(payload)}`);
}

function isNoiseSurface(sourceSurface: unknown): boolean {
  const value = String(sourceSurface || "").toLowerCase();
  return ["infra", "crawl_meta", "static_asset", "unknown_public", "other"].includes(value);
}

function isContactIntent(event: LiveLaneEvent): boolean {
  const payload = event.payload || {};
  const text =
    `${String(event.eventType || "")} ${String(payload.intent || "")} ${String(payload.outcome || "")}`.toLowerCase();
  return /(contact|connect|call|quote|book|message|schedule)/.test(text);
}

function resolveEventFamily(event: LiveLaneEvent): string {
  if (event.source === "scout_interactions") {
    return isContactIntent(event) ? "contact_intent" : "service_interest";
  }
  if (event.source === "crawler_request_events") {
    return "machine_discovery";
  }
  if (event.source === "bot_ui_findings") {
    return "authority_gap_detected";
  }
  return "unknown_event_family";
}

function resolveActorType(event: LiveLaneEvent): "human" | "machine" {
  return event.source === "scout_interactions" ? "human" : "machine";
}

function clusterKey(args: {
  category: string;
  state: string;
  county: string;
  city: string | null;
}) {
  return `${args.category}|${args.state}|${args.county}|${args.city || ""}`.toLowerCase();
}

function toMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function buildEventNativeRecords(args: {
  currentEvents: LiveLaneEvent[];
  priorEvents: LiveLaneEvent[];
  windowMinutes: number;
  minEvents: number;
  minVelocityRatio: number;
  minConfidence: number;
  maxFreshnessSeconds: number;
  cooldownMinutes: number;
  nowIso: string;
}): DigitalDnaIntentRecord[] {
  const nowMs = toMs(args.nowIso);
  const windowEndMs = nowMs;
  const windowStartMs = windowEndMs - args.windowMinutes * 60_000;
  const priorStartMs = windowStartMs - args.windowMinutes * 60_000;

  const currentClusters = new Map<
    string,
    {
      category: string;
      state: string;
      county: string;
      city: string | null;
      views: number;
      contactAttempts: number;
      repeatSessionsRaw: number;
      lane: Set<string>;
      actorTypes: Set<string>;
      eventFamilies: Set<string>;
      eventIds: string[];
      newestMs: number;
    }
  >();

  const priorTotals = new Map<string, number>();

  for (const event of args.priorEvents) {
    const category = inferEventCategory(event);
    const state = event.stateCode || "";
    const county = event.countyName || event.countyFips || "";
    if (!category || !state || !county) continue;
    const key = clusterKey({ category, state, county, city: null });
    priorTotals.set(key, (priorTotals.get(key) || 0) + 1);
  }

  for (const event of args.currentEvents) {
    const category = inferEventCategory(event);
    const state = event.stateCode || "";
    const county = event.countyName || event.countyFips || "";
    if (!category || !state || !county) continue;

    const payload = event.payload || {};
    const city =
      typeof payload.city === "string" && payload.city.trim() ? payload.city.trim() : null;
    const key = clusterKey({ category, state, county, city });
    const existing = currentClusters.get(key) || {
      category,
      state,
      county,
      city,
      views: 0,
      contactAttempts: 0,
      repeatSessionsRaw: 0,
      lane: new Set<string>(),
      actorTypes: new Set<string>(),
      eventFamilies: new Set<string>(),
      eventIds: [],
      newestMs: 0,
    };

    const family = resolveEventFamily(event);
    const actorType = resolveActorType(event);
    const eventMs = toMs(event.occurredAt);

    existing.lane.add(event.lane);
    existing.actorTypes.add(actorType);
    existing.eventFamilies.add(family);
    if (existing.eventIds.length < 25) existing.eventIds.push(event.id);
    if (eventMs > existing.newestMs) existing.newestMs = eventMs;

    if (event.source === "crawler_request_events") {
      if (!isNoiseSurface(payload.sourceSurface)) {
        existing.views += 1;
      }
    }

    if (event.source === "scout_interactions") {
      if (isContactIntent(event)) {
        existing.contactAttempts += 1;
      } else {
        existing.repeatSessionsRaw += 1;
      }
    }

    currentClusters.set(key, existing);
  }

  const records: DigitalDnaIntentRecord[] = [];
  for (const [key, cluster] of currentClusters.entries()) {
    const repeatSessions = Math.max(0, cluster.repeatSessionsRaw - 1);
    const totalEvents = cluster.views + cluster.contactAttempts + repeatSessions;
    if (totalEvents < args.minEvents) continue;

    const priorTotal = priorTotals.get(key) || 0;
    const velocityRatio =
      priorTotal > 0 ? (totalEvents - priorTotal) / priorTotal : totalEvents > 0 ? 1 : 0;
    if (velocityRatio < args.minVelocityRatio) continue;

    const freshnessSeconds = Math.max(0, Math.floor((nowMs - cluster.newestMs) / 1000));
    if (freshnessSeconds > args.maxFreshnessSeconds) continue;

    // Never emit machine-only triggers.
    if (cluster.actorTypes.size === 1 && cluster.actorTypes.has("machine")) continue;

    const clusterStrength = Math.max(
      0,
      Math.min(
        1,
        0.5 * Math.min(1, totalEvents / 25) +
          0.3 * Math.min(1, Math.max(0, velocityRatio)) +
          0.2 * Math.min(1, cluster.contactAttempts / 8)
      )
    );
    const confidence = Math.max(
      0,
      Math.min(
        1,
        0.45 * clusterStrength +
          0.25 * (cluster.actorTypes.has("human") ? 1 : 0) +
          0.15 * Math.min(1, cluster.lane.size / 3) +
          0.15
      )
    );
    if (confidence < args.minConfidence) continue;

    const signalType = resolveSignalType(velocityRatio);
    const recommendedAction = resolveRecommendedAction({
      signalType,
      contactAttempts: cluster.contactAttempts,
      repeatSessions,
      velocity: velocityRatio,
    });

    const cooldownKey = `${cluster.category}|${cluster.state}|${cluster.county}`.toLowerCase();
    const lastSentAtMs = digitalDnaCooldownByGeoCategory.get(cooldownKey) || 0;
    const cooldownWindowMs = args.cooldownMinutes * 60 * 1000;
    if (nowMs - lastSentAtMs < cooldownWindowMs) continue;
    digitalDnaCooldownByGeoCategory.set(cooldownKey, nowMs);

    records.push({
      timestamp_utc: args.nowIso,
      category: cluster.category,
      geo: {
        state: cluster.state,
        county: cluster.county,
        city: cluster.city,
      },
      window_minutes: args.windowMinutes,
      events: {
        views: cluster.views,
        contact_attempts: cluster.contactAttempts,
        repeat_sessions: repeatSessions,
      },
      velocity: Number(velocityRatio.toFixed(2)),
      cluster_strength: Number(clusterStrength.toFixed(2)),
      signal_type: signalType,
      confidence: Number(confidence.toFixed(2)),
      freshness_seconds: freshnessSeconds,
      recommended_action: recommendedAction,
      action_payload: buildActionPayload({
        category: cluster.category,
        geoState: cluster.state,
        geoCounty: cluster.county,
        geoCity: cluster.city,
        recommendedAction,
        clusterStrength,
        velocity: velocityRatio,
        signalType,
      }),
      lineage: {
        pipeline: "event_native",
        lane: Array.from(cluster.lane.values()).sort(),
        actor_types: Array.from(cluster.actorTypes.values()).sort(),
        event_families: Array.from(cluster.eventFamilies.values()).sort(),
        event_count: totalEvents,
        window_start_utc: new Date(windowStartMs).toISOString(),
        window_end_utc: new Date(windowEndMs).toISOString(),
        event_ids_sample: cluster.eventIds,
      },
    });
  }

  return records.sort((a, b) => {
    const strengthDelta = b.cluster_strength - a.cluster_strength;
    if (strengthDelta !== 0) return strengthDelta;
    return b.velocity - a.velocity;
  });
}

function buildParitySummary(
  eventNative: DigitalDnaIntentRecord[],
  snapshotDerived: DigitalDnaIntentRecord[]
) {
  const eventKeys = new Set(
    eventNative.map((record) =>
      `${record.category}|${record.geo.state}|${record.geo.county}`.toLowerCase()
    )
  );
  const snapshotKeys = new Set(
    snapshotDerived.map((record) =>
      `${record.category}|${record.geo.state}|${record.geo.county}`.toLowerCase()
    )
  );
  const overlap = Array.from(eventKeys).filter((key) => snapshotKeys.has(key)).length;
  return {
    event_native_count: eventNative.length,
    snapshot_derived_count: snapshotDerived.length,
    overlap_count: overlap,
    overlap_ratio: eventKeys.size > 0 ? Number((overlap / eventKeys.size).toFixed(2)) : 0,
  };
}

function recordIntentParitySample(sample: IntentParitySample): void {
  intentParitySamples.push(sample);
  if (intentParitySamples.length > INTENT_PARITY_MAX_SAMPLES) {
    intentParitySamples.splice(0, intentParitySamples.length - INTENT_PARITY_MAX_SAMPLES);
  }
}

function computeIntentParityStatus(args: {
  lookbackHours: number;
  minSamples: number;
  targetOverlap: number;
  source?: string;
  stateCode?: string;
  county?: string;
}) {
  const source = String(args.source || "").toLowerCase();
  const stateCode = String(args.stateCode || "").toUpperCase();
  const county = String(args.county || "").toLowerCase();
  const cutoffMs = Date.now() - args.lookbackHours * 60 * 60 * 1000;

  const scoped = intentParitySamples.filter((sample) => {
    const ts = new Date(sample.timestamp_utc).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) return false;
    if (source && sample.scope.source.toLowerCase() !== source) return false;
    if (stateCode && sample.scope.stateCode.toUpperCase() !== stateCode) return false;
    if (county && sample.scope.county.toLowerCase() !== county) return false;
    return true;
  });

  const sampleCount = scoped.length;
  const overlapAvg =
    sampleCount > 0
      ? Number(
          (scoped.reduce((sum, sample) => sum + sample.overlap_ratio, 0) / sampleCount).toFixed(3)
        )
      : 0;

  const eventNativeAvg =
    sampleCount > 0
      ? Number(
          (
            scoped.reduce((sum, sample) => sum + sample.event_native_count, 0) / sampleCount
          ).toFixed(2)
        )
      : 0;
  const snapshotDerivedAvg =
    sampleCount > 0
      ? Number(
          (
            scoped.reduce((sum, sample) => sum + sample.snapshot_derived_count, 0) / sampleCount
          ).toFixed(2)
        )
      : 0;

  const status: IntentAutomationStatus =
    sampleCount >= args.minSamples && overlapAvg >= args.targetOverlap
      ? "ready_for_event_native_cutover"
      : sampleCount < args.minSamples
        ? "collecting_samples"
        : "parity_below_target";

  return {
    status,
    filters: {
      lookback_hours: args.lookbackHours,
      min_samples: args.minSamples,
      target_overlap: args.targetOverlap,
      source: source || null,
      stateCode: stateCode || null,
      county: county || null,
    },
    summary: {
      sample_count: sampleCount,
      overlap_avg: overlapAvg,
      event_native_avg: eventNativeAvg,
      snapshot_derived_avg: snapshotDerivedAvg,
    },
    latest_sample: scoped[scoped.length - 1] || null,
    samples: scoped,
  };
}

function cloneIntentAutomationState() {
  return {
    ...intentAutomationState,
    config: { ...intentAutomationState.config },
    last_run: intentAutomationState.last_run ? { ...intentAutomationState.last_run } : null,
  };
}

export function getIntentAutomationState() {
  return cloneIntentAutomationState();
}

export async function runIntentAutomationTick(triggeredBy = "manual") {
  const config = parseIntentAutomationConfig();
  intentAutomationState.enabled = config.enabled;
  intentAutomationState.config = {
    lookback_hours: config.lookbackHours,
    min_samples: config.minSamples,
    target_overlap: config.targetOverlap,
    cutover_ready_streak: config.cutoverReadyStreak,
    allow_rollback: config.allowRollback,
  };

  if (!config.enabled) {
    intentAutomationState.status = "disabled";
    intentAutomationState.reason = "intent_automation_disabled";
    intentAutomationState.ready_streak = 0;
    intentAutomationReadyStreak = 0;
    intentAutomationState.evaluated_at = new Date().toISOString();
    return {
      status: intentAutomationState.status,
      reason: intentAutomationState.reason,
      cutover_active: intentAutomationState.cutover_active,
      records_count: 0,
      parity_validation: null,
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const windowMinutes = Math.max(
    5,
    Math.min(120, Number.parseInt(process.env.INTENT_AUTOMATION_WINDOW_MINUTES || "60", 10))
  );
  const windowEventLimit = Math.max(
    100,
    Math.min(2000, Number.parseInt(process.env.INTENT_AUTOMATION_WINDOW_EVENT_LIMIT || "2000", 10))
  );
  const minEvents = Math.max(
    1,
    Math.min(100, Number.parseInt(process.env.INTENT_AUTOMATION_MIN_EVENTS || "5", 10))
  );
  const minVelocityRatio = Math.max(
    0,
    Math.min(1, Number.parseFloat(process.env.INTENT_AUTOMATION_MIN_VELOCITY_RATIO || "0.3"))
  );
  const minConfidence = Math.max(
    0,
    Math.min(1, Number.parseFloat(process.env.INTENT_AUTOMATION_MIN_CONFIDENCE || "0.7"))
  );
  const maxFreshnessSeconds = Math.max(
    30,
    Math.min(
      3600,
      Number.parseInt(process.env.INTENT_AUTOMATION_MAX_FRESHNESS_SECONDS || "600", 10)
    )
  );
  const cooldownMinutes = Math.max(
    1,
    Math.min(120, Number.parseInt(process.env.INTENT_AUTOMATION_COOLDOWN_MINUTES || "15", 10))
  );
  const source = String(process.env.INTENT_AUTOMATION_SOURCE || "");
  const stateCode = String(process.env.INTENT_AUTOMATION_STATE_CODE || "");
  const county = String(process.env.INTENT_AUTOMATION_COUNTY || "");
  const snapshotLimit = Math.max(
    1,
    Math.min(200, Number.parseInt(process.env.INTENT_AUTOMATION_SNAPSHOT_LIMIT || "50", 10))
  );

  const currentSinceIso = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
  const priorSinceIso = new Date(now.getTime() - windowMinutes * 2 * 60_000).toISOString();

  const [currentWindow, priorWindow, snapshotForParity] = await Promise.all([
    getLiveLaneEvents({
      lane: "",
      source,
      stateCode,
      county,
      since: currentSinceIso,
      cursor: "",
      limit: windowEventLimit,
    }),
    getLiveLaneEvents({
      lane: "",
      source,
      stateCode,
      county,
      since: priorSinceIso,
      cursor: currentSinceIso,
      limit: windowEventLimit,
    }),
    getLiveStreamSnapshot({
      source,
      stateCode,
      county,
      limit: snapshotLimit,
    }),
  ]);

  const records = buildEventNativeRecords({
    currentEvents: currentWindow.events || [],
    priorEvents: priorWindow.events || [],
    windowMinutes,
    minEvents,
    minVelocityRatio,
    minConfidence,
    maxFreshnessSeconds,
    cooldownMinutes,
    nowIso,
  });

  const snapshotDerivedRecords = mapSnapshotToDigitalDnaRecords({
    snapshot: snapshotForParity,
    windowMinutes,
    minEvents,
    minVelocityRatio,
    minConfidence,
    maxFreshnessSeconds,
    cooldownMinutes,
  });

  const parityValidation = buildParitySummary(records, snapshotDerivedRecords);
  recordIntentParitySample({
    timestamp_utc: nowIso,
    scope: {
      source,
      stateCode,
      county,
      window_minutes: windowMinutes,
    },
    event_native_count: parityValidation.event_native_count,
    snapshot_derived_count: parityValidation.snapshot_derived_count,
    overlap_count: parityValidation.overlap_count,
    overlap_ratio: parityValidation.overlap_ratio,
  });

  const paritySnapshot = computeIntentParityStatus({
    lookbackHours: config.lookbackHours,
    minSamples: config.minSamples,
    targetOverlap: config.targetOverlap,
    source,
    stateCode,
    county,
  });

  if (paritySnapshot.status === "ready_for_event_native_cutover") {
    intentAutomationReadyStreak += 1;
  } else {
    intentAutomationReadyStreak = 0;
  }

  const wasCutover = intentAutomationState.cutover_active;
  let cutoverNow = wasCutover;
  let reason = "event_native_parallel_validation";

  if (
    !wasCutover &&
    intentAutomationReadyStreak >= config.cutoverReadyStreak &&
    paritySnapshot.status === "ready_for_event_native_cutover"
  ) {
    cutoverNow = true;
    reason = "event_native_cutover_promoted";
  } else if (
    wasCutover &&
    config.allowRollback &&
    paritySnapshot.status !== "ready_for_event_native_cutover"
  ) {
    cutoverNow = false;
    reason = "event_native_cutover_rolled_back";
  }

  const transitioned = cutoverNow !== wasCutover;
  intentAutomationState.cutover_active = cutoverNow;
  intentAutomationState.status = paritySnapshot.status;
  intentAutomationState.reason = reason;
  intentAutomationState.evaluated_at = nowIso;
  intentAutomationState.ready_streak = intentAutomationReadyStreak;
  intentAutomationState.last_run = {
    triggered_by: triggeredBy,
    generated_at: nowIso,
    records: records.length,
    parity_recorded: true,
    parity_overlap: parityValidation.overlap_ratio,
  };
  if (transitioned) {
    intentAutomationState.last_transition_at = nowIso;
  }

  return {
    status: intentAutomationState.status,
    reason: intentAutomationState.reason,
    cutover_active: intentAutomationState.cutover_active,
    records_count: records.length,
    parity_validation: parityValidation,
  };
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

observabilityRouter.get("/crawler-telemetry/history", async (req, res) => {
  try {
    res.json(
      await getCrawlerIntentHistory({
        limit: Number.parseInt(String((req.query as any)?.limit || "200"), 10),
        botName: String((req.query as any)?.botName || ""),
        routeFamily: String((req.query as any)?.routeFamily || ""),
        intentStage: String((req.query as any)?.intentStage || ""),
      })
    );
  } catch (error) {
    console.error("Crawler intent history query failed:", error);
    sendInternalServerError(res, "Failed to fetch crawler intent history", {
      error: String(error),
    });
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
    const automation = getIntentAutomationState();
    const now = new Date();
    const nowIso = now.toISOString();
    const windowMinutes = Math.max(
      5,
      Math.min(120, Number.parseInt(String((req.query as any)?.window_minutes || "60"), 10))
    );
    const windowEventLimit = Math.max(
      100,
      Math.min(2000, Number.parseInt(String((req.query as any)?.window_event_limit || "2000"), 10))
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

    const source = String((req.query as any)?.source || "");
    const stateCode = String((req.query as any)?.stateCode || "");
    const county = String((req.query as any)?.county || "");
    const snapshotLimit = Number.parseInt(String((req.query as any)?.limit || "50"), 10);
    const runParityDefault = automation.cutover_active ? "0" : "1";
    const runParity = String((req.query as any)?.parallel || runParityDefault) !== "0";

    const currentSinceIso = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
    const priorSinceIso = new Date(now.getTime() - windowMinutes * 2 * 60_000).toISOString();
    const cursorIso = currentSinceIso;

    const [currentWindow, priorWindow, snapshotForParity] = await Promise.all([
      getLiveLaneEvents({
        lane: "",
        source,
        stateCode,
        county,
        since: currentSinceIso,
        cursor: "",
        limit: windowEventLimit,
      }),
      getLiveLaneEvents({
        lane: "",
        source,
        stateCode,
        county,
        since: priorSinceIso,
        cursor: cursorIso,
        limit: windowEventLimit,
      }),
      runParity
        ? getLiveStreamSnapshot({
            source,
            stateCode,
            county,
            limit: snapshotLimit,
          })
        : Promise.resolve(null as Awaited<ReturnType<typeof getLiveStreamSnapshot>> | null),
    ]);

    const records = buildEventNativeRecords({
      currentEvents: currentWindow.events || [],
      priorEvents: priorWindow.events || [],
      windowMinutes,
      minEvents,
      minVelocityRatio,
      minConfidence,
      maxFreshnessSeconds,
      cooldownMinutes,
      nowIso,
    });

    const snapshotDerivedRecords = snapshotForParity
      ? mapSnapshotToDigitalDnaRecords({
          snapshot: snapshotForParity,
          windowMinutes,
          minEvents,
          minVelocityRatio,
          minConfidence,
          maxFreshnessSeconds,
          cooldownMinutes,
        })
      : [];

    const parityValidation = runParity ? buildParitySummary(records, snapshotDerivedRecords) : null;
    if (parityValidation) {
      recordIntentParitySample({
        timestamp_utc: nowIso,
        scope: {
          source,
          stateCode,
          county,
          window_minutes: windowMinutes,
        },
        event_native_count: parityValidation.event_native_count,
        snapshot_derived_count: parityValidation.snapshot_derived_count,
        overlap_count: parityValidation.overlap_count,
        overlap_ratio: parityValidation.overlap_ratio,
      });
    }

    res.json({
      generated_at: nowIso,
      source: "canonical_event_windows",
      contract: "digital_dna_v1",
      automation: {
        enabled: automation.enabled,
        cutover_active: automation.cutover_active,
        status: automation.status,
        evaluated_at: automation.evaluated_at,
        ready_streak: automation.ready_streak,
        reason: automation.reason,
      },
      pipeline: {
        mode: "event_native",
        window_minutes: windowMinutes,
        current_window_events: (currentWindow.events || []).length,
        prior_window_events: (priorWindow.events || []).length,
      },
      guardrails: {
        min_events: minEvents,
        min_velocity_ratio: minVelocityRatio,
        min_confidence: minConfidence,
        max_freshness_seconds: maxFreshnessSeconds,
        cooldown_minutes: cooldownMinutes,
      },
      parity_validation: parityValidation,
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
      const now = new Date();
      const nowIso = now.toISOString();
      const windowMinutes = Math.max(
        5,
        Math.min(120, Number.parseInt(String((req.query as any)?.window_minutes || "60"), 10))
      );
      const windowEventLimit = Math.max(
        100,
        Math.min(
          2000,
          Number.parseInt(String((req.query as any)?.window_event_limit || "2000"), 10)
        )
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

      const source = String((req.query as any)?.source || "");
      const stateCode = String((req.query as any)?.stateCode || "");
      const county = String((req.query as any)?.county || "");
      const snapshotLimit = Number.parseInt(String((req.query as any)?.limit || "50"), 10);
      const automation = getIntentAutomationState();
      const runParityDefault = automation.cutover_active ? "0" : "1";
      const runParity = String((req.query as any)?.parallel || runParityDefault) !== "0";

      const currentSinceIso = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
      const priorSinceIso = new Date(now.getTime() - windowMinutes * 2 * 60_000).toISOString();

      const [currentWindow, priorWindow, snapshotForParity] = await Promise.all([
        getLiveLaneEvents({
          lane: "",
          source,
          stateCode,
          county,
          since: currentSinceIso,
          cursor: "",
          limit: windowEventLimit,
        }),
        getLiveLaneEvents({
          lane: "",
          source,
          stateCode,
          county,
          since: priorSinceIso,
          cursor: currentSinceIso,
          limit: windowEventLimit,
        }),
        runParity
          ? getLiveStreamSnapshot({ source, stateCode, county, limit: snapshotLimit })
          : Promise.resolve(null as Awaited<ReturnType<typeof getLiveStreamSnapshot>> | null),
      ]);

      const records = buildEventNativeRecords({
        currentEvents: currentWindow.events || [],
        priorEvents: priorWindow.events || [],
        windowMinutes,
        minEvents,
        minVelocityRatio,
        minConfidence,
        maxFreshnessSeconds,
        cooldownMinutes,
        nowIso,
      });

      const snapshotDerivedRecords = snapshotForParity
        ? mapSnapshotToDigitalDnaRecords({
            snapshot: snapshotForParity,
            windowMinutes,
            minEvents,
            minVelocityRatio,
            minConfidence,
            maxFreshnessSeconds,
            cooldownMinutes,
          })
        : [];

      const parityValidation = runParity
        ? buildParitySummary(records, snapshotDerivedRecords)
        : null;
      if (parityValidation) {
        recordIntentParitySample({
          timestamp_utc: nowIso,
          scope: {
            source,
            stateCode,
            county,
            window_minutes: windowMinutes,
          },
          event_native_count: parityValidation.event_native_count,
          snapshot_derived_count: parityValidation.snapshot_derived_count,
          overlap_count: parityValidation.overlap_count,
          overlap_ratio: parityValidation.overlap_ratio,
        });
      }

      res.write(`event: intent_batch\n`);
      res.write(
        `data: ${JSON.stringify({
          generated_at: nowIso,
          contract: "digital_dna_v1",
          pipeline: "event_native",
          automation: {
            enabled: automation.enabled,
            cutover_active: automation.cutover_active,
            status: automation.status,
            evaluated_at: automation.evaluated_at,
            ready_streak: automation.ready_streak,
            reason: automation.reason,
          },
          parity_validation: parityValidation,
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

observabilityRouter.get("/live-stream/intent-parity", async (req, res) => {
  try {
    const lookbackHours = Math.max(
      1,
      Math.min(168, Number.parseInt(String((req.query as any)?.lookback_hours || "24"), 10))
    );
    const minSamples = Math.max(
      1,
      Math.min(10000, Number.parseInt(String((req.query as any)?.min_samples || "12"), 10))
    );
    const targetOverlap = Math.max(
      0,
      Math.min(1, Number.parseFloat(String((req.query as any)?.target_overlap || "0.8")))
    );
    const source = String((req.query as any)?.source || "");
    const stateCode = String((req.query as any)?.stateCode || "");
    const county = String((req.query as any)?.county || "");

    const parity = computeIntentParityStatus({
      lookbackHours,
      minSamples,
      targetOverlap,
      source,
      stateCode,
      county,
    });
    const automation = getIntentAutomationState();

    res.json({
      generated_at: new Date().toISOString(),
      contract: "intent_parity_v1",
      status: parity.status,
      automation,
      filters: parity.filters,
      summary: parity.summary,
      latest_sample: parity.latest_sample,
      samples: parity.samples.slice(-200),
      cutover: {
        active: automation.cutover_active,
        status: automation.status,
        evaluated_at: automation.evaluated_at,
        reason: automation.reason,
        ready_streak: automation.ready_streak,
      },
    });
  } catch (error) {
    console.error("Live stream intent parity query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream intent parity", {
      error: String(error),
    });
  }
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

    if (mode === "intent") {
      const source = String((req.query as any)?.source || "");
      const stateCode = String((req.query as any)?.stateCode || "");
      const county = String((req.query as any)?.county || "");
      const limit = Number.parseInt(String((req.query as any)?.limit || "50"), 10);
      const windowEventLimit = Math.max(
        100,
        Math.min(
          2000,
          Number.parseInt(String((req.query as any)?.window_event_limit || "2000"), 10)
        )
      );
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

      const now = new Date();
      const nowIso = now.toISOString();
      const currentSinceIso = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
      const priorSinceIso = new Date(now.getTime() - windowMinutes * 2 * 60_000).toISOString();

      const [currentWindow, priorWindow] = await Promise.all([
        getLiveLaneEvents({
          lane: "",
          source,
          stateCode,
          county,
          since: currentSinceIso,
          cursor: "",
          limit: windowEventLimit,
        }),
        getLiveLaneEvents({
          lane: "",
          source,
          stateCode,
          county,
          since: priorSinceIso,
          cursor: currentSinceIso,
          limit: windowEventLimit,
        }),
      ]);

      const records = buildEventNativeRecords({
        currentEvents: currentWindow.events || [],
        priorEvents: priorWindow.events || [],
        windowMinutes,
        minEvents,
        minVelocityRatio,
        minConfidence,
        maxFreshnessSeconds,
        cooldownMinutes,
        nowIso,
      });

      const escapeCsv = (value: unknown) => {
        const normalized = String(value ?? "");
        if (/[",\n]/.test(normalized)) {
          return `"${normalized.replace(/"/g, '""')}"`;
        }
        return normalized;
      };

      const header = [
        "timestamp_utc",
        "category",
        "geo_state",
        "geo_county",
        "geo_city",
        "window_minutes",
        "events_views",
        "events_contact_attempts",
        "events_repeat_sessions",
        "velocity",
        "cluster_strength",
        "signal_type",
        "confidence",
        "freshness_seconds",
        "recommended_action",
        "action_payload_json",
        "lineage_json",
      ];

      const lines = [header.join(",")];
      for (const record of records) {
        lines.push(
          [
            record.timestamp_utc,
            record.category,
            record.geo.state || "",
            record.geo.county || "",
            record.geo.city || "",
            record.window_minutes,
            record.events.views,
            record.events.contact_attempts,
            record.events.repeat_sessions,
            record.velocity,
            record.cluster_strength,
            record.signal_type,
            record.confidence,
            record.freshness_seconds,
            record.recommended_action,
            JSON.stringify(record.action_payload),
            JSON.stringify(record.lineage || {}),
          ]
            .map(escapeCsv)
            .join(",")
        );
      }

      const suffix = [
        "live-intent-feed",
        toFileToken(source, "all-sources"),
        toFileToken(stateCode, "all-states"),
        toFileToken(county, "all-counties"),
        new Date().toISOString().slice(0, 10),
      ].join("-");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
      res.status(200).send(`\uFEFF${lines.join("\n")}`);
      return;
    }

    if (mode === "snapshot_full") {
      const source = String((req.query as any)?.source || "");
      const stateCode = String((req.query as any)?.stateCode || "");
      const county = String((req.query as any)?.county || "");
      const limit = Number.parseInt(String((req.query as any)?.limit || "5000"), 10);

      const snapshot = await buildLiveStreamSnapshot({
        source,
        stateCode,
        county,
        limit,
        fullSignalCoverage: true,
      });

      const header = [
        "generated_at",
        "source_filter",
        "state_filter",
        "county_filter",
        "degraded_sources",
        "degraded_source_reasons_json",
        "entry_rank",
        "entry_id",
        "entry_timestamp",
        "kind",
        "priority",
        "truth_status",
        "source",
        "lane",
        "signal_class",
        "state_code",
        "county_name",
        "category",
        "revenue_score",
        "commercial_bucket",
        "monetization_stage",
        "title",
        "narrative",
        "recommended_play",
        "sales_angle",
        "target_market",
        "channel_suggestion",
        "asset_suggestion",
        "why_now",
        "evidence_json",
      ];

      const escapeCsv = (value: unknown) => {
        const normalized = String(value ?? "");
        if (/[",\n]/.test(normalized)) {
          return `"${normalized.replace(/"/g, '""')}"`;
        }
        return normalized;
      };

      const degradedSources = Array.isArray(snapshot.summary?.degradedSources)
        ? snapshot.summary.degradedSources.join("|")
        : "";
      const degradedReasonsJson = snapshot.summary?.degradedSourceReasons
        ? JSON.stringify(snapshot.summary.degradedSourceReasons)
        : "";

      const lines = [header.join(",")];
      for (const [index, item] of (snapshot.stream || []).entries()) {
        lines.push(
          [
            snapshot.generatedAt,
            snapshot.filters.source || "",
            snapshot.filters.stateCode || "",
            snapshot.filters.county || "",
            degradedSources,
            degradedReasonsJson,
            index + 1,
            item.id,
            item.timestamp,
            item.kind,
            item.priority,
            item.truthStatus || "",
            item.source,
            item.lane || "",
            item.signalClass || "",
            item.stateCode || "",
            item.countyName || "",
            item.category || "",
            typeof item.revenueScore === "number" ? item.revenueScore : "",
            item.commercialBucket || "",
            item.monetizationStage || "",
            item.title,
            item.narrative,
            item.recommendedPlay || "",
            item.salesAngle || "",
            item.targetMarket || "",
            item.channelSuggestion || "",
            item.assetSuggestion || "",
            item.whyNow || "",
            JSON.stringify(item.evidence || []),
          ]
            .map(escapeCsv)
            .join(",")
        );
      }

      const suffix = [
        "live-stream-full",
        toFileToken(source, "all-sources"),
        toFileToken(stateCode, "all-states"),
        toFileToken(county, "all-counties"),
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
