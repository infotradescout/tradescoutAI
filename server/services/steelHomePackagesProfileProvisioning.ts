/* eslint-disable @typescript-eslint/no-explicit-any -- Provisioning preserves schema-owned JSON and legacy row types. */
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import {
  STEEL_HOME_PACKAGES_PROFILE_CONTENT,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT_BLOCKS,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
} from "@shared/steelHomePackagesProfile";
import { db } from "../db";
import { provisionTradeScoutManagedPartnerContacts } from "./jwStoneManagedContactProvisioning";
import { hasVerifiedTradeScoutAdminCustody } from "./ownerConfirmedDirectProfile";
import { provisionRedGranitiProfile } from "./redGranitiProfileProvisioning";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/**
 * Idempotently installs the operator-approved steel-home planning tools profile.
 *
 * The profiles table has only draft/published states and only published rows
 * can render. This record therefore uses `published` strictly as the existing
 * renderability switch. Its linked business stays draft and undiscoverable,
 * while profile release/indexing guards enforce the product-level `unlisted`
 * state from the shared identity config.
 *
 * This provisioner never mutates the steward's preferences, roles, contact
 * data, active business, or active profile. Existing matching ownership is
 * preserved only while it remains under a verified TradeScout admin; any
 * other transfer fails closed instead of changing the public recipient label.
 */
async function provisionSteelHomePackagesProfileRecord(): Promise<void> {
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
      throw new Error("Steel-home project tools canonical and temporary records conflict");
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
      throw new Error("Steel-home project tools business and profile ownership records disagree");
    }
    if (
      existingBusiness &&
      existingProfile?.businessId &&
      String(existingProfile.businessId) !== String(existingBusiness.id)
    ) {
      throw new Error("Steel-home project tools profile is linked to a different business");
    }
    if (!existingBusiness && existingProfile?.businessId) {
      throw new Error("Steel-home project tools profile is already linked to another business");
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
      throw new Error("Steel-home project tools need a verified admin steward");
    }

    const [selectedOwner] = await tx
      .select({
        role: users.role,
        roles: users.roles,
        verifiedBadge: users.verifiedBadge,
        verificationStatus: users.verificationStatus,
      })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);
    if (
      !selectedOwner ||
      !hasVerifiedTradeScoutAdminCustody({
        ownerRole: selectedOwner.role,
        ownerRoles: selectedOwner.roles,
        ownerVerifiedBadge: selectedOwner.verifiedBadge,
        ownerVerificationStatus: selectedOwner.verificationStatus,
      })
    ) {
      throw new Error("Steel-home project tools owner must remain a verified TradeScout admin");
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
        category: "Steel-home planning tools",
        services: [
          "Countertop planner and area estimates",
          "Cabinet planner and early price estimates",
          "Metal building planner and early price estimates",
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
    if (!business) throw new Error("Steel-home project tools business provisioning failed");

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
    if (!profile) throw new Error("Steel-home project tools profile provisioning failed");
  });
}

/**
 * The server's final best-effort profile bootstrap invokes this function. Keep
 * the records isolated so a failure in one is still reported without
 * preventing the others from being attempted during the same production boot.
 */
export async function provisionSteelHomePackagesProfile(): Promise<void> {
  let steelHomeFailure: unknown = null;
  let redGranitiFailure: unknown = null;
  let managedContactFailure: unknown = null;

  try {
    await provisionSteelHomePackagesProfileRecord();
  } catch (error) {
    steelHomeFailure = error;
  }

  try {
    await provisionRedGranitiProfile();
  } catch (error) {
    redGranitiFailure = error;
    console.error("[profile-provisioning] R.E.D. Graniti provisioning failed", error);
  }

  // This must remain the final pass. Individual profile provisioners may write
  // source-specific placeholders while creating their records; the registry
  // then restores the one approved public contact across every managed partner.
  try {
    await provisionTradeScoutManagedPartnerContacts();
  } catch (error) {
    managedContactFailure = error;
    console.error("[profile-provisioning] Managed partner contacts failed", error);
  }

  if (steelHomeFailure) throw steelHomeFailure;
  if (redGranitiFailure) throw redGranitiFailure;
  if (managedContactFailure) throw managedContactFailure;
}
