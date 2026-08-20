import { pool } from "../db";
import { writeMetricsBatch, type MetricWriteRequest } from "./geographicDataRouter";
import { MetricKey } from "./metricRegistry";

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

async function tradeDealsColumns(): Promise<Set<string>> {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trade_deals'
  `);
  return new Set(result.rows.map((row: any) => String(row.column_name || "")));
}

async function aggregateTradeDealsByCounty(): Promise<CountyTradeDealsAggregate[]> {
  console.info("[TradeDealsAggregationJob] Starting trade deals aggregation...");

  const columns = await tradeDealsColumns();
  if (!columns.has("county_fips")) {
    console.warn(
      "[TradeDealsAggregationJob] County aggregation skipped: trade_deals has no county_fips authority."
    );
    return [];
  }

  const activeCondition = columns.has("is_active")
    ? "td.is_active = true"
    : columns.has("status")
      ? "td.status = 'active'"
      : "false";
  const claimedCondition = columns.has("claimed_at")
    ? "td.claimed_at >= NOW() - INTERVAL '30 days'"
    : "false";

  const result = await pool.query(`
    SELECT
      td.county_fips AS "countyFips",
      COUNT(*) FILTER (WHERE ${activeCondition})::int AS active_count,
      COUNT(*) FILTER (WHERE ${claimedCondition})::int AS claimed_30d_count
    FROM trade_deals td
    WHERE td.county_fips ~ '^\\d{5}$'
    GROUP BY td.county_fips
    ORDER BY td.county_fips
  `);

  const aggregates = result.rows.map((row: any) => ({
    countyFips: String(row.countyFips || ""),
    activeCount: Number(row.active_count) || 0,
    claimed30dCount: Number(row.claimed_30d_count) || 0,
  }));

  console.info(`[TradeDealsAggregationJob] Aggregated ${aggregates.length} counties`);
  return aggregates;
}

export async function runTradeDealsAggregationJob(): Promise<JobResult> {
  const startTime = new Date();
  const jobId = `tradedeals-agg-${startTime.toISOString()}`;
  console.info(`[TradeDealsAggregationJob] ${jobId} starting...`);

  try {
    const aggregates = await aggregateTradeDealsByCounty();
    const requests: MetricWriteRequest[] = [];

    for (const aggregate of aggregates) {
      requests.push(
        {
          source: "tradedeals_aggregation_job",
          metricKey: MetricKey.TRADEDEALS_ACTIVE,
          countyFips: aggregate.countyFips,
          value: aggregate.activeCount,
          mode: "set",
          asOf: startTime,
        },
        {
          source: "tradedeals_aggregation_job",
          metricKey: MetricKey.TRADEDEALS_CLAIMED_30D,
          countyFips: aggregate.countyFips,
          value: aggregate.claimed30dCount,
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

    console.info(`[TradeDealsAggregationJob] ${jobId} completed`, {
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
    console.error(`[TradeDealsAggregationJob] ${jobId} FAILED:`, message);
    throw new Error(`Trade deals aggregation job failed: ${message}`);
  }
}

export async function validateTradeDealsAggregationMetrics(
  sampleSize: number = 3
): Promise<{
  isValid: boolean;
  sampledCounties: number;
  matched: number;
  mismatched: Array<{ county: string; metricKey: string; expected: number; actual: number }>;
}> {
  const columns = await tradeDealsColumns();
  if (!columns.has("county_fips")) {
    return { isValid: true, sampledCounties: 0, matched: 0, mismatched: [] };
  }

  const activeCondition = columns.has("is_active")
    ? "td.is_active = true"
    : columns.has("status")
      ? "td.status = 'active'"
      : "false";
  const result = await pool.query(
    `
      SELECT
        td.county_fips AS "countyFips",
        COUNT(*) FILTER (WHERE ${activeCondition})::int AS active_count
      FROM trade_deals td
      WHERE td.county_fips ~ '^\\d{5}$'
      GROUP BY td.county_fips
      ORDER BY COUNT(*) FILTER (WHERE ${activeCondition}) DESC
      LIMIT $1
    `,
    [sampleSize]
  );

  const mismatched: Array<{
    county: string;
    metricKey: string;
    expected: number;
    actual: number;
  }> = [];
  let matched = 0;

  for (const row of result.rows as any[]) {
    const county = String(row.countyFips || "");
    const expected = Number(row.active_count) || 0;
    const metricResult = await pool.query(
      `SELECT metric_value FROM county_metrics WHERE county_fips = $1 AND metric_key = $2`,
      [county, MetricKey.TRADEDEALS_ACTIVE]
    );
    const actual = Number(metricResult.rows?.[0]?.metric_value) || 0;
    if (actual === expected) matched += 1;
    else {
      mismatched.push({
        county,
        metricKey: MetricKey.TRADEDEALS_ACTIVE,
        expected,
        actual,
      });
    }
  }

  return {
    isValid: mismatched.length === 0,
    sampledCounties: result.rows.length,
    matched,
    mismatched,
  };
}
