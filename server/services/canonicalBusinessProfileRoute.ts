import { and, asc, eq, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";
import { canDiscoverPublishedProfilePublicly } from "./ownerConfirmedDirectProfile";
import { durableProfessionalProfileApprovalSql } from "./profileTargetAuthority";

export type CanonicalBusinessProfileRoute = {
  slug: string;
  path: string;
};

function databaseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "t";
}

export function canUseLinkedProfileAsCanonicalBusinessRoute(row: Record<string, any>): boolean {
  return canDiscoverPublishedProfilePublicly({
    profileId: row.profileId,
    profilePubliclyReleased: row.profilePubliclyReleased,
    businessId: row.businessId,
    profileSlug: row.slug,
    profileStatus: "published",
    profileRoleContext: row.profileRoleContext,
    profileHeadline: row.profileHeadline,
    profileContentBlocks: row.profileContentBlocks,
    profileOwnerUserId: row.profileOwnerUserId,
    ownerRole: row.ownerRole,
    ownerRoles: row.ownerRoles,
    ownerVerifiedBadge: databaseBoolean(row.ownerVerifiedBadge),
    ownerVerificationStatus: row.ownerVerificationStatus,
    ownerProvider: row.ownerProvider,
    ownerPreferences: row.ownerPreferences,
    businessStatus: row.businessStatus,
    businessOwnerUserId: row.businessOwnerUserId,
    publicDiscoveryEnabled: databaseBoolean(row.publicDiscoveryEnabled),
    businessSources: row.businessSources,
    businessClaimStatus: row.businessClaimStatus,
    professionalRoleApproved: row.professionalRoleApproved,
  });
}

/**
 * Resolves the single discoverable profile that owns a claimed business
 * presence. Direct-only and unlisted profiles stay on their deliberate URLs
 * and never become the canonical public business destination.
 */
export async function resolveCanonicalBusinessProfileRoute(
  businessSlugValue: unknown
): Promise<CanonicalBusinessProfileRoute | null> {
  const businessSlug = String(businessSlugValue || "").trim();
  if (!businessSlug) return null;

  const linkedProfiles = await db
    .select({
      profileId: profiles.id,
      profilePubliclyReleased: profiles.publiclyReleased,
      slug: profiles.slug,
      profileRoleContext: profiles.roleContext,
      profileHeadline: profiles.headline,
      profileContentBlocks: profiles.contentBlocks,
      businessId: profiles.businessId,
      profileOwnerUserId: profiles.ownerUserId,
      ownerRole: users.role,
      ownerRoles: users.roles,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
      ownerProvider: users.provider,
      ownerPreferences: users.preferences,
      businessStatus: businesses.status,
      businessOwnerUserId: businesses.ownerUserId,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      businessSources: businesses.sources,
      businessClaimStatus: businesses.claimStatus,
      professionalRoleApproved: durableProfessionalProfileApprovalSql,
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

  return {
    slug: profileSlug,
    path: `/u/${encodeURIComponent(profileSlug)}`,
  };
}
