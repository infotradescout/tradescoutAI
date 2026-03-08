/**
 * HomeScout Market Buckets Job (P0)
 *
 * Writes precomputed “similar homes” buckets into home_scout_market_buckets.
 * UI reads these buckets for listing context; UI does not compute comps.
 */

import { pool } from "../db";

type BucketRow = {
  countyFips: string;
  stateCode: string;
  propertyType: string;
  bedsBucket: number | null;
  activeCount: number;
  medianPrice: number | null;
  medianPricePerSqft: number | null;
  medianDomDays: number | null;
  priceDropCount7d: number;
};

interface JobResult {
  timestamp: Date;
  bucketsWritten: number;
  errors: Array<{ key: string; error: string }>;
}

async function upsertBucket(row: BucketRow, ts: Date) {
  await pool.query(
    `
    INSERT INTO home_scout_market_buckets (
      county_fips, state_code, property_type, beds_bucket,
      active_count, median_price, median_price_per_sqft, median_dom_days, price_drop_count_7d,
      computed_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
    ON CONFLICT (county_fips, state_code, property_type, beds_bucket)
    DO UPDATE SET
      active_count = EXCLUDED.active_count,
      median_price = EXCLUDED.median_price,
      median_price_per_sqft = EXCLUDED.median_price_per_sqft,
      median_dom_days = EXCLUDED.median_dom_days,
      price_drop_count_7d = EXCLUDED.price_drop_count_7d,
      computed_at = EXCLUDED.computed_at,
      updated_at = EXCLUDED.updated_at
  `,
    [
      row.countyFips,
      row.stateCode,
      row.propertyType,
      row.bedsBucket,
      row.activeCount,
      row.medianPrice,
      row.medianPricePerSqft,
      row.medianDomDays,
      row.priceDropCount7d,
      ts,
    ]
  );
}

export async function runHomeScoutBucketMetricsJob(): Promise<JobResult> {
  const ts = new Date();
  const errors: Array<{ key: string; error: string }> = [];
  let written = 0;

  // Bucketed by (county, type, bedsBucket) plus an "any beds" rollup (bedsBucket = null).
  const result = await pool.query(`
    WITH active AS (
      SELECT
        county_fips,
        state_code,
        property_type,
        CASE
          WHEN beds IS NULL THEN NULL
          WHEN beds >= 5 THEN 5
          ELSE beds
        END AS beds_bucket,
        price::numeric AS price_num,
        sqft,
        listed_at,
        price_changed_at,
        price_previous,
        price::numeric AS price_current
      FROM home_scout_listings
      WHERE status = 'active'
        AND county_fips IS NOT NULL
        AND state_code IS NOT NULL
        AND property_type IS NOT NULL
    ),
    bucketed AS (
      SELECT
        county_fips,
        state_code,
        property_type,
        beds_bucket,
        COUNT(*)::int AS active_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_num) AS median_price,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY CASE
            WHEN sqft IS NULL OR sqft = 0 THEN NULL
            ELSE (price_num / sqft::numeric)
          END
        ) AS median_price_per_sqft,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY (extract(epoch from (now() - listed_at)) / 86400.0)
        ) AS median_dom_days,
        SUM(
          CASE
            WHEN price_changed_at IS NOT NULL
              AND price_changed_at >= (now() - interval '7 days')
              AND price_previous IS NOT NULL
              AND price_previous::numeric > price_current
            THEN 1 ELSE 0
          END
        )::int AS price_drop_count_7d
      FROM active
      GROUP BY county_fips, state_code, property_type, beds_bucket
    ),
    rollup AS (
      SELECT
        county_fips,
        state_code,
        property_type,
        NULL::int AS beds_bucket,
        COUNT(*)::int AS active_count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_num) AS median_price,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY CASE
            WHEN sqft IS NULL OR sqft = 0 THEN NULL
            ELSE (price_num / sqft::numeric)
          END
        ) AS median_price_per_sqft,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY (extract(epoch from (now() - listed_at)) / 86400.0)
        ) AS median_dom_days,
        SUM(
          CASE
            WHEN price_changed_at IS NOT NULL
              AND price_changed_at >= (now() - interval '7 days')
              AND price_previous IS NOT NULL
              AND price_previous::numeric > price_current
            THEN 1 ELSE 0
          END
        )::int AS price_drop_count_7d
      FROM active
      GROUP BY county_fips, state_code, property_type
    )
    SELECT * FROM bucketed
    UNION ALL
    SELECT * FROM rollup
    ORDER BY county_fips, state_code, property_type, beds_bucket NULLS FIRST
  `);

  for (const r of result.rows || []) {
    const row: BucketRow = {
      countyFips: String(r.county_fips || ""),
      stateCode: String(r.state_code || ""),
      propertyType: String(r.property_type || ""),
      bedsBucket: r.beds_bucket == null ? null : Number(r.beds_bucket),
      activeCount: Number(r.active_count) || 0,
      medianPrice: r.median_price == null ? null : Number(r.median_price),
      medianPricePerSqft: r.median_price_per_sqft == null ? null : Number(r.median_price_per_sqft),
      // percentile_cont returns a numeric that may include decimals; store rounded days.
      medianDomDays:
        r.median_dom_days == null ? null : Math.max(0, Math.round(Number(r.median_dom_days))),
      priceDropCount7d: Number(r.price_drop_count_7d) || 0,
    };

    const key = `${row.countyFips}:${row.stateCode}:${row.propertyType}:${row.bedsBucket ?? "any"}`;
    if (!/^\d{5}$/.test(row.countyFips) || !/^[A-Z]{2}$/.test(row.stateCode) || !row.propertyType) {
      continue;
    }
    try {
      await upsertBucket(row, ts);
      written++;
    } catch (err) {
      errors.push({ key, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { timestamp: ts, bucketsWritten: written, errors };
}
