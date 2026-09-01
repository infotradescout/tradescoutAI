import { and, eq, sql } from "drizzle-orm";
import { businesses, contractors, profiles, users } from "@shared/schema";
import { db } from "../db";
import { ADMIN_MANAGED_PROFILE_SOURCE, PRO_FAB_PROFILE_SLUG } from "./ownerConfirmedDirectProfile";
import { isProvisionedProfileAccountControlConfirmed } from "./provisionedProfileAccountControl";

export const PRO_FAB_PROFILE_PROVISIONING_SOURCE = ADMIN_MANAGED_PROFILE_SOURCE;

/**
 * Idempotently installs the owner, business, and published profile records for
 * Pro Fab Specialty Services LLC. Contact details are private routing data for
 * Direct Connect and are never copied into public profile content or responses.
 *
 * Admin-managed publication is not verification. Existing account verification
 * state is preserved, while a newly provisioned account starts pending and
 * unverified. General directory discovery stays disabled.
 */
export async function provisionProFabProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const configuredOwnerEmail = String(process.env.PRO_FAB_OWNER_EMAIL || "")
    .trim()
    .toLowerCase();
  const configuredRoutingPhone = String(process.env.PRO_FAB_ROUTING_PHONE || "").trim();
  if (!configuredOwnerEmail) {
    console.warn("[profile-provisioning] Skipping Pro Fab: PRO_FAB_OWNER_EMAIL is not configured");
    return;
  }

  await db.transaction(async (tx) => {
    const normalizedEmail = configuredOwnerEmail;
    const [existingOwner] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    if (
      existingOwner &&
      !isProvisionedProfileAccountControlConfirmed({
        emailVerified: existingOwner.emailVerified,
        provider: existingOwner.provider,
        verificationStatus: existingOwner.verificationStatus,
      })
    ) {
      throw new Error(
        "Pro Fab owner provisioning refused an unconfirmed pre-existing account"
      );
    }

    const existingPreferences: Record<string, any> =
      existingOwner?.preferences && typeof existingOwner.preferences === "object"
        ? (existingOwner.preferences as Record<string, any>)
        : {};
    const existingOwnerPreferences = {
      ...existingPreferences,
      profileVisibility: "public",
    };
    const newOwnerPreferences = {
      profileVisibility: "public",
      profileSections: {
        about: false,
        rolesAndBadges: false,
        stats: false,
        services: false,
        marketplaceListings: false,
        reviews: false,
        communityActivity: false,
        contactCard: false,
      },
    };

    const [owner] = existingOwner
      ? await tx
          .update(users)
          .set({
            firstName: existingOwner.firstName || "Brody",
            lastName: existingOwner.lastName || "Joiner",
            // Evaluate against the row version PostgreSQL locks for this UPDATE so a
            // concurrent professional approval projection cannot be stale-overwritten.
            roles: sql`(
              select array_agg(distinct role_value)
              from unnest(
                coalesce(${users.roles}, array[]::text[]) || array['contractor']::text[]
              ) as role_value
              where role_value <> ''
            )`,
            preferences: existingOwnerPreferences,
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, existingOwner.id))
          .returning()
      : await tx
          .insert(users)
          .values({
            email: normalizedEmail,
            firstName: "Brody",
            lastName: "Joiner",
            role: "contractor",
            roles: ["contractor"],
            activeRole: "contractor",
            provider: "admin_provisioned",
            emailVerified: false,
            addressVerified: false,
            verifiedBadge: false,
            verificationStatus: "pending",
            onboardingCompleted: false,
            preferences: newOwnerPreferences,
          } as any)
          .returning();

    if (!owner) throw new Error("Pro Fab owner provisioning failed");

    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, PRO_FAB_PROFILE_SLUG))
      .limit(1);
    if (
      existingBusiness?.ownerUserId &&
      String(existingBusiness.ownerUserId) !== String(owner.id)
    ) {
      throw new Error("Pro Fab business slug is owned by a different account");
    }

    const existingProfileData: Record<string, any> =
      existingBusiness?.profileData && typeof existingBusiness.profileData === "object"
        ? (existingBusiness.profileData as Record<string, any>)
        : {};
    const existingSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((source): source is string => typeof source === "string")
      : [];
    const existingNotificationEmail = String(existingProfileData.notificationEmail || "").trim();
    const existingPhone = String(existingProfileData.phone || "").trim();
    const routingPhone = existingPhone || configuredRoutingPhone;

    const businessValues = {
      name: "Pro Fab Specialty Services LLC",
      slug: PRO_FAB_PROFILE_SLUG,
      type: "other" as const,
      ownerUserId: owner.id,
      roleContext: "contractor" as const,
      profileData: {
        ...existingProfileData,
        category: "Welding & Metal Fabrication",
        tradePartner: false,
        ...(routingPhone ? { phone: routingPhone } : {}),
        notificationEmail: existingNotificationEmail || normalizedEmail,
        brandColors: {
          primary: "#dc2626",
          primaryDark: "#991b1b",
          accent: "#ef4444",
          background: "#050505",
          surface: "#18181b",
        },
      },
      claimStatus: existingBusiness?.claimStatus || "unclaimed",
      publicDiscoveryEnabled: false,
      sources: Array.from(new Set([...existingSources, PRO_FAB_PROFILE_PROVISIONING_SOURCE])),
      status: "active" as const,
      updatedAt: new Date(),
    };

    const [business] = existingBusiness
      ? await tx
          .update(businesses)
          .set(businessValues as any)
          .where(eq(businesses.id, existingBusiness.id))
          .returning()
      : await tx
          .insert(businesses)
          .values(businessValues as any)
          .returning();
    if (!business) throw new Error("Pro Fab business provisioning failed");

    // Recommendations require a legacy contractor ID. Ignore any other
    // businesses owned by this account and mutate only a single record already
    // bound to this exact owner, business, and canonical slug. A new
    // compatibility record starts inactive and unverified; an existing exact
    // record keeps its earned directory and credential state.
    const exactRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(and(eq(contractors.userId, owner.id), eq(contractors.businessId, business.id)))
      .limit(2);
    const slugRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(eq(contractors.slug, PRO_FAB_PROFILE_SLUG))
      .limit(2);
    const hasNoRecommendationBinding =
      exactRecommendationTargets.length === 0 && slugRecommendationTargets.length === 0;
    const hasSingleExactRecommendationBinding =
      exactRecommendationTargets.length === 1 &&
      slugRecommendationTargets.length === 1 &&
      String(exactRecommendationTargets[0].id) === String(slugRecommendationTargets[0].id) &&
      String(exactRecommendationTargets[0].slug) === PRO_FAB_PROFILE_SLUG;

    if (!hasNoRecommendationBinding && !hasSingleExactRecommendationBinding) {
      // Fail closed for Recommend without rolling back the otherwise valid
      // profile. A later data repair can establish one exact binding.
      console.warn(
        "[profile-provisioning] Skipping Pro Fab recommendation target mutation: contractor binding is ambiguous or conflicting"
      );
    } else if (hasNoRecommendationBinding) {
      await tx.insert(contractors).values({
        userId: owner.id,
        businessId: business.id,
        companyName: "Pro Fab Specialty Services LLC",
        slug: PRO_FAB_PROFILE_SLUG,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: false,
      });
    } else {
      const recommendationTarget = exactRecommendationTargets[0];
      await tx
        .update(contractors)
        .set({
          companyName: "Pro Fab Specialty Services LLC",
          updatedAt: new Date(),
        })
        .where(eq(contractors.id, recommendationTarget.id));
    }

    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, PRO_FAB_PROFILE_SLUG))
      .limit(1);
    if (existingProfile && String(existingProfile.ownerUserId) !== String(owner.id)) {
      throw new Error("Pro Fab profile slug is owned by a different account");
    }

    const profileValues = {
      ownerUserId: owner.id,
      businessId: business.id,
      roleContext: "contractor" as const,
      slug: PRO_FAB_PROFILE_SLUG,
      displayName: "Pro Fab Specialty Services LLC",
      headline: "Welding and custom metal fabrication in Hammond, Louisiana.",
      contentBlocks: [],
      ctaConfig: {
        primary: {
          label: "Direct Connect with Pro Fab",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "Pro Fab Specialty Services | Hammond Welding",
        description:
          "Connect with Pro Fab Specialty Services in Hammond for welding, custom metal fabrication, structural steel, piping, field service, and repair.",
        imageUrl:
          "https://www.thetradescout.com/images/businesses/pro-fab-specialty-services/social-preview.jpg",
        imageWidth: 1200,
        imageHeight: 630,
        faviconUrl:
          "https://www.thetradescout.com/images/businesses/pro-fab-specialty-services/logo.svg",
      },
      status: "published" as const,
      updatedAt: new Date(),
    };

    const [profile] = existingProfile
      ? await tx
          .update(profiles)
          .set(profileValues as any)
          .where(
            and(eq(profiles.id, existingProfile.id), eq(profiles.ownerUserId, String(owner.id)))
          )
          .returning()
      : await tx
          .insert(profiles)
          .values(profileValues as any)
          .returning();
    if (!profile) throw new Error("Pro Fab profile provisioning failed");

    await tx
      .update(users)
      .set({
        activeBusinessId: existingOwner?.activeBusinessId || business.id,
        activeProfileId: existingOwner?.activeProfileId || profile.id,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, owner.id));
  });
}
