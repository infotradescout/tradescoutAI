/**
 * Nightly Users Aggregation Job
 *
 * Purpose:
 * - Compute per-county user aggregates
 * - Write four metrics: users_total, users_verified, contractors_total, homeowners_total
 * - Idempotent (set mode); fire-and-forget
 * - Runs nightly, reconciles against DB counts
 *
 * Design:
 * Pulls from users table, groups by county (county_fips), counts by verification status
 * and role/claim. Uses geographic data router to write metrics.
 *
 * No UI, no user-facing behavior. Purely a data aggregation worker.
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

interface CountyUserAggregate {
  countyFips: string;
  totalCount: number;
  verifiedCount: number;
  contractorsCount: number;
  homeownersCount: number;
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
 * Aggregate users by county
 *
 * Flow:
 * 1. Group users by county_fips
 * 2. Count total users per county
 * 3. Count verified users (verified_at is not null)
 * 4. Count contractors (user_role includes 'contractor')
 * 5. Count homeowners (user_role = 'homeowner')
 *
 * Returns list of counties with their counts
 */
async function aggregateUsersByCounty(): Promise<CountyUserAggregate[]> {
  console.info("[UsersAggregationJob] Starting user aggregation...");

  try {
    // Raw SQL aggregation for performance
    const result = await pool.query(`
      SELECT
        u.county_fips as "countyFips",
        COUNT(*) as total_count,
        COUNT(CASE WHEN u.verified_at IS NOT NULL THEN 1 END) as verified_count,
        COUNT(CASE WHEN u.user_role = 'contractor' OR u.user_role LIKE '%contractor%' THEN 1 END) as contractors_count,
        COUNT(CASE WHEN u.user_role = 'homeowner' THEN 1 END) as homeowners_count
      FROM users u
      WHERE u.county_fips IS NOT NULL
      GROUP BY u.county_fips
      ORDER BY u.county_fips
    `);

    if (!result || !Array.isArray(result.rows)) {
      throw new Error("Failed to aggregate users by county");
    }

    const aggregates: CountyUserAggregate[] = result.rows.map((row: any) => ({
      countyFips: row.countyFips,
      totalCount: Number(row.total_count) || 0,
      verifiedCount: Number(row.verified_count) || 0,
      contractorsCount: Number(row.contractors_count) || 0,
      homeownersCount: Number(row.homeowners_count) || 0,
    }));

    console.info(
      `[UsersAggregationJob] Aggregated ${aggregates.length} counties`
    );

    return aggregates;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[UsersAggregationJob] Aggregation failed:", error);
    throw new Error(`User aggregation failed: ${error}`);
  }
}

// ============================================================================
// JOB EXECUTION
// ============================================================================

/**
 * Execute the nightly users aggregation job
 *
 * Idempotent: set mode ensures replaying the job produces same result
 * Fire-and-forget: logs success/error, continues on partial failures
 *
 * @returns Job result with metrics written and any errors
 */
export async function runUsersAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `users-agg-${startTime.toISOString()}`;

  console.info(`[UsersAggregationJob] ${jobId} starting...`);

  try {
    // Step 1: Aggregate users by county
    const aggregates = await aggregateUsersByCounty();

    if (aggregates.length === 0) {
      console.warn(`[UsersAggregationJob] ${jobId} found no counties with users`);
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
          `[UsersAggregationJob] Skipping invalid FIPS: ${agg.countyFips}`
        );
        continue;
      }

      // Write four metrics per county
      requests.push(
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.USERS_TOTAL,
          countyFips: agg.countyFips,
          value: agg.totalCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.USERS_VERIFIED,
          countyFips: agg.countyFips,
          value: agg.verifiedCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.CONTRACTORS_TOTAL,
          countyFips: agg.countyFips,
          value: agg.contractorsCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.HOMEOWNERS_TOTAL,
          countyFips: agg.countyFips,
          value: agg.homeownersCount,
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
      `[UsersAggregationJob] ${jobId} completed`,
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
        `[UsersAggregationJob] ${jobId} had ${errors.length} errors:`,
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
    console.error(`[UsersAggregationJob] ${jobId} FAILED:`, error);

    throw new Error(`Users aggregation job failed: ${error}`);
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
export async function validateUsersAggregationMetrics(
  sampleSize: number = 3
): Promise<{
  isValid: boolean;
  sampledCounties: number;
  matched: number;
  mismatched: Array<{ county: string; expected: number; actual: number }>;
}> {
  console.info(
    `[UsersAggregationJob] Validating metrics (sample size: ${sampleSize})...`
  );

  try {
    // Get sampled counties with most users
    const result = await pool.query(`
      SELECT
        u.county_fips as "countyFips",
        COUNT(*) as user_count
      FROM users u
      WHERE u.county_fips IS NOT NULL
      GROUP BY u.county_fips
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
      const expected = Number(row.user_count) || 0;

      // Read back the metric we just wrote
      const metricsResult = await pool.query(
        `SELECT metric_value FROM county_metrics
         WHERE county_fips = $1 AND metric_key = $2`,
        [fips, MetricKey.USERS_TOTAL]
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
      `[UsersAggregationJob] Validation complete`,
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
    console.error("[UsersAggregationJob] Validation failed:", error);
    throw new Error(`Validation failed: ${error}`);
  }
}
