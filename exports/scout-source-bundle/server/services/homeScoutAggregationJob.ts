/**
 * HomeScout Aggregation Job
 *
 * Purpose:
 * - Compute per-county active HomeScout listings count
 * - Write homescout_active_listings metric for each county
 * - Idempotent (set mode); fire-and-forget
 *
 * Design:
 * Groups home_scout_listings by county_fips and counts status='active' rows.
 * Uses geographic data router to write metrics.
 */

import { pool } from "../db";
import { writeMetricsBatch, type MetricWriteRequest } from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

interface CountyHomeScoutAggregate {
  countyFips: string;
  activeCount: number;
}

interface JobResult {
  timestamp: Date;
  sampledCounties: number;
  totalRecordsProcessed: number;
  metricsWritten: number;
  errors: Array<{ county: string; error: string }>;
}

async function aggregateActiveListingsByCounty(): Promise<CountyHomeScoutAggregate[]> {
  console.info("[HomeScoutAggregationJob] Starting HomeScout aggregation...");

  try {
    const result = await pool.query(`
      SELECT
        hsl.county_fips as "countyFips",
        COUNT(*) as active_count
      FROM home_scout_listings hsl
      WHERE hsl.county_fips IS NOT NULL
        AND hsl.status = 'active'
      GROUP BY hsl.county_fips
      ORDER BY hsl.county_fips
    `);

    if (!result || !Array.isArray(result.rows)) {
      throw new Error("Failed to aggregate HomeScout listings by county");
    }

    const aggregates: CountyHomeScoutAggregate[] = result.rows.map((row: any) => ({
      countyFips: String(row.countyFips || ""),
      activeCount: Number(row.active_count) || 0,
    }));

    console.info(`[HomeScoutAggregationJob] Aggregated ${aggregates.length} counties`);
    return aggregates;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[HomeScoutAggregationJob] Aggregation failed:", error);
    throw new Error(`HomeScout aggregation failed: ${error}`);
  }
}

export async function runHomeScoutAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `homescout-agg-${startTime.toISOString()}`;

  console.info(`[HomeScoutAggregationJob] ${jobId} starting...`);

  const aggregates = await aggregateActiveListingsByCounty();
  if (aggregates.length === 0) {
    console.warn(`[HomeScoutAggregationJob] ${jobId} found no counties with active listings`);
    return {
      timestamp: startTime,
      sampledCounties: 0,
      totalRecordsProcessed: 0,
      metricsWritten: 0,
      errors: [],
    };
  }

  const requests: MetricWriteRequest[] = [];
  for (const agg of aggregates) {
    if (!agg.countyFips || agg.countyFips.length !== 5 || !/^\d+$/.test(agg.countyFips)) {
      console.warn(`[HomeScoutAggregationJob] Skipping invalid FIPS: ${agg.countyFips}`);
      continue;
    }

    requests.push({
      source: "homescout_aggregation_job",
      metricKey: MetricKey.HOMESCOUT_ACTIVE_LISTINGS,
      countyFips: agg.countyFips,
      value: agg.activeCount,
      mode: "set",
      asOf: startTime,
    });
  }

  const errors: Array<{ county: string; error: string }> = [];
  let written = 0;

  for (const req of requests) {
    try {
      await writeMetricsBatch([req]);
      written++;
    } catch (err) {
      errors.push({
        county: req.countyFips,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const elapsed = Date.now() - startTime.getTime();
  console.info(`[HomeScoutAggregationJob] ${jobId} completed`, {
    counties: aggregates.length,
    metricsRequested: requests.length,
    metricsWritten: written,
    errors: errors.length,
    elapsedMs: elapsed,
  });

  return {
    timestamp: startTime,
    sampledCounties: aggregates.length,
    totalRecordsProcessed: aggregates.length,
    metricsWritten: written,
    errors,
  };
}
