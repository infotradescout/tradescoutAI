/**
 * TradeDeals Aggregation Job (Phase 2b)
 *
 * Purpose:
 * - Compute per-county active TradeDeals and 30-day claims
 * - Write tradedeals_active and tradedeals_claimed_30d metrics
 * - Idempotent (set mode); fire-and-forget
 * - Runs nightly alongside other aggregation jobs
 *
 * Design:
 * Groups trade deals by county_fips.
 * Counts: active deals (status=active), deals claimed in last 30 days.
 * Uses geographic data router to write metrics.
 * No UI, no user-facing behavior. Purely data aggregation.
 */

import { pool } from "../db";
import {
  writeMetricsBatch,
  MetricWriteRequest,
} from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

// ============================================================================
// TYPES
// ============================================================================

interface CountyTradeDealsAggregate {
  countyFips: string;
  activeCount: number;
  claimed30dCount: number;
}

interface JobResult {
  timestamp: Date;
  sampledCounties: number;
  totalRecordsProcessed: number;
  metricsWritten: number;
  errors: Array<{ county: string; error: string }>;
}

// ============================================================================
// AGGREGATION LOGIC
// ============================================================================

/**
 * Aggregate TradeDeals by county
 *
 * Flow:
 * 1. Group trade_deals by county_fips
 * 2. Count active deals (status = 'active')
 * 3. Count deals claimed in last 30 days (claimed_at >= now() - interval '30 days')
 * 4. Filter out null/empty FIPS codes
 *
 * Returns list of counties with their TradeDeals counts
 */
async function aggregateTradeDealsByCounty(): Promise<CountyTradeDealsAggregate[]> {
  console.info("[TradeDealsAggregationJob] Starting trade deals aggregation...");

  try {
    // Raw SQL aggregation for performance
    // Get both active and 30-day claimed counts in one query
    const result = await pool.query(`
      SELECT
        td.county_fips as "countyFips",
        COUNT(CASE WHEN td.status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN td.claimed_at >= NOW() - INTERVAL '30 days' THEN 1 END) as claimed_30d_count
      FROM trade_deals td
      WHERE td.county_fips IS NOT NULL
      GROUP BY td.county_fips
      ORDER BY td.county_fips
    `);

    if (!result || !Array.isArray(result.rows)) {
      throw new Error("Failed to aggregate trade deals by county");
    }

    const aggregates: CountyTradeDealsAggregate[] = result.rows.map((row: any) => ({
      countyFips: row.countyFips,
      activeCount: Number(row.active_count) || 0,
      claimed30dCount: Number(row.claimed_30d_count) || 0,
    }));

    console.info(
      `[TradeDealsAggregationJob] Aggregated ${aggregates.length} counties`
    );

    return aggregates;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[TradeDealsAggregationJob] Aggregation failed:", error);
    throw new Error(`Trade deals aggregation failed: ${error}`);
  }
}

// ============================================================================
// JOB EXECUTION
// ============================================================================

/**
 * Execute the nightly trade deals aggregation job
 *
 * Idempotent: set mode ensures replaying the job produces same result
 * Fire-and-forget: logs success/error, continues on partial failures
 *
 * @returns Job result with metrics written and any errors
 */
export async function runTradeDealsAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `tradedeals-agg-${startTime.toISOString()}`;

  console.info(`[TradeDealsAggregationJob] ${jobId} starting...`);

  try {
    // Step 1: Aggregate trade deals by county
    const aggregates = await aggregateTradeDealsByCounty();

    if (aggregates.length === 0) {
      console.warn(`[TradeDealsAggregationJob] ${jobId} found no counties with trade deals`);
      return {
        timestamp: startTime,
        sampledCounties: 0,
        totalRecordsProcessed: 0,
        metricsWritten: 0,
        errors: [],
      };
    }

    // Step 2: Build metric write requests (two metrics per county)
    const requests: MetricWriteRequest[] = [];

    for (const agg of aggregates) {
      // Skip if countyFips is invalid
      if (!agg.countyFips || agg.countyFips.length !== 5 || !/^\d+$/.test(agg.countyFips)) {
        console.warn(
          `[TradeDealsAggregationJob] Skipping invalid FIPS: ${agg.countyFips}`
        );
        continue;
      }

      // Write two metrics per county
      requests.push(
        {
          source: "tradedeals_aggregation_job",
          metricKey: MetricKey.TRADEDEALS_ACTIVE,
          countyFips: agg.countyFips,
          value: agg.activeCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "tradedeals_aggregation_job",
          metricKey: MetricKey.TRADEDEALS_CLAIMED_30D,
          countyFips: agg.countyFips,
          value: agg.claimed30dCount,
          mode: "set",
          asOf: startTime,
        }
      );
    }

    // Step 3: Write all metrics via router
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

    console.info(
      `[TradeDealsAggregationJob] ${jobId} completed`,
      {
        counties: aggregates.length,
        metricsRequested: requests.length,
        metricsWritten: written,
        errors: errors.length,
        elapsedMs: elapsed,
      }
    );

    // Log errors if any
    if (errors.length > 0) {
      console.warn(
        `[TradeDealsAggregationJob] ${jobId} had ${errors.length} errors:`,
        errors.slice(0, 5) // Log first 5
      );
    }

    return {
      timestamp: startTime,
      sampledCounties: aggregates.length,
      totalRecordsProcessed: aggregates.length,
      metricsWritten: written,
      errors,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[TradeDealsAggregationJob] ${jobId} FAILED:`, error);

    throw new Error(`Trade deals aggregation job failed: ${error}`);
  }
}

// ============================================================================
// VALIDATION / TEST HELPERS
// ============================================================================

/**
 * Validate aggregated metrics against database
 * Used for acceptance testing: verify counts match DB for sampled counties
 *
 * @param sampleSize - Number of counties to spot-check (default 3)
 * @returns Validation result with matched/mismatched counts
 */
export async function validateTradeDealsAggregationMetrics(
  sampleSize: number = 3
): Promise<{
  isValid: boolean;
  sampledCounties: number;
  matched: number;
  mismatched: Array<{ county: string; metricKey: string; expected: number; actual: number }>;
}> {
  console.info(
    `[TradeDealsAggregationJob] Validating metrics (sample size: ${sampleSize})...`
  );

  try {
    // Get sampled counties with most active trade deals
    const result = await pool.query(`
      SELECT
        td.county_fips as "countyFips",
        COUNT(CASE WHEN td.status = 'active' THEN 1 END) as active_count
      FROM trade_deals td
      WHERE td.county_fips IS NOT NULL
      GROUP BY td.county_fips
      ORDER BY COUNT(CASE WHEN td.status = 'active' THEN 1 END) DESC
      LIMIT $1
    `, [sampleSize]);

    if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
      return {
        isValid: true,
        sampledCounties: 0,
        matched: 0,
        mismatched: [],
      };
    }

    const mismatched: Array<{ county: string; metricKey: string; expected: number; actual: number }> = [];
    let matched = 0;

    for (const row of result.rows as any[]) {
      const fips = row.countyFips;
      const expectedActive = Number(row.active_count) || 0;

      // Read back the active metric
      const activeResult = await pool.query(
        `SELECT metric_value FROM county_metrics
         WHERE county_fips = $1 AND metric_key = $2`,
        [fips, MetricKey.TRADEDEALS_ACTIVE]
      );

      if (!activeResult || !Array.isArray(activeResult.rows) || activeResult.rows.length === 0) {
        mismatched.push({ county: fips, metricKey: MetricKey.TRADEDEALS_ACTIVE, expected: expectedActive, actual: 0 });
      } else {
        const actualActive = Number(activeResult.rows[0].metric_value) || 0;
        if (actualActive === expectedActive) {
          matched++;
        } else {
          mismatched.push({ county: fips, metricKey: MetricKey.TRADEDEALS_ACTIVE, expected: expectedActive, actual: actualActive });
        }
      }
    }

    const isValid = mismatched.length === 0;

    console.info(
      `[TradeDealsAggregationJob] Validation complete`,
      {
        sampledCounties: result.rows.length,
        matched,
        mismatched: mismatched.length,
        isValid,
      }
    );

    return {
      isValid,
      sampledCounties: result.rows.length,
      matched,
      mismatched,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[TradeDealsAggregationJob] Validation failed:", error);
    throw new Error(`Validation failed: ${error}`);
  }
}
