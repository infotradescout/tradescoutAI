import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { businessCounties, businesses, counties, users } from "@shared/schema";
import { slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "../publicationRules";
import { isPublicAndCrawlableBusiness } from "@shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
  publicBusinessDetailExposureSqlPredicate,
} from "../publicationBusiness";
import { normalizePublicCitySlug } from "../publicCityHtml";

export type SeoDirectoryScopeSnapshotResult = {
  tradeCountyPages: number;
  tradeCityPages: number;
  businessesScanned: number;
};

export async function ensureSeoDirectoryScopeSnapshotTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ts_seo_trade_county_pages (
      trade_slug varchar(128) NOT NULL,
      county_id varchar REFERENCES counties(id) ON DELETE CASCADE,
      state_code varchar(2) NOT NULL,
      county_slug varchar(128) NOT NULL,
      lastmod timestamptz NOT NULL,
      business_count integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (trade_slug, county_id)
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ts_seo_trade_city_pages (
      trade_slug varchar(128) NOT NULL,
      state_code varchar(2) NOT NULL,
      city_slug varchar(128) NOT NULL,
      lastmod timestamptz NOT NULL,
      business_count integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (trade_slug, state_code, city_slug)
    );
  `);
}

export async function runSeoDirectoryScopeSnapshotJob(): Promise<SeoDirectoryScopeSnapshotResult> {
  await ensureSeoDirectoryScopeSnapshotTables();
  const rules = await getPublicationRules();
  const now = new Date();
  const recencyCutoff = new Date(
    now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
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
        sql`${businesses.updatedAt} >= ${recencyCutoff}`
      )
    )
    .orderBy(desc(businesses.updatedAt), asc(businesses.slug))
    .limit(350_000);

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
  const cityMap = new Map<
    CityKey,
    { tradeSlug: string; stateCode: string; citySlug: string; lastmod: Date; count: number }
  >();

  for (const r of rows) {
    const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
    if (!updatedAt) continue;
    const stateCode = String((r as any).stateCode || "").toUpperCase();
    const countyName = String((r as any).countyName || "").trim();
    const countyId = String((r as any).countyId || "").trim();
    if (!stateCode || !countyName || !countyId) continue;

    const profileData: any = (r as any).profileData || {};
    const tradeSlug = deriveTradeSlugFromProfileData(profileData);
    if (!tradeSlug) continue;

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

    const pub = isPublicAndCrawlableBusiness(
      buildPublicBusinessSignals({
        id: String((r as any).businessId),
        name: String((r as any).name || ""),
        slug: String((r as any).slug || ""),
        updatedAt,
        publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
        stateCode,
        countyName,
        city: typeof profileData.city === "string" ? profileData.city : null,
        tradeSlug,
        tier,
      }),
      rules,
      now
    );
    if (!canServePublicBusinessDetail({ publication: pub, tier })) continue;

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

    const rawCity = typeof profileData.city === "string" ? profileData.city.trim() : "";
    const importExtras =
      profileData.importExtras && typeof profileData.importExtras === "object"
        ? profileData.importExtras
        : {};
    const businessStateCode = String(profileData.stateCode || importExtras.state_code || "")
      .trim()
      .toUpperCase();
    const citySlug = rawCity ? normalizePublicCitySlug(rawCity) : "";
    // County assignment remains the operational container, but a city page is
    // publishable only when the business explicitly places that city in the
    // same state. This prevents impossible city/state combinations.
    if (citySlug && businessStateCode === stateCode) {
      const cityKey = `${tradeSlug}|${stateCode}|${citySlug}`;
      const cityPrev = cityMap.get(cityKey);
      if (!cityPrev) {
        cityMap.set(cityKey, {
          tradeSlug,
          stateCode,
          citySlug,
          lastmod: updatedAt,
          count: 1,
        });
      } else {
        cityPrev.count += 1;
        if (updatedAt > cityPrev.lastmod) cityPrev.lastmod = updatedAt;
      }
    }
  }

  const countyRows = Array.from(countyMap.values());
  const cityRows = Array.from(cityMap.values());

  await db.transaction(async (tx) => {
    await tx.execute(sql`truncate table ts_seo_trade_county_pages;`);
    await tx.execute(sql`truncate table ts_seo_trade_city_pages;`);

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
  });

  return {
    tradeCountyPages: countyRows.length,
    tradeCityPages: cityRows.length,
    businessesScanned: rows.length,
  };
}
