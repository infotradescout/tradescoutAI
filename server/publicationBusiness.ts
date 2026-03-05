import { getTradeSeoMatch } from "@shared/tradeSeo";
import type { BusinessPublicationTier, PublicBusinessSignals } from "@shared/publication";

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
