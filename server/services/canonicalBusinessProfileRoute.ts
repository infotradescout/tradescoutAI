import { and, asc, eq, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import { db } from "../db";
import { canExposePublishedProfilePublicly } from "./ownerConfirmedDirectProfile";

export type CanonicalBusinessProfileRoute = {
  slug: string;
  path: string;
};

function databaseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "t";
}

export function canUseLinkedProfileAsCanonicalBusinessRoute(row: Record<string, any>): boolean {
  return canExposePublishedProfilePublicly({
    profileId: row.profileId,
    businessId: row.businessId,
    profileSlug: row.slug,
    profileStatus: "published",
    profileOwnerUserId: row.profileOwnerUserId,
    ownerVerifiedBadge: databaseBoolean(row.ownerVerifiedBadge),
    ownerVerificationStatus: row.ownerVerificationStatus,
    ownerProvider: row.ownerProvider,
    ownerPreferences: row.ownerPreferences,
    businessStatus: row.businessStatus,
    businessOwnerUserId: row.businessOwnerUserId,
    publicDiscoveryEnabled: databaseBoolean(row.publicDiscoveryEnabled),
    businessSources: row.businessSources,
    businessClaimStatus: row.businessClaimStatus,
  });
}

/**
 * Resolves the single public profile that owns a claimed business presence.
 * Both SSR requests and SPA API responses use this authority so /business and
 * /u cannot disagree about the canonical destination.
 */
export async function resolveCanonicalBusinessProfileRoute(
  businessSlugValue: unknown
): Promise<CanonicalBusinessProfileRoute | null> {
  const businessSlug = String(businessSlugValue || "").trim();
  if (!businessSlug) return null;

  const linkedProfiles = await db
    .select({
      profileId: profiles.id,
      slug: profiles.slug,
      businessId: profiles.businessId,
      profileOwnerUserId: profiles.ownerUserId,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
      ownerProvider: users.provider,
      ownerPreferences: users.preferences,
      businessStatus: businesses.status,
      businessOwnerUserId: businesses.ownerUserId,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      businessSources: businesses.sources,
      businessClaimStatus: businesses.claimStatus,
    })
    .from(profiles)
    .innerJoin(businesses, eq(businesses.id, profiles.businessId))
    .innerJoin(users, eq(users.id, profiles.ownerUserId))
    .where(and(eq(businesses.slug, businessSlug), eq(profiles.status, "published" as any)))
    .orderBy(
      sql`${profiles.updatedAt} DESC NULLS LAST`,
      sql`${profiles.createdAt} DESC NULLS LAST`,
      asc(profiles.slug)
    );

  const linkedProfile = linkedProfiles.find(canUseLinkedProfileAsCanonicalBusinessRoute);

  const profileSlug = String(linkedProfile?.slug || "").trim();
  if (!profileSlug) return null;

  // JW Stone public home is the marketplace, not the legacy profile storefront.
  if (profileSlug.toLowerCase() === JW_STONE_PROFILE_SLUG) {
    return {
      slug: profileSlug,
      path: "/jw-stone",
    };
  }

  return {
    slug: profileSlug,
    path: `/u/${encodeURIComponent(profileSlug)}`,
  };
}
