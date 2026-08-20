import { pool } from "../db";
import { writeMetricsBatch, type MetricWriteRequest } from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

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

async function aggregateUsersByCounty(): Promise<CountyUserAggregate[]> {
  console.info("[UsersAggregationJob] Starting user aggregation...");

  const result = await pool.query(`
    SELECT
      u.county_fips AS "countyFips",
      COUNT(*)::int AS total_count,
      COUNT(*) FILTER (
        WHERE u.verification_status::text = 'approved'
           OR COALESCE(u.verified_badge, false) = true
      )::int AS verified_count,
      COUNT(*) FILTER (
        WHERE u.role::text = 'contractor'
           OR u.active_role = 'contractor'
           OR 'contractor' = ANY(COALESCE(u.roles, ARRAY[]::varchar[]))
      )::int AS contractors_count,
      COUNT(*) FILTER (
        WHERE u.role::text = 'homeowner'
           OR u.active_role = 'homeowner'
           OR 'homeowner' = ANY(COALESCE(u.roles, ARRAY[]::varchar[]))
      )::int AS homeowners_count
    FROM users u
    WHERE u.county_fips ~ '^\\d{5}$'
    GROUP BY u.county_fips
    ORDER BY u.county_fips
  `);

  const aggregates = result.rows.map((row: any) => ({
    countyFips: String(row.countyFips || ""),
    totalCount: Number(row.total_count) || 0,
    verifiedCount: Number(row.verified_count) || 0,
    contractorsCount: Number(row.contractors_count) || 0,
    homeownersCount: Number(row.homeowners_count) || 0,
  }));

  console.info(`[UsersAggregationJob] Aggregated ${aggregates.length} counties`);
  return aggregates;
}

export async function runUsersAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `users-agg-${startTime.toISOString()}`;
  console.info(`[UsersAggregationJob] ${jobId} starting...`);

  try {
    const aggregates = await aggregateUsersByCounty();
    const requests: MetricWriteRequest[] = [];

    for (const aggregate of aggregates) {
      requests.push(
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.USERS_TOTAL,
          countyFips: aggregate.countyFips,
          value: aggregate.totalCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.USERS_VERIFIED,
          countyFips: aggregate.countyFips,
          value: aggregate.verifiedCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.CONTRACTORS_TOTAL,
          countyFips: aggregate.countyFips,
          value: aggregate.contractorsCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "users_aggregation_job",
          metricKey: MetricKey.HOMEOWNERS_TOTAL,
          countyFips: aggregate.countyFips,
          value: aggregate.homeownersCount,
          mode: "set",
          asOf: startTime,
        }
      );
    }

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

    console.info(`[UsersAggregationJob] ${jobId} completed`, {
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
    console.error(`[UsersAggregationJob] ${jobId} FAILED:`, message);
    throw new Error(`Users aggregation job failed: ${message}`);
  }
}

export async function validateUsersAggregationMetrics(
  sampleSize: number = 3
): Promise<{
  isValid: boolean;
  sampledCounties: number;
  matched: number;
  mismatched: Array<{ county: string; expected: number; actual: number }>;
}> {
  const result = await pool.query(
    `
      SELECT u.county_fips AS "countyFips", COUNT(*)::int AS user_count
      FROM users u
      WHERE u.county_fips ~ '^\\d{5}$'
      GROUP BY u.county_fips
      ORDER BY COUNT(*) DESC
      LIMIT $1
    `,
    [sampleSize]
  );

  const mismatched: Array<{ county: string; expected: number; actual: number }> = [];
  let matched = 0;

  for (const row of result.rows as any[]) {
    const county = String(row.countyFips || "");
    const expected = Number(row.user_count) || 0;
    const metricResult = await pool.query(
      `SELECT metric_value FROM county_metrics WHERE county_fips = $1 AND metric_key = $2`,
      [county, MetricKey.USERS_TOTAL]
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
