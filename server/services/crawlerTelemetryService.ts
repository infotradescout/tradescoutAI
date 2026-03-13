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

type CrawlerAttribution = {
  sourceSurface: string | null;
  stateCode: string | null;
  countySlug: string | null;
  countyFips: string | null;
  categorySlug: string | null;
};

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

export async function recordCrawlerRequestEvent(req: Request, statusCode: number): Promise<void> {
  const userAgent = req.get("User-Agent");
  const actor = detectActorFromUserAgent(userAgent);
  if (actor.actorType !== "bot") return;

  const statusClass = deriveStatusClass(statusCode);
  if (!statusClass) return;

  try {
    await ensureCrawlerRequestEventsTable();
    void pruneCrawlerRequestEventsIfNeeded();
    void backfillCountyFipsIfNeeded();
    const requestType: RequestType = classifyRequestType(req.path || req.originalUrl || "/");
    const { ip } = getClientIp(req);
    const baseAttribution = inferCrawlerAttribution(req.path || req.originalUrl || "/");
    const attribution: CrawlerAttribution = {
      ...baseAttribution,
      countyFips: await resolveCountyFips(baseAttribution.stateCode, baseAttribution.countySlug),
    };
    const botName = cleanBotName(actor.botName);

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
        cleanPath(req.path || req.originalUrl || "/"),
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
  } catch (error) {
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
}

export async function getCrawlerTelemetrySummary(): Promise<CrawlerTelemetrySummary> {
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
  };
}
