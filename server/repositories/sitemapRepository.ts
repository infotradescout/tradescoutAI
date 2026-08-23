import {
  businesses,
  homeScoutListings,
  marketplaceCategories,
  marketplaceListings,
  profiles,
  users,
} from "@shared/schema";
import { INTERNAL_ADMIN_PROFILE_SLUGS } from "@shared/publicProfileIndexing";
import { db, pool as neonPool } from "../db";
import { and, asc, desc, eq, notInArray, or, sql } from "drizzle-orm";
import {
  canDiscoverPublishedProfilePublicly,
  type PublishedProfileExposureCandidate,
} from "../services/ownerConfirmedDirectProfile";
import { assertSeoDirectorySnapshotReady } from "../services/seoDirectoryNavigationService";
import { PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL } from "../services/publicDirectorySnapshotReadService";

const NON_PRODUCTION_PUBLIC_SLUG_PATTERN = /^(?:qa|smoke|test)(?:-|$)/i;
const NON_PRODUCTION_EXCHANGE_COPY_PATTERN =
  /\b(smoke\s*market|unauthorized|demo\s*listing|test\s*listing|sample\s*listing|placeholder)\b/i;

export function isProductionPublicSlug(value: unknown): boolean {
  const slug = String(value || "").trim();
  return slug.length > 0 && !NON_PRODUCTION_PUBLIC_SLUG_PATTERN.test(slug);
}

export function isProductionExchangeListingCopy(title: unknown, description: unknown): boolean {
  return !NON_PRODUCTION_EXCHANGE_COPY_PATTERN.test(`${title || ""} ${description || ""}`);
}

export type ProfileSitemapEligibilityCandidate = Omit<
  PublishedProfileExposureCandidate,
  "profileSlug" | "profileStatus"
> & {
  slug: unknown;
};

export function shouldIncludePublicProfileInSitemap(
  candidate: ProfileSitemapEligibilityCandidate
): boolean {
  if (!isProductionPublicSlug(candidate.slug)) return false;
  return canDiscoverPublishedProfilePublicly({
    ...candidate,
    profileSlug: candidate.slug,
    profileStatus: "published",
  });
}

export class SitemapRepository {
  async listPublicProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    const rows = await db
      .select({
        profileId: profiles.id,
        slug: profiles.slug,
        updatedAt: profiles.updatedAt,
        businessId: profiles.businessId,
        profileRoleContext: profiles.roleContext,
        profileHeadline: profiles.headline,
        profileContentBlocks: profiles.contentBlocks,
        profileOwnerUserId: profiles.ownerUserId,
        ownerVerifiedBadge: users.verifiedBadge,
        ownerVerificationStatus: users.verificationStatus,
        ownerRole: users.role,
        ownerRoles: users.roles,
        ownerProvider: users.provider,
        ownerPreferences: users.preferences,
        profileServicesDescription: sql<
          string | null
        >`(${users.preferences} ->> 'servicesDescription')`,
        businessStatus: businesses.status,
        businessOwnerUserId: businesses.ownerUserId,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        businessSources: businesses.sources,
        businessClaimStatus: businesses.claimStatus,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .leftJoin(businesses, eq(profiles.businessId, businesses.id))
      .where(
        and(
          eq(profiles.status, "published" as any),
          notInArray(profiles.slug, [...INTERNAL_ADMIN_PROFILE_SLUGS])
        )
      )
      .orderBy(desc(profiles.updatedAt));
    return rows
      .filter((row) => Boolean(row.businessId) && shouldIncludePublicProfileInSitemap(row))
      .map((row) => ({
        slug: row.slug,
        updatedAt: row.updatedAt ?? null,
      }));
  }

  async listBusinessProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    const rows = await db
      .select({
        slug: users.businessSlug,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          sql`${users.businessSlug} IS NOT NULL`,
          or(
            eq(users.verifiedBadge, true),
            sql`lower(COALESCE(${users.verificationStatus}, '')) = 'approved'`
          )
        )
      )
      .orderBy(desc(users.updatedAt))
      .limit(100_000);

    return rows
      .map((row) => ({
        slug: String(row.slug || "").trim(),
        updatedAt: row.updatedAt ?? null,
      }))
      .filter((row) => row.slug.length > 0);
  }

  async countActiveDirectoryBusinessesForSitemap(): Promise<number> {
    await assertSeoDirectorySnapshotReady();
    const result = await neonPool.query(
      `select count(*)::int as count
         from ts_seo_directory_business_pages bp
         inner join businesses live on live.id = bp.business_id
         left join users owner on owner.id = live.owner_user_id
        where ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}`
    );
    return Number(result.rows[0]?.count || 0);
  }

  async listActiveDirectoryBusinessesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    await assertSeoDirectorySnapshotReady();
    const limitRequested = Number(args?.limit ?? 40_000) || 40_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));
    const offsetRequested = Number(args?.offset ?? 0) || 0;
    const offset = Math.max(0, offsetRequested);

    const result = await neonPool.query(
      `select bp.slug, bp.lastmod
         from ts_seo_directory_business_pages bp
         inner join businesses live on live.id = bp.business_id
         left join users owner on owner.id = live.owner_user_id
        where ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
        order by bp.slug asc
        limit $1 offset $2`,
      [limit, offset]
    );
    return result.rows
      .map((row: any) => ({
        slug: String(row.slug || "").trim(),
        updatedAt: row.lastmod ?? null,
      }))
      .filter((row) => isProductionPublicSlug(row.slug));
  }

  async countDirectoryCountiesForSitemap(): Promise<number> {
    await assertSeoDirectorySnapshotReady();
    const result = await neonPool.query(
      `with eligible as (
         select bp.business_id, bp.trade_slug
           from ts_seo_directory_business_pages bp
           inner join businesses live on live.id = bp.business_id
           left join users owner on owner.id = live.owner_user_id
          where bp.trade_slug is not null
            and ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
       )
       select count(distinct p.county_id)::int as count
         from ts_seo_trade_county_pages p
        where exists (
          select 1
            from eligible e
            inner join ts_seo_directory_business_counties bc
              on bc.business_id = e.business_id
           where e.trade_slug = p.trade_slug
             and bc.county_id = p.county_id
        )`
    );
    return Number(result.rows[0]?.count || 0);
  }

  async listDirectoryCountiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>> {
    await assertSeoDirectorySnapshotReady();
    const limitRequested = Number(args?.limit ?? 10_000) || 10_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));
    const offsetRequested = Number(args?.offset ?? 0) || 0;
    const offset = Math.max(0, offsetRequested);

    const result = await neonPool.query(
      `with eligible as (
         select bp.business_id, bp.trade_slug, bp.lastmod
           from ts_seo_directory_business_pages bp
           inner join businesses live on live.id = bp.business_id
           left join users owner on owner.id = live.owner_user_id
          where bp.trade_slug is not null
            and ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
       )
       select c.fips, c.name, upper(c.state_code) as state_code, max(e.lastmod) as lastmod
         from ts_seo_trade_county_pages p
         inner join counties c on c.id = p.county_id
         inner join eligible e on e.trade_slug = p.trade_slug
         inner join ts_seo_directory_business_counties bc
           on bc.business_id = e.business_id and bc.county_id = p.county_id
        group by c.fips, c.name, c.state_code
        order by c.fips asc
        limit $1 offset $2`,
      [limit, offset]
    );
    return result.rows.map((row: any) => ({
      fips: String(row.fips || "").trim(),
      name: String(row.name || "").trim(),
      stateCode: String(row.state_code || "")
        .trim()
        .toUpperCase(),
      updatedAt: row.lastmod ?? null,
    }));
  }

  async countDirectoryCitiesForSitemap(): Promise<number> {
    await assertSeoDirectorySnapshotReady();
    const result = await neonPool.query(
      `with eligible as (
         select bp.business_id, bp.trade_slug, bp.primary_state_code, bp.city_slug
           from ts_seo_directory_business_pages bp
           inner join businesses live on live.id = bp.business_id
           left join users owner on owner.id = live.owner_user_id
          where bp.trade_slug is not null
            and bp.city_slug is not null
            and ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
       )
       select count(*)::int as count
         from (
           select p.state_code, p.city_slug
             from ts_seo_city_county_pages p
            where exists (
              select 1
                from eligible e
                inner join ts_seo_directory_business_counties bc
                  on bc.business_id = e.business_id
               where e.primary_state_code = p.state_code
                 and e.city_slug = p.city_slug
                 and bc.county_id = p.county_id
            )
            group by p.state_code, p.city_slug
         ) city_scopes`
    );
    return Number(result.rows[0]?.count || 0);
  }

  async listDirectoryCitiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>> {
    await assertSeoDirectorySnapshotReady();
    const limitRequested = Number(args?.limit ?? 10_000) || 10_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));
    const offsetRequested = Number(args?.offset ?? 0) || 0;
    const offset = Math.max(0, offsetRequested);

    const result = await neonPool.query(
      `with eligible as (
         select bp.business_id, bp.trade_slug, bp.primary_state_code, bp.city_slug, bp.lastmod
           from ts_seo_directory_business_pages bp
           inner join businesses live on live.id = bp.business_id
           left join users owner on owner.id = live.owner_user_id
          where bp.trade_slug is not null
            and bp.city_slug is not null
            and ${PUBLIC_DIRECTORY_LIVE_ELIGIBILITY_SQL}
       )
       select upper(p.state_code) as state_code, p.city_slug, max(e.lastmod) as lastmod
         from ts_seo_city_county_pages p
         inner join eligible e
           on e.primary_state_code = p.state_code and e.city_slug = p.city_slug
         inner join ts_seo_directory_business_counties bc
           on bc.business_id = e.business_id and bc.county_id = p.county_id
        group by p.state_code, p.city_slug
        order by p.state_code asc, p.city_slug asc
        limit $1 offset $2`,
      [limit, offset]
    );
    return result.rows.map((row: any) => ({
      stateCode: String(row.state_code || "")
        .trim()
        .toUpperCase(),
      citySlug: String(row.city_slug || "")
        .trim()
        .toLowerCase(),
      updatedAt: row.lastmod ?? null,
    }));
  }

  async listActiveHomeScoutListingsForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ id: string; updatedAt: Date | null }>> {
    const limitRequested = Number(args?.limit ?? 50_000) || 50_000;
    const limit = Math.max(1, Math.min(100_000, limitRequested));

    const rows = await db
      .select({
        id: homeScoutListings.id,
        updatedAt: homeScoutListings.updatedAt,
      })
      .from(homeScoutListings)
      .where(eq(homeScoutListings.status, "active" as any))
      .orderBy(desc(homeScoutListings.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt ?? null,
    }));
  }

  async listHomeScoutCountiesForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ countyFips: string; stateCode: string; updatedAt: Date | null }>> {
    const limitRequested = Number(args?.limit ?? 10_000) || 10_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));

    const rows = await db
      .select({
        countyFips: homeScoutListings.countyFips,
        stateCode: homeScoutListings.stateCode,
        updatedAt: sql<Date | null>`max(${homeScoutListings.updatedAt})`,
      })
      .from(homeScoutListings)
      .where(eq(homeScoutListings.status, "active" as any))
      .groupBy(homeScoutListings.countyFips, homeScoutListings.stateCode)
      .orderBy(desc(sql`max(${homeScoutListings.updatedAt})`))
      .limit(limit);

    return rows.map((row) => ({
      countyFips: row.countyFips as any,
      stateCode: row.stateCode as any,
      updatedAt: (row as any).updatedAt ?? null,
    }));
  }

  async listTradePartnerCountiesForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ countySlug: string; updatedAt: Date | null; allowedCategories: string[] }>> {
    const limitRequested = Number(args?.limit ?? 10_000) || 10_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));

    try {
      const rowsResult = await neonPool.query(
        `
          SELECT county_slug, updated_at, allowed_categories
          FROM tradepartner_county_pages
          ORDER BY updated_at DESC
          LIMIT $1
        `,
        [limit]
      );

      const toStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return Array.from(
          new Set(
            value.map((entry) => String(entry || "").trim()).filter((entry) => entry.length > 0)
          )
        );
      };

      return rowsResult.rows
        .map((row: any) => ({
          countySlug: String(row?.county_slug || "")
            .trim()
            .toLowerCase(),
          updatedAt: row?.updated_at ?? null,
          allowedCategories: toStringArray(row?.allowed_categories),
        }))
        .filter((row) => row.countySlug.length > 0);
    } catch (error: any) {
      // This is an advertised crawl feed. Missing schema or transient storage
      // failure must reach the route's retryable 503 path, never a 200 empty set.
      throw error;
    }
  }

  async listActiveExchangeListingsForSitemap(args?: {
    limit?: number;
  }): Promise<
    Array<{ id: string; sellerUserId: string; categoryName: string; updatedAt: Date | null }>
  > {
    const limitRequested = Number(args?.limit ?? 50_000) || 50_000;
    const limit = Math.max(1, Math.min(100_000, limitRequested));

    const rows = await db
      .select({
        id: marketplaceListings.id,
        sellerUserId: marketplaceListings.sellerId,
        categoryName: marketplaceCategories.name,
        title: marketplaceListings.title,
        description: marketplaceListings.description,
        updatedAt: marketplaceListings.updatedAt,
      })
      .from(marketplaceListings)
      .leftJoin(marketplaceCategories, eq(marketplaceListings.categoryId, marketplaceCategories.id))
      .where(eq(marketplaceListings.status, "active" as any))
      .orderBy(desc(marketplaceListings.updatedAt))
      .limit(limit);

    return rows
      .filter((row) => isProductionExchangeListingCopy(row.title, row.description))
      .map((row) => ({
        id: row.id,
        sellerUserId: String(row.sellerUserId || "").trim(),
        categoryName: row.categoryName ?? "",
        updatedAt: row.updatedAt ?? null,
      }));
  }
}
