import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "@neondatabase/serverless";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const DISCOVERY_PERFORMANCE_DEFINITIONS = {
  publiclyExposable:
    "A published profile that passes public visibility, trust authority, and internal-indexing exclusions.",
  crawled:
    "A bot_observation_events request for a publicly exposable entity route, grouped by entity slug and response outcome.",
  surfaced:
    "A verified discovery_landing with a sourceHint or referrerHost. This is a source-attributed entry proxy, not a search-impression count.",
  visited:
    "A human profile_view_events row, with discovery_landing counts retained for marketplace routes that do not have a profile row.",
  converted:
    "A work request whose created work_request_events metadata contains an entryRequestId that matches a discovery_landing event.",
};

export const DISCOVERY_PERFORMANCE_RELEASE = {
  commit: "6a63fd41e86811815184905c0626cf64e6a904a7",
  productionActivatedAt: "2026-08-08T17:36:32.672607Z",
};

const profileCatalogSql = `
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
  ), candidates AS (
    SELECT
      lower(p.slug) AS business_slug,
      COALESCE(NULLIF(b.name, ''), p.display_name) AS display_name,
      CASE
        WHEN profile_domain.configured_domain IS NOT NULL
          THEN 'https://' || profile_domain.configured_domain || '/'
        ELSE '/u/' || lower(p.slug)
      END AS canonical_route,
      lower(p.slug) IN ('tradescout-admin', 'super-admin') AS is_internal_admin,
      (
        lower(trim(COALESCE(u.preferences->>'profileVisibility', 'private'))) = 'public'
        OR COALESCE(u.preferences->'publicProfileIds', '[]'::jsonb)
           @> jsonb_build_array(p.id::text)
      ) AS visibility_public,
      (
        p.business_id IS NULL
        OR u.verified_badge = true
        OR lower(trim(COALESCE(u.verification_status::text, ''))) = 'approved'
        OR (
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
              AND COALESCE(
                u.preferences->'internalProfileSteward'->>'profileSlug',
                ''
              ) = 'precision-aerial-services'
              AND COALESCE(
                u.preferences->'internalProfileSteward'->>'source',
                ''
              ) = 'admin_provisioned_business_profile'
            )
          )
        )
      ) AS trust_public
    FROM profiles p
    INNER JOIN users u ON u.id = p.owner_user_id
    LEFT JOIN businesses b ON b.id = p.business_id
    LEFT JOIN unambiguous_profile_domains profile_domain
      ON profile_domain.business_slug = lower(p.slug)
    WHERE p.status = 'published'
  )
  SELECT
    business_slug,
    display_name,
    canonical_route,
    COALESCE(
      NOT is_internal_admin AND visibility_public AND trust_public,
      false
    ) AS is_publicly_exposable,
    CASE
      WHEN is_internal_admin THEN 'internal_admin'
      WHEN NOT COALESCE(visibility_public, false) THEN 'visibility_not_public'
      WHEN NOT COALESCE(trust_public, false) THEN 'trust_gate_not_satisfied'
      ELSE NULL
    END AS exclusion_reason
  FROM candidates
  ORDER BY business_slug ASC;
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
        custom_profile.business_slug,
        NULLIF(lower(e.entity_slug), ''),
        CASE
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'u'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'business'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN lower(split_part(e.path, '?', 1)) = '/jw-stone' THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
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
      AND lower(COALESCE(e.content_type, '')) LIKE 'text/html%'
    WHERE e.observed_at >= $1
      AND e.observed_at < $2
      AND (
        custom_profile.business_slug IS NOT NULL
        OR e.entity_slug IS NOT NULL
        OR e.path LIKE '/u/%'
        OR e.path LIKE '/business/%'
        OR lower(split_part(e.path, '?', 1)) = '/jw-stone'
      )
  )
  SELECT
    n.business_slug,
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
  INNER JOIN published_profiles p ON p.business_slug = n.business_slug
  GROUP BY n.business_slug;
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
        custom_profile.business_slug,
        NULLIF(lower(e.entity_slug), ''),
        CASE
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'u'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 1) = 'business'
            THEN NULLIF(lower(split_part(trim(both '/' FROM split_part(e.path, '?', 1)), '/', 2)), '')
          WHEN lower(split_part(e.path, '?', 1)) = '/jw-stone' THEN 'jw-stone'
          ELSE NULL
        END
      ) AS business_slug,
      COALESCE(NULLIF(trim(e.bot_family), ''), 'unknown') AS crawler_family
    FROM bot_observation_events e
    LEFT JOIN unambiguous_custom_domains custom_profile
      ON custom_profile.custom_domain = regexp_replace(
        lower(split_part(COALESCE(e.host, ''), ':', 1)),
        '^www\\.',
        ''
      )
      AND lower(COALESCE(e.content_type, '')) LIKE 'text/html%'
    WHERE e.observed_at >= $1
      AND e.observed_at < $2
      AND (
        custom_profile.business_slug IS NOT NULL
        OR e.entity_slug IS NOT NULL
        OR e.path LIKE '/u/%'
        OR e.path LIKE '/business/%'
        OR lower(split_part(e.path, '?', 1)) = '/jw-stone'
      )
  )
  SELECT
    n.business_slug,
    n.crawler_family,
    COUNT(*)::int AS crawl_requests
  FROM normalized n
  INNER JOIN published_profiles p ON p.business_slug = n.business_slug
  GROUP BY n.business_slug, n.crawler_family
  ORDER BY n.business_slug ASC, crawl_requests DESC, n.crawler_family ASC;
`;

const discoveryLandingSummarySql = `
  WITH published_profiles AS (
    SELECT lower(p.slug) AS business_slug
    FROM profiles p
    WHERE p.status = 'published'
  ), normalized AS (
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
      NULLIF(data->>'entryRequestId', '') AS entry_request_id,
      NULLIF(data->>'sourceHint', '') AS source_hint,
      NULLIF(data->>'referrerHost', '') AS referrer_host,
      created_at
    FROM events
    WHERE event_type = 'discovery_landing'
      AND created_at >= $1
      AND created_at < $2
  )
  SELECT
    n.business_slug,
    COUNT(*)::int AS landing_events,
    COUNT(DISTINCT entry_request_id)::int AS attributed_landings,
    COUNT(*) FILTER (
      WHERE source_hint IS NOT NULL OR referrer_host IS NOT NULL
    )::int AS source_attributed_landings,
    MIN(created_at) AS first_landing_at,
    MAX(created_at) AS last_landing_at
  FROM normalized n
  INNER JOIN published_profiles p ON p.business_slug = n.business_slug
  GROUP BY n.business_slug;
`;

const discoverySourceSql = `
  WITH published_profiles AS (
    SELECT lower(p.slug) AS business_slug
    FROM profiles p
    WHERE p.status = 'published'
  ), normalized AS (
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
      NULLIF(data->>'sourceHint', '') AS source_hint,
      NULLIF(data->>'referrerHost', '') AS referrer_host,
      NULLIF(data->>'entryRequestId', '') AS entry_request_id
    FROM events
    WHERE event_type = 'discovery_landing'
      AND created_at >= $1
      AND created_at < $2
  )
  SELECT
    n.business_slug,
    CASE
      WHEN source_hint IS NOT NULL THEN 'utm:' || source_hint
      WHEN referrer_host IS NOT NULL THEN 'referrer:' || referrer_host
      ELSE 'direct_or_unknown'
    END AS source,
    COUNT(*)::int AS attributed_landings
  FROM normalized n
  INNER JOIN published_profiles p ON p.business_slug = n.business_slug
  WHERE n.source_hint IS NOT NULL OR n.referrer_host IS NOT NULL
  GROUP BY n.business_slug, source
  ORDER BY attributed_landings DESC, n.business_slug ASC, source ASC;
`;

const profileViewSummarySql = `
  SELECT
    p.slug AS business_slug,
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
      ) AS business_slug
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
    COUNT(DISTINCT l.entry_request_id)::int AS attributed_landings,
    COUNT(DISTINCT r.request_id)::int AS converted_requests,
    MIN(r.created_at) AS first_request_at,
    MAX(r.created_at) AS last_request_at
  FROM landings l
  LEFT JOIN attributed_requests r ON r.entry_request_id = l.entry_request_id
  WHERE l.business_slug IS NOT NULL
  GROUP BY l.business_slug;
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

function normalizeActivitySlug(value) {
  const normalizedSlug = String(value ?? "").trim().toLowerCase();
  return normalizedSlug || null;
}

function addActivityRow(map, slug, fallbackName = null) {
  const normalizedSlug = normalizeActivitySlug(slug);
  if (!normalizedSlug) return null;
  if (!map.has(normalizedSlug)) {
    map.set(normalizedSlug, {
      slug: normalizedSlug,
      displayName: fallbackName || (normalizedSlug === "jw-stone" ? "JW Stone" : null),
      canonicalRoute: normalizedSlug === "jw-stone" ? "/jw-stone" : `/u/${normalizedSlug}`,
    });
  }
  return map.get(normalizedSlug);
}

export function buildReport({
  catalogRows,
  crawlRows,
  crawlFamilyRows = [],
  landingRows,
  sourceRows,
  profileViewRows,
  conversionRows,
  generatedAt,
  from,
  to,
  productionActivationAt = new Date(DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt),
  productionActivationAtLabel = null,
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
  const excludedPublishedProfiles = catalogRows
    .filter((row) => row.is_publicly_exposable !== true)
    .map((row) => ({
      slug: normalizeActivitySlug(row.business_slug),
      displayName: row.display_name || null,
      reason: String(row.exclusion_reason || "public_exposure_not_authorized"),
    }))
    .filter((row) => row.slug);
  const publiclyExposableCatalogRows = catalogRows.filter(
    (row) => row.is_publicly_exposable === true
  );
  const profiles = new Map();
  for (const row of publiclyExposableCatalogRows) {
    const profile = addActivityRow(profiles, row.business_slug, row.display_name);
    if (!profile) continue;
    profile.displayName = row.display_name || profile.displayName;
    profile.canonicalRoute = row.canonical_route || profile.canonicalRoute;
  }

  const crawlBySlug = new Map(
    crawlRows
      .map((row) => [normalizeActivitySlug(row.business_slug), row])
      .filter(([slug]) => slug)
  );
  const landingBySlug = new Map(
    landingRows
      .map((row) => [normalizeActivitySlug(row.business_slug), row])
      .filter(([slug]) => slug)
  );
  const viewsBySlug = new Map(
    profileViewRows
      .map((row) => [normalizeActivitySlug(row.business_slug), row])
      .filter(([slug]) => slug)
  );
  const conversionBySlug = new Map(
    conversionRows
      .map((row) => [normalizeActivitySlug(row.business_slug), row])
      .filter(([slug]) => slug)
  );
  const crawlerFamiliesBySlug = new Map();
  for (const row of crawlFamilyRows) {
    const slug = normalizeActivitySlug(row.business_slug);
    if (!slug) continue;
    const family = String(row.crawler_family || "unknown");
    if (!crawlerFamiliesBySlug.has(slug)) crawlerFamiliesBySlug.set(slug, []);
    crawlerFamiliesBySlug.get(slug).push({
      crawlerFamily: family,
      crawlRequests: toCount(row.crawl_requests),
    });
  }
  const catalogSlugs = new Set(profiles.keys());
  const sources = releaseMetricsApplicable
    ? sourceRows
        .map((row) => ({
          slug: normalizeActivitySlug(row.business_slug),
          source: String(row.source),
          attributedLandings: toCount(row.attributed_landings),
        }))
        .filter((row) => row.slug && catalogSlugs.has(row.slug))
    : [];

  const profileRows = Array.from(profiles.values())
    .map((profile) => {
      const crawl = crawlBySlug.get(profile.slug) || {};
      const landing = landingBySlug.get(profile.slug) || {};
      const view = viewsBySlug.get(profile.slug) || {};
      const conversion = conversionBySlug.get(profile.slug) || {};
      const crawled = toCount(crawl.crawl_hits);
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
      else if (crawled > 0) stage = "crawled";

      return {
        slug: profile.slug,
        displayName: profile.displayName,
        canonicalRoute: profile.canonicalRoute,
        stage,
        crawled: {
          hits: crawled,
          successes: toCount(crawl.crawl_successes),
          clientErrors: toCount(crawl.crawl_client_errors),
          serverErrors: toCount(crawl.crawl_server_errors),
          crawlerCount: toCount(crawl.crawler_count),
          uniqueUrls: toCount(crawl.unique_urls),
          firstSeenUrls: toCount(crawl.first_seen_urls),
          recrawlUrls: toCount(crawl.recrawl_urls),
          firstAt: toIso(crawl.first_crawled_at),
          lastAt: toIso(crawl.last_crawled_at),
        },
        surfaced: {
          sourceAttributedLandings: sourceAttributed,
          verifiedAttributions,
          sources: sources
            .filter((source) => source.slug === profile.slug)
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
        crawlerFamilies: crawlerFamiliesBySlug.get(profile.slug) || [],
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
    publishedProfiles: catalogRows.length,
    catalogProfiles: publiclyExposableCatalogRows.length,
    excludedPublishedProfiles: excludedPublishedProfiles.length,
    profilesWithCrawl: profileRows.filter((row) => row.crawled.hits > 0).length,
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
    crawlHits: profileRows.reduce((sum, row) => sum + row.crawled.hits, 0),
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
    },
    definitions: DISCOVERY_PERFORMANCE_DEFINITIONS,
    summary,
    profiles: profileRows,
    sources,
    coverage: {
      excludedPublishedProfiles,
      uncrawledProfiles: profileRows
        .filter((profile) => profile.crawled.hits === 0)
        .map(({ slug, displayName }) => ({ slug, displayName })),
      unvisitedProfiles: profileRows
        .filter((profile) => profile.visited.profileViews === 0 && profile.visited.discoveryLandings === 0)
        .map(({ slug, displayName }) => ({ slug, displayName })),
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
    `- Publicly exposable profiles: ${report.summary.catalogProfiles}`,
    `- Excluded published profiles: ${report.summary.excludedPublishedProfiles}`,
    "",
    "| Signal | Profiles with evidence | Total |",
    "| --- | ---: | ---: |",
    `| Crawled | ${formatMetric(report.summary.profilesWithCrawl)} | ${formatMetric(report.summary.crawlHits)} bot requests |`,
    `| ${sourceLabel} | ${formatMetric(report.summary.profilesWithSourceAttributedLanding)} | ${formatMetric(report.summary.sourceAttributedLandings)} landing events |`,
    `| Signed attribution IDs | ${formatMetric(report.summary.profilesWithVerifiedAttribution)} | ${formatMetric(report.summary.verifiedAttributions)} verified entryRequestIds |`,
    `| Visited | ${formatMetric(report.summary.profilesWithVisit)} | ${formatMetric(report.summary.profileViews)} profile views / ${formatMetric(report.summary.discoveryLandings)} discovery landings |`,
    `| Discovery conversion | ${formatMetric(report.summary.profilesWithConversion)} | ${formatMetric(report.summary.convertedRequests)} matched requests |`,
    "",
    "## Profile Matrix",
    "",
    `| Profile | Route | Stage | Crawl hits | ${sourceLabel} | Profile views | Discovery landings | Requests |`,
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const profile of report.profiles) {
    lines.push(
      `| ${profile.displayName || profile.slug} (${profile.slug}) | ${profile.canonicalRoute} | ${profile.stage} | ${profile.crawled.hits} | ${formatMetric(profile.surfaced.sourceAttributedLandings)} | ${profile.visited.profileViews} | ${profile.visited.discoveryLandings} | ${formatMetric(profile.converted.requests)} |`
    );
  }

  lines.push("", "## Coverage", "");
  lines.push(
    `- Excluded published profiles (${report.coverage.excludedPublishedProfiles.length}): ${report.coverage.excludedPublishedProfiles.length ? report.coverage.excludedPublishedProfiles.map((profile) => `${profile.displayName || profile.slug} (${profile.slug}: ${profile.reason})`).join(", ") : "none"}`,
    `- Uncrawled profiles (${report.coverage.uncrawledProfiles.length}): ${report.coverage.uncrawledProfiles.length ? report.coverage.uncrawledProfiles.map((profile) => `${profile.displayName || profile.slug} (${profile.slug})`).join(", ") : "none"}`,
    `- Unvisited profiles (${report.coverage.unvisitedProfiles.length}): ${report.coverage.unvisitedProfiles.length ? report.coverage.unvisitedProfiles.map((profile) => `${profile.displayName || profile.slug} (${profile.slug})`).join(", ") : "none"}`,
    ""
  );

  lines.push("## Crawl Distribution by Profile and Crawler Family", "");
  if (!report.profiles.some((profile) => profile.crawlerFamilies.length)) {
    lines.push("No crawler-family requests were recorded in this window.");
  } else {
    lines.push("| Profile | Crawler family | Crawl requests |", "| --- | --- | ---: |");
    for (const profile of report.profiles) {
      for (const family of profile.crawlerFamilies) {
        lines.push(`| ${profile.slug} | ${family.crawlerFamily} | ${family.crawlRequests} |`);
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
    lines.push("| Profile | Source | Attributed landings |", "| --- | --- | ---: |");
    for (const source of report.sources) {
      lines.push(`| ${source.slug} | ${source.source} | ${source.attributedLandings} |`);
    }
  }

  lines.push(
    "",
    "## Interpretation",
    "",
    "- A profile with crawl evidence but no visit evidence is being fetched by a bot without a measured human entry.",
    "- A profile with source-attributed landings has evidence that a visitor arrived from a named source or referrer, but this is not an impression count.",
    "- A source-attributed landing without a verified entryRequestId can be measured as a landing but cannot be joined to a later request.",
    historicalPreRelease || crossesReleaseBoundary
      ? "- Signed attribution and discovery conversion are not applicable until the selected window starts at or after the production activation timestamp above."
      : "- A request is counted as discovery-converted only when the verified server-issued entryRequestId is present in both the landing event and the created request event.",
    "- Zero values are evidence gaps in this window, not proof that a profile was never crawled, shown, visited, or requested outside the window.",
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
  const pool = new Pool({ connectionString });

  try {
    const [catalogResult, crawlResult, crawlFamilyResult, landingResult, sourceResult, viewResult, conversionResult] =
      await Promise.all([
        pool.query(profileCatalogSql),
        pool.query(crawlSummarySql, [from, to]),
        pool.query(crawlFamilySummarySql, [from, to]),
        pool.query(discoveryLandingSummarySql, [from, to]),
        pool.query(discoverySourceSql, [from, to]),
        pool.query(profileViewSummarySql, [from, to]),
        pool.query(conversionSummarySql, [from, to]),
      ]);

    const report = buildReport({
      catalogRows: catalogResult.rows || [],
      crawlRows: crawlResult.rows || [],
      crawlFamilyRows: crawlFamilyResult.rows || [],
      landingRows: landingResult.rows || [],
      sourceRows: sourceResult.rows || [],
      profileViewRows: viewResult.rows || [],
      conversionRows: conversionResult.rows || [],
      generatedAt: new Date().toISOString(),
      from,
      to,
      productionActivationAt,
      productionActivationAtLabel,
    });

    const outputDirectory = path.resolve(root, options.outputDirectory || "artifacts");
    fs.mkdirSync(outputDirectory, { recursive: true });
    const jsonPath = path.join(outputDirectory, "discovery-performance.json");
    const markdownPath = path.join(outputDirectory, "discovery-performance.md");
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownPath, `${buildMarkdown(report)}\n`, "utf8");

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
  const to = parseDateArgument(args, "--to=") || new Date();
  const from = parseDateArgument(args, "--from=") || new Date(to.getTime() - windowDays * MILLISECONDS_PER_DAY);
  runDiscoveryPerformanceReport({
    windowDays,
    from,
    to,
    productionActivationAt: releaseAt,
    productionActivationAtLabel: releaseAtLabel,
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
