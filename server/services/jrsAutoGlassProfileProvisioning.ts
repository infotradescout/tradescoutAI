import { and, eq, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import { JRS_AUTO_GLASS_GALLERY_BLOCKS } from "@shared/jrsAutoGlassProfile";
import { db } from "../db";
import { JRS_PROFILE_SLUG, OWNER_CONFIRMED_PROFILE_SOURCE } from "./ownerConfirmedDirectProfile";

const JRS_OWNER_EMAIL = Buffer.from("c3J0NGxpZmUyMDA0QGdtYWlsLmNvbQ==", "base64").toString("utf8");
export const JRS_PROFILE_PROVISIONING_SOURCE = OWNER_CONFIRMED_PROFILE_SOURCE;

/**
 * Idempotently installs the owner, business, and published profile records for
 * JR's Auto Glass. The owner email is used only for private account and request
 * notification routing; it is never copied into public profile content or API
 * responses.
 */
export async function provisionJrsAutoGlassProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const normalizedEmail = JRS_OWNER_EMAIL.trim().toLowerCase();
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
    const roles = Array.from(new Set([...existingRoles, "auto_service"]));

    const [owner] = existingOwner
      ? await tx
          .update(users)
          .set({
            firstName: existingOwner.firstName || "Ryan",
            lastName: existingOwner.lastName || "Bourg",
            roles,
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
            firstName: "Ryan",
            lastName: "Bourg",
            role: "auto_service",
            roles: ["auto_service"],
            activeRole: "auto_service",
            provider: "admin_provisioned",
            emailVerified: false,
            addressVerified: false,
            verificationStatus: "pending",
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

    if (!owner) throw new Error("JR's Auto Glass owner provisioning failed");

    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, JRS_PROFILE_SLUG))
      .limit(1);
    if (
      existingBusiness?.ownerUserId &&
      String(existingBusiness.ownerUserId) !== String(owner.id)
    ) {
      throw new Error("JR's Auto Glass business slug is owned by a different account");
    }
    const existingProfileData: Record<string, any> =
      existingBusiness?.profileData && typeof existingBusiness.profileData === "object"
        ? (existingBusiness.profileData as Record<string, any>)
        : {};
    const existingBrandColors: Record<string, any> =
      existingProfileData.brandColors && typeof existingProfileData.brandColors === "object"
        ? (existingProfileData.brandColors as Record<string, any>)
        : {};
    const existingNotificationEmail = String(existingProfileData.notificationEmail || "").trim();

    const businessValues = {
      name: "JR's Auto Glass",
      slug: JRS_PROFILE_SLUG,
      type: "other" as const,
      ownerUserId: owner.id,
      roleContext: "auto_service" as const,
      profileData: {
        ...existingProfileData,
        category: "Auto Glass",
        tradePartner: false,
        notificationEmail: existingNotificationEmail || normalizedEmail,
        brandColors: {
          ...existingBrandColors,
          primary: "#dc2626",
          primaryDark: "#991b1b",
          accent: "#ef4444",
          background: "#070707",
          surface: "#18181b",
        },
      },
      claimStatus: "claimed",
      publicDiscoveryEnabled: false,
      sources: [JRS_PROFILE_PROVISIONING_SOURCE],
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
    if (!business) throw new Error("JR's Auto Glass business provisioning failed");

    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, JRS_PROFILE_SLUG))
      .limit(1);
    if (existingProfile && String(existingProfile.ownerUserId) !== String(owner.id)) {
      throw new Error("JR's Auto Glass profile slug is owned by a different account");
    }

    const profileValues = {
      ownerUserId: owner.id,
      businessId: business.id,
      roleContext: "auto_service" as const,
      slug: JRS_PROFILE_SLUG,
      displayName: "JR's Auto Glass",
      headline: "Established mobile auto glass service in Ponchatoula, Louisiana.",
      contentBlocks: JRS_AUTO_GLASS_GALLERY_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Send job details",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "JR's Auto Glass | Ponchatoula Mobile Auto Glass",
        description:
          "See recent work from JR's Auto Glass in Ponchatoula, then send a private request for mobile auto glass or windshield replacement.",
        imageUrl: "https://www.thetradescout.com/images/businesses/jrs-auto-glass/cover.webp",
        imageWidth: 1122,
        imageHeight: 270,
        faviconUrl: "https://www.thetradescout.com/images/businesses/jrs-auto-glass/logo.webp",
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
    if (!profile) throw new Error("JR's Auto Glass profile provisioning failed");

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
