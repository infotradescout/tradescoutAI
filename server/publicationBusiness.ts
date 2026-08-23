import { getTradeSeoMatch } from "@shared/tradeSeo";
import { businesses, users } from "@shared/schema";
import { and, eq, or, sql } from "drizzle-orm";
import type {
  BusinessPublicationTier,
  PublicationCheck,
  PublicBusinessSignals,
} from "@shared/publication";
import {
  hasSpecificPublicDirectoryIdentity,
  isSafePublicDirectoryBusinessSlug,
} from "./services/publicDirectoryBusinessPresentation";

const PUBLIC_SOURCE_CATEGORY_TO_TRADE: Readonly<Record<string, string>> = {
  "general contractor": "general-contractor",
  "roofing contractor": "roofing",
  roofer: "roofing",
  handyman: "handyman",
  "handyman/handywoman/handyperson": "handyman",
  handywoman: "handyman",
  handyperson: "handyman",
  "handyman service": "handyman",
  "handyman services": "handyman",
  "custom home builder": "custom-home-builder",
  "remodeling contractor": "remodeling-contractor",
  "bathroom remodeler": "bathroom-remodel",
  "bathroom remodeling": "bathroom-remodel",
  "kitchen remodeler": "kitchen-remodel",
  "kitchen remodeling": "kitchen-remodel",
  "concrete contractor": "concrete-contractor",
  electrician: "electrical",
  "electrical contractor": "electrical",
  plumber: "plumbing",
  "plumbing contractor": "plumbing",
  "hvac contractor": "hvac",
  "air conditioning contractor": "air-conditioning",
  "air conditioning repair service": "air-conditioning",
  "heating contractor": "heating-contractor",
  landscaper: "landscaping",
  "landscaping contractor": "landscaping",
  "lawn care service": "lawn-care",
  "drywall contractor": "drywall-contractor",
  "tile contractor": "tile-contractor",
  "fence contractor": "fence-contractor",
  "deck builder": "deck-contractor",
  "siding contractor": "siding-contractor",
  "window installation service": "window-contractor",
  "gutter installation service": "gutter-contractor",
  "insulation contractor": "insulation-contractor",
  "swimming pool contractor": "pool-contractor",
  "house cleaning service": "cleaning-services",
  "tree service": "tree-service",
  "masonry contractor": "masonry-contractor",
};

function normalizePublicTradeSourceToken(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    : "";
}

function publicTradeSourceTokens(tradeRaw: unknown): string[] {
  const match = getTradeSeoMatch(tradeRaw);
  if (!match) return [];
  const mappedTokens = Object.entries(PUBLIC_SOURCE_CATEGORY_TO_TRADE)
    .filter(([, tradeSlug]) => tradeSlug === match.canonicalSlug)
    .map(([token]) => token);
  return Array.from(new Set([...match.keywords, ...mappedTokens]));
}

export function canServePublicBusinessDetail(args: {
  publication: PublicationCheck;
  tier: BusinessPublicationTier;
}): boolean {
  if (!args.publication.ok) return false;

  // Unclaimed directory facts keep their established public-record behavior.
  // Once a business is owned, its direct detail payload remains private until
  // the existing verification system promotes it to the verified tier. This
  // prevents owner-supplied onboarding evidence from becoming public merely
  // because publicDiscoveryEnabled was already true.
  return args.tier !== "claimed_unverified";
}

/** SQL equivalent of the owned-business verification gate. Apply this before
 * order/limit/aggregation on anonymous business discovery queries. */
export function publicBusinessDetailExposureSqlPredicate() {
  return or(
    and(
      sql`${businesses.ownerUserId} IS NULL`,
      sql`lower(COALESCE(${businesses.claimStatus}, '')) = 'unclaimed'`
    ),
    and(
      sql`${businesses.ownerUserId} IS NOT NULL`,
      sql`lower(COALESCE(${businesses.claimStatus}, '')) <> 'unclaimed'`,
      sql`lower(COALESCE(CAST(${users.verificationStatus} AS text), '')) = 'approved'`,
      eq(users.addressVerified, true)
    )
  );
}

/** Exact tier-aware recency gate for public SQL queries that paginate before
 * the canonical JavaScript publication check. Ineligible stale rows must not
 * consume public result slots. */
export function publicBusinessDetailRecencySqlPredicate(args: {
  rules: {
    listingStaleDaysUnclaimed: number;
    listingStaleDaysVerified: number;
  };
  now: Date;
}) {
  const unclaimedCutoff = new Date(
    args.now.getTime() - args.rules.listingStaleDaysUnclaimed * 24 * 60 * 60 * 1000
  );
  const verifiedCutoff = new Date(
    args.now.getTime() - args.rules.listingStaleDaysVerified * 24 * 60 * 60 * 1000
  );
  const isUnclaimedTier = and(
    sql`${businesses.ownerUserId} IS NULL`,
    sql`lower(COALESCE(${businesses.claimStatus}, '')) = 'unclaimed'`
  );
  const isVerifiedTier = and(
    sql`${businesses.ownerUserId} IS NOT NULL`,
    sql`lower(COALESCE(${businesses.claimStatus}, '')) <> 'unclaimed'`,
    sql`lower(COALESCE(CAST(${users.verificationStatus} AS text), '')) = 'approved'`,
    eq(users.addressVerified, true)
  );
  return or(
    and(isUnclaimedTier, sql`${businesses.updatedAt} >= ${unclaimedCutoff}`),
    and(isVerifiedTier, sql`${businesses.updatedAt} >= ${verifiedCutoff}`)
  );
}

/** Canonical trade/category predicate for public business discovery. The
 * profileData document is the current public category/services source, so all
 * provider-search callers share the same bounded SEO trade vocabulary. */
export function publicBusinessTradeSqlPredicate(tradeRaw: unknown) {
  const patterns = publicTradeSourceTokens(tradeRaw)
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((keyword) => `%${keyword.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);

  if (!patterns.length) return null;
  return or(
    ...patterns.flatMap((pattern) => [
      sql`coalesce(${businesses.profileData} ->> 'category', '') ILIKE ${pattern}`,
      sql`exists (
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(${businesses.profileData} -> 'services') = 'array'
              then ${businesses.profileData} -> 'services'
            else '[]'::jsonb
          end
        ) as public_service(value)
        where public_service.value ILIKE ${pattern}
      )`,
    ])
  );
}

export function deriveTradeSlugFromProfileData(profileData: any): string | null {
  const raw = profileData && typeof profileData === "object" ? profileData : {};
  const candidates: string[] = [];
  if (typeof raw.category === "string" && raw.category.trim()) {
    candidates.push(...raw.category.split(/[,;|]+/).map((value: string) => value.trim()));
  }
  if (Array.isArray(raw.services)) {
    for (const s of raw.services) {
      if (typeof s === "string" && s.trim()) candidates.push(s.trim());
    }
  }
  // Prefer the first reviewed exact source-category token. Generic Google
  // categories intentionally remain detail-only rather than inventing a trade.
  for (const c of candidates.slice(0, 8)) {
    const normalizedToken = normalizePublicTradeSourceToken(c);
    const mappedSlug = PUBLIC_SOURCE_CATEGORY_TO_TRADE[normalizedToken];
    if (mappedSlug) return mappedSlug;
    const exactSlug = normalizedToken.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const match = getTradeSeoMatch(exactSlug);
    if (match) return match.canonicalSlug;
  }
  return null;
}

export function derivePublicationTier(args: {
  ownerUserId: string | null;
  claimStatus: string | null;
  ownerVerificationStatus: string | null;
  ownerAddressVerified: boolean | null;
}): BusinessPublicationTier {
  const claim = String(args.claimStatus || "").toLowerCase();
  if (!args.ownerUserId && claim === "unclaimed") return "unclaimed";
  if (!args.ownerUserId || claim === "unclaimed") return "claimed_unverified";
  const verified =
    String(args.ownerVerificationStatus || "").toLowerCase() === "approved" &&
    args.ownerAddressVerified === true;
  return verified ? "verified" : "claimed_unverified";
}

export function buildPublicBusinessSignals(args: {
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
  publicDiscoveryEnabled: boolean;
  stateCode: string | null;
  countyName: string | null;
  city: string | null;
  tradeSlug: string | null;
  hasPublicOfferingFacts: boolean;
  tier: BusinessPublicationTier;
}): PublicBusinessSignals {
  return {
    id: args.id,
    name: hasSpecificPublicDirectoryIdentity(args.name) ? args.name : "",
    slug: isSafePublicDirectoryBusinessSlug(args.slug) ? args.slug : "",
    updatedAt: args.updatedAt,
    publicDiscoveryEnabled: args.publicDiscoveryEnabled,
    stateCode: args.stateCode,
    countyName: args.countyName,
    city: args.city,
    tradeSlug: args.tradeSlug,
    hasPublicOfferingFacts: args.hasPublicOfferingFacts,
    tier: args.tier,
  };
}
