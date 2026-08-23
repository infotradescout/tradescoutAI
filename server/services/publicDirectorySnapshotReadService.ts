import { pool } from "../db";
import { assertSeoDirectorySnapshotReady } from "./seoDirectoryNavigationService";

/**
 * Current-state negative gate layered over the completed snapshot. The
 * snapshot grants bounded positive membership; status, consent, claim/owner
 * consistency, and verification revocations take effect immediately.
 *
 * Raw-query callers use the fixed `live` and `owner` aliases below.
 */
export const PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL = `
  live.status = 'active'
  AND live.public_discovery_enabled IS TRUE
  AND (
    (
      live.owner_user_id IS NULL
      AND lower(COALESCE(live.claim_status, '')) = 'unclaimed'
    )
    OR
    (
      live.owner_user_id IS NOT NULL
      AND lower(COALESCE(live.claim_status, '')) <> 'unclaimed'
      AND lower(COALESCE(owner.verification_status::text, '')) = 'approved'
      AND owner.address_verified IS TRUE
    )
  )
`;

export type SnapshotDirectoryBusiness = {
  slug: string;
  name: string;
  tradeSlug: string;
  claimStatus: "claimed" | "unclaimed";
  updatedAt: Date | string | null;
};

export type SnapshotCountyTrade = {
  tradeSlug: string;
  businessCount: number;
  updatedAt: Date | string | null;
};

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function normalizeBusiness(row: any): SnapshotDirectoryBusiness | null {
  const slug = String(row?.slug || "").trim();
  const name = String(row?.display_name || "").trim();
  const tradeSlug = String(row?.trade_slug || "").trim();
  if (!slug || !name || !tradeSlug) return null;
  return {
    slug,
    name,
    tradeSlug,
    claimStatus:
      String(row?.claim_status || "")
        .trim()
        .toLowerCase() === "unclaimed"
        ? "unclaimed"
        : "claimed",
    updatedAt: row?.lastmod ?? null,
  };
}

async function assertSameGeneration(generation: number): Promise<void> {
  const completed = await assertSeoDirectorySnapshotReady();
  if (completed.generation !== generation) {
    throw new Error("SEO directory snapshot changed during authoritative read");
  }
}

export async function loadSnapshotCountyDirectory(args: {
  countyFips: string;
  businessLimit?: number;
  tradeLimit?: number;
}): Promise<{
  businesses: SnapshotDirectoryBusiness[];
  trades: SnapshotCountyTrade[];
}> {
  const authority = await assertSeoDirectorySnapshotReady();
  const businessLimit = Math.max(1, Math.min(200, Number(args.businessLimit || 50)));
  const tradeLimit = Math.max(1, Math.min(100, Number(args.tradeLimit || 30)));
  const result = await pool.query(
    `WITH target_county AS (
       SELECT id
       FROM counties
       WHERE fips = $1
       LIMIT 1
     ), eligible AS (
       SELECT DISTINCT
         bp.business_id,
         bp.slug,
         bp.display_name,
         bp.trade_slug,
         live.claim_status,
         bp.lastmod
       FROM ts_seo_directory_business_pages bp
       INNER JOIN ts_seo_directory_business_counties bc
         ON bc.business_id = bp.business_id
       INNER JOIN target_county tc ON tc.id = bc.county_id
       INNER JOIN businesses live ON live.id = bp.business_id
       LEFT JOIN users owner ON owner.id = live.owner_user_id
       WHERE bp.trade_slug IS NOT NULL
         AND ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
     )
     SELECT
       COALESCE((
         SELECT jsonb_agg(sample ORDER BY sample.lastmod DESC, sample.slug ASC)
         FROM (
           SELECT slug, display_name, trade_slug, claim_status, lastmod
           FROM eligible
           ORDER BY lastmod DESC, slug ASC
           LIMIT $2
         ) sample
       ), '[]'::jsonb) AS businesses,
       COALESCE((
         SELECT jsonb_agg(scope ORDER BY scope.business_count DESC, scope.trade_slug ASC)
         FROM (
           SELECT trade_slug, count(DISTINCT business_id)::int AS business_count,
                  max(lastmod) AS lastmod
           FROM eligible
           GROUP BY trade_slug
           ORDER BY count(DISTINCT business_id) DESC, trade_slug ASC
           LIMIT $3
         ) scope
       ), '[]'::jsonb) AS trades`,
    [String(args.countyFips || "").trim(), businessLimit, tradeLimit]
  );
  await assertSameGeneration(authority.generation);
  const row = rowsOf(result)[0] || {};
  const businesses = (Array.isArray(row.businesses) ? row.businesses : [])
    .map(normalizeBusiness)
    .filter((entry: SnapshotDirectoryBusiness | null): entry is SnapshotDirectoryBusiness =>
      Boolean(entry)
    );
  const trades = (Array.isArray(row.trades) ? row.trades : [])
    .map((scope: any) => ({
      tradeSlug: String(scope?.trade_slug || "").trim(),
      businessCount: Math.max(0, Number(scope?.business_count || 0)),
      updatedAt: scope?.lastmod ?? null,
    }))
    .filter((scope: SnapshotCountyTrade) => scope.tradeSlug && scope.businessCount > 0);
  return { businesses, trades };
}

export async function loadSnapshotTradeCountyBusinesses(args: {
  countyFips: string;
  tradeSlug: string;
  limit?: number;
}): Promise<SnapshotDirectoryBusiness[]> {
  const authority = await assertSeoDirectorySnapshotReady();
  const limit = Math.max(1, Math.min(200, Number(args.limit || 200)));
  const result = await pool.query(
    `SELECT DISTINCT
       bp.slug,
       bp.display_name,
       bp.trade_slug,
       live.claim_status,
       bp.lastmod
     FROM ts_seo_directory_business_pages bp
     INNER JOIN ts_seo_directory_business_counties bc
       ON bc.business_id = bp.business_id
     INNER JOIN counties c ON c.id = bc.county_id
     INNER JOIN businesses live ON live.id = bp.business_id
     LEFT JOIN users owner ON owner.id = live.owner_user_id
     WHERE c.fips = $1
       AND bp.trade_slug = $2
       AND ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
     ORDER BY bp.display_name ASC, bp.slug ASC
     LIMIT $3`,
    [String(args.countyFips || "").trim(), String(args.tradeSlug || "").trim(), limit]
  );
  await assertSameGeneration(authority.generation);
  return rowsOf(result)
    .map(normalizeBusiness)
    .filter((entry: SnapshotDirectoryBusiness | null): entry is SnapshotDirectoryBusiness =>
      Boolean(entry)
    );
}
