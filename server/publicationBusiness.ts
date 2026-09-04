import { COMPREHENSIVE_TRADES } from "@shared/trades-data";
import { getTradeSeoMatch, PUBLIC_TRADE_INPUT_SLUGS } from "@shared/tradeSeo";
import { businesses, users } from "@shared/schema";
import { and, eq, or, sql } from "drizzle-orm";
import type {
  BusinessPublicationTier,
  PublicationRules,
  PublicationCheck,
  PublicBusinessSignals,
} from "@shared/publication";

const PROFILE_TRADE_MATCHERS = COMPREHENSIVE_TRADES.flatMap((trade) => {
  const match = getTradeSeoMatch(trade.slug);
  return match
    ? [
        {
          canonicalSlug: match.canonicalSlug,
          keywords: match.keywords.map((keyword) => keyword.toLowerCase()),
        },
      ]
    : [];
});

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
    sql`${businesses.ownerUserId} IS NULL`,
    sql`lower(COALESCE(${businesses.claimStatus}, '')) = 'unclaimed'`,
    and(
      sql`lower(COALESCE(CAST(${users.verificationStatus} AS text), '')) = 'approved'`,
      eq(users.addressVerified, true)
    )
  );
}

/** SQL equivalent of the public business renderer's crawlability policy. */
export function publicBusinessSitemapCrawlabilitySqlPredicate(args: {
  rules: PublicationRules;
  now: Date;
}) {
  const unclaimedCutoff = new Date(
    args.now.getTime() - args.rules.listingStaleDaysUnclaimed * 24 * 60 * 60 * 1000
  );
  const verifiedCutoff = new Date(
    args.now.getTime() - args.rules.listingStaleDaysVerified * 24 * 60 * 60 * 1000
  );
  const tradeInputs = sql.join(
    PUBLIC_TRADE_INPUT_SLUGS.map((tradeInput) => sql`${tradeInput}`),
    sql`, `
  );
  const unclaimedBusiness = or(
    sql`${businesses.ownerUserId} IS NULL`,
    sql`lower(COALESCE(${businesses.claimStatus}, '')) = 'unclaimed'`
  );
  const verifiedBusiness = and(
    sql`${businesses.ownerUserId} IS NOT NULL`,
    sql`lower(COALESCE(${businesses.claimStatus}, '')) <> 'unclaimed'`,
    sql`lower(COALESCE(CAST(${users.verificationStatus} AS text), '')) = 'approved'`,
    eq(users.addressVerified, true)
  );
  const hasCanonicalTrade = sql`EXISTS (
    SELECT 1
    FROM (
      SELECT lower(btrim(sitemap_trade_candidate.value #>> '{}')) AS normalized_value
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(${businesses.profileData} -> 'category') = 'string'
            THEN jsonb_build_array(${businesses.profileData} -> 'category')
          ELSE '[]'::jsonb
        END ||
        CASE
          WHEN jsonb_typeof(${businesses.profileData} -> 'services') = 'array'
            THEN ${businesses.profileData} -> 'services'
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS sitemap_trade_candidate(value, source_ordinal)
      WHERE jsonb_typeof(sitemap_trade_candidate.value) = 'string'
        AND btrim(sitemap_trade_candidate.value #>> '{}') <> ''
      ORDER BY sitemap_trade_candidate.source_ordinal
      LIMIT 8
    ) AS bounded_sitemap_trade_candidate
    WHERE bounded_sitemap_trade_candidate.normalized_value IN (${tradeInputs})
  )`;

  return and(
    publicBusinessDetailExposureSqlPredicate(),
    or(
      and(unclaimedBusiness, sql`${businesses.updatedAt} >= ${unclaimedCutoff}`),
      and(verifiedBusiness, sql`${businesses.updatedAt} >= ${verifiedCutoff}`)
    ),
    hasCanonicalTrade
  );
}

/** Canonical trade/category predicate for public business discovery. The
 * profileData document is the current public category/services source, so all
 * provider-search callers share the same bounded SEO trade vocabulary. */
export function publicBusinessTradeSqlPredicate(tradeRaw: unknown) {
  const match = getTradeSeoMatch(tradeRaw);
  if (!match) return null;

  const patterns = match.keywords
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((keyword) => `%${keyword.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);

  if (!patterns.length) return null;
  return or(...patterns.map((pattern) => sql`${businesses.profileData}::text ILIKE ${pattern}`));
}

export function deriveTradeSlugFromProfileData(profileData: any): string | null {
  const raw = profileData && typeof profileData === "object" ? profileData : {};
  const candidates: string[] = [];
  if (typeof raw.category === "string" && raw.category.trim()) candidates.push(raw.category.trim());
  if (Array.isArray(raw.services)) {
    for (const s of raw.services) {
      if (typeof s === "string" && s.trim()) candidates.push(s.trim());
    }
  }
  // Prefer first matching candidate.
  for (const c of candidates.slice(0, 8)) {
    const match = getTradeSeoMatch(c);
    if (match) return match.canonicalSlug;
  }
  return null;
}

/**
 * Returns every trade route that the public SQL serving predicate can match
 * for this profile document. The serving query searches the complete JSON
 * document for each trade's bounded SEO keywords, so the snapshot producer
 * must use the same rule instead of keeping only the first category match.
 */
export function deriveTradeSlugsFromProfileData(profileData: any): string[] {
  if (!profileData || typeof profileData !== "object") return [];

  let profileText = "";
  try {
    profileText = JSON.stringify(profileData).toLowerCase();
  } catch {
    return [];
  }
  if (!profileText) return [];

  const matches: string[] = [];
  const seen = new Set<string>();
  for (const match of PROFILE_TRADE_MATCHERS) {
    if (seen.has(match.canonicalSlug)) continue;
    const servesTrade = match.keywords.some((keyword) => profileText.includes(keyword));
    if (!servesTrade) continue;
    seen.add(match.canonicalSlug);
    matches.push(match.canonicalSlug);
  }
  return matches;
}

export function derivePublicationTier(args: {
  ownerUserId: string | null;
  claimStatus: string | null;
  ownerVerificationStatus: string | null;
  ownerAddressVerified: boolean | null;
}): BusinessPublicationTier {
  const claim = String(args.claimStatus || "").toLowerCase();
  if (!args.ownerUserId || claim === "unclaimed") return "unclaimed";
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
  tier: BusinessPublicationTier;
}): PublicBusinessSignals {
  return {
    id: args.id,
    name: args.name,
    slug: args.slug,
    updatedAt: args.updatedAt,
    publicDiscoveryEnabled: args.publicDiscoveryEnabled,
    stateCode: args.stateCode,
    countyName: args.countyName,
    city: args.city,
    tradeSlug: args.tradeSlug,
    tier: args.tier,
  };
}
