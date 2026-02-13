/**
 * HomeScout Market Metrics Job
 *
 * Purpose:
 * - Compute per-county market context from HomeScout inventory
 * - Writes snapshots to county_metrics (job-only, UI reads precomputed values)
 *
 * Metrics:
 * - homescout_median_price (integer dollars)
 * - homescout_median_dom_days (integer days)
 *
 * Notes:
 * - Active listings only
 * - DOM uses now() - listed_at when listed_at is present
 */

import { pool } from "../db";
import { writeMetricsBatch, type MetricWriteRequest } from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

type CountyMarketRow = {
  countyFips: string;
  medianPrice: number | null;
  medianDomDays: number | null;
  priceDrops7d: number;
};

interface JobResult {
  timestamp: Date;
  sampledCounties: number;
  metricsWritten: number;
  errors: Array<{ county: string; error: string }>;
}

async function computeCountyMedians(): Promise<CountyMarketRow[]> {
  const result = await pool.query(`
    WITH active AS (
      SELECT
        county_fips,
        price::numeric as price_num,
        listed_at,
        price_changed_at,
        price_previous,
        price::numeric as price_current
      FROM home_scout_listings
      WHERE status = 'active'
        AND county_fips IS NOT NULL
    ),
    price_med AS (
      SELECT
        county_fips,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_num) AS median_price
      FROM active
      WHERE price_num IS NOT NULL
      GROUP BY county_fips
    ),
    dom_med AS (
      SELECT
        county_fips,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY (extract(epoch from (now() - listed_at)) / 86400.0)
        ) AS median_dom_days
      FROM active
      WHERE listed_at IS NOT NULL
      GROUP BY county_fips
    ),
    drops_7d AS (
      SELECT
        county_fips,
        COUNT(*)::int as price_drops_7d
      FROM active
      WHERE price_changed_at IS NOT NULL
        AND price_changed_at >= (now() - interval '7 days')
        AND price_previous IS NOT NULL
        AND price_previous::numeric > price_current
      GROUP BY county_fips
    )
    SELECT
      c.county_fips as "countyFips",
      pm.median_price as "medianPrice",
      dm.median_dom_days as "medianDomDays",
      COALESCE(d7.price_drops_7d, 0) as "priceDrops7d"
    FROM (
      SELECT DISTINCT county_fips FROM active
    ) c
    LEFT JOIN price_med pm ON pm.county_fips = c.county_fips
    LEFT JOIN dom_med dm ON dm.county_fips = c.county_fips
    LEFT JOIN drops_7d d7 ON d7.county_fips = c.county_fips
    ORDER BY c.county_fips
  `);

  return (result.rows || []).map((r: any) => ({
    countyFips: String(r.countyFips || ""),
    medianPrice: r.medianPrice == null || r.medianPrice === "" ? null : Number(r.medianPrice),
    medianDomDays:
      r.medianDomDays == null || r.medianDomDays === "" ? null : Number(r.medianDomDays),
    priceDrops7d: Number(r.priceDrops7d) || 0,
  }));
}

export async function runHomeScoutMarketMetricsJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `homescout-market-${startTime.toISOString()}`;

  console.info(`[HomeScoutMarketMetricsJob] ${jobId} starting...`);

  const rows = await computeCountyMedians();
  if (!rows.length) {
    console.warn(`[HomeScoutMarketMetricsJob] ${jobId} no active counties found`);
    return { timestamp: startTime, sampledCounties: 0, metricsWritten: 0, errors: [] };
  }

  const errors: Array<{ county: string; error: string }> = [];
  let written = 0;

  for (const row of rows) {
    const fips = row.countyFips;
    if (!/^\d{5}$/.test(fips)) continue;

    const requests: MetricWriteRequest[] = [];

    if (Number.isFinite(row.medianPrice as any)) {
      const medianPrice = Math.max(0, Math.round(Number(row.medianPrice)));
      requests.push({
        source: "homescout_market_metrics_job",
        metricKey: MetricKey.HOMESCOUT_MEDIAN_PRICE,
        countyFips: fips,
        value: medianPrice,
        mode: "set",
        asOf: startTime,
      });
    }

    if (Number.isFinite(row.medianDomDays as any)) {
      const domDays = Math.max(0, Math.round(Number(row.medianDomDays)));
      requests.push({
        source: "homescout_market_metrics_job",
        metricKey: MetricKey.HOMESCOUT_MEDIAN_DOM_DAYS,
        countyFips: fips,
        value: domDays,
        mode: "set",
        asOf: startTime,
      });
    }

    requests.push({
      source: "homescout_market_metrics_job",
      metricKey: MetricKey.HOMESCOUT_PRICE_DROPS_7D,
      countyFips: fips,
      value: Math.max(0, Math.round(Number(row.priceDrops7d || 0))),
      mode: "set",
      asOf: startTime,
    });

    for (const req of requests) {
      try {
        await writeMetricsBatch([req]);
        written++;
      } catch (err) {
        errors.push({
          county: fips,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  console.info(`[HomeScoutMarketMetricsJob] ${jobId} completed`, {
    counties: rows.length,
    metricsWritten: written,
    errors: errors.length,
  });

  return {
    timestamp: startTime,
    sampledCounties: rows.length,
    metricsWritten: written,
    errors,
  };
}
