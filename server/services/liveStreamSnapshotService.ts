import { pool } from "../db";
import { getActiveAlerts } from "../observability/alerts";
import { getCrawlerTelemetrySummary } from "./crawlerTelemetryService";
import { getLisaFeed } from "./lisaRuntime";
import { getPartnerIntelligenceBriefSnapshot } from "./partnerIntelligenceBriefSnapshotService";
import {
  computeSignalTruthState,
  resolveSignalDurability,
  resolveMaxAgeMinutesForSignal,
} from "../../shared/signalDurability";

type LiveStreamPriority = "critical" | "high" | "medium" | "low";

export type LiveStreamSnapshotEntry = {
  id: string;
  timestamp: string;
  kind: string;
  priority: LiveStreamPriority;
  truthStatus?: "current" | "stale";
  title: string;
  narrative: string;
  source: string;
  stateCode: string | null;
  countyName: string | null;
};

export type LiveStreamSnapshot = {
  generatedAt: string;
  filters: {
    source: string | null;
    stateCode: string | null;
    county: string | null;
    limit: number;
  };
  summary: {
    truthNow: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    crawlerRequests24h: number;
    activeAlerts: number;
    botCrawlSignals: number;
    topBotCrawlHeadline: string | null;
    sourceCounts: Record<string, number>;
    degradedSources: string[];
    degradedSourceReasons?: Record<string, string>;
  };
  stream: LiveStreamSnapshotEntry[];
};

let ensurePromise: Promise<void> | null = null;
let prunePromise: Promise<void> | null = null;
let lastPruneAt = 0;

const LIVE_STREAM_HISTORY_RETENTION_DAYS = Math.max(
  3,
  Number(process.env.LIVE_STREAM_HISTORY_RETENTION_DAYS || 7)
);
const LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES = Math.max(
  30,
  Number(process.env.LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES || 360)
);
const LIVE_STREAM_STABLE_MAX_AGE_MINUTES = Math.max(
  LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES,
  Number(process.env.LIVE_STREAM_STABLE_MAX_AGE_MINUTES || 1440)
);
const LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES = Math.max(
  LIVE_STREAM_STABLE_MAX_AGE_MINUTES,
  Number(process.env.LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES || 43200)
);
const LIVE_STREAM_HISTORY_LOOKBACK_DAYS = Math.max(
  1,
  Number(process.env.LIVE_STREAM_HISTORY_LOOKBACK_DAYS || 7)
);

export async function ensureLiveStreamSnapshotTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_live_stream_snapshots (
          id bigserial PRIMARY KEY,
          source_filter text,
          state_code varchar(2),
          county_filter text,
          limit_value integer NOT NULL DEFAULT 20,
          summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          stream_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_live_stream_snapshots_unique
        ON admin_live_stream_snapshots (
          coalesce(source_filter, ''),
          coalesce(state_code, ''),
          coalesce(county_filter, ''),
          limit_value
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_live_stream_snapshot_history (
          id bigserial PRIMARY KEY,
          source_filter text,
          state_code varchar(2),
          county_filter text,
          limit_value integer NOT NULL DEFAULT 20,
          summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          stream_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_live_stream_snapshot_history_lookup
        ON admin_live_stream_snapshot_history (
          coalesce(source_filter, ''),
          coalesce(state_code, ''),
          coalesce(county_filter, ''),
          computed_at DESC
        );
      `);
    })();
  }
  await ensurePromise;
}

async function pruneLiveStreamSnapshotHistoryIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 6 * 60 * 60 * 1000) return;
  if (prunePromise) return prunePromise;

  prunePromise = (async () => {
    try {
      await ensureLiveStreamSnapshotTables();
      await pool.query(
        `
        delete from admin_live_stream_snapshot_history
        where computed_at < now() - ($1::interval)
        `,
        [`${LIVE_STREAM_HISTORY_RETENTION_DAYS} days`]
      );
      lastPruneAt = Date.now();
    } finally {
      prunePromise = null;
    }
  })();

  await prunePromise;
}

function normalizeFilters(params: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
}) {
  return {
    source:
      String(params.source || "")
        .trim()
        .toLowerCase() || "",
    stateCode:
      String(params.stateCode || "")
        .trim()
        .toUpperCase() || "",
    county:
      String(params.county || "")
        .trim()
        .toLowerCase() || "",
    limit: Math.max(5, Math.min(100, Number(params.limit || 20))),
  };
}

function summarizeRejectionReason(reason: unknown): string {
  if (reason instanceof Error) {
    const message = String(reason.message || "").trim();
    if (message) return message.slice(0, 220);
    return reason.name || "unknown_error";
  }
  if (typeof reason === "string") return reason.trim().slice(0, 220) || "unknown_error";
  if (reason && typeof reason === "object") {
    const candidate = (reason as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, 220);
    }
  }
  return "unknown_error";
}

function isPersistentEntryKind(entry: Pick<LiveStreamSnapshotEntry, "kind" | "source">): boolean {
  if (entry.kind === "partner_brief" || entry.kind === "partner_delta") return true;
  if (entry.kind === "county_lead" || entry.kind === "state_lead") return true;
  if (entry.source === "cumulus") return true;
  return false;
}

function resolveEntryTruthStatus(entry: LiveStreamSnapshotEntry): "current" | "stale" {
  if (entry.truthStatus) return entry.truthStatus;
  const sourceKey = entry.kind === "finding" ? entry.source : entry.kind;
  const truth = computeSignalTruthState({
    observedAt: entry.timestamp,
    sourceKind: sourceKey,
    sourceOverrides: {
      [sourceKey]: resolveMaxAgeMinutesForSignal({
        sourceKind: sourceKey,
        durabilityOverrides: {
          volatile: LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES,
          stable: LIVE_STREAM_STABLE_MAX_AGE_MINUTES,
          persistent: LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES,
        },
      }),
    },
    durabilityOverrides: {
      volatile: LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES,
      stable: LIVE_STREAM_STABLE_MAX_AGE_MINUTES,
      persistent: LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES,
    },
  });

  if (truth === "current") return "current";
  const durability = resolveSignalDurability(sourceKey);
  if (durability === "persistent" || isPersistentEntryKind(entry)) return "current";
  return "stale";
}

export async function buildLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
}): Promise<LiveStreamSnapshot> {
  const filters = normalizeFilters(params || {});

  const [lisaFeedResult, crawlerTelemetryResult, cumulusBriefResult, activeAlertsResult] =
    await Promise.allSettled([
      getLisaFeed(),
      getCrawlerTelemetrySummary(),
      getPartnerIntelligenceBriefSnapshot({
        partnerSlug: "cumulus-media",
        window: "24h",
        stateCode: filters.stateCode || undefined,
        limit: 100,
      }),
      Promise.resolve(getActiveAlerts()),
    ]);

  const lisaFeed =
    lisaFeedResult.status === "fulfilled"
      ? lisaFeedResult.value
      : {
          generatedAt: new Date().toISOString(),
          runtimeMode: "tradescout_local",
          source: "fallback",
          summary: {
            truthNow: "LISA feed unavailable; showing partial live stream.",
            dataProductionSummary: "LISA feed unavailable.",
            llmOptimizationSummary: "LISA feed unavailable.",
          },
          feed: [],
        };

  const crawlerTelemetry =
    crawlerTelemetryResult.status === "fulfilled"
      ? crawlerTelemetryResult.value
      : {
          generatedAt: new Date().toISOString(),
          totals24h: { total: 0, ok: 0, clientError: 0, serverError: 0 },
          topBots: [],
          topRoutes: [],
          topSurfaces: [],
          requestTypes: [],
          topCounties: [],
        };

  const cumulusBrief =
    cumulusBriefResult.status === "fulfilled"
      ? cumulusBriefResult.value
      : {
          partnerSlug: "cumulus-media",
          generatedAt: new Date().toISOString(),
          filters: {
            window: "24h",
            stateCode: filters.stateCode || null,
            surface: null,
            limit: 100,
          },
          executiveSummary: "Cumulus brief unavailable; showing partial live stream.",
          activationSummary: "Cumulus brief unavailable.",
          topCounties: [],
          topStates: [],
          summary: {
            deltaSummary: "No Cumulus delta available.",
            currentLeadCounty: null,
            currentLeadState: null,
            currentLeadSurface: null,
            stateLead: null,
          },
          lisa: {
            truthNow: "",
            dataProductionSummary: "",
            llmOptimizationSummary: "",
            topFindings: [],
          },
        };

  const activeAlerts =
    activeAlertsResult.status === "fulfilled" && Array.isArray(activeAlertsResult.value)
      ? activeAlertsResult.value
      : [];

  const degradedSources = [
    lisaFeedResult.status === "rejected" ? "lisa" : null,
    crawlerTelemetryResult.status === "rejected" ? "crawler" : null,
    cumulusBriefResult.status === "rejected" ? "cumulus" : null,
    activeAlertsResult.status === "rejected" ? "alerts" : null,
  ].filter((value): value is string => Boolean(value));
  const degradedSourceReasons: Record<string, string> = {};

  if (lisaFeedResult.status === "rejected") {
    degradedSourceReasons.lisa = summarizeRejectionReason(lisaFeedResult.reason);
    console.error("Live stream degraded: LISA feed unavailable", lisaFeedResult.reason);
  }
  if (crawlerTelemetryResult.status === "rejected") {
    degradedSourceReasons.crawler = summarizeRejectionReason(crawlerTelemetryResult.reason);
    console.error(
      "Live stream degraded: crawler telemetry unavailable",
      crawlerTelemetryResult.reason
    );
  }
  if (cumulusBriefResult.status === "rejected") {
    degradedSourceReasons.cumulus = summarizeRejectionReason(cumulusBriefResult.reason);
    console.error("Live stream degraded: Cumulus brief unavailable", cumulusBriefResult.reason);
  }
  if (activeAlertsResult.status === "rejected") {
    degradedSourceReasons.alerts = summarizeRejectionReason(activeAlertsResult.reason);
    console.error("Live stream degraded: active alerts unavailable", activeAlertsResult.reason);
  }

  const botCrawlFindings = (lisaFeed.feed || []).filter(
    (item) => item.sourceKind === "bot_crawl_signals"
  );
  const topBotCrawlFinding = botCrawlFindings[0] || null;

  const rawStream = [
    {
      id: `lisa-truth-${lisaFeed.generatedAt}`,
      timestamp: lisaFeed.generatedAt,
      kind: "truth_now",
      priority: "high",
      title: "Truth Now",
      narrative: lisaFeed.summary.truthNow,
      source: "lisa",
      stateCode: null,
      countyName: null,
    },
    {
      id: `lisa-data-${lisaFeed.generatedAt}`,
      timestamp: lisaFeed.generatedAt,
      kind: "data_production",
      priority: "medium",
      title: "Data Production",
      narrative: lisaFeed.summary.dataProductionSummary,
      source: "lisa",
      stateCode: null,
      countyName: null,
    },
    {
      id: `lisa-llm-${lisaFeed.generatedAt}`,
      timestamp: lisaFeed.generatedAt,
      kind: "llm_optimization",
      priority: "medium",
      title: "LLM Optimization",
      narrative: lisaFeed.summary.llmOptimizationSummary,
      source: "lisa",
      stateCode: null,
      countyName: null,
    },
    {
      id: `cumulus-brief-${cumulusBrief.generatedAt}`,
      timestamp: cumulusBrief.generatedAt,
      kind: "partner_brief",
      priority: "high",
      title: "Partner Brief",
      narrative: cumulusBrief.executiveSummary,
      source: "cumulus",
      stateCode: cumulusBrief.summary.currentLeadState || null,
      countyName: cumulusBrief.summary.currentLeadCounty || null,
    },
    {
      id: `cumulus-delta-${cumulusBrief.generatedAt}`,
      timestamp: cumulusBrief.generatedAt,
      kind: "partner_delta",
      priority: "medium",
      title: "Partner Delta",
      narrative: cumulusBrief.summary.deltaSummary,
      source: "cumulus",
      stateCode: cumulusBrief.summary.currentLeadState || null,
      countyName: cumulusBrief.summary.currentLeadCounty || null,
    },
    ...(cumulusBrief.topCounties?.[0]
      ? [
          {
            id: `cumulus-county-${cumulusBrief.generatedAt}-${cumulusBrief.topCounties[0].countyFips}`,
            timestamp: cumulusBrief.generatedAt,
            kind: "county_lead",
            priority: "medium" as LiveStreamPriority,
            title: "Leading County",
            narrative: `${cumulusBrief.topCounties[0].countyName}, ${cumulusBrief.topCounties[0].stateCode} leads with ${cumulusBrief.topCounties[0].requestCount} requests. ${cumulusBrief.topCounties[0].dominantSurface.replace(/_/g, " ")} is the dominant surface.`,
            source: "cumulus",
            stateCode: cumulusBrief.topCounties[0].stateCode,
            countyName: cumulusBrief.topCounties[0].countyName,
          },
        ]
      : []),
    ...(cumulusBrief.topStates?.[0]
      ? [
          {
            id: `cumulus-state-${cumulusBrief.generatedAt}-${cumulusBrief.topStates[0].stateCode}`,
            timestamp: cumulusBrief.generatedAt,
            kind: "state_lead",
            priority: "medium" as LiveStreamPriority,
            title: "Leading State Cluster",
            narrative: `${cumulusBrief.topStates[0].stateCode} leads with ${cumulusBrief.topStates[0].requestCount} requests across ${cumulusBrief.topStates[0].countyCount} counties.`,
            source: "cumulus",
            stateCode: cumulusBrief.topStates[0].stateCode,
            countyName: null,
          },
        ]
      : []),
    {
      id: `crawler-total-${crawlerTelemetry.generatedAt}`,
      timestamp: crawlerTelemetry.generatedAt,
      kind: "crawler_volume",
      priority: "medium",
      title: "Crawler Volume",
      narrative: `${crawlerTelemetry.totals24h.total} crawler requests were observed in the last 24 hours with ${crawlerTelemetry.totals24h.ok} returning 2xx and ${crawlerTelemetry.totals24h.serverError} returning 5xx.`,
      source: "crawler",
      stateCode: null,
      countyName: null,
    },
    ...(crawlerTelemetry.topBots?.[0]
      ? [
          {
            id: `crawler-bot-${crawlerTelemetry.generatedAt}-${crawlerTelemetry.topBots[0].botName}`,
            timestamp: crawlerTelemetry.generatedAt,
            kind: "crawler_top_bot",
            priority: "low" as LiveStreamPriority,
            title: "Top Bot",
            narrative: `${crawlerTelemetry.topBots[0].botName} is the most active crawler right now with ${crawlerTelemetry.topBots[0].requestCount} requests.`,
            source: "crawler",
            stateCode: null,
            countyName: null,
          },
        ]
      : []),
    ...(activeAlerts || []).slice(0, 3).map((alert) => ({
      id: `alert-${alert.id}`,
      timestamp: new Date(alert.lastEvaluatedAt || alert.startedAt).toISOString(),
      kind: "alert",
      priority:
        alert.severity === "CRITICAL"
          ? ("critical" as LiveStreamPriority)
          : alert.severity === "WARN"
            ? ("high" as LiveStreamPriority)
            : ("medium" as LiveStreamPriority),
      title: alert.name,
      narrative: alert.description,
      source: "alerts",
      stateCode:
        String(alert.labels?.stateCode || "")
          .trim()
          .toUpperCase() || null,
      countyName: String(alert.labels?.countyName || "").trim() || null,
    })),
    ...lisaFeed.feed.slice(0, 8).map((item) => ({
      id: item.id,
      timestamp:
        item.freshnessMinutes !== null
          ? new Date(Date.now() - item.freshnessMinutes * 60_000).toISOString()
          : lisaFeed.generatedAt,
      kind: "finding",
      priority: item.priority,
      truthStatus: item.truthStatus === "current" ? "current" : "stale",
      title: item.headline,
      narrative: item.narrative,
      source: item.sourceKind,
      stateCode: null,
      countyName:
        item.scopeType === "county" && item.scopeRef
          ? String(item.scopeRef).replace(/[-_]/g, " ")
          : null,
    })),
  ] as LiveStreamSnapshotEntry[];
  const stream: LiveStreamSnapshotEntry[] = rawStream
    .filter((entry) => {
      if (filters.source && entry.source !== filters.source) return false;
      if (filters.stateCode && entry.stateCode && entry.stateCode !== filters.stateCode)
        return false;
      if (filters.county && entry.countyName) {
        if (!String(entry.countyName).trim().toLowerCase().includes(filters.county)) return false;
      } else if (filters.county && !entry.countyName) {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const truthStatus = resolveEntryTruthStatus(entry);
      return {
        ...entry,
        truthStatus,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, filters.limit);

  const sourceCounts = stream.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.source] = (acc[entry.source] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary: {
      truthNow: lisaFeed.summary.truthNow,
      currentLeadCounty: cumulusBrief.summary.currentLeadCounty,
      currentLeadState: cumulusBrief.summary.currentLeadState,
      crawlerRequests24h: crawlerTelemetry.totals24h.total,
      activeAlerts: activeAlerts.length,
      botCrawlSignals: botCrawlFindings.length,
      topBotCrawlHeadline: topBotCrawlFinding?.headline || null,
      sourceCounts,
      degradedSources,
      degradedSourceReasons: Object.keys(degradedSourceReasons).length
        ? degradedSourceReasons
        : undefined,
    },
    stream,
  };
}

export async function refreshLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
}): Promise<LiveStreamSnapshot> {
  await ensureLiveStreamSnapshotTables();
  void pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const snapshot = await buildLiveStreamSnapshot(filters);

  await pool.query("BEGIN");
  try {
    await pool.query(
      `
      delete from admin_live_stream_snapshots
      where coalesce(source_filter, '') = $1
        and coalesce(state_code, '') = $2
        and coalesce(county_filter, '') = $3
        and limit_value = $4
      `,
      [filters.source, filters.stateCode, filters.county, filters.limit]
    );

    await pool.query(
      `
      insert into admin_live_stream_snapshots (
        source_filter,
        state_code,
        county_filter,
        limit_value,
        summary_json,
        stream_json,
        computed_at
      )
      values (nullif($1,''), nullif($2,''), nullif($3,''), $4, $5::jsonb, $6::jsonb, now())
      `,
      [
        filters.source,
        filters.stateCode,
        filters.county,
        filters.limit,
        JSON.stringify(snapshot.summary),
        JSON.stringify(snapshot.stream),
      ]
    );

    await pool.query(
      `
      insert into admin_live_stream_snapshot_history (
        source_filter,
        state_code,
        county_filter,
        limit_value,
        summary_json,
        stream_json,
        computed_at
      )
      values (nullif($1,''), nullif($2,''), nullif($3,''), $4, $5::jsonb, $6::jsonb, now())
      `,
      [
        filters.source,
        filters.stateCode,
        filters.county,
        filters.limit,
        JSON.stringify(snapshot.summary),
        JSON.stringify(snapshot.stream),
      ]
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return snapshot;
}

export async function getLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
  maxSnapshotAgeMinutes?: number;
}): Promise<LiveStreamSnapshot> {
  await ensureLiveStreamSnapshotTables();
  void pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const maxSnapshotAgeMinutes = Math.max(1, Number(params?.maxSnapshotAgeMinutes || 5));
  const result = await pool.query(
    `
    select summary_json, stream_json, computed_at
    from admin_live_stream_snapshots
    where coalesce(source_filter, '') = $1
      and coalesce(state_code, '') = $2
      and coalesce(county_filter, '') = $3
      and limit_value = $4
    limit 1
    `,
    [filters.source, filters.stateCode, filters.county, filters.limit]
  );
  const row = result.rows?.[0];
  const computedAt = row?.computed_at ? new Date(String(row.computed_at)) : null;
  const isStale =
    !computedAt ||
    !Number.isFinite(computedAt.getTime()) ||
    Date.now() - computedAt.getTime() > maxSnapshotAgeMinutes * 60 * 1000;

  if (!row || isStale) {
    return refreshLiveStreamSnapshot(filters);
  }

  return {
    generatedAt: computedAt.toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary:
      row.summary_json && typeof row.summary_json === "object"
        ? row.summary_json
        : {
            truthNow: "",
            currentLeadCounty: null,
            currentLeadState: null,
            crawlerRequests24h: 0,
            activeAlerts: 0,
            sourceCounts: {},
            degradedSources: [],
          },
    stream: Array.isArray(row.stream_json) ? row.stream_json : [],
  };
}

export async function getLiveStreamSnapshotHistory(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
  lookbackDays?: number;
}): Promise<LiveStreamSnapshot[]> {
  await ensureLiveStreamSnapshotTables();
  void pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const historyLimit = Math.max(1, Math.min(20, Number(params?.limit || 10)));
  const lookbackDays = Math.max(
    1,
    Math.min(LIVE_STREAM_HISTORY_RETENTION_DAYS, Number(params?.lookbackDays || LIVE_STREAM_HISTORY_LOOKBACK_DAYS))
  );
  const result = await pool.query(
    `
    select summary_json, stream_json, computed_at
    from admin_live_stream_snapshot_history
    where coalesce(source_filter, '') = $1
      and coalesce(state_code, '') = $2
      and coalesce(county_filter, '') = $3
      and limit_value = $4
      and computed_at >= now() - ($6::interval)
    order by computed_at desc
    limit $5
    `,
    [
      filters.source,
      filters.stateCode,
      filters.county,
      filters.limit,
      historyLimit,
      `${lookbackDays} days`,
    ]
  );

  return (result.rows || []).map((row) => ({
    generatedAt: new Date(String(row.computed_at || new Date().toISOString())).toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary:
      row.summary_json && typeof row.summary_json === "object"
        ? row.summary_json
        : {
            truthNow: "",
            currentLeadCounty: null,
            currentLeadState: null,
            crawlerRequests24h: 0,
            activeAlerts: 0,
            sourceCounts: {},
            degradedSources: [],
          },
    stream: Array.isArray(row.stream_json) ? row.stream_json : [],
  }));
}
