import {
  businesses,
  businessCounties,
  counties,
  homeScoutListings,
  marketplaceCategories,
  marketplaceListings,
  profiles,
  users,
} from "@shared/schema";
import { db, pool as neonPool } from "../db";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export class SitemapRepository {
  async listPublicProfilesForSitemap(): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    const rows = await db
      .select({
        slug: profiles.slug,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .where(
        and(
          eq(profiles.status, "published" as any),
          sql`COALESCE((${users.preferences} ->> 'profileVisibility'), 'private') = 'public'`
        )
      )
      .orderBy(desc(profiles.updatedAt));
    return rows.map((row) => ({
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
      .where(sql`${users.businessSlug} IS NOT NULL`)
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
    const rows = await db
      .select({ count: sql<number>`count(DISTINCT ${businesses.id})` })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true as any)
        )
      );
    const count = Number((rows[0] as any)?.count ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }

  async listActiveDirectoryBusinessesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ slug: string; updatedAt: Date | null }>> {
    const limitRequested = Number(args?.limit ?? 40_000) || 40_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));
    const offsetRequested = Number(args?.offset ?? 0) || 0;
    const offset = Math.max(0, offsetRequested);

    const rows = await db
      .select({
        slug: businesses.slug,
        updatedAt: businesses.updatedAt,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true as any)
        )
      )
      .orderBy(asc(businesses.slug))
      .groupBy(businesses.slug, businesses.updatedAt)
      .limit(limit)
      .offset(offset);

    return rows
      .map((row) => ({
        slug: String(row.slug || "").trim(),
        updatedAt: row.updatedAt ?? null,
      }))
      .filter((row) => row.slug.length > 0);
  }

  async countDirectoryCountiesForSitemap(): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(DISTINCT ${counties.fips})` })
      .from(counties)
      .innerJoin(businessCounties, eq(businessCounties.countyId, counties.id))
      .innerJoin(businesses, eq(businesses.id, businessCounties.businessId))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true as any)
        )
      );
    const count = Number((rows[0] as any)?.count ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }

  async listDirectoryCountiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>> {
    const limitRequested = Number(args?.limit ?? 10_000) || 10_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));
    const offsetRequested = Number(args?.offset ?? 0) || 0;
    const offset = Math.max(0, offsetRequested);

    const rows = await db
      .select({
        fips: counties.fips,
        name: counties.name,
        stateCode: counties.stateCode,
        updatedAt: sql<Date | null>`max(${businesses.updatedAt})`,
      })
      .from(counties)
      .innerJoin(businessCounties, eq(businessCounties.countyId, counties.id))
      .innerJoin(businesses, eq(businesses.id, businessCounties.businessId))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true as any)
        )
      )
      .groupBy(counties.fips, counties.name, counties.stateCode)
      .orderBy(asc(counties.fips))
      .limit(limit)
      .offset(offset);

    return rows
      .map((row) => ({
        fips: String((row as any).fips || "").trim(),
        name: String((row as any).name || "").trim(),
        stateCode: String((row as any).stateCode || "")
          .trim()
          .toUpperCase(),
        updatedAt: (row as any).updatedAt ?? null,
      }))
      .filter((row) => row.fips.length === 5 && row.stateCode.length === 2 && row.name.length > 0);
  }

  async countDirectoryCitiesForSitemap(): Promise<number> {
    const citySlugExpr = sql`lower(regexp_replace(coalesce(${businesses.profileData} ->> 'city', ''), '[^a-z0-9]+', '-', 'g'))`;

    const rows = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(
        sql`(
          select
            ${counties.stateCode} as state_code,
            ${citySlugExpr} as city_slug
          from ${businesses}
          inner join ${businessCounties} on ${businessCounties.businessId} = ${businesses.id}
          inner join ${counties} on ${counties.id} = ${businessCounties.countyId}
          where ${businesses.status} = 'active'
            and ${businesses.publicDiscoveryEnabled} = true
            and coalesce(${businesses.profileData} ->> 'city', '') <> ''
          group by ${counties.stateCode}, ${citySlugExpr}
        ) as city_groups`
      );

    const count = Number((rows[0] as any)?.count ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  }

  async listDirectoryCitiesForSitemap(args?: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>> {
    const limitRequested = Number(args?.limit ?? 10_000) || 10_000;
    const limit = Math.max(1, Math.min(50_000, limitRequested));
    const offsetRequested = Number(args?.offset ?? 0) || 0;
    const offset = Math.max(0, offsetRequested);

    const citySlugExpr = sql`lower(regexp_replace(coalesce(${businesses.profileData} ->> 'city', ''), '[^a-z0-9]+', '-', 'g'))`;

    const rows = await db
      .select({
        stateCode: counties.stateCode,
        citySlug: citySlugExpr,
        updatedAt: sql<Date | null>`max(${businesses.updatedAt})`,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true as any),
          sql`coalesce(${businesses.profileData} ->> 'city', '') <> ''`
        )
      )
      .groupBy(counties.stateCode, citySlugExpr)
      .orderBy(asc(counties.stateCode), asc(citySlugExpr))
      .limit(limit)
      .offset(offset);

    return rows
      .map((row) => ({
        stateCode: String((row as any).stateCode || "")
          .trim()
          .toUpperCase(),
        citySlug: String((row as any).citySlug || "")
          .trim()
          .toLowerCase(),
        updatedAt: (row as any).updatedAt ?? null,
      }))
      .filter((row) => row.stateCode.length === 2 && row.citySlug.length > 0);
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
      const code = String(error?.code || "");
      if (code === "42P01") {
        return [];
      }
      throw error;
    }
  }

  async listActiveExchangeListingsForSitemap(args?: {
    limit?: number;
  }): Promise<Array<{ id: string; categoryName: string; updatedAt: Date | null }>> {
    const limitRequested = Number(args?.limit ?? 50_000) || 50_000;
    const limit = Math.max(1, Math.min(100_000, limitRequested));

    const rows = await db
      .select({
        id: marketplaceListings.id,
        categoryName: marketplaceCategories.name,
        updatedAt: marketplaceListings.updatedAt,
      })
      .from(marketplaceListings)
      .leftJoin(marketplaceCategories, eq(marketplaceListings.categoryId, marketplaceCategories.id))
      .where(eq(marketplaceListings.status, "active" as any))
      .orderBy(desc(marketplaceListings.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      categoryName: row.categoryName ?? "",
      updatedAt: row.updatedAt ?? null,
    }));
  }
}
