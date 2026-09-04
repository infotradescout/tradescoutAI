import {
  businesses,
  profiles,
  searchAnalytics,
  users,
  type InsertProfile,
  type Profile,
  type User,
} from "@shared/schema";
import { db } from "../db";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { readProfileBookingConfigBlock } from "../../shared/profileBookingConfig";
import { readProfileSectionConfigBlock } from "../../shared/profileSectionConfig";
import {
  canExposeProviderProfileOnPublicMap,
  canServePublishedProfileAtDirectRoute,
  type PublishedProfileExposureCandidate,
} from "../services/ownerConfirmedDirectProfile";
import {
  isSteelHomePackagesProfilePubliclyReleased,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY,
} from "@shared/steelHomePackagesProfile";
import { durableProfessionalProfileApprovalSql } from "../services/profileTargetAuthority";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";

export type PublicProfileRecord = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  roleContext: string;
  contentBlocks: any;
  ctaConfig: any;
  seoMeta: any;
  businessId: string | null;
  publiclyReleased: boolean;
  updatedAt: Date | null;
  profileSections: any | null;
  profileBooking: any | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerProfileImageUrl: string | null;
  ownerCity: string | null;
  ownerState: string | null;
  ownerRoles: string[] | null;
  servicesDescription: string | null;
};

export type PublicProfileSearchRecord = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  roleContext: any;
};

export async function loadCanonicalPublicMapProfileUrls(
  providerIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (providerIds.length === 0) return result;

  const rows = await db
    .select({
      profileId: profiles.id,
      ownerUserId: profiles.ownerUserId,
      slug: profiles.slug,
      profileStatus: profiles.status,
      profilePubliclyReleased: profiles.publiclyReleased,
      profileRoleContext: profiles.roleContext,
      profileHeadline: profiles.headline,
      profileContentBlocks: profiles.contentBlocks,
      businessId: profiles.businessId,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
      ownerEmailVerified: users.emailVerified,
      ownerRole: users.role,
      ownerRoles: users.roles,
      ownerProvider: users.provider,
      ownerPreferences: users.preferences,
      businessStatus: businesses.status,
      businessOwnerUserId: businesses.ownerUserId,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      businessSources: businesses.sources,
      businessClaimStatus: businesses.claimStatus,
      professionalRoleApproved: durableProfessionalProfileApprovalSql,
      businessProfileData: businesses.profileData,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.ownerUserId, users.id))
    .leftJoin(businesses, eq(profiles.businessId, businesses.id))
    .where(and(inArray(profiles.ownerUserId, providerIds), eq(profiles.status, "published")))
    .orderBy(desc(profiles.updatedAt));

  for (const row of rows) {
    const candidate: PublishedProfileExposureCandidate = {
      ...row,
      profileSlug: row.slug,
      profileOwnerUserId: row.ownerUserId,
    };
    if (canExposeProviderProfileOnPublicMap(candidate) && !result.has(row.ownerUserId)) {
      result.set(row.ownerUserId, `/u/${row.slug}`);
    }
  }
  return result;
}

type ProfileMutation = Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">;

function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/**
 * Public search is a discovery surface, not a route-availability shortcut.
 * Only explicitly released, active, discovery-enabled businesses with an
 * established owner verification signal may enter the search result set.
 */
function publicProfileSearchExposurePredicate() {
  return sql`(
    ${profiles.businessId} IS NOT NULL
    AND ${profiles.ownerUserId} = ${businesses.ownerUserId}
    AND ${businesses.status} = 'active'
    AND ${businesses.publicDiscoveryEnabled} = true
    AND (
      ${users.verifiedBadge} = true
      OR lower(COALESCE(${users.verificationStatus}::text, '')) = 'approved'
      OR (
        ${profiles.slug} = ${MOULDING_MILLWORK_PROFILE_SLUG}
        AND ${businesses.ownerUserId} = ${profiles.ownerUserId}
        AND lower(COALESCE(${businesses.profileData} ->> 'tradePartner', '')) = 'true'
        AND ${businesses.sources} @> ${JSON.stringify([
          MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
        ])}::jsonb
        AND NOT (${businesses.sources} @> ${JSON.stringify([
          MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
        ])}::jsonb)
        AND lower(COALESCE(${users.verificationStatus}::text, ''))
          NOT IN ('rejected', 'expired', 'suspended')
        AND (
          ${users.emailVerified} = true
          OR lower(COALESCE(${users.provider}::text, '')) = 'admin_provisioned'
          OR lower(COALESCE(${users.verificationStatus}::text, '')) = 'approved'
        )
      )
    )
    AND ${durableProfessionalProfileApprovalSql}
  )`;
}

function publicProfileVisibilityPredicate() {
  return eq(profiles.publiclyReleased, true);
}

function publicProfileReleaseExposurePredicate() {
  if (isSteelHomePackagesProfilePubliclyReleased()) return sql`true`;
  return sql`${profiles.slug} <> ${STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug}`;
}

export class ProfileRepository {
  private async generateUniqueProfileSlug(base: string): Promise<string> {
    const baseSlug = slugify(base);
    if (!baseSlug) return randomUUID();

    const existing = await db
      .select({ slug: profiles.slug })
      .from(profiles)
      .where(like(profiles.slug, `${baseSlug}%`));

    const existingSet = new Set(existing.map((r) => r.slug));
    if (!existingSet.has(baseSlug)) return baseSlug;

    for (let i = 2; i <= 200; i++) {
      const candidate = `${baseSlug}-${i}`;
      if (!existingSet.has(candidate)) return candidate;
    }
    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
  }

  async listProfilesByOwner(ownerUserId: string): Promise<Profile[]> {
    return db
      .select()
      .from(profiles)
      .where(eq(profiles.ownerUserId, ownerUserId))
      .orderBy(desc(profiles.updatedAt));
  }

  async getProfileByIdForOwner(
    ownerUserId: string,
    profileId: string
  ): Promise<Profile | undefined> {
    const rows = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.ownerUserId, ownerUserId)))
      .limit(1);
    return rows[0];
  }

  private async getProfileBySlugRecord(
    slug: string,
    publishedOnly: boolean
  ): Promise<any | undefined> {
    const rows = await db
      .select({
        id: profiles.id,
        slug: profiles.slug,
        displayName: profiles.displayName,
        headline: profiles.headline,
        roleContext: profiles.roleContext,
        contentBlocks: profiles.contentBlocks,
        ctaConfig: profiles.ctaConfig,
        seoMeta: profiles.seoMeta,
        businessId: profiles.businessId,
        publiclyReleased: profiles.publiclyReleased,
        updatedAt: profiles.updatedAt,
        profileSections: sql`(${users.preferences} -> 'profileSections')`,
        legacyProfileBooking: sql`(${users.preferences} -> 'profileBooking')`,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerProfileImageUrl: users.profileImageUrl,
        ownerCity: users.city,
        ownerState: users.state,
        ownerRoles: users.roles,
        ownerRole: users.role,
        servicesDescription: sql<string | null>`(${users.preferences} ->> 'servicesDescription')`,
        profileOwnerUserId: profiles.ownerUserId,
        ownerVerifiedBadge: users.verifiedBadge,
        ownerVerificationStatus: users.verificationStatus,
        ownerEmailVerified: users.emailVerified,
        ownerProvider: users.provider,
        ownerPreferences: users.preferences,
        businessStatus: businesses.status,
        businessOwnerUserId: businesses.ownerUserId,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        businessSources: businesses.sources,
        businessClaimStatus: businesses.claimStatus,
        professionalRoleApproved: durableProfessionalProfileApprovalSql,
        businessProfileData: businesses.profileData,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .leftJoin(businesses, eq(profiles.businessId, businesses.id))
      .where(
        publishedOnly
          ? and(eq(profiles.slug, slug), eq(profiles.status, "published" as any))
          : eq(profiles.slug, slug)
      )
      .limit(1);
    return rows[0];
  }

  private toPublicProfileRecord(row: any): PublicProfileRecord {
    const {
      legacyProfileBooking,
      profileOwnerUserId: _profileOwnerUserId,
      ownerVerifiedBadge: _ownerVerifiedBadge,
      ownerVerificationStatus: _ownerVerificationStatus,
      ownerEmailVerified: _ownerEmailVerified,
      ownerRole: _ownerRole,
      ownerProvider: _ownerProvider,
      ownerPreferences: _ownerPreferences,
      businessStatus: _businessStatus,
      businessOwnerUserId: _businessOwnerUserId,
      publicDiscoveryEnabled: _publicDiscoveryEnabled,
      businessSources: _businessSources,
      businessClaimStatus: _businessClaimStatus,
      professionalRoleApproved: _professionalRoleApproved,
      businessProfileData: _businessProfileData,
      ...publicProfile
    } = row;
    return {
      ...publicProfile,
      profileSections:
        readProfileSectionConfigBlock(publicProfile.contentBlocks) ??
        publicProfile.profileSections ??
        null,
      profileBooking:
        readProfileBookingConfigBlock(publicProfile.contentBlocks) ?? legacyProfileBooking ?? null,
    };
  }

  /** Internal draft-capable read for an already-authorized owner/staff manager. */
  async getProfileBySlugForManagement(slug: string): Promise<PublicProfileRecord | undefined> {
    const row = await this.getProfileBySlugRecord(slug, false);
    return row ? this.toPublicProfileRecord(row) : undefined;
  }

  /** Internal published-profile read for callers that bypass public business visibility rules. */
  async getProfileBySlugPublished(slug: string): Promise<PublicProfileRecord | undefined> {
    const row = await this.getProfileBySlugRecord(slug, true);
    return row ? this.toPublicProfileRecord(row) : undefined;
  }

  async getProfileBySlugPublic(slug: string): Promise<PublicProfileRecord | undefined> {
    const row = await this.getProfileBySlugRecord(slug, true);
    if (!row) return undefined;
    if (
      !canServePublishedProfileAtDirectRoute({
        profileId: row.id,
        businessId: row.businessId,
        profileSlug: row.slug,
        profileStatus: "published",
        profilePubliclyReleased: row.publiclyReleased,
        profileRoleContext: row.roleContext,
        profileHeadline: row.headline,
        profileServicesDescription: row.servicesDescription,
        profileContentBlocks: row.contentBlocks,
        profileOwnerUserId: row.profileOwnerUserId,
        ownerVerifiedBadge: row.ownerVerifiedBadge,
        ownerVerificationStatus: row.ownerVerificationStatus,
        ownerEmailVerified: row.ownerEmailVerified,
        ownerRole: row.ownerRole,
        ownerRoles: row.ownerRoles,
        ownerProvider: row.ownerProvider,
        ownerPreferences: row.ownerPreferences,
        businessStatus: row.businessStatus,
        businessOwnerUserId: row.businessOwnerUserId,
        publicDiscoveryEnabled: row.publicDiscoveryEnabled,
        businessSources: row.businessSources,
        businessClaimStatus: row.businessClaimStatus,
        professionalRoleApproved: row.professionalRoleApproved,
        businessProfileData: row.businessProfileData,
      })
    ) {
      return undefined;
    }
    return this.toPublicProfileRecord(row);
  }

  async searchProfilesPublic(args: {
    query: string;
    limit?: number;
  }): Promise<PublicProfileSearchRecord[]> {
    const raw = (args.query || "").trim();
    if (!raw) return [];

    const limit = Math.max(1, Math.min(20, Number(args.limit ?? 8) || 8));
    const needle = `%${raw.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const results = await db
      .select({
        id: profiles.id,
        slug: profiles.slug,
        displayName: profiles.displayName,
        headline: profiles.headline,
        roleContext: profiles.roleContext,
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .leftJoin(businesses, eq(profiles.businessId, businesses.id))
      .where(
        and(
          eq(profiles.status, "published" as any),
          publicProfileVisibilityPredicate(),
          publicProfileReleaseExposurePredicate(),
          sql`(${profiles.displayName} ILIKE ${needle} OR ${profiles.slug} ILIKE ${needle})`,
          publicProfileSearchExposurePredicate()
        )
      )
      .orderBy(desc(profiles.updatedAt))
      .limit(limit);

    // This route previously had a writer but no call site, leaving the growth
    // ledger permanently empty. Keep analytics failure non-blocking so search
    // remains available if the measurement table is temporarily unavailable.
    void db
      .insert(searchAnalytics)
      .values({
        userId: null,
        sessionId: null,
        searchQuery: raw.slice(0, 500),
        searchType: "public_profiles",
        filters: { limit },
        resultsCount: results.length,
        clickedResultId: null,
      })
      .catch((error) => {
        console.error("[profiles] Failed recording public profile search analytics:", error);
      });

    return results;
  }

  async createProfileForOwner(ownerUserId: string, data: ProfileMutation): Promise<Profile> {
    const slug = await this.generateUniqueProfileSlug(data.slug || data.displayName);
    const inserted = await db
      .insert(profiles)
      .values({
        ...data,
        ownerUserId,
        slug,
      } as any)
      .returning();
    const profile = inserted[0];
    if (!profile) throw new Error("Failed to create profile");
    return profile as Profile;
  }

  async updateProfileForOwner(
    ownerUserId: string,
    profileId: string,
    updates: Partial<ProfileMutation>
  ): Promise<Profile> {
    const existing = await this.getProfileByIdForOwner(ownerUserId, profileId);
    if (!existing) throw new Error("Profile not found");

    const nextSlug = updates.slug ? await this.generateUniqueProfileSlug(updates.slug) : undefined;
    const rows = await db
      .update(profiles)
      .set({
        ...updates,
        ...(nextSlug ? { slug: nextSlug } : {}),
        updatedAt: new Date(),
      } as any)
      .where(and(eq(profiles.id, profileId), eq(profiles.ownerUserId, ownerUserId)))
      .returning();

    const profile = rows[0];
    if (!profile) throw new Error("Profile not found");
    return profile as Profile;
  }

  /** Super-admin / staff manage path — does not require owner match. */
  async updateProfileById(profileId: string, updates: Partial<ProfileMutation>): Promise<Profile> {
    const [existing] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    if (!existing) throw new Error("Profile not found");

    const nextSlug = updates.slug ? await this.generateUniqueProfileSlug(updates.slug) : undefined;
    const rows = await db
      .update(profiles)
      .set({
        ...updates,
        ...(nextSlug ? { slug: nextSlug } : {}),
        updatedAt: new Date(),
      } as any)
      .where(eq(profiles.id, profileId))
      .returning();

    const profile = rows[0];
    if (!profile) throw new Error("Profile not found");
    return profile as Profile;
  }

  async getProfileById(profileId: string): Promise<Profile | undefined> {
    const [row] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    return row as Profile | undefined;
  }

  async setUserActiveProfile(userId: string, profileId: string | null): Promise<User> {
    const rows = await db
      .update(users)
      .set({ activeProfileId: profileId, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    const user = rows[0];
    if (!user) throw new Error("User not found");
    return user as User;
  }

  async getProfileOwnerUserId(profileId: string): Promise<string | null> {
    const [row] = await db
      .select({ ownerUserId: profiles.ownerUserId })
      .from(profiles)
      .where(eq(profiles.id, profileId));
    return row?.ownerUserId ?? null;
  }
}
