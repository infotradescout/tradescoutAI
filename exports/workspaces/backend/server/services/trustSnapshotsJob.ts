/**
 * Nightly Trust Snapshot Job
 *
 * Purpose:
 * - Precompute Trust/CVS snapshots (read-only for UI)
 * - Store a per-user, per-county snapshot for contact gating and audit
 *
 * Notes:
 * - This is a baseline heuristic until full CVS calculation is wired.
 * - Never computed in UI; job-only per platform law.
 */

import { pool } from "../db";

interface JobResult {
  timestamp: Date;
  inserted: number;
  skipped: number;
}

export async function runTrustSnapshotsJob(): Promise<JobResult> {
  const startTime = new Date();

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
        lv_insurance.expires_at AS insurance_expires_at
      FROM users u
      LEFT JOIN contractors c ON c.user_id = u.id
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
        CASE
          WHEN license_status_raw IS NOT NULL THEN license_status_raw
          WHEN contractor_license_verified IS TRUE THEN 'approved'
          ELSE NULL
        END AS license_status,
        CASE
          WHEN insurance_status_raw IS NOT NULL THEN insurance_status_raw
          WHEN contractor_insurance_verified IS TRUE THEN 'approved'
          ELSE NULL
        END AS insurance_status
      FROM source
    ),
    scored AS (
      SELECT
        n.user_id,
        n.county_fips,
        n.verification_status,
        n.license_status,
        n.insurance_status,
        CASE
          WHEN n.address_verified IS NOT TRUE THEN 0
          WHEN n.is_contractor IS TRUE
            AND (n.license_status IS DISTINCT FROM 'approved'
              OR n.insurance_status IS DISTINCT FROM 'approved') THEN 0
          ELSE LEAST(
            100,
            50
            + CASE WHEN n.verification_status = 'approved' THEN 20 ELSE 0 END
            + CASE WHEN n.license_status = 'approved' THEN 15 ELSE 0 END
            + CASE WHEN n.insurance_status = 'approved' THEN 15 ELSE 0 END
          )
        END AS cvs_score,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN n.address_verified IS NOT TRUE THEN 'unverified_address' END,
          CASE WHEN n.is_contractor IS TRUE AND n.license_status IS DISTINCT FROM 'approved' THEN 'license_unverified' END,
          CASE WHEN n.is_contractor IS TRUE AND n.insurance_status IS DISTINCT FROM 'approved' THEN 'insurance_unverified' END,
          CASE WHEN n.verification_status = 'rejected' THEN 'verification_rejected' END,
          CASE WHEN n.verification_status = 'suspended' THEN 'verification_suspended' END,
          CASE WHEN n.license_status = 'expired' THEN 'license_expired' END,
          CASE WHEN n.insurance_status = 'expired' THEN 'insurance_expired' END
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
        1
      FROM scored s
      WHERE NOT EXISTS (
        SELECT 1
        FROM trust_snapshots ts
        WHERE ts.user_id = s.user_id
          AND ts.county_fips = s.county_fips
          AND ts.computed_at > NOW() - INTERVAL '1 day'
      )
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM inserted) AS inserted_count,
      (SELECT COUNT(*)::int FROM scored) AS source_count;
  `;

  const result = await pool.query(insertSql);
  const inserted = Number(result.rows?.[0]?.inserted_count ?? 0);
  const sourceCount = Number(result.rows?.[0]?.source_count ?? 0);

  return {
    timestamp: startTime,
    inserted,
    skipped: Math.max(0, sourceCount - inserted),
  };
}
