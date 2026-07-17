/**
 * Shared trust/CVS scoring SQL.
 *
 * Single source of truth for both the nightly job
 * (server/services/trustSnapshotsJob.ts) and the manual ops script
 * (scripts/backfill-trust-snapshots.mjs). Plain .mjs so the standalone
 * script can `import` it directly with plain `node`, no build step.
 */

export const TRUST_SNAPSHOTS_VERSION = 3;

export function buildTrustSnapshotsInsertSql({
  forceOverwrite = false,
  filterByUserId = false,
} = {}) {
  const insertGuard = forceOverwrite
    ? "TRUE"
    : `NOT EXISTS (
        SELECT 1
        FROM trust_snapshots ts
        WHERE ts.user_id = s.user_id
          AND ts.county_fips = s.county_fips
          AND ts.computed_at > NOW() - INTERVAL '1 day'
      )`;

  return `
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
    provider_local_signals AS (
      SELECT
        provider_user_id AS user_id,
        county_fips,
        SUM(COALESCE(jobs_completed, 0))::int AS jobs_completed,
        SUM(COALESCE(people_helped, 0))::int AS people_helped,
        SUM(COALESCE(active_weeks, 0))::int AS active_weeks,
        MAX(last_active_at) AS last_active_at
      FROM provider_local_stats
      GROUP BY provider_user_id, county_fips
    ),
    event_signals AS (
      SELECT
        COALESCE(NULLIF(data ->> 'userId', ''), user_id) AS user_id,
        COUNT(*) FILTER (WHERE event_type = 'job.completed')::int AS jobs_completed,
        COUNT(DISTINCT NULLIF(data ->> 'targetUserId', '')) FILTER (
          WHERE event_type IN ('reaction.marked_helpful', 'user.thanked')
        )::int AS people_helped,
        COUNT(DISTINCT date_trunc('week', created_at)) FILTER (
          WHERE event_type IN ('user.session_started', 'community.viewed_scope')
            AND created_at >= NOW() - INTERVAL '365 days'
        )::int AS active_weeks,
        MAX(created_at) FILTER (
          WHERE event_type IN (
            'job.completed',
            'reaction.marked_helpful',
            'user.thanked',
            'user.session_started',
            'community.viewed_scope'
          )
        ) AS last_active_at
      FROM events
      WHERE COALESCE(NULLIF(data ->> 'userId', ''), user_id) IS NOT NULL
      GROUP BY COALESCE(NULLIF(data ->> 'userId', ''), user_id)
    ),
    direct_connect_signals AS (
      SELECT
        COALESCE(wra.responder_user_id, c.user_id) AS user_id,
        wr.county_fips,
        COUNT(DISTINCT wr.id) FILTER (
          WHERE wr.status = 'completed'
            AND wra.status IN ('accepted', 'completed')
        )::int AS completed_jobs,
        COUNT(*) FILTER (
          WHERE wra.status IN ('accepted', 'declined', 'completed')
        )::int AS response_count,
        AVG(EXTRACT(EPOCH FROM (wra.updated_at - wra.created_at)) / 3600.0) FILTER (
          WHERE wra.status IN ('accepted', 'declined', 'completed')
            AND wra.updated_at IS NOT NULL
            AND wra.created_at IS NOT NULL
            AND wra.updated_at >= wra.created_at
        ) AS average_response_hours
      FROM work_request_assignments wra
      JOIN work_requests wr ON wr.id = wra.work_request_id
      LEFT JOIN contractors c ON c.id = wra.contractor_id
      WHERE COALESCE(wra.responder_user_id, c.user_id) IS NOT NULL
        AND wr.county_fips IS NOT NULL
      GROUP BY COALESCE(wra.responder_user_id, c.user_id), wr.county_fips
    ),
    recommendation_signals AS (
      SELECT
        c.user_id,
        COUNT(*) FILTER (WHERE lower(r.recommendation_type) = 'positive')::int
          AS positive_recommendations,
        COUNT(*) FILTER (WHERE lower(r.recommendation_type) = 'negative')::int
          AS negative_recommendations
      FROM recommendations r
      JOIN contractors c ON c.id = r.contractor_id
      WHERE c.user_id IS NOT NULL
        AND r.is_verified IS TRUE
        AND r.is_public IS TRUE
        AND lower(COALESCE(r.moderation_status, '')) = 'approved'
      GROUP BY c.user_id
    ),
    marketplace_signals AS (
      SELECT
        u.user_id,
        MAX(u.delivered_orders)::int AS delivered_orders,
        MAX(u.positive_reviews)::int AS positive_reviews,
        MAX(u.negative_reviews)::int AS negative_reviews,
        MAX(u.active_disputes)::int AS active_disputes
      FROM (
        SELECT
          seller_id AS user_id,
          COUNT(*) FILTER (WHERE status IN ('delivered', 'payout_reconciled'))::int
            AS delivered_orders,
          0::int AS positive_reviews,
          0::int AS negative_reviews,
          0::int AS active_disputes
        FROM marketplace_orders
        GROUP BY seller_id

        UNION ALL

        SELECT
          reviewee_id AS user_id,
          0::int AS delivered_orders,
          COUNT(*) FILTER (WHERE rating >= 4 AND is_verified_purchase IS TRUE)::int
            AS positive_reviews,
          COUNT(*) FILTER (WHERE rating <= 2 AND is_verified_purchase IS TRUE)::int
            AS negative_reviews,
          0::int AS active_disputes
        FROM user_reviews
        GROUP BY reviewee_id

        UNION ALL

        SELECT
          mt.seller_id AS user_id,
          0::int AS delivered_orders,
          0::int AS positive_reviews,
          0::int AS negative_reviews,
          COUNT(*) FILTER (
            WHERE lower(COALESCE(td.status, '')) IN ('open', 'investigating', 'escalated')
          )::int AS active_disputes
        FROM transaction_disputes td
        JOIN marketplace_transactions mt ON mt.id = td.transaction_id
        GROUP BY mt.seller_id
      ) u
      GROUP BY u.user_id
    ),
    cvs_boost_grants AS (
      SELECT
        g.entity_id AS user_id,
        (g.metadata ->> 'points')::numeric AS points
      FROM trust_ledger_events g
      WHERE g.entity_type = 'user_cvs'
        AND g.event_type = 'cvs_boost_granted'
        AND g.verification_level = 'system_verified'
        AND COALESCE(g.metadata ->> 'points', '') ~ '^[0-9]+(\\.[0-9]+)?$'
        AND (g.metadata ->> 'points')::numeric > 0
        AND (
          COALESCE(g.metadata ->> 'expiresAt', '') = ''
          OR (
            (g.metadata ->> 'expiresAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
            AND (g.metadata ->> 'expiresAt')::timestamptz > NOW()
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM trust_ledger_events r
          WHERE r.entity_type = g.entity_type
            AND r.entity_id = g.entity_id
            AND r.event_type = 'cvs_boost_revoked'
            AND r.metadata ->> 'grantKey' = g.metadata ->> 'grantKey'
        )
    ),
    cvs_boost_signals AS (
      SELECT
        user_id,
        LEAST(100, SUM(points)) AS boost_points
      FROM cvs_boost_grants
      GROUP BY user_id
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
        COALESCE(bes.external_place_confirmed, FALSE) AS external_place_confirmed,
        GREATEST(
          COALESCE(pls.jobs_completed, 0),
          COALESCE(es.jobs_completed, 0),
          COALESCE(dcs.completed_jobs, 0)
        )::int AS jobs_completed,
        GREATEST(COALESCE(pls.people_helped, 0), COALESCE(es.people_helped, 0))::int
          AS people_helped,
        GREATEST(COALESCE(pls.active_weeks, 0), COALESCE(es.active_weeks, 0))::int
          AS active_weeks,
        GREATEST(pls.last_active_at, es.last_active_at) AS last_active_at,
        COALESCE(dcs.response_count, 0)::int AS response_count,
        dcs.average_response_hours,
        COALESCE(rs.positive_recommendations, 0)::int AS positive_recommendations,
        COALESCE(rs.negative_recommendations, 0)::int AS negative_recommendations,
        COALESCE(ms.delivered_orders, 0)::int AS delivered_orders,
        COALESCE(ms.positive_reviews, 0)::int AS positive_reviews,
        COALESCE(ms.negative_reviews, 0)::int AS negative_reviews,
        COALESCE(ms.active_disputes, 0)::int AS active_disputes,
        COALESCE(cbs.boost_points, 0)::numeric AS cvs_boost_points
      FROM users u
      LEFT JOIN contractors c ON c.user_id = u.id
      LEFT JOIN business_external_signals bes ON bes.user_id = u.id
      LEFT JOIN provider_local_signals pls
        ON pls.user_id = u.id
       AND pls.county_fips = u.county_fips
      LEFT JOIN event_signals es ON es.user_id = u.id
      LEFT JOIN direct_connect_signals dcs
        ON dcs.user_id = u.id
       AND dcs.county_fips = u.county_fips
      LEFT JOIN recommendation_signals rs ON rs.user_id = u.id
      LEFT JOIN marketplace_signals ms ON ms.user_id = u.id
      LEFT JOIN cvs_boost_signals cbs ON cbs.user_id = u.id
      LEFT JOIN latest_verifications lv_license
        ON lv_license.provider_user_id = u.id
       AND lv_license.verification_type = 'license'
      LEFT JOIN latest_verifications lv_insurance
        ON lv_insurance.provider_user_id = u.id
       AND lv_insurance.verification_type = 'insurance'
      WHERE u.county_fips IS NOT NULL
        ${filterByUserId ? "AND u.id = $1" : ""}
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
        jobs_completed,
        people_helped,
        active_weeks,
        last_active_at,
        response_count,
        average_response_hours,
        positive_recommendations,
        negative_recommendations,
        delivered_orders,
        positive_reviews,
        negative_reviews,
        active_disputes,
        cvs_boost_points,
        CASE
          WHEN license_expires_at IS NOT NULL AND license_expires_at <= NOW() THEN 'expired'
          WHEN license_status_raw IS NOT NULL THEN license_status_raw
          WHEN contractor_license_verified IS TRUE THEN 'approved'
          ELSE NULL
        END AS license_status,
        CASE
          WHEN insurance_expires_at IS NOT NULL AND insurance_expires_at <= NOW() THEN 'expired'
          WHEN insurance_status_raw IS NOT NULL THEN insurance_status_raw
          WHEN contractor_insurance_verified IS TRUE THEN 'approved'
          ELSE NULL
        END AS insurance_status,
        CASE
          WHEN external_avg_rating >= 4.5 AND COALESCE(external_review_count, 0) >= 50 THEN 5
          WHEN external_avg_rating >= 4.2 AND COALESCE(external_review_count, 0) >= 20 THEN 3
          WHEN external_avg_rating >= 4.0 AND COALESCE(external_review_count, 0) >= 5 THEN 1
          WHEN external_avg_rating < 3.0 AND COALESCE(external_review_count, 0) >= 5 THEN -6
          WHEN external_avg_rating < 3.5 AND COALESCE(external_review_count, 0) >= 5 THEN -3
          ELSE 0
        END AS external_performance_delta
      FROM source
    ),
    performance AS (
      SELECT
        n.*,
        LEAST(12, n.jobs_completed * 2)
        + LEAST(5, n.people_helped)
        + CASE
            WHEN n.active_weeks >= 12 THEN 4
            WHEN n.active_weeks >= 6 THEN 3
            WHEN n.active_weeks >= 3 THEN 2
            WHEN n.active_weeks >= 1 THEN 1
            ELSE 0
          END
        + CASE
            WHEN n.last_active_at >= NOW() - INTERVAL '30 days' THEN 2
            WHEN n.last_active_at >= NOW() - INTERVAL '90 days' THEN 1
            WHEN n.last_active_at < NOW() - INTERVAL '365 days'
              AND (n.jobs_completed > 0 OR n.people_helped > 0 OR n.active_weeks > 0) THEN -2
            ELSE 0
          END
        + CASE
            WHEN n.response_count >= 3 AND n.average_response_hours <= 24 THEN 3
            WHEN n.response_count >= 2 AND n.average_response_hours <= 72 THEN 2
            WHEN n.response_count >= 1 THEN 1
            ELSE 0
          END
        + LEAST(10, n.positive_recommendations * 2)
        - LEAST(20, n.negative_recommendations * 5)
        + LEAST(5, n.delivered_orders)
        + LEAST(5, n.positive_reviews)
        - LEAST(12, n.negative_reviews * 3)
        - LEAST(12, n.active_disputes * 4)
        + n.external_performance_delta AS performance_delta
      FROM normalized n
    ),
    scored AS (
      SELECT
        n.user_id,
        n.county_fips,
        n.verification_status,
        n.license_status,
        n.insurance_status,
        CASE
          WHEN n.verification_status IN ('rejected', 'suspended') THEN 0
          WHEN n.address_verified IS NOT TRUE THEN
            CASE
              WHEN n.is_contractor IS TRUE THEN 0
              WHEN n.external_place_confirmed IS TRUE
                AND COALESCE(n.external_review_count, 0) >= 5
                AND COALESCE(n.external_avg_rating, 0) >= 3.5
              THEN LEAST(45, GREATEST(0, 25 + GREATEST(0, n.external_performance_delta)))
              ELSE 0
            END
          WHEN n.is_contractor IS TRUE
            AND (n.license_status IS DISTINCT FROM 'approved'
              OR n.insurance_status IS DISTINCT FROM 'approved') THEN 0
          WHEN n.verification_status IS DISTINCT FROM 'approved' THEN
            LEAST(49, GREATEST(0, 35 + n.performance_delta))
          ELSE LEAST(100, GREATEST(0, 50 + n.performance_delta)) + n.cvs_boost_points
        END AS cvs_score,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN n.address_verified IS NOT TRUE THEN 'unverified_address' END,
          CASE WHEN n.verification_status IS DISTINCT FROM 'approved' THEN 'verification_not_approved' END,
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
          END,
          CASE WHEN n.negative_recommendations > 0 THEN 'negative_recommendation_signal' END,
          CASE WHEN n.negative_reviews > 0 THEN 'negative_marketplace_review_signal' END,
          CASE WHEN n.active_disputes > 0 THEN 'active_dispute_signal' END,
          CASE
            WHEN n.external_performance_delta < 0 THEN 'external_rating_concern'
          END,
          CASE
            WHEN n.last_active_at < NOW() - INTERVAL '365 days'
             AND (n.jobs_completed > 0 OR n.people_helped > 0 OR n.active_weeks > 0)
            THEN 'recent_activity_stale'
          END,
          CASE WHEN n.cvs_boost_points > 0 THEN 'cvs_policy_boost_active' END
        ], NULL) AS risk_flags
      FROM performance n
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
        ${TRUST_SNAPSHOTS_VERSION}
      FROM scored s
      WHERE ${insertGuard}
      RETURNING 1
    )
    SELECT
      (SELECT COUNT(*)::int FROM inserted) AS inserted_count,
      (SELECT COUNT(*)::int FROM scored) AS source_count;
  `;
}
