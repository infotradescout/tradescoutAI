import { and, eq, or, sql } from "drizzle-orm";
import { businesses, contractors, profiles, users } from "@shared/schema";
import {
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_LEGACY_PROFILE_SLUG,
  ISSA_BUILD_LOCAL_DISCOVERY,
  ISSA_BUILD_PROFILE_SLUG,
} from "@shared/issaBuildProfile";
import { buildIssaBuildBusinessContentBlocks, issaBuildBusinessText } from "@shared/issaBuildPageContent";
import { ISSA_BUILD_MANAGED_CONTACT } from "@shared/issaBuildManagedContact";
import { db } from "../db";

export const ISSA_BUILD_PROFILE_PROVISIONING_SOURCE = "operator_confirmed_business_profile";
export const ISSA_BUILD_MANAGED_CONTACT_SOURCE = "tradescout_managed_contact";
export const ISSA_BUILD_STEWARDSHIP_STATUS = "tradescout_admin_pending_owner_account_transfer";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

/**
 * If an older duplicate survived a prior deployment, make it non-public in a
 * standalone transaction. This safety action must not be rolled back when a
 * later ownership or provisioning check rejects the canonical update.
 */
async function quarantineDuplicateIssaBuildRecords(): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date();
    const [canonicalBusiness] = await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, ISSA_BUILD_PROFILE_SLUG))
      .limit(1);
    const [legacyBusiness] = await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, ISSA_BUILD_LEGACY_PROFILE_SLUG))
      .limit(1);
    if (
      canonicalBusiness &&
      legacyBusiness &&
      String(canonicalBusiness.id) !== String(legacyBusiness.id)
    ) {
      await tx
        .update(businesses)
        .set({
          status: "suspended",
          publicDiscoveryEnabled: false,
          updatedAt: now,
        })
        .where(eq(businesses.id, legacyBusiness.id));
      console.warn("[profile-provisioning] Suspended duplicate ISSA Build legacy business record");
    }

    const [canonicalProfile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.slug, ISSA_BUILD_PROFILE_SLUG))
      .limit(1);
    const [legacyProfile] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.slug, ISSA_BUILD_LEGACY_PROFILE_SLUG))
      .limit(1);
    if (
      canonicalProfile &&
      legacyProfile &&
      String(canonicalProfile.id) !== String(legacyProfile.id)
    ) {
      await tx
        .update(profiles)
        .set({ status: "draft", updatedAt: now })
        .where(eq(profiles.id, legacyProfile.id));
      console.warn("[profile-provisioning] Unpublished duplicate ISSA Build legacy profile record");
    }
  });
}

/**
 * Publishes ISSA Build as its own independent business profile.
 * Never use another business as owner, distributor, or Direct Connect routing.
 * The operator-approved TradeScout-managed phone and email live on this exact
 * business record and do not depend on JW Stone or any owner-account contact.
 */
export async function provisionIssaBuildProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await quarantineDuplicateIssaBuildRecords();

  await db.transaction(async (tx) => {
    const configuredMasterAdminEmail = String(process.env.MASTER_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const discoverableAdminPredicate = and(
      or(eq(users.role, "super_admin"), eq(users.role, "head_admin")),
      or(eq(users.verifiedBadge, true), eq(users.verificationStatus, "approved"))
    );

    const stewardSelection = {
      id: users.id,
      preferences: users.preferences,
    };
    const [configuredSteward] = configuredMasterAdminEmail
      ? await tx
          .select(stewardSelection)
          .from(users)
          .where(
            and(
              sql`lower(${users.email}) = ${configuredMasterAdminEmail}`,
              discoverableAdminPredicate
            )
          )
          .limit(1)
      : [];
    const [fallbackSteward] = configuredSteward
      ? []
      : await tx.select(stewardSelection).from(users).where(discoverableAdminPredicate).limit(1);
    const steward = configuredSteward || fallbackSteward;
    if (!steward?.id) {
      throw new Error("ISSA Build needs a verified admin steward before publication");
    }
    const now = new Date();

    const [existingByCanonical] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, ISSA_BUILD_PROFILE_SLUG))
      .limit(1);
    const [existingByLegacy] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, ISSA_BUILD_LEGACY_PROFILE_SLUG))
      .limit(1);
    const existingBusiness = existingByCanonical || existingByLegacy;

    const [existingProfileByCanonical] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, ISSA_BUILD_PROFILE_SLUG))
      .limit(1);
    const [existingProfileByLegacy] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, ISSA_BUILD_LEGACY_PROFILE_SLUG))
      .limit(1);
    const existingProfile = existingProfileByCanonical || existingProfileByLegacy;

    const existingBusinessOwnerId = String(existingBusiness?.ownerUserId || "").trim();
    const existingProfileOwnerId = String(existingProfile?.ownerUserId || "").trim();
    if (
      existingBusinessOwnerId &&
      existingProfileOwnerId &&
      existingBusinessOwnerId !== existingProfileOwnerId
    ) {
      throw new Error("ISSA Build business and profile ownership records disagree");
    }
    const profileOwnerUserId =
      existingProfileOwnerId || existingBusinessOwnerId || String(steward.id);

    const existingProfileData = recordValue(existingBusiness?.profileData);
    const existingImportExtras = recordValue(existingProfileData.importExtras);
    const existingSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((value): value is string => typeof value === "string")
      : [];
    // Temporary TradeScout stewardship must explicitly opt the steward into
    // public visibility for this profile gate — without borrowing another
    // business's contact routing or changing the steward's active profile.
    if (profileOwnerUserId === String(steward.id)) {
      const stewardPreferences = recordValue(steward.preferences);
      if (stewardPreferences.profileVisibility !== "public") {
        await tx
          .update(users)
          .set({
            preferences: {
              ...stewardPreferences,
              profileVisibility: "public",
            },
            updatedAt: now,
          })
          .where(eq(users.id, steward.id));
      }
    }

    const cleanImportExtras = { ...existingImportExtras };
    for (const key of [
      "distributor_name",
      "distributor_relationship",
      "product_ownership",
    ] as const) {
      delete cleanImportExtras[key];
    }

    const businessValues = {
      name: ISSA_BUILD_BUSINESS_NAME,
      slug: ISSA_BUILD_PROFILE_SLUG,
      type: "vendor" as const,
      ownerUserId: profileOwnerUserId,
      roleContext: "business_owner" as const,
      profileData: {
        ...existingProfileData,
        tagline: issaBuildBusinessText(existingProfileData.tagline, ISSA_BUILD_LOCAL_DISCOVERY.headline),
        description: issaBuildBusinessText(existingProfileData.description, ISSA_BUILD_LOCAL_DISCOVERY.description),
        category: existingProfileData.category && existingProfileData.category !== "Natural Onyx"
          ? existingProfileData.category : ISSA_BUILD_LOCAL_DISCOVERY.primaryCategory,
        services: Array.isArray(existingProfileData.services) && existingProfileData.services.length
          ? existingProfileData.services
          : ISSA_BUILD_LOCAL_DISCOVERY.services.map((service) => service.title),
        contactPreference: "message",
        // The dedicated ISSA presentation shows only the approved managed pair.
        // Generic public-business contact projection remains disabled so no
        // owner-account or imported contact can leak into another presentation.
        publicContactEnabled: false,
        publicLocationEnabled: false,
        publicWebsiteEnabled: false,
        phone: ISSA_BUILD_MANAGED_CONTACT.phone,
        email: ISSA_BUILD_MANAGED_CONTACT.email,
        notificationEmail: ISSA_BUILD_MANAGED_CONTACT.email,
        tradePartner: true,
        importExtras: {
          ...cleanImportExtras,
          business_identity: "issa_build",
          ownership: "independent_business",
          owner_confirmation: "confirmed_by_tradescout_operator",
          owner_identity_visibility: "not_publicly_disclosed",
          stewardship_status: ISSA_BUILD_STEWARDSHIP_STATUS,
          contact_management: "tradescout_managed",
          managed_contact_phone: ISSA_BUILD_MANAGED_CONTACT.phone,
          managed_contact_email: ISSA_BUILD_MANAGED_CONTACT.email,
          presentation_archetype: "lux",
          capability_source: "owner_business_story",
          inherited_platform_capabilities: [
            "direct_connect",
            "material_identity",
            "private_consultation",
          ],
          rejected_presentation_grammar: [
            "inventory_browser",
            "warehouse_yard_language",
            "catalog_product_cards",
          ],
        },
        brandColors: {
          primary: "#342316",
          primaryDark: "#17100b",
          accent: "#d9a441",
          secondary: "#6f7f70",
          background: "#f7f0e4",
          surface: "#fffaf1",
          ...recordValue(existingProfileData.brandColors),
        },
      },
      claimStatus:
        existingBusiness?.claimStatus && existingBusiness.claimStatus !== "unclaimed"
          ? existingBusiness.claimStatus
          : "owner_confirmed_pending_transfer",
      publicDiscoveryEnabled: true,
      sources: Array.from(
        new Set([
          ...existingSources.filter(
            (source) =>
              source !== "jw_stone_distributor_inventory" &&
              source !== "jw_stone_drive_source_2026_07_13" &&
              !source.startsWith("jw_stone_")
          ),
          ISSA_BUILD_PROFILE_PROVISIONING_SOURCE,
          ISSA_BUILD_MANAGED_CONTACT_SOURCE,
        ])
      ),
      status: "active" as const,
      updatedAt: now,
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
    if (!business) throw new Error("ISSA Build business provisioning failed");

    const exactRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(
        and(eq(contractors.userId, profileOwnerUserId), eq(contractors.businessId, business.id))
      )
      .limit(2);
    const slugRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(
        or(
          eq(contractors.slug, ISSA_BUILD_PROFILE_SLUG),
          eq(contractors.slug, ISSA_BUILD_LEGACY_PROFILE_SLUG)
        )
      )
      .limit(2);
    const hasNoRecommendationBinding =
      exactRecommendationTargets.length === 0 && slugRecommendationTargets.length === 0;
    const hasSingleExactRecommendationBinding =
      exactRecommendationTargets.length === 1 &&
      slugRecommendationTargets.length === 1 &&
      String(exactRecommendationTargets[0].id) === String(slugRecommendationTargets[0].id);

    if (!hasNoRecommendationBinding && !hasSingleExactRecommendationBinding) {
      console.warn(
        "[profile-provisioning] Skipping ISSA Build recommendation target mutation: contractor binding is ambiguous or conflicting"
      );
    } else if (hasNoRecommendationBinding) {
      await tx.insert(contractors).values({
        userId: profileOwnerUserId,
        businessId: business.id,
        companyName: ISSA_BUILD_BUSINESS_NAME,
        slug: ISSA_BUILD_PROFILE_SLUG,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: false,
      });
    } else {
      const recommendationTarget = exactRecommendationTargets[0];
      await tx
        .update(contractors)
        .set({
          companyName: ISSA_BUILD_BUSINESS_NAME,
          slug: ISSA_BUILD_PROFILE_SLUG,
          updatedAt: now,
        })
        .where(eq(contractors.id, recommendationTarget.id));
    }

    const existingSeo = recordValue(existingProfile?.seoMeta);
    const profileValues = {
      ownerUserId: profileOwnerUserId,
      businessId: business.id,
      roleContext: "business_owner" as const,
      slug: ISSA_BUILD_PROFILE_SLUG,
      displayName: ISSA_BUILD_BUSINESS_NAME,
      headline: issaBuildBusinessText(existingProfile?.headline, ISSA_BUILD_LOCAL_DISCOVERY.headline),
      contentBlocks: buildIssaBuildBusinessContentBlocks(existingProfile?.contentBlocks),
      ctaConfig: {
        ...recordValue(existingProfile?.ctaConfig),
        primary: {
          label: "Start a Request",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        ...existingSeo,
        title: issaBuildBusinessText(existingSeo.title, ISSA_BUILD_LOCAL_DISCOVERY.title),
        description: issaBuildBusinessText(existingSeo.description, ISSA_BUILD_LOCAL_DISCOVERY.description),
        imageUrl: existingSeo.imageUrl || "https://www.thetradescout.com/images/businesses/issa-build/applications/01.jpg",
        imageWidth: existingSeo.imageWidth || 1600,
        imageHeight: existingSeo.imageHeight || 1200,
      },
      status: "published" as const,
      updatedAt: now,
    };

    const [profile] = existingProfile
      ? await tx
          .update(profiles)
          .set(profileValues as any)
          .where(eq(profiles.id, existingProfile.id))
          .returning()
      : await tx
          .insert(profiles)
          .values(profileValues as any)
          .returning();
    if (!profile) throw new Error("ISSA Build profile provisioning failed");
  });
}
