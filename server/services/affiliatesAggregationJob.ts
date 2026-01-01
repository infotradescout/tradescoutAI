/**
 * Affiliates Aggregation Job (Phase 2b)
 *
 * Purpose:
 * - Compute per-county affiliate account counts
 * - Write affiliates_count metric for each county
 * - Idempotent (set mode); fire-and-forget
 * - Runs nightly alongside other aggregation jobs
 *
 * Design:
 * Groups affiliates by countyFips, counts total accounts.
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

interface CountyAffiliateAggregate {
  countyFips: string;
  affiliatesCount: number;
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
 * Aggregate affiliates by county
 *
 * Flow:
 * 1. Group affiliate_accounts by county_fips
 * 2. Count total affiliates per county
 * 3. Filter out null/empty FIPS codes
 *
 * Returns list of counties with their affiliate counts
 */
async function aggregateAffiliatesByCounty(): Promise<CountyAffiliateAggregate[]> {
  console.info("[AffiliatesAggregationJob] Starting affiliates aggregation...");

  try {
    // Raw SQL aggregation for performance
    const result = await pool.query(`
      SELECT
        a.county_fips as "countyFips",
        COUNT(*) as affiliates_count
      FROM affiliate_accounts a
      WHERE a.county_fips IS NOT NULL
      GROUP BY a.county_fips
      ORDER BY a.county_fips
    `);

    if (!result || !Array.isArray(result.rows)) {
      throw new Error("Failed to aggregate affiliates by county");
    }

    const aggregates: CountyAffiliateAggregate[] = result.rows.map((row: any) => ({
      countyFips: row.countyFips,
      affiliatesCount: Number(row.affiliates_count) || 0,
    }));

    console.info(
      `[AffiliatesAggregationJob] Aggregated ${aggregates.length} counties`
    );

    return aggregates;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[AffiliatesAggregationJob] Aggregation failed:", error);
    throw new Error(`Affiliates aggregation failed: ${error}`);
  }
}

// ============================================================================
// JOB EXECUTION
// ============================================================================

/**
 * Execute the nightly affiliates aggregation job
 *
 * Idempotent: set mode ensures replaying the job produces same result
 * Fire-and-forget: logs success/error, continues on partial failures
 *
 * @returns Job result with metrics written and any errors
 */
export async function runAffiliatesAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `affiliates-agg-${startTime.toISOString()}`;

  console.info(`[AffiliatesAggregationJob] ${jobId} starting...`);

  try {
    // Step 1: Aggregate affiliates by county
    const aggregates = await aggregateAffiliatesByCounty();

    if (aggregates.length === 0) {
      console.warn(`[AffiliatesAggregationJob] ${jobId} found no counties with affiliates`);
      return {
        timestamp: startTime,
        sampledCounties: 0,
        totalRecordsProcessed: 0,
        metricsWritten: 0,
        errors: [],
      };
    }

    // Step 2: Build metric write requests
    const requests: MetricWriteRequest[] = [];

    for (const agg of aggregates) {
      // Skip if countyFips is invalid
      if (!agg.countyFips || agg.countyFips.length !== 5 || !/^\d+$/.test(agg.countyFips)) {
        console.warn(
          `[AffiliatesAggregationJob] Skipping invalid FIPS: ${agg.countyFips}`
        );
        continue;
      }

      requests.push({
        source: "affiliates_aggregation_job",
        metricKey: MetricKey.AFFILIATES_COUNT,
        countyFips: agg.countyFips,
        value: agg.affiliatesCount,
        mode: "set",
        asOf: startTime,
      });
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
      `[AffiliatesAggregationJob] ${jobId} completed`,
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
        `[AffiliatesAggregationJob] ${jobId} had ${errors.length} errors:`,
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
    console.error(`[AffiliatesAggregationJob] ${jobId} FAILED:`, error);

    throw new Error(`Affiliates aggregation job failed: ${error}`);
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
export async function validateAffiliatesAggregationMetrics(
  sampleSize: number = 3
): Promise<{
  isValid: boolean;
  sampledCounties: number;
  matched: number;
  mismatched: Array<{ county: string; expected: number; actual: number }>;
}> {
  console.info(
    `[AffiliatesAggregationJob] Validating metrics (sample size: ${sampleSize})...`
  );

  try {
    // Get sampled counties with most affiliates
    const result = await pool.query(`
      SELECT
        a.county_fips as "countyFips",
        COUNT(*) as affiliate_count
      FROM affiliate_accounts a
      WHERE a.county_fips IS NOT NULL
      GROUP BY a.county_fips
      ORDER BY COUNT(*) DESC
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

    const mismatched: Array<{ county: string; expected: number; actual: number }> = [];
    let matched = 0;

    for (const row of result.rows as any[]) {
      const fips = row.countyFips;
      const expected = Number(row.affiliate_count) || 0;

      // Read back the metric we just wrote
      const metricsResult = await pool.query(
        `SELECT metric_value FROM county_metrics
         WHERE county_fips = $1 AND metric_key = $2`,
        [fips, MetricKey.AFFILIATES_COUNT]
      );

      if (!metricsResult || !Array.isArray(metricsResult.rows) || metricsResult.rows.length === 0) {
        mismatched.push({ county: fips, expected, actual: 0 });
        continue;
      }

      const actual = Number(metricsResult.rows[0].metric_value) || 0;

      if (actual === expected) {
        matched++;
      } else {
        mismatched.push({ county: fips, expected, actual });
      }
    }

    const isValid = mismatched.length === 0;

    console.info(
      `[AffiliatesAggregationJob] Validation complete`,
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
    console.error("[AffiliatesAggregationJob] Validation failed:", error);
    throw new Error(`Validation failed: ${error}`);
  }
}
