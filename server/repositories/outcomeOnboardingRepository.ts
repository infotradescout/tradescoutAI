import { businesses, profiles, users, type Business, type Profile } from "@shared/schema";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { db } from "../db";
import { and, eq, like, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  BusinessProfileSelectionRequiredError,
  buildOutcomePreferences,
  buildOutcomeProfileContentBlocks,
  deriveBusinessNameFromLinks,
  enforceCanonicalBusinessIdentityResolution,
  findDefensibleCanonicalBusinessMatches,
  firstNonSocialBusinessUrl,
  getIdentifiableUnlinkedBusinessProfileName,
  getStoredOutcomeBusinessEnrichment,
  mergeOutcomeBusinessProfileData,
  normalizeBusinessIdentityName,
  outcomeWebsiteIdentityDomain,
  resolveOwnedBusinessOutcomeTarget,
  resolveUnlinkedBusinessProfileTarget,
  type AtomicBusinessOutcomeArgs,
  type AtomicExpressOutcomeArgs,
} from "../services/onboardingService";

function slugify(input: string): string {
  return String(input)
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function generateUniqueSlug(
  tx: any,
  table: typeof businesses | typeof profiles,
  base: string,
  lockNamespace: string
): Promise<string> {
  const baseSlug = slugify(base) || randomUUID();
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${lockNamespace}:${baseSlug}`}))`);
  const rows = await tx
    .select({ slug: table.slug })
    .from(table)
    .where(like(table.slug, `${baseSlug}%`));
  const used = new Set(rows.map((row: { slug: string }) => String(row.slug)));
  if (!used.has(baseSlug)) return baseSlug;
  for (let suffix = 2; suffix <= 200; suffix += 1) {
    const candidate = `${baseSlug}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * Atomic persistence boundary for the universal onboarding outcome.
 *
 * This repository intentionally imports no verification, trust, ranking, or
 * claim tables. Profile population cannot manufacture or start trust state.
 */
export class OutcomeOnboardingRepository {
  async preflightBusinessProfile(
    args: Pick<AtomicBusinessOutcomeArgs, "userId" | "evidence">
  ): Promise<void> {
    const [user] = await db
      .select({
        id: users.id,
        activeBusinessId: users.activeBusinessId,
        activeProfileId: users.activeProfileId,
      })
      .from(users)
      .where(eq(users.id, args.userId))
      .limit(1);
    if (!user) throw new Error("User not found");

    const ownedBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, args.userId));
    const ownerProfiles = (await db
      .select()
      .from(profiles)
      .where(eq(profiles.ownerUserId, args.userId))) as Profile[];
    const activeProfile = user.activeProfileId
      ? ownerProfiles.find((profile) => String(profile.id) === String(user.activeProfileId))
      : undefined;
    const target = resolveOwnedBusinessOutcomeTarget(ownedBusinesses, {
      activeBusinessId: user.activeBusinessId,
      evidence: args.evidence,
      fallbackIdentityName:
        getIdentifiableUnlinkedBusinessProfileName(activeProfile) ||
        deriveBusinessNameFromLinks(args.evidence.links),
    });
    const business = target.business as Business | undefined;

    if (!business) {
      const normalizedName = normalizeBusinessIdentityName(target.displayName);
      const identityDomain = outcomeWebsiteIdentityDomain(
        firstNonSocialBusinessUrl(args.evidence.links)
      );
      const domainLike = identityDomain ? `%${identityDomain}%` : "";
      const canonicalCandidates = await db
        .select()
        .from(businesses)
        .where(
          or(
            sql`regexp_replace(lower(trim(${businesses.name})), '[^a-z0-9]+', '', 'g') = ${normalizedName}`,
            ...(identityDomain
              ? [
                  sql`lower(coalesce(${businesses.profileData}->>'website', '')) like ${domainLike}`,
                  sql`lower(coalesce(${businesses.profileData}->'importExtras'->>'google_place_website', '')) like ${domainLike}`,
                  sql`lower(coalesce(${businesses.profileData}->'importExtras'->>'googlePlaceWebsite', '')) like ${domainLike}`,
                ]
              : [])
          )
        );
      enforceCanonicalBusinessIdentityResolution(
        findDefensibleCanonicalBusinessMatches(canonicalCandidates, {
          displayName: target.displayName,
          links: args.evidence.links,
        }),
        { userId: args.userId }
      );
    }

    const linkedProfiles = business
      ? await db.select().from(profiles).where(eq(profiles.businessId, business.id)).limit(2)
      : [];
    if (linkedProfiles.length > 1) {
      throw new Error("Business has multiple linked canonical profiles");
    }
    const linkedProfile = linkedProfiles[0] as Profile | undefined;
    if (linkedProfile && String(linkedProfile.ownerUserId) !== args.userId) {
      throw new Error("Linked canonical profile belongs to another account");
    }
    if (
      linkedProfile &&
      args.evidence.targetProfileId &&
      String(linkedProfile.id) !== String(args.evidence.targetProfileId)
    ) {
      throw new BusinessProfileSelectionRequiredError([linkedProfile]);
    }
    if (!linkedProfile) {
      resolveUnlinkedBusinessProfileTarget(ownerProfiles, {
        business: business || { name: target.displayName },
        activeProfileId: user.activeProfileId,
        targetProfileId: args.evidence.targetProfileId,
      });
    }
  }

  async completeBusinessProfile(
    args: AtomicBusinessOutcomeArgs
  ): Promise<{ business: Business; profile: Profile }> {
    return db.transaction(async (tx: any) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`outcome-onboarding:${args.userId}`}))`
      );

      const [user] = await tx
        .select({
          id: users.id,
          activeBusinessId: users.activeBusinessId,
          activeProfileId: users.activeProfileId,
          preferences: users.preferences,
        })
        .from(users)
        .where(eq(users.id, args.userId))
        .limit(1);
      if (!user) throw new Error("User not found");
      // The per-user advisory lock makes the first persisted, policy-filtered
      // enrichment authoritative. A concurrent retry may finish inference with
      // different text, but it cannot append that divergent output.
      const enrichment =
        getStoredOutcomeBusinessEnrichment(user.preferences, args.evidence) || args.enrichment;

      const ownedBusinesses = await tx
        .select()
        .from(businesses)
        .where(eq(businesses.ownerUserId, args.userId));
      const ownerProfiles = (await tx
        .select()
        .from(profiles)
        .where(eq(profiles.ownerUserId, args.userId))) as Profile[];
      const activeProfileCandidate = user.activeProfileId
        ? ownerProfiles.find((profile) => String(profile.id) === String(user.activeProfileId))
        : undefined;
      const target = resolveOwnedBusinessOutcomeTarget(ownedBusinesses, {
        activeBusinessId: user.activeBusinessId,
        evidence: args.evidence,
        fallbackIdentityName:
          getIdentifiableUnlinkedBusinessProfileName(activeProfileCandidate) ||
          deriveBusinessNameFromLinks(args.evidence.links),
      });
      let business = target.business as Business | undefined;
      const displayName = target.displayName;

      if (business) {
        const profileData = mergeOutcomeBusinessProfileData(business.profileData, args.evidence, {
          isNew: false,
          enrichment,
        });
        if (!jsonEqual(profileData, business.profileData) || business.status !== "active") {
          const [updated] = await tx
            .update(businesses)
            .set({ profileData, status: "active", updatedAt: new Date() } as any)
            .where(and(eq(businesses.id, business.id), eq(businesses.ownerUserId, args.userId)))
            .returning();
          if (!updated) throw new Error("Business not found");
          business = updated as Business;
        }
      } else {
        const normalizedName = normalizeBusinessIdentityName(displayName);
        const identityDomain = outcomeWebsiteIdentityDomain(
          firstNonSocialBusinessUrl(args.evidence.links)
        );
        const identityLockKeys = [
          `outcome-business-name:${normalizedName}`,
          ...(identityDomain ? [`outcome-business-domain:${identityDomain}`] : []),
        ].sort();
        for (const identityLockKey of identityLockKeys) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${identityLockKey}))`);
        }
        const domainLike = identityDomain ? `%${identityDomain}%` : "";
        const canonicalCandidates = await tx
          .select()
          .from(businesses)
          .where(
            or(
              sql`regexp_replace(lower(trim(${businesses.name})), '[^a-z0-9]+', '', 'g') = ${normalizedName}`,
              ...(identityDomain
                ? [
                    sql`lower(coalesce(${businesses.profileData}->>'website', '')) like ${domainLike}`,
                    sql`lower(coalesce(${businesses.profileData}->'importExtras'->>'google_place_website', '')) like ${domainLike}`,
                    sql`lower(coalesce(${businesses.profileData}->'importExtras'->>'googlePlaceWebsite', '')) like ${domainLike}`,
                  ]
                : [])
            )
          );
        const identityMatches = findDefensibleCanonicalBusinessMatches(canonicalCandidates, {
          displayName,
          links: args.evidence.links,
        });
        enforceCanonicalBusinessIdentityResolution(identityMatches, { userId: args.userId });
        const slug = await generateUniqueSlug(tx, businesses, displayName, "onboarding-business");
        const [created] = await tx
          .insert(businesses)
          .values({
            ownerUserId: args.userId,
            name: displayName,
            slug,
            type: "other",
            roleContext: "business_owner",
            profileData: mergeOutcomeBusinessProfileData({}, args.evidence, {
              isNew: true,
              enrichment,
            }),
            claimStatus: "claimed",
            status: "active",
            publicDiscoveryEnabled: true,
            sources: ["selective_intelligence_onboarding"],
          } as any)
          .returning();
        if (!created) throw new Error("Failed to create business");
        business = created as Business;
      }

      const linkedProfiles = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.businessId, business.id))
        .limit(2);
      if (linkedProfiles.length > 1) {
        throw new Error("Business has multiple linked canonical profiles");
      }
      let profile = linkedProfiles[0] as Profile | undefined;
      if (profile && String(profile.ownerUserId) !== args.userId) {
        throw new Error("Linked canonical profile belongs to another account");
      }
      if (
        profile &&
        args.evidence.targetProfileId &&
        String(profile.id) !== String(args.evidence.targetProfileId)
      ) {
        throw new BusinessProfileSelectionRequiredError([profile]);
      }
      if (!profile) {
        profile = resolveUnlinkedBusinessProfileTarget(ownerProfiles, {
          business,
          activeProfileId: user.activeProfileId,
          targetProfileId: args.evidence.targetProfileId,
        }) as Profile | undefined;
      }

      const contentBlocks = buildOutcomeProfileContentBlocks(profile?.contentBlocks, {
        displayName: String(profile?.displayName || displayName),
        evidence: args.evidence,
        enrichment,
        isNew: !profile,
      });

      if (profile) {
        const needsAttach = String(profile.businessId || "") !== String(business.id);
        if (
          !jsonEqual(contentBlocks, profile.contentBlocks) ||
          profile.status !== "published" ||
          needsAttach
        ) {
          const [updated] = await tx
            .update(profiles)
            .set({
              ...(needsAttach
                ? { businessId: business.id, roleContext: business.roleContext }
                : {}),
              contentBlocks,
              status: "published",
              updatedAt: new Date(),
            } as any)
            .where(and(eq(profiles.id, profile.id), eq(profiles.ownerUserId, args.userId)))
            .returning();
          if (!updated) throw new Error("Profile not found");
          profile = updated as Profile;
        }
      } else {
        const slug = await generateUniqueSlug(
          tx,
          profiles,
          String(business.slug || displayName),
          "onboarding-profile"
        );
        const seoDescription = String((business.profileData as any)?.description || "")
          .trim()
          .slice(0, 320);
        const [created] = await tx
          .insert(profiles)
          .values({
            ownerUserId: args.userId,
            businessId: business.id,
            roleContext: business.roleContext || "business_owner",
            slug,
            displayName,
            headline: null,
            contentBlocks,
            ctaConfig: {},
            seoMeta: {
              title: displayName,
              ...(seoDescription ? { description: seoDescription } : {}),
            },
            status: "published",
          } as any)
          .returning();
        if (!created) throw new Error("Failed to create canonical business profile");
        profile = created as Profile;
      }

      const preferences = buildOutcomePreferences(user.preferences, {
        ...args,
        ...(enrichment ? { enrichment } : {}),
        kind: "business_profile",
        businessId: business.id,
        profileId: profile.id,
        resultRoute: `/u/${encodeURIComponent(String(profile.slug))}?edit=1`,
      });
      const [updatedUser] = await tx
        .update(users)
        .set({
          activeBusinessId: business.id,
          activeProfileId: profile.id,
          onboardingCompleted: true,
          profileVersion: CURRENT_PROFILE_VERSION,
          preferences,
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, args.userId))
        .returning({ id: users.id });
      if (!updatedUser) throw new Error("User not found");
      return { business, profile };
    });
  }

  async completeExpressResult(args: AtomicExpressOutcomeArgs): Promise<void> {
    await db.transaction(async (tx: any) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`outcome-onboarding:${args.userId}`}))`
      );
      const [user] = await tx
        .select({ id: users.id, preferences: users.preferences })
        .from(users)
        .where(eq(users.id, args.userId))
        .limit(1);
      if (!user) throw new Error("User not found");
      const [updated] = await tx
        .update(users)
        .set({
          onboardingCompleted: true,
          profileVersion: CURRENT_PROFILE_VERSION,
          preferences: buildOutcomePreferences(user.preferences, {
            ...args,
            kind: "express_result",
          }),
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, args.userId))
        .returning({ id: users.id });
      if (!updated) throw new Error("User not found");
    });
  }
}
