import { sql } from "drizzle-orm";
import { db } from "../db";

export type ActiveTradeScope = {
  tradeSlug: string;
  businessCount: number;
};

export type ActiveStateScope = {
  stateCode: string;
  businessCount: number;
};

export type ActiveCountyScope = {
  countySlug: string;
  businessCount: number;
};

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

export async function listActiveTradeScopes(): Promise<ActiveTradeScope[]> {
  const result = await db.execute(sql`
    select trade_slug, sum(business_count)::int as business_count
    from ts_seo_trade_county_pages
    where coalesce(trade_slug, '') <> '' and business_count > 0
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

export async function listActiveTradeStateScopes(tradeSlug: string): Promise<ActiveStateScope[]> {
  const result = await db.execute(sql`
    select state_code, sum(business_count)::int as business_count
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
      businessCount: positiveCount(row.business_count),
    }))
    .filter((row) => /^[A-Z]{2}$/.test(row.stateCode) && row.businessCount > 0);
}

export async function listActiveTradeCountyScopes(
  tradeSlug: string,
  stateCode: string
): Promise<ActiveCountyScope[]> {
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
): Promise<ActiveTradeScope[]> {
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
