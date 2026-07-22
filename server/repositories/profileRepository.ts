import { profiles, users, type InsertProfile, type Profile, type User } from "@shared/schema";
import { db } from "../db";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { readProfileBookingConfigBlock } from "../../shared/profileBookingConfig";

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

type ProfileMutation = Omit<InsertProfile, "id" | "ownerUserId" | "createdAt" | "updatedAt">;

function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
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

  async getProfileBySlugPublic(slug: string): Promise<PublicProfileRecord | undefined> {
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
      })
      .from(profiles)
      .innerJoin(users, eq(profiles.ownerUserId, users.id))
      .where(
        and(
          eq(profiles.slug, slug),
          eq(profiles.status, "published" as any),
          sql`COALESCE((${users.preferences} ->> 'profileVisibility'), 'private') = 'public'`
        )
      )
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    const { legacyProfileBooking, ...publicProfile } = row;
    return {
      ...publicProfile,
      profileBooking:
        readProfileBookingConfigBlock(publicProfile.contentBlocks) ?? legacyProfileBooking ?? null,
    };
  }

  async searchProfilesPublic(args: { query: string; limit?: number }): Promise<
    Array<{
      id: string;
      slug: string;
      displayName: string;
      headline: string | null;
      roleContext: any;
    }>
  > {
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
      .where(
        and(
          eq(profiles.status, "published" as any),
          sql`COALESCE((${users.preferences} ->> 'profileVisibility'), 'private') = 'public'`,
          sql`(${profiles.displayName} ILIKE ${needle} OR ${profiles.slug} ILIKE ${needle})`
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
