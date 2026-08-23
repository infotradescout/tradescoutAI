import { Router } from "express";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  businesses,
  businessCounties,
  businessSuggestions,
  counties,
  tsPublicActivity,
  users,
} from "../../shared/schema";
import { storage } from "../storage";
import { getTradeSeoMatch, normalizeTradeSlug, slugifyCountyName } from "../../shared/tradeSeo";
import { US_STATES_COUNTIES } from "../../shared/states-counties";
import { getPublicationRules } from "../publicationRules";
import {
  isPublicAndCrawlableActivity,
  isPublicAndCrawlableBusiness,
  isPublicAndCrawlableBusinessDetail,
} from "../../shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
  publicBusinessDetailExposureSqlPredicate,
  publicBusinessDetailRecencySqlPredicate,
  publicBusinessTradeSqlPredicate,
} from "../publicationBusiness";
import {
  isCanonicalPublicCitySlug,
  normalizePublicCitySlug,
  publicBusinessCitySlugSql,
  publicBusinessStateCodeSql,
} from "../seoDirectoryCitySlug";
import {
  assertSeoDirectorySnapshotReady,
  listActiveCountyTradeScopes,
  listActiveTradeCountyScopes,
  listActiveTradeScopes,
  listActiveTradeStateScopes,
} from "../services/seoDirectoryNavigationService";
import {
  buildPublicDirectoryProfile,
  hasSpecificPublicDirectoryIdentity,
  hasPublicDirectoryOfferingFacts,
  orderPublicDirectoryCounties,
  sanitizePublicDirectoryDisplayName,
} from "../services/publicDirectoryBusinessPresentation";
import { loadPublicDirectoryBusinessBySlug } from "../services/publicDirectoryBusinessDetailService";

const router = Router();

// Simple in-memory cache for public directory lookups
const PUBLIC_CACHE = new Map();
const PUBLIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const PUBLIC_CACHE_MAX_ENTRIES = 500;

function getCacheKey(path: string, params: Record<string, any>) {
  // Only cache safe, public GETs
  const keys = Object.keys(params).sort();
  return `${path}::${keys.map((k) => `${k}=${String(params[k])}`).join("&")}`;
}

export function getCachedOrCompute(
  path: string,
  params: Record<string, any>,
  compute: () => Promise<any>
) {
  const key = getCacheKey(path, params);
  const now = Date.now();
  for (const [cacheKey, entry] of PUBLIC_CACHE.entries()) {
    if (Number(entry?.expiresAt || 0) <= now) PUBLIC_CACHE.delete(cacheKey);
  }
  const cached = PUBLIC_CACHE.get(key);
  if (cached && cached.expiresAt > now) {
    PUBLIC_CACHE.delete(key);
    PUBLIC_CACHE.set(key, cached);
    return Promise.resolve(cached.value);
  }
  return compute().then((value) => {
    if (Number(value?.status) === 200) {
      while (PUBLIC_CACHE.size >= PUBLIC_CACHE_MAX_ENTRIES) {
        const oldestKey = PUBLIC_CACHE.keys().next().value;
        if (typeof oldestKey === "undefined") break;
        PUBLIC_CACHE.delete(oldestKey);
      }
      PUBLIC_CACHE.set(key, { value, expiresAt: now + PUBLIC_CACHE_TTL_MS });
    }
    return value;
  });
}

export function getPublicDirectoryCacheSize(): number {
  return PUBLIC_CACHE.size;
}

export async function getSnapshotAuthoritativeCachedOrCompute(
  path: string,
  params: Record<string, any>,
  compute: () => Promise<any>,
  assertReady: () => Promise<unknown> = assertSeoDirectorySnapshotReady
) {
  // Do not reuse a process-local payload across durable snapshot generations.
  // Readiness is checked on every request and the current generation is read
  // directly until a generation-keyed shared cache exists.
  await assertReady();
  return compute();
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

function buildTradeWhereClause(tradeRaw: unknown) {
  return publicBusinessTradeSqlPredicate(tradeRaw);
}

// Public-safe directory list. Never exposes direct contact vectors.
router.get("/api/businesses", async (req, res, next) => {
  const forcePublicView = String(req.query.public || "") === "1";
  if (isAuthed(req) && !forcePublicView) return next();
  const countyFips = normalizeCountyFips(
    req.query.countyFips ?? req.query.county ?? req.query.county_fips
  );
  const stateCode = normalizeStateCode(
    req.query.stateCode ?? req.query.state ?? req.query.state_code
  );
  const claimed = normalizeClaimed(req.query.claimed);
  const rawQuery = coerceString(req.query.q ?? req.query.search);
  const publicQuery = rawQuery ? sanitizePublicDirectoryDisplayName(rawQuery) : "";
  const trade = coerceString(req.query.trade ?? req.query.tradeSlug ?? req.query.trade_slug);
  const city = coerceString(req.query.city ?? req.query.cityName ?? req.query.city_name);
  const citySlug = city ? normalizePublicCitySlug(city) : "";
  const tradeMatch = trade ? getTradeSeoMatch(trade) : null;
  const requestedTradeSlug = tradeMatch ? normalizeTradeSlug(tradeMatch.canonicalSlug) : "";
  const limitRaw = Number(req.query.limit ?? 25);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 25;
  const offsetRaw = Number(req.query.offset ?? 0);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.min(5_000, offsetRaw)) : 0;

  if (!countyFips && !stateCode) {
    return res
      .status(400)
      .json({ message: "countyFips or stateCode is required for public business search" });
  }
  if (rawQuery && !hasSpecificPublicDirectoryIdentity(publicQuery)) {
    return res.status(400).json({ message: "Search query is not public-safe" });
  }
  if (city && !citySlug) return res.status(400).json({ message: "Invalid city" });

  const cacheParams = {
    countyFips,
    stateCode,
    claimed,
    trade: requestedTradeSlug,
    city: citySlug,
    limit,
    offset,
  };
  const compute = async () => {
    try {
      await assertSeoDirectorySnapshotReady();
      if (trade && !requestedTradeSlug) {
        return { status: 200, body: { items: [], ...cacheParams, q: publicQuery } };
      }
      const rules = await getPublicationRules();
      const now = new Date();
      const unclaimedCutoff = new Date(
        now.getTime() - rules.listingStaleDaysUnclaimed * 24 * 60 * 60 * 1000
      );
      const verifiedCutoff = new Date(
        now.getTime() - rules.listingStaleDaysVerified * 24 * 60 * 60 * 1000
      );
      const filters = [
        sql`live.status = 'active'`,
        sql`coalesce(live.public_discovery_enabled, false) = true`,
        sql`(
          (
            live.owner_user_id is null
            and lower(coalesce(live.claim_status, '')) = 'unclaimed'
            and live.updated_at >= ${unclaimedCutoff}
          )
          or
          (
            live.owner_user_id is not null
            and lower(coalesce(live.claim_status, '')) <> 'unclaimed'
            and lower(coalesce(cast(owner.verification_status as text), '')) = 'approved'
            and owner.address_verified = true
            and live.updated_at >= ${verifiedCutoff}
          )
        )`,
      ];
      if (claimed === "claimed") {
        filters.push(sql`lower(coalesce(live.claim_status, '')) <> 'unclaimed'`);
      }
      if (claimed === "unclaimed") {
        filters.push(sql`lower(coalesce(live.claim_status, '')) = 'unclaimed'`);
      }
      if (requestedTradeSlug) filters.push(sql`snapshot.trade_slug = ${requestedTradeSlug}`);
      if (citySlug) {
        filters.push(sql`snapshot.city_slug = ${citySlug}`);
        if (stateCode) filters.push(sql`snapshot.primary_state_code = ${stateCode}`);
      }
      if (publicQuery) {
        filters.push(sql`lower(snapshot.display_name) like lower(${publicQuery}) || '%'`);
      }
      if (countyFips || stateCode) {
        filters.push(sql`exists (
          select 1
          from ts_seo_directory_business_counties scope_membership
          inner join counties scope_county on scope_county.id = scope_membership.county_id
          where scope_membership.business_id = snapshot.business_id
            ${countyFips ? sql`and scope_county.fips = ${countyFips}` : sql``}
            ${stateCode ? sql`and scope_county.state_code = ${stateCode}` : sql``}
        )`);
      }

      const result = await db.execute(sql`
        select
          snapshot.business_id as id,
          snapshot.display_name as name,
          snapshot.slug,
          live.type,
          live.role_context,
          lower(coalesce(live.claim_status, '')) as claim_status,
          live.status,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', county.id,
                'fips', county.fips,
                'stateCode', county.state_code,
                'name', county.name
              )
              order by membership.is_primary desc, county.state_code, county.name, county.fips
            ),
            '[]'::jsonb
          ) as counties
        from ts_seo_directory_business_pages snapshot
        inner join businesses live on live.id = snapshot.business_id
        left join users owner on owner.id = live.owner_user_id
        inner join ts_seo_directory_business_counties membership
          on membership.business_id = snapshot.business_id
        inner join counties county on county.id = membership.county_id
        where ${sql.join(filters, sql` and `)}
        group by
          snapshot.business_id,
          snapshot.display_name,
          snapshot.slug,
          live.claim_status,
          live.type,
          live.role_context,
          live.status
        order by snapshot.slug asc, snapshot.business_id asc
        limit ${limit} offset ${offset};
      `);
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      const items = rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        roleContext: row.role_context,
        claimStatus: row.claim_status,
        status: row.status,
        counties: Array.isArray(row.counties) ? row.counties : [],
      }));
      return {
        status: 200,
        body: {
          items,
          countyFips,
          stateCode: stateCode || null,
          claimed,
          q: publicQuery,
          trade: requestedTradeSlug || null,
          city: citySlug || null,
          limit,
          offset,
        },
      };
    } catch (error) {
      console.error("Error listing snapshot-backed public businesses:", error);
      return { status: 503, body: { message: "Business directory temporarily unavailable" } };
    }
  };

  // Search text is never placed in process memory, even after sanitization.
  const result = rawQuery
    ? await compute()
    : await getSnapshotAuthoritativeCachedOrCompute("/api/businesses", cacheParams, compute);
  if (result.status >= 500) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "300");
  }
  return res.status(result.status).json(result.body);
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

// Public-safe navigation backed by the same publishable scope snapshot as the
// directory sitemaps. It never returns contacts or creates action authority.
router.get("/api/public/seo/directory-navigation", async (req, res) => {
  const cacheParams = {
    tradeSlug: req.query.tradeSlug ?? req.query.trade,
    stateCode: req.query.stateCode ?? req.query.state,
    countySlug: req.query.countySlug ?? req.query.county,
  };

  let result: any;
  try {
    result = await getSnapshotAuthoritativeCachedOrCompute(
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
            return {
              status: 200,
              body: { scope: "trades", trades: await listActiveTradeScopes() },
            };
          }
          if (tradeSlug && !stateCode && !countySlug) {
            return {
              status: 200,
              body: {
                scope: "trade-states",
                tradeSlug,
                states: await listActiveTradeStateScopes(tradeSlug),
              },
            };
          }
          if (tradeSlug && stateCode && !countySlug) {
            return {
              status: 200,
              body: {
                scope: "trade-counties",
                tradeSlug,
                stateCode,
                counties: await listActiveTradeCountyScopes(tradeSlug, stateCode),
              },
            };
          }
          if (!tradeSlug && stateCode && /^[a-z0-9-]+$/.test(countySlug)) {
            const county = resolveCountyFipsBySlug(stateCode, countySlug);
            if (!county) {
              return { status: 400, body: { message: "Invalid stateCode/countySlug" } };
            }
            return {
              status: 200,
              body: {
                scope: "county-trades",
                stateCode,
                countySlug,
                trades: await listActiveCountyTradeScopes(stateCode, countySlug),
              },
            };
          }
          return { status: 400, body: { message: "Invalid directory navigation scope" } };
        } catch (error) {
          console.warn("SEO directory navigation snapshot unavailable", error);
          return {
            status: 503,
            body: { message: "Directory navigation is temporarily unavailable", retryAfter: 300 },
          };
        }
      }
    );
  } catch (error) {
    console.warn("SEO directory navigation snapshot authority unavailable", error);
    result = {
      status: 503,
      body: { message: "Directory navigation is temporarily unavailable", retryAfter: 300 },
    };
  }

  if (result.status >= 500) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "300");
  }
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

  const result = await getCachedOrCompute(
    "/api/public/seo/best/trade-county",
    cacheParams,
    async () => {
      try {
        const match = getTradeSeoMatch(cacheParams.tradeSlug);
        if (!match) return { status: 400, body: { message: "Invalid tradeSlug" } };

        const county = resolveCountyFipsBySlug(cacheParams.stateCode, cacheParams.countySlug);
        if (!county) {
          return { status: 400, body: { message: "Invalid stateCode/countySlug" } };
        }

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
            profileData: businesses.profileData,
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
            const publicProfile = buildPublicDirectoryProfile((r as any).profileData || {});
            if (deriveTradeSlugFromProfileData(publicProfile) !== canonicalTradeSlug) return null;
            const pub = isPublicAndCrawlableBusiness(
              buildPublicBusinessSignals({
                id: String((r as any).id),
                name: sanitizePublicDirectoryDisplayName((r as any).name),
                slug: String((r as any).slug || ""),
                updatedAt,
                publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
                stateCode: county.stateCode,
                countyName: county.countyName,
                city: null,
                tradeSlug: canonicalTradeSlug,
                hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
                tier,
              }),
              rules,
              now
            );
            if (!canServePublicBusinessDetail({ publication: pub, tier })) return null;
            return {
              slug: String((r as any).slug || ""),
              name: sanitizePublicDirectoryDisplayName((r as any).name),
            };
          })
          .filter((x): x is { slug: string; name: string } => Boolean(x))
          .slice(0, 200);

        return {
          status: 200,
          body: {
            scope: {
              tradeSlug: canonicalTradeSlug,
              stateCode: county.stateCode,
              countySlug: county.countySlug,
            },
            definition: `Verified & active listings updated in the last ${rules.categoryPageRecencyWindowDays} days. Not ranked by payment.`,
            items,
          },
        };
      } catch (error: any) {
        console.error("Error building best trade-county data:", error);
        return { status: 500, body: { message: "Failed to load best listings" } };
      }
    }
  );
  if (result.status >= 500) res.setHeader("Cache-Control", "no-store");
  return res.status(result.status).json(result.body);
});

router.get("/api/public/seo/best/trade-city", async (req, res) => {
  try {
    const match = getTradeSeoMatch(req.query.tradeSlug ?? req.query.trade);
    if (!match) return res.status(400).json({ message: "Invalid tradeSlug" });

    const stateCode = normalizeStateCode(req.query.stateCode ?? req.query.state);
    const rawCitySlug = req.query.citySlug ?? req.query.city;
    const citySlug = normalizePublicCitySlug(rawCitySlug);
    if (!stateCode) return res.status(400).json({ message: "Invalid stateCode" });
    if (!isCanonicalPublicCitySlug(rawCitySlug))
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
      sql`${publicBusinessStateCodeSql()} = ${stateCode}`,
      sql`${publicBusinessCitySlugSql()} = ${citySlug}`,
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
        countyName: sql<string>`min(${counties.name})`,
        profileData: businesses.profileData,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(and(...whereClauses))
      .groupBy(
        businesses.id,
        businesses.slug,
        businesses.name,
        businesses.claimStatus,
        businesses.ownerUserId,
        businesses.updatedAt,
        businesses.publicDiscoveryEnabled,
        users.verificationStatus,
        users.addressVerified,
        businesses.profileData
      )
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
        const publicProfile = buildPublicDirectoryProfile((r as any).profileData || {});
        if (deriveTradeSlugFromProfileData(publicProfile) !== canonicalTradeSlug) return null;
        const pub = isPublicAndCrawlableBusiness(
          buildPublicBusinessSignals({
            id: String((r as any).id),
            name: sanitizePublicDirectoryDisplayName((r as any).name),
            slug: String((r as any).slug || ""),
            updatedAt,
            publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
            stateCode,
            countyName: String((r as any).countyName || ""),
            city: null,
            tradeSlug: canonicalTradeSlug,
            hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
            tier,
          }),
          rules,
          now
        );
        if (!canServePublicBusinessDetail({ publication: pub, tier })) return null;
        return {
          slug: String((r as any).slug || ""),
          name: sanitizePublicDirectoryDisplayName((r as any).name),
        };
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
