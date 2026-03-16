import { pool } from "../db";
import {
  classifyRequestType,
  detectActorFromUserAgent,
  getClientIp,
  hashIp,
  type RequestType,
} from "../utils/requestActor";
import type { Request } from "express";
import { slugifyCountyName } from "../../shared/tradeSeo";

let ensurePromise: Promise<void> | null = null;
let prunePromise: Promise<void> | null = null;
let backfillPromise: Promise<void> | null = null;
let lastPrunedAt = 0;
let lastBackfilledAt = 0;

const CRAWLER_TELEMETRY_RETENTION_DAYS = Math.max(
  7,
  Number(process.env.CRAWLER_TELEMETRY_RETENTION_DAYS || 30)
);
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const BACKFILL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const countyFipsCache = new Map<string, string | null>();
const crawlerPersistenceStats = {
  attempted: 0,
  succeeded: 0,
  failed: 0,
  errorCodes: {} as Record<string, number>,
  lastSuccessAt: null as string | null,
  lastFailureAt: null as string | null,
  lastFailureCode: null as string | null,
  lastFailureMessage: null as string | null,
};

type CrawlerAttribution = {
  sourceSurface: string | null;
  stateCode: string | null;
  countySlug: string | null;
  countyFips: string | null;
  categorySlug: string | null;
};

type BotObservationRouteContext = {
  routeFamily: string;
  county: string | null;
  state: string | null;
  trade: string | null;
  entityType: string | null;
  entitySlug: string | null;
};

type BotObservationRow = {
  date: string | Date;
  route_family: string | null;
  county: string | null;
  state: string | null;
  trade: string | null;
  bot_family: string | null;
  hits: number;
  unique_urls: number;
  avg_response_time_ms: number | null;
  avg_response_bytes: number | null;
  status_200_count: number;
  status_404_count: number;
  recrawl_urls: number;
  first_seen_urls: number;
  top_path: string | null;
};

export interface BotCrawlAggregateSignal {
  date: string;
  routeFamily: string;
  county: string | null;
  state: string | null;
  trade: string | null;
  botFamily: string;
  hits: number;
  uniqueUrls: number;
  avgResponseTimeMs: number | null;
  avgResponseBytes: number | null;
  status200Count: number;
  status404Count: number;
  recrawlUrls: number;
  firstSeenUrls: number;
  topPath: string | null;
}

function deriveStatusClass(statusCode: number): "2xx" | "4xx" | "5xx" | null {
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500) return "5xx";
  return null;
}

function cleanPath(pathValue?: string | null): string {
  const path = String(pathValue || "").trim();
  if (!path) return "/";
  return path.length > 512 ? path.slice(0, 512) : path;
}

function cleanMethod(method?: string | null): string {
  const value = String(method || "GET")
    .trim()
    .toUpperCase();
  return value.slice(0, 12) || "GET";
}

function cleanUserAgent(userAgent?: string | null): string | null {
  const value = String(userAgent || "").trim();
  if (!value) return null;
  return value.length > 1000 ? value.slice(0, 1000) : value;
}

function cleanBotName(botName?: string | null): string {
  const value = String(botName || "UnknownBot").trim();
  return value.length > 120 ? value.slice(0, 120) : value;
}

function cleanRefererHost(referer?: string | null): string | null {
  const value = String(referer || "").trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.trim().toLowerCase();
    return host ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, maxLength: number): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.length > maxLength ? raw.slice(0, maxLength) : raw;
}

function cleanQueryString(value?: string | null): string | null {
  const raw = String(value || "")
    .trim()
    .replace(/^\?/, "");
  if (!raw) return null;
  return raw.length > 2000 ? raw.slice(0, 2000) : raw;
}

function cleanInteger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

function cleanSlug(value?: string | null): string | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  return raw.length > 160 ? raw.slice(0, 160) : raw;
}

function cleanStateCode(value?: string | null): string | null {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : null;
}

function parseCountySlugWithOptionalStateSuffix(countySlug?: string | null): {
  stateCode: string | null;
  countySlug: string | null;
} {
  const cleaned = cleanSlug(countySlug);
  if (!cleaned) return { stateCode: null, countySlug: null };
  const parts = cleaned.split("-").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && /^[a-z]{2}$/.test(last) && parts.length >= 2) {
    return {
      stateCode: last.toUpperCase(),
      countySlug: cleanSlug(parts.slice(0, -1).join("-")),
    };
  }
  return { stateCode: null, countySlug: cleaned };
}

function inferCrawlerAttribution(
  pathValue?: string | null
): Omit<CrawlerAttribution, "countyFips"> {
  const path = cleanPath(pathValue).toLowerCase();

  if (path === "/" || path.startsWith("/scout")) {
    return { sourceSurface: "scout", stateCode: null, countySlug: null, categorySlug: null };
  }
  if (path.startsWith("/direct-connect")) {
    return {
      sourceSurface: "direct_connect",
      stateCode: null,
      countySlug: null,
      categorySlug: null,
    };
  }
  if (path.startsWith("/exchange")) {
    return { sourceSurface: "exchange", stateCode: null, countySlug: null, categorySlug: null };
  }
  if (path.startsWith("/trade-deals")) {
    return { sourceSurface: "trade_deals", stateCode: null, countySlug: null, categorySlug: null };
  }
  if (path.startsWith("/homescout-listings")) {
    return {
      sourceSurface: "homescout_listings",
      stateCode: null,
      countySlug: null,
      categorySlug: null,
    };
  }
  if (path.startsWith("/community")) {
    return { sourceSurface: "community", stateCode: null, countySlug: null, categorySlug: null };
  }
  if (path.startsWith("/u/")) {
    return {
      sourceSurface: "public_profile",
      stateCode: null,
      countySlug: null,
      categorySlug: null,
    };
  }
  if (path.startsWith("/business/")) {
    return {
      sourceSurface: "public_business",
      stateCode: null,
      countySlug: null,
      categorySlug: null,
    };
  }

  const tradePartnerMatch = /^\/tradepartners\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?/i.exec(path);
  if (tradePartnerMatch) {
    const partnerSlug = cleanSlug(tradePartnerMatch[1]);
    const partnerCountySlug = cleanSlug(tradePartnerMatch[3] || tradePartnerMatch[2]);
    const tradePartnerCounty = parseCountySlugWithOptionalStateSuffix(partnerCountySlug);
    return {
      sourceSurface: "tradepartners",
      stateCode: tradePartnerCounty.stateCode,
      countySlug: tradePartnerCounty.countySlug,
      categorySlug: partnerSlug,
    };
  }

  const countyMatch = /^\/county\/([^/]+)\/([^/]+)/i.exec(path);
  if (countyMatch) {
    return {
      sourceSurface: "county_page",
      stateCode: cleanStateCode(countyMatch[1]),
      countySlug: cleanSlug(countyMatch[2]),
      categorySlug: null,
    };
  }

  const recentCountyMatch = /^\/recent\/([^/]+)\/([^/]+)/i.exec(path);
  if (recentCountyMatch) {
    return {
      sourceSurface: "county_recent",
      stateCode: cleanStateCode(recentCountyMatch[1]),
      countySlug: cleanSlug(recentCountyMatch[2]),
      categorySlug: null,
    };
  }

  const tradeCountyMatch = /^\/trade\/([^/]+)\/([^/]+)\/([^/]+)/i.exec(path);
  if (tradeCountyMatch) {
    return {
      sourceSurface: "trade_county_page",
      stateCode: cleanStateCode(tradeCountyMatch[2]),
      countySlug: cleanSlug(tradeCountyMatch[3]),
      categorySlug: cleanSlug(tradeCountyMatch[1]),
    };
  }

  return { sourceSurface: "other", stateCode: null, countySlug: null, categorySlug: null };
}

function inferBotObservationRouteContext(
  pathValue?: string | null,
  attribution?: Omit<CrawlerAttribution, "countyFips">
): BotObservationRouteContext {
  const path = cleanPath(pathValue);
  const lowerPath = path.toLowerCase();
  const segments = lowerPath.split("/").filter(Boolean);
  const base = attribution || inferCrawlerAttribution(pathValue);

  if (lowerPath.startsWith("/business/")) {
    return {
      routeFamily: "public_business",
      county: base.countySlug,
      state: base.stateCode,
      trade: null,
      entityType: "business",
      entitySlug: cleanSlug(segments[1] || null),
    };
  }

  if (lowerPath.startsWith("/u/")) {
    return {
      routeFamily: "public_profile",
      county: base.countySlug,
      state: base.stateCode,
      trade: null,
      entityType: "profile",
      entitySlug: cleanSlug(segments[1] || null),
    };
  }

  if (lowerPath.startsWith("/county/")) {
    return {
      routeFamily: "county_page",
      county: cleanSlug(segments[2] || null),
      state: cleanStateCode(segments[1] || null),
      trade: null,
      entityType: "county",
      entitySlug: cleanSlug(segments[2] || null),
    };
  }

  if (lowerPath.startsWith("/trade/")) {
    return {
      routeFamily: "trade_county_page",
      county: cleanSlug(segments[3] || null),
      state: cleanStateCode(segments[2] || null),
      trade: cleanSlug(segments[1] || null),
      entityType: "trade_page",
      entitySlug: cleanSlug(segments.slice(1).join("/")),
    };
  }

  if (lowerPath.startsWith("/tradepartners/")) {
    return {
      routeFamily: "tradepartners",
      county: base.countySlug,
      state: base.stateCode,
      trade: cleanSlug(segments[1] || null),
      entityType: "partner_page",
      entitySlug: cleanSlug(segments.slice(1).join("/")),
    };
  }

  if (lowerPath.startsWith("/homescout-listings")) {
    return {
      routeFamily: "homescout_listings",
      county: base.countySlug,
      state: base.stateCode,
      trade: null,
      entityType: "listing_portal",
      entitySlug: cleanSlug(segments[1] || null),
    };
  }

  if (lowerPath.startsWith("/exchange")) {
    return {
      routeFamily: "exchange",
      county: base.countySlug,
      state: base.stateCode,
      trade: cleanSlug(segments[1] || null),
      entityType: "exchange_portal",
      entitySlug: cleanSlug(segments.slice(1).join("/")),
    };
  }

  if (lowerPath.startsWith("/community")) {
    return {
      routeFamily: "community",
      county: base.countySlug,
      state: base.stateCode,
      trade: null,
      entityType: "community_surface",
      entitySlug: cleanSlug(segments.slice(1).join("/")),
    };
  }

  if (lowerPath.startsWith("/scout")) {
    return {
      routeFamily: "scout",
      county: base.countySlug,
      state: base.stateCode,
      trade: null,
      entityType: "scout_surface",
      entitySlug: cleanSlug(segments.slice(1).join("/")),
    };
  }

  return {
    routeFamily: String(base.sourceSurface || "other"),
    county: base.countySlug,
    state: base.stateCode,
    trade: base.categorySlug,
    entityType: segments.length > 0 ? "page" : "root",
    entitySlug: cleanSlug(segments.join("/")),
  };
}

function buildCanonicalUrl(req: Request, pathValue: string): string {
  const host = cleanText(req.get("Host"), 255) || "www.thetradescout.com";
  const proto = cleanText(req.get("X-Forwarded-Proto"), 12) || req.protocol || "https";
  return `${proto.toLowerCase()}://${host}${pathValue}`;
}

function resolveResponseContentType(req: Request): string | null {
  const header = req.res?.getHeader("content-type");
  if (typeof header === "string") return header;
  if (Array.isArray(header)) return header.join(", ");
  return null;
}

async function resolveCountyFips(
  stateCode?: string | null,
  countySlug?: string | null
): Promise<string | null> {
  const normalizedStateCode = cleanStateCode(stateCode);
  const normalizedCountySlug = cleanSlug(countySlug);
  if (!normalizedStateCode || !normalizedCountySlug) return null;

  const cacheKey = `${normalizedStateCode}:${normalizedCountySlug}`;
  if (countyFipsCache.has(cacheKey)) {
    return countyFipsCache.get(cacheKey) ?? null;
  }

  const result = await pool.query(
    `
      select name, fips
      from counties
      where state_code = $1
    `,
    [normalizedStateCode]
  );

  const matchedRow = (result.rows || []).find(
    (row) => slugifyCountyName(String(row?.name || "")) === normalizedCountySlug
  );
  const fips = matchedRow?.fips ? String(matchedRow.fips) : null;
  countyFipsCache.set(cacheKey, fips);
  return fips;
}

async function pruneCrawlerRequestEventsIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastPrunedAt < PRUNE_INTERVAL_MS) return;
  if (prunePromise) return prunePromise;

  prunePromise = (async () => {
    try {
      await ensureCrawlerRequestEventsTable();
      await pool.query(
        `
          delete from crawler_request_events
          where observed_at < now() - ($1::interval)
        `,
        [`${CRAWLER_TELEMETRY_RETENTION_DAYS} days`]
      );
      await pool.query(
        `
          delete from crawler_request_hourly_rollups
          where bucket_start < now() - ($1::interval)
        `,
        [`${CRAWLER_TELEMETRY_RETENTION_DAYS} days`]
      );
      lastPrunedAt = Date.now();
    } finally {
      prunePromise = null;
    }
  })();

  await prunePromise;
}

async function backfillCountyFipsIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastBackfilledAt < BACKFILL_INTERVAL_MS) return;
  if (backfillPromise) return backfillPromise;

  backfillPromise = (async () => {
    try {
      await ensureCrawlerRequestEventsTable();

      const rawRows = await pool.query(
        `
          select distinct state_code, county_slug
          from crawler_request_events
          where county_fips is null
            and state_code is not null
            and county_slug is not null
          limit 250
        `
      );

      for (const row of rawRows.rows || []) {
        const stateCode = cleanStateCode(String(row?.state_code || ""));
        const countySlug = cleanSlug(String(row?.county_slug || ""));
        const countyFips = await resolveCountyFips(stateCode, countySlug);
        if (!stateCode || !countySlug || !countyFips) continue;

        await pool.query(
          `
            update crawler_request_events
            set county_fips = $3
            where state_code = $1
              and county_slug = $2
              and county_fips is null
          `,
          [stateCode, countySlug, countyFips]
        );

        await pool.query(
          `
            update crawler_request_hourly_rollups
            set county_fips = $3
            where state_code = $1
              and county_slug = $2
              and county_fips is null
          `,
          [stateCode, countySlug, countyFips]
        );
      }

      lastBackfilledAt = Date.now();
    } finally {
      backfillPromise = null;
    }
  })();

  await backfillPromise;
}

export async function ensureCrawlerRequestEventsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crawler_request_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          bot_name varchar(120) NOT NULL,
          method varchar(12) NOT NULL,
          path varchar(512) NOT NULL,
          request_type varchar(32) NOT NULL,
          source_surface varchar(64),
          state_code varchar(2),
          county_slug varchar(160),
          county_fips varchar(5),
          category_slug varchar(160),
          status_code integer NOT NULL,
          status_class varchar(8) NOT NULL,
          referer_host varchar(255),
          ip_hash varchar(64),
          user_agent text,
          observed_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crawler_request_hourly_rollups (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          bucket_start timestamptz NOT NULL,
          bot_name varchar(120) NOT NULL,
          request_type varchar(32) NOT NULL,
          source_surface varchar(64),
          state_code varchar(2),
          county_slug varchar(160),
          county_fips varchar(5),
          category_slug varchar(160),
          status_class varchar(8) NOT NULL,
          request_count integer NOT NULL DEFAULT 0,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_observation_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          observed_at timestamptz NOT NULL DEFAULT now(),
          request_id varchar(128),
          ip_hash varchar(64),
          user_agent text,
          method varchar(12) NOT NULL,
          host varchar(255),
          path varchar(512) NOT NULL,
          query_string text,
          status_code integer NOT NULL,
          response_time_ms integer,
          response_bytes integer,
          referer text,
          accept_language varchar(255),
          cache_status varchar(64),
          route_name varchar(128),
          route_family varchar(64) NOT NULL,
          bot_family varchar(120) NOT NULL,
          canonical_url text,
          matched_template varchar(255),
          content_type varchar(255),
          is_first_seen_url boolean NOT NULL DEFAULT false,
          is_recrawl boolean NOT NULL DEFAULT false,
          county varchar(160),
          state varchar(2),
          trade varchar(160),
          entity_type varchar(64),
          entity_slug varchar(255)
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_observation_daily_agg (
          date date NOT NULL,
          route_family varchar(64) NOT NULL,
          county varchar(160),
          state varchar(2),
          trade varchar(160),
          bot_family varchar(120) NOT NULL,
          hits integer NOT NULL DEFAULT 0,
          unique_urls integer NOT NULL DEFAULT 0,
          avg_response_time_ms integer,
          avg_response_bytes integer,
          status_200_count integer NOT NULL DEFAULT 0,
          status_404_count integer NOT NULL DEFAULT 0,
          recrawl_urls integer NOT NULL DEFAULT 0,
          first_seen_urls integer NOT NULL DEFAULT 0,
          top_path varchar(512),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await pool.query(
        `ALTER TABLE crawler_request_events ADD COLUMN IF NOT EXISTS source_surface varchar(64);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_events ADD COLUMN IF NOT EXISTS state_code varchar(2);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_events ADD COLUMN IF NOT EXISTS county_slug varchar(160);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_events ADD COLUMN IF NOT EXISTS county_fips varchar(5);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_events ADD COLUMN IF NOT EXISTS category_slug varchar(160);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_hourly_rollups ADD COLUMN IF NOT EXISTS source_surface varchar(64);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_hourly_rollups ADD COLUMN IF NOT EXISTS state_code varchar(2);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_hourly_rollups ADD COLUMN IF NOT EXISTS county_slug varchar(160);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_hourly_rollups ADD COLUMN IF NOT EXISTS county_fips varchar(5);`
      );
      await pool.query(
        `ALTER TABLE crawler_request_hourly_rollups ADD COLUMN IF NOT EXISTS category_slug varchar(160);`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_bot_idx ON crawler_request_events (bot_name);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_status_idx ON crawler_request_events (status_class);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_type_idx ON crawler_request_events (request_type);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_surface_idx ON crawler_request_events (source_surface);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_state_code_idx ON crawler_request_events (state_code);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_county_slug_idx ON crawler_request_events (county_slug);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_county_fips_idx ON crawler_request_events (county_fips);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_category_slug_idx ON crawler_request_events (category_slug);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_observed_idx ON crawler_request_events (observed_at DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_events_path_idx ON crawler_request_events (path);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_events_observed_idx ON bot_observation_events (observed_at DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_events_bot_idx ON bot_observation_events (bot_family);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_events_route_idx ON bot_observation_events (route_family);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_events_county_idx ON bot_observation_events (county);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_events_state_idx ON bot_observation_events (state);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_events_trade_idx ON bot_observation_events (trade);`
      );
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS bot_observation_daily_agg_unique
        ON bot_observation_daily_agg (
          date,
          route_family,
          coalesce(county, ''),
          coalesce(state, ''),
          coalesce(trade, ''),
          bot_family
        );
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_daily_agg_date_idx ON bot_observation_daily_agg (date DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_daily_agg_route_idx ON bot_observation_daily_agg (route_family);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS bot_observation_daily_agg_county_idx ON bot_observation_daily_agg (county);`
      );

      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS crawler_request_hourly_rollups_bucket_unique
        ON crawler_request_hourly_rollups (
          bucket_start,
          bot_name,
          request_type,
          coalesce(source_surface, ''),
          coalesce(state_code, ''),
          coalesce(county_slug, ''),
          coalesce(county_fips, ''),
          coalesce(category_slug, ''),
          status_class
        );
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_hourly_rollups_bucket_idx ON crawler_request_hourly_rollups (bucket_start DESC);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_hourly_rollups_surface_idx ON crawler_request_hourly_rollups (source_surface);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_hourly_rollups_state_idx ON crawler_request_hourly_rollups (state_code);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_hourly_rollups_county_idx ON crawler_request_hourly_rollups (county_slug);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_hourly_rollups_county_fips_idx ON crawler_request_hourly_rollups (county_fips);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS crawler_request_hourly_rollups_category_idx ON crawler_request_hourly_rollups (category_slug);`
      );
    })();
  }
  await ensurePromise;
}

async function refreshBotObservationDailyAggregate(args: {
  observedAt: Date;
  routeFamily: string;
  county: string | null;
  state: string | null;
  trade: string | null;
  botFamily: string;
}): Promise<void> {
  await pool.query(
    `
      with typed_args as (
        select
          $1::date as observed_date,
          $2::text as route_family,
          $3::text as county,
          $4::text as state,
          $5::text as trade,
          $6::text as bot_family
      ),
      insert into bot_observation_daily_agg (
        date,
        route_family,
        county,
        state,
        trade,
        bot_family,
        hits,
        unique_urls,
        avg_response_time_ms,
        avg_response_bytes,
        status_200_count,
        status_404_count,
        recrawl_urls,
        first_seen_urls,
        top_path,
        updated_at
      )
      select
        ta.observed_date as date,
        ta.route_family::varchar(64) as route_family,
        nullif(ta.county, '')::varchar(160) as county,
        nullif(ta.state, '')::varchar(2) as state,
        nullif(ta.trade, '')::varchar(160) as trade,
        ta.bot_family::varchar(120) as bot_family,
        count(*)::int as hits,
        count(distinct canonical_url)::int as unique_urls,
        round(avg(response_time_ms))::int as avg_response_time_ms,
        round(avg(response_bytes))::int as avg_response_bytes,
        count(*) filter (where status_code = 200)::int as status_200_count,
        count(*) filter (where status_code = 404)::int as status_404_count,
        coalesce(sum(case when is_recrawl then 1 else 0 end), 0)::int as recrawl_urls,
        coalesce(sum(case when is_first_seen_url then 1 else 0 end), 0)::int as first_seen_urls,
        (
          select e2.path
          from bot_observation_events e2
          where e2.observed_at::date = ta.observed_date
            and e2.route_family::text = ta.route_family
            and coalesce(e2.county::text, '') = coalesce(ta.county, '')
            and coalesce(e2.state::text, '') = coalesce(ta.state, '')
            and coalesce(e2.trade::text, '') = coalesce(ta.trade, '')
            and e2.bot_family::text = ta.bot_family
          group by e2.path
          order by count(*) desc, e2.path asc
          limit 1
        ) as top_path,
        now() as updated_at
      from bot_observation_events e
      cross join typed_args ta
      where e.observed_at::date = ta.observed_date
        and e.route_family::text = ta.route_family
        and coalesce(e.county::text, '') = coalesce(ta.county, '')
        and coalesce(e.state::text, '') = coalesce(ta.state, '')
        and coalesce(e.trade::text, '') = coalesce(ta.trade, '')
        and e.bot_family::text = ta.bot_family
      on conflict (
        date,
        route_family,
        coalesce(county, ''),
        coalesce(state, ''),
        coalesce(trade, ''),
        bot_family
      )
      do update set
        hits = excluded.hits,
        unique_urls = excluded.unique_urls,
        avg_response_time_ms = excluded.avg_response_time_ms,
        avg_response_bytes = excluded.avg_response_bytes,
        status_200_count = excluded.status_200_count,
        status_404_count = excluded.status_404_count,
        recrawl_urls = excluded.recrawl_urls,
        first_seen_urls = excluded.first_seen_urls,
        top_path = excluded.top_path,
        updated_at = now()
    `,
    [
      args.observedAt.toISOString(),
      args.routeFamily,
      args.county,
      args.state,
      args.trade,
      args.botFamily,
    ]
  );
}

export async function recordCrawlerRequestEvent(
  req: Request,
  statusCode: number,
  metrics?: {
    responseTimeMs?: number | null;
    responseBytes?: number | null;
  }
): Promise<void> {
  crawlerPersistenceStats.attempted += 1;
  const userAgent = req.get("User-Agent");
  const actor = detectActorFromUserAgent(userAgent);
  if (actor.actorType !== "bot") return;

  const statusClass = deriveStatusClass(statusCode);
  if (!statusClass) return;

  try {
    await ensureCrawlerRequestEventsTable();
    void pruneCrawlerRequestEventsIfNeeded();
    void backfillCountyFipsIfNeeded();
    const originalUrl = String(req.originalUrl || req.path || "/");
    const parsedUrl = new URL(originalUrl, "https://www.thetradescout.com");
    const requestPath = cleanPath(parsedUrl.pathname);
    const requestType: RequestType = classifyRequestType(requestPath);
    const { ip } = getClientIp(req);
    const baseAttribution = inferCrawlerAttribution(requestPath);
    const attribution: CrawlerAttribution = {
      ...baseAttribution,
      countyFips: await resolveCountyFips(baseAttribution.stateCode, baseAttribution.countySlug),
    };
    const routeContext = inferBotObservationRouteContext(requestPath, baseAttribution);
    const botName = cleanBotName(actor.botName);
    const observedAt = new Date();
    const canonicalUrl = buildCanonicalUrl(req, requestPath);
    const previousObservation = await pool.query(
      `
        select 1
        from bot_observation_events
        where bot_family = $1
          and canonical_url = $2
        limit 1
      `,
      [botName, canonicalUrl]
    );
    const isRecrawl = (previousObservation.rowCount || 0) > 0;
    const isFirstSeenUrl = !isRecrawl;

    await pool.query(
      `
        INSERT INTO crawler_request_events (
          bot_name,
          method,
          path,
          request_type,
          source_surface,
          state_code,
          county_slug,
          county_fips,
          category_slug,
          status_code,
          status_class,
          referer_host,
          ip_hash,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        botName,
        cleanMethod(req.method),
        requestPath,
        requestType,
        attribution.sourceSurface,
        attribution.stateCode,
        attribution.countySlug,
        attribution.countyFips,
        attribution.categorySlug,
        statusCode,
        statusClass,
        cleanRefererHost(req.get("Referer")),
        hashIp(ip),
        cleanUserAgent(userAgent),
      ]
    );

    await pool.query(
      `
        insert into bot_observation_events (
          observed_at,
          request_id,
          ip_hash,
          user_agent,
          method,
          host,
          path,
          query_string,
          status_code,
          response_time_ms,
          response_bytes,
          referer,
          accept_language,
          cache_status,
          route_name,
          route_family,
          bot_family,
          canonical_url,
          matched_template,
          content_type,
          is_first_seen_url,
          is_recrawl,
          county,
          state,
          trade,
          entity_type,
          entity_slug
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
        )
      `,
      [
        observedAt.toISOString(),
        cleanText((req as { requestId?: string }).requestId, 128),
        hashIp(ip),
        cleanUserAgent(userAgent),
        cleanMethod(req.method),
        cleanText(req.get("Host"), 255),
        requestPath,
        cleanQueryString(parsedUrl.search),
        statusCode,
        cleanInteger(metrics?.responseTimeMs),
        cleanInteger(metrics?.responseBytes),
        cleanText(req.get("Referer"), 1000),
        cleanText(req.get("Accept-Language"), 255),
        cleanText(req.get("X-Cache") || req.get("CF-Cache-Status"), 64),
        cleanText(requestType, 128),
        cleanText(routeContext.routeFamily, 64),
        botName,
        cleanText(canonicalUrl, 2000),
        cleanText(String((req.route as { path?: string } | undefined)?.path || ""), 255),
        cleanText(resolveResponseContentType(req), 255),
        isFirstSeenUrl,
        isRecrawl,
        routeContext.county,
        routeContext.state,
        routeContext.trade,
        routeContext.entityType,
        routeContext.entitySlug,
      ]
    );

    await pool.query(
      `
        insert into crawler_request_hourly_rollups (
          bucket_start,
          bot_name,
          request_type,
          source_surface,
          state_code,
          county_slug,
          county_fips,
          category_slug,
          status_class,
          request_count,
          updated_at
        )
        values (
          date_trunc('hour', now()),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          1,
          now()
        )
        on conflict (
          bucket_start,
          bot_name,
          request_type,
          coalesce(source_surface, ''),
          coalesce(state_code, ''),
          coalesce(county_slug, ''),
          coalesce(county_fips, ''),
          coalesce(category_slug, ''),
          status_class
        )
        do update set
          request_count = crawler_request_hourly_rollups.request_count + 1,
          updated_at = now()
      `,
      [
        botName,
        requestType,
        attribution.sourceSurface,
        attribution.stateCode,
        attribution.countySlug,
        attribution.countyFips,
        attribution.categorySlug,
        statusClass,
      ]
    );

    await refreshBotObservationDailyAggregate({
      observedAt,
      routeFamily: routeContext.routeFamily,
      county: routeContext.county,
      state: routeContext.state,
      trade: routeContext.trade,
      botFamily: botName,
    });
    crawlerPersistenceStats.succeeded += 1;
    crawlerPersistenceStats.lastSuccessAt = new Date().toISOString();
  } catch (error) {
    const errCodeRaw =
      error && typeof error === "object" && "code" in (error as Record<string, unknown>)
        ? String((error as any).code || "")
        : "";
    const errCode = errCodeRaw || "unknown";
    crawlerPersistenceStats.failed += 1;
    crawlerPersistenceStats.errorCodes[errCode] =
      Number(crawlerPersistenceStats.errorCodes[errCode] || 0) + 1;
    crawlerPersistenceStats.lastFailureAt = new Date().toISOString();
    crawlerPersistenceStats.lastFailureCode = errCode;
    crawlerPersistenceStats.lastFailureMessage =
      error && typeof error === "object" && "message" in (error as Record<string, unknown>)
        ? String((error as any).message || "").slice(0, 300)
        : String(error || "unknown error").slice(0, 300);
    console.error("[crawler-telemetry] failed to persist crawler request event:", error);
  }
}

export interface CrawlerTelemetrySummary {
  generatedAt: string;
  totals24h: {
    total: number;
    ok: number;
    clientError: number;
    serverError: number;
  };
  topBots: Array<{
    botName: string;
    requestCount: number;
  }>;
  topRoutes: Array<{
    path: string;
    requestCount: number;
  }>;
  topSurfaces: Array<{
    sourceSurface: string;
    requestCount: number;
  }>;
  topCounties: Array<{
    countyName: string;
    stateCode: string | null;
    countyFips: string | null;
    sourceSurface: string;
    requestCount: number;
  }>;
  requestTypes: Array<{
    requestType: string;
    requestCount: number;
  }>;
  hourlyBuckets: Array<{
    bucketStart: string;
    total: number;
    ok: number;
    clientError: number;
    serverError: number;
  }>;
  persistence: {
    attempted: number;
    succeeded: number;
    failed: number;
    successRatePct: number;
    errorCodes: Record<string, number>;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureCode: string | null;
    lastFailureMessage: string | null;
  };
}

function getCrawlerPersistenceSnapshot() {
  return {
    attempted: crawlerPersistenceStats.attempted,
    succeeded: crawlerPersistenceStats.succeeded,
    failed: crawlerPersistenceStats.failed,
    successRatePct:
      crawlerPersistenceStats.attempted > 0
        ? Math.round(
            (crawlerPersistenceStats.succeeded / crawlerPersistenceStats.attempted) * 10000
          ) / 100
        : 100,
    errorCodes: { ...crawlerPersistenceStats.errorCodes },
    lastSuccessAt: crawlerPersistenceStats.lastSuccessAt,
    lastFailureAt: crawlerPersistenceStats.lastFailureAt,
    lastFailureCode: crawlerPersistenceStats.lastFailureCode,
    lastFailureMessage: crawlerPersistenceStats.lastFailureMessage,
  };
}

export async function getCrawlerTelemetrySummary(): Promise<CrawlerTelemetrySummary> {
  try {
    await ensureCrawlerRequestEventsTable();
    await backfillCountyFipsIfNeeded();

    const [
      totalsResult,
      topBotsResult,
      topRoutesResult,
      topSurfacesResult,
      topCountiesResult,
      requestTypesResult,
      hourlyBucketsResult,
    ] = await Promise.all([
      pool.query(`
        select
          count(*)::int as total_count,
          count(*) filter (where status_class = '2xx')::int as ok_count,
          count(*) filter (where status_class = '4xx')::int as client_error_count,
          count(*) filter (where status_class = '5xx')::int as server_error_count
        from crawler_request_events
        where observed_at >= now() - interval '24 hours'
      `),
      pool.query(`
        select
          bot_name,
          count(*)::int as request_count
        from crawler_request_events
        where observed_at >= now() - interval '24 hours'
        group by bot_name
        order by request_count desc, bot_name asc
        limit 8
      `),
      pool.query(`
        select
          path,
          count(*)::int as request_count
        from crawler_request_events
        where observed_at >= now() - interval '24 hours'
        group by path
        order by request_count desc, path asc
        limit 8
      `),
      pool.query(`
        select
          coalesce(source_surface, 'unknown') as source_surface,
          count(*)::int as request_count
        from crawler_request_events
        where observed_at >= now() - interval '24 hours'
        group by coalesce(source_surface, 'unknown')
        order by request_count desc, source_surface asc
        limit 8
      `),
      pool.query(`
        select
          coalesce(c.name, e.county_slug, 'unknown') as county_name,
          coalesce(e.state_code, c.state_code) as state_code,
          e.county_fips,
          coalesce(e.source_surface, 'unknown') as source_surface,
          count(*)::int as request_count
        from crawler_request_events e
        left join counties c on c.fips = e.county_fips
        where e.observed_at >= now() - interval '24 hours'
          and (e.county_fips is not null or e.county_slug is not null)
        group by county_name, state_code, e.county_fips, source_surface
        order by request_count desc, county_name asc
        limit 8
      `),
      pool.query(`
        select
          request_type,
          count(*)::int as request_count
        from crawler_request_events
        where observed_at >= now() - interval '24 hours'
        group by request_type
        order by request_count desc, request_type asc
      `),
      pool.query(`
        select
          bucket_start,
          coalesce(sum(request_count), 0)::int as total_count,
          coalesce(sum(case when status_class = '2xx' then request_count else 0 end), 0)::int as ok_count,
          coalesce(sum(case when status_class = '4xx' then request_count else 0 end), 0)::int as client_error_count,
          coalesce(sum(case when status_class = '5xx' then request_count else 0 end), 0)::int as server_error_count
        from crawler_request_hourly_rollups
        where bucket_start >= date_trunc('hour', now() - interval '23 hours')
        group by bucket_start
        order by bucket_start asc
      `),
    ]);

    const totals = totalsResult.rows?.[0] || {};
    return {
      generatedAt: new Date().toISOString(),
      totals24h: {
        total: Number(totals.total_count || 0),
        ok: Number(totals.ok_count || 0),
        clientError: Number(totals.client_error_count || 0),
        serverError: Number(totals.server_error_count || 0),
      },
      topBots: (topBotsResult.rows || []).map((row) => ({
        botName: String(row.bot_name || "UnknownBot"),
        requestCount: Number(row.request_count || 0),
      })),
      topRoutes: (topRoutesResult.rows || []).map((row) => ({
        path: String(row.path || "/"),
        requestCount: Number(row.request_count || 0),
      })),
      topSurfaces: (topSurfacesResult.rows || []).map((row) => ({
        sourceSurface: String(row.source_surface || "unknown"),
        requestCount: Number(row.request_count || 0),
      })),
      topCounties: (topCountiesResult.rows || []).map((row) => ({
        countyName: String(row.county_name || "Unknown county"),
        stateCode: row.state_code ? String(row.state_code) : null,
        countyFips: row.county_fips ? String(row.county_fips) : null,
        sourceSurface: String(row.source_surface || "unknown"),
        requestCount: Number(row.request_count || 0),
      })),
      requestTypes: (requestTypesResult.rows || []).map((row) => ({
        requestType: String(row.request_type || "unknown"),
        requestCount: Number(row.request_count || 0),
      })),
      hourlyBuckets: (hourlyBucketsResult.rows || []).map((row) => ({
        bucketStart: new Date(String(row.bucket_start)).toISOString(),
        total: Number(row.total_count || 0),
        ok: Number(row.ok_count || 0),
        clientError: Number(row.client_error_count || 0),
        serverError: Number(row.server_error_count || 0),
      })),
      persistence: getCrawlerPersistenceSnapshot(),
    };
  } catch (error) {
    console.warn("[crawler-telemetry] degraded summary:", error);
    return {
      generatedAt: new Date().toISOString(),
      totals24h: { total: 0, ok: 0, clientError: 0, serverError: 0 },
      topBots: [],
      topRoutes: [],
      topSurfaces: [],
      topCounties: [],
      requestTypes: [],
      hourlyBuckets: [],
      persistence: getCrawlerPersistenceSnapshot(),
    };
  }
}

export async function getBotCrawlAggregateSignals(): Promise<BotCrawlAggregateSignal[]> {
  try {
    await ensureCrawlerRequestEventsTable();
    const result = await pool.query<BotObservationRow>(
      `
        select
          date,
          route_family,
          county,
          state,
          trade,
          bot_family,
          hits,
          unique_urls,
          avg_response_time_ms,
          avg_response_bytes,
          status_200_count,
          status_404_count,
          recrawl_urls,
          first_seen_urls,
          top_path
        from bot_observation_daily_agg
        where date >= current_date - interval '1 day'
        order by hits desc, unique_urls desc, route_family asc
        limit 12
      `
    );

    return (result.rows || []).map((row) => ({
      date: new Date(String(row.date)).toISOString().slice(0, 10),
      routeFamily: String(row.route_family || "other"),
      county: row.county ? String(row.county) : null,
      state: row.state ? String(row.state) : null,
      trade: row.trade ? String(row.trade) : null,
      botFamily: String(row.bot_family || "UnknownBot"),
      hits: Number(row.hits || 0),
      uniqueUrls: Number(row.unique_urls || 0),
      avgResponseTimeMs:
        row.avg_response_time_ms === null ? null : Number(row.avg_response_time_ms || 0),
      avgResponseBytes:
        row.avg_response_bytes === null ? null : Number(row.avg_response_bytes || 0),
      status200Count: Number(row.status_200_count || 0),
      status404Count: Number(row.status_404_count || 0),
      recrawlUrls: Number(row.recrawl_urls || 0),
      firstSeenUrls: Number(row.first_seen_urls || 0),
      topPath: row.top_path ? String(row.top_path) : null,
    }));
  } catch (error) {
    console.warn("[crawler-telemetry] degraded bot crawl aggregate signals:", error);
    return [];
  }
}
