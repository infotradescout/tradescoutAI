import {
  businesses,
  businessCounties,
  businessVerifications,
  counties,
  profiles,
  users,
  workers,
  type Business,
  type InsertBusiness,
  type Profile,
  type User,
} from "@shared/schema";
import { db } from "../db";
import { and, asc, desc, eq, exists, ilike, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import {
  publicBusinessDetailExposureSqlPredicate,
  publicBusinessTradeSqlPredicate,
} from "../publicationBusiness";

export type PublicBusinessRecord = {
  id: string;
  name: string;
  categories: string[];
  services: string[];
  serviceAreas: string[];
  contactEmail?: string;
  contactPhone?: string;
  tradePartner: boolean;
  brandColors?: {
    primary?: string;
    primaryDark?: string;
    accent?: string;
    secondary?: string;
    background?: string;
    surface?: string;
  };
  website?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  zipCode?: string;
};

export type ClaimedBusinessWithProfile = Business & {
  canonicalProfile: Profile;
};

type BusinessMutation = Omit<InsertBusiness, "id" | "ownerUserId" | "createdAt" | "updatedAt"> & {
  countyIds?: string[];
};

function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function isMissingPublicDiscoveryEnabledColumn(error: any): boolean {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "")
    .trim()
    .toLowerCase();
  return (
    code === "42703" &&
    (message.includes("public_discovery_enabled") ||
      message.includes("businesses.public_discovery_enabled"))
  );
}

function normalizeCountyIds(countyIds: string[] | undefined): string[] {
  return Array.from(new Set((countyIds || []).filter(Boolean).map((c) => String(c).trim())));
}

function normalizePublicText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function normalizePublicDiscoveryLabel(value: unknown, maxLength: number): string | undefined {
  const normalized = sanitizePublicDiscoveryText(value, maxLength);
  return normalized || undefined;
}

function normalizePublicDiscoveryList(
  value: unknown,
  maxItems: number,
  maxItemLength: number
): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    const text = normalizePublicDiscoveryLabel(item, maxItemLength);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function normalizePublicCity(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw || raw.length > 100 || !/^[\p{L}\p{M} .'-]+$/u.test(raw)) return undefined;
  const sanitized = sanitizePublicDiscoveryText(raw, 100);
  return sanitized === raw ? sanitized : undefined;
}

function normalizePublicStateCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  return raw && /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : undefined;
}

type PublicProviderBusinessSearchArgs = {
  roleContexts?: string[];
  tradeSlug?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

function normalizeProviderSearchLimit(value: unknown): number {
  const parsed = Number(value ?? 15);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.trunc(parsed))) : 15;
}

function normalizeProviderSearchOffset(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.min(5_000, Math.max(0, Math.trunc(parsed))) : 0;
}

function applyPublicProviderBusinessSearchPredicates(
  predicates: any[],
  args: PublicProviderBusinessSearchArgs
): boolean {
  if (args.roleContexts?.length) {
    predicates.push(inArray(businesses.roleContext as any, args.roleContexts as any));
  }

  const query = String(args.query || "")
    .trim()
    .slice(0, 200);
  if (query) {
    const escapedQuery = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
    predicates.push(ilike(businesses.name, `%${escapedQuery}%`));
  }

  const tradeSlug = String(args.tradeSlug || "").trim();
  if (tradeSlug) {
    const tradePredicate = publicBusinessTradeSqlPredicate(tradeSlug);
    if (!tradePredicate) return false;
    predicates.push(tradePredicate);
  }

  return true;
}

export function buildPublicBusinessPresentationFields(
  profileData: Business["profileData"] | null | undefined,
  isTradePartner: boolean,
  publicLocationEnabled = profileData?.publicLocationEnabled === true
): Pick<PublicBusinessRecord, "categories" | "services"> &
  Partial<Pick<PublicBusinessRecord, "address" | "city" | "stateCode" | "zipCode">> {
  const category = normalizePublicDiscoveryLabel(profileData?.category, 180);
  const base = {
    categories: category ? [category] : [],
    services: normalizePublicDiscoveryList(profileData?.services, 50, 180),
  };

  if (!publicLocationEnabled) return base;

  const city = normalizePublicCity(profileData?.city);
  const stateCode = normalizePublicStateCode(profileData?.stateCode);
  const address = isTradePartner ? normalizePublicText(profileData?.address, 240) : undefined;
  const zipCode = isTradePartner ? normalizePublicText(profileData?.zipCode, 32) : undefined;

  return {
    ...base,
    ...(city ? { city } : {}),
    ...(stateCode ? { stateCode } : {}),
    ...(address ? { address } : {}),
    ...(zipCode ? { zipCode } : {}),
  };
}

export class BusinessRepository {
  private async generateUniqueBusinessSlug(base: string): Promise<string> {
    const baseSlug = slugify(base);
    if (!baseSlug) return randomUUID();

    const existing = await db
      .select({ slug: businesses.slug })
      .from(businesses)
      .where(like(businesses.slug, `${baseSlug}%`));

    const existingSet = new Set(existing.map((r) => r.slug));
    if (!existingSet.has(baseSlug)) return baseSlug;

    for (let i = 2; i <= 200; i++) {
      const candidate = `${baseSlug}-${i}`;
      if (!existingSet.has(candidate)) return candidate;
    }
    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
  }

  async listBusinessesByOwner(ownerUserId: string): Promise<Business[]> {
    try {
      return await db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerUserId, ownerUserId))
        .orderBy(desc(businesses.updatedAt));
    } catch (error: any) {
      if (!isMissingPublicDiscoveryEnabledColumn(error)) throw error;

      const fallback = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.owner_user_id as "ownerUserId",
          b.role_context as "roleContext",
          b.profile_data as "profileData",
          b.claim_status as "claimStatus",
          true as "publicDiscoveryEnabled",
          b.sources,
          b.status,
          b.created_at as "createdAt",
          b.updated_at as "updatedAt"
        from businesses b
        where b.owner_user_id = ${ownerUserId}
        order by b.updated_at desc
      `)) as any;

      return Array.isArray(fallback?.rows) ? (fallback.rows as Business[]) : [];
    }
  }

  async getBusinessByIdForOwner(
    ownerUserId: string,
    businessId: string
  ): Promise<Business | undefined> {
    try {
      const rows = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
        .limit(1);
      return rows[0];
    } catch (error: any) {
      if (!isMissingPublicDiscoveryEnabledColumn(error)) throw error;

      const fallback = (await db.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.type,
          b.owner_user_id as "ownerUserId",
          b.role_context as "roleContext",
          b.profile_data as "profileData",
          b.claim_status as "claimStatus",
          true as "publicDiscoveryEnabled",
          b.sources,
          b.status,
          b.created_at as "createdAt",
          b.updated_at as "updatedAt"
        from businesses b
        where b.id = ${businessId}
          and b.owner_user_id = ${ownerUserId}
        limit 1
      `)) as any;
      return Array.isArray(fallback?.rows) ? (fallback.rows[0] as Business | undefined) : undefined;
    }
  }

  async getBusinessBySlugPublic(slug: string): Promise<Business | undefined> {
    try {
      const rows = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.slug, slug), eq(businesses.status, "active" as any)))
        .limit(1);
      return rows[0];
    } catch (error: any) {
      // Anonymous publication must not turn a missing consent column into
      // public=true. Schema drift reaches the caller and fails closed.
      throw error;
    }
  }

  async getBusinessPublicById(businessId: string): Promise<PublicBusinessRecord | undefined> {
    const businessRows = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        profileData: businesses.profileData,
      })
      .from(businesses)
      .where(and(eq(businesses.id, businessId), ne(businesses.status, "suspended" as any)))
      .limit(1);

    const business = businessRows[0];
    if (!business) return undefined;

    const countyRows = await db
      .select({
        countyName: counties.name,
        stateCode: counties.stateCode,
      })
      .from(businessCounties)
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .where(eq(businessCounties.businessId, businessId))
      .orderBy(asc(counties.name), asc(counties.stateCode));

    const publicLocationEnabled = business.profileData?.publicLocationEnabled === true;
    const publicWebsiteEnabled = business.profileData?.publicWebsiteEnabled === true;
    const isTradePartner = business.profileData?.tradePartner === true;
    const publicPresentation = buildPublicBusinessPresentationFields(
      business.profileData,
      isTradePartner,
      publicLocationEnabled
    );

    return {
      id: business.id,
      name: business.name,
      ...publicPresentation,
      serviceAreas: Array.from(
        new Set(
          countyRows
            .map((row) =>
              [String(row.countyName || "").trim(), String(row.stateCode || "").trim()]
                .filter(Boolean)
                .join(", ")
            )
            .filter(Boolean)
        )
      ),
      tradePartner: isTradePartner,
      ...(business.profileData?.brandColors
        ? { brandColors: business.profileData.brandColors }
        : {}),
      // TradePartner location/website data can power richer public SEO. Phone
      // remains intentionally absent: Express Direct Connect reveals it only
      // after a visitor clicks the profile CTA and chooses Call.
      ...(isTradePartner && publicWebsiteEnabled
        ? { website: business.profileData?.website || undefined }
        : {}),
    };
  }

  async getBusinessCountyIds(businessId: string): Promise<string[]> {
    const rows = await db
      .select({ countyId: businessCounties.countyId })
      .from(businessCounties)
      .where(eq(businessCounties.businessId, businessId));
    return rows.map((r) => r.countyId);
  }

  async getProvidersByCountyAndCategory(args: {
    countyId: string;
    roleContexts?: string[];
    tradeSlug?: string;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      businessId: string;
      ownerUserId: string | null;
      name: string;
      roleContext: string;
      slug: string;
      profileData: Business["profileData"];
      profileHeadline: string | null;
      profileContentBlocks: Profile["contentBlocks"];
      profileSeoMeta: Profile["seoMeta"];
      canonicalProfileSlug: string | null;
    }>
  > {
    const limit = normalizeProviderSearchLimit(args.limit);
    const offset = normalizeProviderSearchOffset(args.offset);
    const predicates: any[] = [
      eq(businesses.status, "active" as any),
      eq(businesses.publicDiscoveryEnabled, true),
      publicBusinessDetailExposureSqlPredicate(),
      exists(
        db
          .select({ one: sql`1` })
          .from(businessCounties)
          .where(
            and(
              eq(businessCounties.businessId, businesses.id),
              eq(businessCounties.countyId, args.countyId)
            )
          )
          .limit(1)
      ),
    ];
    if (!applyPublicProviderBusinessSearchPredicates(predicates, args)) return [];
    const rows = await db
      .select({
        businessId: businesses.id,
        ownerUserId: businesses.ownerUserId,
        name: businesses.name,
        roleContext: businesses.roleContext,
        slug: businesses.slug,
        profileData: businesses.profileData,
        profileHeadline: sql<string | null>`(
          select p.headline from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
        profileContentBlocks: sql<Profile["contentBlocks"]>`(
          select p.content_blocks from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
        profileSeoMeta: sql<Profile["seoMeta"]>`(
          select p.seo_meta from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
        canonicalProfileSlug: sql<string | null>`(
          select p.slug from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
      })
      .from(businesses)
      .leftJoin(users, eq(businesses.ownerUserId, users.id))
      .where(and(...predicates))
      .orderBy(asc(businesses.name), asc(businesses.id))
      .limit(limit)
      .offset(offset);
    return rows as Array<{
      businessId: string;
      ownerUserId: string | null;
      name: string;
      roleContext: string;
      slug: string;
      profileData: Business["profileData"];
      profileHeadline: string | null;
      profileContentBlocks: Profile["contentBlocks"];
      profileSeoMeta: Profile["seoMeta"];
      canonicalProfileSlug: string | null;
    }>;
  }

  async getProvidersByStateAndCategory(args: {
    stateCode: string;
    roleContexts?: string[];
    tradeSlug?: string;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    Array<{
      businessId: string;
      ownerUserId: string | null;
      name: string;
      roleContext: string;
      slug: string;
      profileData: Business["profileData"];
      profileHeadline: string | null;
      profileContentBlocks: Profile["contentBlocks"];
      profileSeoMeta: Profile["seoMeta"];
      canonicalProfileSlug: string | null;
    }>
  > {
    const stateCode = normalizePublicStateCode(args.stateCode);
    if (!stateCode) return [];

    const limit = normalizeProviderSearchLimit(args.limit);
    const offset = normalizeProviderSearchOffset(args.offset);
    const predicates: any[] = [
      eq(businesses.status, "active" as any),
      eq(businesses.publicDiscoveryEnabled, true),
      publicBusinessDetailExposureSqlPredicate(),
      exists(
        db
          .select({ one: sql`1` })
          .from(businessCounties)
          .innerJoin(counties, eq(businessCounties.countyId, counties.id))
          .where(
            and(eq(businessCounties.businessId, businesses.id), eq(counties.stateCode, stateCode))
          )
          .limit(1)
      ),
    ];
    if (!applyPublicProviderBusinessSearchPredicates(predicates, args)) return [];

    const rows = await db
      .select({
        businessId: businesses.id,
        ownerUserId: businesses.ownerUserId,
        name: businesses.name,
        roleContext: businesses.roleContext,
        slug: businesses.slug,
        profileData: businesses.profileData,
        profileHeadline: sql<string | null>`(
          select p.headline from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
        profileContentBlocks: sql<Profile["contentBlocks"]>`(
          select p.content_blocks from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
        profileSeoMeta: sql<Profile["seoMeta"]>`(
          select p.seo_meta from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
        canonicalProfileSlug: sql<string | null>`(
          select p.slug from profiles p
          where p.business_id = ${businesses.id} and p.status = 'published'
          order by p.updated_at desc limit 1
        )`,
      })
      .from(businesses)
      .leftJoin(users, eq(businesses.ownerUserId, users.id))
      .where(and(...predicates))
      .orderBy(asc(businesses.name), asc(businesses.id))
      .limit(limit)
      .offset(offset);

    return rows as Array<{
      businessId: string;
      ownerUserId: string | null;
      name: string;
      roleContext: string;
      slug: string;
      profileData: Business["profileData"];
      profileHeadline: string | null;
      profileContentBlocks: Profile["contentBlocks"];
      profileSeoMeta: Profile["seoMeta"];
      canonicalProfileSlug: string | null;
    }>;
  }

  async getActiveBusinessForUser(userId: string): Promise<Business | undefined> {
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0] as User | undefined;
    if ((user as any)?.activeBusinessId) {
      const [biz] = await db
        .select()
        .from(businesses)
        .where(
          and(
            eq(businesses.id, String((user as any).activeBusinessId)),
            eq(businesses.ownerUserId, userId)
          )
        )
        .limit(1);
      if (biz) return biz as Business;
    }

    const [biz] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.ownerUserId, userId), eq(businesses.status, "active" as any)))
      .orderBy(asc(businesses.createdAt))
      .limit(1);
    return biz as Business | undefined;
  }

  async getWorkersByCountyAndSkills(args: {
    countyFips: string;
    skills?: string[];
    limit?: number;
  }): Promise<
    Array<{
      workerId: string;
      userId: string;
      firstName: string;
      lastName: string;
      skills: string[];
      hourlyRate: string | null;
      isAvailable: boolean;
    }>
  > {
    const { countyFips, skills, limit = 10 } = args;
    const rows = await db
      .select({
        workerId: workers.id,
        userId: workers.userId,
        firstName: workers.firstName,
        lastName: workers.lastName,
        skills: workers.skills,
        hourlyRate: workers.hourlyRate,
        isAvailable: workers.isAvailable,
      })
      .from(workers)
      .innerJoin(users, eq(workers.userId, users.id))
      .where(
        and(
          eq(workers.isActive, true),
          eq(workers.isAvailable, true),
          eq((users as any).countyFips, countyFips)
        )
      )
      .limit(limit * 3);

    if (!skills || skills.length === 0) {
      return rows.slice(0, limit).map((r) => ({
        ...r,
        skills: (r.skills as string[]) ?? [],
        hourlyRate: r.hourlyRate ? String(r.hourlyRate) : null,
      }));
    }

    const lowerSkills = skills.map((s) => s.toLowerCase());
    const matched = rows.filter((r) => {
      const workerSkills = ((r.skills as string[]) ?? []).map((s) => s.toLowerCase());
      return workerSkills.some((s) => lowerSkills.includes(s));
    });
    return matched.slice(0, limit).map((r) => ({
      ...r,
      skills: (r.skills as string[]) ?? [],
      hourlyRate: r.hourlyRate ? String(r.hourlyRate) : null,
    }));
  }

  async createBusinessForOwner(ownerUserId: string, data: BusinessMutation): Promise<Business> {
    const slug = await this.generateUniqueBusinessSlug(data.slug || data.name);
    const countyIds = normalizeCountyIds(data.countyIds);
    const nextSources = Array.isArray((data as any).sources)
      ? Array.from(new Set(((data as any).sources as string[]).filter(Boolean)))
      : [];

    return await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(businesses)
        .values({ ...data, ownerUserId, slug, claimStatus: "claimed", sources: nextSources } as any)
        .returning();

      const business = inserted[0];
      if (!business) throw new Error("Failed to create business");

      if (countyIds.length > 0) {
        await tx.delete(businessCounties).where(eq(businessCounties.businessId, business.id));
        await tx.insert(businessCounties).values(
          countyIds.map((countyId) => ({
            businessId: business.id,
            countyId,
          }))
        );
      }

      return business as Business;
    });
  }

  async createUnclaimedBusiness(data: BusinessMutation): Promise<Business> {
    const slug = await this.generateUniqueBusinessSlug(data.slug || data.name);
    const countyIds = normalizeCountyIds(data.countyIds);
    const nextSources = Array.isArray((data as any).sources)
      ? Array.from(new Set(((data as any).sources as string[]).filter(Boolean)))
      : [];

    return await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(businesses)
        .values({
          ...data,
          ownerUserId: null,
          slug,
          claimStatus: "unclaimed",
          sources: nextSources,
        } as any)
        .returning();

      const business = inserted[0];
      if (!business) throw new Error("Failed to create business");

      if (countyIds.length > 0) {
        await tx.delete(businessCounties).where(eq(businessCounties.businessId, business.id));
        await tx.insert(businessCounties).values(
          countyIds.map((countyId) => ({
            businessId: business.id,
            countyId,
          }))
        );
      }

      return business as Business;
    });
  }

  async claimUnclaimedBusinessForUser(
    businessId: string,
    userId: string
  ): Promise<ClaimedBusinessWithProfile> {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .update(businesses)
        .set({ ownerUserId: userId, claimStatus: "claimed", updatedAt: new Date() } as any)
        .where(
          and(
            eq(businesses.id, businessId),
            isNull(businesses.ownerUserId),
            eq(businesses.claimStatus, "unclaimed"),
            ne(businesses.status, "suspended")
          )
        )
        .returning();

      const business = rows[0];
      if (!business) throw new Error("Business is not claimable");

      try {
        const profileData: any = (business as any).profileData || {};
        const importExtras: any =
          profileData && typeof profileData === "object" ? (profileData as any).importExtras : null;
        const licenseStatus = String(
          importExtras?.license_status ?? importExtras?.licenseStatus ?? ""
        )
          .trim()
          .toLowerCase();

        if (licenseStatus) {
          const jurisdiction = String(
            importExtras?.license_jurisdiction ?? importExtras?.licenseJurisdiction ?? ""
          ).trim();
          const licenseNumber = String(
            importExtras?.license_number ?? importExtras?.licenseNumber ?? ""
          ).trim();
          const verifiedAtRaw = String(
            importExtras?.license_verified_at ?? importExtras?.licenseVerifiedAt ?? ""
          ).trim();
          const expiresAtRaw = String(
            importExtras?.license_expires_at ?? importExtras?.licenseExpiresAt ?? ""
          ).trim();
          const source = String(importExtras?.license_source ?? importExtras?.licenseSource ?? "")
            .trim()
            .slice(0, 64);
          const verifiedAt = verifiedAtRaw ? new Date(verifiedAtRaw) : null;
          const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
          const verifiedAtSafe =
            verifiedAt && Number.isFinite(verifiedAt.getTime()) ? verifiedAt : null;
          const expiresAtSafe =
            expiresAt && Number.isFinite(expiresAt.getTime()) ? expiresAt : null;
          const existing = await tx.execute(sql`
            SELECT 1
            FROM business_verifications
            WHERE provider_user_id = ${userId}
              AND verification_type = 'license'
              AND (metadata ->> 'importBusinessId') = ${business.id}
            LIMIT 1
          `);

          if ((existing as any)?.rows?.length === 0) {
            await tx.insert(businessVerifications).values({
              providerUserId: userId,
              verificationType: "license",
              jurisdiction: jurisdiction || null,
              status: licenseStatus.slice(0, 32),
              verifiedAt: verifiedAtSafe,
              expiresAt: expiresAtSafe,
              source: source || "preseed_import",
              metadata: {
                importBusinessId: business.id,
                importBusinessSlug: (business as any).slug,
                importBusinessName: (business as any).name,
                licenseNumber: licenseNumber || null,
                licenseJurisdiction: jurisdiction || null,
                licenseVerifiedAtRaw: verifiedAtRaw || null,
                licenseExpiresAtRaw: expiresAtRaw || null,
              },
            } as any);
          }
        }
      } catch (err) {
        console.warn("[claim-business] failed to convert imported license extras:", err);
      }

      const profileData =
        (business as any).profileData && typeof (business as any).profileData === "object"
          ? ((business as any).profileData as Record<string, unknown>)
          : {};
      const linkedProfiles = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.businessId, business.id))
        .orderBy(desc(profiles.updatedAt))
        .limit(2);
      if (linkedProfiles.length > 1) {
        throw new Error("Business has multiple linked canonical profiles");
      }
      const linkedProfile = linkedProfiles[0];

      let canonicalProfile: Profile;
      if (linkedProfile) {
        if (String(linkedProfile.ownerUserId) !== String(userId)) {
          throw new Error("Linked canonical profile belongs to another account");
        }
        const [reassignedProfile] = await tx
          .update(profiles)
          .set({
            ownerUserId: userId,
            roleContext: (business as any).roleContext,
            updatedAt: new Date(),
          } as any)
          .where(
            and(
              eq(profiles.id, linkedProfile.id),
              eq(profiles.businessId, business.id),
              eq(profiles.ownerUserId, userId)
            )
          )
          .returning();
        if (!reassignedProfile) throw new Error("Failed to attach canonical business profile");
        canonicalProfile = reassignedProfile as Profile;
      } else {
        const baseSlug = slugify(String((business as any).slug || (business as any).name || ""));
        const safeBaseSlug = baseSlug || `business-${String(business.id).slice(0, 8)}`;

        // Profile slugs are global. Serialize claim provisioning for this base so two
        // unrelated claims cannot select the same suffix between the read and insert.
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`claim-profile:${safeBaseSlug}`}))`
        );
        const matchingSlugs = await tx
          .select({ slug: profiles.slug })
          .from(profiles)
          .where(like(profiles.slug, `${safeBaseSlug}%`));
        const usedSlugs = new Set(matchingSlugs.map((row) => String(row.slug)));
        let profileSlug = safeBaseSlug;
        for (let suffix = 2; usedSlugs.has(profileSlug) && suffix <= 200; suffix += 1) {
          profileSlug = `${safeBaseSlug}-${suffix}`;
        }
        if (usedSlugs.has(profileSlug)) {
          profileSlug = `${safeBaseSlug}-${randomUUID().slice(0, 8)}`;
        }

        const description = String(profileData.description || "")
          .trim()
          .slice(0, 4000);
        const services = Array.isArray(profileData.services)
          ? profileData.services
              .map((service) =>
                String(service || "")
                  .trim()
                  .slice(0, 240)
              )
              .filter(Boolean)
              .slice(0, 50)
          : [];
        const contentBlocks = [
          ...(description ? [{ type: "about", data: { body: description } }] : []),
          ...(services.length > 0 ? [{ type: "services", data: { items: services } }] : []),
        ];
        const [createdProfile] = await tx
          .insert(profiles)
          .values({
            ownerUserId: userId,
            businessId: business.id,
            roleContext: (business as any).roleContext,
            slug: profileSlug,
            displayName: String((business as any).name || profileSlug),
            headline: String(profileData.tagline || profileData.category || "").trim() || null,
            contentBlocks,
            ctaConfig: {},
            seoMeta: {
              title: String((business as any).name || profileSlug),
              ...(description ? { description: description.slice(0, 320) } : {}),
            },
            status: "draft",
          } as any)
          .returning();
        if (!createdProfile) throw new Error("Failed to create canonical business profile");
        canonicalProfile = createdProfile as Profile;
      }

      const [claimingUser] = await tx
        .select({ roles: users.roles })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!claimingUser) throw new Error("Claiming user not found");

      const [updatedUser] = await tx
        .update(users)
        .set({
          activeBusinessId: business.id,
          activeProfileId: canonicalProfile.id,
          role: "business_owner",
          activeRole: "business_owner",
          roles: Array.from(
            new Set([
              ...(Array.isArray(claimingUser.roles) ? claimingUser.roles : []),
              "business_owner",
            ])
          ),
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      if (!updatedUser) throw new Error("Failed to activate claimed business profile");

      return { ...(business as Business), canonicalProfile };
    });
  }

  async updateBusinessForOwner(
    ownerUserId: string,
    businessId: string,
    updates: Partial<BusinessMutation>
  ): Promise<Business> {
    const existing = await this.getBusinessByIdForOwner(ownerUserId, businessId);
    if (!existing) throw new Error("Business not found");

    const countyIds = updates.countyIds;
    const { countyIds: _ignored, ...businessUpdates } = updates as any;
    void _ignored;

    const nextSlug = businessUpdates.slug
      ? await this.generateUniqueBusinessSlug(businessUpdates.slug)
      : undefined;

    return await db.transaction(async (tx) => {
      const rows = await tx
        .update(businesses)
        .set({
          ...businessUpdates,
          ...(nextSlug ? { slug: nextSlug } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
        .returning();

      const business = rows[0];
      if (!business) throw new Error("Business not found");

      if (Array.isArray(countyIds)) {
        const normalized = normalizeCountyIds(countyIds);
        await tx.delete(businessCounties).where(eq(businessCounties.businessId, businessId));
        if (normalized.length > 0) {
          await tx.insert(businessCounties).values(
            normalized.map((countyId) => ({
              businessId,
              countyId,
            }))
          );
        }
      }

      return business as Business;
    });
  }

  async softDeleteBusinessForOwner(ownerUserId: string, businessId: string): Promise<Business> {
    const existing = await this.getBusinessByIdForOwner(ownerUserId, businessId);
    if (!existing) throw new Error("Business not found");

    const rows = await db
      .update(businesses)
      .set({ status: "suspended" as any, updatedAt: new Date() })
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, ownerUserId)))
      .returning();

    const business = rows[0];
    if (!business) throw new Error("Business not found");
    return business;
  }

  async setUserActiveBusiness(userId: string, businessId: string | null): Promise<User> {
    const rows = await db
      .update(users)
      .set({ activeBusinessId: businessId, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    const user = rows[0];
    if (!user) throw new Error("User not found");
    return user;
  }
}
