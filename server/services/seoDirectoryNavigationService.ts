import { sql } from "drizzle-orm";
import { db } from "../db";

export type ActiveTradeScope = { tradeSlug: string; coverageCount: number };
export type ActiveStateScope = { stateCode: string; coverageCount: number };
export type ActiveCountyTradeScope = { tradeSlug: string; businessCount: number };
export type ActiveCountyScope = { countySlug: string; businessCount: number };

// The scheduler runs every six hours by default. After four missed windows the
// snapshot is no longer authoritative crawl truth and readers fail retryably.
export const SEO_DIRECTORY_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SEO_DIRECTORY_SNAPSHOT_FUTURE_SKEW_MS = 5 * 60 * 1000;

function resultRows(result: unknown): Array<Record<string, unknown>> {
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
}

function positiveCount(value: unknown): number {
  const count = Number(value || 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export function isSeoDirectorySnapshotComplete(row: unknown, now: Date = new Date()): boolean {
  if (!row || typeof row !== "object") return false;
  const source = row as Record<string, unknown>;
  const completedAt = new Date(String(source.completed_at || source.completedAt || ""));
  const generation = Number(source.generation || 0);
  const completedAtMs = completedAt.getTime();
  const nowMs = now.getTime();
  if (generation <= 0 || Number.isNaN(completedAtMs) || Number.isNaN(nowMs)) return false;
  const ageMs = nowMs - completedAtMs;
  return (
    ageMs >= -SEO_DIRECTORY_SNAPSHOT_FUTURE_SKEW_MS && ageMs <= SEO_DIRECTORY_SNAPSHOT_MAX_AGE_MS
  );
}

export type SeoDirectorySnapshotAuthority = {
  generation: number;
  completedAt: Date;
};

export async function assertSeoDirectorySnapshotReady(): Promise<SeoDirectorySnapshotAuthority> {
  const result = await db.execute(sql`
    select generation, completed_at
    from ts_seo_directory_snapshot_status
    where snapshot_key = 'directory_scope_v1'
    limit 1;
  `);
  const row = resultRows(result)[0];
  if (!isSeoDirectorySnapshotComplete(row)) {
    throw new Error("SEO directory snapshot has no fresh completed generation");
  }
  return {
    generation: Number(row.generation),
    completedAt: new Date(String(row.completed_at || row.completedAt || "")),
  };
}

export async function hasActiveSeoDirectoryCityScope(args: {
  stateCode: string;
  citySlug: string;
  tradeSlug?: string | null;
}): Promise<boolean> {
  await assertSeoDirectorySnapshotReady();
  const tradeClause = args.tradeSlug ? sql`and trade_slug = ${args.tradeSlug}` : sql``;
  const result = await db.execute(sql`
    select 1
    from ts_seo_trade_city_pages
    where state_code = ${args.stateCode}
      and city_slug = ${args.citySlug}
      and business_count > 0
      ${tradeClause}
    limit 1;
  `);
  return resultRows(result).length > 0;
}

export async function listActiveTradeScopes(): Promise<ActiveTradeScope[]> {
  await assertSeoDirectorySnapshotReady();
  const result = await db.execute(sql`
    select trade_slug, sum(business_count)::int as coverage_count
    from ts_seo_trade_county_pages
    where coalesce(trade_slug, '') <> '' and business_count > 0
    group by trade_slug
    order by sum(business_count) desc, trade_slug asc;
  `);
  return resultRows(result)
    .map((row) => ({
      tradeSlug: String(row.trade_slug || "").trim(),
      coverageCount: positiveCount(row.coverage_count),
    }))
    .filter((row) => row.tradeSlug.length > 0 && row.coverageCount > 0);
}

export async function listActiveTradeStateScopes(tradeSlug: string): Promise<ActiveStateScope[]> {
  await assertSeoDirectorySnapshotReady();
  const result = await db.execute(sql`
    select state_code, sum(business_count)::int as coverage_count
    from ts_seo_trade_county_pages
    where trade_slug = ${tradeSlug} and business_count > 0
    group by state_code
    order by sum(business_count) desc, state_code asc;
  `);
  return resultRows(result)
    .map((row) => ({
      stateCode: String(row.state_code || "")
        .trim()
        .toUpperCase(),
      coverageCount: positiveCount(row.coverage_count),
    }))
    .filter((row) => /^[A-Z]{2}$/.test(row.stateCode) && row.coverageCount > 0);
}

export async function listActiveTradeCountyScopes(
  tradeSlug: string,
  stateCode: string
): Promise<ActiveCountyScope[]> {
  await assertSeoDirectorySnapshotReady();
  const result = await db.execute(sql`
    select county_slug, sum(business_count)::int as business_count
    from ts_seo_trade_county_pages
    where trade_slug = ${tradeSlug}
      and state_code = ${stateCode}
      and business_count > 0
    group by county_slug
    order by sum(business_count) desc, county_slug asc;
  `);
  return resultRows(result)
    .map((row) => ({
      countySlug: String(row.county_slug || "")
        .trim()
        .toLowerCase(),
      businessCount: positiveCount(row.business_count),
    }))
    .filter((row) => /^[a-z0-9-]+$/.test(row.countySlug) && row.businessCount > 0);
}

export async function listActiveCountyTradeScopes(
  stateCode: string,
  countySlug: string
): Promise<ActiveCountyTradeScope[]> {
  await assertSeoDirectorySnapshotReady();
  const result = await db.execute(sql`
    select trade_slug, sum(business_count)::int as business_count
    from ts_seo_trade_county_pages
    where state_code = ${stateCode}
      and county_slug = ${countySlug}
      and business_count > 0
    group by trade_slug
    order by sum(business_count) desc, trade_slug asc;
  `);
  return resultRows(result)
    .map((row) => ({
      tradeSlug: String(row.trade_slug || "").trim(),
      businessCount: positiveCount(row.business_count),
    }))
    .filter((row) => row.tradeSlug.length > 0 && row.businessCount > 0);
}
