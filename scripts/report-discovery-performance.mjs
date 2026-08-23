import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import {
  loadSearchConsoleAggregate,
  renderSearchConsoleMarkdownSection,
  summarizeSearchConsoleForReport,
} from "./import-search-console-performance.mjs";
import "dotenv/config";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const DISCOVERY_PERFORMANCE_DEFINITIONS = {
  publiclyExposable:
    "A discoverable published /u profile that passes the canonical visibility, trust, meaningful-content, and internal-role exclusions, or a completed-snapshot /business entity that still passes current publication, trust, county, and recency checks. Direct-only profiles are excluded.",
  crawled:
    "A bot_observation_events request for a publicly exposable entity route, grouped by entity slug and response outcome.",
  surfaced:
    "A verified discovery_landing with a finite sourceHint or referrerClass. This is a source-attributed entry proxy, not a search-impression count.",
  visited:
    "A profile_view_events browser/profile-data fetch after recognized user-agent bots are excluded, with discovery_landing counts retained for marketplace routes that do not have a profile row. This does not prove a human or unique visitor.",
  converted:
    "A work request whose created work_request_events metadata contains an entryRequestId that matches a discovery_landing event.",
  acquisitionFunnel:
    "Source-attributed public-entity discovery to CTA to registration to activation. users.created_at proves account existence and canonical onboardingOutcome.completedAt proves activation; lifecycle events classify server registration flows and project attribution with separately reconciled coverage.",
};

export const DISCOVERY_PERFORMANCE_RELEASE = {
  commit: "6a63fd41e86811815184905c0626cf64e6a904a7",
  productionActivatedAt: "2026-08-08T17:36:32.672607Z",
};

// Set only from verified production activation evidence. Until then, the new
// lifecycle projection funnel is explicitly not applicable in reports.
export const ACQUISITION_FUNNEL_RELEASE = {
  commit: null,
  productionActivatedAt: null,
};

function finiteSourceClassSql(dataReference) {
  return `CASE lower(NULLIF(${dataReference}->>'sourceHint', ''))
    WHEN 'google' THEN 'google'
    WHEN 'google.com' THEN 'google'
    WHEN 'googleads' THEN 'google'
    WHEN 'google_ads' THEN 'google'
    WHEN 'adwords' THEN 'google'
    WHEN 'bing' THEN 'bing'
    WHEN 'bing.com' THEN 'bing'
    WHEN 'microsoft' THEN 'bing'
    WHEN 'chatgpt' THEN 'chatgpt'
    WHEN 'chatgpt.com' THEN 'chatgpt'
    WHEN 'openai' THEN 'chatgpt'
    WHEN 'openai.com' THEN 'chatgpt'
    WHEN 'facebook' THEN 'facebook'
    WHEN 'facebook.com' THEN 'facebook'
    WHEN 'fb' THEN 'facebook'
    WHEN 'instagram' THEN 'facebook'
    WHEN 'instagram.com' THEN 'facebook'
    WHEN 'meta' THEN 'facebook'
    WHEN 'linkedin' THEN 'linkedin'
    WHEN 'linkedin.com' THEN 'linkedin'
    WHEN 'newsletter' THEN 'newsletter'
    WHEN 'email' THEN 'newsletter'
    WHEN 'direct' THEN 'direct'
    WHEN 'none' THEN 'direct'
    WHEN 'other' THEN 'other'
    ELSE CASE
      WHEN NULLIF(${dataReference}->>'sourceHint', '') IS NULL THEN NULL
      ELSE 'other'
    END
  END`;
}

function finiteReferrerClassSql(dataReference) {
  const value = `lower(COALESCE(NULLIF(${dataReference}->>'referrerClass', ''), NULLIF(${dataReference}->>'referrerHost', '')))`;
  return `CASE
    WHEN ${value} IS NULL THEN NULL
    WHEN ${value} IN ('google', 'bing', 'chatgpt', 'facebook', 'linkedin', 'search', 'ai', 'social', 'referral')
      THEN ${value}
    WHEN ${value} ~ '(^|\\.)google\\.[a-z.]+$' THEN 'google'
    WHEN ${value} ~ '(^|\\.)bing\\.com$' THEN 'bing'
    WHEN ${value} ~ '(^|\\.)(chatgpt\\.com|openai\\.com)$' THEN 'chatgpt'
    WHEN ${value} ~ '(^|\\.)(facebook\\.com|instagram\\.com)$' THEN 'facebook'
    WHEN ${value} ~ '(^|\\.)linkedin\\.com$' THEN 'linkedin'
    WHEN ${value} ~ '(^|\\.)(duckduckgo\\.com|yahoo\\.com|search\\.brave\\.com)$' THEN 'search'
    WHEN ${value} ~ '(^|\\.)(perplexity\\.ai|claude\\.ai|gemini\\.google\\.com|copilot\\.microsoft\\.com)$' THEN 'ai'
    WHEN ${value} ~ '(^|\\.)(x\\.com|twitter\\.com|t\\.co|reddit\\.com)$' THEN 'social'
    ELSE 'referral'
  END`;
}

export const profileCatalogSql = `
  WITH profile_domains AS (
    SELECT
      lower(p.slug) AS business_slug,
      NULLIF(lower(trim(COALESCE(p.seo_meta->>'customDomain', ''))), '') AS configured_domain,
      NULLIF(
        regexp_replace(
          lower(trim(COALESCE(p.seo_meta->>'customDomain', ''))),
          '^www\\.',
          ''
        ),
        ''
      ) AS custom_domain
    FROM profiles p
    WHERE p.status = 'published'
  ), unambiguous_profile_domains AS (
    SELECT
      custom_domain,
      MIN(configured_domain) AS configured_domain,
      MIN(business_slug) AS business_slug
    FROM profile_domains
    WHERE custom_domain IS NOT NULL
      AND custom_domain NOT IN ('thetradescout.com', 'tradescoutai.onrender.com', 'localhost', '127.0.0.1')
    GROUP BY custom_domain
    HAVING COUNT(DISTINCT business_slug) = 1
  ), profile_candidates AS (
    SELECT
      '/u/' || lower(p.slug) AS entity_key,
      'published_profile'::text AS entity_type,
      p.business_id,
      lower(p.slug) AS business_slug,
      COALESCE(NULLIF(b.name, ''), p.display_name) AS display_name,
      CASE
        WHEN profile_domain.configured_domain IS NOT NULL
          THEN 'https://' || profile_domain.configured_domain || '/'
        ELSE '/u/' || lower(p.slug)
      END AS canonical_route,
      '/u/' || lower(p.slug) AS identity_route,
      (
        lower(p.slug) IN ('tradescout-admin', 'super-admin')
        OR lower(trim(COALESCE(p.role_context::text, ''))) IN (
          'admin', 'analytics_specialist', 'content_seo', 'head_admin',
          'marketing_specialist', 'moderator', 'ops_admin', 'super_admin'
        )
        OR (
          p.business_id IS NULL
          AND (
            lower(trim(COALESCE(u.role::text, ''))) IN (
              'admin', 'analytics_specialist', 'content_seo', 'head_admin',
              'marketing_specialist', 'moderator', 'ops_admin', 'super_admin'
            )
            OR EXISTS (
              SELECT 1
              FROM unnest(COALESCE(u.roles, ARRAY[]::text[])) AS owner_role(value)
              WHERE lower(trim(owner_role.value::text)) IN (
                'admin', 'analytics_specialist', 'content_seo', 'head_admin',
                'marketing_specialist', 'moderator', 'ops_admin', 'super_admin'
              )
            )
          )
        )
      ) AS is_internal_admin,
      p.business_id IS NULL AS is_personal_profile,
      COALESCE(u.preferences->'publicProfileIds', '[]'::jsonb)
        @> jsonb_build_array(p.id::text) AS visibility_public,
      lower(trim(COALESCE(b.status::text, ''))) = 'active' AS business_active,
      b.public_discovery_enabled = true AS public_discovery_enabled,
      (
        p.business_id IS NOT NULL
        AND (
          u.verified_badge = true
          OR lower(trim(COALESCE(u.verification_status::text, ''))) = 'approved'
        )
      ) AS owner_publicly_verified,
      (
        NULLIF(trim(COALESCE(p.headline, '')), '') IS NOT NULL
        OR NULLIF(trim(COALESCE(u.preferences->>'servicesDescription', '')), '') IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(COALESCE(p.content_blocks, '[]'::jsonb)) = 'array'
                THEN COALESCE(p.content_blocks, '[]'::jsonb)
              ELSE '[]'::jsonb
            END
          ) AS block(value)
          CROSS JOIN LATERAL jsonb_path_query(
            COALESCE(block.value->'data', 'null'::jsonb),
            '$.**{0 to 5}'::jsonpath
          ) AS content(value)
          WHERE lower(trim(COALESCE(block.value->>'type', ''))) IN (
            'about', 'bio', 'faq', 'gallery', 'hero', 'portfolio',
            'projects', 'services', 'testimonials', 'text'
          )
            AND (
              jsonb_typeof(content.value) = 'number'
              OR (
                jsonb_typeof(content.value) = 'string'
                AND NULLIF(trim(content.value #>> '{}'), '') IS NOT NULL
              )
            )
        )
      ) AS has_meaningful_content,
      (
        lower(trim(COALESCE(b.status::text, ''))) = 'active'
        AND b.public_discovery_enabled = false
        AND p.owner_user_id = b.owner_user_id
        AND (
          (
            lower(p.slug) = 'jrs-auto-glass'
            AND COALESCE(b.sources, '[]'::jsonb)
                @> '["owner_confirmed_profile"]'::jsonb
          )
          OR (
            lower(p.slug) = 'pro-fab-specialty-services'
            AND COALESCE(b.sources, '[]'::jsonb)
                @> '["admin_provisioned_business_profile"]'::jsonb
          )
          OR (
            lower(p.slug) = 'precision-aerial-services'
            AND COALESCE(b.sources, '[]'::jsonb)
                @> '["admin_provisioned_business_profile"]'::jsonb
            AND lower(COALESCE(b.claim_status, '')) = 'unclaimed'
            AND u.provider = 'admin_provisioned_profile_steward'
            AND COALESCE(u.preferences->'internalProfileSteward'->>'profileSlug', '')
                = 'precision-aerial-services'
            AND COALESCE(u.preferences->'internalProfileSteward'->>'source', '')
                = 'admin_provisioned_business_profile'
          )
        )
      ) AS registered_direct_profile,
      (
        lower(p.slug) = 'steel-home-packages'
        AND lower(trim(COALESCE(b.status::text, ''))) = 'draft'
        AND b.public_discovery_enabled = false
      ) AS unlisted_review_profile
    FROM profiles p
    INNER JOIN users u ON u.id = p.owner_user_id
    LEFT JOIN businesses b ON b.id = p.business_id
    LEFT JOIN unambiguous_profile_domains profile_domain
      ON profile_domain.business_slug = lower(p.slug)
    WHERE p.status = 'published'
  ), classified_profiles AS (
    SELECT
      profile_candidates.*,
      COALESCE(
        NOT is_internal_admin
        AND NOT is_personal_profile
        AND visibility_public
        AND business_active
        AND owner_publicly_verified
        AND has_meaningful_content
        AND public_discovery_enabled,
        false
      ) AS is_publicly_exposable,
      CASE
        WHEN unlisted_review_profile THEN 'unlisted_review'
        WHEN is_internal_admin THEN 'internal_admin'
        WHEN is_personal_profile THEN 'personal_profile_direct_only'
        WHEN NOT COALESCE(visibility_public, false) THEN 'visibility_not_public'
        WHEN NOT COALESCE(business_active, false) THEN 'business_trust_missing'
        WHEN registered_direct_profile THEN 'direct_only'
        WHEN NOT COALESCE(owner_publicly_verified, false) THEN 'trust_gate_not_satisfied'
        WHEN NOT COALESCE(has_meaningful_content, false) THEN 'empty_profile'
        WHEN public_discovery_enabled = false THEN 'direct_only'
        ELSE 'business_trust_missing'
      END AS exclusion_reason
    FROM profile_candidates
  ), completed_directory_snapshot AS (
    SELECT status.completed_at
    FROM ts_seo_directory_snapshot_status status
    WHERE status.snapshot_key = 'directory_scope_v1'
      AND status.generation > 0
      AND status.completed_at >= now() - interval '24 hours'
      AND status.completed_at <= now() + interval '5 minutes'
      AND status.directory_business_count = (
        SELECT COUNT(*)::int FROM ts_seo_directory_business_pages
      )
  ), directory_candidates AS (
    SELECT
      '/business/' || lower(directory.slug) AS entity_key,
      'governed_directory_business'::text AS entity_type,
      directory.business_id,
      lower(directory.slug) AS business_slug,
      b.name AS display_name,
      '/business/' || lower(directory.slug) AS canonical_route,
      '/business/' || lower(directory.slug) AS identity_route,
      true AS is_publicly_exposable,
      NULL::text AS exclusion_reason
    FROM ts_seo_directory_business_pages directory
    INNER JOIN businesses b ON b.id = directory.business_id
    LEFT JOIN users directory_owner ON directory_owner.id = b.owner_user_id
    INNER JOIN ts_publication_rules rules ON rules.id = 'default'
    CROSS JOIN completed_directory_snapshot
    WHERE lower(trim(COALESCE(b.status::text, ''))) = 'active'
      AND b.public_discovery_enabled = true
      AND b.updated_at = directory.lastmod
      AND EXISTS (
        SELECT 1
        FROM business_counties current_scope
        INNER JOIN counties current_county ON current_county.id = current_scope.county_id
        WHERE current_scope.business_id = b.id
          AND NULLIF(trim(COALESCE(current_county.name, '')), '') IS NOT NULL
          AND NULLIF(trim(COALESCE(current_county.state_code, '')), '') IS NOT NULL
      )
      AND (
        (
          (b.owner_user_id IS NULL OR lower(trim(COALESCE(b.claim_status, ''))) = 'unclaimed')
          AND b.updated_at >= now() - make_interval(days => rules.listing_stale_days_unclaimed)
        )
        OR (
          b.owner_user_id IS NOT NULL
          AND lower(trim(COALESCE(b.claim_status, ''))) <> 'unclaimed'
          AND lower(trim(COALESCE(directory_owner.verification_status::text, ''))) = 'approved'
          AND directory_owner.address_verified = true
          AND b.updated_at >= now() - make_interval(days => rules.listing_stale_days_verified)
        )
      )
      AND NOT EXISTS (
      SELECT 1
      FROM classified_profiles profile
      WHERE profile.is_publicly_exposable = true
        AND profile.business_id = directory.business_id
    )
  )
  SELECT
    entity_key,
    entity_type,
    business_id,
    business_slug,
    display_name,
    canonical_route,
    identity_route,
    is_publicly_exposable,
    exclusion_reason
  FROM classified_profiles
  UNION ALL
  SELECT
    entity_key,
    entity_type,
    business_id,
    business_slug,
    display_name,
    canonical_route,
    identity_route,
    is_publicly_exposable,
    exclusion_reason
  FROM directory_candidates
  ORDER BY entity_key ASC;
`;

const crawlSummarySql = `
  WITH published_profiles AS (
    SELECT
      lower(p.slug) AS business_slug,
      NULLIF(
        regexp_replace(
          lower(trim(COALESCE(p.seo_meta->>'customDomain', ''))),
          '^www\\.',
          ''
        ),
        ''
      ) AS custom_domain
    FROM profiles p
    WHERE p.status = 'published'
  ), unambiguous_custom_domains AS (
    SELECT
      custom_domain,
      MIN(business_slug) AS business_slug
    FROM published_profiles
    WHERE custom_domain IS NOT NULL
      AND custom_domain NOT IN ('thetradescout.com', 'tradescoutai.onrender.com', 'localhost', '127.0.0.1')
    GROUP BY custom_domain
    HAVING COUNT(DISTINCT business_slug) = 1
  ), normalized AS (
    SELECT
      COALESCE(
        CASE
          WHEN lower(trim(COALESCE(e.entity_type, ''))) IN ('profile', 'business')
            THEN NULLIF(lower(trim(e.entity_slug)), '')
          ELSE NULL
        END,
        custom_profile.business_slug,
        CASE
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'u'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'business'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN lower(split_part(e.path, '?', 1)) = '/jw-stone' THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
      CASE
        WHEN lower(trim(COALESCE(e.entity_type, ''))) = 'profile'
          AND NULLIF(lower(trim(e.entity_slug)), '') IS NOT NULL
          THEN '/u/' || NULLIF(lower(trim(e.entity_slug)), '')
        WHEN lower(trim(COALESCE(e.entity_type, ''))) = 'business'
          AND NULLIF(lower(trim(e.entity_slug)), '') IS NOT NULL
          THEN '/business/' || NULLIF(lower(trim(e.entity_slug)), '')
        WHEN custom_profile.business_slug IS NOT NULL
          THEN '/u/' || custom_profile.business_slug
        WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'u'
          THEN '/u/' || NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
        WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'business'
          THEN '/business/' || NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
        WHEN lower(split_part(e.path, '?', 1)) = '/jw-stone' THEN '/jw-stone'
        ELSE NULL
      END AS identity_route,
      e.bot_family,
      e.path,
      e.status_code,
      e.observed_at,
      e.is_first_seen_url,
      e.is_recrawl
    FROM bot_observation_events e
    LEFT JOIN unambiguous_custom_domains custom_profile
      ON custom_profile.custom_domain = regexp_replace(
        lower(split_part(COALESCE(e.host, ''), ':', 1)),
        '^www\\.',
        ''
      )
      AND NOT (
        lower(trim(COALESCE(e.entity_type, ''))) IN ('profile', 'business')
        AND NULLIF(trim(e.entity_slug), '') IS NOT NULL
      )
      AND lower(COALESCE(e.content_type, '')) LIKE 'text/html%'
    WHERE e.observed_at >= $1
      AND e.observed_at < $2
      AND (
        (
          lower(trim(COALESCE(e.entity_type, ''))) IN ('profile', 'business')
          AND NULLIF(trim(e.entity_slug), '') IS NOT NULL
        )
        OR custom_profile.business_slug IS NOT NULL
        OR e.path LIKE '/u/%'
        OR e.path LIKE '/business/%'
        OR lower(split_part(e.path, '?', 1)) = '/jw-stone'
      )
  )
  SELECT
    n.business_slug,
    n.identity_route,
    COUNT(*)::int AS crawl_hits,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::int AS crawl_successes,
    COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500)::int AS crawl_client_errors,
    COUNT(*) FILTER (WHERE status_code >= 500)::int AS crawl_server_errors,
    COUNT(DISTINCT bot_family)::int AS crawler_count,
    COUNT(DISTINCT path)::int AS unique_urls,
    COUNT(*) FILTER (WHERE is_first_seen_url)::int AS first_seen_urls,
    COUNT(*) FILTER (WHERE is_recrawl)::int AS recrawl_urls,
    MIN(observed_at) AS first_crawled_at,
    MAX(observed_at) AS last_crawled_at
  FROM normalized n
  WHERE n.business_slug IS NOT NULL
  GROUP BY n.business_slug, n.identity_route;
`;

const crawlFamilySummarySql = `
  WITH published_profiles AS (
    SELECT
      lower(p.slug) AS business_slug,
      NULLIF(
        regexp_replace(
          lower(trim(COALESCE(p.seo_meta->>'customDomain', ''))),
          '^www\\.',
          ''
        ),
        ''
      ) AS custom_domain
    FROM profiles p
    WHERE p.status = 'published'
  ), unambiguous_custom_domains AS (
    SELECT
      custom_domain,
      MIN(business_slug) AS business_slug
    FROM published_profiles
    WHERE custom_domain IS NOT NULL
      AND custom_domain NOT IN ('thetradescout.com', 'tradescoutai.onrender.com', 'localhost', '127.0.0.1')
    GROUP BY custom_domain
    HAVING COUNT(DISTINCT business_slug) = 1
  ), normalized AS (
    SELECT
      COALESCE(
        CASE
          WHEN lower(trim(COALESCE(e.entity_type, ''))) IN ('profile', 'business')
            THEN NULLIF(lower(trim(e.entity_slug)), '')
          ELSE NULL
        END,
        custom_profile.business_slug,
        CASE
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'u'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'business'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN lower(split_part(e.path, '?', 1)) = '/jw-stone' THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
      CASE
        WHEN lower(trim(COALESCE(e.entity_type, ''))) = 'profile'
          AND NULLIF(lower(trim(e.entity_slug)), '') IS NOT NULL
          THEN '/u/' || NULLIF(lower(trim(e.entity_slug)), '')
        WHEN lower(trim(COALESCE(e.entity_type, ''))) = 'business'
          AND NULLIF(lower(trim(e.entity_slug)), '') IS NOT NULL
          THEN '/business/' || NULLIF(lower(trim(e.entity_slug)), '')
        WHEN custom_profile.business_slug IS NOT NULL
          THEN '/u/' || custom_profile.business_slug
        WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'u'
          THEN '/u/' || NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
        WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'business'
          THEN '/business/' || NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
        WHEN lower(split_part(e.path, '?', 1)) = '/jw-stone' THEN '/jw-stone'
        ELSE NULL
      END AS identity_route,
      COALESCE(NULLIF(trim(e.bot_family), ''), 'unknown') AS crawler_family
    FROM bot_observation_events e
    LEFT JOIN unambiguous_custom_domains custom_profile
      ON custom_profile.custom_domain = regexp_replace(
        lower(split_part(COALESCE(e.host, ''), ':', 1)),
        '^www\\.',
        ''
      )
      AND NOT (
        lower(trim(COALESCE(e.entity_type, ''))) IN ('profile', 'business')
        AND NULLIF(trim(e.entity_slug), '') IS NOT NULL
      )
      AND lower(COALESCE(e.content_type, '')) LIKE 'text/html%'
    WHERE e.observed_at >= $1
      AND e.observed_at < $2
      AND (
        (
          lower(trim(COALESCE(e.entity_type, ''))) IN ('profile', 'business')
          AND NULLIF(trim(e.entity_slug), '') IS NOT NULL
        )
        OR custom_profile.business_slug IS NOT NULL
        OR e.path LIKE '/u/%'
        OR e.path LIKE '/business/%'
        OR lower(split_part(e.path, '?', 1)) = '/jw-stone'
      )
  )
  SELECT
    n.business_slug,
    n.identity_route,
    n.crawler_family,
    COUNT(*)::int AS crawl_requests
  FROM normalized n
  WHERE n.business_slug IS NOT NULL
  GROUP BY n.business_slug, n.identity_route, n.crawler_family
  ORDER BY n.business_slug ASC, n.identity_route ASC, crawl_requests DESC, n.crawler_family ASC;
`;

const discoveryLandingSummarySql = `
  WITH normalized AS (
    SELECT
      id,
      COALESCE(
        NULLIF(lower(data->>'businessSlug'), ''),
        CASE
          WHEN data->>'canonicalRoute' LIKE '/u/%'
            THEN NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
          WHEN data->>'canonicalRoute' LIKE '/business/%'
            THEN NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
          WHEN data->>'canonicalRoute' LIKE '/jw-stone%'
            THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
      CASE
        WHEN data->>'canonicalRoute' LIKE '/u/%'
          THEN '/u/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/business/%'
          THEN '/business/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/jw-stone%' THEN '/jw-stone'
        ELSE NULL
      END AS identity_route,
      NULLIF(data->>'entryRequestId', '') AS entry_request_id,
      ${finiteSourceClassSql("data")} AS source_hint,
      ${finiteReferrerClassSql("data")} AS referrer_class,
      created_at
    FROM events
    WHERE event_type = 'discovery_landing'
      AND created_at >= $1
      AND created_at < $2
  )
  SELECT
    n.business_slug,
    n.identity_route,
    COUNT(*)::int AS landing_events,
    COUNT(DISTINCT entry_request_id)::int AS attributed_landings,
    COUNT(*) FILTER (
      WHERE source_hint IS NOT NULL OR referrer_class IS NOT NULL
    )::int AS source_attributed_landings,
    MIN(created_at) AS first_landing_at,
    MAX(created_at) AS last_landing_at
  FROM normalized n
  WHERE n.business_slug IS NOT NULL
  GROUP BY n.business_slug, n.identity_route;
`;

const discoverySourceSql = `
  WITH normalized AS (
    SELECT
      COALESCE(
        NULLIF(lower(data->>'businessSlug'), ''),
        CASE
          WHEN data->>'canonicalRoute' LIKE '/u/%'
            THEN NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
          WHEN data->>'canonicalRoute' LIKE '/business/%'
            THEN NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
          WHEN data->>'canonicalRoute' LIKE '/jw-stone%'
            THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
      CASE
        WHEN data->>'canonicalRoute' LIKE '/u/%'
          THEN '/u/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/business/%'
          THEN '/business/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/jw-stone%' THEN '/jw-stone'
        ELSE NULL
      END AS identity_route,
      ${finiteSourceClassSql("data")} AS source_hint,
      ${finiteReferrerClassSql("data")} AS referrer_class,
      NULLIF(data->>'entryRequestId', '') AS entry_request_id
    FROM events
    WHERE event_type = 'discovery_landing'
      AND created_at >= $1
      AND created_at < $2
  )
  SELECT
    n.business_slug,
    n.identity_route,
    CASE
      WHEN source_hint IS NOT NULL THEN 'utm:' || source_hint
      WHEN referrer_class IS NOT NULL THEN 'referrer:' || referrer_class
      ELSE 'direct_or_unknown'
    END AS source,
    COUNT(*)::int AS attributed_landings
  FROM normalized n
  WHERE n.source_hint IS NOT NULL OR n.referrer_class IS NOT NULL
  GROUP BY n.business_slug, n.identity_route, source
  ORDER BY attributed_landings DESC, n.business_slug ASC, n.identity_route ASC, source ASC;
`;

const profileViewSummarySql = `
  SELECT
    p.slug AS business_slug,
    '/u/' || lower(p.slug) AS identity_route,
    COUNT(*)::int AS profile_views,
    MIN(v.created_at) AS first_profile_view_at,
    MAX(v.created_at) AS last_profile_view_at
  FROM profile_view_events v
  INNER JOIN profiles p ON p.id = v.profile_id
  WHERE v.created_at >= $1
    AND v.created_at < $2
    AND p.status = 'published'
  GROUP BY p.slug;
`;

const conversionSummarySql = `
  WITH landings AS (
    SELECT DISTINCT
      NULLIF(data->>'entryRequestId', '') AS entry_request_id,
      COALESCE(
        NULLIF(lower(data->>'businessSlug'), ''),
        CASE
          WHEN data->>'canonicalRoute' LIKE '/u/%'
            THEN NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
          WHEN data->>'canonicalRoute' LIKE '/business/%'
            THEN NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
          WHEN data->>'canonicalRoute' LIKE '/jw-stone%'
            THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
      CASE
        WHEN data->>'canonicalRoute' LIKE '/u/%'
          THEN '/u/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/business/%'
          THEN '/business/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/jw-stone%' THEN '/jw-stone'
        ELSE NULL
      END AS identity_route
    FROM events
    WHERE event_type = 'discovery_landing'
      AND created_at >= $1
      AND created_at < $2
      AND NULLIF(data->>'entryRequestId', '') IS NOT NULL
  ), attributed_requests AS (
    SELECT DISTINCT ON (wre.metadata->>'entryRequestId')
      NULLIF(wre.metadata->>'entryRequestId', '') AS entry_request_id,
      NULLIF(lower(wre.metadata->>'businessSlug'), '') AS business_slug,
      wr.id AS request_id,
      wr.created_at
    FROM work_request_events wre
    INNER JOIN work_requests wr ON wr.id = wre.work_request_id
    WHERE wre.type = 'created'
      AND wre.metadata ? 'entryRequestId'
      AND wr.created_at >= $1
      AND wr.created_at < $2
    ORDER BY wre.metadata->>'entryRequestId', wre.created_at ASC
  )
  SELECT
    l.business_slug,
    l.identity_route,
    COUNT(DISTINCT l.entry_request_id)::int AS attributed_landings,
    COUNT(DISTINCT r.request_id)::int AS converted_requests,
    MIN(r.created_at) AS first_request_at,
    MAX(r.created_at) AS last_request_at
  FROM landings l
  LEFT JOIN attributed_requests r ON r.entry_request_id = l.entry_request_id
  WHERE l.business_slug IS NOT NULL
  GROUP BY l.business_slug, l.identity_route;
`;

export const acquisitionFunnelSql = `
  WITH window_milestones AS (
    SELECT
      event_type,
      NULLIF(data->>'entryRequestId', '') AS entry_request_id,
      COALESCE(
        NULLIF(lower(data->>'entitySlug'), ''),
        NULLIF(lower(data->>'profileSlug'), ''),
        NULLIF(lower(data->>'businessSlug'), '')
      ) AS entity_slug,
      NULLIF(data->>'entityType', '') AS entity_type,
      CASE
        WHEN data->>'canonicalRoute' LIKE '/u/%'
          THEN '/u/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/business/%'
          THEN '/business/' || NULLIF(lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2)), '')
        WHEN data->>'canonicalRoute' LIKE '/jw-stone%' THEN '/jw-stone'
        ELSE NULL
      END AS identity_route,
      NULLIF(user_id, '') AS user_id
    FROM events
    WHERE event_type IN (
      'public_profile_discovered',
      'public_profile_cta',
      'acquisition.registration_completed',
      'acquisition.activation_completed'
    )
      AND created_at >= $1
      AND created_at < $2
      AND NULLIF(data->>'entryRequestId', '') IS NOT NULL
      AND (
        (
          event_type = 'public_profile_discovered'
          AND data->>'type' = 'public_profile_discovered'
          AND data->>'serverVerified' = 'true'
          AND data->>'entityType' IN ('business_profile', 'public_profile')
          AND data->>'canonicalRoute'
            ~ '^/(u|business)/[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
          AND (
            data->>'entityType' = 'business_profile'
            OR data->>'canonicalRoute' LIKE '/u/%'
          )
          AND lower(COALESCE(
            NULLIF(data->>'entitySlug', ''),
            NULLIF(data->>'profileSlug', ''),
            NULLIF(data->>'businessSlug', '')
          )) = lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2))
        )
        OR (
          event_type = 'public_profile_cta'
          AND data->>'type' = 'public_profile_cta'
          AND data->>'serverVerified' = 'true'
          AND data->>'ctaKind' IN (
            'direct_connect', 'account_create', 'business_claim', 'booking_request'
          )
          AND data->>'entityType' IN ('business_profile', 'public_profile')
          AND data->>'canonicalRoute'
            ~ '^/(u|business)/[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
          AND (
            data->>'entityType' = 'business_profile'
            OR data->>'canonicalRoute' LIKE '/u/%'
          )
          AND lower(COALESCE(
            NULLIF(data->>'entitySlug', ''),
            NULLIF(data->>'profileSlug', ''),
            NULLIF(data->>'businessSlug', '')
          )) = lower(split_part(trim(both '/' FROM data->>'canonicalRoute'), '/', 2))
        )
        OR (
          event_type = 'acquisition.registration_completed'
          AND data->>'type' = 'acquisition.registration_completed'
          AND data->>'serverConfirmed' = 'true'
          AND data->>'projectionOf' = 'users.created_at'
          AND data->>'flow' IN ('standard', 'multi_profile', 'oauth_google', 'oauth_facebook')
        )
        OR (
          event_type = 'acquisition.activation_completed'
          AND data->>'type' = 'acquisition.activation_completed'
          AND data->>'serverConfirmed' = 'true'
          AND data->>'projectionOf' = 'users.preferences.onboardingOutcome.completedAt'
          AND data->>'activationKind' IN ('business_profile', 'express_result')
        )
      )
  ), landing_sources AS (
    SELECT DISTINCT ON (NULLIF(landing.data->>'entryRequestId', ''))
      NULLIF(landing.data->>'entryRequestId', '') AS entry_request_id,
      CASE
        WHEN ${finiteSourceClassSql("landing.data")} IS NOT NULL
          THEN 'utm:' || ${finiteSourceClassSql("landing.data")}
        WHEN ${finiteReferrerClassSql("landing.data")} IS NOT NULL
          THEN 'referrer:' || ${finiteReferrerClassSql("landing.data")}
        ELSE NULL
      END AS source
    FROM events landing
    INNER JOIN (
      SELECT DISTINCT entry_request_id FROM window_milestones
    ) milestone ON milestone.entry_request_id = NULLIF(landing.data->>'entryRequestId', '')
    WHERE landing.event_type = 'discovery_landing'
      AND landing.data->>'type' = 'discovery_landing'
      AND landing.data->>'serverVerified' = 'true'
      AND (
        ${finiteSourceClassSql("landing.data")} IS NOT NULL
        OR ${finiteReferrerClassSql("landing.data")} IS NOT NULL
      )
    ORDER BY NULLIF(landing.data->>'entryRequestId', ''), landing.created_at ASC
  )
  SELECT
    milestone.entity_slug,
    COALESCE(milestone.entity_type, 'unknown') AS entity_type,
    milestone.identity_route,
    source.source,
    COUNT(DISTINCT milestone.entry_request_id) FILTER (
      WHERE milestone.event_type = 'public_profile_discovered'
    )::int AS profile_discoveries,
    COUNT(DISTINCT milestone.entry_request_id) FILTER (
      WHERE milestone.event_type = 'public_profile_cta'
    )::int AS cta_entries,
    COUNT(DISTINCT milestone.user_id) FILTER (
      WHERE milestone.event_type = 'acquisition.registration_completed'
    )::int AS registrations,
    COUNT(DISTINCT milestone.user_id) FILTER (
      WHERE milestone.event_type = 'acquisition.activation_completed'
    )::int AS activations
  FROM window_milestones milestone
  INNER JOIN landing_sources source ON source.entry_request_id = milestone.entry_request_id
  WHERE milestone.entity_slug IS NOT NULL
    AND source.source IS NOT NULL
  GROUP BY milestone.entity_slug, COALESCE(milestone.entity_type, 'unknown'), milestone.identity_route, source.source
  ORDER BY milestone.entity_slug ASC, milestone.identity_route ASC, source.source ASC;
`;

export const acquisitionProjectionCoverageSql = `
  WITH consumer_provider_account_creations AS (
    SELECT id AS user_id
    FROM users
    WHERE created_at >= $1
      AND created_at < $2
      AND lower(COALESCE(provider, '')) IN ('local', 'google', 'facebook')
  ), excluded_system_provider_account_creations AS (
    SELECT id AS user_id
    FROM users
    WHERE created_at >= $1
      AND created_at < $2
      AND lower(COALESCE(provider, '')) NOT IN ('local', 'google', 'facebook')
  ), consumer_provider_activations AS (
    SELECT id AS user_id
    FROM users
    WHERE onboarding_completed = true
      AND lower(COALESCE(provider, '')) IN ('local', 'google', 'facebook')
      AND preferences->'onboardingOutcome'->>'kind' IN ('business_profile', 'express_result')
      AND CASE
        WHEN pg_input_is_valid(
          preferences->'onboardingOutcome'->>'completedAt',
          'timestamp with time zone'
        )
          THEN (preferences->'onboardingOutcome'->>'completedAt')::timestamptz
        ELSE NULL
      END >= $1
      AND CASE
        WHEN pg_input_is_valid(
          preferences->'onboardingOutcome'->>'completedAt',
          'timestamp with time zone'
        )
          THEN (preferences->'onboardingOutcome'->>'completedAt')::timestamptz
        ELSE NULL
      END < $2
  ), registration_projections AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      NULLIF(data->>'entryRequestId', '') AS entry_request_id
    FROM events
    WHERE event_type = 'acquisition.registration_completed'
      AND user_id IS NOT NULL
      AND data->>'type' = 'acquisition.registration_completed'
      AND data->>'serverConfirmed' = 'true'
      AND data->>'projectionOf' = 'users.created_at'
      AND data->>'flow' IN ('standard', 'multi_profile', 'oauth_google', 'oauth_facebook')
    ORDER BY user_id, created_at ASC
  ), activation_projections AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      NULLIF(data->>'entryRequestId', '') AS entry_request_id
    FROM events
    WHERE event_type = 'acquisition.activation_completed'
      AND user_id IS NOT NULL
      AND data->>'type' = 'acquisition.activation_completed'
      AND data->>'serverConfirmed' = 'true'
      AND data->>'projectionOf' = 'users.preferences.onboardingOutcome.completedAt'
      AND data->>'activationKind' IN ('business_profile', 'express_result')
    ORDER BY user_id, created_at ASC
  ), source_attributed_entries AS (
    SELECT DISTINCT NULLIF(data->>'entryRequestId', '') AS entry_request_id
    FROM events
    WHERE event_type = 'discovery_landing'
      AND data->>'type' = 'discovery_landing'
      AND data->>'serverVerified' = 'true'
      AND NULLIF(data->>'entryRequestId', '') IS NOT NULL
      AND (
        ${finiteSourceClassSql("data")} IS NOT NULL
        OR ${finiteReferrerClassSql("data")} IS NOT NULL
      )
  )
  SELECT
    (SELECT COUNT(*)::int FROM consumer_provider_account_creations)
      AS consumer_provider_account_creations,
    (SELECT COUNT(*)::int FROM excluded_system_provider_account_creations)
      AS excluded_system_provider_account_creations,
    (SELECT COUNT(*)::int
       FROM consumer_provider_account_creations account
       INNER JOIN registration_projections projection USING (user_id)) AS projected_registrations,
    (SELECT COUNT(*)::int
       FROM consumer_provider_account_creations account
       INNER JOIN registration_projections projection USING (user_id)
       INNER JOIN source_attributed_entries source
         ON source.entry_request_id = projection.entry_request_id)
      AS source_attributed_registration_projections,
    (SELECT COUNT(*)::int
       FROM consumer_provider_account_creations account
       INNER JOIN registration_projections projection USING (user_id)
       LEFT JOIN source_attributed_entries source
         ON source.entry_request_id = projection.entry_request_id
      WHERE source.entry_request_id IS NULL)
      AS registration_projections_without_source,
    (SELECT COUNT(*)::int
       FROM consumer_provider_account_creations account
       LEFT JOIN registration_projections projection USING (user_id)
      WHERE projection.user_id IS NULL) AS missing_registration_projections,
    (SELECT COUNT(*)::int FROM consumer_provider_activations)
      AS consumer_provider_activations,
    (SELECT COUNT(*)::int
       FROM consumer_provider_activations activation
       INNER JOIN activation_projections projection USING (user_id)) AS projected_activations,
    (SELECT COUNT(*)::int
       FROM consumer_provider_activations activation
       INNER JOIN activation_projections projection USING (user_id)
       INNER JOIN source_attributed_entries source
         ON source.entry_request_id = projection.entry_request_id)
      AS source_attributed_activation_projections,
    (SELECT COUNT(*)::int
       FROM consumer_provider_activations activation
       INNER JOIN activation_projections projection USING (user_id)
       LEFT JOIN source_attributed_entries source
         ON source.entry_request_id = projection.entry_request_id
      WHERE source.entry_request_id IS NULL)
      AS activation_projections_without_source,
    (SELECT COUNT(*)::int
       FROM consumer_provider_activations activation
       LEFT JOIN activation_projections projection USING (user_id)
      WHERE projection.user_id IS NULL) AS missing_activation_projections;
`;

export function parsePositiveDays(args) {
  const argument = args.find((arg) => arg.startsWith("--days="));
  if (argument === undefined) return 30;
  const raw = argument.slice("--days=".length).trim();
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --days value: ${raw || "(empty)"}`);
  }
  return parsed;
}

function parseOutputDirectory(args) {
  const raw = args.find((arg) => arg.startsWith("--out-dir="))?.split("=").slice(1).join("=");
  return raw?.trim() || "artifacts";
}

export function parseDateArgument(args, prefix) {
  const argument = args.find((arg) => arg.startsWith(prefix));
  if (argument === undefined) return null;
  const raw = argument.slice(prefix.length).trim();
  if (!raw) {
    throw new Error(`Invalid ${prefix.slice(0, -1)} date: value is required`);
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/
  );
  if (!match) {
    throw new Error(`Invalid ${prefix.slice(0, -1)} date: ${raw}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (
    month < 1
    || month > 12
    || day < 1
    || day > daysInMonth[month - 1]
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
  ) {
    throw new Error(`Invalid ${prefix.slice(0, -1)} date: ${raw}`);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${prefix.slice(0, -1)} date: ${raw}`);
  }
  return parsed;
}

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toRate(numerator, denominator) {
  const safeNumerator = toCount(numerator);
  const safeDenominator = toCount(denominator);
  return safeDenominator > 0
    ? Number(((safeNumerator / safeDenominator) * 100).toFixed(2))
    : null;
}

function normalizeActivitySlug(value) {
  const normalizedSlug = String(value ?? "").trim().toLowerCase();
  return normalizedSlug || null;
}

function normalizeIdentityRoute(value) {
  const route = String(value ?? "")
    .trim()
    .toLowerCase()
    .split(/[?#]/)[0]
    .replace(/\/{2,}/g, "/");
  if (route === "/jw-stone") return route;
  const match = route.match(/^\/(u|business)\/([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)$/);
  return match ? `/${match[1]}/${match[2]}` : null;
}

function addActivityRow(map, row) {
  const slug = row.business_slug;
  const normalizedSlug = normalizeActivitySlug(slug);
  if (!normalizedSlug) return null;
  const catalogType = String(row.entity_type || "published_profile");
  const fallbackIdentityRoute =
    catalogType === "governed_directory_business"
      ? `/business/${normalizedSlug}`
      : `/u/${normalizedSlug}`;
  const identityRoute = normalizeIdentityRoute(row.identity_route) || fallbackIdentityRoute;
  if (!map.has(identityRoute)) {
    map.set(identityRoute, {
      key: identityRoute,
      slug: normalizedSlug,
      entityType: catalogType,
      displayName:
        row.display_name || (normalizedSlug === "jw-stone" ? "JW Stone" : null),
      canonicalRoute:
        row.canonical_route ||
        (normalizedSlug === "jw-stone" ? "/jw-stone" : fallbackIdentityRoute),
      identityRoute,
    });
  }
  return map.get(identityRoute);
}

function buildCatalogKeysBySlug(catalog) {
  const result = new Map();
  for (const [key, entity] of catalog) {
    const keys = result.get(entity.slug) || [];
    keys.push(key);
    result.set(entity.slug, keys);
  }
  return result;
}

function resolveActivityKey(row, catalog, catalogKeysBySlug) {
  const identityRoute = normalizeIdentityRoute(row?.identity_route);
  if (identityRoute && catalog.has(identityRoute)) return identityRoute;
  const slug = normalizeActivitySlug(row?.business_slug ?? row?.entity_slug);
  const candidates = slug ? catalogKeysBySlug.get(slug) || [] : [];
  return candidates.length === 1 ? candidates[0] : null;
}

export function buildReport({
  catalogRows,
  crawlRows,
  crawlFamilyRows = [],
  landingRows,
  sourceRows,
  profileViewRows,
  conversionRows,
  acquisitionFunnelRows = [],
  acquisitionCoverageRows = [],
  crawlObservationAvailable = true,
  generatedAt,
  from,
  to,
  productionActivationAt = new Date(DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt),
  productionActivationAtLabel = null,
  acquisitionFunnelActivatedAt = ACQUISITION_FUNNEL_RELEASE.productionActivatedAt,
  acquisitionFunnelActivatedAtLabel = null,
}) {
  const activationAt = productionActivationAt instanceof Date
    ? productionActivationAt
    : new Date(productionActivationAt);
  if ([from, to, activationAt].some((date) => !(date instanceof Date) || Number.isNaN(date.getTime()))) {
    throw new Error("Invalid measurement date");
  }
  const windowDurationMilliseconds = to.getTime() - from.getTime();
  if (windowDurationMilliseconds <= 0) {
    throw new Error("Measurement window must end after it starts");
  }
  const measuredWindowDays = Number((windowDurationMilliseconds / MILLISECONDS_PER_DAY).toFixed(6));
  const resolvedProductionActivationAtLabel = productionActivationAtLabel
    || (typeof productionActivationAt === "string"
      ? productionActivationAt
      : activationAt.toISOString());
  const historicalPreRelease = to <= activationAt;
  const postRelease = from >= activationAt;
  const phase = historicalPreRelease
    ? "historical_pre_release"
    : postRelease
      ? "post_release"
      : "crosses_release_boundary";
  const releaseMetricsApplicable = postRelease;
  const releaseMetricsNotApplicableReason = historicalPreRelease
    ? "release was not active during this window"
    : "window crosses the release boundary; split the window at production activation";
  const funnelActivationAt = acquisitionFunnelActivatedAt
    ? acquisitionFunnelActivatedAt instanceof Date
      ? acquisitionFunnelActivatedAt
      : new Date(acquisitionFunnelActivatedAt)
    : null;
  if (funnelActivationAt && Number.isNaN(funnelActivationAt.getTime())) {
    throw new Error("Invalid acquisition funnel activation date");
  }
  const acquisitionFunnelPhase = !funnelActivationAt
    ? "pending_production_activation"
    : to <= funnelActivationAt
      ? "historical_pre_release"
      : from >= funnelActivationAt
        ? "post_release"
        : "crosses_release_boundary";
  const acquisitionFunnelApplicable = acquisitionFunnelPhase === "post_release";
  const acquisitionFunnelNotApplicableReason =
    acquisitionFunnelPhase === "pending_production_activation"
      ? "acquisition measurement release has not been production-activated"
      : acquisitionFunnelPhase === "historical_pre_release"
        ? "acquisition measurement release was not active during this window"
        : "window crosses the acquisition measurement release boundary";
  const excludedPublishedProfiles = catalogRows
    .filter((row) => row.is_publicly_exposable !== true)
    .map((row) => {
      const identityRoute = normalizeIdentityRoute(row.identity_route);
      return {
        slug: normalizeActivitySlug(row.business_slug),
        ...(identityRoute ? { identityRoute } : {}),
        displayName: row.display_name || null,
        reason: String(row.exclusion_reason || "public_exposure_not_authorized"),
      };
    })
    .filter((row) => row.slug);
  const publiclyExposableCatalogRows = catalogRows.filter(
    (row) => row.is_publicly_exposable === true
  );
  const profiles = new Map();
  for (const row of publiclyExposableCatalogRows) {
    const profile = addActivityRow(profiles, row);
    if (!profile) continue;
    profile.displayName = row.display_name || profile.displayName;
    profile.canonicalRoute = row.canonical_route || profile.canonicalRoute;
  }
  const catalogKeysBySlug = buildCatalogKeysBySlug(profiles);
  const rowsByCatalogKey = (rows) =>
    new Map(
      rows
        .map((row) => [resolveActivityKey(row, profiles, catalogKeysBySlug), row])
        .filter(([key]) => key)
    );
  const crawlByKey = rowsByCatalogKey(crawlRows);
  const landingByKey = rowsByCatalogKey(landingRows);
  const viewsByKey = rowsByCatalogKey(profileViewRows);
  const conversionByKey = rowsByCatalogKey(conversionRows);
  const crawlerFamiliesByKey = new Map();
  for (const row of crawlFamilyRows) {
    const key = resolveActivityKey(row, profiles, catalogKeysBySlug);
    if (!key) continue;
    const family = String(row.crawler_family || "unknown");
    if (!crawlerFamiliesByKey.has(key)) crawlerFamiliesByKey.set(key, []);
    crawlerFamiliesByKey.get(key).push({
      crawlerFamily: family,
      crawlRequests: toCount(row.crawl_requests),
    });
  }
  const sources = releaseMetricsApplicable
    ? sourceRows
        .map((row) => ({
          key: resolveActivityKey(row, profiles, catalogKeysBySlug),
          slug: normalizeActivitySlug(row.business_slug),
          source: String(row.source),
          attributedLandings: toCount(row.attributed_landings),
        }))
        .filter((row) => row.key && row.slug)
    : [];
  const acquisitionSources = acquisitionFunnelApplicable
    ? acquisitionFunnelRows
        .map((row) => {
          const key = resolveActivityKey(row, profiles, catalogKeysBySlug);
          const catalogEntity = key ? profiles.get(key) : null;
          return {
            key: key || normalizeIdentityRoute(row.identity_route),
            identityRoute: normalizeIdentityRoute(row.identity_route),
            slug: normalizeActivitySlug(row.entity_slug),
            entityType: String(row.entity_type || "unknown"),
            catalogClassification:
              catalogEntity?.entityType || "verified_signed_event_outside_current_catalog",
            source: String(row.source || ""),
            profileDiscoveries: toCount(row.profile_discoveries),
            ctaEntries: toCount(row.cta_entries),
            registrations: toCount(row.registrations),
            activations: toCount(row.activations),
          };
        })
        .filter((row) => row.slug && row.source)
        .map((row) => ({
          ...row,
          discoveryToCtaRate: toRate(row.ctaEntries, row.profileDiscoveries),
          ctaToRegistrationRate: toRate(row.registrations, row.ctaEntries),
          registrationToActivationRate: toRate(row.activations, row.registrations),
        }))
    : [];
  const acquisitionByKey = new Map();
  for (const row of acquisitionSources) {
    if (!row.key) continue;
    const current = acquisitionByKey.get(row.key) || {
      profileDiscoveries: 0,
      ctaEntries: 0,
      registrations: 0,
      activations: 0,
    };
    current.profileDiscoveries += row.profileDiscoveries;
    current.ctaEntries += row.ctaEntries;
    current.registrations += row.registrations;
    current.activations += row.activations;
    acquisitionByKey.set(row.key, current);
  }

  const profileRows = Array.from(profiles.values())
    .map((profile) => {
      const crawl = crawlByKey.get(profile.key) || {};
      const landing = landingByKey.get(profile.key) || {};
      const view = viewsByKey.get(profile.key) || {};
      const conversion = conversionByKey.get(profile.key) || {};
      const acquisition = acquisitionByKey.get(profile.key) || {
        profileDiscoveries: 0,
        ctaEntries: 0,
        registrations: 0,
        activations: 0,
      };
      const crawled = crawlObservationAvailable ? toCount(crawl.crawl_hits) : 0;
      const sourceAttributed = releaseMetricsApplicable
        ? toCount(landing.source_attributed_landings)
        : null;
      const discoveryLandings = toCount(landing.landing_events);
      const profileViews = toCount(view.profile_views);
      const verifiedAttributions = releaseMetricsApplicable
        ? toCount(landing.attributed_landings)
        : null;
      const convertedRequests = releaseMetricsApplicable
        ? toCount(conversion.converted_requests)
        : null;

      let stage = "no_signal";
      if (releaseMetricsApplicable && convertedRequests > 0) stage = "converted";
      else if (profileViews > 0 || discoveryLandings > 0) stage = "visited";
      else if (releaseMetricsApplicable && sourceAttributed > 0) stage = "surfaced";
      else if (crawlObservationAvailable && crawled > 0) stage = "crawled";

      return {
        slug: profile.slug,
        entityType: profile.entityType,
        identityRoute: profile.identityRoute,
        displayName: profile.displayName,
        canonicalRoute: profile.canonicalRoute,
        stage,
        crawled: {
          available: crawlObservationAvailable,
          hits: crawlObservationAvailable ? crawled : null,
          successes: crawlObservationAvailable ? toCount(crawl.crawl_successes) : null,
          clientErrors: crawlObservationAvailable ? toCount(crawl.crawl_client_errors) : null,
          serverErrors: crawlObservationAvailable ? toCount(crawl.crawl_server_errors) : null,
          crawlerCount: crawlObservationAvailable ? toCount(crawl.crawler_count) : null,
          uniqueUrls: crawlObservationAvailable ? toCount(crawl.unique_urls) : null,
          firstSeenUrls: crawlObservationAvailable ? toCount(crawl.first_seen_urls) : null,
          recrawlUrls: crawlObservationAvailable ? toCount(crawl.recrawl_urls) : null,
          firstAt: toIso(crawl.first_crawled_at),
          lastAt: toIso(crawl.last_crawled_at),
        },
        surfaced: {
          sourceAttributedLandings: sourceAttributed,
          verifiedAttributions,
          sources: sources
            .filter((source) => source.key === profile.key)
            .map(({ source, attributedLandings }) => ({ source, attributedLandings })),
        },
        visited: {
          profileViews,
          profileViewVisitors: null,
          discoveryLandings,
          discoveryVisitors: null,
          firstAt: toIso(view.first_profile_view_at || landing.first_landing_at),
          lastAt: toIso(view.last_profile_view_at || landing.last_landing_at),
        },
        converted: {
          requests: convertedRequests,
          matchedLandings: releaseMetricsApplicable
            ? toCount(conversion.attributed_landings)
            : null,
          firstAt: releaseMetricsApplicable ? toIso(conversion.first_request_at) : null,
          lastAt: releaseMetricsApplicable ? toIso(conversion.last_request_at) : null,
        },
        acquisitionFunnel: acquisitionFunnelApplicable
          ? {
              ...acquisition,
              discoveryToCtaRate: toRate(
                acquisition.ctaEntries,
                acquisition.profileDiscoveries
              ),
              ctaToRegistrationRate: toRate(
                acquisition.registrations,
                acquisition.ctaEntries
              ),
              registrationToActivationRate: toRate(
                acquisition.activations,
                acquisition.registrations
              ),
            }
          : null,
        crawlerFamilies: crawlerFamiliesByKey.get(profile.key) || [],
      };
    })
    .sort((a, b) => {
      const stageRank = { converted: 4, visited: 3, surfaced: 2, crawled: 1, no_signal: 0 };
      return (
        stageRank[b.stage] - stageRank[a.stage] ||
        b.converted.requests - a.converted.requests ||
        b.visited.profileViews - a.visited.profileViews ||
        b.crawled.hits - a.crawled.hits ||
        a.slug.localeCompare(b.slug)
      );
    });

  const summary = {
    publishedProfiles: catalogRows.filter(
      (row) => String(row.entity_type || "published_profile") === "published_profile"
    ).length,
    governedDirectoryBusinesses: publiclyExposableCatalogRows.filter(
      (row) => String(row.entity_type || "") === "governed_directory_business"
    ).length,
    catalogProfiles: publiclyExposableCatalogRows.length,
    excludedPublishedProfiles: excludedPublishedProfiles.length,
    profilesWithCrawl: crawlObservationAvailable
      ? profileRows.filter((row) => row.crawled.hits > 0).length
      : null,
    profilesWithSourceAttributedLanding: releaseMetricsApplicable
      ? profileRows.filter((row) => row.surfaced.sourceAttributedLandings > 0).length
      : null,
    profilesWithVerifiedAttribution: releaseMetricsApplicable
      ? profileRows.filter((row) => row.surfaced.verifiedAttributions > 0).length
      : null,
    profilesWithVisit: profileRows.filter(
      (row) => row.visited.profileViews > 0 || row.visited.discoveryLandings > 0
    ).length,
    profilesWithConversion: releaseMetricsApplicable
      ? profileRows.filter((row) => row.converted.requests > 0).length
      : null,
    crawlHits: crawlObservationAvailable
      ? profileRows.reduce((sum, row) => sum + row.crawled.hits, 0)
      : null,
    sourceAttributedLandings: releaseMetricsApplicable
      ? profileRows.reduce((sum, row) => sum + row.surfaced.sourceAttributedLandings, 0)
      : null,
    verifiedAttributions: releaseMetricsApplicable
      ? profileRows.reduce((sum, row) => sum + row.surfaced.verifiedAttributions, 0)
      : null,
    profileViews: profileRows.reduce((sum, row) => sum + row.visited.profileViews, 0),
    discoveryLandings: profileRows.reduce((sum, row) => sum + row.visited.discoveryLandings, 0),
    convertedRequests: releaseMetricsApplicable
      ? profileRows.reduce((sum, row) => sum + row.converted.requests, 0)
      : null,
  };

  const crawlerFamilyTotals = new Map();
  for (const profile of profileRows) {
    for (const family of profile.crawlerFamilies) {
      crawlerFamilyTotals.set(
        family.crawlerFamily,
        (crawlerFamilyTotals.get(family.crawlerFamily) || 0) + family.crawlRequests
      );
    }
  }

  const acquisitionTotals = acquisitionSources.reduce(
    (totals, row) => ({
      profileDiscoveries: totals.profileDiscoveries + row.profileDiscoveries,
      ctaEntries: totals.ctaEntries + row.ctaEntries,
      registrations: totals.registrations + row.registrations,
      activations: totals.activations + row.activations,
    }),
    { profileDiscoveries: 0, ctaEntries: 0, registrations: 0, activations: 0 }
  );
  const acquisitionCoverageRow = acquisitionCoverageRows[0] || {};
  const acquisitionProjectionCoverage = acquisitionFunnelApplicable
    ? {
        authority: {
          registration:
            "users.created_at proves account existence; provider local, google, or facebook defines a consumer-provider candidate cohort, not an organic or self-serve channel",
          activation:
            "users.preferences.onboardingOutcome.completedAt with onboarding_completed=true proves activation in the same candidate cohort; provider does not prove channel",
        },
        consumerProviderAccountCreations: toCount(
          acquisitionCoverageRow.consumer_provider_account_creations
        ),
        excludedSystemProviderAccountCreations: toCount(
          acquisitionCoverageRow.excluded_system_provider_account_creations
        ),
        projectedRegistrations: toCount(acquisitionCoverageRow.projected_registrations),
        sourceAttributedRegistrationProjections: toCount(
          acquisitionCoverageRow.source_attributed_registration_projections
        ),
        registrationProjectionsWithoutSource: toCount(
          acquisitionCoverageRow.registration_projections_without_source
        ),
        missingRegistrationProjections: toCount(
          acquisitionCoverageRow.missing_registration_projections
        ),
        consumerProviderActivations: toCount(
          acquisitionCoverageRow.consumer_provider_activations
        ),
        projectedActivations: toCount(acquisitionCoverageRow.projected_activations),
        sourceAttributedActivationProjections: toCount(
          acquisitionCoverageRow.source_attributed_activation_projections
        ),
        activationProjectionsWithoutSource: toCount(
          acquisitionCoverageRow.activation_projections_without_source
        ),
        missingActivationProjections: toCount(
          acquisitionCoverageRow.missing_activation_projections
        ),
      }
    : null;

  return {
    generatedAt,
    windowDays: measuredWindowDays,
    window: { from: from.toISOString(), to: to.toISOString() },
    measurement: {
      phase,
      releaseCommit: DISCOVERY_PERFORMANCE_RELEASE.commit,
      productionActivatedAt: resolvedProductionActivationAtLabel,
      signedAttribution: releaseMetricsApplicable
        ? { status: "measured" }
        : { status: "not_applicable", reason: releaseMetricsNotApplicableReason },
      discoveryConversion: releaseMetricsApplicable
        ? { status: "measured" }
        : { status: "not_applicable", reason: releaseMetricsNotApplicableReason },
      acquisitionFunnel: acquisitionFunnelApplicable
        ? {
            status: "measured",
            phase: acquisitionFunnelPhase,
            releaseCommit: ACQUISITION_FUNNEL_RELEASE.commit,
            productionActivatedAt:
              acquisitionFunnelActivatedAtLabel || funnelActivationAt.toISOString(),
          }
        : {
            status: "not_applicable",
            phase: acquisitionFunnelPhase,
            releaseCommit: ACQUISITION_FUNNEL_RELEASE.commit,
            productionActivatedAt: acquisitionFunnelActivatedAtLabel,
            reason: acquisitionFunnelNotApplicableReason,
          },
    },
    definitions: DISCOVERY_PERFORMANCE_DEFINITIONS,
    evidenceAvailability: {
      crawlObservationEvents: crawlObservationAvailable,
    },
    summary,
    profiles: profileRows,
    sources,
    acquisitionFunnel: acquisitionFunnelApplicable
      ? {
          status: "measured",
          totals: {
            ...acquisitionTotals,
            discoveryToCtaRate: toRate(
              acquisitionTotals.ctaEntries,
              acquisitionTotals.profileDiscoveries
            ),
            ctaToRegistrationRate: toRate(
              acquisitionTotals.registrations,
              acquisitionTotals.ctaEntries
            ),
            registrationToActivationRate: toRate(
              acquisitionTotals.activations,
              acquisitionTotals.registrations
            ),
          },
          sources: acquisitionSources,
          projectionCoverage: acquisitionProjectionCoverage,
        }
      : {
          status: "not_applicable",
          reason: acquisitionFunnelNotApplicableReason,
          totals: null,
          sources: [],
          projectionCoverage: null,
        },
    coverage: {
      excludedPublishedProfiles,
      uncrawledProfiles: crawlObservationAvailable
        ? profileRows
            .filter((profile) => profile.crawled.hits === 0)
            .map(({ slug, displayName, identityRoute }) => ({
              slug,
              displayName,
              identityRoute,
            }))
        : [],
      unvisitedProfiles: profileRows
        .filter((profile) => profile.visited.profileViews === 0 && profile.visited.discoveryLandings === 0)
        .map(({ slug, displayName, identityRoute }) => ({ slug, displayName, identityRoute })),
    },
    crawlDistributionByCrawlerFamily: Array.from(crawlerFamilyTotals.entries())
      .map(([crawlerFamily, crawlRequests]) => ({ crawlerFamily, crawlRequests }))
      .sort((a, b) => b.crawlRequests - a.crawlRequests || a.crawlerFamily.localeCompare(b.crawlerFamily)),
    requestDistributionByProfile: releaseMetricsApplicable
      ? {
          status: "measured",
          items: profileRows.map((profile) => ({
            slug: profile.slug,
            displayName: profile.displayName,
            requests: profile.converted.requests,
          })),
        }
      : {
          status: "not_applicable",
          reason: releaseMetricsNotApplicableReason,
          items: [],
        },
  };
}

export function buildMarkdown(report) {
  const formatMetric = (value) => (value === null || value === undefined ? "N/A" : String(value));
  const formatPercent = (value) =>
    value === null || value === undefined ? "N/A" : `${value}%`;
  const historicalPreRelease = report.measurement.phase === "historical_pre_release";
  const crossesReleaseBoundary = report.measurement.phase === "crosses_release_boundary";
  const sourceLabel = historicalPreRelease ? "Historical source proxy" : "Source-attributed";
  const lines = [
    "# TradeScout Discovery Performance Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Window: ${report.window.from} to ${report.window.to} (${report.windowDays} day(s))`,
    "",
    "## Measurement Definitions",
    "",
    ...Object.entries(report.definitions).map(([key, value]) => `- **${key}:** ${value}`),
    "- Search-engine impression data is not available in the application telemetry. Search Console or equivalent engine data is required to measure impressions directly.",
    "",
    "## Release Measurement Boundary",
    "",
    `- Release commit: ${report.measurement.releaseCommit}`,
    `- Production activation: ${report.measurement.productionActivatedAt}`,
    `- Measurement phase: **${report.measurement.phase}**`,
    historicalPreRelease
      ? "- Signed attribution and discovery conversion are **not applicable** in this pre-release window; no rate or failure percentage is calculated."
      : crossesReleaseBoundary
        ? "- Signed attribution and discovery conversion are **not applicable** in this mixed window; split it at the production activation boundary."
        : "- Signed attribution and discovery conversion are measured only from the production activation boundary.",
    "",
    "## Summary",
    "",
    `- Published profile rows: ${report.summary.publishedProfiles}`,
    `- Completed-snapshot governed directory businesses: ${report.summary.governedDirectoryBusinesses}`,
    `- Publicly exposable profile/directory entities: ${report.summary.catalogProfiles}`,
    `- Excluded published profiles: ${report.summary.excludedPublishedProfiles}`,
    report.evidenceAvailability.crawlObservationEvents
      ? "- Crawl observation ledger: available"
      : "- Crawl observation ledger: not provisioned in this database; crawl metrics are N/A, not zero.",
    "",
    "| Signal | Profiles with evidence | Total |",
    "| --- | ---: | ---: |",
    `| Crawled | ${formatMetric(report.summary.profilesWithCrawl)} | ${formatMetric(report.summary.crawlHits)} bot requests |`,
    `| ${sourceLabel} | ${formatMetric(report.summary.profilesWithSourceAttributedLanding)} | ${formatMetric(report.summary.sourceAttributedLandings)} landing events |`,
    `| Signed attribution IDs | ${formatMetric(report.summary.profilesWithVerifiedAttribution)} | ${formatMetric(report.summary.verifiedAttributions)} verified entryRequestIds |`,
    `| Visited | ${formatMetric(report.summary.profilesWithVisit)} | ${formatMetric(report.summary.profileViews)} profile views / ${formatMetric(report.summary.discoveryLandings)} discovery landings |`,
    `| Discovery conversion | ${formatMetric(report.summary.profilesWithConversion)} | ${formatMetric(report.summary.convertedRequests)} matched requests |`,
    "",
    "## Source-Attributed Acquisition Funnel",
    "",
  ];

  if (report.acquisitionFunnel.status === "not_applicable") {
    lines.push(
      `Not applicable: ${report.acquisitionFunnel.reason}. Zeroes before activation are not interpreted as funnel failure.`,
      ""
    );
  } else {
    const funnel = report.acquisitionFunnel.totals;
    const coverage = report.acquisitionFunnel.projectionCoverage;
    lines.push(
      "| Profile discoveries | CTA entries | Registrations | Activations | Discovery -> CTA | CTA -> registration | Registration -> activation |",
      "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      `| ${funnel.profileDiscoveries} | ${funnel.ctaEntries} | ${funnel.registrations} | ${funnel.activations} | ${formatPercent(funnel.discoveryToCtaRate)} | ${formatPercent(funnel.ctaToRegistrationRate)} | ${formatPercent(funnel.registrationToActivationRate)} |`,
      "",
      "users.created_at is authoritative only for account existence, and the canonical onboarding outcome is authoritative only for activation. Provider values define a consumer-provider candidate cohort; they do not prove an organic or self-serve channel. Lifecycle events are attribution projections and server registration-flow classification; they are fail-soft and can be missing.",
      "Durable transactional attribution/outbox delivery is not active in this release. Missing lifecycle projections and source-attribution coverage are reported explicitly; closing that fail-soft attribution gap is D4 hardening debt.",
      "",
      "| Projection reconciliation | Canonical account/outcome rows | Projected rows | Missing projections |",
      "| --- | ---: | ---: | ---: |",
      `| Consumer-provider account creations (${coverage.authority.registration}) | ${coverage.consumerProviderAccountCreations} | ${coverage.projectedRegistrations} | ${coverage.missingRegistrationProjections} |`,
      `| Consumer-provider activations (${coverage.authority.activation}) | ${coverage.consumerProviderActivations} | ${coverage.projectedActivations} | ${coverage.missingActivationProjections} |`,
      "",
      `Excluded system/provisioned-provider account creations in this window: ${coverage.excludedSystemProviderAccountCreations}. Local, Google, and Facebook are only consumer-provider candidates; without a durable origin field they are not labeled organic or self-serve signups.`,
      "",
      "| Source-attribution coverage | Lifecycle projections | Source-attributed | Projected without source |",
      "| --- | ---: | ---: | ---: |",
      `| Registrations | ${coverage.projectedRegistrations} | ${coverage.sourceAttributedRegistrationProjections} | ${coverage.registrationProjectionsWithoutSource} |`,
      `| Activations | ${coverage.projectedActivations} | ${coverage.sourceAttributedActivationProjections} | ${coverage.activationProjectionsWithoutSource} |`,
      "",
      "| Entity | Identity route | Catalog classification | Source | Discoveries | CTA entries | Registrations | Activations |",
      "| --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
      ...report.acquisitionFunnel.sources.map(
        (row) =>
          `| ${row.slug} | ${row.identityRoute || "N/A"} | ${row.catalogClassification} | ${row.source} | ${row.profileDiscoveries} | ${row.ctaEntries} | ${row.registrations} | ${row.activations} |`
      ),
      ""
    );
  }

  lines.push(
    "## Profile Matrix",
    "",
    `| Entity | Route | Stage | Crawl hits | ${sourceLabel} | Profile-data fetches | Discovery landings | Requests |`,
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const profile of report.profiles) {
    lines.push(
      `| ${profile.displayName || profile.slug} (${profile.slug}) | ${profile.canonicalRoute} | ${profile.stage} | ${formatMetric(profile.crawled.hits)} | ${formatMetric(profile.surfaced.sourceAttributedLandings)} | ${profile.visited.profileViews} | ${profile.visited.discoveryLandings} | ${formatMetric(profile.converted.requests)} |`
    );
  }

  lines.push("", "## Coverage", "");
  lines.push(
    `- Excluded published profiles (${report.coverage.excludedPublishedProfiles.length}): ${report.coverage.excludedPublishedProfiles.length ? report.coverage.excludedPublishedProfiles.map((profile) => `${profile.displayName || profile.slug} (${profile.slug}: ${profile.reason})`).join(", ") : "none"}`,
    `- Uncrawled public entities (${report.coverage.uncrawledProfiles.length}): ${report.coverage.uncrawledProfiles.length ? report.coverage.uncrawledProfiles.map((profile) => `${profile.displayName || profile.slug} (${profile.identityRoute || profile.slug})`).join(", ") : "none"}`,
    `- Entities without profile-data-fetch/landing evidence (${report.coverage.unvisitedProfiles.length}): ${report.coverage.unvisitedProfiles.length ? report.coverage.unvisitedProfiles.map((profile) => `${profile.displayName || profile.slug} (${profile.identityRoute || profile.slug})`).join(", ") : "none"}`,
    ""
  );

  lines.push("## Crawl Distribution by Public Entity and Crawler Family", "");
  if (!report.profiles.some((profile) => profile.crawlerFamilies.length)) {
    lines.push("No crawler-family requests were recorded in this window.");
  } else {
    lines.push("| Entity route | Crawler family | Crawl requests |", "| --- | --- | ---: |");
    for (const profile of report.profiles) {
      for (const family of profile.crawlerFamilies) {
        lines.push(`| ${profile.identityRoute || profile.slug} | ${family.crawlerFamily} | ${family.crawlRequests} |`);
      }
    }
  }

  lines.push("", "## Request Distribution by Profile", "");
  if (report.requestDistributionByProfile.status === "not_applicable") {
    lines.push("Not applicable before the production release boundary.");
  } else {
    lines.push("| Profile | Requests |", "| --- | ---: |");
    for (const profile of report.requestDistributionByProfile.items) {
      lines.push(`| ${profile.displayName || profile.slug} (${profile.slug}) | ${profile.requests} |`);
    }
  }

  lines.push("", "## Source Attribution", "");
  if (!report.sources.length) {
    lines.push("No source-attributed discovery landings were recorded in this window.");
  } else {
    lines.push("| Entity route | Source | Attributed landings |", "| --- | --- | ---: |");
    for (const source of report.sources) {
      lines.push(`| ${source.key || source.slug} | ${source.source} | ${source.attributedLandings} |`);
    }
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    "- A public entity with crawl evidence but no visit evidence has recognized crawler traffic without a recorded browser/profile-data fetch. Neither signal proves a human or unique visitor.",
    "- A public entity with source-attributed landings has evidence that a browser arrived from a finite source or referrer class, but this is not an impression or unique-visitor count.",
    "- A source-attributed landing without a verified entryRequestId can be measured as a landing but cannot be joined to a later request.",
    historicalPreRelease || crossesReleaseBoundary
      ? "- Signed attribution and discovery conversion are not applicable until the selected window starts at or after the production activation timestamp above."
      : "- A request is counted as discovery-converted only when the verified server-issued entryRequestId is present in both the landing event and the created request event.",
    "- Zero values are evidence gaps in this window, not proof that a public entity was never crawled, shown, fetched, or requested outside the window.",
    ""
  );

  return lines.join("\n");
}

export async function runDiscoveryPerformanceReport(options = {}) {
  const connectionString = options.connectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  const requestedWindowDays = Number.isFinite(options.windowDays) && options.windowDays > 0
    ? Math.floor(options.windowDays)
    : 30;
  const to = options.to instanceof Date ? options.to : options.to ? new Date(options.to) : new Date();
  const from = options.from instanceof Date
    ? options.from
    : options.from
      ? new Date(options.from)
      : new Date(to.getTime() - requestedWindowDays * MILLISECONDS_PER_DAY);
  const productionActivationAt = options.productionActivationAt instanceof Date
    ? options.productionActivationAt
    : options.productionActivationAt
      ? new Date(options.productionActivationAt)
      : new Date(DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt);
  if ([from, to, productionActivationAt].some((date) => Number.isNaN(date.getTime()))) {
    throw new Error("Invalid measurement date");
  }
  if (to <= from) {
    throw new Error("Measurement window must end after it starts");
  }
  const productionActivationAtLabel = options.productionActivationAtLabel
    || (typeof options.productionActivationAt === "string"
      ? options.productionActivationAt
      : options.productionActivationAt instanceof Date
        ? options.productionActivationAt.toISOString()
        : DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt);
  const acquisitionFunnelActivationValue =
    options.acquisitionFunnelActivatedAt ?? process.env.ACQUISITION_FUNNEL_ACTIVATED_AT ?? null;
  const acquisitionFunnelActivatedAt = acquisitionFunnelActivationValue
    ? acquisitionFunnelActivationValue instanceof Date
      ? acquisitionFunnelActivationValue
      : new Date(acquisitionFunnelActivationValue)
    : null;
  if (acquisitionFunnelActivatedAt && Number.isNaN(acquisitionFunnelActivatedAt.getTime())) {
    throw new Error("Invalid acquisition funnel activation date");
  }
  const acquisitionFunnelActivatedAtLabel = acquisitionFunnelActivatedAt
    ? typeof acquisitionFunnelActivationValue === "string"
      ? acquisitionFunnelActivationValue
      : acquisitionFunnelActivatedAt.toISOString()
    : null;
  const pool = new Pool({ connectionString });
  // The legacy event/profile/request columns are PostgreSQL `timestamp`
  // (without time zone) but are written under the database's UTC clock. Pass
  // explicit ISO strings so node-postgres does not serialize Date parameters
  // through the report runner's local timezone and shift the measurement
  // window (for example, by five hours on a Central-time workstation).
  const windowSqlParams = [from.toISOString(), to.toISOString()];

  try {
    const capabilityResult = await pool.query(`
      SELECT to_regclass('public.bot_observation_events') IS NOT NULL
        AS crawl_observation_available
    `);
    const crawlObservationAvailable =
      capabilityResult.rows[0]?.crawl_observation_available === true;
    const [
      catalogResult,
      crawlResult,
      crawlFamilyResult,
      landingResult,
      sourceResult,
      viewResult,
      conversionResult,
      acquisitionFunnelResult,
      acquisitionCoverageResult,
    ] =
      await Promise.all([
        pool.query(profileCatalogSql),
        crawlObservationAvailable
          ? pool.query(crawlSummarySql, windowSqlParams)
          : Promise.resolve({ rows: [] }),
        crawlObservationAvailable
          ? pool.query(crawlFamilySummarySql, windowSqlParams)
          : Promise.resolve({ rows: [] }),
        pool.query(discoveryLandingSummarySql, windowSqlParams),
        pool.query(discoverySourceSql, windowSqlParams),
        pool.query(profileViewSummarySql, windowSqlParams),
        pool.query(conversionSummarySql, windowSqlParams),
        pool.query(acquisitionFunnelSql, windowSqlParams),
        pool.query(acquisitionProjectionCoverageSql, windowSqlParams),
      ]);

    const report = buildReport({
      catalogRows: catalogResult.rows || [],
      crawlRows: crawlResult.rows || [],
      crawlFamilyRows: crawlFamilyResult.rows || [],
      landingRows: landingResult.rows || [],
      sourceRows: sourceResult.rows || [],
      profileViewRows: viewResult.rows || [],
      conversionRows: conversionResult.rows || [],
      acquisitionFunnelRows: acquisitionFunnelResult.rows || [],
      acquisitionCoverageRows: acquisitionCoverageResult.rows || [],
      crawlObservationAvailable,
      generatedAt: new Date().toISOString(),
      from,
      to,
      productionActivationAt,
      productionActivationAtLabel,
      acquisitionFunnelActivatedAt,
      acquisitionFunnelActivatedAtLabel,
    });

    const outputDirectory = path.resolve(root, options.outputDirectory || "artifacts");
    fs.mkdirSync(outputDirectory, { recursive: true });
    const jsonPath = path.join(outputDirectory, "discovery-performance.json");
    const markdownPath = path.join(outputDirectory, "discovery-performance.md");
    const searchConsoleAggregatePath =
      options.searchConsoleAggregate ?? process.env.DISCOVERY_SEARCH_CONSOLE_AGGREGATE;
    if (searchConsoleAggregatePath) {
      report.searchConsole = summarizeSearchConsoleForReport(
        loadSearchConsoleAggregate(searchConsoleAggregatePath),
        {
          releaseAt: options.releaseAt ?? DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt,
          windowFrom: report.window?.from ?? report.window?.start ?? options.from,
          windowTo: report.window?.to ?? report.window?.end ?? options.to,
        },
      );
    }
    const markdown = report.searchConsole
      ? `${buildMarkdown(report).trimEnd()}\n\n${renderSearchConsoleMarkdownSection(report.searchConsole)}\n`
      : `${buildMarkdown(report)}\n`;
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownPath, markdown, "utf8");

    return { report, jsonPath, markdownPath };
  } finally {
    await pool.end();
  }
}

const isEntrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntrypoint) {
  const args = process.argv.slice(2);
  const windowDays = parsePositiveDays(args);
  const releaseAtArgument = args.find((arg) => arg.startsWith("--release-at="));
  const releaseAt = parseDateArgument(args, "--release-at=") || new Date(DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt);
  const releaseAtLabel = releaseAtArgument?.slice("--release-at=".length).trim()
    || DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt;
  const acquisitionReleaseAtArgument = args.find((arg) =>
    arg.startsWith("--acquisition-release-at=")
  );
  const acquisitionReleaseAt = parseDateArgument(args, "--acquisition-release-at=");
  const acquisitionReleaseAtLabel = acquisitionReleaseAtArgument
    ?.slice("--acquisition-release-at=".length)
    .trim();
  const to = parseDateArgument(args, "--to=") || new Date();
  const from = parseDateArgument(args, "--from=") || new Date(to.getTime() - windowDays * MILLISECONDS_PER_DAY);
  runDiscoveryPerformanceReport({
    windowDays,
    from,
    to,
    productionActivationAt: releaseAt,
    productionActivationAtLabel: releaseAtLabel,
    acquisitionFunnelActivatedAt: acquisitionReleaseAt,
    acquisitionFunnelActivatedAtLabel: acquisitionReleaseAtLabel || null,
    outputDirectory: parseOutputDirectory(args),
  })
    .then(({ report, jsonPath, markdownPath }) => {
      console.log(
        `[discovery-performance-report] wrote ${path.relative(root, markdownPath)} and ${path.relative(root, jsonPath)} | profiles=${report.profiles.length} converted=${report.summary.convertedRequests}`
      );
    })
    .catch((error) => {
      console.error("[discovery-performance-report] failed", error);
      process.exitCode = 1;
    });
}
