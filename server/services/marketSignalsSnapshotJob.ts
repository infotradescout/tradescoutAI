import { pool } from "../db";

const WINDOWS = [
  { key: "1h", interval: "1 hour" },
  { key: "24h", interval: "24 hours" },
  { key: "7d", interval: "7 days" },
  { key: "30d", interval: "30 days" },
  { key: "90d", interval: "90 days" },
] as const;

type WindowKey = (typeof WINDOWS)[number]["key"];
type ScopeType = "county" | "state" | "global";
type SnapshotKind = "county_demand" | "activation_readiness";

let ensured = false;

export interface MarketSignalsSnapshotJobResult {
  timestamp: Date;
  window: WindowKey;
  countyDemandRows: number;
  activationRows: number;
}

function clampInt(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeCategory(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function ensureMarketSignalsSnapshotTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_signals_snapshots (
      snapshot_kind VARCHAR(64) NOT NULL,
      window_key VARCHAR(8) NOT NULL,
      scope_type VARCHAR(16) NOT NULL,
      scope_id VARCHAR(32) NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (snapshot_kind, window_key, scope_type, scope_id)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_market_signals_snapshots_generated_at
      ON market_signals_snapshots (generated_at DESC);
  `);
  ensured = true;
}

async function upsertSnapshot(args: {
  kind: SnapshotKind;
  window: WindowKey;
  scopeType: ScopeType;
  scopeId: string;
  payload: Record<string, unknown>;
  generatedAt: Date;
}) {
  await pool.query(
    `
      INSERT INTO market_signals_snapshots (
        snapshot_kind, window_key, scope_type, scope_id, payload, generated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      ON CONFLICT (snapshot_kind, window_key, scope_type, scope_id)
      DO UPDATE SET payload = EXCLUDED.payload, generated_at = EXCLUDED.generated_at
    `,
    [
      args.kind,
      args.window,
      args.scopeType,
      args.scopeId,
      JSON.stringify(args.payload),
      args.generatedAt,
    ]
  );
}

export async function getMarketSignalsSnapshot(args: {
  kind: SnapshotKind;
  window: WindowKey;
  scopeType: ScopeType;
  scopeId: string;
}) {
  await ensureMarketSignalsSnapshotTables();
  const result = await pool.query(
    `
      SELECT payload, generated_at
      FROM market_signals_snapshots
      WHERE snapshot_kind = $1
        AND window_key = $2
        AND scope_type = $3
        AND scope_id = $4
      LIMIT 1
    `,
    [args.kind, args.window, args.scopeType, args.scopeId]
  );
  const row = result.rows?.[0];
  if (!row) return null;
  return {
    payload: (row.payload || {}) as Record<string, unknown>,
    generatedAt: row.generated_at ? new Date(String(row.generated_at)).toISOString() : null,
  };
}

async function buildCountyDemandSnapshots(window: WindowKey, interval: string, generatedAt: Date) {
  const [countyRowsResult, categoryRowsResult, metricsResult] = await Promise.all([
    pool.query(
      `
        SELECT
          county_fips,
          count(*)::int as interaction_count,
          round(avg(scout_confidence))::int as avg_confidence,
          count(*) filter (where outcome = 'success')::int as success_count,
          count(*) filter (where outcome = 'partial_success')::int as partial_success_count
        FROM scout_interactions
        WHERE county_fips IS NOT NULL
          AND county_fips <> ''
          AND created_at >= (now() - ($1::interval))
        GROUP BY county_fips
      `,
      [interval]
    ),
    pool.query(
      `
        WITH ranked AS (
          SELECT
            county_fips,
            intent,
            count(*)::int as volume,
            row_number() over (
              partition by county_fips
              order by count(*) desc, intent asc
            ) as rn
          FROM scout_interactions
          WHERE county_fips IS NOT NULL
            AND county_fips <> ''
            AND created_at >= (now() - ($1::interval))
          GROUP BY county_fips, intent
        )
        SELECT county_fips, intent, volume
        FROM ranked
        WHERE rn <= 5
      `,
      [interval]
    ),
    pool.query(
      `
        SELECT county_fips, metric_key, metric_value
        FROM county_metrics
        WHERE metric_key IN (
          'homescout_active_listings',
          'homescout_price_drops_7d',
          'tradedeals_active'
        )
      `
    ),
  ]);

  const categoryMap = new Map<
    string,
    Array<{ category: string; direction: string; changePct: number }>
  >();
  for (const row of categoryRowsResult.rows || []) {
    const countyFips = String(row.county_fips || "");
    if (!countyFips) continue;
    const list = categoryMap.get(countyFips) || [];
    list.push({
      category: String(row.intent || "unknown"),
      direction: "up",
      changePct: Number(row.volume || 0),
    });
    categoryMap.set(countyFips, list);
  }

  const metricMap = new Map<string, Map<string, number>>();
  for (const row of metricsResult.rows || []) {
    const countyFips = String(row.county_fips || "");
    if (!countyFips) continue;
    const bucket = metricMap.get(countyFips) || new Map<string, number>();
    bucket.set(String(row.metric_key || ""), Number(row.metric_value || 0));
    metricMap.set(countyFips, bucket);
  }

  let count = 0;
  for (const row of countyRowsResult.rows || []) {
    const countyFips = String(row.county_fips || "");
    if (!countyFips) continue;

    const interactionCount = Number(row.interaction_count || 0);
    if (interactionCount < 25) {
      await upsertSnapshot({
        kind: "county_demand",
        window,
        scopeType: "county",
        scopeId: countyFips,
        payload: {
          status: "suppressed",
          reason: "minimum_threshold_not_met",
          countyFips,
          window,
        },
        generatedAt,
      });
      count++;
      continue;
    }

    const metrics = metricMap.get(countyFips) || new Map<string, number>();
    const avgConfidence = Number(row.avg_confidence || 0);
    const successCount = Number(row.success_count || 0);
    const partialSuccessCount = Number(row.partial_success_count || 0);

    const trustWeightedDemandIndex = clampInt(
      interactionCount * 0.55 +
        avgConfidence * 0.35 +
        successCount * 1.2 +
        partialSuccessCount * 0.5
    );
    const inventoryPressureIndex = clampInt(
      Number(metrics.get("homescout_active_listings") || 0) * 0.6 +
        Number(metrics.get("homescout_price_drops_7d") || 0) * 2.4
    );
    const conversionReadinessIndex = clampInt(
      successCount * 2 + Number(metrics.get("tradedeals_active") || 0) * 3 + avgConfidence * 0.4
    );

    await upsertSnapshot({
      kind: "county_demand",
      window,
      scopeType: "county",
      scopeId: countyFips,
      payload: {
        status: "ok",
        countyFips,
        window,
        signals: {
          demandIndex: clampInt(interactionCount * 1.5),
          trustWeightedDemandIndex,
          inventoryPressureIndex,
          conversionReadinessIndex,
        },
        topCategories: categoryMap.get(countyFips) || [],
      },
      generatedAt,
    });
    count++;
  }

  return count;
}

async function buildActivationSnapshots(window: WindowKey, interval: string, generatedAt: Date) {
  const [
    countyLookupResult,
    countyInteractionsResult,
    countyObjectivesResult,
    countyMetricsResult,
  ] = await Promise.all([
    pool.query(
      `
          SELECT fips, state_code
          FROM counties
          WHERE fips IS NOT NULL
            AND fips <> ''
            AND state_code IS NOT NULL
            AND state_code <> ''
        `
    ),
    pool.query(
      `
          SELECT county_fips, count(*)::int as interaction_count
          FROM scout_interactions
          WHERE county_fips IS NOT NULL
            AND county_fips <> ''
            AND created_at >= (now() - ($1::interval))
          GROUP BY county_fips
        `,
      [interval]
    ),
    pool.query(
      `
          SELECT
            COALESCE(context_json ->> 'countyFips', '') as county_fips,
            COALESCE(intent_class, 'unknown') as intent_class,
            count(*)::int as active_objective_count
          FROM objectives
          WHERE status = 'active'
            AND created_at >= (now() - ($1::interval))
          GROUP BY COALESCE(context_json ->> 'countyFips', ''), COALESCE(intent_class, 'unknown')
        `,
      [interval]
    ),
    pool.query(
      `
          SELECT county_fips, metric_key, metric_value
          FROM county_metrics
          WHERE metric_key IN ('tradedeals_active', 'homescout_active_listings', 'observations_30d')
        `
    ),
  ]);

  const countyToState = new Map<string, string>();
  for (const row of countyLookupResult.rows || []) {
    const fips = String(row.fips || "");
    const state = String(row.state_code || "").toUpperCase();
    if (!fips || !state) continue;
    countyToState.set(fips, state);
  }

  const countyInteractions = new Map<string, number>();
  for (const row of countyInteractionsResult.rows || []) {
    const countyFips = String(row.county_fips || "");
    if (!countyFips) continue;
    countyInteractions.set(countyFips, Number(row.interaction_count || 0));
  }

  const countyObjectivesTotal = new Map<string, number>();
  const countyObjectivesByCategory = new Map<string, Map<string, number>>();
  for (const row of countyObjectivesResult.rows || []) {
    const countyFips = String(row.county_fips || "");
    const category = normalizeCategory(row.intent_class) || "unknown";
    const count = Number(row.active_objective_count || 0);
    if (!countyFips) continue;

    countyObjectivesTotal.set(
      countyFips,
      Number(countyObjectivesTotal.get(countyFips) || 0) + count
    );
    const bucket = countyObjectivesByCategory.get(countyFips) || new Map<string, number>();
    bucket.set(category, Number(bucket.get(category) || 0) + count);
    countyObjectivesByCategory.set(countyFips, bucket);
  }

  const countyMetrics = new Map<string, Map<string, number>>();
  for (const row of countyMetricsResult.rows || []) {
    const countyFips = String(row.county_fips || "");
    if (!countyFips) continue;
    const bucket = countyMetrics.get(countyFips) || new Map<string, number>();
    bucket.set(String(row.metric_key || ""), Number(row.metric_value || 0));
    countyMetrics.set(countyFips, bucket);
  }

  const stateInteractions = new Map<string, number>();
  const stateObjectivesTotal = new Map<string, number>();
  const stateObjectivesByCategory = new Map<string, Map<string, number>>();
  const globalObjectivesByCategory = new Map<string, number>();
  let globalInteractionCount = 0;
  let globalObjectiveCount = 0;

  for (const [countyFips, interactionCount] of countyInteractions.entries()) {
    globalInteractionCount += interactionCount;
    const stateCode = countyToState.get(countyFips);
    if (stateCode) {
      stateInteractions.set(
        stateCode,
        Number(stateInteractions.get(stateCode) || 0) + interactionCount
      );
    }
  }

  for (const [countyFips, total] of countyObjectivesTotal.entries()) {
    globalObjectiveCount += total;
    const stateCode = countyToState.get(countyFips);
    if (stateCode) {
      stateObjectivesTotal.set(stateCode, Number(stateObjectivesTotal.get(stateCode) || 0) + total);
    }
  }

  for (const [countyFips, byCategory] of countyObjectivesByCategory.entries()) {
    const stateCode = countyToState.get(countyFips);
    for (const [category, count] of byCategory.entries()) {
      globalObjectivesByCategory.set(
        category,
        Number(globalObjectivesByCategory.get(category) || 0) + count
      );
      if (stateCode) {
        const stateBucket = stateObjectivesByCategory.get(stateCode) || new Map<string, number>();
        stateBucket.set(category, Number(stateBucket.get(category) || 0) + count);
        stateObjectivesByCategory.set(stateCode, stateBucket);
      }
    }
  }

  const buildPayload = (args: {
    interactionCount: number;
    activeObjectiveCount: number;
    byCategory: Map<string, number>;
    metrics?: Map<string, number>;
  }) => {
    const observations30d = Number(args.metrics?.get("observations_30d") || 0);
    const tradeDealsActive = Number(args.metrics?.get("tradedeals_active") || 0);
    const homeScoutActiveListings = Number(args.metrics?.get("homescout_active_listings") || 0);

    const marketActivationScore = clampInt(
      args.interactionCount * 1.2 + args.activeObjectiveCount * 1.8 + observations30d * 0.15
    );
    const sponsorReadinessScore = clampInt(
      marketActivationScore * 0.55 + tradeDealsActive * 6 + homeScoutActiveListings * 0.4
    );

    const categoryScores: Record<
      string,
      { marketActivationScore: number; sponsorReadinessScore: number }
    > = {};
    for (const [category, categoryObjectiveCount] of args.byCategory.entries()) {
      const categoryActivationScore = clampInt(
        args.interactionCount * 1.2 + categoryObjectiveCount * 1.8 + observations30d * 0.15
      );
      categoryScores[category] = {
        marketActivationScore: categoryActivationScore,
        sponsorReadinessScore: clampInt(
          categoryActivationScore * 0.55 + tradeDealsActive * 6 + homeScoutActiveListings * 0.4
        ),
      };
    }

    const recommendedSurface =
      homeScoutActiveListings > 0
        ? "homescout_listings"
        : tradeDealsActive > 0
          ? "trade_deals"
          : "scout";

    return {
      interactionCount: args.interactionCount,
      activeObjectiveCount: args.activeObjectiveCount,
      objectivesByCategory: Object.fromEntries(args.byCategory.entries()),
      marketActivationScore,
      sponsorReadinessScore,
      categoryScores,
      recommendedSurface,
      meetsMinimumAudienceThreshold: args.interactionCount >= 25,
    };
  };

  let count = 0;

  for (const [countyFips] of countyToState.entries()) {
    const payload = buildPayload({
      interactionCount: Number(countyInteractions.get(countyFips) || 0),
      activeObjectiveCount: Number(countyObjectivesTotal.get(countyFips) || 0),
      byCategory: countyObjectivesByCategory.get(countyFips) || new Map<string, number>(),
      metrics: countyMetrics.get(countyFips) || new Map<string, number>(),
    });
    await upsertSnapshot({
      kind: "activation_readiness",
      window,
      scopeType: "county",
      scopeId: countyFips,
      payload,
      generatedAt,
    });
    count++;
  }

  for (const [stateCode, interactionCount] of stateInteractions.entries()) {
    const payload = buildPayload({
      interactionCount: Number(interactionCount || 0),
      activeObjectiveCount: Number(stateObjectivesTotal.get(stateCode) || 0),
      byCategory: stateObjectivesByCategory.get(stateCode) || new Map<string, number>(),
      metrics: new Map<string, number>(),
    });
    await upsertSnapshot({
      kind: "activation_readiness",
      window,
      scopeType: "state",
      scopeId: stateCode,
      payload,
      generatedAt,
    });
    count++;
  }

  const globalPayload = buildPayload({
    interactionCount: globalInteractionCount,
    activeObjectiveCount: globalObjectiveCount,
    byCategory: globalObjectivesByCategory,
    metrics: new Map<string, number>(),
  });
  await upsertSnapshot({
    kind: "activation_readiness",
    window,
    scopeType: "global",
    scopeId: "global",
    payload: globalPayload,
    generatedAt,
  });
  count++;

  return count;
}

export async function runMarketSignalsSnapshotJob(): Promise<MarketSignalsSnapshotJobResult[]> {
  await ensureMarketSignalsSnapshotTables();
  const generatedAt = new Date();
  const results: MarketSignalsSnapshotJobResult[] = [];

  for (const window of WINDOWS) {
    const countyDemandRows = await buildCountyDemandSnapshots(
      window.key,
      window.interval,
      generatedAt
    );
    const activationRows = await buildActivationSnapshots(window.key, window.interval, generatedAt);
    results.push({
      timestamp: generatedAt,
      window: window.key,
      countyDemandRows,
      activationRows,
    });
  }

  return results;
}
