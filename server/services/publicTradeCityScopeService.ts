import { sql } from "drizzle-orm";
import { db } from "../db";
import { assertSeoDirectorySnapshotReady } from "./seoDirectoryNavigationService";

export type ExactTradeCityCountyScope = {
  countyFips: string;
  countyName: string;
  stateCode: string;
  businessCount: number;
};

/** Read generation-atomic city/county facts produced by the snapshot job. */
export async function loadExactTradeCityCountyScopes(args: {
  tradeSlug?: string | null;
  stateCode: string;
  citySlug: string;
  recencyCutoff?: Date;
}): Promise<ExactTradeCityCountyScope[]> {
  await assertSeoDirectorySnapshotReady();
  const result = args.tradeSlug
    ? await db.execute(sql`
        select
          county.fips as county_fips,
          county.name as county_name,
          county.state_code,
          scope.business_count
        from ts_seo_trade_city_county_pages scope
        inner join counties county on county.id = scope.county_id
        where scope.state_code = ${args.stateCode}
          and scope.city_slug = ${args.citySlug}
          and scope.trade_slug = ${args.tradeSlug}
          and scope.business_count > 0
        order by county.name asc, county.fips asc
        limit 500;
      `)
    : await db.execute(sql`
        select
          county.fips as county_fips,
          county.name as county_name,
          county.state_code,
          scope.business_count
        from ts_seo_city_county_pages scope
        inner join counties county on county.id = scope.county_id
        where scope.state_code = ${args.stateCode}
          and scope.city_slug = ${args.citySlug}
          and scope.business_count > 0
        order by county.name asc, county.fips asc
        limit 500;
      `);
  const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
  return rows
    .map((row: any) => ({
      countyFips: String(row.county_fips || ""),
      countyName: String(row.county_name || ""),
      stateCode: String(row.state_code || "").toUpperCase(),
      businessCount: Math.max(0, Math.trunc(Number(row.business_count || 0))),
    }))
    .filter(
      (row: ExactTradeCityCountyScope) =>
        /^\d{5}$/.test(row.countyFips) &&
        row.countyName.length > 0 &&
        /^[A-Z]{2}$/.test(row.stateCode) &&
        row.businessCount > 0
    );
}
