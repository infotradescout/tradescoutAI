import { pool } from "../db";
import { writeMetricsBatch, type MetricWriteRequest } from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

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

async function aggregateAffiliatesByCounty(): Promise<CountyAffiliateAggregate[]> {
  console.info("[AffiliatesAggregationJob] Starting affiliates aggregation...");

  const result = await pool.query(`
    SELECT
      u.county_fips AS "countyFips",
      COUNT(DISTINCT a.id)::int AS affiliates_count
    FROM affiliate_accounts a
    INNER JOIN users u ON u.id = a.affiliate_id
    WHERE u.county_fips ~ '^\\d{5}$'
    GROUP BY u.county_fips
    ORDER BY u.county_fips
  `);

  const aggregates = result.rows.map((row: any) => ({
    countyFips: String(row.countyFips || ""),
    affiliatesCount: Number(row.affiliates_count) || 0,
  }));

  console.info(`[AffiliatesAggregationJob] Aggregated ${aggregates.length} counties`);
  return aggregates;
}

export async function runAffiliatesAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `affiliates-agg-${startTime.toISOString()}`;
  console.info(`[AffiliatesAggregationJob] ${jobId} starting...`);

  try {
    const aggregates = await aggregateAffiliatesByCounty();
    const requests: MetricWriteRequest[] = aggregates.map((aggregate) => ({
      source: "affiliates_aggregation_job",
      metricKey: MetricKey.AFFILIATES_COUNT,
      countyFips: aggregate.countyFips,
      value: aggregate.affiliatesCount,
      mode: "set",
      asOf: startTime,
    }));

    const errors: Array<{ county: string; error: string }> = [];
    let written = 0;
    for (const request of requests) {
      try {
        await writeMetricsBatch([request]);
        written += 1;
      } catch (error) {
        errors.push({
          county: request.countyFips,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.info(`[AffiliatesAggregationJob] ${jobId} completed`, {
      counties: aggregates.length,
      metricsRequested: requests.length,
      metricsWritten: written,
      errors: errors.length,
    });

    return {
      timestamp: startTime,
      sampledCounties: aggregates.length,
      totalRecordsProcessed: aggregates.length,
      metricsWritten: written,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AffiliatesAggregationJob] ${jobId} FAILED:`, message);
    throw new Error(`Affiliates aggregation job failed: ${message}`);
  }
}

export async function validateAffiliatesAggregationMetrics(
  sampleSize: number = 3
): Promise<{
  isValid: boolean;
  sampledCounties: number;
  matched: number;
  mismatched: Array<{ county: string; expected: number; actual: number }>;
}> {
  const result = await pool.query(
    `
      SELECT
        u.county_fips AS "countyFips",
        COUNT(DISTINCT a.id)::int AS affiliate_count
      FROM affiliate_accounts a
      INNER JOIN users u ON u.id = a.affiliate_id
      WHERE u.county_fips ~ '^\\d{5}$'
      GROUP BY u.county_fips
      ORDER BY COUNT(DISTINCT a.id) DESC
      LIMIT $1
    `,
    [sampleSize]
  );

  const mismatched: Array<{ county: string; expected: number; actual: number }> = [];
  let matched = 0;

  for (const row of result.rows as any[]) {
    const county = String(row.countyFips || "");
    const expected = Number(row.affiliate_count) || 0;
    const metricResult = await pool.query(
      `SELECT metric_value FROM county_metrics WHERE county_fips = $1 AND metric_key = $2`,
      [county, MetricKey.AFFILIATES_COUNT]
    );
    const actual = Number(metricResult.rows?.[0]?.metric_value) || 0;
    if (actual === expected) matched += 1;
    else mismatched.push({ county, expected, actual });
  }

  return {
    isValid: mismatched.length === 0,
    sampledCounties: result.rows.length,
    matched,
    mismatched,
  };
}
