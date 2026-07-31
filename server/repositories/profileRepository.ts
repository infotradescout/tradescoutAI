import {
  businesses,
  profiles,
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
  ADMIN_MANAGED_PROFILE_SOURCE,
  canExposeProviderProfileOnPublicMap,
  canExposePublishedProfilePublicly,
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  PRO_FAB_PROFILE_SLUG,
  type PublishedProfileExposureCandidate,
} from "../services/ownerConfirmedDirectProfile";
import {
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";

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
      businessId: profiles.businessId,
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

function publicProfileSearchExposurePredicate() {
  const ownerConfirmedSource = JSON.stringify([OWNER_CONFIRMED_PROFILE_SOURCE]);
  const adminManagedSource = JSON.stringify([ADMIN_MANAGED_PROFILE_SOURCE]);
  return sql`(
    ${profiles.businessId} IS NULL
    OR ${users.verifiedBadge} = true
    OR lower(COALESCE(${users.verificationStatus}, '')) = 'approved'
    OR (
      ${businesses.status} = 'active'
      AND ${businesses.publicDiscoveryEnabled} = false
      AND ${profiles.ownerUserId} = ${businesses.ownerUserId}
      AND (
        (
          ${profiles.slug} = ${JRS_PROFILE_SLUG}
          AND COALESCE(${businesses.sources}, '[]'::jsonb) @> ${ownerConfirmedSource}::jsonb
        )
        OR (
          ${profiles.slug} = ${PRO_FAB_PROFILE_SLUG}
          AND COALESCE(${businesses.sources}, '[]'::jsonb) @> ${adminManagedSource}::jsonb
        )
        OR (
          ${profiles.slug} = ${PRECISION_AERIAL_PROFILE_SLUG}
          AND COALESCE(${businesses.sources}, '[]'::jsonb) @> ${adminManagedSource}::jsonb
          AND lower(COALESCE(${businesses.claimStatus}, '')) = 'unclaimed'
          AND ${users.provider} = ${PRECISION_AERIAL_STEWARD_PROVIDER}
          AND COALESCE(${users.preferences} -> 'internalProfileSteward' ->> 'profileSlug', '') = ${PRECISION_AERIAL_PROFILE_SLUG}
          AND COALESCE(${users.preferences} -> 'internalProfileSteward' ->> 'source', '') = ${ADMIN_MANAGED_PROFILE_SOURCE}
        )
      )
    )
  )`;
}

function publicProfileVisibilityPredicate() {
  return sql`(
    lower(COALESCE(${users.preferences} ->> 'profileVisibility', 'private')) = 'public'
    OR COALESCE(${users.preferences} -> 'publicProfileIds', '[]'::jsonb)
       @> jsonb_build_array(CAST(${profiles.id} AS text))
  )`;
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

  private async getProfileBySlugPublishedRecord(slug: string): Promise<any | undefined> {
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
        updatedAt: profiles.updatedAt,
        profileSections: sql`(${users.preferences} -> 'profileSections')`,
        legacyProfileBooking: sql`(${users.preferences} -> 'profileBooking')`,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        ownerProfileImageUrl: users.profileImageUrl,
        ownerCity: users.city,
        ownerState: users.state,
        ownerRoles: users.roles,
        servicesDescription: sql<string | null>`(${users.preferences} ->> 'servicesDescription')`,
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
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .leftJoin(businesses, eq(profiles.businessId, businesses.id))
      .where(and(eq(profiles.slug, slug), eq(profiles.status, "published" as any)))
      .limit(1);
    return rows[0];
  }

  private toPublicProfileRecord(row: any): PublicProfileRecord {
    const {
      legacyProfileBooking,
      profileOwnerUserId: _profileOwnerUserId,
      ownerVerifiedBadge: _ownerVerifiedBadge,
      ownerVerificationStatus: _ownerVerificationStatus,
      ownerProvider: _ownerProvider,
      ownerPreferences: _ownerPreferences,
      businessStatus: _businessStatus,
      businessOwnerUserId: _businessOwnerUserId,
      publicDiscoveryEnabled: _publicDiscoveryEnabled,
      businessSources: _businessSources,
      businessClaimStatus: _businessClaimStatus,
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

  /**
   * Internal published-profile read used only by the authenticated API preview
   * path, which applies owner/staff authorization after resolving ownership.
   */
  async getProfileBySlugPublished(slug: string): Promise<PublicProfileRecord | undefined> {
    const row = await this.getProfileBySlugPublishedRecord(slug);
    return row ? this.toPublicProfileRecord(row) : undefined;
  }

  async getProfileBySlugPublic(slug: string): Promise<PublicProfileRecord | undefined> {
    const row = await this.getProfileBySlugPublishedRecord(slug);
    if (!row) return undefined;
    if (
      !canExposePublishedProfilePublicly({
        profileId: row.id,
        businessId: row.businessId,
        profileSlug: row.slug,
        profileStatus: "published",
        profileOwnerUserId: row.profileOwnerUserId,
        ownerVerifiedBadge: row.ownerVerifiedBadge,
        ownerVerificationStatus: row.ownerVerificationStatus,
        ownerProvider: row.ownerProvider,
        ownerPreferences: row.ownerPreferences,
        businessStatus: row.businessStatus,
        businessOwnerUserId: row.businessOwnerUserId,
        publicDiscoveryEnabled: row.publicDiscoveryEnabled,
        businessSources: row.businessSources,
        businessClaimStatus: row.businessClaimStatus,
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

    return db
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
          sql`(${profiles.displayName} ILIKE ${needle} OR ${profiles.slug} ILIKE ${needle})`,
          publicProfileSearchExposurePredicate()
        )
      )
      .orderBy(desc(profiles.updatedAt))
      .limit(limit);
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
    return user;
  }

  async getProfileOwnerUserId(profileId: string): Promise<string | null> {
    const [row] = await db
      .select({ ownerUserId: profiles.ownerUserId })
      .from(profiles)
      .where(eq(profiles.id, profileId));
    return row?.ownerUserId ?? null;
  }
}
