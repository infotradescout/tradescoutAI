import { Router } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  businesses,
  businessCounties,
  businessSuggestions,
  counties,
  tsPublicActivity,
  users,
  type Business,
} from "../../shared/schema";
import { storage } from "../storage";
import { getTradeSeoMatch, normalizeTradeSlug, slugifyCountyName } from "../../shared/tradeSeo";
import { US_STATES_COUNTIES } from "../../shared/states-counties";
import { getPublicationRules } from "../publicationRules";
import {
  isPublicAndCrawlableActivity,
  isPublicAndCrawlableBusiness,
} from "../../shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
  publicBusinessDetailExposureSqlPredicate,
} from "../publicationBusiness";
import { sqlDirectoryCitySlugExpr } from "../seoDirectoryCitySlug";
import {
  listActiveCountyTradeScopes,
  listActiveTradeCountyScopes,
  listActiveTradeScopes,
  listActiveTradeStateScopes,
} from "../services/seoDirectoryNavigationService";

const router = Router();

// Simple in-memory cache for public directory lookups
const PUBLIC_CACHE = new Map();
const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(path: string, params: Record<string, any>) {
  // Only cache safe, public GETs
  const keys = Object.keys(params).sort();
  return `${path}::${keys.map((k) => `${k}=${String(params[k])}`).join("&")}`;
}

function getCachedOrCompute(
  path: string,
  params: Record<string, any>,
  compute: () => Promise<any>
) {
  const key = getCacheKey(path, params);
  const now = Date.now();
  const cached = PUBLIC_CACHE.get(key);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  return compute().then((value) => {
    PUBLIC_CACHE.set(key, { value, expiresAt: now + PUBLIC_CACHE_TTL_MS });
    return value;
  });
}

function isAuthed(req: any): boolean {
  try {
    if (typeof req?.isAuthenticated === "function") return Boolean(req.isAuthenticated());
  } catch {
    // ignore
  }
  return Boolean(req?.user);
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCountyFips(raw: unknown): string {
  const value = coerceString(raw);
  return /^\d{5}$/.test(value) ? value : "";
}

function normalizeStateCode(raw: unknown): string {
  const value = coerceString(raw).toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "";
}

function normalizeClaimed(raw: unknown): "claimed" | "unclaimed" | "any" {
  const value = coerceString(raw).toLowerCase();
  if (!value) return "unclaimed";
  if (value === "any" || value === "all") return "any";
  if (value === "claimed" || value === "true" || value === "1" || value === "yes") return "claimed";
  if (value === "unclaimed" || value === "false" || value === "0" || value === "no")
    return "unclaimed";
  return "unclaimed";
}

function toPublicProfile(profileData: Business["profileData"] | null | undefined) {
  const raw = profileData && typeof profileData === "object" ? (profileData as any) : {};
  const importExtras =
    raw.importExtras && typeof raw.importExtras === "object" ? (raw.importExtras as any) : {};
  const averageRating =
    typeof importExtras.average_rating === "string" ||
    typeof importExtras.average_rating === "number"
      ? Number(importExtras.average_rating)
      : null;
  const reviewCount =
    typeof importExtras.review_count === "string" || typeof importExtras.review_count === "number"
      ? Number(importExtras.review_count)
      : null;
  const safeAverageRating = Number.isFinite(averageRating) ? Number(averageRating) : null;
  const safeReviewCount = Number.isFinite(reviewCount)
    ? Math.max(0, Math.trunc(Number(reviewCount)))
    : null;
  return {
    tagline: typeof raw.tagline === "string" ? raw.tagline : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    services: Array.isArray(raw.services)
      ? raw.services.filter((s: any) => typeof s === "string")
      : undefined,
    city: typeof raw.city === "string" ? raw.city : undefined,
    stateCode: typeof raw.stateCode === "string" ? raw.stateCode : undefined,
    address: typeof raw.address === "string" ? raw.address : undefined,
    zipCode: typeof raw.zipCode === "string" ? raw.zipCode : undefined,
    importExtras: {
      countyFips:
        typeof importExtras.county_fips === "string" ? importExtras.county_fips : undefined,
      countyName:
        typeof importExtras.county_name === "string" ? importExtras.county_name : undefined,
      averageRating: safeAverageRating,
      reviewCount: safeReviewCount,
      googleMapsUrl:
        typeof importExtras.google_maps_url === "string" ? importExtras.google_maps_url : undefined,
      reviewUrl: typeof importExtras.review_url === "string" ? importExtras.review_url : undefined,
      source: "google_import",
    },
  };
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

// Public-safe directory list. Never exposes direct contact vectors.
router.get("/api/businesses", async (req, res, next) => {
  const forcePublicView = String(req.query.public || "") === "1";
  if (isAuthed(req) && !forcePublicView) return next();

  // Only cache safe, public GETs (no user context)
  const cacheParams = {
    countyFips: req.query.countyFips ?? req.query.county ?? req.query.county_fips,
    stateCode: req.query.stateCode ?? req.query.state ?? req.query.state_code,
    claimed: req.query.claimed,
    q: req.query.q ?? req.query.search,
    trade: req.query.trade ?? req.query.tradeSlug ?? req.query.trade_slug,
    city: req.query.city ?? req.query.cityName ?? req.query.city_name,
    limit: req.query.limit ?? 25,
    offset: req.query.offset ?? 0,
  };

  await getCachedOrCompute("/api/businesses", cacheParams, async () => {
    try {
      const countyFips = normalizeCountyFips(cacheParams.countyFips);
      const stateCode = normalizeStateCode(cacheParams.stateCode);
      const claimed = normalizeClaimed(cacheParams.claimed);
      const q = coerceString(cacheParams.q);
      const trade = coerceString(cacheParams.trade);
      const city = coerceString(cacheParams.city);
      const limitRaw = Number(cacheParams.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 25;
      const offsetRaw = Number(cacheParams.offset);
      const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.min(5_000, offsetRaw)) : 0;

      if (!countyFips && !stateCode) {
        return res
          .status(400)
          .json({ message: "countyFips or stateCode is required for public business search" });
      }
      if (stateCode && !/^[A-Z]{2}$/.test(stateCode)) {
        return res.status(400).json({ message: "stateCode must be a 2-letter code (e.g., FL)" });
      }

      const whereClauses: any[] = [
        eq(businesses.status, "active" as any),
        publicBusinessDetailExposureSqlPredicate(),
      ];
      if (countyFips) whereClauses.push(eq(counties.fips, countyFips));
      if (stateCode) whereClauses.push(eq(counties.stateCode, stateCode));
      if (claimed !== "any") whereClauses.push(eq(businesses.claimStatus, claimed));
      if (q) whereClauses.push(ilike(businesses.name, `%${q}%`));

      const tradeClause = trade ? buildTradeWhereClause(trade) : null;
      if (tradeClause) whereClauses.push(tradeClause);

      if (city) {
        const needle = `%${city.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
        whereClauses.push(sql`coalesce(${businesses.profileData} ->> 'city', '') ILIKE ${needle}`);
      }

      const rows = await db
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          type: businesses.type,
          roleContext: businesses.roleContext,
          claimStatus: businesses.claimStatus,
          status: businesses.status,
          updatedAt: businesses.updatedAt,
          ownerUserId: businesses.ownerUserId,
          profileData: businesses.profileData,
          publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
          ownerVerificationStatus: users.verificationStatus,
          ownerAddressVerified: users.addressVerified,
          county: {
            fips: counties.fips,
            stateCode: counties.stateCode,
            name: counties.name,
          },
        })
        .from(businesses)
        .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
        .innerJoin(counties, eq(counties.id, businessCounties.countyId))
        .leftJoin(users, eq(users.id, businesses.ownerUserId))
        .where(and(...whereClauses))
        .orderBy(businesses.name)
        .limit(limit)
        .offset(offset);

      const rules = await getPublicationRules();
      const now = new Date();

      const grouped = new Map<string, any>();
      for (const row of rows) {
        const key = row.id;
        const existing = grouped.get(key);
        const county = row.county;
        if (!existing) {
          const profileData: any = (row as any).profileData || {};
          const tradeSlug = deriveTradeSlugFromProfileData(profileData);
          const city = typeof profileData.city === "string" ? profileData.city : null;
          const tier = derivePublicationTier({
            ownerUserId: (row as any).ownerUserId ? String((row as any).ownerUserId) : null,
            claimStatus: String((row as any).claimStatus || ""),
            ownerVerificationStatus: (row as any).ownerVerificationStatus
              ? String((row as any).ownerVerificationStatus)
              : null,
            ownerAddressVerified:
              typeof (row as any).ownerAddressVerified === "boolean"
                ? (row as any).ownerAddressVerified
                : null,
          });
          const signals = buildPublicBusinessSignals({
            id: String(row.id),
            name: String(row.name),
            slug: String(row.slug),
            updatedAt: (row as any).updatedAt instanceof Date ? (row as any).updatedAt : new Date(),
            publicDiscoveryEnabled: Boolean((row as any).publicDiscoveryEnabled),
            stateCode: county?.stateCode ? String(county.stateCode) : null,
            countyName: county?.name ? String(county.name) : null,
            city,
            tradeSlug,
            tier,
          });
          const pub = isPublicAndCrawlableBusiness(signals, rules, now);
          if (!canServePublicBusinessDetail({ publication: pub, tier })) {
            continue;
          }
          grouped.set(key, {
            id: row.id,
            name: row.name,
            slug: row.slug,
            type: row.type,
            roleContext: row.roleContext,
            claimStatus: row.claimStatus,
            status: row.status,
            counties: county ? [county] : [],
          });
        } else if (county && !existing.counties.some((c: any) => c?.fips === county.fips)) {
          existing.counties.push(county);
        }
      }

      const items = Array.from(grouped.values());
      res.json({
        items,
        countyFips,
        stateCode: stateCode || null,
        claimed,
        q,
        trade: trade || null,
        city: city || null,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("Error listing public businesses:", error);
      res.status(500).json({ message: "Failed to list businesses" });
    }
  });
});

// Public-safe directory detail by id (matches owner route path, but only handles unauth requests).
router.get("/api/businesses/:id", async (req, res, next) => {
  try {
    if (isAuthed(req)) return next();

    const businessId = coerceString(req.params.id);
    if (!businessId) return res.status(400).json({ message: "Invalid business id" });

    const rows = await db
      .select({
        id: businesses.id,
        ownerUserId: businesses.ownerUserId,
        name: businesses.name,
        slug: businesses.slug,
        type: businesses.type,
        roleContext: businesses.roleContext,
        status: businesses.status,
        claimStatus: businesses.claimStatus,
        profileData: businesses.profileData,
        updatedAt: businesses.updatedAt,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        ownerVerificationStatus: users.verificationStatus,
        ownerAddressVerified: users.addressVerified,
        county: {
          fips: counties.fips,
          stateCode: counties.stateCode,
          name: counties.name,
        },
      })
      .from(businesses)
      .leftJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .leftJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(eq(businesses.id, businessId));

    if (!rows.length) return res.status(404).json({ message: "Business not found" });
    const first = rows[0];
    if (first.status !== ("active" as any))
      return res.status(404).json({ message: "Business not found" });

    const countiesList = rows
      .map((r) => r.county)
      .filter(Boolean)
      .reduce((acc: any[], c: any) => {
        if (!acc.some((x) => x?.fips === c.fips)) acc.push(c);
        return acc;
      }, []);

    const rules = await getPublicationRules();
    const now = new Date();
    const profileData: any = (first as any).profileData || {};
    const tradeSlug = deriveTradeSlugFromProfileData(profileData);
    const city = typeof profileData.city === "string" ? profileData.city : null;
    const tier = derivePublicationTier({
      ownerUserId: (first as any).ownerUserId ? String((first as any).ownerUserId) : null,
      claimStatus: String((first as any).claimStatus || ""),
      ownerVerificationStatus: (first as any).ownerVerificationStatus
        ? String((first as any).ownerVerificationStatus)
        : null,
      ownerAddressVerified:
        typeof (first as any).ownerAddressVerified === "boolean"
          ? (first as any).ownerAddressVerified
          : null,
    });
    const countyPrimary = countiesList[0] || null;
    const pub = isPublicAndCrawlableBusiness(
      buildPublicBusinessSignals({
        id: String((first as any).id),
        name: String((first as any).name || ""),
        slug: String((first as any).slug || ""),
        updatedAt: (first as any).updatedAt instanceof Date ? (first as any).updatedAt : new Date(),
        publicDiscoveryEnabled: Boolean((first as any).publicDiscoveryEnabled),
        stateCode: countyPrimary?.stateCode ? String(countyPrimary.stateCode) : null,
        countyName: countyPrimary?.name ? String(countyPrimary.name) : null,
        city,
        tradeSlug,
        tier,
      }),
      rules,
      now
    );
    if (
      !canServePublicBusinessDetail({
        publication: pub,
        tier,
      })
    ) {
      return res.status(410).json({ message: "Listing inactive/out of date" });
    }

    res.json({
      id: first.id,
      name: first.name,
      slug: first.slug,
      type: first.type,
      roleContext: first.roleContext,
      status: first.status,
      claimStatus: first.claimStatus,
      profile: toPublicProfile(first.profileData),
      counties: countiesList,
      publication: {
        crawlable: pub.ok,
        reason: pub.reason || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching public business:", error);
    res.status(500).json({ message: "Failed to fetch business" });
  }
});

// Public-safe directory detail by slug for /business/:slug fallback pages.
router.get("/api/public/businesses/:slug", async (req, res) => {
  try {
    const businessSlug = coerceString(req.params.slug);
    if (!businessSlug) return res.status(400).json({ message: "Invalid business slug" });

    const rows = await db
      .select({
        id: businesses.id,
        ownerUserId: businesses.ownerUserId,
        name: businesses.name,
        slug: businesses.slug,
        type: businesses.type,
        roleContext: businesses.roleContext,
        status: businesses.status,
        claimStatus: businesses.claimStatus,
        profileData: businesses.profileData,
        updatedAt: businesses.updatedAt,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        ownerVerificationStatus: users.verificationStatus,
        ownerAddressVerified: users.addressVerified,
        county: {
          fips: counties.fips,
          stateCode: counties.stateCode,
          name: counties.name,
        },
      })
      .from(businesses)
      .leftJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .leftJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(eq(businesses.slug, businessSlug));

    if (!rows.length) return res.status(404).json({ message: "Business not found" });
    const first = rows[0];
    if (first.status !== ("active" as any)) {
      return res.status(404).json({ message: "Business not found" });
    }

    const countiesList = rows
      .map((r) => r.county)
      .filter(Boolean)
      .reduce((acc: any[], c: any) => {
        if (!acc.some((x) => x?.fips === c.fips)) acc.push(c);
        return acc;
      }, []);

    const rules = await getPublicationRules();
    const now = new Date();
    const profileData: any = (first as any).profileData || {};
    const tradeSlug = deriveTradeSlugFromProfileData(profileData);
    const city = typeof profileData.city === "string" ? profileData.city : null;
    const tier = derivePublicationTier({
      ownerUserId: (first as any).ownerUserId ? String((first as any).ownerUserId) : null,
      claimStatus: String((first as any).claimStatus || ""),
      ownerVerificationStatus: (first as any).ownerVerificationStatus
        ? String((first as any).ownerVerificationStatus)
        : null,
      ownerAddressVerified:
        typeof (first as any).ownerAddressVerified === "boolean"
          ? (first as any).ownerAddressVerified
          : null,
    });
    const countyPrimary = countiesList[0] || null;
    const pub = isPublicAndCrawlableBusiness(
      buildPublicBusinessSignals({
        id: String((first as any).id),
        name: String((first as any).name || ""),
        slug: String((first as any).slug || ""),
        updatedAt: (first as any).updatedAt instanceof Date ? (first as any).updatedAt : new Date(),
        publicDiscoveryEnabled: Boolean((first as any).publicDiscoveryEnabled),
        stateCode: countyPrimary?.stateCode ? String(countyPrimary.stateCode) : null,
        countyName: countyPrimary?.name ? String(countyPrimary.name) : null,
        city,
        tradeSlug,
        tier,
      }),
      rules,
      now
    );
    if (
      !canServePublicBusinessDetail({
        publication: pub,
        tier,
      })
    ) {
      return res.status(410).json({ message: "Listing inactive/out of date" });
    }

    res.json({
      id: first.id,
      name: first.name,
      slug: first.slug,
      type: first.type,
      roleContext: first.roleContext,
      status: first.status,
      claimStatus: first.claimStatus,
      profile: toPublicProfile(first.profileData),
      counties: countiesList,
      publication: {
        crawlable: pub.ok,
        reason: pub.reason || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching public business by slug:", error);
    res.status(500).json({ message: "Failed to fetch business" });
  }
});

// Public: Suggest an edit or request removal (creates an admin queue item).
router.post("/api/businesses/:id/suggest-edit", async (req, res) => {
  try {
    const businessId = coerceString(req.params.id);
    if (!businessId) return res.status(400).json({ message: "Invalid business id" });

    const kindRaw = coerceString((req.body as any)?.kind).toLowerCase();
    const kind = kindRaw === "removal" ? "removal" : "edit";
    const message = coerceString((req.body as any)?.message).slice(0, 4000);
    const fields = (req.body as any)?.fields;

    // Ensure business exists (avoid orphan queue rows).
    const biz = await db
      .select({ id: businesses.id, status: businesses.status })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz[0] || biz[0].status === ("suspended" as any)) {
      return res.status(404).json({ message: "Business not found" });
    }

    const userId = (req as any)?.user?.id || (req as any)?.user?.claims?.sub || null;
    const payload: Record<string, any> = {
      message: message || null,
      fields: typeof fields === "object" && fields ? fields : null,
      meta: {
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        requestId: (req as any)?.requestId || null,
      },
    };

    const inserted = await db
      .insert(businessSuggestions)
      .values({
        businessId,
        kind: kind as any,
        status: "open" as any,
        payload,
        createdByUserId: userId ? String(userId) : null,
        updatedAt: new Date(),
      } as any)
      .returning({ id: businessSuggestions.id });

    res.status(201).json({ ok: true, suggestionId: inserted[0]?.id || null });
  } catch (error: any) {
    console.error("Error creating business suggestion:", error);
    res.status(500).json({ message: "Failed to create suggestion" });
  }
});

function normalizeClaimEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeClaimPhone(value: unknown): string {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function normalizeClaimWebsiteDomain(value: unknown): string {
  if (typeof value !== "string") return "";
  let raw = value.trim().toLowerCase();
  if (!raw) return "";
  try {
    if (!raw.includes("://")) raw = `https://${raw}`;
    const parsed = new URL(raw);
    return parsed.hostname
      .replace(/^www\./, "")
      .replace(/\.$/, "")
      .trim();
  } catch {
    return "";
  }
}

function getEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase();
}

// Public: returns which verification methods are possible for this listing (no PII).
router.post("/api/businesses/:id/claim/start", async (req, res) => {
  try {
    const businessId = coerceString(req.params.id);
    if (!businessId) return res.status(400).json({ message: "Invalid business id" });

    const rows = await db
      .select({
        id: businesses.id,
        ownerUserId: businesses.ownerUserId,
        claimStatus: businesses.claimStatus,
        status: businesses.status,
        profileData: businesses.profileData,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    const biz = rows[0] as any;
    if (!biz || biz.status === "suspended")
      return res.status(404).json({ message: "Business not found" });
    if (biz.ownerUserId || biz.claimStatus !== "unclaimed") {
      return res.status(409).json({ message: "Business already claimed" });
    }

    const bizEmail = normalizeClaimEmail(biz.profileData?.email);
    const bizPhone = normalizeClaimPhone(biz.profileData?.phone);
    const bizWebsiteDomain = normalizeClaimWebsiteDomain(biz.profileData?.website);

    const methods: Array<{ method: string; requiresLogin: boolean }> = [];
    if (bizEmail) methods.push({ method: "email_match", requiresLogin: true });
    if (bizPhone) methods.push({ method: "phone_match", requiresLogin: true });
    if (bizWebsiteDomain) methods.push({ method: "website_domain_match", requiresLogin: true });

    // Always allow a manual review request via suggestions queue.
    methods.push({ method: "manual_request", requiresLogin: false });

    res.json({ businessId, methods });
  } catch (error: any) {
    console.error("Error starting business claim:", error);
    res.status(500).json({ message: "Failed to start claim" });
  }
});

// Auth: verify selected method and flip claimStatus to claimed (never without verification).
router.post("/api/businesses/:id/claim/verify", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const businessId = coerceString(req.params.id);
    if (!businessId) return res.status(400).json({ message: "Invalid business id" });

    const methodRaw = coerceString((req.body as any)?.method).toLowerCase();
    const method =
      methodRaw === "email_match" ||
      methodRaw === "phone_match" ||
      methodRaw === "website_domain_match"
        ? methodRaw
        : "auto";

    const user = await storage.getUser(String(userId));
    if (!user) return res.status(404).json({ message: "User not found" });

    const rows = await db
      .select({
        id: businesses.id,
        slug: businesses.slug,
        ownerUserId: businesses.ownerUserId,
        claimStatus: businesses.claimStatus,
        status: businesses.status,
        profileData: businesses.profileData,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    const biz = rows[0] as any;
    if (!biz || biz.status === "suspended")
      return res.status(404).json({ message: "Business not found" });
    if (biz.ownerUserId || biz.claimStatus !== "unclaimed") {
      return res.status(409).json({ message: "Business already claimed" });
    }

    const signupEmail = normalizeClaimEmail((user as any).email);
    const signupPhone = normalizeClaimPhone((user as any).phone);
    const signupEmailDomain = getEmailDomain(signupEmail);

    const bizEmail = normalizeClaimEmail(biz.profileData?.email);
    const bizPhone = normalizeClaimPhone(biz.profileData?.phone);
    const bizWebsiteDomain = normalizeClaimWebsiteDomain(biz.profileData?.website);

    const checks = {
      email_match: Boolean(bizEmail) && bizEmail === signupEmail,
      phone_match: Boolean(bizPhone) && bizPhone.length >= 10 && bizPhone === signupPhone,
      website_domain_match: Boolean(bizWebsiteDomain) && bizWebsiteDomain === signupEmailDomain,
    };

    const verified =
      method === "auto"
        ? checks.email_match || checks.phone_match || checks.website_domain_match
        : (checks as any)[method] === true;

    if (!verified) {
      return res.status(403).json({
        message: "Claim requires verification. No verification method succeeded.",
        code: "CLAIM_NOT_VERIFIED",
        attempted: method === "auto" ? Object.keys(checks) : [method],
      });
    }

    const claimed = await storage.claimUnclaimedBusinessForUser(biz.id, String(userId));
    await storage.updateUser(String(userId), {
      activeBusinessId: biz.id,
      role: "business_owner" as any,
      activeRole: "business_owner",
      roles: Array.from(
        new Set([
          ...(Array.isArray((user as any).roles) ? (user as any).roles : []),
          "business_owner",
        ])
      ),
      updatedAt: new Date(),
    } as any);

    res.json({ status: "claimed", businessId: claimed.id, slug: claimed.slug });
  } catch (error: any) {
    console.error("Error verifying business claim:", error);
    res.status(500).json({ message: "Failed to verify claim" });
  }
});

// Public: manual review request (no claim flip).
router.post("/api/businesses/:id/claim/request", async (req, res) => {
  try {
    const businessId = coerceString(req.params.id);
    if (!businessId) return res.status(400).json({ message: "Invalid business id" });

    const message = coerceString((req.body as any)?.message).slice(0, 4000);
    const contactEmail = normalizeClaimEmail((req.body as any)?.email);
    const contactPhone = normalizeClaimPhone((req.body as any)?.phone);

    const biz = await db
      .select({ id: businesses.id, status: businesses.status })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz[0] || biz[0].status === ("suspended" as any)) {
      return res.status(404).json({ message: "Business not found" });
    }

    const userId = (req as any)?.user?.id || (req as any)?.user?.claims?.sub || null;
    const payload: Record<string, any> = {
      message: message || null,
      contact: {
        email: contactEmail || null,
        phone: contactPhone || null,
      },
      meta: {
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        requestId: (req as any)?.requestId || null,
      },
    };

    const inserted = await db
      .insert(businessSuggestions)
      .values({
        businessId,
        kind: "edit" as any,
        status: "open" as any,
        payload: { ...payload, kind: "claim_manual_request" },
        createdByUserId: userId ? String(userId) : null,
        updatedAt: new Date(),
      } as any)
      .returning({ id: businessSuggestions.id });

    res.status(201).json({ ok: true, requestId: inserted[0]?.id || null });
  } catch (error: any) {
    console.error("Error requesting manual claim:", error);
    res.status(500).json({ message: "Failed to request claim review" });
  }
});

function resolveCountyFipsBySlug(
  stateCodeRaw: unknown,
  countySlugRaw: unknown
): {
  fips: string;
  countyName: string;
  stateCode: string;
  countySlug: string;
} | null {
  const stateCode = coerceString(stateCodeRaw).toUpperCase();
  const countySlug = coerceString(countySlugRaw).toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(countySlug)) return null;
  const state = US_STATES_COUNTIES.find(
    (s) => String((s as any).code || "").toUpperCase() === stateCode
  );
  if (!state) return null;
  const county =
    (state as any).counties?.find((c: any) => {
      const name = String(c?.name || "");
      const slug = slugifyCountyName(name.replace(/\s+County$/i, "").trim() || name);
      return slug === countySlug;
    }) || null;
  if (!county) return null;
  const fips = String((county as any).fipsCode || "").trim();
  if (!/^[0-9]{5}$/.test(fips)) return null;
  return { fips, countyName: String((county as any).name || ""), stateCode, countySlug };
}

// Public-safe crawl navigation. Every returned link is backed by the same
// recent, publishable scope snapshot used by the directory sitemaps.
router.get("/api/public/seo/directory-navigation", async (req, res) => {
  const cacheParams = {
    tradeSlug: req.query.tradeSlug ?? req.query.trade,
    stateCode: req.query.stateCode ?? req.query.state,
    countySlug: req.query.countySlug ?? req.query.county,
  };

  const result = await getCachedOrCompute(
    "/api/public/seo/directory-navigation",
    cacheParams,
    async () => {
      try {
        const rawTradeSlug = coerceString(cacheParams.tradeSlug);
        const tradeMatch = rawTradeSlug ? getTradeSeoMatch(rawTradeSlug) : null;
        const tradeSlug = tradeMatch ? normalizeTradeSlug(tradeMatch.canonicalSlug) : "";
        const stateCode = normalizeStateCode(cacheParams.stateCode);
        const countySlug = coerceString(cacheParams.countySlug).toLowerCase();

        if (rawTradeSlug && !tradeSlug) {
          return { status: 400, body: { message: "Invalid tradeSlug" } };
        }

        if (!rawTradeSlug && !stateCode && !countySlug) {
          const trades = await listActiveTradeScopes();
          return { status: 200, body: { scope: "trades", trades } };
        }

        if (tradeSlug && !stateCode && !countySlug) {
          const states = await listActiveTradeStateScopes(tradeSlug);
          return { status: 200, body: { scope: "trade-states", tradeSlug, states } };
        }

        if (tradeSlug && stateCode && !countySlug) {
          const counties = await listActiveTradeCountyScopes(tradeSlug, stateCode);
          return {
            status: 200,
            body: { scope: "trade-counties", tradeSlug, stateCode, counties },
          };
        }

        if (!tradeSlug && stateCode && /^[a-z0-9-]+$/.test(countySlug)) {
          const county = resolveCountyFipsBySlug(stateCode, countySlug);
          if (!county) {
            return { status: 400, body: { message: "Invalid stateCode/countySlug" } };
          }
          const trades = await listActiveCountyTradeScopes(stateCode, countySlug);
          return {
            status: 200,
            body: { scope: "county-trades", stateCode, countySlug, trades },
          };
        }

        return { status: 400, body: { message: "Invalid directory navigation scope" } };
      } catch (error: any) {
        console.warn("SEO directory navigation degraded; returning no crawl links", error);
        return {
          status: 200,
          body: { scope: "degraded", trades: [], states: [], counties: [], degraded: true },
        };
      }
    }
  );

  return res.status(result.status).json(result.body);
});

// Public safe: supports SPA rendering for /best/* pages (crawlers see SSR).
router.get("/api/public/seo/best/trade-county", async (req, res) => {
  // Only cache safe, public GETs (no user context)
  const cacheParams = {
    tradeSlug: req.query.tradeSlug ?? req.query.trade,
    stateCode: req.query.stateCode ?? req.query.state,
    countySlug: req.query.countySlug ?? req.query.county,
  };

  await getCachedOrCompute("/api/public/seo/best/trade-county", cacheParams, async () => {
    try {
      const match = getTradeSeoMatch(cacheParams.tradeSlug);
      if (!match) return res.status(400).json({ message: "Invalid tradeSlug" });

      const county = resolveCountyFipsBySlug(cacheParams.stateCode, cacheParams.countySlug);
      if (!county) return res.status(400).json({ message: "Invalid stateCode/countySlug" });

      const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);
      const tradeClause = buildTradeWhereClause(canonicalTradeSlug);

      const rules = await getPublicationRules();
      const now = new Date();
      const recencyCutoff = new Date(
        now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
      );

      const whereClauses: any[] = [
        eq(businesses.status, "active" as any),
        eq(businesses.publicDiscoveryEnabled, true as any),
        publicBusinessDetailExposureSqlPredicate(),
        eq(counties.fips, county.fips),
        sql`${businesses.updatedAt} >= ${recencyCutoff}`,
      ];
      if (tradeClause) whereClauses.push(tradeClause);

      const rows = await db
        .select({
          id: businesses.id,
          slug: businesses.slug,
          name: businesses.name,
          claimStatus: businesses.claimStatus,
          ownerUserId: businesses.ownerUserId,
          updatedAt: businesses.updatedAt,
          publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
          ownerVerificationStatus: users.verificationStatus,
          ownerAddressVerified: users.addressVerified,
        })
        .from(businesses)
        .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
        .innerJoin(counties, eq(counties.id, businessCounties.countyId))
        .leftJoin(users, eq(users.id, businesses.ownerUserId))
        .where(and(...whereClauses))
        .orderBy(desc(businesses.updatedAt), asc(businesses.name))
        .limit(250);

      const items = rows
        .map((r) => {
          const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
          if (!updatedAt) return null;
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
          if (tier !== "verified") return null;
          const pub = isPublicAndCrawlableBusiness(
            buildPublicBusinessSignals({
              id: String((r as any).id),
              name: String((r as any).name || ""),
              slug: String((r as any).slug || ""),
              updatedAt,
              publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
              stateCode: county.stateCode,
              countyName: county.countyName,
              city: null,
              tradeSlug: canonicalTradeSlug,
              tier,
            }),
            rules,
            now
          );
          if (!canServePublicBusinessDetail({ publication: pub, tier })) return null;
          return { slug: String((r as any).slug || ""), name: String((r as any).name || "") };
        })
        .filter((x): x is { slug: string; name: string } => Boolean(x))
        .slice(0, 200);

      res.json({
        scope: {
          tradeSlug: canonicalTradeSlug,
          stateCode: county.stateCode,
          countySlug: county.countySlug,
        },
        definition: `Verified & active listings updated in the last ${rules.categoryPageRecencyWindowDays} days. Not ranked by payment.`,
        items,
      });
    } catch (error: any) {
      console.error("Error building best trade-county data:", error);
      res.status(500).json({ message: "Failed to load best listings" });
    }
  });
});

router.get("/api/public/seo/best/trade-city", async (req, res) => {
  try {
    const match = getTradeSeoMatch(req.query.tradeSlug ?? req.query.trade);
    if (!match) return res.status(400).json({ message: "Invalid tradeSlug" });

    const stateCode = normalizeStateCode(req.query.stateCode ?? req.query.state);
    const citySlug = coerceString(req.query.citySlug ?? req.query.city).toLowerCase();
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!/^[a-z0-9-]+$/.test(citySlug))
      return res.status(400).json({ message: "Invalid citySlug" });

    const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);
    const tradeClause = buildTradeWhereClause(canonicalTradeSlug);

    const rules = await getPublicationRules();
    const now = new Date();
    const recencyCutoff = new Date(
      now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
    );

    const whereClauses: any[] = [
      eq(businesses.status, "active" as any),
      eq(businesses.publicDiscoveryEnabled, true as any),
      publicBusinessDetailExposureSqlPredicate(),
      eq(counties.stateCode, stateCode),
      sql`${sqlDirectoryCitySlugExpr()} = ${citySlug}`,
      sql`${businesses.updatedAt} >= ${recencyCutoff}`,
    ];
    if (tradeClause) whereClauses.push(tradeClause);

    const rows = await db
      .select({
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        claimStatus: businesses.claimStatus,
        ownerUserId: businesses.ownerUserId,
        updatedAt: businesses.updatedAt,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        ownerVerificationStatus: users.verificationStatus,
        ownerAddressVerified: users.addressVerified,
        countyName: counties.name,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(and(...whereClauses))
      .orderBy(desc(businesses.updatedAt), asc(businesses.name))
      .limit(250);

    const items = rows
      .map((r) => {
        const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
        if (!updatedAt) return null;
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
        if (tier !== "verified") return null;
        const pub = isPublicAndCrawlableBusiness(
          buildPublicBusinessSignals({
            id: String((r as any).id),
            name: String((r as any).name || ""),
            slug: String((r as any).slug || ""),
            updatedAt,
            publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
            stateCode,
            countyName: String((r as any).countyName || ""),
            city: null,
            tradeSlug: canonicalTradeSlug,
            tier,
          }),
          rules,
          now
        );
        if (!canServePublicBusinessDetail({ publication: pub, tier })) return null;
        return { slug: String((r as any).slug || ""), name: String((r as any).name || "") };
      })
      .filter((x): x is { slug: string; name: string } => Boolean(x))
      .slice(0, 200);

    res.json({
      scope: { tradeSlug: canonicalTradeSlug, stateCode, citySlug },
      definition: `Verified & active listings updated in the last ${rules.categoryPageRecencyWindowDays} days. Not ranked by payment.`,
      items,
    });
  } catch (error: any) {
    console.error("Error building best trade-city data:", error);
    res.status(500).json({ message: "Failed to load best listings" });
  }
});

router.get("/api/public/seo/recent/county", async (req, res) => {
  try {
    const county = resolveCountyFipsBySlug(
      req.query.stateCode ?? req.query.state,
      req.query.countySlug ?? req.query.county
    );
    if (!county) return res.status(400).json({ message: "Invalid stateCode/countySlug" });

    const countyRow = await db
      .select({ id: counties.id })
      .from(counties)
      .where(and(eq(counties.fips, county.fips), eq(counties.stateCode, county.stateCode)))
      .limit(1);
    const countyId = countyRow[0]?.id ? String(countyRow[0].id) : "";
    if (!countyId) return res.status(404).json({ message: "County not found" });

    const rules = await getPublicationRules();
    const now = new Date();
    const rows = await db
      .select({
        id: tsPublicActivity.id,
        activityType: tsPublicActivity.activityType,
        occurredAt: tsPublicActivity.occurredAt,
        expiresAt: tsPublicActivity.expiresAt,
        publicText: tsPublicActivity.publicText,
        activeStatus: tsPublicActivity.activeStatus,
      })
      .from(tsPublicActivity)
      .where(
        and(
          eq(tsPublicActivity.activeStatus, true as any),
          eq(tsPublicActivity.countyId, countyId),
          sql`${tsPublicActivity.expiresAt} > now()`
        )
      )
      .orderBy(desc(tsPublicActivity.occurredAt))
      .limit(80);

    const items = rows
      .map((r) => {
        const ok = isPublicAndCrawlableActivity(
          {
            id: String((r as any).id),
            activeStatus: Boolean((r as any).activeStatus),
            occurredAt: (r as any).occurredAt,
            expiresAt: (r as any).expiresAt,
          },
          rules,
          now
        );
        if (!ok.ok) return null;
        return {
          id: String((r as any).id),
          type: String((r as any).activityType || ""),
          occurredAt: (r as any).occurredAt,
          text: typeof (r as any).publicText === "string" ? String((r as any).publicText) : "",
        };
      })
      .filter(Boolean);

    res.json({ scope: { stateCode: county.stateCode, countySlug: county.countySlug }, items });
  } catch (error: any) {
    console.error("Error loading county recent activity:", error);
    res.status(500).json({ message: "Failed to load recent activity" });
  }
});

router.get("/api/public/seo/recent/city", async (req, res) => {
  try {
    const stateCode = normalizeStateCode(req.query.stateCode ?? req.query.state);
    const citySlug = coerceString(req.query.citySlug ?? req.query.city).toLowerCase();
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!/^[a-z0-9-]+$/.test(citySlug))
      return res.status(400).json({ message: "Invalid citySlug" });

    const rules = await getPublicationRules();
    const now = new Date();
    const rows = await db
      .select({
        id: tsPublicActivity.id,
        activityType: tsPublicActivity.activityType,
        occurredAt: tsPublicActivity.occurredAt,
        expiresAt: tsPublicActivity.expiresAt,
        publicText: tsPublicActivity.publicText,
        activeStatus: tsPublicActivity.activeStatus,
      })
      .from(tsPublicActivity)
      .where(
        and(
          eq(tsPublicActivity.activeStatus, true as any),
          eq(tsPublicActivity.stateCode, stateCode),
          eq(tsPublicActivity.citySlug, citySlug),
          sql`${tsPublicActivity.expiresAt} > now()`
        )
      )
      .orderBy(desc(tsPublicActivity.occurredAt))
      .limit(80);

    const items = rows
      .map((r) => {
        const ok = isPublicAndCrawlableActivity(
          {
            id: String((r as any).id),
            activeStatus: Boolean((r as any).activeStatus),
            occurredAt: (r as any).occurredAt,
            expiresAt: (r as any).expiresAt,
          },
          rules,
          now
        );
        if (!ok.ok) return null;
        return {
          id: String((r as any).id),
          type: String((r as any).activityType || ""),
          occurredAt: (r as any).occurredAt,
          text: typeof (r as any).publicText === "string" ? String((r as any).publicText) : "",
        };
      })
      .filter(Boolean);

    res.json({ scope: { stateCode, citySlug }, items });
  } catch (error: any) {
    console.error("Error loading city recent activity:", error);
    res.status(500).json({ message: "Failed to load recent activity" });
  }
});

router.get("/api/public/seo/recent/trade-county", async (req, res) => {
  try {
    const match = getTradeSeoMatch(req.query.tradeSlug ?? req.query.trade);
    if (!match) return res.status(400).json({ message: "Invalid tradeSlug" });
    const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);

    const county = resolveCountyFipsBySlug(
      req.query.stateCode ?? req.query.state,
      req.query.countySlug ?? req.query.county
    );
    if (!county) return res.status(400).json({ message: "Invalid stateCode/countySlug" });

    const countyRow = await db
      .select({ id: counties.id })
      .from(counties)
      .where(and(eq(counties.fips, county.fips), eq(counties.stateCode, county.stateCode)))
      .limit(1);
    const countyId = countyRow[0]?.id ? String(countyRow[0].id) : "";
    if (!countyId) return res.status(404).json({ message: "County not found" });

    const rules = await getPublicationRules();
    const now = new Date();
    const rows = await db
      .select({
        id: tsPublicActivity.id,
        activityType: tsPublicActivity.activityType,
        occurredAt: tsPublicActivity.occurredAt,
        expiresAt: tsPublicActivity.expiresAt,
        publicText: tsPublicActivity.publicText,
        activeStatus: tsPublicActivity.activeStatus,
      })
      .from(tsPublicActivity)
      .where(
        and(
          eq(tsPublicActivity.activeStatus, true as any),
          eq(tsPublicActivity.countyId, countyId),
          eq(tsPublicActivity.tradeSlug, canonicalTradeSlug),
          sql`${tsPublicActivity.expiresAt} > now()`
        )
      )
      .orderBy(desc(tsPublicActivity.occurredAt))
      .limit(80);

    const items = rows
      .map((r) => {
        const ok = isPublicAndCrawlableActivity(
          {
            id: String((r as any).id),
            activeStatus: Boolean((r as any).activeStatus),
            occurredAt: (r as any).occurredAt,
            expiresAt: (r as any).expiresAt,
          },
          rules,
          now
        );
        if (!ok.ok) return null;
        return {
          id: String((r as any).id),
          type: String((r as any).activityType || ""),
          occurredAt: (r as any).occurredAt,
          text: typeof (r as any).publicText === "string" ? String((r as any).publicText) : "",
        };
      })
      .filter(Boolean);

    res.json({
      scope: {
        tradeSlug: canonicalTradeSlug,
        stateCode: county.stateCode,
        countySlug: county.countySlug,
      },
      items,
    });
  } catch (error: any) {
    console.error("Error loading trade-county recent activity:", error);
    res.status(500).json({ message: "Failed to load recent activity" });
  }
});

router.get("/api/public/seo/recent/trade-city", async (req, res) => {
  try {
    const match = getTradeSeoMatch(req.query.tradeSlug ?? req.query.trade);
    if (!match) return res.status(400).json({ message: "Invalid tradeSlug" });
    const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);

    const stateCode = normalizeStateCode(req.query.stateCode ?? req.query.state);
    const citySlug = coerceString(req.query.citySlug ?? req.query.city).toLowerCase();
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!/^[a-z0-9-]+$/.test(citySlug))
      return res.status(400).json({ message: "Invalid citySlug" });

    const rules = await getPublicationRules();
    const now = new Date();
    const rows = await db
      .select({
        id: tsPublicActivity.id,
        activityType: tsPublicActivity.activityType,
        occurredAt: tsPublicActivity.occurredAt,
        expiresAt: tsPublicActivity.expiresAt,
        publicText: tsPublicActivity.publicText,
        activeStatus: tsPublicActivity.activeStatus,
      })
      .from(tsPublicActivity)
      .where(
        and(
          eq(tsPublicActivity.activeStatus, true as any),
          eq(tsPublicActivity.stateCode, stateCode),
          eq(tsPublicActivity.citySlug, citySlug),
          eq(tsPublicActivity.tradeSlug, canonicalTradeSlug),
          sql`${tsPublicActivity.expiresAt} > now()`
        )
      )
      .orderBy(desc(tsPublicActivity.occurredAt))
      .limit(80);

    const items = rows
      .map((r) => {
        const ok = isPublicAndCrawlableActivity(
          {
            id: String((r as any).id),
            activeStatus: Boolean((r as any).activeStatus),
            occurredAt: (r as any).occurredAt,
            expiresAt: (r as any).expiresAt,
          },
          rules,
          now
        );
        if (!ok.ok) return null;
        return {
          id: String((r as any).id),
          type: String((r as any).activityType || ""),
          occurredAt: (r as any).occurredAt,
          text: typeof (r as any).publicText === "string" ? String((r as any).publicText) : "",
        };
      })
      .filter(Boolean);

    res.json({ scope: { tradeSlug: canonicalTradeSlug, stateCode, citySlug }, items });
  } catch (error: any) {
    console.error("Error loading trade-city recent activity:", error);
    res.status(500).json({ message: "Failed to load recent activity" });
  }
});

export { router as businessDirectoryPublicRouter };
