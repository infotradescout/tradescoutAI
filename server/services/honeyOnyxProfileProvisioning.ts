import { and, eq, or, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import {
  HONEY_ONYX_DISTRIBUTOR_NAME,
  HONEY_ONYX_PROFILE_CONTENT_BLOCKS,
  HONEY_ONYX_PROFILE_SLUG,
} from "@shared/honeyOnyxProfile";
import { db } from "../db";

export const HONEY_ONYX_PROFILE_PROVISIONING_SOURCE = "operator_confirmed_product_profile";
export const HONEY_ONYX_STEWARDSHIP_STATUS = "tradescout_admin_pending_owner_account_transfer";

const JW_STONE_PROFILE_SLUG = "jw-stone";
const DISTRIBUTOR_SOURCE = "jw_stone_distributor_inventory";
const DRIVE_SOURCE = "jw_stone_drive_source_2026_07_13";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

/**
 * Publishes Honey Onyx as its own product profile. JW Stone is copied only as
 * the current distribution contact; it is never recorded as the product owner.
 * Until the owner's account is attached, an already-verified TradeScout admin
 * holds the required profile FK without changing that admin's active profile.
 */
export async function provisionHoneyOnyxProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

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
      throw new Error("Honey Onyx needs a verified admin steward before publication");
    }

    const [distributorBusiness] = await tx
      .select({ profileData: businesses.profileData })
      .from(businesses)
      .where(eq(businesses.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);
    const distributorProfileData = recordValue(distributorBusiness?.profileData);
    const distributorPhone = String(distributorProfileData.phone || "").trim();
    const distributorNotificationEmail = String(
      distributorProfileData.notificationEmail || distributorProfileData.email || ""
    ).trim();
    if (!distributorPhone || !distributorNotificationEmail) {
      throw new Error(
        "Honey Onyx Direct Connect requires JW Stone's private distribution phone and notification email"
      );
    }

    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, HONEY_ONYX_PROFILE_SLUG))
      .limit(1);
    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, HONEY_ONYX_PROFILE_SLUG))
      .limit(1);

    const existingBusinessOwnerId = String(existingBusiness?.ownerUserId || "").trim();
    const existingProfileOwnerId = String(existingProfile?.ownerUserId || "").trim();
    if (
      existingBusinessOwnerId &&
      existingProfileOwnerId &&
      existingBusinessOwnerId !== existingProfileOwnerId
    ) {
      throw new Error("Honey Onyx business and profile ownership records disagree");
    }
    const profileOwnerUserId =
      existingProfileOwnerId || existingBusinessOwnerId || String(steward.id);

    const existingProfileData = recordValue(existingBusiness?.profileData);
    const existingImportExtras = recordValue(existingProfileData.importExtras);
    const existingSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((value): value is string => typeof value === "string")
      : [];
    const now = new Date();

    // The canonical public-profile read requires the owning account to opt in
    // to public visibility. During temporary TradeScout stewardship, make that
    // opt-in explicit instead of bypassing the public-profile gate. Once the
    // owner account is attached, its own visibility preference remains in
    // control because this update only applies to the selected admin steward.
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

    const businessValues = {
      name: "Honey Onyx",
      slug: HONEY_ONYX_PROFILE_SLUG,
      type: "vendor" as const,
      ownerUserId: profileOwnerUserId,
      roleContext: "business_owner" as const,
      profileData: {
        ...existingProfileData,
        tagline: "Natural onyx that shifts from soft daylight movement to a warm backlit glow.",
        description:
          "Honey Onyx is an independently owned translucent natural stone product distributed through JW Stone.",
        category: "Natural Onyx",
        services: [
          "Honey Onyx slab availability",
          "Backlit application planning",
          "Project and fabrication coordination",
        ],
        contactPreference: "message",
        phone: String(existingProfileData.phone || "").trim() || distributorPhone,
        notificationEmail:
          String(existingProfileData.notificationEmail || "").trim() ||
          distributorNotificationEmail,
        tradePartner: true,
        importExtras: {
          ...existingImportExtras,
          product_ownership: "independent_from_distributor",
          owner_confirmation: "confirmed_by_tradescout_operator",
          owner_identity_visibility: "not_publicly_disclosed",
          distributor_name: HONEY_ONYX_DISTRIBUTOR_NAME,
          distributor_relationship: "distribution_and_availability_contact",
          stewardship_status: HONEY_ONYX_STEWARDSHIP_STATUS,
        },
        brandColors: {
          primary: "#342316",
          primaryDark: "#17100b",
          accent: "#d9a441",
          secondary: "#6f7f70",
          background: "#f7f0e4",
          surface: "#fffaf1",
        },
      },
      claimStatus:
        existingBusiness?.claimStatus && existingBusiness.claimStatus !== "unclaimed"
          ? existingBusiness.claimStatus
          : "owner_confirmed_pending_transfer",
      publicDiscoveryEnabled: true,
      sources: Array.from(
        new Set([
          ...existingSources,
          HONEY_ONYX_PROFILE_PROVISIONING_SOURCE,
          DISTRIBUTOR_SOURCE,
          DRIVE_SOURCE,
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
    if (!business) throw new Error("Honey Onyx business provisioning failed");

    const profileValues = {
      ownerUserId: profileOwnerUserId,
      businessId: business.id,
      roleContext: "business_owner" as const,
      slug: HONEY_ONYX_PROFILE_SLUG,
      displayName: "Honey Onyx",
      headline: "A natural onyx that changes when the light comes on.",
      contentBlocks: HONEY_ONYX_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Direct Connect",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "Honey Onyx | Natural Backlit Onyx",
        description:
          "Explore six real Honey Onyx slab photos in daylight and backlit conditions, then ask about availability through private TradeScout Direct Connect.",
        imageUrl: "https://www.thetradescout.com/images/businesses/honey-onyx/2.jpg",
        imageWidth: 1600,
        imageHeight: 1200,
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
    if (!profile) throw new Error("Honey Onyx profile provisioning failed");
  });
}
