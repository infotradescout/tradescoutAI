import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { businessCounties, businesses, counties, users } from "@shared/schema";
import { slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "../publicationRules";
import {
  isPublicAndCrawlableBusiness,
  isPublicAndCrawlableBusinessDetail,
} from "@shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
  publicBusinessDetailExposureSqlPredicate,
} from "../publicationBusiness";
import { normalizePublicCitySlug } from "../seoDirectoryCitySlug";
import {
  buildPublicDirectoryProfile,
  hasPublicDirectoryOfferingFacts,
  orderPublicDirectoryCounties,
  sanitizePublicDirectoryDisplayName,
} from "./publicDirectoryBusinessPresentation";
import { SEO_DIRECTORY_SNAPSHOT_MAX_AGE_MS } from "./seoDirectoryNavigationService";

const NON_PRODUCTION_PUBLIC_SLUG_PATTERN = /^(?:qa|smoke|test)(?:-|$)/i;

/**
 * Temporary D1 safety bound. Query one row beyond the cap and abort before
 * replacing the last complete snapshot instead of silently publishing a
 * truncated nationwide crawl graph.
 */
export const SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP = 350_000;

export function assertSeoDirectoryScopeSourceCapacity(rowCount: number): void {
  if (rowCount <= SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP) return;
  throw new Error(
    `SEO directory snapshot source exceeded ${SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP} rows; preserving the previous complete snapshot`
  );
}

export function isSeoCategoryScopeFresh(args: {
  updatedAt: Date;
  now: Date;
  categoryPageRecencyWindowDays: number;
}): boolean {
  const cutoff = args.now.getTime() - args.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000;
  return args.updatedAt.getTime() >= cutoff;
}

export type SeoCityScopeAggregate = {
  tradeSlug: string;
  stateCode: string;
  citySlug: string;
  lastmod: Date;
  count: number;
};

export type SeoCityCountyScopeAggregate = SeoCityScopeAggregate & {
  countyId: string;
};

export type SeoGenericCityCountyScopeAggregate = Omit<SeoCityCountyScopeAggregate, "tradeSlug">;

export function recordDistinctSeoCityBusiness(args: {
  cityMap: Map<string, SeoCityScopeAggregate>;
  memberships: Set<string>;
  cityKey: string;
  businessId: string;
  tradeSlug: string;
  stateCode: string;
  citySlug: string;
  updatedAt: Date;
}): void {
  const membershipKey = JSON.stringify([args.cityKey, args.businessId]);
  const previous = args.cityMap.get(args.cityKey);
  if (args.memberships.has(membershipKey)) {
    if (previous && args.updatedAt > previous.lastmod) previous.lastmod = args.updatedAt;
    return;
  }

  args.memberships.add(membershipKey);
  if (!previous) {
    args.cityMap.set(args.cityKey, {
      tradeSlug: args.tradeSlug,
      stateCode: args.stateCode,
      citySlug: args.citySlug,
      lastmod: args.updatedAt,
      count: 1,
    });
    return;
  }

  previous.count += 1;
  if (args.updatedAt > previous.lastmod) previous.lastmod = args.updatedAt;
}

export function recordDistinctSeoCityCountyBusiness(args: {
  cityCountyMap: Map<string, SeoCityCountyScopeAggregate>;
  memberships: Set<string>;
  cityCountyKey: string;
  businessId: string;
  tradeSlug: string;
  stateCode: string;
  citySlug: string;
  countyId: string;
  updatedAt: Date;
}): void {
  const membershipKey = JSON.stringify([args.cityCountyKey, args.businessId]);
  const previous = args.cityCountyMap.get(args.cityCountyKey);
  if (args.memberships.has(membershipKey)) {
    if (previous && args.updatedAt > previous.lastmod) previous.lastmod = args.updatedAt;
    return;
  }
  args.memberships.add(membershipKey);
  if (!previous) {
    args.cityCountyMap.set(args.cityCountyKey, {
      tradeSlug: args.tradeSlug,
      stateCode: args.stateCode,
      citySlug: args.citySlug,
      countyId: args.countyId,
      lastmod: args.updatedAt,
      count: 1,
    });
    return;
  }
  previous.count += 1;
  if (args.updatedAt > previous.lastmod) previous.lastmod = args.updatedAt;
}

export function recordDistinctSeoGenericCityCountyBusiness(args: {
  cityCountyMap: Map<string, SeoGenericCityCountyScopeAggregate>;
  memberships: Set<string>;
  cityCountyKey: string;
  businessId: string;
  stateCode: string;
  citySlug: string;
  countyId: string;
  updatedAt: Date;
}): void {
  const membershipKey = JSON.stringify([args.cityCountyKey, args.businessId]);
  const previous = args.cityCountyMap.get(args.cityCountyKey);
  if (args.memberships.has(membershipKey)) {
    if (previous && args.updatedAt > previous.lastmod) previous.lastmod = args.updatedAt;
    return;
  }
  args.memberships.add(membershipKey);
  if (!previous) {
    args.cityCountyMap.set(args.cityCountyKey, {
      stateCode: args.stateCode,
      citySlug: args.citySlug,
      countyId: args.countyId,
      lastmod: args.updatedAt,
      count: 1,
    });
    return;
  }
  previous.count += 1;
  if (args.updatedAt > previous.lastmod) previous.lastmod = args.updatedAt;
}

export type SeoDirectoryScopeSnapshotResult = {
  directoryBusinesses: number;
  tradeCountyPages: number;
  tradeCityPages: number;
  tradeCityCountyPages: number;
  cityCountyPages: number;
  businessesScanned: number;
};

export async function runSeoDirectoryScopeSnapshotJob(): Promise<SeoDirectoryScopeSnapshotResult> {
  const rules = await getPublicationRules();
  const now = new Date();
  const publicationHorizonNow = new Date(now.getTime() + SEO_DIRECTORY_SNAPSHOT_MAX_AGE_MS);
  const widestBusinessDetailWindowDays = Math.max(
    rules.listingStaleDaysUnclaimed,
    rules.listingStaleDaysClaimedUnverified,
    rules.listingStaleDaysVerified
  );
  const sourceCutoff = new Date(
    now.getTime() - widestBusinessDetailWindowDays * 24 * 60 * 60 * 1000
  );

  const rows = await db
    .select({
      businessId: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      claimStatus: businesses.claimStatus,
      ownerUserId: businesses.ownerUserId,
      updatedAt: businesses.updatedAt,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      profileData: businesses.profileData,
      ownerVerificationStatus: users.verificationStatus,
      ownerAddressVerified: users.addressVerified,
      countyId: counties.id,
      countyName: counties.name,
      countyFips: counties.fips,
      stateCode: counties.stateCode,
    })
    .from(businesses)
    .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
    .innerJoin(counties, eq(counties.id, businessCounties.countyId))
    .leftJoin(users, eq(users.id, businesses.ownerUserId))
    .where(
      and(
        eq(businesses.status, "active" as any),
        eq(businesses.publicDiscoveryEnabled, true as any),
        publicBusinessDetailExposureSqlPredicate(),
        sql`${businesses.updatedAt} >= ${sourceCutoff}`
      )
    )
    .orderBy(desc(businesses.updatedAt), asc(businesses.slug))
    .limit(SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP + 1);

  assertSeoDirectoryScopeSourceCapacity(rows.length);

  type CountyKey = string; // `${tradeSlug}|${countyId}`
  type CityKey = string; // `${tradeSlug}|${stateCode}|${citySlug}`

  const countyMap = new Map<
    CountyKey,
    {
      tradeSlug: string;
      countyId: string;
      stateCode: string;
      countySlug: string;
      lastmod: Date;
      count: number;
    }
  >();
  const cityMap = new Map<CityKey, SeoCityScopeAggregate>();
  const cityBusinessMemberships = new Set<string>();
  const cityCountyMap = new Map<string, SeoCityCountyScopeAggregate>();
  const cityCountyBusinessMemberships = new Set<string>();
  const genericCityCountyMap = new Map<string, SeoGenericCityCountyScopeAggregate>();
  const genericCityCountyBusinessMemberships = new Set<string>();
  const businessMap = new Map<
    string,
    {
      businessId: string;
      slug: string;
      displayName: string;
      tradeSlug: string | null;
      tier: "unclaimed" | "verified";
      claimStatus: string;
      preferredStateCode: string | null;
      publicCity: string | null;
      lastmod: Date;
      counties: Map<string, { id: string; name: string; stateCode: string; fips: string }>;
    }
  >();

  for (const r of rows) {
    const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
    if (!updatedAt) continue;
    const stateCode = String((r as any).stateCode || "").toUpperCase();
    const countyName = String((r as any).countyName || "").trim();
    const countyId = String((r as any).countyId || "").trim();
    if (!stateCode || !countyName || !countyId) continue;
    const businessId = String((r as any).businessId || "").trim();
    const businessSlug = String((r as any).slug || "").trim();
    if (!businessId || !businessSlug || NON_PRODUCTION_PUBLIC_SLUG_PATTERN.test(businessSlug)) {
      continue;
    }

    const profileData: any = (r as any).profileData || {};
    const publicProfile = buildPublicDirectoryProfile(profileData);
    const tradeSlug = deriveTradeSlugFromProfileData(publicProfile);

    const tier = derivePublicationTier({
      ownerUserId: (r as any).ownerUserId ? String((r as any).ownerUserId) : null,
      claimStatus: String((r as any).claimStatus || ""),
      ownerVerificationStatus: (r as any).ownerVerificationStatus
        ? String((r as any).ownerVerificationStatus)
        : null,
      ownerAddressVerified:
        typeof (r as any).ownerAddressVerified === "boolean"
          ? (r as any).ownerAddressVerified
          : null,
    });

    const signals = buildPublicBusinessSignals({
      id: String((r as any).businessId),
      name: sanitizePublicDirectoryDisplayName((r as any).name),
      slug: String((r as any).slug || ""),
      updatedAt,
      publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
      stateCode,
      countyName,
      city: publicProfile.city || null,
      tradeSlug,
      hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
      tier,
    });
    const detailPublication = isPublicAndCrawlableBusinessDetail(
      signals,
      rules,
      publicationHorizonNow
    );
    if (!canServePublicBusinessDetail({ publication: detailPublication, tier })) continue;

    {
      const existing = businessMap.get(businessId);
      const countyRow = {
        id: countyId,
        name: countyName,
        stateCode,
        fips: String((r as any).countyFips || ""),
      };
      if (!existing) {
        businessMap.set(businessId, {
          businessId,
          slug: businessSlug,
          displayName: sanitizePublicDirectoryDisplayName((r as any).name),
          tradeSlug,
          tier: tier as "unclaimed" | "verified",
          claimStatus: String((r as any).claimStatus || "unclaimed")
            .trim()
            .toLowerCase(),
          preferredStateCode: publicProfile.stateCode || null,
          publicCity: publicProfile.city || null,
          lastmod: updatedAt,
          counties: new Map([[countyId, countyRow]]),
        });
      } else {
        existing.counties.set(countyId, countyRow);
        if (updatedAt > existing.lastmod) existing.lastmod = updatedAt;
      }
    }

    if (!tradeSlug) continue;
    const tradePublication = isPublicAndCrawlableBusiness(signals, rules, publicationHorizonNow);
    if (!tradePublication.ok) continue;

    const categoryFresh = isSeoCategoryScopeFresh({
      updatedAt,
      now: publicationHorizonNow,
      categoryPageRecencyWindowDays: rules.categoryPageRecencyWindowDays,
    });

    // Detail pages use their tier-specific 180/365/730-day publication
    // windows. Manufactured trade/location pages use the intentionally
    // narrower category-page window.
    if (!categoryFresh) continue;

    const detailCity = publicProfile.city || "";
    const detailStateCode = String(publicProfile.stateCode || "").toUpperCase();
    const detailCitySlug = detailCity ? normalizePublicCitySlug(detailCity) : "";
    if (detailCitySlug && businessId && detailStateCode === stateCode) {
      recordDistinctSeoGenericCityCountyBusiness({
        cityCountyMap: genericCityCountyMap,
        memberships: genericCityCountyBusinessMemberships,
        cityCountyKey: `${stateCode}|${detailCitySlug}|${countyId}`,
        businessId,
        stateCode,
        citySlug: detailCitySlug,
        countyId,
        updatedAt,
      });
    }

    const countySlug = slugifyCountyName(
      countyName.replace(/\s+County$/i, "").trim() || countyName
    );
    const countyKey = `${tradeSlug}|${countyId}`;
    const countyPrev = countyMap.get(countyKey);
    if (!countyPrev) {
      countyMap.set(countyKey, {
        tradeSlug,
        countyId,
        stateCode,
        countySlug,
        lastmod: updatedAt,
        count: 1,
      });
    } else {
      countyPrev.count += 1;
      if (updatedAt > countyPrev.lastmod) countyPrev.lastmod = updatedAt;
    }

    const rawCity = publicProfile.city || "";
    const businessStateCode = String(publicProfile.stateCode || "")
      .trim()
      .toUpperCase();
    const citySlug = rawCity ? normalizePublicCitySlug(rawCity) : "";
    if (citySlug && businessId && businessStateCode === stateCode) {
      const cityKey = `${tradeSlug}|${stateCode}|${citySlug}`;
      recordDistinctSeoCityBusiness({
        cityMap,
        memberships: cityBusinessMemberships,
        cityKey,
        businessId,
        tradeSlug,
        stateCode,
        citySlug,
        updatedAt,
      });
      recordDistinctSeoCityCountyBusiness({
        cityCountyMap,
        memberships: cityCountyBusinessMemberships,
        cityCountyKey: `${cityKey}|${countyId}`,
        businessId,
        tradeSlug,
        stateCode,
        citySlug,
        countyId,
        updatedAt,
      });
    }
  }

  const countyRows = Array.from(countyMap.values());
  const cityRows = Array.from(cityMap.values());
  const cityCountyRows = Array.from(cityCountyMap.values());
  const genericCityCountyRows = Array.from(genericCityCountyMap.values());
  const businessRows = Array.from(businessMap.values()).flatMap((row) => {
    const orderedCounties = orderPublicDirectoryCounties(
      Array.from(row.counties.values()),
      row.preferredStateCode
    );
    const primaryCounty = orderedCounties[0];
    if (!primaryCounty) return [];
    const citySlug =
      row.publicCity && row.preferredStateCode === primaryCounty.stateCode
        ? normalizePublicCitySlug(row.publicCity) || null
        : null;
    return [
      {
        ...row,
        primaryStateCode: primaryCounty.stateCode,
        citySlug,
        orderedCounties,
      },
    ];
  });
  const businessCountyRows = businessRows.flatMap((row) =>
    row.orderedCounties.map((county, index) => ({
      businessId: row.businessId,
      countyId: String(county.id),
      isPrimary: index === 0,
    }))
  );

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      truncate table
        ts_seo_directory_business_counties,
        ts_seo_directory_business_pages,
        ts_seo_trade_county_pages,
        ts_seo_trade_city_pages,
        ts_seo_trade_city_county_pages,
        ts_seo_city_county_pages;
    `);

    const businessChunkSize = 1500;
    for (let i = 0; i < businessRows.length; i += businessChunkSize) {
      const chunk = businessRows.slice(i, i + businessChunkSize);
      const values = chunk.map(
        (row) =>
          sql`(${row.businessId}, ${row.slug}, ${row.displayName}, ${row.tradeSlug}, ${row.tier}, ${row.claimStatus}, ${row.primaryStateCode}, ${row.citySlug}, ${row.lastmod})`
      );
      await tx.execute(sql`
        insert into ts_seo_directory_business_pages
          (business_id, slug, display_name, trade_slug, tier, claim_status, primary_state_code, city_slug, lastmod)
        values ${sql.join(values, sql`, `)};
      `);
    }

    for (let i = 0; i < businessCountyRows.length; i += businessChunkSize) {
      const chunk = businessCountyRows.slice(i, i + businessChunkSize);
      const values = chunk.map(
        (row) => sql`(${row.businessId}, ${row.countyId}, ${row.isPrimary})`
      );
      await tx.execute(sql`
        insert into ts_seo_directory_business_counties (business_id, county_id, is_primary)
        values ${sql.join(values, sql`, `)};
      `);
    }

    const countyChunkSize = 1000;
    for (let i = 0; i < countyRows.length; i += countyChunkSize) {
      const chunk = countyRows.slice(i, i + countyChunkSize);
      const values = chunk.map((row) => {
        return sql`(${row.tradeSlug}, ${row.countyId}, ${row.stateCode}, ${row.countySlug}, ${row.lastmod}, ${row.count})`;
      });
      await tx.execute(sql`
        insert into ts_seo_trade_county_pages
          (trade_slug, county_id, state_code, county_slug, lastmod, business_count)
        values ${sql.join(values, sql`, `)};
      `);
    }

    const cityChunkSize = 1500;
    for (let i = 0; i < cityRows.length; i += cityChunkSize) {
      const chunk = cityRows.slice(i, i + cityChunkSize);
      const values = chunk.map((row) => {
        return sql`(${row.tradeSlug}, ${row.stateCode}, ${row.citySlug}, ${row.lastmod}, ${row.count})`;
      });
      await tx.execute(sql`
        insert into ts_seo_trade_city_pages
          (trade_slug, state_code, city_slug, lastmod, business_count)
        values ${sql.join(values, sql`, `)};
      `);
    }

    for (let i = 0; i < cityCountyRows.length; i += cityChunkSize) {
      const chunk = cityCountyRows.slice(i, i + cityChunkSize);
      const values = chunk.map(
        (row) =>
          sql`(${row.tradeSlug}, ${row.stateCode}, ${row.citySlug}, ${row.countyId}, ${row.lastmod}, ${row.count})`
      );
      await tx.execute(sql`
        insert into ts_seo_trade_city_county_pages
          (trade_slug, state_code, city_slug, county_id, lastmod, business_count)
        values ${sql.join(values, sql`, `)};
      `);
    }

    for (let i = 0; i < genericCityCountyRows.length; i += cityChunkSize) {
      const chunk = genericCityCountyRows.slice(i, i + cityChunkSize);
      const values = chunk.map(
        (row) =>
          sql`(${row.stateCode}, ${row.citySlug}, ${row.countyId}, ${row.lastmod}, ${row.count})`
      );
      await tx.execute(sql`
        insert into ts_seo_city_county_pages
          (state_code, city_slug, county_id, lastmod, business_count)
        values ${sql.join(values, sql`, `)};
      `);
    }

    // Publish readiness only after all replacement rows succeed. A failed or
    // overflowed run leaves the prior tables and generation marker untouched.
    await tx.execute(sql`
      insert into ts_seo_directory_snapshot_status (
        snapshot_key,
        generation,
        completed_at,
        source_row_count,
        directory_business_count,
        trade_county_page_count,
        trade_city_page_count,
        trade_city_county_page_count,
        city_county_page_count,
        updated_at
      ) values (
        'directory_scope_v1',
        1,
        ${now},
        ${rows.length},
        ${businessRows.length},
        ${countyRows.length},
        ${cityRows.length},
        ${cityCountyRows.length},
        ${genericCityCountyRows.length},
        ${now}
      )
      on conflict (snapshot_key) do update set
        generation = ts_seo_directory_snapshot_status.generation + 1,
        completed_at = excluded.completed_at,
        source_row_count = excluded.source_row_count,
        directory_business_count = excluded.directory_business_count,
        trade_county_page_count = excluded.trade_county_page_count,
        trade_city_page_count = excluded.trade_city_page_count,
        trade_city_county_page_count = excluded.trade_city_county_page_count,
        city_county_page_count = excluded.city_county_page_count,
        updated_at = excluded.updated_at;
    `);
  });

  return {
    directoryBusinesses: businessRows.length,
    tradeCountyPages: countyRows.length,
    tradeCityPages: cityRows.length,
    tradeCityCountyPages: cityCountyRows.length,
    cityCountyPages: genericCityCountyRows.length,
    businessesScanned: rows.length,
  };
}
