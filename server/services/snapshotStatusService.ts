import { pool } from "../db";
import { MetricKey } from "./metricRegistry";

type SnapshotStatusRow = {
  key:
    | "partner_county_observation"
    | "partner_intelligence_brief"
    | "live_stream"
    | "seo_trade_county_pages"
    | "seo_trade_city_pages"
    | "county_price_homescout"
    | "county_price_tradedeals"
    | "county_price_completed_jobs";
  label: string;
  latestComputedAt: string | null;
  rowCount: number;
  staleAfterMinutes: number;
  isStale: boolean;
  metricKeys?: string[];
  countyCount?: number;
  staleCountyCount?: number;
};

export type SnapshotStatusSummary = {
  generatedAt: string;
  schedulerEnabled: boolean;
  statuses: SnapshotStatusRow[];
};

async function querySnapshotStatus(args: {
  table: string;
  timestampColumn: string;
  key: SnapshotStatusRow["key"];
  label: string;
  staleAfterMinutes: number;
}): Promise<SnapshotStatusRow> {
  let result;
  try {
    result = await pool.query(
      `
        select
          max(${args.timestampColumn}) as latest_computed_at,
          count(*)::int as row_count
        from ${args.table}
      `
    );
  } catch (error) {
    console.warn(`[snapshot-status] degraded ${args.table}:`, error);
    result = { rows: [{ latest_computed_at: null, row_count: 0 }] };
  }

  const latestComputedAtRaw = result.rows?.[0]?.latest_computed_at;
  const rowCount = Number(result.rows?.[0]?.row_count || 0);
  const latestComputedAt = latestComputedAtRaw ? new Date(String(latestComputedAtRaw)) : null;
  const isStale =
    !latestComputedAt ||
    !Number.isFinite(latestComputedAt.getTime()) ||
    Date.now() - latestComputedAt.getTime() > args.staleAfterMinutes * 60 * 1000;

  return {
    key: args.key,
    label: args.label,
    latestComputedAt:
      latestComputedAt && Number.isFinite(latestComputedAt.getTime())
        ? latestComputedAt.toISOString()
        : null,
    rowCount,
    staleAfterMinutes: args.staleAfterMinutes,
    isStale,
  };
}

const COUNTY_PRICE_SIGNAL_STALE_AFTER_MINUTES = 60 * 36;

const COUNTY_PRICE_SIGNAL_FAMILIES: Array<{
  key: SnapshotStatusRow["key"];
  label: string;
  metricKeys: MetricKey[];
}> = [
  {
    key: "county_price_homescout",
    label: "County Price Signals - HomeScout",
    metricKeys: [
      MetricKey.HOMESCOUT_MEDIAN_PRICE,
      MetricKey.HOMESCOUT_MEDIAN_DOM_DAYS,
      MetricKey.HOMESCOUT_PRICE_DROPS_7D,
    ],
  },
  {
    key: "county_price_tradedeals",
    label: "County Price Signals - TradeDeals",
    metricKeys: [MetricKey.TRADEDEALS_ACTIVE, MetricKey.TRADEDEALS_CLAIMED_30D],
  },
  {
    key: "county_price_completed_jobs",
    label: "County Price Signals - Completed Jobs",
    metricKeys: [MetricKey.COMPLETED_JOBS_30D, MetricKey.COMPLETED_JOB_MEDIAN_RECEIPT_USD_30D],
  },
];

async function queryCountyPriceSignalStatus(args: {
  key: SnapshotStatusRow["key"];
  label: string;
  metricKeys: MetricKey[];
}): Promise<SnapshotStatusRow> {
  let result;
  try {
    result = await pool.query(
      `
        select
          max(updated_at) as latest_computed_at,
          count(*)::int as row_count,
          count(distinct county_fips)::int as county_count,
          count(distinct county_fips) filter (
            where updated_at is null
              or updated_at < (now() - ($2::int * interval '1 minute'))
          )::int as stale_county_count
        from county_metrics
        where metric_key = any($1::text[])
      `,
      [args.metricKeys, COUNTY_PRICE_SIGNAL_STALE_AFTER_MINUTES]
    );
  } catch (error) {
    console.warn(`[snapshot-status] degraded county_metrics ${args.key}:`, error);
    result = {
      rows: [
        {
          latest_computed_at: null,
          row_count: 0,
          county_count: 0,
          stale_county_count: 0,
        },
      ],
    };
  }

  const latestComputedAtRaw = result.rows?.[0]?.latest_computed_at;
  const rowCount = Number(result.rows?.[0]?.row_count || 0);
  const countyCount = Number(result.rows?.[0]?.county_count || 0);
  const staleCountyCount = Number(result.rows?.[0]?.stale_county_count || 0);
  const latestComputedAt = latestComputedAtRaw ? new Date(String(latestComputedAtRaw)) : null;
  const isStale =
    rowCount === 0 ||
    staleCountyCount > 0 ||
    !latestComputedAt ||
    !Number.isFinite(latestComputedAt.getTime()) ||
    Date.now() - latestComputedAt.getTime() > COUNTY_PRICE_SIGNAL_STALE_AFTER_MINUTES * 60 * 1000;

  return {
    key: args.key,
    label: args.label,
    latestComputedAt:
      latestComputedAt && Number.isFinite(latestComputedAt.getTime())
        ? latestComputedAt.toISOString()
        : null,
    rowCount,
    staleAfterMinutes: COUNTY_PRICE_SIGNAL_STALE_AFTER_MINUTES,
    isStale,
    metricKeys: args.metricKeys,
    countyCount,
    staleCountyCount,
  };
}

export async function getSnapshotStatusSummary(): Promise<SnapshotStatusSummary> {
  const statuses = await Promise.all([
    querySnapshotStatus({
      table: "tradepartner_county_observation_snapshots",
      timestampColumn: "computed_at",
      key: "partner_county_observation",
      label: "Partner County Observation",
      staleAfterMinutes: 30,
    }),
    querySnapshotStatus({
      table: "tradepartner_intelligence_brief_snapshots",
      timestampColumn: "computed_at",
      key: "partner_intelligence_brief",
      label: "Partner Intelligence Brief",
      staleAfterMinutes: 30,
    }),
    querySnapshotStatus({
      table: "admin_live_stream_snapshots",
      timestampColumn: "computed_at",
      key: "live_stream",
      label: "Admin Live Stream",
      staleAfterMinutes: 10,
    }),
    querySnapshotStatus({
      table: "ts_seo_trade_county_pages",
      timestampColumn: "updated_at",
      key: "seo_trade_county_pages",
      label: "SEO Trade County Pages",
      staleAfterMinutes: 60 * 12,
    }),
    querySnapshotStatus({
      table: "ts_seo_trade_city_pages",
      timestampColumn: "updated_at",
      key: "seo_trade_city_pages",
      label: "SEO Trade City Pages",
      staleAfterMinutes: 60 * 12,
    }),
    ...COUNTY_PRICE_SIGNAL_FAMILIES.map((family) => queryCountyPriceSignalStatus(family)),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    schedulerEnabled: String(process.env.SCHEDULER_ENABLED || "").toLowerCase() === "true",
    statuses,
  };
}
