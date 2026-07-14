import { and, eq, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";

const PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services";
const PRO_FAB_OWNER_EMAIL = Buffer.from(
  "YnJvZHlAd3d3cHJvZmFiLmNvbQ==",
  "base64"
).toString("utf8");
const PRO_FAB_PHONE = Buffer.from("OTg1LTMyMC0xNzQz", "base64").toString("utf8");
export const PRO_FAB_PROFILE_PROVISIONING_SOURCE = "admin_provisioned_business_profile";

/**
 * Idempotently installs the owner, business, and published profile records for
 * Pro Fab Specialty Services LLC. Contact details are routing data for Express
 * Direct Connect and are not copied into the public profile content.
 */
export async function provisionProFabProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const normalizedEmail = PRO_FAB_OWNER_EMAIL.trim().toLowerCase();
    const [existingOwner] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    const existingPreferences: Record<string, any> =
      existingOwner?.preferences && typeof existingOwner.preferences === "object"
        ? (existingOwner.preferences as Record<string, any>)
        : {};
    const existingRoles = Array.isArray(existingOwner?.roles) ? existingOwner.roles : [];
    const roles = Array.from(new Set([...existingRoles, "contractor"]));

    const [owner] = existingOwner
      ? await tx
          .update(users)
          .set({
            firstName: existingOwner.firstName || "Brody",
            lastName: existingOwner.lastName || "Joiner",
            roles,
            verifiedBadge: existingOwner.verifiedBadge === true,
            // This authorizes the admin-managed profile as a Direct Connect
            // destination. It does not assert license, insurance, identity,
            // email, or address verification.
            verificationStatus: "approved",
            preferences: {
              ...existingPreferences,
              profileVisibility: "public",
              profileSections: {
                ...(existingPreferences.profileSections || {}),
                about: false,
                rolesAndBadges: false,
                stats: false,
                services: false,
                marketplaceListings: false,
                reviews: false,
                communityActivity: false,
                contactCard: false,
              },
            },
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
            // This authorizes the admin-managed profile as a Direct Connect
            // destination. It does not assert license, insurance, identity,
            // email, or address verification.
            verificationStatus: "approved",
            onboardingCompleted: false,
            preferences: {
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
            },
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

    const businessValues = {
      name: "Pro Fab Specialty Services LLC",
      slug: PRO_FAB_PROFILE_SLUG,
      type: "other" as const,
      ownerUserId: owner.id,
      roleContext: "contractor" as const,
      profileData: {
        category: "Welding & Metal Fabrication",
        tradePartner: true,
        phone: PRO_FAB_PHONE,
        notificationEmail: normalizedEmail,
        brandColors: {
          primary: "#dc2626",
          primaryDark: "#991b1b",
          accent: "#ef4444",
          background: "#050505",
          surface: "#18181b",
        },
      },
      claimStatus: "claimed",
      publicDiscoveryEnabled: false,
      sources: [PRO_FAB_PROFILE_PROVISIONING_SOURCE],
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
        activeBusinessId: business.id,
        activeProfileId: profile.id,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, owner.id));
  });
}
