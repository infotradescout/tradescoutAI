import { pool } from "../db";
import { getLisaFeed } from "./lisaRuntime";
import {
  getPartnerCountyObservationSnapshots,
  type PartnerObservationWindow,
} from "./partnerCountyObservationSnapshotService";

type PartnerIntelligenceBriefTopCounty = {
  rank: number;
  countyFips: string;
  countyName: string;
  stateCode: string;
  requestCount: number;
  dominantSurface: string;
  trend: "up" | "down" | "flat";
  changePct: number;
};

type PartnerIntelligenceBriefTopState = {
  rank: number;
  stateCode: string;
  requestCount: number;
  countyCount: number;
  dominantSurface: string;
  trend: "up" | "down" | "flat";
  changePct: number;
};

type PartnerIntelligenceBriefFinding = {
  id: string;
  headline: string;
  narrative: string;
  priority: "critical" | "high" | "medium" | "low";
  truthStatus: "current" | "stale" | "superseded" | "suppressed";
  scopeType: "global" | "county" | "category" | "surface" | "partner";
};

export type PartnerIntelligenceBriefSnapshot = {
  partnerSlug: string;
  generatedAt: string;
  filters: {
    window: PartnerObservationWindow;
    stateCode: string | null;
    surface: string | null;
    limit: number;
  };
  executiveSummary: string;
  activationSummary: string;
  topCounties: PartnerIntelligenceBriefTopCounty[];
  topStates: PartnerIntelligenceBriefTopState[];
  summary: {
    deltaSummary: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    currentLeadSurface: string | null;
    stateLead: string | null;
  };
  lisa: {
    truthNow: string;
    dataProductionSummary: string;
    llmOptimizationSummary: string;
    topFindings: PartnerIntelligenceBriefFinding[];
  };
};

let ensurePromise: Promise<void> | null = null;
let prunePromise: Promise<void> | null = null;
let lastPruneAt = 0;

const PARTNER_INTELLIGENCE_BRIEF_HISTORY_RETENTION_DAYS = Math.max(
  7,
  Number(process.env.PARTNER_INTELLIGENCE_BRIEF_HISTORY_RETENTION_DAYS || 90)
);

function parseWindowsFromEnv(): PartnerObservationWindow[] {
  const raw = String(process.env.PARTNER_COUNTY_OBSERVATION_WINDOWS || "24h,7d")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const valid = raw.filter(
    (value): value is PartnerObservationWindow =>
      value === "1h" || value === "24h" || value === "7d" || value === "30d"
  );
  return valid.length > 0 ? Array.from(new Set(valid)) : ["24h", "7d"];
}

export async function ensurePartnerIntelligenceBriefSnapshotsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tradepartner_intelligence_brief_snapshots (
          id bigserial PRIMARY KEY,
          partner_slug text NOT NULL,
          "window" text NOT NULL,
          state_code varchar(2),
          surface text,
          limit_value integer NOT NULL DEFAULT 100,
          executive_summary text NOT NULL,
          activation_summary text NOT NULL,
          top_counties_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          top_states_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          lisa_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_tradepartner_intelligence_brief_unique
         ON tradepartner_intelligence_brief_snapshots (
           partner_slug,
           "window",
           coalesce(state_code, ''),
           coalesce(surface, ''),
           limit_value
         );`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_intelligence_brief_partner_window
         ON tradepartner_intelligence_brief_snapshots (partner_slug, "window", computed_at DESC);`
      );
      await pool.query(
        `ALTER TABLE tradepartner_intelligence_brief_snapshots
         ADD COLUMN IF NOT EXISTS top_states_json jsonb NOT NULL DEFAULT '[]'::jsonb;`
      );
      await pool.query(
        `ALTER TABLE tradepartner_intelligence_brief_snapshots
         ADD COLUMN IF NOT EXISTS summary_json jsonb NOT NULL DEFAULT '{}'::jsonb;`
      );

      await pool.query(`
        CREATE TABLE IF NOT EXISTS tradepartner_intelligence_brief_history (
          id bigserial PRIMARY KEY,
          partner_slug text NOT NULL,
          "window" text NOT NULL,
          state_code varchar(2),
          surface text,
          limit_value integer NOT NULL DEFAULT 100,
          executive_summary text NOT NULL,
          activation_summary text NOT NULL,
          top_counties_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          top_states_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          lisa_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_intelligence_brief_history_lookup
         ON tradepartner_intelligence_brief_history (
           partner_slug,
           "window",
           computed_at DESC
         );`
      );
      await pool.query(
        `ALTER TABLE tradepartner_intelligence_brief_history
         ADD COLUMN IF NOT EXISTS top_states_json jsonb NOT NULL DEFAULT '[]'::jsonb;`
      );
      await pool.query(
        `ALTER TABLE tradepartner_intelligence_brief_history
         ADD COLUMN IF NOT EXISTS summary_json jsonb NOT NULL DEFAULT '{}'::jsonb;`
      );
    })();
  }

  await ensurePromise;
}

async function prunePartnerIntelligenceBriefHistoryIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 6 * 60 * 60 * 1000) return;
  if (prunePromise) return prunePromise;

  prunePromise = (async () => {
    try {
      await ensurePartnerIntelligenceBriefSnapshotsTable();
      await pool.query(
        `
          delete from tradepartner_intelligence_brief_history
          where computed_at < now() - ($1::interval)
        `,
        [`${PARTNER_INTELLIGENCE_BRIEF_HISTORY_RETENTION_DAYS} days`]
      );
      lastPruneAt = Date.now();
    } finally {
      prunePromise = null;
    }
  })();

  await prunePromise;
}

function buildTopStates(
  counties: Awaited<ReturnType<typeof getPartnerCountyObservationSnapshots>>["counties"]
): PartnerIntelligenceBriefTopState[] {
  const stateMap = new Map<
    string,
    {
      requestCount: number;
      countyCount: number;
      surfaceTotals: Map<string, number>;
      trendScore: number;
      absoluteChange: number;
    }
  >();

  for (const county of counties ?? []) {
    const stateCode = String(county.stateCode || "")
      .trim()
      .toUpperCase();
    if (!stateCode) continue;
    const entry = stateMap.get(stateCode) || {
      requestCount: 0,
      countyCount: 0,
      surfaceTotals: new Map<string, number>(),
      trendScore: 0,
      absoluteChange: 0,
    };
    entry.requestCount += Number(county.requestCount || 0);
    entry.countyCount += 1;
    entry.absoluteChange += Math.abs(Number(county.changePct || 0));
    if (county.trend === "up") entry.trendScore += 1;
    if (county.trend === "down") entry.trendScore -= 1;
    for (const surfaceEntry of county.surfaceMix || []) {
      const surface = String(surfaceEntry.surface || "unknown");
      entry.surfaceTotals.set(
        surface,
        (entry.surfaceTotals.get(surface) || 0) + Number(surfaceEntry.requestCount || 0)
      );
    }
    stateMap.set(stateCode, entry);
  }

  return [...stateMap.entries()]
    .map(([stateCode, entry]) => {
      const trend: PartnerIntelligenceBriefTopState["trend"] =
        entry.trendScore > 0 ? "up" : entry.trendScore < 0 ? "down" : "flat";
      return {
        rank: 0,
        stateCode,
        requestCount: entry.requestCount,
        countyCount: entry.countyCount,
        dominantSurface:
          [...entry.surfaceTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown",
        trend,
        changePct: Math.round(entry.absoluteChange / Math.max(entry.countyCount, 1)),
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 5)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildDeltaSummary(args: {
  currentTopCounty: PartnerIntelligenceBriefTopCounty | null;
  currentTopStates: PartnerIntelligenceBriefTopState[];
  previousTopCounties: PartnerIntelligenceBriefTopCounty[];
  previousTopStates: PartnerIntelligenceBriefTopState[];
}): PartnerIntelligenceBriefSnapshot["summary"] {
  const currentTopCounty = args.currentTopCounty;
  const previousTopCounty = args.previousTopCounties[0] || null;
  const currentLeadState =
    args.currentTopStates[0]?.stateCode || currentTopCounty?.stateCode || null;
  const previousLeadState =
    args.previousTopStates[0]?.stateCode || previousTopCounty?.stateCode || null;
  const currentLeadSurface = currentTopCounty?.dominantSurface || null;
  const previousLeadSurface = previousTopCounty?.dominantSurface || null;
  const topCountyDelta =
    Number(currentTopCounty?.requestCount || 0) - Number(previousTopCounty?.requestCount || 0);
  const stateCountDelta = args.currentTopStates.length - args.previousTopStates.length;

  const stateDelta =
    currentLeadState && previousLeadState && currentLeadState !== previousLeadState
      ? `State lead changed from ${previousLeadState} to ${currentLeadState}.`
      : currentLeadState
        ? `${currentLeadState} remains the leading state cluster.`
        : "";

  const surfaceDelta =
    currentLeadSurface && previousLeadSurface && currentLeadSurface !== previousLeadSurface
      ? `Surface lead changed from ${previousLeadSurface.replace(/_/g, " ")} to ${currentLeadSurface.replace(/_/g, " ")}.`
      : currentLeadSurface
        ? `${currentLeadSurface.replace(/_/g, " ")} remains the leading surface.`
        : "";

  const deltaSummary =
    previousTopCounty || args.previousTopStates.length > 0
      ? `${topCountyDelta >= 0 ? "+" : ""}${topCountyDelta} top-county requests versus the previous brief. ${stateCountDelta >= 0 ? "+" : ""}${stateCountDelta} states in the top state set. ${currentTopCounty ? `Current lead is ${currentTopCounty.countyName}, ${currentTopCounty.stateCode}.` : ""} ${stateDelta} ${surfaceDelta}`.trim()
      : "No prior brief available yet for delta comparison.";

  return {
    deltaSummary,
    currentLeadCounty: currentTopCounty?.countyName || null,
    currentLeadState,
    currentLeadSurface,
    stateLead: currentLeadState,
  };
}

function buildBriefFromInputs(args: {
  partnerSlug: string;
  generatedAt: string;
  window: PartnerObservationWindow;
  stateCode?: string;
  surface?: string;
  limit: number;
  counties: Awaited<ReturnType<typeof getPartnerCountyObservationSnapshots>>["counties"];
  lisaFeed: Awaited<ReturnType<typeof getLisaFeed>>;
  previousTopCounties?: PartnerIntelligenceBriefTopCounty[];
  previousTopStates?: PartnerIntelligenceBriefTopState[];
}): PartnerIntelligenceBriefSnapshot {
  const counties = args.counties ?? [];
  const totalRequests = counties.reduce((sum, county) => sum + county.requestCount, 0);
  const averageOkRate =
    counties.length > 0
      ? Math.round(counties.reduce((sum, county) => sum + county.okRatePct, 0) / counties.length)
      : 0;
  const topCounty = counties[0] || null;
  const topThree = counties.slice(0, 3).map((county, index) => ({
    rank: index + 1,
    countyFips: county.countyFips,
    countyName: county.countyName,
    stateCode: county.stateCode,
    requestCount: county.requestCount,
    dominantSurface: county.dominantSurface,
    trend: county.trend,
    changePct: county.changePct,
  }));
  const topStates = buildTopStates(counties);

  const surfaceTotals = new Map<string, number>();
  for (const county of counties) {
    for (const entry of county.surfaceMix) {
      const key = String(entry.surface || "unknown");
      surfaceTotals.set(key, (surfaceTotals.get(key) || 0) + Number(entry.requestCount || 0));
    }
  }

  const dominantSurface =
    [...surfaceTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  const dominantSurfaceShare =
    totalRequests > 0 && dominantSurface !== "unknown"
      ? Math.round(((surfaceTotals.get(dominantSurface) || 0) / totalRequests) * 100)
      : 0;

  const executiveSummary =
    counties.length > 0
      ? `${counties.length} counties produced ${totalRequests} crawler-observed requests over the ${args.window} window with an average ${averageOkRate}% OK rate. ${topCounty ? `${topCounty.countyName}, ${topCounty.stateCode} leads right now at ${topCounty.requestCount} requests and ${topCounty.dominantSurface.replace(/_/g, " ")} is the dominant surface.` : ""}`
      : `No counties cleared the current threshold for the ${args.window} window${args.stateCode ? ` in ${args.stateCode}` : ""}${args.surface ? ` on ${args.surface.replace(/_/g, " ")}` : ""}.`;

  const activationSummary =
    counties.length > 0
      ? `${dominantSurface.replace(/_/g, " ")} is driving ${dominantSurfaceShare}% of observed county attention across the filtered set. This is the strongest current activation surface for partner messaging.`
      : "Activation should stay conservative until county observation clears threshold again.";

  return {
    partnerSlug: args.partnerSlug,
    generatedAt: args.generatedAt,
    filters: {
      window: args.window,
      stateCode: args.stateCode || null,
      surface: args.surface || null,
      limit: args.limit,
    },
    executiveSummary,
    activationSummary,
    topCounties: topThree,
    topStates,
    summary: buildDeltaSummary({
      currentTopCounty: topThree[0] || null,
      currentTopStates: topStates,
      previousTopCounties: args.previousTopCounties || [],
      previousTopStates: args.previousTopStates || [],
    }),
    lisa: {
      truthNow: args.lisaFeed.summary.truthNow,
      dataProductionSummary: args.lisaFeed.summary.dataProductionSummary,
      llmOptimizationSummary: args.lisaFeed.summary.llmOptimizationSummary,
      topFindings: args.lisaFeed.feed.slice(0, 3).map((item) => ({
        id: item.id,
        headline: item.headline,
        narrative: item.narrative,
        priority: item.priority,
        truthStatus: item.truthStatus || "current",
        scopeType: item.scopeType || "global",
      })),
    },
  };
}

export async function refreshPartnerIntelligenceBriefSnapshot(params: {
  partnerSlug: string;
  window: PartnerObservationWindow;
  stateCode?: string;
  surface?: string;
  limit?: number;
}): Promise<PartnerIntelligenceBriefSnapshot> {
  await ensurePartnerIntelligenceBriefSnapshotsTable();
  void prunePartnerIntelligenceBriefHistoryIfNeeded();

  const stateCode = String(params.stateCode || "")
    .trim()
    .toUpperCase();
  const surface = String(params.surface || "")
    .trim()
    .toLowerCase();
  const limit = Math.max(25, Math.min(500, Number(params.limit || 100)));

  const [snapshotResult, lisaFeedResult] = await Promise.allSettled([
    getPartnerCountyObservationSnapshots({
      partnerSlug: params.partnerSlug,
      window: params.window,
      stateCode: stateCode || undefined,
      surface: surface || undefined,
      limit,
    }),
    getLisaFeed(),
  ]);

  if (snapshotResult.status === "rejected") {
    console.error(
      "Partner intelligence brief degraded: county observation snapshot unavailable",
      snapshotResult.reason
    );
  }
  if (lisaFeedResult.status === "rejected") {
    console.error(
      "Partner intelligence brief degraded: LISA feed unavailable",
      lisaFeedResult.reason
    );
  }

  const snapshot =
    snapshotResult.status === "fulfilled"
      ? snapshotResult.value
      : {
          generatedAt: new Date().toISOString(),
          counties: [],
        };

  const lisaFeed: Awaited<ReturnType<typeof getLisaFeed>> =
    lisaFeedResult.status === "fulfilled"
      ? lisaFeedResult.value
      : {
          generatedAt: new Date().toISOString(),
          summary: {
            truthNow: "LISA feed unavailable; showing partial intelligence brief.",
            dataProductionSummary: "LISA feed unavailable.",
            llmOptimizationSummary: "LISA feed unavailable.",
          },
          feed: [],
          runtime: {
            mode: "tradescout_local",
            source: "partner brief fallback",
          },
        };

  const previousHistoryResult = await pool.query(
    `
      select top_counties_json, top_states_json
      from tradepartner_intelligence_brief_history
      where partner_slug = $1
        and "window" = $2
        and coalesce(state_code, '') = $3
        and coalesce(surface, '') = $4
        and limit_value = $5
      order by computed_at desc
      limit 1
    `,
    [params.partnerSlug, params.window, stateCode, surface, limit]
  );
  const previousHistoryRow = previousHistoryResult.rows?.[0];

  const brief = buildBriefFromInputs({
    partnerSlug: params.partnerSlug,
    generatedAt: snapshot.generatedAt,
    window: params.window,
    stateCode: stateCode || undefined,
    surface: surface || undefined,
    limit,
    counties: snapshot.counties,
    lisaFeed,
    previousTopCounties: Array.isArray(previousHistoryRow?.top_counties_json)
      ? previousHistoryRow.top_counties_json
      : [],
    previousTopStates: Array.isArray(previousHistoryRow?.top_states_json)
      ? previousHistoryRow.top_states_json
      : [],
  });

  await pool.query("BEGIN");
  try {
    await pool.query(
      `
        delete from tradepartner_intelligence_brief_snapshots
        where partner_slug = $1
          and "window" = $2
          and coalesce(state_code, '') = $3
          and coalesce(surface, '') = $4
          and limit_value = $5
      `,
      [params.partnerSlug, params.window, stateCode, surface, limit]
    );

    await pool.query(
      `
        insert into tradepartner_intelligence_brief_snapshots (
          partner_slug,
          "window",
          state_code,
          surface,
          limit_value,
          executive_summary,
          activation_summary,
          top_counties_json,
          top_states_json,
          summary_json,
          lisa_json,
          computed_at
        )
        values ($1,$2,nullif($3,''),nullif($4,''),$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,now())
      `,
      [
        params.partnerSlug,
        params.window,
        stateCode,
        surface,
        limit,
        brief.executiveSummary,
        brief.activationSummary,
        JSON.stringify(brief.topCounties),
        JSON.stringify(brief.topStates),
        JSON.stringify(brief.summary),
        JSON.stringify(brief.lisa),
      ]
    );

    await pool.query(
      `
        insert into tradepartner_intelligence_brief_history (
          partner_slug,
          "window",
          state_code,
          surface,
          limit_value,
          executive_summary,
          activation_summary,
          top_counties_json,
          top_states_json,
          summary_json,
          lisa_json,
          computed_at
        )
        values ($1,$2,nullif($3,''),nullif($4,''),$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,now())
      `,
      [
        params.partnerSlug,
        params.window,
        stateCode,
        surface,
        limit,
        brief.executiveSummary,
        brief.activationSummary,
        JSON.stringify(brief.topCounties),
        JSON.stringify(brief.topStates),
        JSON.stringify(brief.summary),
        JSON.stringify(brief.lisa),
      ]
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return brief;
}

export async function getPartnerIntelligenceBriefSnapshot(params: {
  partnerSlug: string;
  window: PartnerObservationWindow;
  stateCode?: string;
  surface?: string;
  limit?: number;
  maxSnapshotAgeMinutes?: number;
}): Promise<PartnerIntelligenceBriefSnapshot> {
  await ensurePartnerIntelligenceBriefSnapshotsTable();
  void prunePartnerIntelligenceBriefHistoryIfNeeded();

  const stateCode = String(params.stateCode || "")
    .trim()
    .toUpperCase();
  const surface = String(params.surface || "")
    .trim()
    .toLowerCase();
  const limit = Math.max(25, Math.min(500, Number(params.limit || 100)));
  const maxSnapshotAgeMinutes = Math.max(5, Number(params.maxSnapshotAgeMinutes || 30));

  const result = await pool.query(
    `
      select
        executive_summary,
        activation_summary,
        top_counties_json,
        top_states_json,
        summary_json,
        lisa_json,
        computed_at
      from tradepartner_intelligence_brief_snapshots
      where partner_slug = $1
        and "window" = $2
        and coalesce(state_code, '') = $3
        and coalesce(surface, '') = $4
        and limit_value = $5
      limit 1
    `,
    [params.partnerSlug, params.window, stateCode, surface, limit]
  );

  const row = result.rows?.[0];
  const computedAt = row?.computed_at ? new Date(String(row.computed_at)) : null;
  const isStale =
    !computedAt ||
    !Number.isFinite(computedAt.getTime()) ||
    Date.now() - computedAt.getTime() > maxSnapshotAgeMinutes * 60 * 1000;

  if (!row || isStale) {
    return refreshPartnerIntelligenceBriefSnapshot({
      partnerSlug: params.partnerSlug,
      window: params.window,
      stateCode: stateCode || undefined,
      surface: surface || undefined,
      limit,
    });
  }

  return {
    partnerSlug: params.partnerSlug,
    generatedAt: computedAt.toISOString(),
    filters: {
      window: params.window,
      stateCode: stateCode || null,
      surface: surface || null,
      limit,
    },
    executiveSummary: String(row.executive_summary || ""),
    activationSummary: String(row.activation_summary || ""),
    topCounties: Array.isArray(row.top_counties_json) ? row.top_counties_json : [],
    topStates: Array.isArray(row.top_states_json) ? row.top_states_json : [],
    summary:
      row.summary_json && typeof row.summary_json === "object"
        ? row.summary_json
        : {
            deltaSummary: "No prior brief available yet for delta comparison.",
            currentLeadCounty: null,
            currentLeadState: null,
            currentLeadSurface: null,
            stateLead: null,
          },
    lisa:
      row.lisa_json && typeof row.lisa_json === "object"
        ? row.lisa_json
        : {
            truthNow: "",
            dataProductionSummary: "",
            llmOptimizationSummary: "",
            topFindings: [],
          },
  } as PartnerIntelligenceBriefSnapshot;
}

export async function runPartnerIntelligenceBriefSnapshotJob(): Promise<void> {
  const windows = parseWindowsFromEnv();
  for (const window of windows) {
    await refreshPartnerIntelligenceBriefSnapshot({
      partnerSlug: "cumulus-media",
      window,
      limit: 100,
    });
  }
}

export async function getPartnerIntelligenceBriefHistory(params: {
  partnerSlug: string;
  window: PartnerObservationWindow;
  stateCode?: string;
  surface?: string;
  limit?: number;
}): Promise<PartnerIntelligenceBriefSnapshot[]> {
  await ensurePartnerIntelligenceBriefSnapshotsTable();
  void prunePartnerIntelligenceBriefHistoryIfNeeded();

  const stateCode = String(params.stateCode || "")
    .trim()
    .toUpperCase();
  const surface = String(params.surface || "")
    .trim()
    .toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(params.limit || 10)));

  const result = await pool.query(
    `
      select
        partner_slug,
        "window" as window,
        coalesce(state_code, '') as state_code,
        coalesce(surface, '') as surface,
        limit_value,
        executive_summary,
        activation_summary,
        top_counties_json,
        top_states_json,
        summary_json,
        lisa_json,
        computed_at
      from tradepartner_intelligence_brief_history
      where partner_slug = $1
        and "window" = $2
        and ($3::text = '' or coalesce(state_code, '') = $3)
        and ($4::text = '' or coalesce(surface, '') = $4)
      order by computed_at desc
      limit $5
    `,
    [params.partnerSlug, params.window, stateCode, surface, limit]
  );

  return (result.rows || []).map((row) => ({
    partnerSlug: String(row.partner_slug || params.partnerSlug),
    generatedAt: new Date(String(row.computed_at || new Date().toISOString())).toISOString(),
    filters: {
      window: params.window,
      stateCode: String(row.state_code || "") || null,
      surface: String(row.surface || "") || null,
      limit: Number(row.limit_value || 100),
    },
    executiveSummary: String(row.executive_summary || ""),
    activationSummary: String(row.activation_summary || ""),
    topCounties: Array.isArray(row.top_counties_json) ? row.top_counties_json : [],
    topStates: Array.isArray(row.top_states_json) ? row.top_states_json : [],
    summary:
      row.summary_json && typeof row.summary_json === "object"
        ? row.summary_json
        : {
            deltaSummary: "No prior brief available yet for delta comparison.",
            currentLeadCounty: null,
            currentLeadState: null,
            currentLeadSurface: null,
            stateLead: null,
          },
    lisa:
      row.lisa_json && typeof row.lisa_json === "object"
        ? row.lisa_json
        : {
            truthNow: "",
            dataProductionSummary: "",
            llmOptimizationSummary: "",
            topFindings: [],
          },
  })) as PartnerIntelligenceBriefSnapshot[];
}
