import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const isDryRun = process.argv.includes("--dry-run");
const isForce = process.argv.includes("--force");

const insertSql = `
  WITH latest_verifications AS (
    SELECT DISTINCT ON (provider_user_id, verification_type)
      provider_user_id,
      verification_type,
      status,
      expires_at,
      COALESCE(verified_at, created_at) AS verified_at
    FROM business_verifications
    WHERE verification_type IN ('license', 'insurance')
    ORDER BY provider_user_id, verification_type, COALESCE(verified_at, created_at) DESC
  ),
  business_external_signals AS (
    SELECT
      b.owner_user_id AS user_id,
      MAX(
        CASE
          WHEN COALESCE(
                 NULLIF(b.profile_data -> 'importExtras' ->> 'gmb_average_rating', ''),
                 NULLIF(b.profile_data -> 'importExtras' ->> 'average_rating', '')
               ) ~ '^[0-9]+(\\.[0-9]+)?$'
            THEN COALESCE(
                   NULLIF(b.profile_data -> 'importExtras' ->> 'gmb_average_rating', ''),
                   NULLIF(b.profile_data -> 'importExtras' ->> 'average_rating', '')
                 )::numeric
          ELSE NULL
        END
      ) AS external_avg_rating,
      MAX(
        CASE
          WHEN COALESCE(
                 NULLIF(b.profile_data -> 'importExtras' ->> 'gmb_review_count', ''),
                 NULLIF(b.profile_data -> 'importExtras' ->> 'review_count', '')
               ) ~ '^[0-9]+$'
            THEN COALESCE(
                   NULLIF(b.profile_data -> 'importExtras' ->> 'gmb_review_count', ''),
                   NULLIF(b.profile_data -> 'importExtras' ->> 'review_count', '')
                 )::int
          ELSE NULL
        END
      ) AS external_review_count,
      BOOL_OR(
        COALESCE(NULLIF(b.profile_data -> 'importExtras' ->> 'google_place_id', ''), '') <> ''
        OR COALESCE(NULLIF(b.profile_data -> 'importExtras' ->> 'place_id', ''), '') <> ''
        OR COALESCE(NULLIF(b.profile_data -> 'importExtras' ->> 'places_place_id', ''), '') <> ''
        OR COALESCE(NULLIF(b.profile_data -> 'importExtras' ->> 'gmb_maps_url', ''), '') <> ''
        OR COALESCE(NULLIF(b.profile_data -> 'importExtras' ->> 'google_maps_url', ''), '') <> ''
      ) AS external_place_confirmed
    FROM businesses b
    WHERE b.owner_user_id IS NOT NULL
    GROUP BY b.owner_user_id
  ),
  source AS (
    SELECT
      u.id AS user_id,
      u.county_fips AS county_fips,
      u.address_verified AS address_verified,
      u.verification_status AS verification_status,
      c.user_id IS NOT NULL
        OR u.role IN (
          'contractor',
          'handyman',
          'service_provider',
          'specialty_tradesperson',
          'inspector',
          'realtor',
          'mortgage_broker',
          'insurance_agent',
          'car_dealer',
          'auto_service'
        )
        OR 'contractor' = ANY(u.roles) AS is_contractor,
      c.verified_licensed AS contractor_license_verified,
      c.verified_insured AS contractor_insurance_verified,
      lv_license.status AS license_status_raw,
      lv_license.expires_at AS license_expires_at,
      lv_insurance.status AS insurance_status_raw,
      lv_insurance.expires_at AS insurance_expires_at,
      bes.external_avg_rating,
      bes.external_review_count,
      COALESCE(bes.external_place_confirmed, FALSE) AS external_place_confirmed
    FROM users u
    LEFT JOIN contractors c ON c.user_id = u.id
    LEFT JOIN business_external_signals bes ON bes.user_id = u.id
    LEFT JOIN latest_verifications lv_license
      ON lv_license.provider_user_id = u.id
     AND lv_license.verification_type = 'license'
    LEFT JOIN latest_verifications lv_insurance
      ON lv_insurance.provider_user_id = u.id
     AND lv_insurance.verification_type = 'insurance'
    WHERE u.county_fips IS NOT NULL
  ),
  normalized AS (
    SELECT
      user_id,
      county_fips,
      address_verified,
      verification_status,
      is_contractor,
      external_avg_rating,
      external_review_count,
      external_place_confirmed,
      CASE
        WHEN license_status_raw IS NOT NULL THEN license_status_raw
        WHEN contractor_license_verified IS TRUE THEN 'approved'
        ELSE NULL
      END AS license_status,
      CASE
        WHEN insurance_status_raw IS NOT NULL THEN insurance_status_raw
        WHEN contractor_insurance_verified IS TRUE THEN 'approved'
        ELSE NULL
      END AS insurance_status,
      LEAST(
        10,
        (CASE
          WHEN external_avg_rating >= 4.5 AND COALESCE(external_review_count, 0) >= 50 THEN 5
          WHEN external_avg_rating >= 4.2 AND COALESCE(external_review_count, 0) >= 20 THEN 3
          WHEN external_avg_rating >= 4.0 AND COALESCE(external_review_count, 0) >= 5 THEN 1
          ELSE 0
        END)
        + CASE WHEN external_place_confirmed IS TRUE THEN 2 ELSE 0 END
      ) AS external_trust_bonus
    FROM source
  ),
  scored AS (
    SELECT
      n.user_id,
      n.county_fips,
      n.verification_status,
      n.license_status,
      n.insurance_status,
      n.external_trust_bonus,
      CASE
        WHEN n.address_verified IS NOT TRUE THEN
          CASE
            WHEN n.is_contractor IS TRUE THEN 0
            WHEN n.external_place_confirmed IS TRUE
              AND COALESCE(n.external_review_count, 0) >= 5
              AND COALESCE(n.external_avg_rating, 0) >= 3.5
            THEN LEAST(45, 25 + n.external_trust_bonus)
            ELSE 0
          END
        WHEN n.is_contractor IS TRUE
          AND (n.license_status IS DISTINCT FROM 'approved'
            OR n.insurance_status IS DISTINCT FROM 'approved') THEN 0
        ELSE LEAST(
          100,
          50
          + CASE WHEN n.verification_status = 'approved' THEN 20 ELSE 0 END
          + CASE WHEN n.license_status = 'approved' THEN 15 ELSE 0 END
          + CASE WHEN n.insurance_status = 'approved' THEN 15 ELSE 0 END
          + n.external_trust_bonus
        )
      END AS cvs_score,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN n.address_verified IS NOT TRUE THEN 'unverified_address' END,
        CASE WHEN n.is_contractor IS TRUE AND n.license_status IS DISTINCT FROM 'approved' THEN 'license_unverified' END,
        CASE WHEN n.is_contractor IS TRUE AND n.insurance_status IS DISTINCT FROM 'approved' THEN 'insurance_unverified' END,
        CASE WHEN n.verification_status = 'rejected' THEN 'verification_rejected' END,
        CASE WHEN n.verification_status = 'suspended' THEN 'verification_suspended' END,
        CASE WHEN n.license_status = 'expired' THEN 'license_expired' END,
        CASE WHEN n.insurance_status = 'expired' THEN 'insurance_expired' END,
        CASE
          WHEN n.address_verified IS NOT TRUE
           AND n.is_contractor IS NOT TRUE
           AND n.external_place_confirmed IS TRUE
           AND COALESCE(n.external_review_count, 0) >= 5
           AND COALESCE(n.external_avg_rating, 0) >= 3.5
          THEN 'external_signal_bootstrap'
        END
      ], NULL) AS risk_flags
    FROM normalized n
  ),
  inserted AS (
    INSERT INTO trust_snapshots (
      user_id,
      county_fips,
      cvs_score,
      verification_status,
      license_status,
      insurance_status,
      risk_flags,
      computed_at,
      version
    )
    SELECT
      s.user_id,
      s.county_fips,
      s.cvs_score,
      s.verification_status,
      s.license_status,
      s.insurance_status,
      s.risk_flags,
      NOW(),
      2
    FROM scored s
    WHERE ${isForce ? "TRUE" : `NOT EXISTS (
        SELECT 1
        FROM trust_snapshots ts
        WHERE ts.user_id = s.user_id
          AND ts.county_fips = s.county_fips
          AND ts.computed_at > NOW() - INTERVAL '1 day'
      )`}
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::int FROM inserted) AS inserted_count,
    (SELECT COUNT(*)::int FROM scored) AS source_count;
`;

async function run() {
  const pool = new Pool({ connectionString });
  try {
    if (isDryRun) {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS source_count
        FROM users u
        WHERE u.county_fips IS NOT NULL
      `);
      console.log(`[backfill-trust-snapshots] dry run: source=${rows[0]?.source_count ?? 0}`);
      return;
    }

    const result = await pool.query(insertSql);
    const inserted = Number(result.rows?.[0]?.inserted_count ?? 0);
    const sourceCount = Number(result.rows?.[0]?.source_count ?? 0);
    const skipped = Math.max(0, sourceCount - inserted);
    console.log(
      `[backfill-trust-snapshots] inserted=${inserted} skipped=${skipped} source=${sourceCount}`
    );
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
