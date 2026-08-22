import { Router } from "express";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "../db";
import { businessCounties, businesses, counties, users } from "../../shared/schema";
import { slugifyCountyName } from "../../shared/tradeSeo";
import { getTradeSeoMatch } from "../../shared/tradeSeo";
import { publicBusinessDetailExposureSqlPredicate } from "../publicationBusiness";
import {
  isCanonicalPublicCitySlug,
  normalizePublicCitySlug,
  publicBusinessCitySlugSql,
  publicBusinessStateCodeSql,
} from "../publicCityHtml";

const router = Router();

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStateCode(raw: unknown): string {
  const value = coerceString(raw).toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "";
}

function normalizeCitySlug(raw: unknown): string {
  return isCanonicalPublicCitySlug(raw) ? normalizePublicCitySlug(raw) : "";
}

function titleizeCitySlug(slug: string): string {
  const cleaned = String(slug || "")
    .trim()
    .replace(/-+/g, " ")
    .trim();
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildTradeWhereClause(tradeRaw: unknown) {
  const match = getTradeSeoMatch(tradeRaw);
  if (!match) return null;
  const patterns = match.keywords
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((k) => `%${k.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
  if (!patterns.length) return null;
  return or(...patterns.map((pattern) => sql`${businesses.profileData}::text ILIKE ${pattern}`));
}

// Public (read-only): city → counties facet. This preserves "counties are operational containers"
// by returning links/containers instead of a cross-county business list with actions.
router.get("/api/public/cities/:stateCode/:citySlug", async (req, res) => {
  const stateCode = normalizeStateCode(req.params.stateCode);
  const citySlug = normalizeCitySlug(req.params.citySlug);
  try {
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!citySlug) return res.status(400).json({ message: "Invalid citySlug" });

    const rows = await db
      .select({
        countyFips: counties.fips,
        countyName: counties.name,
        stateCode: counties.stateCode,
        businessCount: sql<number>`count(*)`,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true),
          publicBusinessDetailExposureSqlPredicate(),
          eq(counties.stateCode, stateCode),
          sql`${publicBusinessStateCodeSql()} = ${stateCode}`,
          sql`${publicBusinessCitySlugSql()} = ${citySlug}`
        )
      )
      .groupBy(counties.fips, counties.name, counties.stateCode)
      .orderBy(asc(counties.name))
      .limit(200);

    const countiesOut = rows.map((r) => ({
      countyFips: String(r.countyFips),
      countyName: String(r.countyName),
      stateCode: String(r.stateCode),
      countySlug: slugifyCountyName(
        String(r.countyName)
          .replace(/\s+County$/i, "")
          .trim()
      ),
      businessCount: Number(r.businessCount || 0),
    }));

    res.json({
      citySlug,
      stateCode,
      displayCity: titleizeCitySlug(citySlug),
      counties: countiesOut,
    });
  } catch (error: any) {
    console.warn("City facet degraded; returning empty result set", error);
    res.json({
      citySlug,
      stateCode,
      displayCity: titleizeCitySlug(citySlug),
      counties: [],
      degraded: true,
    });
  }
});

router.get("/api/public/trade-cities/:tradeSlug/:stateCode/:citySlug", async (req, res) => {
  const tradeSlug = coerceString(req.params.tradeSlug);
  const stateCode = normalizeStateCode(req.params.stateCode);
  const citySlug = normalizeCitySlug(req.params.citySlug);
  try {
    if (!tradeSlug) return res.status(400).json({ message: "Invalid tradeSlug" });
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!citySlug) return res.status(400).json({ message: "Invalid citySlug" });

    const tradeClause = buildTradeWhereClause(tradeSlug);
    if (!tradeClause) return res.status(404).json({ message: "Trade not found" });

    const rows = await db
      .select({
        countyFips: counties.fips,
        countyName: counties.name,
        stateCode: counties.stateCode,
        businessCount: sql<number>`count(*)`,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(
        and(
          eq(businesses.status, "active" as any),
          eq(businesses.publicDiscoveryEnabled, true),
          publicBusinessDetailExposureSqlPredicate(),
          eq(counties.stateCode, stateCode),
          sql`${publicBusinessStateCodeSql()} = ${stateCode}`,
          sql`${publicBusinessCitySlugSql()} = ${citySlug}`,
          tradeClause
        )
      )
      .groupBy(counties.fips, counties.name, counties.stateCode)
      .orderBy(asc(counties.name))
      .limit(200);

    const countiesOut = rows.map((r) => ({
      countyFips: String(r.countyFips),
      countyName: String(r.countyName),
      stateCode: String(r.stateCode),
      countySlug: slugifyCountyName(
        String(r.countyName)
          .replace(/\s+County$/i, "")
          .trim()
      ),
      businessCount: Number(r.businessCount || 0),
    }));

    res.json({
      tradeSlug,
      stateCode,
      citySlug,
      displayCity: titleizeCitySlug(citySlug),
      counties: countiesOut,
    });
  } catch (error: any) {
    console.warn("Trade-city facet degraded; returning empty result set", error);
    res.json({
      tradeSlug,
      stateCode,
      citySlug,
      displayCity: titleizeCitySlug(citySlug),
      counties: [],
      degraded: true,
    });
  }
});

export { router as cityPublicRouter };
