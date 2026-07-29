import { and, eq } from "drizzle-orm";
import {
  PRECISION_AERIAL_BUSINESS_NAME,
  PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_PUBLIC_SOURCES,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";
import { ADMIN_MANAGED_PROFILE_SOURCE } from "./ownerConfirmedDirectProfile";

export const PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE = ADMIN_MANAGED_PROFILE_SOURCE;

const PRECISION_AERIAL_STEWARD_EMAIL = `${PRECISION_AERIAL_PROFILE_SLUG}@profile-steward.invalid`;

const DISABLED_PROFILE_SECTIONS = {
  about: false,
  rolesAndBadges: false,
  stats: false,
  services: false,
  marketplaceListings: false,
  reviews: false,
  communityActivity: false,
  contactCard: false,
} as const;

function isProtectedOrHumanAccount(user: any): boolean {
  const roles = [
    String(user?.role || ""),
    ...(Array.isArray(user?.roles) ? user.roles.map((role: unknown) => String(role || "")) : []),
  ].map((role) => role.trim().toLowerCase());

  return roles.some((role) =>
    ["admin", "head_admin", "moderator", "ops_admin", "super_admin"].includes(role)
  );
}

function hasExactStewardAuthority(user: any): boolean {
  const preferences =
    user?.preferences && typeof user.preferences === "object"
      ? (user.preferences as Record<string, any>)
      : {};
  const marker =
    preferences.internalProfileSteward && typeof preferences.internalProfileSteward === "object"
      ? preferences.internalProfileSteward
      : {};

  return (
    String(user?.provider || "") === PRECISION_AERIAL_STEWARD_PROVIDER &&
    String(marker.profileSlug || "") === PRECISION_AERIAL_PROFILE_SLUG &&
    String(marker.source || "") === PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE &&
    !isProtectedOrHumanAccount(user)
  );
}

/**
 * Installs the production-backed Precision Aerial Services profile under a
 * dedicated internal steward. The steward is routing infrastructure only: it
 * is not Cameron's claimed account, a verification signal, or a public
 * identity.
 *
 * Existing claimed, suspended, unpublished, differently linked, or
 * non-steward records fail closed. This prevents a startup deploy from
 * overwriting a real owner or silently resurrecting an intentionally disabled
 * profile.
 */
export async function provisionPrecisionAerialProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, PRECISION_AERIAL_PROFILE_SLUG))
      .limit(1);
    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, PRECISION_AERIAL_PROFILE_SLUG))
      .limit(1);
    const [existingSteward] = await tx
      .select()
      .from(users)
      .where(eq(users.email, PRECISION_AERIAL_STEWARD_EMAIL))
      .limit(1);

    if (!existingSteward && (existingBusiness || existingProfile)) {
      throw new Error(
        "Precision Aerial slug collision exists without the dedicated profile steward"
      );
    }
    if (existingSteward && !hasExactStewardAuthority(existingSteward)) {
      throw new Error("Precision Aerial steward identity is not the exact internal authority");
    }
    if (
      existingBusiness &&
      String(existingBusiness.ownerUserId || "") !== String(existingSteward?.id || "")
    ) {
      throw new Error("Precision Aerial business slug is owned by a non-steward account");
    }
    if (existingBusiness && String(existingBusiness.claimStatus) !== "unclaimed") {
      throw new Error("Precision Aerial business is claimed; provisioning will not overwrite it");
    }
    if (existingBusiness && String(existingBusiness.status) !== "active") {
      throw new Error(
        "Precision Aerial business is not active; provisioning will not reactivate it"
      );
    }
    if (
      existingProfile &&
      String(existingProfile.ownerUserId || "") !== String(existingSteward?.id || "")
    ) {
      throw new Error("Precision Aerial profile slug is owned by a non-steward account");
    }
    if (
      existingProfile &&
      (!existingBusiness ||
        String(existingProfile.businessId || "") !== String(existingBusiness.id || ""))
    ) {
      throw new Error("Precision Aerial profile is not linked to the exact steward business");
    }
    if (existingProfile && String(existingProfile.status) !== "published") {
      throw new Error(
        "Precision Aerial profile is unpublished; provisioning will not republish it"
      );
    }

    const existingPreferences: Record<string, any> =
      existingSteward?.preferences && typeof existingSteward.preferences === "object"
        ? (existingSteward.preferences as Record<string, any>)
        : {};
    const stewardValues = {
      firstName: "TradeScout",
      lastName: "Profile Steward",
      role: "content_creator" as const,
      roles: ["content_creator"],
      activeRole: "content_creator",
      provider: PRECISION_AERIAL_STEWARD_PROVIDER,
      emailVerified: false,
      addressVerified: false,
      verifiedBadge: false,
      verificationStatus: "pending" as const,
      onboardingCompleted: false,
      preferences: {
        ...existingPreferences,
        profileVisibility: "public",
        profileSections: DISABLED_PROFILE_SECTIONS,
        internalProfileSteward: {
          profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
          source: PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE,
        },
      },
      updatedAt: new Date(),
    };

    const [steward] = existingSteward
      ? await tx
          .update(users)
          .set(stewardValues as any)
          .where(
            and(
              eq(users.id, existingSteward.id),
              eq(users.provider, PRECISION_AERIAL_STEWARD_PROVIDER)
            )
          )
          .returning()
      : await tx
          .insert(users)
          .values({
            email: PRECISION_AERIAL_STEWARD_EMAIL,
            ...stewardValues,
          } as any)
          .returning();
    if (!steward) throw new Error("Precision Aerial dedicated steward provisioning failed");

    const existingSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((source): source is string => typeof source === "string")
      : [];
    const businessValues = {
      name: PRECISION_AERIAL_BUSINESS_NAME,
      slug: PRECISION_AERIAL_PROFILE_SLUG,
      type: "other" as const,
      ownerUserId: steward.id,
      roleContext: "content_creator" as const,
      profileData: {
        category: "Drone photo and video",
        tradePartner: false,
      },
      claimStatus: "unclaimed",
      publicDiscoveryEnabled: false,
      sources: Array.from(
        new Set([
          ...existingSources,
          PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE,
          ...PRECISION_AERIAL_PUBLIC_SOURCES,
        ])
      ),
      status: "active" as const,
      updatedAt: new Date(),
    };

    const [business] = existingBusiness
      ? await tx
          .update(businesses)
          .set(businessValues as any)
          .where(
            and(
              eq(businesses.id, existingBusiness.id),
              eq(businesses.ownerUserId, steward.id),
              eq(businesses.claimStatus, "unclaimed"),
              eq(businesses.status, "active")
            )
          )
          .returning()
      : await tx
          .insert(businesses)
          .values(businessValues as any)
          .returning();
    if (!business) throw new Error("Precision Aerial business provisioning failed");

    const profileValues = {
      ownerUserId: steward.id,
      businessId: business.id,
      roleContext: "content_creator" as const,
      slug: PRECISION_AERIAL_PROFILE_SLUG,
      displayName: PRECISION_AERIAL_BUSINESS_NAME,
      headline: "Drone photo and video in Pensacola.",
      contentBlocks: PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Direct Connect",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "Precision Aerial Services | Pensacola Drone Photo and Video",
        description:
          "See aerial photo and video work from Precision Aerial Services in Pensacola and send a request through TradeScout Direct Connect.",
      },
      status: "published" as const,
      updatedAt: new Date(),
    };

    const [profile] = existingProfile
      ? await tx
          .update(profiles)
          .set(profileValues as any)
          .where(
            and(
              eq(profiles.id, existingProfile.id),
              eq(profiles.ownerUserId, steward.id),
              eq(profiles.businessId, business.id),
              eq(profiles.status, "published")
            )
          )
          .returning()
      : await tx
          .insert(profiles)
          .values(profileValues as any)
          .returning();
    if (!profile) throw new Error("Precision Aerial profile provisioning failed");

    const [activatedSteward] = await tx
      .update(users)
      .set({
        activeBusinessId: business.id,
        activeProfileId: profile.id,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(users.id, steward.id), eq(users.provider, PRECISION_AERIAL_STEWARD_PROVIDER)))
      .returning({ id: users.id });
    if (!activatedSteward) {
      throw new Error("Precision Aerial steward activation failed");
    }
  });
}
