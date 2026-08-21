import { Router } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { ensureSeoDirectoryScopeSnapshotTables } from "../services/seoDirectoryScopeSnapshotJob";
import { db, pool } from "../db";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";
import { PRIMARY_TRADE_SLUGS, slugifyCountyName } from "../../shared/tradeSeo";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import {
  businessVerifications,
  businesses,
  contractors,
  homeScoutListings,
  profiles,
  profileViewEvents,
  publicProfileEngagements,
  recommendations,
  trustSnapshots,
  users,
} from "../../shared/schema";
import { detectActorFromUserAgent, getClientIp, hashIp } from "../utils/requestActor";
import {
  PROFILE_MANAGE_BRIDGE_COOKIE,
  PROFILE_MANAGE_BRIDGE_TTL_SECONDS,
  readRawCookie,
  signManageBridgeToken,
  verifyManageBridgeToken,
} from "../utils/profileManageBridge";
import {
  canExposePublishedProfilePublicly,
  hasTradeScoutPendingOwnerCustody,
  isOwnerConfirmedDirectProfile,
  isPubliclyVerifiedProfileOwner,
  isSteelHomePackagesUnlistedDirectProfile,
} from "../services/ownerConfirmedDirectProfile";
import {
  isExactPublicProfileContractorBindingCandidate,
  JW_STONE_RECOMMENDATION_COMPATIBILITY,
} from "../services/publicProfileContractorBinding";
import {
  buildHandmadeProductPath,
  listHandmadeProductImageUrls,
} from "../../shared/handmadeProductShare";
import { listCommunityPostImageUrls } from "../../shared/communityPostShare";
import { sanitizePublicProfileOfferText, toPublicProfileOffer } from "../publicProfileOffer";
import { buildProfileServiceOfferPath } from "../../shared/profileOfferShare";
import { resolveSiteTemplateId } from "../../shared/profileSiteTemplates";
import {
  buildPublicBusinessListingCards,
  type PublicBusinessListingCard,
} from "../../shared/publicBusinessListing";
import { buildExposureAuthorityMap } from "../services/exposureAuthority";
import { getActiveCvsBoosts, type ActiveCvsBoost } from "../services/cvsBoostPolicy";
import { hasDirectConnectPhone } from "../services/directConnectPhone";
import {
  buildPublicHomeScoutListingCards,
  type PublicHomeScoutListingCard,
} from "../../shared/homeScoutListingShare";
import {
  buildPublicContractorPromoCards,
  type PublicContractorPromoCard,
} from "../../shared/contractorPromoShare";
import { prepareSitemapUrlSetEntries } from "../sitemapUrlSet";
import {
  readProfileBookingConfigBlock,
  upsertProfileBookingConfigBlock,
} from "../../shared/profileBookingConfig";
import {
  PROFILE_SECTION_KEYS,
  readProfileSectionConfigBlock,
  upsertProfileSectionConfigBlock,
} from "../../shared/profileSectionConfig";
import { normalizeProfileBookingPrefs } from "../services/profileBookingService";
import { resolveProfileBookingConfig } from "../services/profileBookingConfig";
import {
  ISSA_BUILD_LEGACY_PROFILE_SLUG,
  ISSA_BUILD_PROFILE_SLUG,
} from "../../shared/issaBuildProfile";
import { notifyIndexNow } from "../services/indexNowService";
import {
  collectProfileIndexNowUrls,
  combineIndexNowChangeUrls,
} from "../services/indexNowPublicationEvents";
import { shouldIndexPublicProfileSlug } from "../../shared/publicProfileIndexing";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

const router = Router();

// Canonicalize every public-profile API surface, including views and
// trust-action mutations. A 308 keeps non-GET methods and bodies intact.
router.use("/api/u/:slug", (req, res, next) => {
  const slug = String(req.params.slug || "")
    .trim()
    .toLowerCase();
  if (slug !== ISSA_BUILD_LEGACY_PROFILE_SLUG) return next();

  const remainingUrl = String(req.url || "");
  const suffix =
    remainingUrl === "/"
      ? ""
      : remainingUrl.startsWith("/?")
        ? remainingUrl.slice(1)
        : remainingUrl;
  const canonicalUrl = `/api/u/${ISSA_BUILD_PROFILE_SLUG}${suffix}`;
  const status = req.method === "GET" || req.method === "HEAD" ? 301 : 308;
  return res.redirect(status, canonicalUrl);
});

// Trust snapshots are produced daily. Two days permits one delayed run while
// preventing a stale approval or score from remaining public indefinitely.
const PUBLIC_TRUST_SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const THIRTY_DAY_COMPARATOR_TARGET_MS = 30 * 24 * 60 * 60 * 1000;
const THIRTY_DAY_COMPARATOR_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

const CONTRACTOR_VERIFICATION_ROLES = new Set([
  "contractor",
  "handyman",
  "service_provider",
  "specialty_tradesperson",
  "inspector",
  "realtor",
  "mortgage_broker",
  "insurance_agent",
  "car_dealer",
  "auto_service",
]);

const CORE_STATIC_PATHS = [
  "/",
  "/landing",
  "/direct-connect",
  "/community",
  "/community-feed",
  "/exchange",
  "/exchange/vehicles",
  "/exchange/business",
  "/exchange/real-estate",
  "/exchange/construction",
  "/exchange/tools",
  "/exchange/furniture",
  "/exchange/farm",
  "/exchange/business-equipment",
  "/exchange/electronics",
  "/exchange/sports",
  "/exchange/collectibles",
  "/exchange/jewelry",
  "/exchange/metals",
  "/exchange/local-food",
  "/exchange/other",
  "/trade-deals",
  "/contractors/apply",
  "/groups",
  "/county-directory",
  "/county-hub",
  "/maps",
  "/help",
  "/help/how-tradescout-works",
  "/how-it-works",
  "/trust-model",
  "/direct-connect-info",
  "/compare",
  "/compare/angi",
  "/compare/home-services",
  "/compare/real-estate",
  "/compare/community",
  "/compare/local-business",
  "/compare/coordination",
  "/compare/lead-generation",
  "/compare/homeadvisor",
  "/pricing",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/privacy-request",
  "/compliance",
  "/leaderboard",
  "/foundation",
  "/resource-center",
  "/membership-portal",
  "/training-center",
  "/trade",
  "/datasets",
  "/datasets/trades",
  "/datasets/counties",
  "/datasets/cities",
  "/affiliate",
  "/vehicle-marketplace",
  "/homescout-listings",
  "/handmade-marketplace",
];

const COUNTY_SLUG_PATTERN = /^[a-z0-9-]+$/;
const SITEMAP_CUSTOM_DOMAIN_PATTERN = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

type PublishedProfileSitemapTarget = {
  profileSlug: string;
  businessSlug: string | null;
  customDomain: string | null;
  contentBlocks: unknown;
  isPublic: boolean;
  updatedAt: unknown;
};

type PublicBusinessPresenceSitemapRow = {
  slug: string;
  updatedAt: unknown;
};

function databaseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "t";
}

export function isPublishedProfileSitemapTargetPublic(row: Record<string, any>): boolean {
  return canExposePublishedProfilePublicly({
    profileId: row.profile_id,
    businessId: row.business_id,
    profileSlug: row.profile_slug,
    profileStatus: "published",
    profileOwnerUserId: row.profile_owner_user_id,
    ownerVerifiedBadge: databaseBoolean(row.owner_verified_badge),
    ownerVerificationStatus: row.owner_verification_status,
    ownerProvider: row.owner_provider,
    ownerPreferences: row.owner_preferences,
    businessStatus: row.business_status,
    businessOwnerUserId: row.business_owner_user_id,
    publicDiscoveryEnabled: databaseBoolean(row.public_discovery_enabled),
    businessSources: row.business_sources,
    businessClaimStatus: row.business_claim_status,
  });
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function toYmd(value: unknown, fallback = getTodayYmd()): string {
  if (!value) return fallback;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return value.toISOString().slice(0, 10);
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

function isValidCountySlug(value: unknown): value is string {
  return typeof value === "string" && COUNTY_SLUG_PATTERN.test(value) && value.length <= 80;
}

function slugifyCategory(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSitemapCustomDomain(value: unknown): string | null {
  const domain = String(value || "")
    .trim()
    .toLowerCase();
  return SITEMAP_CUSTOM_DOMAIN_PATTERN.test(domain) ? domain : null;
}

function canonicalPublishedProfileSitemapLoc(
  baseUrl: string,
  target: Pick<PublishedProfileSitemapTarget, "profileSlug" | "customDomain">
): string | null {
  // Keep the runtime sitemap path fail-closed even if a lower-level query or
  // future repository implementation returns a reserved internal profile.
  if (!shouldIndexPublicProfileSlug(target.profileSlug)) return null;
  // Custom-domain profiles own a host-local /sitemap.xml and robots.txt.
  // Do not mix another host into TradeScout's platform sitemap URL sets.
  if (target.customDomain) return null;
  return `${baseUrl}/u/${encodeURIComponent(target.profileSlug)}`;
}

function canonicalBusinessPresenceSitemapLoc(args: {
  baseUrl: string;
  businessSlug: string;
  linkedProfile?: PublishedProfileSitemapTarget;
}): string | null {
  if (args.linkedProfile?.isPublic) {
    // /business/:slug redirects whenever a published linked profile exists.
    return canonicalPublishedProfileSitemapLoc(args.baseUrl, args.linkedProfile);
  }
  // Private linked profiles are not redirect targets. The public business
  // page remains the final same-host 200 destination.
  return `${args.baseUrl}/business/${encodeURIComponent(args.businessSlug)}`;
}

function indexPublicLinkedProfilesByBusinessSlug(
  targets: PublishedProfileSitemapTarget[]
): Map<string, PublishedProfileSitemapTarget> {
  const indexed = new Map<string, PublishedProfileSitemapTarget>();
  for (const target of targets) {
    if (!target.businessSlug || !target.isPublic || indexed.has(target.businessSlug)) continue;
    // Targets arrive newest-first, so retain the first deterministic match.
    indexed.set(target.businessSlug, target);
  }
  return indexed;
}

async function listPublishedProfileSitemapTargets(
  businessSlugs?: string[]
): Promise<PublishedProfileSitemapTarget[]> {
  if (businessSlugs && businessSlugs.length === 0) return [];
  const businessScope = businessSlugs ? "AND b.slug = ANY($1::text[])" : "";
  const result = await pool.query(
    `SELECT p.slug AS profile_slug,
            p.id AS profile_id,
            p.business_id,
            p.owner_user_id AS profile_owner_user_id,
            b.slug AS business_slug,
            NULLIF(lower(trim(p.seo_meta->>'customDomain')), '') AS custom_domain,
            p.content_blocks,
            u.verified_badge AS owner_verified_badge,
            u.verification_status AS owner_verification_status,
            u.provider AS owner_provider,
            u.preferences AS owner_preferences,
            b.status AS business_status,
            b.owner_user_id AS business_owner_user_id,
            b.public_discovery_enabled,
            b.sources AS business_sources,
            b.claim_status AS business_claim_status,
            p.updated_at
       FROM profiles p
       INNER JOIN users u ON u.id = p.owner_user_id
       LEFT JOIN businesses b ON b.id = p.business_id
      WHERE p.status = 'published'
        ${businessScope}
      ORDER BY p.updated_at DESC NULLS LAST,
               p.created_at DESC NULLS LAST,
               p.slug ASC`,
    businessSlugs ? [businessSlugs] : []
  );

  return result.rows
    .map((row) => {
      const profileSlug = String(row.profile_slug || "").trim();
      if (!profileSlug) return null;
      return {
        profileSlug,
        businessSlug: String(row.business_slug || "").trim() || null,
        customDomain: normalizeSitemapCustomDomain(row.custom_domain),
        contentBlocks: row.content_blocks,
        isPublic: isPublishedProfileSitemapTargetPublic(row),
        updatedAt: row.updated_at ?? null,
      };
    })
    .filter((row): row is PublishedProfileSitemapTarget => Boolean(row));
}

async function listPublicBusinessPresenceSitemapRows(): Promise<
  PublicBusinessPresenceSitemapRow[]
> {
  const result = await pool.query(
    `SELECT business_slug,
            updated_at
       FROM users
      WHERE business_slug IS NOT NULL
        AND preferences->'provisional'->'profileDraft' IS NOT NULL
        AND COALESCE(preferences->'provisional'->'profileDraft'->>'visibility', 'private') = 'public'
      ORDER BY updated_at DESC
      LIMIT 100000`
  );

  return result.rows
    .map((row) => {
      const slug = String(row.business_slug || "").trim();
      if (!slug) return null;
      return {
        slug,
        updatedAt: row.updated_at ?? null,
      };
    })
    .filter((row): row is PublicBusinessPresenceSitemapRow => Boolean(row));
}

function buildUrlSet(
  urlEntries: Array<{ loc: string; lastmod: string; changefreq?: string; priority?: string }>
) {
  const preparedEntries = prepareSitemapUrlSetEntries(urlEntries);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${preparedEntries
  .map((entry) => {
    const optionalChangefreq = entry.changefreq
      ? `
    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`
      : "";
    const optionalPriority = entry.priority
      ? `
    <priority>${xmlEscape(entry.priority)}</priority>`
      : "";

    return `
  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>${optionalChangefreq}${optionalPriority}
  </url>`;
  })
  .join("\n")}
</urlset>`;
}

function sendSitemapFallback(res: any, kind: "urlset" | "index" = "urlset") {
  const payload =
    kind === "index"
      ? `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>`
      : `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
  res.type("application/xml");
  res.status(200).send(payload);
}

function buildRuntimeCorePaths(): string[] {
  // Keep sitemap-core focused on canonical, intent-strong URLs.
  // Variant landing routes remain available, but are intentionally excluded from core sitemap
  // to avoid flooding Search Console with near-duplicate discovery candidates.
  return Array.from(new Set(CORE_STATIC_PATHS));
}

function getAuthedUserId(req: any): string {
  return (req.user as any)?.id || (req.user as any)?.claims?.sub || "";
}

function isSuperAdminRequester(req: any): boolean {
  const role = String((req.user as any)?.role || "")
    .trim()
    .toLowerCase();
  if (role === "super_admin") return true;
  if ((req.user as any)?.isSuperAdmin === true) return true;
  const roles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
  return roles.some(
    (entry: unknown) =>
      String(entry || "")
        .trim()
        .toLowerCase() === "super_admin"
  );
}

function isStaffProfileManager(req: any): boolean {
  const role = String((req.user as any)?.role || "")
    .trim()
    .toLowerCase();
  if (role === "head_admin" || role === "super_admin") return true;
  const roles = Array.isArray((req.user as any)?.roles) ? (req.user as any).roles : [];
  return roles.some((entry: unknown) => {
    const normalized = String(entry || "")
      .trim()
      .toLowerCase();
    return normalized === "head_admin" || normalized === "super_admin";
  });
}

export function canAuthenticatedViewerPreviewProfile(req: any, ownerUserId: string): boolean {
  const viewerUserId = getAuthedUserId(req);
  return (
    Boolean(viewerUserId) &&
    (viewerUserId === ownerUserId || isSuperAdminRequester(req) || isStaffProfileManager(req))
  );
}

export function canServeLinkedBusinessProfileToViewer(args: {
  ownerUser: any;
  ownerConfirmedDirectProfile: boolean;
  authenticatedViewerCanManage: boolean;
}): boolean {
  return (
    isBusinessDiscoverable(args.ownerUser) ||
    args.ownerConfirmedDirectProfile ||
    args.authenticatedViewerCanManage
  );
}

function sanitizePublicCtaConfig(ctaConfig: unknown) {
  const safe = (ctaConfig && typeof ctaConfig === "object" ? ctaConfig : {}) as Record<string, any>;

  const sanitizeCta = (cta: unknown) => {
    if (!cta || typeof cta !== "object") return null;
    const source = cta as Record<string, any>;
    const kind = typeof source.kind === "string" ? source.kind : "message";
    const label = typeof source.label === "string" ? source.label : "Contact on TradeScout";

    return {
      label,
      kind,
      // Public pages never expose direct contact values.
      value: null,
      requiresTradeScoutAccount: false,
      route: "/direct-connect",
    };
  };

  return {
    primary: sanitizeCta(safe.primary),
    secondary: sanitizeCta(safe.secondary),
  };
}

function sanitizePublicProfileBookingConfig(raw: unknown) {
  const source = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const enabled = source.enabled === true;
  const paidBookings = source.paidBookings === true;
  const calendarVisibility = source.calendarVisibility === "private" ? "private" : "public";
  const bookingPriceUsd = Number(source.bookingPriceUsd);
  const safeBookingPriceUsd =
    Number.isFinite(bookingPriceUsd) && bookingPriceUsd >= 0
      ? Number(bookingPriceUsd.toFixed(2))
      : 0;
  const timezone =
    typeof source.timezone === "string" && source.timezone.trim().length > 0
      ? source.timezone.trim()
      : "America/Chicago";
  const pricingTableEnabled = source.pricingTableEnabled === true;

  const slots = Array.isArray(source.slots)
    ? source.slots
        .filter((slot) => slot && typeof slot === "object")
        .map((slot: any) => ({
          id:
            typeof slot.id === "string" && slot.id.trim().length > 0
              ? slot.id.trim()
              : Math.random().toString(36).slice(2),
          dayOfWeek:
            typeof slot.dayOfWeek === "number" && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6
              ? slot.dayOfWeek
              : 0,
          startTime:
            typeof slot.startTime === "string" && /^\d{2}:\d{2}$/.test(slot.startTime)
              ? slot.startTime
              : "09:00",
          endTime:
            typeof slot.endTime === "string" && /^\d{2}:\d{2}$/.test(slot.endTime)
              ? slot.endTime
              : "17:00",
          label: typeof slot.label === "string" ? slot.label.trim().slice(0, 80) : "",
          active: slot.active !== false,
        }))
    : [];

  const pricingRows = Array.isArray(source.pricingRows)
    ? source.pricingRows
        .filter((row) => row && typeof row === "object")
        .map((row: any) => ({
          id:
            typeof row.id === "string" && row.id.trim().length > 0
              ? row.id.trim()
              : Math.random().toString(36).slice(2),
          name: typeof row.name === "string" ? row.name.trim().slice(0, 80) : "",
          priceLabel: typeof row.priceLabel === "string" ? row.priceLabel.trim().slice(0, 40) : "",
          description:
            typeof row.description === "string" ? row.description.trim().slice(0, 240) : "",
        }))
        .filter((row) => row.name.length > 0 && row.priceLabel.length > 0)
    : [];

  return {
    enabled,
    paidBookings,
    bookingPriceUsd: safeBookingPriceUsd,
    calendarVisibility,
    timezone,
    slots: calendarVisibility === "public" ? slots : [],
    pricingTableEnabled,
    pricingRows,
  };
}

function buildAutoSeoMeta(args: {
  displayName: string;
  roleContext?: string | null;
  headline?: string | null;
  business?: { categories?: string[]; serviceAreas?: string[] } | null;
  servicesDescription?: string | null;
  seoMeta?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    customDomain?: string;
  } | null;
}) {
  const displayName = args.displayName.trim();
  const roleContext = String(args.roleContext || "").trim();
  const headline = String(args.headline || "").trim();
  const servicesDescription = String(args.servicesDescription || "").trim();
  const categories = Array.isArray(args.business?.categories)
    ? args.business?.categories
        .filter((c) => typeof c === "string" && c.trim().length > 0)
        .slice(0, 3)
    : [];
  const serviceAreaCount = Array.isArray(args.business?.serviceAreas)
    ? args.business?.serviceAreas.length
    : 0;

  // Google typically truncates title tags around ~60 chars and description
  // snippets around ~155-160 chars in search results -- keep both under those
  // limits so neither gets cut mid-word.
  const fallbackTitleParts = [displayName];
  if (roleContext) fallbackTitleParts.push(roleContext.replace(/_/g, " "));
  fallbackTitleParts.push("TradeScout");
  const fallbackTitle = fallbackTitleParts.join(" | ").slice(0, 60);

  const descriptionCandidates = [
    headline,
    servicesDescription,
    categories.length > 0
      ? `${displayName} serves ${categories.join(", ")} needs on TradeScout.`
      : "",
    serviceAreaCount > 0
      ? `${displayName} supports ${serviceAreaCount} service area${serviceAreaCount === 1 ? "" : "s"}.`
      : "",
    `${displayName} profile on TradeScout with protected Direct Connect contact.`,
  ].filter((value) => value && value.trim().length > 0);

  const fallbackDescription = descriptionCandidates.join(" ").slice(0, 160);

  const title =
    typeof args.seoMeta?.title === "string" && args.seoMeta.title.trim().length > 0
      ? args.seoMeta.title.trim().slice(0, 60)
      : fallbackTitle;
  const description =
    typeof args.seoMeta?.description === "string" && args.seoMeta.description.trim().length > 0
      ? args.seoMeta.description.trim().slice(0, 160)
      : fallbackDescription;
  const imageUrl =
    typeof args.seoMeta?.imageUrl === "string" && args.seoMeta.imageUrl.trim().length > 0
      ? args.seoMeta.imageUrl.trim().slice(0, 500)
      : undefined;
  // The server-rendered /u/:slug route already 301s a verified custom domain
  // to itself; this lets client-side navigation (no full page load) do the
  // same redirect instead of rendering the profile inline.
  const customDomain =
    typeof args.seoMeta?.customDomain === "string" && args.seoMeta.customDomain.trim().length > 0
      ? args.seoMeta.customDomain.trim().toLowerCase()
      : undefined;

  return { title, description, imageUrl, customDomain };
}

function getCanonicalBaseUrl(req: any): string {
  const configured = String(process.env.PUBLIC_WEB_URL || process.env.APP_URL || "").trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      const host = parsed.hostname.toLowerCase();
      const isLocal = host === "localhost" || host === "127.0.0.1";
      if (!isLocal) {
        parsed.protocol = "https:";
        if (host === "thetradescout.com" || host === "tradescoutai.onrender.com") {
          parsed.hostname = "www.thetradescout.com";
        }
        parsed.port = "";
      }
      return parsed.toString().replace(/\/$/, "");
    } catch {
      // ignore malformed env value and fall back to request-based resolution below
    }
  }

  const forwardedHostRaw = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  const host = forwardedHostRaw.split(":")[0].toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal && forwardedHostRaw) {
    return `http://${forwardedHostRaw}`.replace(/\/$/, "");
  }

  return "https://www.thetradescout.com";
}

function isBusinessDiscoverable(user: any): boolean {
  if (!user) return false;
  return isPubliclyVerifiedProfileOwner({
    ownerVerifiedBadge: user.verifiedBadge,
    ownerVerificationStatus: user.verificationStatus,
  });
}

const contentBlockSchema = z
  .object({
    type: z.string().min(1).max(64),
    data: z.record(z.any()).optional().default({}),
  })
  .passthrough();

const ctaSchema = z
  .object({
    label: z.string().min(1).max(60),
    kind: z.enum(["call", "email", "message", "link"]),
    value: z.string().min(1).max(500),
  })
  .strict();

const profileSeoSchema = z
  .object({
    title: z.string().max(120).optional(),
    description: z.string().max(500).optional(),
    imageUrl: z.string().max(500).optional(),
    imageWidth: z.number().optional(),
    imageHeight: z.number().optional(),
    // Separate from imageUrl (the OG/share banner) -- browser tab icons need
    // a square mark, not a wide 1200x630 crop. See publicProfileHtml.ts.
    faviconUrl: z.string().max(500).optional(),
  })
  .strict();

const createProfileSchema = z.object({
  roleContext: z.string().min(2).max(64),
  businessId: z.string().optional(),
  slug: z.string().min(2).max(120).optional(),
  displayName: z.string().min(2).max(120),
  headline: z.string().max(160).optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  ctaConfig: z
    .object({
      primary: ctaSchema.optional(),
      secondary: ctaSchema.optional(),
    })
    .optional(),
  seoMeta: profileSeoSchema.optional(),
  setActive: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  businessId: z.string().nullable().optional(),
  roleContext: z.string().min(2).max(64).optional(),
  slug: z.string().min(2).max(120).optional(),
  displayName: z.string().min(2).max(120).optional(),
  headline: z.string().max(160).nullable().optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
  ctaConfig: z
    .object({
      primary: ctaSchema.optional(),
      secondary: ctaSchema.optional(),
    })
    .optional(),
  seoMeta: profileSeoSchema.optional(),
});

const profileBrandColorsSchema = z
  .object({
    primary: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    primaryDark: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    secondary: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    surface: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
  })
  .strict()
  .refine((colors) => Object.keys(colors).length > 0, {
    message: "At least one brand color is required",
  });
const profileSectionVisibilitySchema = z
  .object(
    Object.fromEntries(PROFILE_SECTION_KEYS.map((key) => [key, z.boolean().optional()])) as Record<
      (typeof PROFILE_SECTION_KEYS)[number],
      z.ZodOptional<z.ZodBoolean>
    >
  )
  .strict()
  .refine((sections) => Object.keys(sections).length > 0, {
    message: "At least one section setting is required",
  });

async function collectEligibleProfileIndexNowUrls(profile: any): Promise<string[]> {
  try {
    const slug = String(profile?.slug || "").trim();
    if (!slug || String(profile?.status || "") !== "published") return [];
    const publicContext = await getPublicProfileTrustContext(slug);
    return collectProfileIndexNowUrls(profile, Boolean(publicContext));
  } catch (error) {
    console.warn("[IndexNow] Failed resolving profile publication eligibility:", error);
    return [];
  }
}

router.get("/api/profiles", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const list = await storage.listProfilesByOwner(userId);
    res.json(list);
  } catch (error: any) {
    console.error("Error listing profiles:", error);
    res.status(500).json({ message: "Failed to list profiles" });
  }
});

router.post("/api/profiles", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const data = createProfileSchema.parse(req.body);

    const created = await storage.createProfileForOwner(userId, {
      ownerUserId: userId as any,
      businessId: data.businessId,
      roleContext: data.roleContext as any,
      slug: data.slug || data.displayName,
      displayName: data.displayName,
      headline: data.headline || null,
      contentBlocks: data.contentBlocks || [],
      ctaConfig: data.ctaConfig || {},
      seoMeta: data.seoMeta || {},
      status: "draft" as any,
    } as any);

    if (data.setActive) {
      await storage.setUserActiveProfile(userId, created.id);
    }

    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error creating profile:", error);
    res
      .status(500)
      .json({ message: "Failed to create profile", requestId: (req as any).requestId || null });
  }
});

// Public search for published profiles (used by Scout auto-route).
// NOTE: This MUST appear before "/api/profiles/:id" or it will be captured
// by the param route and incorrectly require auth.
router.get("/api/profiles/public-search", async (req, res) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const results = await storage.searchProfilesPublic({ query, limit });
    res.json(
      results.map((row) => ({
        id: row.id,
        slug: row.slug,
        displayName: row.displayName,
        headline: row.headline,
        roleContext: row.roleContext,
      }))
    );
  } catch (error: any) {
    console.error("Error searching public profiles:", error);
    res.status(500).json({ message: "Failed to search profiles" });
  }
});

router.get("/api/profiles/:id/profile-booking", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const profile = isStaffProfileManager(req)
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const owner = await storage.getUser(profile.ownerUserId);
    if (!owner) return res.status(404).json({ message: "Profile owner not found" });

    const resolved = resolveProfileBookingConfig(profile, owner);
    res.json({
      profileId: profile.id,
      profileBooking: resolved.profileBooking,
      source: resolved.source,
    });
  } catch (error: any) {
    console.error("Error fetching Profile booking settings:", error);
    res.status(500).json({ message: "Failed to fetch Profile booking settings" });
  }
});

router.patch("/api/profiles/:id/profile-booking", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const profile = isStaffProfileManager(req)
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const owner = await storage.getUser(profile.ownerUserId);
    if (!owner) return res.status(404).json({ message: "Profile owner not found" });

    const existing = resolveProfileBookingConfig(profile, owner).profileBooking;
    const incoming = req.body && typeof req.body === "object" ? req.body : {};
    const normalized = normalizeProfileBookingPrefs({
      ...existing,
      ...incoming,
      slots: Object.prototype.hasOwnProperty.call(incoming, "slots")
        ? (incoming as any).slots
        : existing.slots,
      pricingRows: Object.prototype.hasOwnProperty.call(incoming, "pricingRows")
        ? (incoming as any).pricingRows
        : existing.pricingRows,
    });

    if (normalized.paidBookings && normalized.bookingPriceUsd <= 0) {
      return res.status(400).json({
        message: "A booking deposit must be greater than zero",
      });
    }

    const contentBlocks = upsertProfileBookingConfigBlock(
      profile.contentBlocks,
      normalized as unknown as Record<string, unknown>
    );
    const beforeUrls = await collectEligibleProfileIndexNowUrls(profile);
    if (isStaffProfileManager(req)) {
      await storage.updateProfileById(profileId, { contentBlocks } as any);
    } else {
      await storage.updateProfileForOwner(userId, profileId, { contentBlocks } as any);
    }
    const afterUrls = await collectEligibleProfileIndexNowUrls({ ...profile, contentBlocks });
    notifyIndexNow(combineIndexNowChangeUrls(beforeUrls, afterUrls));

    res.json({
      message: "Profile booking settings updated",
      profileId,
      profileBooking: normalized,
      source: "profile",
    });
  } catch (error: any) {
    console.error("Error updating Profile booking settings:", error);
    res.status(500).json({ message: "Failed to update Profile booking settings" });
  }
});

router.get("/api/profiles/:id/profile-sections", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const profile = isStaffProfileManager(req)
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const owner = await storage.getUser(profile.ownerUserId);
    if (!owner) return res.status(404).json({ message: "Profile owner not found" });
    const legacySections =
      owner.preferences?.profileSections && typeof owner.preferences.profileSections === "object"
        ? owner.preferences.profileSections
        : {};
    return res.json({
      profileId,
      profileSections: readProfileSectionConfigBlock(profile.contentBlocks) ?? legacySections,
    });
  } catch (error: any) {
    console.error("Error fetching Profile section settings:", error);
    return res.status(500).json({ message: "Failed to fetch Profile section settings" });
  }
});

router.patch("/api/profiles/:id/profile-sections", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const canManageAnyProfile = isStaffProfileManager(req);
    const profile = canManageAnyProfile
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const owner = await storage.getUser(profile.ownerUserId);
    if (!owner) return res.status(404).json({ message: "Profile owner not found" });
    const legacySections =
      owner.preferences?.profileSections && typeof owner.preferences.profileSections === "object"
        ? owner.preferences.profileSections
        : {};
    const updates = profileSectionVisibilitySchema.parse(req.body);
    const contentBlocks = upsertProfileSectionConfigBlock(
      profile.contentBlocks,
      updates,
      legacySections
    );
    const beforeUrls = await collectEligibleProfileIndexNowUrls(profile);
    if (canManageAnyProfile) {
      await storage.updateProfileById(profileId, { contentBlocks } as any);
    } else {
      await storage.updateProfileForOwner(userId, profileId, { contentBlocks } as any);
    }
    const afterUrls = await collectEligibleProfileIndexNowUrls({ ...profile, contentBlocks });
    notifyIndexNow(combineIndexNowChangeUrls(beforeUrls, afterUrls));
    return res.json({
      message: "Profile sections updated",
      profileId,
      profileSections: readProfileSectionConfigBlock(contentBlocks),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid profile sections", errors: error.errors });
    }
    console.error("Error updating Profile section settings:", error);
    return res.status(500).json({ message: "Failed to update Profile section settings" });
  }
});

router.get("/api/profiles/:id/brand-colors", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const canManageAnyProfile = isStaffProfileManager(req);
    const profile = canManageAnyProfile
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    if (!profile.businessId) return res.json({ profileId, businessId: null, brandColors: null });

    const [business] = await db
      .select({
        id: businesses.id,
        ownerUserId: businesses.ownerUserId,
        profileData: businesses.profileData,
      })
      .from(businesses)
      .where(eq(businesses.id, profile.businessId))
      .limit(1);
    if (!business) return res.status(404).json({ message: "Business not found" });
    if (
      !canManageAnyProfile &&
      String(business.ownerUserId || "") !== String(profile.ownerUserId || "")
    ) {
      return res.status(403).json({ message: "Not authorized to manage this business" });
    }

    const profileData =
      business.profileData && typeof business.profileData === "object"
        ? (business.profileData as Record<string, any>)
        : {};
    const brandColors =
      profileData.brandColors && typeof profileData.brandColors === "object"
        ? profileData.brandColors
        : null;
    return res.json({ profileId, businessId: business.id, brandColors });
  } catch (error: any) {
    console.error("Error fetching profile brand colors:", error);
    return res.status(500).json({ message: "Failed to fetch profile brand colors" });
  }
});

router.patch("/api/profiles/:id/brand-colors", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const canManageAnyProfile = isStaffProfileManager(req);
    const profile = canManageAnyProfile
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    if (!profile.businessId) {
      return res.status(409).json({ message: "This profile is not linked to a business" });
    }

    const updates = profileBrandColorsSchema.parse(req.body);
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, profile.businessId))
      .limit(1);
    if (!business) return res.status(404).json({ message: "Business not found" });
    if (
      !canManageAnyProfile &&
      String(business.ownerUserId || "") !== String(profile.ownerUserId || "")
    ) {
      return res.status(403).json({ message: "Not authorized to manage this business" });
    }

    const existingProfileData =
      business.profileData && typeof business.profileData === "object"
        ? (business.profileData as Record<string, any>)
        : {};
    const existingBrandColors =
      existingProfileData.brandColors && typeof existingProfileData.brandColors === "object"
        ? (existingProfileData.brandColors as Record<string, any>)
        : {};
    const brandColors = { ...existingBrandColors, ...updates };
    const profileUrls = await collectEligibleProfileIndexNowUrls(profile);
    const [updated] = await db
      .update(businesses)
      .set({
        profileData: {
          ...existingProfileData,
          brandColors,
        },
        updatedAt: new Date(),
      } as any)
      .where(
        canManageAnyProfile
          ? eq(businesses.id, business.id)
          : and(eq(businesses.id, business.id), eq(businesses.ownerUserId, profile.ownerUserId))
      )
      .returning({ id: businesses.id, profileData: businesses.profileData });
    if (!updated) {
      return res.status(canManageAnyProfile ? 404 : 409).json({
        message: canManageAnyProfile
          ? "Business not found"
          : "Business ownership changed; reload before saving brand colors",
      });
    }
    notifyIndexNow(profileUrls);

    return res.json({ profileId, businessId: updated.id, brandColors });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid brand colors", errors: error.errors });
    }
    console.error("Error updating profile brand colors:", error);
    return res.status(500).json({ message: "Failed to update profile brand colors" });
  }
});

router.get("/api/profiles/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const profile = isStaffProfileManager(req)
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.json(profile);
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// Issues a short-lived token so a manager authenticated on the canonical
// thetradescout.com session can hop onto a business's custom domain (a
// different browser origin, where that session cookie never arrives) with
// manage tools still active there.
router.get("/api/profiles/:id/manage-bridge-token", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const profile = await storage.getProfileById(profileId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const canManage =
      profile.ownerUserId === userId || isSuperAdminRequester(req) || isStaffProfileManager(req);
    if (!canManage)
      return res.status(403).json({ message: "Not authorized to manage this profile" });

    const token = signManageBridgeToken({ uid: userId, profileId });
    res.json({ token, expiresInSeconds: PROFILE_MANAGE_BRIDGE_TTL_SECONDS });
  } catch (error: any) {
    console.error("Error issuing profile manage bridge token:", error);
    res.status(500).json({ message: "Failed to issue manage token" });
  }
});

router.put("/api/profiles/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const updates = updateProfileSchema.parse(req.body);
    const existing = isStaffProfileManager(req)
      ? await storage.getProfileById(profileId)
      : await storage.getProfileByIdForOwner(userId, profileId);
    if (!existing) return res.status(404).json({ message: "Profile not found" });
    const beforeUrls = await collectEligibleProfileIndexNowUrls(existing);

    // A custom domain is an ownership-bearing routing value, not ordinary SEO
    // copy. It can only be changed by the TXT verification lifecycle in
    // business-profile.ts. Preserve any active/legacy mapping when unrelated
    // SEO fields are saved through this generic profile endpoint.
    const existingCustomDomain = String((existing.seoMeta as any)?.customDomain || "").trim();
    const nextSeoMeta =
      updates.seoMeta === undefined
        ? undefined
        : {
            ...updates.seoMeta,
            ...(existingCustomDomain ? { customDomain: existingCustomDomain } : {}),
          };
    const existingProfileBooking = readProfileBookingConfigBlock(existing.contentBlocks);
    const nextContentBlocks =
      updates.contentBlocks === undefined
        ? undefined
        : existingProfileBooking === undefined
          ? updates.contentBlocks
          : upsertProfileBookingConfigBlock(updates.contentBlocks, existingProfileBooking);
    const payload = {
      ...updates,
      ...(nextSeoMeta === undefined ? {} : { seoMeta: nextSeoMeta }),
      ...(nextContentBlocks === undefined ? {} : { contentBlocks: nextContentBlocks }),
      roleContext: updates.roleContext as any,
    } as any;

    let updated;
    if (isStaffProfileManager(req)) {
      updated = await storage.updateProfileById(profileId, payload);
    } else {
      updated = await storage.updateProfileForOwner(userId, profileId, payload);
    }
    const afterUrls = await collectEligibleProfileIndexNowUrls(updated);
    notifyIndexNow(combineIndexNowChangeUrls(beforeUrls, afterUrls));

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    if (String(error?.message || "").includes("Profile not found")) {
      return res.status(404).json({ message: "Profile not found" });
    }
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ message: "Failed to update profile", requestId: (req as any).requestId || null });
  }
});

// Explicit publish (draft -> published)
router.put("/api/profiles/:id/publish", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const existing = await storage.getProfileByIdForOwner(userId, profileId);
    if (!existing) return res.status(404).json({ message: "Profile not found" });
    const beforeUrls = await collectEligibleProfileIndexNowUrls(existing);

    const updated = await storage.updateProfileForOwner(userId, profileId, {
      status: "published" as any,
    } as any);
    const afterUrls = await collectEligibleProfileIndexNowUrls(updated);
    notifyIndexNow(combineIndexNowChangeUrls(beforeUrls, afterUrls));
    res.json(updated);
  } catch (error: any) {
    console.error("Error publishing profile:", error);
    res.status(500).json({ message: "Failed to publish profile" });
  }
});

// Explicit unpublish (published -> draft)
router.put("/api/profiles/:id/unpublish", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = String(req.params.id);
    const existing = await storage.getProfileByIdForOwner(userId, profileId);
    if (!existing) return res.status(404).json({ message: "Profile not found" });
    const beforeUrls = await collectEligibleProfileIndexNowUrls(existing);

    const updated = await storage.updateProfileForOwner(userId, profileId, {
      status: "draft" as any,
    } as any);
    notifyIndexNow(beforeUrls);
    res.json(updated);
  } catch (error: any) {
    console.error("Error unpublishing profile:", error);
    res.status(500).json({ message: "Failed to unpublish profile" });
  }
});

router.put("/api/users/active-profile", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuthedUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const profileId = z.object({ profileId: z.string().nullable() }).parse(req.body).profileId;

    if (profileId) {
      const profile = await storage.getProfileByIdForOwner(userId, profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
    }

    const updatedUser = await storage.setUserActiveProfile(userId, profileId);
    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }
    console.error("Error setting active profile:", error);
    res.status(500).json({ message: "Failed to set active profile" });
  }
});

type PublicProfileContractorBinding = {
  id: string;
  userId: string | null;
  businessId: string | null;
  companyName: string;
  slug: string;
};

async function getPublicProfileContractorBinding(
  profileId: string,
  profileSlug: string,
  ownerUserId: string,
  businessId: string | null | undefined
): Promise<PublicProfileContractorBinding | null> {
  const normalizedProfileId = String(profileId || "").trim();
  const normalizedProfileSlug = String(profileSlug || "").trim();
  const normalizedOwnerUserId = String(ownerUserId || "").trim();
  const normalizedBusinessId = String(businessId || "").trim();
  if (
    !normalizedProfileId ||
    !normalizedProfileSlug ||
    !normalizedOwnerUserId ||
    !normalizedBusinessId
  ) {
    return null;
  }

  const candidates = await db
    .select({
      id: contractors.id,
      userId: contractors.userId,
      businessId: contractors.businessId,
      companyName: contractors.companyName,
      slug: contractors.slug,
      isActive: contractors.isActive,
      verifiedLicensed: contractors.verifiedLicensed,
      verifiedInsured: contractors.verifiedInsured,
      isGeneralContractor: contractors.isGeneralContractor,
      isResidentialContractor: contractors.isResidentialContractor,
      acceptsSubcontractWork: contractors.acceptsSubcontractWork,
    })
    .from(contractors)
    .innerJoin(
      businesses,
      and(
        eq(businesses.id, normalizedBusinessId),
        eq(businesses.ownerUserId, normalizedOwnerUserId),
        eq(businesses.status, "active")
      )
    )
    .innerJoin(
      profiles,
      and(
        eq(profiles.id, normalizedProfileId),
        eq(profiles.slug, normalizedProfileSlug),
        eq(profiles.ownerUserId, normalizedOwnerUserId),
        eq(profiles.businessId, normalizedBusinessId),
        eq(profiles.status, "published")
      )
    )
    .where(
      and(
        eq(contractors.businessId, normalizedBusinessId),
        eq(contractors.slug, normalizedProfileSlug),
        or(
          eq(contractors.userId, normalizedOwnerUserId),
          and(
            eq(contractors.id, JW_STONE_RECOMMENDATION_COMPATIBILITY.contractorId),
            isNull(contractors.userId),
            eq(contractors.isActive, false),
            eq(contractors.verifiedLicensed, false),
            eq(contractors.verifiedInsured, false),
            eq(contractors.isGeneralContractor, false),
            eq(contractors.isResidentialContractor, false),
            eq(contractors.acceptsSubcontractWork, false)
          )
        )
      )
    )
    .limit(2);

  const matches = candidates.filter((candidate) =>
    isExactPublicProfileContractorBindingCandidate(candidate, {
      profileId: normalizedProfileId,
      profileSlug: normalizedProfileSlug,
      ownerUserId: normalizedOwnerUserId,
      businessId: normalizedBusinessId,
    })
  );

  // Recommendations still use a legacy contractor foreign key. The adapter
  // must identify exactly one row matching this published profile, its active
  // business, their shared owner, and the canonical profile slug. A dedicated
  // business adapter may intentionally have no contractor user identity; a
  // row attributed to another user is never accepted. Never fall back to
  // another company owned by the same account, and fail closed if legacy data
  // contains duplicate or conflicting bindings.
  return matches.length === 1 ? matches[0] : null;
}

function recordProfileView(profileId: string, req: any): void {
  const userAgent = String(req?.headers?.["user-agent"] || "");
  const { actorType } = detectActorFromUserAgent(userAgent);
  if (actorType === "bot") return;

  const { ip } = getClientIp(req);
  const referrer = String(req?.headers?.referer || req?.headers?.referrer || "").slice(0, 512);
  const viewerUserId = getAuthedUserId(req) || null;

  void db
    .insert(profileViewEvents)
    .values({
      profileId,
      viewerUserId,
      referrer: referrer || null,
      userAgent: userAgent.slice(0, 512) || null,
      ipHash: hashIp(ip) || null,
    })
    .catch((error) => {
      console.error("[profiles] Failed recording profile view:", { profileId, error });
    });
}

const sendPublicProfileBySlug = async (slug: string, res: any, req?: any) => {
  const viewerUserId = req ? getAuthedUserId(req) : "";
  const [profileOwner] = await db
    .select({ profileId: profiles.id, ownerUserId: profiles.ownerUserId })
    .from(profiles)
    .where(eq(profiles.slug, slug))
    .limit(1);
  const ownerUserId = String(profileOwner?.ownerUserId || "").trim();
  if (!ownerUserId) {
    return res.status(404).json({ message: "Profile not found" });
  }
  const authenticatedViewerCanManage = Boolean(
    req && canAuthenticatedViewerPreviewProfile(req, ownerUserId)
  );
  // Only a proven owner/staff manager may use the draft-capable management
  // read. Anonymous and unrelated authenticated viewers always use
  // the complete profile-scoped visibility + business trust boundary.
  const profile = authenticatedViewerCanManage
    ? await storage.getProfileBySlugForManagement(slug)
    : await storage.getProfileBySlugPublic(slug);
  if (!profile || String(profile.id) !== String(profileOwner?.profileId || "")) {
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(404).json({ message: "Profile not found" });
  }

  const [ownerUser] = await db.select().from(users).where(eq(users.id, ownerUserId)).limit(1);
  if (!ownerUser) {
    return res.status(404).json({ message: "Profile not found" });
  }

  if (authenticatedViewerCanManage) {
    // This response differs from the anonymous trust-gated response. Mark it
    // private before any downstream work so an intermediary cannot cache an
    // owner's preview and serve it to the public.
    res.setHeader("Cache-Control", "private, no-store");
  }

  const now = new Date();
  const ownerRoles = Array.isArray(ownerUser.roles) ? ownerUser.roles : [];
  const isContractorRole = [ownerUser.role, profile.roleContext, ...ownerRoles].some((role) =>
    CONTRACTOR_VERIFICATION_ROLES.has(
      String(role || "")
        .trim()
        .toLowerCase()
    )
  );
  const currentCredentialStatuses: Record<"license" | "insurance", string | null> = {
    license: null,
    insurance: null,
  };
  if (isContractorRole) {
    const currentCredentialRows = await db
      .select({
        verificationType: businessVerifications.verificationType,
        status: businessVerifications.status,
        expiresAt: businessVerifications.expiresAt,
      })
      .from(businessVerifications)
      .where(
        and(
          eq(businessVerifications.providerUserId, ownerUserId),
          or(
            eq(businessVerifications.verificationType, "license"),
            eq(businessVerifications.verificationType, "insurance")
          )
        )
      )
      .orderBy(
        desc(sql`COALESCE(${businessVerifications.verifiedAt}, ${businessVerifications.createdAt})`)
      );
    for (const row of currentCredentialRows) {
      const verificationType = String(row.verificationType) as "license" | "insurance";
      if (!Object.prototype.hasOwnProperty.call(currentCredentialStatuses, verificationType)) {
        continue;
      }
      if (currentCredentialStatuses[verificationType] !== null) continue;
      const normalizedStatus = String(row.status || "")
        .trim()
        .toLowerCase();
      currentCredentialStatuses[verificationType] =
        row.expiresAt && row.expiresAt <= now ? "expired" : normalizedStatus;
    }
  }

  const business = profile.businessId
    ? await storage.getBusinessPublicById(profile.businessId)
    : undefined;
  const latestTrustSnapshotScope = ownerUser.countyFips
    ? and(
        eq(trustSnapshots.userId, ownerUserId),
        eq(trustSnapshots.countyFips, String(ownerUser.countyFips))
      )
    : eq(trustSnapshots.userId, ownerUserId);
  const [latestTrustSnapshot] = await db
    .select({
      cvsScore: trustSnapshots.cvsScore,
      verificationStatus: trustSnapshots.verificationStatus,
      licenseStatus: trustSnapshots.licenseStatus,
      insuranceStatus: trustSnapshots.insuranceStatus,
      computedAt: trustSnapshots.computedAt,
      countyFips: trustSnapshots.countyFips,
      riskFlags: trustSnapshots.riskFlags,
      version: trustSnapshots.version,
    })
    .from(trustSnapshots)
    .where(latestTrustSnapshotScope)
    .orderBy(desc(trustSnapshots.computedAt))
    .limit(1);
  let firstTrustSnapshot: { cvsScore: string; computedAt: Date | null } | undefined;
  let prior30DayTrustSnapshot: { cvsScore: string; computedAt: Date | null } | undefined;
  if (
    latestTrustSnapshot?.computedAt &&
    latestTrustSnapshot.countyFips &&
    latestTrustSnapshot.version != null
  ) {
    const lifetimeTrustSnapshotScope = and(
      eq(trustSnapshots.userId, ownerUserId),
      eq(trustSnapshots.countyFips, latestTrustSnapshot.countyFips),
      eq(trustSnapshots.version, latestTrustSnapshot.version)
    );
    const thirtyDayTarget = new Date(now.getTime() - THIRTY_DAY_COMPARATOR_TARGET_MS);
    const thirtyDayWindowStart = new Date(
      thirtyDayTarget.getTime() - THIRTY_DAY_COMPARATOR_TOLERANCE_MS
    );
    const thirtyDayWindowEnd = new Date(
      thirtyDayTarget.getTime() + THIRTY_DAY_COMPARATOR_TOLERANCE_MS
    );
    const [[firstSnapshot], prior30DayCandidates] = await Promise.all([
      db
        .select({
          cvsScore: trustSnapshots.cvsScore,
          computedAt: trustSnapshots.computedAt,
        })
        .from(trustSnapshots)
        .where(lifetimeTrustSnapshotScope)
        .orderBy(asc(trustSnapshots.computedAt))
        .limit(1),
      db
        .select({
          cvsScore: trustSnapshots.cvsScore,
          computedAt: trustSnapshots.computedAt,
        })
        .from(trustSnapshots)
        .where(
          and(
            lifetimeTrustSnapshotScope,
            gte(trustSnapshots.computedAt, thirtyDayWindowStart),
            lte(trustSnapshots.computedAt, thirtyDayWindowEnd)
          )
        )
        .orderBy(desc(trustSnapshots.computedAt))
        .limit(10),
    ]);
    firstTrustSnapshot = firstSnapshot;
    prior30DayTrustSnapshot = prior30DayCandidates.reduce(
      (
        closest: { cvsScore: string; computedAt: Date | null } | undefined,
        candidate: { cvsScore: string; computedAt: Date | null }
      ) => {
        if (!candidate.computedAt) return closest;
        if (!closest?.computedAt) return candidate;
        const candidateDistance = Math.abs(
          candidate.computedAt.getTime() - thirtyDayTarget.getTime()
        );
        const closestDistance = Math.abs(closest.computedAt.getTime() - thirtyDayTarget.getTime());
        return candidateDistance < closestDistance ? candidate : closest;
      },
      undefined as { cvsScore: string; computedAt: Date | null } | undefined
    );
  }
  const currentVerificationStatus = String(ownerUser.verificationStatus || "")
    .trim()
    .toLowerCase();
  const snapshotVerificationStatus = String(latestTrustSnapshot?.verificationStatus || "")
    .trim()
    .toLowerCase();
  // Current account state is authoritative. A rejected/suspended account or a
  // newly unverified address must override yesterday's approved snapshot.
  const publicVerificationStatus = currentVerificationStatus || snapshotVerificationStatus;
  const latestSnapshotAgeMs = latestTrustSnapshot?.computedAt
    ? now.getTime() - latestTrustSnapshot.computedAt.getTime()
    : Number.POSITIVE_INFINITY;
  const snapshotIsFresh =
    latestSnapshotAgeMs >= 0 && latestSnapshotAgeMs <= PUBLIC_TRUST_SNAPSHOT_MAX_AGE_MS;
  const snapshotVerificationMatchesCurrent =
    Boolean(currentVerificationStatus) && currentVerificationStatus === snapshotVerificationStatus;
  const currentCredentialHardFailure = (
    Object.keys(currentCredentialStatuses) as Array<keyof typeof currentCredentialStatuses>
  ).some((type) => {
    const status = currentCredentialStatuses[type];
    return status !== null && status !== "approved";
  });
  const currentCredentialsMatchSnapshot = (
    Object.keys(currentCredentialStatuses) as Array<keyof typeof currentCredentialStatuses>
  ).every((type) => {
    const currentStatus = currentCredentialStatuses[type];
    if (currentStatus === null) return true;
    const snapshotStatus = String(
      type === "license"
        ? latestTrustSnapshot?.licenseStatus || ""
        : latestTrustSnapshot?.insuranceStatus || ""
    )
      .trim()
      .toLowerCase();
    return currentStatus === snapshotStatus;
  });
  const currentTrustStateEligible =
    publicVerificationStatus === "approved" &&
    ownerUser.addressVerified === true &&
    !currentCredentialHardFailure;
  const snapshotCvsScore = Number(latestTrustSnapshot?.cvsScore);
  const snapshotRiskFlags = Array.isArray(latestTrustSnapshot?.riskFlags)
    ? latestTrustSnapshot.riskFlags
    : [];
  const snapshotBoostEligible =
    snapshotIsFresh &&
    snapshotVerificationMatchesCurrent &&
    currentCredentialsMatchSnapshot &&
    currentTrustStateEligible &&
    !snapshotRiskFlags.some((flag) =>
      [
        "unverified_address",
        "verification_not_approved",
        "license_unverified",
        "insurance_unverified",
        "verification_rejected",
        "verification_suspended",
      ].includes(String(flag))
    );
  let activeCvsBoosts: ActiveCvsBoost[] = [];
  let publicCvsScore: number | null = null;
  let publicCvsPerformanceScore: number | null = null;
  if (
    Number.isFinite(snapshotCvsScore) &&
    latestTrustSnapshot?.computedAt &&
    snapshotIsFresh &&
    snapshotVerificationMatchesCurrent &&
    currentCredentialsMatchSnapshot &&
    currentTrustStateEligible
  ) {
    if (!snapshotBoostEligible) {
      // The scorer does not apply policy boosts until all verification gates
      // pass, even if a grant exists in the ledger.
      publicCvsPerformanceScore = Math.min(100, Math.max(0, snapshotCvsScore));
      publicCvsScore = snapshotCvsScore;
    } else {
      try {
        const currentBoostAsOf = now;
        const [snapshotCvsBoosts, currentCvsBoosts] = await Promise.all([
          getActiveCvsBoosts(ownerUserId, latestTrustSnapshot.computedAt),
          getActiveCvsBoosts(ownerUserId, currentBoostAsOf),
        ]);
        const snapshotCvsBoostPoints = snapshotCvsBoosts.reduce(
          (sum, boost) => sum + boost.points,
          0
        );
        publicCvsPerformanceScore = Math.min(
          100,
          Math.max(0, snapshotCvsScore - snapshotCvsBoostPoints)
        );
        activeCvsBoosts = currentCvsBoosts;
        publicCvsScore =
          publicCvsPerformanceScore + activeCvsBoosts.reduce((sum, boost) => sum + boost.points, 0);
      } catch (error) {
        // Fail closed instead of publishing a historical total with a current
        // boost breakdown that no longer reconciles to it.
        console.warn("[profiles] Failed to reconcile Community Verification Score boosts", {
          ownerUserId,
          error,
        });
      }
    }
  }
  const publicCvsBoostPoints = activeCvsBoosts.reduce((sum, boost) => sum + boost.points, 0);
  const prior30DayScore = Number(prior30DayTrustSnapshot?.cvsScore);
  const publicScoreChange30d =
    publicCvsScore !== null && Number.isFinite(prior30DayScore)
      ? Number((publicCvsScore - prior30DayScore).toFixed(2))
      : null;
  const firstSnapshotScore = Number(firstTrustSnapshot?.cvsScore);
  const hasDistinctLifetimeSnapshot = Boolean(
    firstTrustSnapshot?.computedAt &&
    latestTrustSnapshot?.computedAt &&
    firstTrustSnapshot.computedAt.getTime() < latestTrustSnapshot.computedAt.getTime()
  );
  const publicLifetimeScoreChange =
    publicCvsScore !== null && hasDistinctLifetimeSnapshot && Number.isFinite(firstSnapshotScore)
      ? Number((publicCvsScore - firstSnapshotScore).toFixed(2))
      : null;
  const ownerPreferences =
    ownerUser.preferences && typeof ownerUser.preferences === "object" ? ownerUser.preferences : {};
  const profileScopedSections = readProfileSectionConfigBlock(profile.contentBlocks);
  const profileSections =
    profileScopedSections ??
    (profile.profileSections && typeof profile.profileSections === "object"
      ? profile.profileSections
      : ownerPreferences.profileSections && typeof ownerPreferences.profileSections === "object"
        ? ownerPreferences.profileSections
        : {});
  const ownerAllowsPublicBadges =
    ownerPreferences.badges?.show !== false && profileSections.rolesAndBadges !== false;
  const publicProfileBadges = !ownerAllowsPublicBadges
    ? []
    : Array.from(
        new Set(
          [
            ...(Array.isArray(ownerUser.badges) ? ownerUser.badges : []),
            ...(ownerRoles.includes("community_builder") ? ["Community Builder Badge"] : []),
          ]
            .filter((badge): badge is string => typeof badge === "string")
            .map((badge) => badge.trim())
            .filter(Boolean)
        )
      );
  const isPubliclyVerified =
    currentTrustStateEligible &&
    snapshotIsFresh &&
    snapshotVerificationMatchesCurrent &&
    currentCredentialsMatchSnapshot &&
    ownerUser.verifiedBadge === true;
  let directConnectOwnerUserId: string | undefined;
  let ownerConfirmedDirectProfile = false;
  let unlistedSteelHomeDirectProfile = false;
  let directConnectDeliveryCustody: "business" | "tradescout_pending_owner" = "business";
  let hasGatedDirectConnectPhone = false;
  if (profile.businessId) {
    const [linkedBusiness] = await db
      .select({
        ownerUserId: businesses.ownerUserId,
        sources: businesses.sources,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        status: businesses.status,
        claimStatus: businesses.claimStatus,
        profileData: businesses.profileData,
      })
      .from(businesses)
      .where(eq(businesses.id, profile.businessId!))
      .limit(1);
    const directProfileCandidate = {
      profileSlug: profile.slug,
      // getProfileBySlugPublic only returns published profiles.
      profileStatus: "published",
      profileOwnerUserId: ownerUserId,
      businessStatus: linkedBusiness?.status,
      businessOwnerUserId: linkedBusiness?.ownerUserId,
      publicDiscoveryEnabled: linkedBusiness?.publicDiscoveryEnabled,
      businessSources: linkedBusiness?.sources,
      businessClaimStatus: linkedBusiness?.claimStatus,
      ownerRole: ownerUser.role,
      ownerRoles: ownerUser.roles,
      ownerVerifiedBadge: ownerUser.verifiedBadge,
      ownerVerificationStatus: ownerUser.verificationStatus,
      ownerProvider: ownerUser.provider,
      ownerPreferences: ownerUser.preferences,
    };
    ownerConfirmedDirectProfile = isOwnerConfirmedDirectProfile(directProfileCandidate);
    unlistedSteelHomeDirectProfile =
      isSteelHomePackagesUnlistedDirectProfile(directProfileCandidate);
    directConnectDeliveryCustody = hasTradeScoutPendingOwnerCustody(directProfileCandidate)
      ? "tradescout_pending_owner"
      : "business";
    if (
      !canServeLinkedBusinessProfileToViewer({
        ownerUser,
        ownerConfirmedDirectProfile: ownerConfirmedDirectProfile || unlistedSteelHomeDirectProfile,
        authenticatedViewerCanManage,
      })
    ) {
      // Trust-gated 404s are viewer-sensitive. Prevent negative cache entries
      // from blocking a later authenticated owner/admin preview.
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(404).json({ message: "Profile not found" });
    }
    directConnectOwnerUserId = ownerUserId;
    const linkedProfileData = (linkedBusiness?.profileData || {}) as Record<string, unknown>;
    const gatedPhone = linkedProfileData.phone || ownerUser.phone;
    hasGatedDirectConnectPhone = hasDirectConnectPhone(gatedPhone);
  }
  const safeBusiness = business
    ? {
        id: business.id,
        name: business.name,
        categories: business.categories || [],
        services: business.services || [],
        serviceAreas: business.serviceAreas || [],
        tradePartner: business.tradePartner === true,
        // Temporary admin stewardship is not evidence about the steel-home
        // package business. Never project the steward's trust state onto it.
        verificationStatus: unlistedSteelHomeDirectProfile
          ? null
          : publicVerificationStatus || null,
        verifiedBadge: unlistedSteelHomeDirectProfile ? false : isPubliclyVerified,
        cvsScore: unlistedSteelHomeDirectProfile ? null : publicCvsScore,
        cvsPerformanceScore: unlistedSteelHomeDirectProfile ? null : publicCvsPerformanceScore,
        cvsBoostPoints: unlistedSteelHomeDirectProfile ? null : publicCvsBoostPoints,
        trustComputedAt: unlistedSteelHomeDirectProfile
          ? null
          : latestTrustSnapshot?.computedAt?.toISOString?.() || null,
        communityVerification: unlistedSteelHomeDirectProfile
          ? null
          : {
              score: publicCvsScore,
              scoreHistoryStartsAt: firstTrustSnapshot?.computedAt?.toISOString?.() || null,
              lifetimeScoreChange: publicLifetimeScoreChange,
              scoreChange30d: publicScoreChange30d,
              scoreChange30dComparedAt:
                prior30DayTrustSnapshot?.computedAt?.toISOString?.() || null,
              activePolicyBoostPoints: publicCvsBoostPoints,
              activeBoosts: activeCvsBoosts,
              badges: publicProfileBadges,
              computedAt: latestTrustSnapshot?.computedAt?.toISOString?.() || null,
            },
        expressContactCapabilities: {
          // Public profiles always preserve the Direct Connect gate. A phone
          // number stored for private routing never becomes a bypass.
          call: hasGatedDirectConnectPhone,
          request: Boolean(directConnectOwnerUserId),
          deliveryCustody: directConnectDeliveryCustody,
        },
        ...(business.city ? { city: business.city } : {}),
        ...(business.stateCode ? { stateCode: business.stateCode } : {}),
        ...(business.tradePartner === true && (business.address || business.zipCode)
          ? {
              address: business.address || undefined,
              zipCode: business.zipCode || undefined,
            }
          : {}),
        ...(business.brandColors ? { brandColors: business.brandColors } : {}),
        // Targeting remains limited to a TradePartner or the explicit narrow
        // owner-confirmed profile exception. Other approved profiles still use
        // the slug-based Express Direct Connect resolver without exposing an id.
        ...((business.tradePartner === true || ownerConfirmedDirectProfile) &&
        directConnectOwnerUserId
          ? { directConnectOwnerUserId }
          : {}),
      }
    : null;
  const effectiveSeoMeta = buildAutoSeoMeta({
    displayName: profile.displayName,
    roleContext: profile.roleContext,
    headline: profile.headline,
    business: safeBusiness,
    servicesDescription: profile.servicesDescription,
    seoMeta: profile.seoMeta,
  });

  let recommendationsDirectory: Array<{
    id: string;
    createdAt: string | null;
    recommendationType: "positive" | "negative";
    comment: string;
    projectType: string | null;
    customerName: string;
    contractor: {
      id: string;
      companyName: string;
      slug: string;
      canonicalBusinessProfileUrl: string | null;
    };
  }> = [];
  let recommendationDirectorySummary = {
    total: 0,
    positive: 0,
    negative: 0,
  };
  let recommendationDirectoryMode: "received" | "authored" = "authored";

  try {
    const hasLinkedBusiness = Boolean(profile.businessId);
    const ownerContractor = await getPublicProfileContractorBinding(
      profile.id,
      profile.slug,
      ownerUserId,
      profile.businessId
    );
    recommendationDirectoryMode = hasLinkedBusiness ? "received" : "authored";
    if (ownerUserId && (ownerContractor || !hasLinkedBusiness)) {
      const rows = await db
        .select({
          id: recommendations.id,
          createdAt: recommendations.createdAt,
          recommendationType: recommendations.recommendationType,
          comment: recommendations.comment,
          projectType: recommendations.projectType,
          customerName: recommendations.customerName,
          contractorId: contractors.id,
          contractorUserId: contractors.userId,
          contractorCompanyName: contractors.companyName,
          contractorSlug: contractors.slug,
        })
        .from(recommendations)
        .innerJoin(contractors, eq(recommendations.contractorId, contractors.id))
        .where(
          and(
            hasLinkedBusiness && ownerContractor
              ? // Business/provider profiles show approved experiences they
                // received. Community profiles retain the existing directory
                // of recommendations the member authored about providers.
                eq(recommendations.contractorId, ownerContractor.id)
              : eq(recommendations.userId, ownerUserId),
            eq(recommendations.isPublic, true),
            eq(recommendations.moderationStatus, "approved")
          )
        )
        .orderBy(desc(recommendations.createdAt))
        .limit(100);

      const canonicalBusinessUrlByUserId = new Map<string, string>();
      if (!hasLinkedBusiness) {
        await Promise.all(
          rows.map(async (row) => {
            const contractorUserId = String(row.contractorUserId || "").trim();
            if (!contractorUserId || canonicalBusinessUrlByUserId.has(contractorUserId)) return;

            const businessProfile = await storage.getBusinessProfileByUserId(contractorUserId);
            const [contractorUser] = await db
              .select()
              .from(users)
              .where(eq(users.id, contractorUserId))
              .limit(1);
            const canShowBusinessProfile =
              businessProfile?.visibility === "public" &&
              typeof businessProfile.slug === "string" &&
              businessProfile.slug.trim() &&
              isBusinessDiscoverable(contractorUser);
            if (canShowBusinessProfile) {
              canonicalBusinessUrlByUserId.set(
                contractorUserId,
                `/business/${encodeURIComponent(businessProfile.slug.trim())}`
              );
            }
          })
        );
      }

      recommendationsDirectory = rows
        .filter((row) => {
          const type = String(row.recommendationType || "").toLowerCase();
          return type === "positive" || type === "negative";
        })
        .map((row) => ({
          id: String(row.id),
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
          recommendationType: String(row.recommendationType).toLowerCase() as
            | "positive"
            | "negative",
          comment: String(row.comment || ""),
          projectType: row.projectType ? String(row.projectType) : null,
          customerName: String(row.customerName || "TradeScout member"),
          contractor: {
            id: String(row.contractorId),
            companyName: String(row.contractorCompanyName || "Service provider"),
            slug: String(row.contractorSlug || ""),
            // This directory already lives on the provider's canonical
            // profile, so linking each customer quote back to the same
            // provider page would be a circular and misleading attribution.
            canonicalBusinessProfileUrl: hasLinkedBusiness
              ? null
              : (canonicalBusinessUrlByUserId.get(String(row.contractorUserId || "").trim()) ??
                null),
          },
        }));

      recommendationDirectorySummary = recommendationsDirectory.reduce(
        (summary, row) => {
          summary.total += 1;
          if (row.recommendationType === "positive") summary.positive += 1;
          if (row.recommendationType === "negative") summary.negative += 1;
          return summary;
        },
        { total: 0, positive: 0, negative: 0 }
      );
    }
  } catch (error) {
    console.error("[profiles] Failed loading public recommendation directory:", {
      slug,
      error,
    });
  }

  let publicProfileOffers: Array<Record<string, unknown>> = [];
  let publicHandmadeProducts: Array<Record<string, unknown>> = [];
  let publicMarketplaceListings: PublicBusinessListingCard[] = [];
  let publicHomeScoutListings: PublicHomeScoutListingCard[] = [];
  let publicContractorPromos: PublicContractorPromoCard[] = [];
  let publicCommunityPosts: Array<Record<string, unknown>> = [];
  let canExposeCommercialItems = false;

  try {
    const exposureAuthority = await buildExposureAuthorityMap([ownerUserId]);
    canExposeCommercialItems = exposureAuthority[ownerUserId] === true;
  } catch (error) {
    // Fail closed for commercial exposure without hiding the public profile.
    console.error("[profiles] Failed resolving listing exposure authority:", { slug, error });
  }

  if (canExposeCommercialItems && profileSections.services !== false) {
    try {
      const contractor = await storage.getContractorByUserId(ownerUserId);
      if (contractor) {
        const promos = await storage.getContractorPromos(contractor.id);
        publicContractorPromos = buildPublicContractorPromoCards({
          promos,
          providerPhotos: contractor.photos,
        });
      }
    } catch (error) {
      console.error("[profiles] Failed loading public contractor promotions:", { slug, error });
    }
  }

  if (
    canExposeCommercialItems &&
    (profileSections.services !== false || profileSections.marketplaceListings !== false)
  ) {
    try {
      const offerRows = await pool.query(
        `SELECT *
         FROM profile_offers
         WHERE seller_user_id = $1
           AND is_active = true
         ORDER BY updated_at DESC, created_at DESC
         LIMIT 8`,
        [ownerUserId]
      );
      publicProfileOffers = offerRows.rows
        .map(toPublicProfileOffer)
        .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
        .map(({ sellerUserId: _sellerUserId, ...offer }) => offer);
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("profile_offers") && error?.code !== "42P01") {
        console.error("[profiles] Failed loading public profile offers:", { slug, error });
      }
    }
  }

  if (canExposeCommercialItems && profileSections.marketplaceListings !== false) {
    try {
      const products = await storage.getHandmadeProducts({ sellerId: ownerUserId, limit: 8 });
      publicHandmadeProducts = products.map((product) => ({
        id: String(product.id),
        title: sanitizePublicProfileOfferText(product.title).slice(0, 200),
        price: String(product.price || "0"),
        currency: String(product.currency || "USD")
          .toUpperCase()
          .slice(0, 3),
        city: product.city ? String(product.city) : null,
        stateCode: product.stateCode ? String(product.stateCode) : null,
        imageUrls: listHandmadeProductImageUrls(product),
      }));
    } catch (error) {
      console.error("[profiles] Failed loading public Handmade products:", { slug, error });
    }

    try {
      const [listings, categories] = await Promise.all([
        storage.getMarketplaceListings({
          sellerId: ownerUserId,
          status: "active",
          sortBy: "date_desc",
          limit: 6,
          offset: 0,
        }),
        storage.getMarketplaceCategories(),
      ]);
      publicMarketplaceListings = buildPublicBusinessListingCards({ listings, categories });
    } catch (error) {
      console.error("[profiles] Failed loading public Exchange listings:", { slug, error });
    }

    try {
      const linkedListings = await db
        .select()
        .from(homeScoutListings)
        .where(
          and(
            eq(homeScoutListings.status, "active"),
            or(
              eq(homeScoutListings.sellerUserId, ownerUserId),
              eq(homeScoutListings.agentUserId, ownerUserId),
              eq(homeScoutListings.contactUserId, ownerUserId)
            )
          )
        )
        .orderBy(desc(homeScoutListings.updatedAt))
        .limit(24);
      const authorityUserIds = linkedListings.map((listing) =>
        String(listing.contactUserId || listing.agentUserId || listing.sellerUserId || "").trim()
      );
      const listingAuthority = await buildExposureAuthorityMap(authorityUserIds);
      publicHomeScoutListings = buildPublicHomeScoutListingCards(
        linkedListings.filter((listing) => {
          const authorityUserId = String(
            listing.contactUserId || listing.agentUserId || listing.sellerUserId || ""
          ).trim();
          return listingAuthority[authorityUserId] === true;
        })
      );
    } catch (error) {
      console.error("[profiles] Failed loading public HomeScout listings:", { slug, error });
    }
  }

  if (profileSections.communityActivity !== false) {
    try {
      const posts = await storage.getCommunityPosts({ authorId: ownerUserId, limit: 6 });
      publicCommunityPosts = posts.map((post) => ({
        id: String(post.id),
        title: sanitizePublicProfileOfferText(post.title || "Community post").slice(0, 200),
        content: sanitizePublicProfileOfferText(post.content).slice(0, 500),
        imageUrls: listCommunityPostImageUrls(post.imageUrls),
        category: post.category ? String(post.category) : null,
        createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : null,
      }));
    } catch (error) {
      console.error("[profiles] Failed loading public community activity:", { slug, error });
    }
  }

  let viewerCanManage = authenticatedViewerCanManage;

  // The session cookie for thetradescout.com never reaches a business's
  // custom domain (different browser origin), so a manager who is already
  // authenticated there can hop over with a short-lived, profile-scoped
  // bridge token instead. Re-derive authority from the DB rather than
  // trusting anything embedded in the token.
  let bridgeTokenToPersist: string | null = null;
  if (!viewerCanManage && req) {
    const candidateToken =
      typeof req.query?.admin_token === "string"
        ? req.query.admin_token
        : readRawCookie(req, PROFILE_MANAGE_BRIDGE_COOKIE);
    const bridged = verifyManageBridgeToken(candidateToken);
    if (bridged && bridged.profileId === profile.id) {
      const bridgedUser = await storage.getUser(bridged.uid);
      const bridgedRole = String((bridgedUser as any)?.role || "")
        .trim()
        .toLowerCase();
      const bridgedIsManager =
        Boolean(bridgedUser) &&
        (bridgedUser!.id === ownerUserId ||
          bridgedRole === "super_admin" ||
          bridgedRole === "head_admin");
      if (bridgedIsManager) {
        viewerCanManage = true;
        if (typeof req.query?.admin_token === "string") bridgeTokenToPersist = candidateToken;
      }
    }
  }
  if (bridgeTokenToPersist && res) {
    res.cookie(PROFILE_MANAGE_BRIDGE_COOKIE, bridgeTokenToPersist, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PROFILE_MANAGE_BRIDGE_TTL_SECONDS * 1000,
      // No `domain` set: host-only, scoped to whichever origin the request
      // actually landed on (the custom domain), never thetradescout.com.
    });
  }
  const hasLocalServicePresentation = Array.isArray(profile.contentBlocks)
    ? profile.contentBlocks.some(
        (block: any) => block && typeof block === "object" && block.type === "localServiceProfile"
      )
    : false;
  const siteTemplate = resolveSiteTemplateId({
    slug: profile.slug,
    contentBlocks: profile.contentBlocks,
    tradePartner: safeBusiness?.tradePartner === true,
    hasLocalServicePresentation,
  });

  // Public caches must not store viewerCanManage — it is session-specific.
  if (viewerCanManage || viewerUserId) {
    res.setHeader("Cache-Control", "private, no-store");
  } else {
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  }

  if (req) recordProfileView(profile.id, req);

  return res.json({
    profile: {
      id: profile.id,
      slug: profile.slug,
      roleContext: profile.roleContext,
      displayName: profile.displayName,
      headline: profile.headline,
      contentBlocks: profile.contentBlocks,
      ctaConfig: sanitizePublicCtaConfig(profile.ctaConfig),
      seoMeta: effectiveSeoMeta,
      profileSections,
      profileBooking: sanitizePublicProfileBookingConfig(profile.profileBooking),
      siteTemplate,
      contactPolicy: {
        mode: "direct_connect_only",
        requiresTradeScoutAccount: false,
        reason: "Spam prevention",
      },
    },
    business: safeBusiness,
    viewerCanManage,
    recommendationsDirectory,
    recommendationDirectorySummary,
    recommendationDirectoryMode,
    profileItems: {
      offers: publicProfileOffers,
      handmadeProducts: publicHandmadeProducts,
      marketplaceListings: publicMarketplaceListings,
      homeScoutListings: publicHomeScoutListings,
      contractorPromos: publicContractorPromos,
      communityPosts: publicCommunityPosts,
    },
  });
};

const publicProfileTrustActionSchema = z.enum(["like", "favorite"]);

type PublicProfileTrustContext = {
  profileId: string;
  profileSlug: string;
  ownerUserId: string;
  contractor: { id: string; companyName: string } | null;
};

async function getPublicProfileTrustContext(
  rawSlug: string
): Promise<PublicProfileTrustContext | null> {
  const slug = rawSlug.trim();
  if (!slug) return null;

  const profile = await storage.getProfileBySlugPublic(slug);
  if (!profile) return null;

  const [profileOwner] = await db
    .select({ ownerUserId: profiles.ownerUserId })
    .from(profiles)
    .where(eq(profiles.id, profile.id))
    .limit(1);
  const ownerUserId = String(profileOwner?.ownerUserId || "").trim();
  if (!ownerUserId) return null;

  const [ownerUser] = await db.select().from(users).where(eq(users.id, ownerUserId)).limit(1);
  if (!ownerUser) return null;

  if (profile.businessId) {
    const [linkedBusiness] = await db
      .select({
        ownerUserId: businesses.ownerUserId,
        sources: businesses.sources,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        status: businesses.status,
        claimStatus: businesses.claimStatus,
      })
      .from(businesses)
      .where(eq(businesses.id, profile.businessId))
      .limit(1);
    const ownerConfirmedDirectProfile = isOwnerConfirmedDirectProfile({
      profileSlug: profile.slug,
      profileStatus: "published",
      profileOwnerUserId: ownerUserId,
      businessStatus: linkedBusiness?.status,
      businessOwnerUserId: linkedBusiness?.ownerUserId,
      publicDiscoveryEnabled: linkedBusiness?.publicDiscoveryEnabled,
      businessSources: linkedBusiness?.sources,
      businessClaimStatus: linkedBusiness?.claimStatus,
      ownerProvider: ownerUser.provider,
      ownerPreferences: ownerUser.preferences,
    });
    if (!isBusinessDiscoverable(ownerUser) && !ownerConfirmedDirectProfile) return null;
  }

  const contractor = await getPublicProfileContractorBinding(
    profile.id,
    profile.slug,
    ownerUserId,
    profile.businessId
  );
  return {
    profileId: String(profile.id),
    profileSlug: String(profile.slug),
    ownerUserId,
    contractor: contractor
      ? {
          id: String(contractor.id),
          companyName: String(contractor.companyName || profile.displayName),
        }
      : null,
  };
}

async function readPublicProfileTrustActions(
  context: PublicProfileTrustContext,
  viewerUserId: string
) {
  const [engagementCounts, viewerRows, recommendationRows] = await Promise.all([
    db
      .select({
        action: publicProfileEngagements.action,
        total: sql<number>`count(*)::int`,
      })
      .from(publicProfileEngagements)
      .where(eq(publicProfileEngagements.profileId, context.profileId))
      .groupBy(publicProfileEngagements.action),
    viewerUserId
      ? db
          .select({ action: publicProfileEngagements.action })
          .from(publicProfileEngagements)
          .where(
            and(
              eq(publicProfileEngagements.profileId, context.profileId),
              eq(publicProfileEngagements.userId, viewerUserId)
            )
          )
      : Promise.resolve([]),
    context.contractor
      ? db
          .select({ total: sql<number>`count(*)::int` })
          .from(recommendations)
          .where(
            and(
              eq(recommendations.contractorId, context.contractor.id),
              eq(recommendations.recommendationType, "positive"),
              eq(recommendations.isPublic, true),
              eq(recommendations.moderationStatus, "approved")
            )
          )
      : Promise.resolve([{ total: 0 }]),
  ]);

  const totals = new Map(engagementCounts.map((row) => [row.action, Number(row.total || 0)]));
  const viewerActions = new Set(viewerRows.map((row) => row.action));

  return {
    profileSlug: context.profileSlug,
    likeCount: totals.get("like") || 0,
    favoriteCount: totals.get("favorite") || 0,
    recommendationCount: Number(recommendationRows[0]?.total || 0),
    viewerLiked: viewerActions.has("like"),
    viewerFavorited: viewerActions.has("favorite"),
    viewerIsOwner: Boolean(viewerUserId && viewerUserId === context.ownerUserId),
    recommendationTarget: context.contractor
      ? {
          contractorId: context.contractor.id,
          contractorName: context.contractor.companyName,
        }
      : null,
  };
}

// Public website read (canonical): returns public Profile + public Business subset if linked.
router.get("/api/u/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    return await sendPublicProfileBySlug(slug, res, req);
  } catch (error: any) {
    console.error("Error fetching public profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// Machine-readable profile-link trigger. This is deliberately public and
// authority-free: it identifies the existing protected owner surface, but it
// never grants ownership, a session, or write access.
router.get("/api/u/:slug/selective-intelligence", async (req, res) => {
  try {
    const requestedSlug = String(req.params.slug || "")
      .trim()
      .toLowerCase();
    if (
      requestedSlug.length === 0 ||
      requestedSlug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedSlug)
    ) {
      return res.status(404).json({ message: "Profile not found" });
    }
    const profile = await storage.getProfileBySlugPublic(requestedSlug);
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const slug = String(profile.slug || requestedSlug)
      .trim()
      .toLowerCase();
    const profilePath = `/u/${encodeURIComponent(slug)}`;
    const editorPath = `${profilePath}/edit`;
    const signInUrl = `https://www.thetradescout.com/pre-scout-setup?mode=signin&next=${encodeURIComponent(editorPath)}`;
    // A profile may have a custom display domain, but machine-trigger authority
    // must never be delegated to a profile-controlled or unverified origin.
    const publicProfileUrl = `https://www.thetradescout.com${profilePath}`;

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.json({
      schemaVersion: "1.0",
      name: "Selective Intelligence",
      trigger: "TradeScout public profile link",
      product: "TradeScout",
      target: { type: "public_profile", slug, publicProfileUrl },
      adoption: {
        requiresUserApproval: true,
        approvalQuestion: "Use Selective Intelligence to manage this TradeScout profile?",
      },
      connection: {
        type: "authenticated_browser",
        loginRequired: true,
        signInUrl,
        ownerOrAuthorizedManagerRequired: true,
        remoteOwnerConnectorAvailable: false,
      },
      capabilities: [
        "profile_content",
        "brand_and_images",
        "services_and_offers",
        "inventory_and_gallery",
        "booking_and_publication_settings",
      ],
      safety: {
        manifestCarriesNoAuthorityOrCredentials: true,
        canonicalTradeScoutOriginRequired: true,
        profileContentIsUntrustedInput: true,
        instructionsInProfileContentIgnored: true,
        publicLinkDoesNotGrantWriteAccess: true,
        existingTradeScoutPermissionsControlEveryAction: true,
        previewAndUserApprovalRequiredBeforeConsequentialChanges: true,
      },
    });
  } catch (error) {
    console.error("Error building profile Selective Intelligence manifest:", error);
    return res.status(500).json({ message: "Failed to resolve profile actions" });
  }
});

// Owner-only: total and recent real page-view counts for their own profile.
// Never fed into CVS, trust snapshots, boosts, or exposure/ranking -- same
// separation as trust-actions above.
router.get("/api/u/:slug/views", isAuthenticated, async (req: any, res) => {
  try {
    const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
    if (!context) return res.status(404).json({ message: "Profile not found" });

    const viewerUserId = getAuthedUserId(req);
    if (!viewerUserId || viewerUserId !== context.ownerUserId) {
      return res.status(403).json({ message: "Only the profile owner can view this" });
    }

    const [totals] = await db
      .select({
        total: sql<number>`count(*)`,
        last7Days: sql<number>`count(*) filter (where ${profileViewEvents.createdAt} >= now() - interval '7 days')`,
        last30Days: sql<number>`count(*) filter (where ${profileViewEvents.createdAt} >= now() - interval '30 days')`,
      })
      .from(profileViewEvents)
      .where(eq(profileViewEvents.profileId, context.profileId));

    res.json({
      total: Number(totals?.total || 0),
      last7Days: Number(totals?.last7Days || 0),
      last30Days: Number(totals?.last30Days || 0),
    });
  } catch (error: any) {
    console.error("Error fetching profile view counts:", error);
    res.status(500).json({ message: "Failed to fetch view counts" });
  }
});

// Public-profile actions never write to CVS, trust snapshots, boosts, or
// exposure/ranking state. Recommend continues through the separately
// moderated contractor recommendation endpoint.
router.get("/api/u/:slug/trust-actions", async (req, res) => {
  try {
    const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
    if (!context) return res.status(404).json({ message: "Profile not found" });

    res.setHeader("Cache-Control", "private, no-store");
    return res.json(await readPublicProfileTrustActions(context, getAuthedUserId(req)));
  } catch (error) {
    console.error("[profiles] Failed loading public profile trust actions:", error);
    return res.status(500).json({ message: "Failed to load profile actions" });
  }
});

router.post("/api/u/:slug/trust-actions/:action", isAuthenticated, async (req, res) => {
  try {
    const viewerUserId = getAuthedUserId(req);
    if (!viewerUserId) return res.status(401).json({ message: "Not authenticated" });
    const action = publicProfileTrustActionSchema.parse(req.params.action);
    const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
    if (!context) return res.status(404).json({ message: "Profile not found" });
    if (viewerUserId === context.ownerUserId) {
      return res.status(403).json({
        message: "Profile owners cannot engage with their own profile",
      });
    }

    await db
      .insert(publicProfileEngagements)
      .values({ profileId: context.profileId, userId: viewerUserId, action })
      .onConflictDoNothing();
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(await readPublicProfileTrustActions(context, viewerUserId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Action must be like or favorite" });
    }
    console.error("[profiles] Failed saving public profile trust action:", error);
    return res.status(500).json({ message: "Failed to save profile action" });
  }
});

router.delete("/api/u/:slug/trust-actions/:action", isAuthenticated, async (req, res) => {
  try {
    const viewerUserId = getAuthedUserId(req);
    if (!viewerUserId) return res.status(401).json({ message: "Not authenticated" });
    const action = publicProfileTrustActionSchema.parse(req.params.action);
    const context = await getPublicProfileTrustContext(String(req.params.slug || ""));
    if (!context) return res.status(404).json({ message: "Profile not found" });
    if (viewerUserId === context.ownerUserId) {
      return res.status(403).json({
        message: "Profile owners cannot engage with their own profile",
      });
    }

    await db
      .delete(publicProfileEngagements)
      .where(
        and(
          eq(publicProfileEngagements.profileId, context.profileId),
          eq(publicProfileEngagements.userId, viewerUserId),
          eq(publicProfileEngagements.action, action)
        )
      );
    res.setHeader("Cache-Control", "private, no-store");
    return res.json(await readPublicProfileTrustActions(context, viewerUserId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Action must be like or favorite" });
    }
    console.error("[profiles] Failed removing public profile trust action:", error);
    return res.status(500).json({ message: "Failed to remove profile action" });
  }
});

// Legacy alias for backward compatibility.
router.get("/api/p/:slug", async (req, res) => {
  const requestedSlug = String(req.params.slug || "");
  const slug =
    requestedSlug.trim().toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG
      ? ISSA_BUILD_PROFILE_SLUG
      : requestedSlug;
  const requestUrl = String(req.originalUrl || req.url || "");
  const queryIndex = requestUrl.indexOf("?");
  const querySuffix = queryIndex >= 0 ? requestUrl.slice(queryIndex) : "";
  return res.redirect(301, `/api/u/${encodeURIComponent(slug)}${querySuffix}`);
});

const CRAWLER_PUBLIC_ALLOW_PATHS = [
  "/p/",
  "/u/",
  "/contractors/",
  "/profile/",
  "/business/",
  "/community/",
  "/county/",
  "/trade/",
  "/city/",
  "/datasets/",
  "/best/",
  "/tradepartners/",
  "/homescout/",
  "/homescout/listings/",
  "/exchange/",
  "/llms.txt",
];

// Contract: generated robots.txt includes "Allow: /exchange/" for exchange listings.
const CRAWLER_PRIVATE_DISALLOW_PATHS = [
  "/api/",
  "/admin/",
  "/dashboard/",
  "/settings/",
  "/messages/",
  "/scout/",
  "/auth/",
];

const DISCOVERY_CRAWLER_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "meta-externalagent",
  "meta-externalfetcher",
  "bingbot",
  "msnbot",
  "DuckDuckBot",
  "DuckAssistBot",
  "Applebot",
  "Applebot-Extended",
  "YandexBot",
  "Slurp",
  "OAI-SearchBot",
  "GPTBot",
  "ChatGPT-User",
  "PerplexityBot",
];

function buildRobotsGroup(userAgent: string): string[] {
  return [
    `User-agent: ${userAgent}`,
    ...CRAWLER_PUBLIC_ALLOW_PATHS.map((path) => `Allow: ${path}`),
    ...CRAWLER_PRIVATE_DISALLOW_PATHS.map((path) => `Disallow: ${path}`),
  ];
}

function getIndexNowKey(): string {
  return String(
    process.env.INDEXNOW_KEY || process.env.BING_INDEXNOW_KEY || "c41a532d2d0f4e5ca37a53bd3d138495"
  ).trim();
}

router.get(
  [
    "/indexnow-key.txt",
    "/804ab104bac2473e8396bcc4d1112c2d.txt",
    "/c41a532d2d0f4e5ca37a53bd3d138495.txt",
  ],
  async (req, res) => {
    const indexNowKey =
      req.path === "/804ab104bac2473e8396bcc4d1112c2d.txt"
        ? "804ab104bac2473e8396bcc4d1112c2d"
        : getIndexNowKey();
    if (!indexNowKey) {
      res.status(404).type("text/plain").send("IndexNow key is not configured.\n");
      return;
    }

    res.type("text/plain").send(`${indexNowKey}\n`);
  }
);

router.get("/robots.txt", async (req, res) => {
  const baseUrl = getCanonicalBaseUrl(req);
  res.type("text/plain");
  res.send(
    [
      ...buildRobotsGroup("*"),
      "",
      ...DISCOVERY_CRAWLER_USER_AGENTS.flatMap((userAgent) => [...buildRobotsGroup(userAgent), ""]),
      `Sitemap: ${baseUrl}/sitemap.xml`,
      `Sitemap: ${baseUrl}/sitemap-index.xml`,
      "",
    ].join("\n")
  );
});

router.get("/llms.txt", async (req, res) => {
  const baseUrl = getCanonicalBaseUrl(req);
  res.type("text/plain");
  res.send(
    [
      "TradeScout public web guidance for AI/LLM crawlers",
      "",
      "Canonical host:",
      `${baseUrl}`,
      "",
      "What TradeScout is:",
      "TradeScout is a county-first local operating system for finding trusted trade help, coordinating home and community work, and routing action through gated trust flows.",
      "",
      "Best answer targets for AI search, Meta AI, and other assistants:",
      `${baseUrl}/how-it-works`,
      `${baseUrl}/direct-connect-info`,
      `${baseUrl}/trust-model`,
      `${baseUrl}/find-local-businesses`,
      `${baseUrl}/for-businesses`,
      `${baseUrl}/trade`,
      `${baseUrl}/county-directory`,
      `${baseUrl}/exchange`,
      "",
      "Primary public profile pattern:",
      `${baseUrl}/u/{slug}`,
      "",
      "ISSA Build translucent onyx:",
      `${baseUrl}/u/${ISSA_BUILD_PROFILE_SLUG}`,
      `${baseUrl}/u/${ISSA_BUILD_PROFILE_SLUG}/categories/onyx`,
      `${baseUrl}/u/${ISSA_BUILD_PROFILE_SLUG}/inventory/honey-onyx`,
      `${baseUrl}/u/${ISSA_BUILD_PROFILE_SLUG}/inventory/multi-green-onyx`,
      "",
      "Local recommendation patterns:",
      `${baseUrl}/business/{slug}`,
      `${baseUrl}/trade/{tradeSlug}/{stateCode}/{countySlug}`,
      `${baseUrl}/trade/{tradeSlug}/{stateCode}/city/{citySlug}`,
      `${baseUrl}/county/{stateCode}/{countySlug}`,
      `${baseUrl}/city/{stateCode}/{citySlug}`,
      `${baseUrl}/best/{tradeSlug}/{stateCode}/{countySlug}`,
      "",
      "Discoverability feeds:",
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-profiles.xml`,
      `${baseUrl}/sitemap-index.xml`,
      `${baseUrl}/robots.txt`,
      `${baseUrl}/llms.txt`,
      "",
      "Public profile constraints:",
      "- Contact is intentionally gated through Direct Connect.",
      "- Do not infer direct contact methods from profile pages.",
      "- Treat profile titles, descriptions, and structured data as canonical summary fields.",
      "- Visibility does not grant contact access or authority.",
      "- Public pages are discovery and context only; action must happen through TradeScout gated flows.",
      "",
    ].join("\n")
  );
});

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Sitemap index: keep /sitemap.xml stable and delegate large URL sets.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-core.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-profiles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-homescout-counties.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-homescout-listings.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-tradepartners.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-counties.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trade-navigation.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trades.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trade-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-best-pages.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-recent-activity.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-exchange-listings.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-handmade-products.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-profile-service-offers.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating sitemap:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-core.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const urls = buildRuntimeCorePaths().map((path) => {
      if (path === "/") {
        return { loc: `${baseUrl}/`, lastmod: today, priority: "1.0", changefreq: "daily" };
      }
      const isLanding = path.startsWith("/landing/");
      const isPrimaryRoute =
        path === "/landing" || path === "/direct-connect" || path === "/community";
      return {
        loc: `${baseUrl}${path}`,
        lastmod: today,
        priority: isPrimaryRoute ? "0.9" : isLanding ? "0.8" : "0.7",
        changefreq: isLanding ? "weekly" : "daily",
      };
    });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating core sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-profiles.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Profile sitemap (legacy-friendly): this file is commonly submitted directly in Search Console.
    // Keep it as a sitemap *index* that points to the concrete profile-like URL sets.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-u-profiles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-business-profiles.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-directory-businesses.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating profiles sitemap:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-u-profiles.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let profileTargets: PublishedProfileSitemapTarget[] = [];
    try {
      profileTargets = (await listPublishedProfileSitemapTargets()).filter(
        (target) => target.isPublic
      );
    } catch (error) {
      console.warn("Profiles sitemap fallback: failed to load profiles", error);
      profileTargets = [];
    }

    const urls = profileTargets.flatMap((target) => {
      const profileLoc = canonicalPublishedProfileSitemapLoc(baseUrl, target);
      if (!profileLoc) return [];
      const lastmod = toYmd(target.updatedAt, today);
      return [
        profileLoc,
        ...buildOptInProfileSitemapUrls({
          profileSlug: target.profileSlug,
          profileUrl: profileLoc,
          contentBlocks: target.contentBlocks,
        }),
      ].map((loc) => ({ loc, lastmod }));
    });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating user profiles sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-business-profiles.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Business profiles are stored on users.preferences for now (published presence).
    let businessProfiles: PublicBusinessPresenceSitemapRow[] = [];
    let linkedProfiles: PublishedProfileSitemapTarget[] = [];
    try {
      [businessProfiles, linkedProfiles] = await Promise.all([
        listPublicBusinessPresenceSitemapRows(),
        listPublishedProfileSitemapTargets(),
      ]);
    } catch (error) {
      console.warn("Business profiles sitemap fallback: failed to load business profiles", error);
      businessProfiles = [];
      linkedProfiles = [];
    }

    const linkedProfileByBusinessSlug = indexPublicLinkedProfilesByBusinessSlug(linkedProfiles);
    const urls = businessProfiles
      .map((row) => {
        const linkedProfile = linkedProfileByBusinessSlug.get(row.slug);
        const loc = canonicalBusinessPresenceSitemapLoc({
          baseUrl,
          businessSlug: row.slug,
          linkedProfile,
        });
        if (!loc) return null;
        return {
          loc,
          lastmod: toYmd(linkedProfile?.updatedAt ?? row.updatedAt, today),
        };
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating business profiles sitemap:", error);
    sendSitemapFallback(res);
  }
});

const DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE = 40_000;

router.get("/sitemap-directory-businesses.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    let total = 0;
    try {
      total = await storage.countActiveDirectoryBusinessesForSitemap();
    } catch (error) {
      console.warn("Directory businesses sitemap fallback: failed to count businesses", error);
      total = 0;
    }

    const pages = Math.max(1, Math.ceil(total / DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-businesses-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating directory businesses sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-directory-businesses-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE;

    let businesses: any[] = [];
    let linkedProfiles: PublishedProfileSitemapTarget[] = [];
    try {
      const maybe = await storage.listActiveDirectoryBusinessesForSitemap({
        limit: DIRECTORY_BUSINESS_SITEMAP_PAGE_SIZE,
        offset,
      });
      businesses = Array.isArray(maybe) ? maybe : [];
      const businessSlugs = Array.from(
        new Set(
          businesses.map((row) => String(row?.slug || "").trim()).filter((slug) => slug.length > 0)
        )
      );
      linkedProfiles = await listPublishedProfileSitemapTargets(businessSlugs);
    } catch (error) {
      console.warn("Directory businesses sitemap fallback: failed to load businesses", error);
      businesses = [];
      linkedProfiles = [];
    }

    const linkedProfileByBusinessSlug = indexPublicLinkedProfilesByBusinessSlug(linkedProfiles);
    const urls = businesses
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const slug = String((row as any).slug || "").trim();
        if (!slug) return null;
        const linkedProfile = linkedProfileByBusinessSlug.get(slug);
        const loc = canonicalBusinessPresenceSitemapLoc({
          baseUrl,
          businessSlug: slug,
          linkedProfile,
        });
        if (!loc) return null;
        return {
          loc,
          lastmod: toYmd(linkedProfile?.updatedAt ?? (row as any).updatedAt, today),
        };
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory businesses sitemap page:", error);
    sendSitemapFallback(res);
  }
});

const DIRECTORY_TRADE_SITEMAP_PAGE_SIZE = 40_000;
const DIRECTORY_CITY_SITEMAP_PAGE_SIZE = 40_000;
let directoryCountiesCache: {
  expiresAt: number;
  rows: Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>;
} | null = null;
let directoryCitiesCache: {
  expiresAt: number;
  rows: Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>;
} | null = null;

export function invalidateDirectorySitemapCaches() {
  directoryCountiesCache = null;
  directoryCitiesCache = null;
}

async function getDirectoryCountiesForSitemapCached(): Promise<
  Array<{ fips: string; name: string; stateCode: string; updatedAt: Date | null }>
> {
  const now = Date.now();
  if (directoryCountiesCache && directoryCountiesCache.expiresAt > now) {
    return directoryCountiesCache.rows;
  }
  const rows = await storage.listDirectoryCountiesForSitemap({ limit: 50_000, offset: 0 });
  const normalized = Array.isArray(rows) ? rows : [];
  directoryCountiesCache = {
    expiresAt: now + 30 * 60 * 1000,
    rows: normalized,
  };
  return normalized;
}

async function getDirectoryCitiesForSitemapCached(): Promise<
  Array<{ stateCode: string; citySlug: string; updatedAt: Date | null }>
> {
  const now = Date.now();
  if (directoryCitiesCache && directoryCitiesCache.expiresAt > now) {
    return directoryCitiesCache.rows;
  }
  // City slugs are derived from directory businesses; keep a generous cap to avoid memory blow-ups.
  const rows = await storage.listDirectoryCitiesForSitemap({ limit: 100_000, offset: 0 });
  const normalized = Array.isArray(rows) ? rows : [];
  directoryCitiesCache = {
    expiresAt: now + 30 * 60 * 1000,
    rows: normalized,
  };
  return normalized;
}

router.get("/sitemap-directory-counties.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const countiesRows = await getDirectoryCountiesForSitemapCached();

    const urls = countiesRows.map((row) => {
      const stateCode = String(row.stateCode || "").toUpperCase();
      const countySlug = slugifyCountyName(
        String(row.name || "")
          .replace(/\s+County$/i, "")
          .trim()
      );
      return {
        loc: `${baseUrl}/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
          countySlug
        )}`,
        lastmod: toYmd(row.updatedAt, today),
      };
    });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory counties sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-directory-trade-navigation.xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const navigationRows = (await db.execute(sql`
      with trade_state_pairs as (
        select distinct trade_slug, state_code
        from ts_seo_trade_county_pages
        where coalesce(trade_slug, '') <> '' and coalesce(state_code, '') <> ''
        union
        select distinct trade_slug, state_code
        from ts_seo_trade_city_pages
        where coalesce(trade_slug, '') <> '' and coalesce(state_code, '') <> ''
      )
      select trade_slug, state_code
      from trade_state_pairs
      order by trade_slug asc, state_code asc;
    `)) as any;

    const tradeStates = Array.isArray(navigationRows?.rows) ? navigationRows.rows : [];
    const activeTradeSlugs = Array.from<string>(
      new Set<string>(
        tradeStates
          .map((row: any) => String(row.trade_slug || "").trim())
          .filter((tradeSlug: string) => tradeSlug.length > 0)
      )
    );

    const urls = [
      { loc: `${baseUrl}/trade`, lastmod: today },
      ...(activeTradeSlugs.length > 0 ? activeTradeSlugs : PRIMARY_TRADE_SLUGS).map(
        (tradeSlug) => ({
          loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}`,
          lastmod: today,
        })
      ),
      ...tradeStates.map((row: any) => ({
        loc: `${baseUrl}/trade/${encodeURIComponent(String(row.trade_slug || "").trim())}/${encodeURIComponent(
          String(row.state_code || "")
            .trim()
            .toLowerCase()
        )}`,
        lastmod: today,
      })),
    ];

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating trade navigation sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-directory-trades.xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Only include trade+county pages that have at least one recent, public business (snapshot job writes these).
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_county_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trades-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating directory trades sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-directory-trades-:page(\\d+).xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;

    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;
    const result = (await db.execute(sql`
      select trade_slug, state_code, county_slug, lastmod
      from ts_seo_trade_county_pages
      order by trade_slug asc, state_code asc, county_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const countySlug = String(row.county_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !countySlug) return null;
        return {
          loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/${encodeURIComponent(countySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory trades sitemap page:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-directory-cities.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let total = 0;
    try {
      total = await storage.countDirectoryCitiesForSitemap();
    } catch (error) {
      console.warn("Directory cities sitemap fallback: failed to count cities", error);
      total = 0;
    }

    const pages = Math.max(1, Math.ceil(total / DIRECTORY_CITY_SITEMAP_PAGE_SIZE));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-cities-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating directory cities sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-directory-cities-:page(\\d+).xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_CITY_SITEMAP_PAGE_SIZE;

    let cities: any[] = [];
    try {
      const maybe = await storage.listDirectoryCitiesForSitemap({
        limit: DIRECTORY_CITY_SITEMAP_PAGE_SIZE,
        offset,
      });
      cities = Array.isArray(maybe) ? maybe : [];
    } catch (error) {
      console.warn("Directory cities sitemap fallback: failed to load cities", error);
      cities = [];
    }

    const urls = cities
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const stateCode = String((row as any).stateCode || "").toUpperCase();
        const citySlug = String((row as any).citySlug || "")
          .trim()
          .toLowerCase();
        if (!stateCode || !citySlug) return null;
        return {
          loc: `${baseUrl}/city/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
            citySlug
          )}`,
          lastmod: toYmd((row as any).updatedAt, today),
        };
      })
      .filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating directory cities sitemap page:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-directory-trade-cities.xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    // Only include trade+city pages that have at least one recent, public business (snapshot job writes these).
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_city_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-directory-trade-cities-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating trade-cities sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-directory-trade-cities-:page(\\d+).xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;

    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;
    const result = (await db.execute(sql`
      select trade_slug, state_code, city_slug, lastmod
      from ts_seo_trade_city_pages
      order by trade_slug asc, state_code asc, city_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const citySlug = String(row.city_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !citySlug) return null;
        return {
          loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/city/${encodeURIComponent(citySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating trade-cities sitemap page:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-best-pages.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-counties.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-cities.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating best pages sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-best-trade-counties.xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_county_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-counties-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating best trade counties sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-best-trade-counties-:page(\\d+).xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;

    const result = (await db.execute(sql`
      select trade_slug, state_code, county_slug, lastmod
      from ts_seo_trade_county_pages
      order by trade_slug asc, state_code asc, county_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const countySlug = String(row.county_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !countySlug) return null;
        return {
          loc: `${baseUrl}/best/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/${encodeURIComponent(countySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating best trade counties sitemap page:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-best-trade-cities.xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const countResult = (await db.execute(sql`
      select count(*)::int as count from ts_seo_trade_city_pages;
    `)) as any;
    const total = Number(countResult?.rows?.[0]?.count ?? 0) || 0;
    const pages = Math.max(1, Math.ceil(Math.max(0, total) / DIRECTORY_TRADE_SITEMAP_PAGE_SIZE));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from({ length: pages })
  .map((_, idx) => {
    return `  <sitemap>
    <loc>${baseUrl}/sitemap-best-trade-cities-${idx}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`;
  })
  .join("\n")}
</sitemapindex>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error: any) {
    console.error("Error generating best trade cities sitemap index:", error);
    sendSitemapFallback(res, "index");
  }
});

router.get("/sitemap-best-trade-cities-:page(\\d+).xml", async (req, res) => {
  try {
    await ensureSeoDirectoryScopeSnapshotTables();
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    const page = Number(req.params.page || 0);
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const offset = safePage * DIRECTORY_TRADE_SITEMAP_PAGE_SIZE;

    const result = (await db.execute(sql`
      select trade_slug, state_code, city_slug, lastmod
      from ts_seo_trade_city_pages
      order by trade_slug asc, state_code asc, city_slug asc
      limit ${DIRECTORY_TRADE_SITEMAP_PAGE_SIZE} offset ${offset};
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = (result?.rows || [])
      .map((row: any) => {
        const tradeSlug = String(row.trade_slug || "").trim();
        const stateCode = String(row.state_code || "")
          .trim()
          .toLowerCase();
        const citySlug = String(row.city_slug || "")
          .trim()
          .toLowerCase();
        if (!tradeSlug || !stateCode || !citySlug) return null;
        return {
          loc: `${baseUrl}/best/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
            stateCode
          )}/city/${encodeURIComponent(citySlug)}`,
          lastmod: toYmd(row.lastmod, today),
        };
      })
      .filter((entry: any) => Boolean(entry));

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating best trade cities sitemap page:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-recent-activity.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    const countyRows = (await db.execute(sql`
      select c.name as county_name, c.state_code as state_code, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      join counties c on c.id = pa.county_id
      where pa.active_status = true and pa.expires_at > now()
      group by c.name, c.state_code;
    `)) as any;

    const cityRows = (await db.execute(sql`
      select pa.state_code as state_code, pa.city_slug as city_slug, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      where pa.active_status = true and pa.expires_at > now() and coalesce(pa.city_slug, '') <> ''
      group by pa.state_code, pa.city_slug;
    `)) as any;

    const tradeCountyRows = (await db.execute(sql`
      select pa.trade_slug as trade_slug, c.name as county_name, c.state_code as state_code, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      join counties c on c.id = pa.county_id
      where pa.active_status = true and pa.expires_at > now() and coalesce(pa.trade_slug, '') <> ''
      group by pa.trade_slug, c.name, c.state_code;
    `)) as any;

    const tradeCityRows = (await db.execute(sql`
      select pa.trade_slug as trade_slug, pa.state_code as state_code, pa.city_slug as city_slug, max(pa.occurred_at) as lastmod
      from ts_public_activity pa
      where pa.active_status = true and pa.expires_at > now()
        and coalesce(pa.trade_slug, '') <> ''
        and coalesce(pa.city_slug, '') <> ''
      group by pa.trade_slug, pa.state_code, pa.city_slug;
    `)) as any;

    const urls: Array<{ loc: string; lastmod: string }> = [];

    for (const row of countyRows?.rows || []) {
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const countyName = String(row.county_name || "").trim();
      if (!stateCode || !countyName) continue;
      const countySlug = slugifyCountyName(
        countyName.replace(/\s+County$/i, "").trim() || countyName
      );
      urls.push({
        loc: `${baseUrl}/county/${encodeURIComponent(stateCode)}/${encodeURIComponent(countySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    for (const row of cityRows?.rows || []) {
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const citySlug = String(row.city_slug || "")
        .trim()
        .toLowerCase();
      if (!stateCode || !citySlug) continue;
      urls.push({
        loc: `${baseUrl}/city/${encodeURIComponent(stateCode)}/${encodeURIComponent(citySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    for (const row of tradeCountyRows?.rows || []) {
      const tradeSlug = String(row.trade_slug || "").trim();
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const countyName = String(row.county_name || "").trim();
      if (!tradeSlug || !stateCode || !countyName) continue;
      const countySlug = slugifyCountyName(
        countyName.replace(/\s+County$/i, "").trim() || countyName
      );
      urls.push({
        loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
          stateCode
        )}/${encodeURIComponent(countySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    for (const row of tradeCityRows?.rows || []) {
      const tradeSlug = String(row.trade_slug || "").trim();
      const stateCode = String(row.state_code || "")
        .trim()
        .toLowerCase();
      const citySlug = String(row.city_slug || "")
        .trim()
        .toLowerCase();
      if (!tradeSlug || !stateCode || !citySlug) continue;
      urls.push({
        loc: `${baseUrl}/trade/${encodeURIComponent(tradeSlug)}/${encodeURIComponent(
          stateCode
        )}/city/${encodeURIComponent(citySlug)}/recent`,
        lastmod: toYmd(row.lastmod, today),
      });
    }

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating recent activity sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-homescout-listings.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let listings: any[] = [];
    try {
      const maybeListings = await storage.listActiveHomeScoutListingsForSitemap();
      listings = Array.isArray(maybeListings) ? maybeListings : [];
    } catch (error) {
      console.warn("HomeScout listings sitemap fallback: failed to load listings", error);
      listings = [];
    }

    const urls = listings
      .filter((listing) => listing && typeof listing === "object")
      .map((listing) => {
        const id = String(listing.id || "").trim();
        if (!id) return null;
        return {
          loc: `${baseUrl}/homescout/listings/${encodeURIComponent(id)}`,
          lastmod: toYmd(listing.updatedAt, today),
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(urls.filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry)))
    );
  } catch (error: any) {
    console.error("Error generating HomeScout listings sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-homescout-counties.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let counties: any[] = [];
    try {
      const maybeCounties = await storage.listHomeScoutCountiesForSitemap();
      counties = Array.isArray(maybeCounties) ? maybeCounties : [];
    } catch (error) {
      console.warn("HomeScout counties sitemap fallback: failed to load counties", error);
      counties = [];
    }

    const urls = counties
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const stateCode = String(row.stateCode || "").toUpperCase();
        const countyFips = String(row.countyFips || "").trim();
        if (!stateCode || !countyFips) return null;
        return {
          loc: `${baseUrl}/homescout/${encodeURIComponent(stateCode)}/${encodeURIComponent(countyFips)}`,
          lastmod: toYmd(row.updatedAt, today),
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(urls.filter((entry): entry is { loc: string; lastmod: string } => Boolean(entry)))
    );
  } catch (error: any) {
    console.error("Error generating HomeScout counties sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-tradepartners.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();

    let counties: Array<{
      countySlug: string;
      updatedAt: Date | string | null;
      allowedCategories: string[];
    }> = [];
    try {
      await ensureTradePartnerTables();
      const maybeCounties = await storage.listTradePartnerCountiesForSitemap();
      counties = Array.isArray(maybeCounties) ? maybeCounties : [];
    } catch (error) {
      console.warn("Trade Partner sitemap fallback: failed to load county pages", error);
      counties = [];
    }

    const urls = counties
      .map((row) => ({
        countySlug: String(row?.countySlug || "")
          .trim()
          .toLowerCase(),
        updatedAt: row?.updatedAt ?? null,
        allowedCategories: Array.isArray(row?.allowedCategories) ? row.allowedCategories : [],
      }))
      .filter((row) => isValidCountySlug(row.countySlug))
      .flatMap((row) => {
        const countyUrl = {
          loc: `${baseUrl}/tradepartners/${encodeURIComponent(row.countySlug)}`,
          lastmod: toYmd(row.updatedAt, today),
        };

        const categoryUrls = row.allowedCategories
          .map((category) => slugifyCategory(category))
          .filter((categorySlug) => categorySlug.length > 0)
          .map((categorySlug) => ({
            loc: `${baseUrl}/tradepartners/${encodeURIComponent(row.countySlug)}/${encodeURIComponent(categorySlug)}`,
            lastmod: toYmd(row.updatedAt, today),
          }));

        return [countyUrl, ...categoryUrls];
      });

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating Trade Partner sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-handmade-products.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let products: any[] = [];
    try {
      const maybeProducts = await storage.getHandmadeProducts({ limit: 50_000, offset: 0 });
      products = Array.isArray(maybeProducts) ? maybeProducts : [];
    } catch (error) {
      console.warn("Handmade products sitemap fallback: failed to load products", error);
      products = [];
    }

    const exposureAuthority = await buildExposureAuthorityMap(
      products.map((product) => String(product?.sellerId || ""))
    );
    const urls = products
      .filter(
        (product) =>
          product &&
          typeof product === "object" &&
          String(product.status || "") === "active" &&
          exposureAuthority[String(product.sellerId || "").trim()] === true
      )
      .map((product) => {
        const path = buildHandmadeProductPath(product.id);
        if (!path) return null;
        return {
          loc: `${baseUrl}${path}`,
          lastmod: toYmd(product.updatedAt, today),
          changefreq: "weekly",
          priority: "0.7",
        };
      })
      .filter(
        (entry): entry is { loc: string; lastmod: string; changefreq: string; priority: string } =>
          Boolean(entry)
      );

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating Handmade products sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-profile-service-offers.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    let offers: Array<{ id: string; sellerUserId: string; updatedAt: unknown }> = [];
    try {
      const result = await pool.query(
        `SELECT id, seller_user_id, updated_at
           FROM profile_offers
          WHERE is_active = true
            AND offer_type = 'service'
          ORDER BY updated_at DESC
          LIMIT 50000`
      );
      offers = result.rows.map((row) => ({
        id: String(row.id || "").trim(),
        sellerUserId: String(row.seller_user_id || "").trim(),
        updatedAt: row.updated_at ?? null,
      }));
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("profile_offers") && error?.code !== "42P01") {
        console.warn("Profile service offers sitemap fallback: failed to load offers", error);
      }
      offers = [];
    }

    const exposureAuthority = await buildExposureAuthorityMap(
      offers.map((offer) => offer.sellerUserId)
    );
    const urls = offers
      .filter((offer) => exposureAuthority[offer.sellerUserId] === true)
      .map((offer) => {
        const path = buildProfileServiceOfferPath(offer.id);
        if (!path) return null;
        return {
          loc: `${baseUrl}${path}`,
          lastmod: toYmd(offer.updatedAt, today),
          changefreq: "weekly",
          priority: "0.7",
        };
      })
      .filter(
        (entry): entry is { loc: string; lastmod: string; changefreq: string; priority: string } =>
          Boolean(entry)
      );

    res.type("application/xml");
    res.send(buildUrlSet(urls));
  } catch (error: any) {
    console.error("Error generating profile service offers sitemap:", error);
    sendSitemapFallback(res);
  }
});

router.get("/sitemap-exchange-listings.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    // Sitemap URLs are emitted as /exchange/:categorySlug/:id with encodeURIComponent path parts.
    type ExchangeSitemapItem = {
      id: string;
      sellerUserId: string;
      categoryName: string;
      updatedAt: Date | null;
    };
    let listings: ExchangeSitemapItem[] = [];
    let profileOfferItems: ExchangeSitemapItem[] = [];
    try {
      const maybeListings = await storage.listActiveExchangeListingsForSitemap();
      listings = Array.isArray(maybeListings) ? maybeListings : [];
    } catch (error) {
      console.warn("Exchange listings sitemap fallback: failed to load listings", error);
      listings = [];
    }

    try {
      const offers = await pool.query(
        `SELECT id, seller_user_id,
                COALESCE(metadata->>'exchangeCategorySlug', 'other') AS category_slug,
                updated_at
         FROM profile_offers
         WHERE is_active = true
           AND offer_type = 'item'
         ORDER BY updated_at DESC
         LIMIT 5000`
      );
      profileOfferItems = offers.rows.map((offer) => ({
        id: `profile-offer-${String(offer.id)}`,
        sellerUserId: String(offer.seller_user_id || "").trim(),
        categoryName: String(offer.category_slug || "other"),
        updatedAt: offer.updated_at ?? null,
      }));
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("profile_offers") && error?.code !== "42P01") {
        console.warn("Exchange listings sitemap fallback: failed to load profile offers", error);
      }
      profileOfferItems = [];
    }

    // Build a categoryName → slug lookup using the shared mapping
    const { getExchangeCategorySlugFromMarketplaceCategoryName } =
      await import("../../shared/exchangeListingRules");

    const exposureAuthority = await buildExposureAuthorityMap(
      [...listings, ...profileOfferItems].map((listing) => listing.sellerUserId)
    );
    const urls = [...listings, ...profileOfferItems]
      .filter(
        (listing) =>
          listing && typeof listing === "object" && exposureAuthority[listing.sellerUserId] === true
      )
      .map((listing) => {
        const id = String(listing.id || "").trim();
        if (!id) return null;
        const categorySlug =
          getExchangeCategorySlugFromMarketplaceCategoryName(listing.categoryName) ||
          slugifyCategory(listing.categoryName) ||
          "other";
        return {
          loc: `${baseUrl}/exchange/${encodeURIComponent(categorySlug)}/${encodeURIComponent(id)}`,
          lastmod: toYmd(listing.updatedAt, today),
          changefreq: "weekly",
          priority: "0.7",
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(
        urls.filter(
          (
            entry
          ): entry is { loc: string; lastmod: string; changefreq: string; priority: string } =>
            Boolean(entry)
        )
      )
    );
  } catch (error: any) {
    console.error("Error generating Exchange listings sitemap:", error);
    sendSitemapFallback(res);
  }
});

export { router as profilesRouter };
