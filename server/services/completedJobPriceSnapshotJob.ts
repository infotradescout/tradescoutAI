/**
 * Completed Job Price Snapshot Job
 *
 * Purpose:
 * - Compute conservative first-party completed-job price facts by county.
 * - Write only precomputed facts into county_metrics.
 * - Keep Scout/UI reads snapshot-backed; no read-time document pricing derivation.
 *
 * Source contract:
 * - Uses issued RECEIPT documents from the last 30 days.
 * - County comes from the receipt creator's canonical users.county_fips.
 * - Amount comes from receipt payload amount/total, in USD only.
 */

import { pool } from "../db";
import { writeMetricsBatch, type MetricWriteRequest } from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

interface CountyCompletedJobAggregate {
  countyFips: string;
  completedJobs30d: number;
  medianReceiptUsd30d: number;
}

interface JobResult {
  timestamp: Date;
  sampledCounties: number;
  totalRecordsProcessed: number;
  metricsWritten: number;
  errors: Array<{ county: string; error: string }>;
}

async function aggregateCompletedJobsByCounty(): Promise<CountyCompletedJobAggregate[]> {
  console.info("[CompletedJobPriceSnapshotJob] Starting completed-job aggregation...");

  try {
    const result = await pool.query(`
      WITH receipt_amounts AS (
        SELECT
          u.county_fips AS county_fips,
          COALESCE(NULLIF(d.job_id, ''), d.id) AS completed_job_key,
          COALESCE(
            NULLIF(d.payload->>'amount', '')::numeric,
            NULLIF(d.payload->>'total', '')::numeric
          ) AS amount_usd
        FROM documents d
        INNER JOIN users u ON u.id = d.created_by
        WHERE d.type = 'RECEIPT'
          AND d.status = 'issued'
          AND d.created_at >= NOW() - INTERVAL '30 days'
          AND u.county_fips IS NOT NULL
          AND u.county_fips ~ '^[0-9]{5}$'
          AND COALESCE(UPPER(NULLIF(d.payload->>'currency', '')), 'USD') = 'USD'
      )
      SELECT
        county_fips AS "countyFips",
        COUNT(DISTINCT completed_job_key)::int AS completed_jobs_30d,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount_usd))::int
          AS median_receipt_usd_30d
      FROM receipt_amounts
      WHERE amount_usd IS NOT NULL
        AND amount_usd > 0
      GROUP BY county_fips
      ORDER BY county_fips
    `);

    if (!result || !Array.isArray(result.rows)) {
      throw new Error("Failed to aggregate completed jobs by county");
    }

    const aggregates = result.rows.map((row: any) => ({
      countyFips: String(row.countyFips || ""),
      completedJobs30d: Number(row.completed_jobs_30d) || 0,
      medianReceiptUsd30d: Number(row.median_receipt_usd_30d) || 0,
    }));

    console.info(`[CompletedJobPriceSnapshotJob] Aggregated ${aggregates.length} counties`);
    return aggregates;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[CompletedJobPriceSnapshotJob] Aggregation failed:", error);
    throw new Error(`Completed job price aggregation failed: ${error}`);
  }
}

export async function runCompletedJobPriceSnapshotJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `completed-job-price-${startTime.toISOString()}`;

  console.info(`[CompletedJobPriceSnapshotJob] ${jobId} starting...`);

  const aggregates = await aggregateCompletedJobsByCounty();
  if (aggregates.length === 0) {
    console.warn(`[CompletedJobPriceSnapshotJob] ${jobId} found no completed job receipts`);
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
      console.warn(`[CompletedJobPriceSnapshotJob] Skipping invalid FIPS: ${agg.countyFips}`);
      continue;
    }

    requests.push(
      {
        source: "completed_job_price_snapshot_job",
        metricKey: MetricKey.COMPLETED_JOBS_30D,
        countyFips: agg.countyFips,
        value: agg.completedJobs30d,
        mode: "set",
        asOf: startTime,
      },
      {
        source: "completed_job_price_snapshot_job",
        metricKey: MetricKey.COMPLETED_JOB_MEDIAN_RECEIPT_USD_30D,
        countyFips: agg.countyFips,
        value: agg.medianReceiptUsd30d,
        mode: "set",
        asOf: startTime,
      }
    );
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
  console.info(`[CompletedJobPriceSnapshotJob] ${jobId} completed`, {
    counties: aggregates.length,
    metricsRequested: requests.length,
    metricsWritten: written,
    errors: errors.length,
    elapsedMs: elapsed,
  });

  return {
    timestamp: startTime,
    sampledCounties: aggregates.length,
    totalRecordsProcessed: aggregates.reduce((sum, row) => sum + row.completedJobs30d, 0),
    metricsWritten: written,
    errors,
  };
}
