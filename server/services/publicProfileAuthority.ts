import { eq, inArray } from "drizzle-orm";
import {
  businesses,
  profiles,
  users,
  type Business,
  type Profile,
  type User,
} from "@shared/schema";
import { readProfileBookingConfigBlock } from "@shared/profileBookingConfig";
import { db } from "../db";
import type { PublicProfileRecord } from "../repositories/profileRepository";
import { isOperatorConfirmedTradePartnerProfile } from "./operatorConfirmedTradePartnerProfile";
import { isOwnerConfirmedDirectProfile } from "./ownerConfirmedDirectProfile";
import { isPublicProfileAccountGateOpen } from "./provisionedProfileAccountControl";

type ProfileAuthorityRow = {
  profile: Profile;
  ownerUser: User;
  linkedBusiness: Business | null;
};

type PublicProfileAuthorityDecision = {
  ownerConfirmedDirectProfile: boolean;
  operatorConfirmedTradePartnerProfile: boolean;
};

export type AuthorizedPublicProfile = {
  profile: PublicProfileRecord;
  ownerUser: User;
  ownerUserId: string;
  linkedBusiness: Business | null;
  ownerConfirmedDirectProfile: boolean;
  operatorConfirmedTradePartnerProfile: boolean;
};

function readOwnerPreferences(ownerUser: User): Record<string, any> {
  return ownerUser.preferences &&
    typeof ownerUser.preferences === "object" &&
    !Array.isArray(ownerUser.preferences)
    ? (ownerUser.preferences as Record<string, any>)
    : {};
}

function buildPublicProfileRecord(profile: Profile, ownerUser: User): PublicProfileRecord {
  const preferences = readOwnerPreferences(ownerUser);
  return {
    id: String(profile.id),
    slug: String(profile.slug),
    displayName: String(profile.displayName),
    headline: profile.headline,
    roleContext: String(profile.roleContext),
    contentBlocks: profile.contentBlocks,
    ctaConfig: profile.ctaConfig,
    seoMeta: profile.seoMeta,
    businessId: profile.businessId,
    updatedAt: profile.updatedAt,
    profileSections: preferences.profileSections ?? null,
    profileBooking:
      readProfileBookingConfigBlock(profile.contentBlocks) ?? preferences.profileBooking ?? null,
    ownerFirstName: ownerUser.firstName,
    ownerLastName: ownerUser.lastName,
    ownerProfileImageUrl: ownerUser.profileImageUrl,
    ownerCity: ownerUser.city,
    ownerState: ownerUser.state,
    ownerRoles: ownerUser.roles,
    servicesDescription:
      typeof preferences.servicesDescription === "string" ? preferences.servicesDescription : null,
  };
}

function evaluatePublicProfileAuthority(
  row: ProfileAuthorityRow
): PublicProfileAuthorityDecision | null {
  const { profile, ownerUser, linkedBusiness } = row;
  const ownerUserId = String(profile.ownerUserId || "").trim();
  const preferences = readOwnerPreferences(ownerUser);
  const profileVisibility = String(preferences.profileVisibility || "")
    .trim()
    .toLowerCase();

  if (
    String(profile.status || "").toLowerCase() !== "published" ||
    profileVisibility !== "public" ||
    !ownerUserId ||
    String(ownerUser.id || "") !== ownerUserId
  ) {
    return null;
  }

  if (!profile.businessId) {
    return {
      ownerConfirmedDirectProfile: false,
      operatorConfirmedTradePartnerProfile: false,
    };
  }

  if (
    !linkedBusiness ||
    String(linkedBusiness.id || "") !== String(profile.businessId) ||
    String(linkedBusiness.status || "").toLowerCase() !== "active" ||
    String(linkedBusiness.ownerUserId || "") !== ownerUserId
  ) {
    return null;
  }

  if (
    !isPublicProfileAccountGateOpen({
      profileVisibility,
      emailVerified: ownerUser.emailVerified,
      provider: ownerUser.provider,
      verificationStatus: ownerUser.verificationStatus,
    })
  ) {
    return null;
  }

  const ownerConfirmedDirectProfile = isOwnerConfirmedDirectProfile({
    profileSlug: profile.slug,
    profileStatus: profile.status,
    profileOwnerUserId: ownerUserId,
    businessStatus: linkedBusiness.status,
    businessOwnerUserId: linkedBusiness.ownerUserId,
    publicDiscoveryEnabled: linkedBusiness.publicDiscoveryEnabled,
    businessSources: linkedBusiness.sources,
  });
  const operatorConfirmedTradePartnerProfile = isOperatorConfirmedTradePartnerProfile({
    profileSlug: profile.slug,
    profileStatus: profile.status,
    profileOwnerUserId: ownerUserId,
    businessStatus: linkedBusiness.status,
    businessOwnerUserId: linkedBusiness.ownerUserId,
    publicDiscoveryEnabled: linkedBusiness.publicDiscoveryEnabled,
    businessSources: linkedBusiness.sources,
    businessProfileData: linkedBusiness.profileData,
    ownerProfileVisibility: profileVisibility,
    ownerVerificationStatus: ownerUser.verificationStatus,
    ownerEmailVerified: ownerUser.emailVerified,
    ownerProvider: ownerUser.provider,
  });
  const ownerVerificationStatus = String(ownerUser.verificationStatus || "")
    .trim()
    .toLowerCase();
  const ownerGenerallyDiscoverable = ownerVerificationStatus === "approved";

  if (
    !ownerGenerallyDiscoverable &&
    !ownerConfirmedDirectProfile &&
    !operatorConfirmedTradePartnerProfile
  ) {
    return null;
  }

  return {
    ownerConfirmedDirectProfile,
    operatorConfirmedTradePartnerProfile,
  };
}

async function loadProfileAuthorityRows(slugs: string[]): Promise<ProfileAuthorityRow[]> {
  if (slugs.length === 0) return [];

  const rows = await db
    .select()
    .from(profiles)
    .innerJoin(users, eq(profiles.ownerUserId, users.id))
    .leftJoin(businesses, eq(profiles.businessId, businesses.id))
    .where(inArray(profiles.slug, slugs));

  return rows.map((row) => ({
    profile: row.profiles,
    ownerUser: row.users,
    linkedBusiness: row.businesses,
  }));
}

/**
 * Canonical public-profile authority resolver. Every render, hydration, and
 * profile-targeted write must pass through this boundary so a suspended,
 * private, revoked, mismatched, or uncontrolled profile cannot survive on
 * another route.
 */
export async function resolveAuthorizedPublicProfileBySlug(
  rawSlug: string
): Promise<AuthorizedPublicProfile | null> {
  const slug = String(rawSlug || "").trim();
  if (!slug) return null;

  const [row] = await loadProfileAuthorityRows([slug]);
  if (!row) return null;
  const decision = evaluatePublicProfileAuthority(row);
  if (!decision) return null;

  return {
    profile: buildPublicProfileRecord(row.profile, row.ownerUser),
    ownerUser: row.ownerUser,
    ownerUserId: String(row.profile.ownerUserId),
    linkedBusiness: row.linkedBusiness,
    ...decision,
  };
}

/**
 * Batch form for public discovery surfaces. One joined query evaluates every
 * candidate slug, avoiding an unauthenticated N×query amplification path.
 */
export async function resolveAuthorizedPublicProfileSlugs(
  rawSlugs: string[]
): Promise<Set<string>> {
  const slugs = Array.from(
    new Set(rawSlugs.map((slug) => String(slug || "").trim()).filter(Boolean))
  ).slice(0, 100);
  const rows = await loadProfileAuthorityRows(slugs);
  return new Set(
    rows
      .filter((row) => Boolean(evaluatePublicProfileAuthority(row)))
      .map((row) => String(row.profile.slug))
  );
}
