import { getTradeSeoMatch } from "@shared/tradeSeo";
import { businesses, users } from "@shared/schema";
import { and, eq, or, sql } from "drizzle-orm";
import type {
  BusinessPublicationTier,
  PublicationCheck,
  PublicBusinessSignals,
} from "@shared/publication";

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
      sql`lower(COALESCE(${users.verificationStatus}, '')) = 'approved'`,
      eq(users.addressVerified, true)
    )
  );
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
