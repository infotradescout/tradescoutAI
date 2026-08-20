import { and, eq } from "drizzle-orm";
import {
  PRECISION_AERIAL_BUSINESS_NAME,
  PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_PUBLIC_HEADLINE,
  PRECISION_AERIAL_PUBLIC_SEO_DESCRIPTION,
  PRECISION_AERIAL_PUBLIC_SOURCES,
  PRECISION_AERIAL_STEWARD_PROVIDER,
  PRECISION_AERIAL_V1_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
} from "@shared/precisionAerialProfile";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";
import { ADMIN_MANAGED_PROFILE_SOURCE } from "./ownerConfirmedDirectProfile";

export const PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE = ADMIN_MANAGED_PROFILE_SOURCE;

const PRECISION_AERIAL_STEWARD_EMAIL = `${PRECISION_AERIAL_PROFILE_SLUG}@profile-steward.invalid`;

const V1_PROFILE_SECTIONS = {
  about: false,
  rolesAndBadges: false,
  stats: false,
  services: false,
  marketplaceListings: false,
  reviews: false,
  communityActivity: false,
  contactCard: false,
} as const;

const DEFAULT_PROFILE_SECTIONS = {
  about: true,
  rolesAndBadges: false,
  stats: false,
  services: true,
  marketplaceListings: false,
  reviews: false,
  communityActivity: false,
  contactCard: true,
} as const;

const DEFAULT_BRAND_COLORS = {
  primary: "#52c8f5",
  primaryDark: "#087aa8",
  accent: "#9de6ff",
  secondary: "#aeb9c5",
  background: "#05070a",
  surface: "#101820",
} as const;

const PRECISION_AERIAL_LEGACY_PROFILE_HEADLINE = "Drone photo and video in Pensacola.";
const PRECISION_AERIAL_PROFILE_HEADLINE = PRECISION_AERIAL_PUBLIC_HEADLINE;
const PRECISION_AERIAL_LEGACY_PROFILE_CTA = {
  primary: {
    label: "Direct Connect",
    kind: "message" as const,
    value: "/direct-connect",
  },
} as const;
const PRECISION_AERIAL_PROFILE_CTA = {
  primary: {
    label: "Start a Request",
    kind: "message" as const,
    value: "/direct-connect",
  },
} as const;
const PRECISION_AERIAL_V1_PROFILE_SEO = {
  title: "Precision Aerial Services | Pensacola Drone Photo and Video",
  description:
    "See aerial photo and video work from Precision Aerial Services in Pensacola and send a request through TradeScout Direct Connect.",
} as const;
const PRECISION_AERIAL_V2_PROFILE_SEO = {
  ...PRECISION_AERIAL_V1_PROFILE_SEO,
  imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
  imageWidth: 1440,
  imageHeight: 1080,
  faviconUrl: "/images/profiles/precision-aerial/logo.jpg",
} as const;
const PRECISION_AERIAL_PROFILE_SEO = {
  ...PRECISION_AERIAL_V2_PROFILE_SEO,
  description: PRECISION_AERIAL_PUBLIC_SEO_DESCRIPTION,
} as const;

type ExistingProfileSeed = {
  displayName?: unknown;
  roleContext?: unknown;
  headline?: unknown;
  contentBlocks?: unknown;
  ctaConfig?: unknown;
  seoMeta?: unknown;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalJson((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

function exactJsonMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

/**
 * Matches only the exact profile and section state written by the v1
 * provisioner. Any public or editor-owned change makes this false so startup
 * cannot reinterpret customized data as a system seed.
 */
export function isPrecisionAerialV1SystemSeed(
  profile: ExistingProfileSeed | null | undefined,
  stewardPreferences: unknown
): boolean {
  if (!profile) return false;
  const preferences = asRecord(stewardPreferences);
  return (
    profile.displayName === PRECISION_AERIAL_BUSINESS_NAME &&
    profile.roleContext === "content_creator" &&
    profile.headline === PRECISION_AERIAL_LEGACY_PROFILE_HEADLINE &&
    exactJsonMatch(profile.contentBlocks, PRECISION_AERIAL_V1_PROFILE_CONTENT_BLOCKS) &&
    exactJsonMatch(profile.ctaConfig, PRECISION_AERIAL_LEGACY_PROFILE_CTA) &&
    exactJsonMatch(profile.seoMeta, PRECISION_AERIAL_V1_PROFILE_SEO) &&
    exactJsonMatch(preferences.profileSections, V1_PROFILE_SECTIONS)
  );
}

/**
 * Matches only the exact unapproved default-profile seed that is currently in
 * production. This one-time sentinel lets Cameron move to the isolated review
 * candidate while preserving any profile that has been edited since launch.
 */
export function isPrecisionAerialV2SystemSeed(
  profile: ExistingProfileSeed | null | undefined,
  stewardPreferences: unknown
): boolean {
  if (!profile) return false;
  const preferences = asRecord(stewardPreferences);
  return (
    profile.displayName === PRECISION_AERIAL_BUSINESS_NAME &&
    profile.roleContext === "content_creator" &&
    profile.headline === PRECISION_AERIAL_LEGACY_PROFILE_HEADLINE &&
    exactJsonMatch(profile.contentBlocks, PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS) &&
    exactJsonMatch(profile.ctaConfig, PRECISION_AERIAL_LEGACY_PROFILE_CTA) &&
    exactJsonMatch(profile.seoMeta, PRECISION_AERIAL_V2_PROFILE_SEO) &&
    exactJsonMatch(preferences.profileSections, DEFAULT_PROFILE_SECTIONS)
  );
}

export function isPrecisionAerialV3SystemSeed(
  profile: ExistingProfileSeed | null | undefined,
  stewardPreferences: unknown
): boolean {
  if (!profile) return false;
  const preferences = asRecord(stewardPreferences);
  return (
    profile.displayName === PRECISION_AERIAL_BUSINESS_NAME &&
    profile.roleContext === "content_creator" &&
    profile.headline === PRECISION_AERIAL_LEGACY_PROFILE_HEADLINE &&
    exactJsonMatch(profile.contentBlocks, PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS) &&
    exactJsonMatch(profile.ctaConfig, PRECISION_AERIAL_LEGACY_PROFILE_CTA) &&
    exactJsonMatch(profile.seoMeta, PRECISION_AERIAL_V2_PROFILE_SEO) &&
    exactJsonMatch(preferences.profileSections, DEFAULT_PROFILE_SECTIONS)
  );
}

export function resolvePrecisionAerialProfileSeedFields(
  existingProfile: ExistingProfileSeed | null | undefined,
  stewardPreferences: unknown
): ExistingProfileSeed {
  if (
    !existingProfile ||
    isPrecisionAerialV1SystemSeed(existingProfile, stewardPreferences) ||
    isPrecisionAerialV2SystemSeed(existingProfile, stewardPreferences) ||
    isPrecisionAerialV3SystemSeed(existingProfile, stewardPreferences)
  ) {
    return {
      displayName: PRECISION_AERIAL_BUSINESS_NAME,
      roleContext: "content_creator",
      headline: PRECISION_AERIAL_PROFILE_HEADLINE,
      contentBlocks: PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
      ctaConfig: PRECISION_AERIAL_PROFILE_CTA,
      seoMeta: PRECISION_AERIAL_PROFILE_SEO,
    };
  }

  return {
    displayName: existingProfile.displayName,
    roleContext: existingProfile.roleContext,
    headline: existingProfile.headline,
    contentBlocks: existingProfile.contentBlocks,
    ctaConfig: existingProfile.ctaConfig,
    seoMeta: existingProfile.seoMeta,
  };
}

export function mergePrecisionAerialBusinessProfileData(
  existingValue: unknown
): Record<string, any> {
  const existingProfileData = asRecord(existingValue);
  const existingBrandColors = asRecord(existingProfileData.brandColors);
  return {
    category: "Drone photo and video",
    tradePartner: false,
    ...existingProfileData,
    brandColors: {
      ...DEFAULT_BRAND_COLORS,
      ...existingBrandColors,
    },
  };
}

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
    const migrateExactSystemSeed =
      isPrecisionAerialV1SystemSeed(existingProfile, existingPreferences) ||
      isPrecisionAerialV2SystemSeed(existingProfile, existingPreferences);
    const existingProfileSections =
      existingPreferences.profileSections &&
      typeof existingPreferences.profileSections === "object" &&
      !Array.isArray(existingPreferences.profileSections)
        ? existingPreferences.profileSections
        : null;
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
        profileSections:
          !existingSteward || migrateExactSystemSeed || !existingProfileSections
            ? DEFAULT_PROFILE_SECTIONS
            : existingProfileSections,
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
      profileData: mergePrecisionAerialBusinessProfileData(existingBusiness?.profileData),
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

    const profileSeedFields = resolvePrecisionAerialProfileSeedFields(
      existingProfile,
      existingPreferences
    );
    const profileValues = {
      ownerUserId: steward.id,
      businessId: business.id,
      slug: PRECISION_AERIAL_PROFILE_SLUG,
      ...profileSeedFields,
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
