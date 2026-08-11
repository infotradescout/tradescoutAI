import { and, eq, inArray, or, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT_BLOCKS,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
} from "@shared/steelHomePackagesProfile";
import { db } from "../db";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/**
 * Idempotently installs the operator-approved steel-home TradePartner showcase.
 *
 * The profiles table has only draft/published states and only published rows
 * can render. This record therefore uses `published` strictly as the existing
 * renderability switch. Its linked business stays draft and undiscoverable,
 * while profile release/indexing guards enforce the product-level `unlisted`
 * state from the shared identity config.
 *
 * This provisioner never mutates the steward's preferences, roles, contact
 * data, active business, or active profile. Existing matching ownership is
 * preserved so an eventual account transfer is not silently undone.
 */
export async function provisionSteelHomePackagesProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const now = new Date();
    const candidateSlugs = Array.from(
      new Set([
        STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
        STEEL_HOME_PACKAGES_PROFILE_IDENTITY.temporarySlug,
      ])
    );

    const matchingBusinesses = await tx
      .select()
      .from(businesses)
      .where(inArray(businesses.slug, candidateSlugs))
      .limit(2);
    const matchingProfiles = await tx
      .select()
      .from(profiles)
      .where(inArray(profiles.slug, candidateSlugs))
      .limit(2);

    if (matchingBusinesses.length > 1 || matchingProfiles.length > 1) {
      throw new Error("Steel-home TradePartner canonical and temporary records conflict");
    }

    const existingBusiness = matchingBusinesses[0];
    const existingProfile = matchingProfiles[0];
    const existingBusinessOwnerId = String(existingBusiness?.ownerUserId || "").trim();
    const existingProfileOwnerId = String(existingProfile?.ownerUserId || "").trim();

    if (
      existingBusinessOwnerId &&
      existingProfileOwnerId &&
      existingBusinessOwnerId !== existingProfileOwnerId
    ) {
      throw new Error("Steel-home TradePartner business and profile ownership records disagree");
    }
    if (
      existingBusiness &&
      existingProfile?.businessId &&
      String(existingProfile.businessId) !== String(existingBusiness.id)
    ) {
      throw new Error("Steel-home TradePartner profile is linked to a different business");
    }
    if (!existingBusiness && existingProfile?.businessId) {
      throw new Error("Steel-home TradePartner profile is already linked to another business");
    }

    const configuredMasterAdminEmail = String(process.env.MASTER_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const verifiedAdminPredicate = and(
      or(eq(users.role, "super_admin"), eq(users.role, "head_admin")),
      or(eq(users.verifiedBadge, true), eq(users.verificationStatus, "approved"))
    );
    const stewardSelection = { id: users.id };
    const [configuredSteward] = configuredMasterAdminEmail
      ? await tx
          .select(stewardSelection)
          .from(users)
          .where(
            and(sql`lower(${users.email}) = ${configuredMasterAdminEmail}`, verifiedAdminPredicate)
          )
          .limit(1)
      : [];
    const [fallbackSteward] = configuredSteward
      ? []
      : await tx.select(stewardSelection).from(users).where(verifiedAdminPredicate).limit(1);
    const steward = configuredSteward || fallbackSteward;
    const ownerUserId =
      existingProfileOwnerId || existingBusinessOwnerId || String(steward?.id || "");

    if (!ownerUserId) {
      throw new Error("Steel-home TradePartner showcase needs a verified admin steward");
    }

    const existingProfileData = recordValue(existingBusiness?.profileData);
    const existingImportExtras = recordValue(existingProfileData.importExtras);
    const existingSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((value): value is string => typeof value === "string")
      : [];
    const businessValues = {
      name: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel,
      slug: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
      type: "vendor" as const,
      ownerUserId,
      roleContext: "business_owner" as const,
      profileData: {
        ...existingProfileData,
        tagline: STEEL_HOME_PACKAGES_PROFILE_CONTENT.hero.headline,
        description: STEEL_HOME_PACKAGES_PROFILE_CONTENT.hero.body,
        category: "Steel home TradePartner showcase",
        services: [
          "Worldwide Steel Buildings structure",
          "JW Stone Logistics natural stone",
          "A+ Cabinets cabinetry",
        ],
        publicContactEnabled: false,
        publicLocationEnabled: false,
        publicWebsiteEnabled: false,
        tradePartner: false,
        importExtras: {
          ...existingImportExtras,
          business_identity: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.internalKey,
          release_state: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.releaseState,
          stewardship: "operator_approved_pending_owner_decisions",
        },
      },
      claimStatus: existingBusiness?.claimStatus || "unclaimed",
      publicDiscoveryEnabled: false,
      sources: Array.from(
        new Set([...existingSources, STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE])
      ),
      status: "draft" as const,
      updatedAt: now,
    };

    const [business] = existingBusiness
      ? await tx
          .update(businesses)
          .set(businessValues as any)
          .where(
            and(eq(businesses.id, existingBusiness.id), eq(businesses.slug, existingBusiness.slug))
          )
          .returning()
      : await tx
          .insert(businesses)
          .values(businessValues as any)
          .returning();
    if (!business) throw new Error("Steel-home TradePartner business provisioning failed");

    const profileValues = {
      ownerUserId,
      businessId: business.id,
      roleContext: "business_owner" as const,
      slug: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
      displayName: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel,
      headline: STEEL_HOME_PACKAGES_PROFILE_CONTENT.hero.headline,
      contentBlocks: [...STEEL_HOME_PACKAGES_PROFILE_CONTENT_BLOCKS],
      ctaConfig: {
        primary: {
          label: STEEL_HOME_PACKAGES_PROFILE_CONTENT.hero.primaryAction,
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: `${STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel} | TradeScout`,
        description: STEEL_HOME_PACKAGES_PROFILE_CONTENT.hero.body,
      },
      // Renderable database state only; the shared release config keeps this unlisted.
      status: "published" as const,
      updatedAt: now,
    };

    const [profile] = existingProfile
      ? await tx
          .update(profiles)
          .set(profileValues as any)
          .where(and(eq(profiles.id, existingProfile.id), eq(profiles.ownerUserId, ownerUserId)))
          .returning()
      : await tx
          .insert(profiles)
          .values(profileValues as any)
          .returning();
    if (!profile) throw new Error("Steel-home TradePartner profile provisioning failed");
  });
}
