import { and, eq, sql } from "drizzle-orm";
import {
  businessCounties,
  businesses,
  contractors,
  counties,
  profiles,
  users,
} from "@shared/schema";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
  MOULDING_MILLWORK_PUBLIC_SOURCES,
} from "@shared/mouldingMillworkProfile";
import { db } from "../db";
import { isProvisionedProfileAccountControlConfirmed } from "./provisionedProfileAccountControl";

const MOULDING_MILLWORK_OWNER_EMAIL = Buffer.from(
  "bW91bGRpbmdtaWxsd29ya3N1cHBseUB5YWhvby5jb20=",
  "base64"
).toString("utf8");
const MOULDING_MILLWORK_ROUTING_PHONE = Buffer.from("KDUwNCkgMjA4LTk1NzY=", "base64").toString(
  "utf8"
);

/**
 * Publishes Moulding & Millwork Supply as a claimed, published TradePartner
 * profile. Brian Koontz is confirmed as the business's authorized contact and
 * claim/manage path (operator decision, 2026-07-20) -- but per the Selective
 * Inheritance source packet this does NOT authorize a public legal-ownership
 * claim, a license/insurance verification claim, or any Community
 * Verification Score boost. None of those are set here. Direct Connect is
 * wired to the business's own published phone/email, which the operator
 * separately confirmed.
 */
export async function provisionMouldingMillworkProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const normalizedEmail = MOULDING_MILLWORK_OWNER_EMAIL.trim().toLowerCase();
    const now = new Date();
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
        "Moulding & Millwork owner provisioning refused an unconfirmed pre-existing account"
      );
    }

    const existingPreferences: Record<string, any> =
      existingOwner?.preferences && typeof existingOwner.preferences === "object"
        ? (existingOwner.preferences as Record<string, any>)
        : {};
    const existingRoles = Array.isArray(existingOwner?.roles) ? existingOwner.roles : [];
    const roles = Array.from(new Set([...existingRoles, "business_owner", "contractor"]));

    const ownerValues = {
      firstName: existingOwner?.firstName || "Brian",
      lastName: existingOwner?.lastName || "Koontz",
      city: "Harahan",
      state: "Louisiana",
      stateCode: "LA",
      zipCode: "70123",
      role: "business_owner" as const,
      roles,
      activeRole: "business_owner",
      phone: existingOwner?.phone || MOULDING_MILLWORK_ROUTING_PHONE,
      provider: existingOwner?.provider || "admin_provisioned",
      onboardingCompleted: true,
      profileVisibility: existingOwner?.profileVisibility || ("discoverable" as const),
      preferences: {
        ...existingPreferences,
        profileVisibility: existingPreferences.profileVisibility || "public",
      },
      updatedAt: now,
    };

    const [owner] = existingOwner
      ? await tx
          .update(users)
          .set(ownerValues as any)
          .where(eq(users.id, existingOwner.id))
          .returning()
      : await tx
          .insert(users)
          .values({ email: normalizedEmail, ...ownerValues } as any)
          .returning();
    if (!owner) throw new Error("Moulding & Millwork owner provisioning failed");

    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, MOULDING_MILLWORK_PROFILE_SLUG))
      .limit(1);
    if (
      existingBusiness?.ownerUserId &&
      String(existingBusiness.ownerUserId) !== String(owner.id)
    ) {
      throw new Error("Moulding & Millwork business slug is owned by a different account");
    }

    const existingProfileData: Record<string, any> =
      existingBusiness?.profileData && typeof existingBusiness.profileData === "object"
        ? (existingBusiness.profileData as Record<string, any>)
        : {};
    const existingBusinessSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((source): source is string => typeof source === "string")
      : [];
    const operatorProfileAuthorityRevoked = existingBusinessSources.includes(
      MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE
    );
    const businessSources = new Set([
      ...existingBusinessSources,
      ...MOULDING_MILLWORK_PUBLIC_SOURCES,
    ]);
    if (operatorProfileAuthorityRevoked) {
      businessSources.delete(MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE);
    } else {
      businessSources.add(MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE);
    }

    const businessValues = {
      name: "Moulding & Millwork Supply",
      slug: MOULDING_MILLWORK_PROFILE_SLUG,
      type: "vendor" as const,
      ownerUserId: owner.id,
      roleContext: "business_owner" as const,
      profileData: {
        ...existingProfileData,
        tagline: "Moulding, doors, windows, and millwork for the Gulf South.",
        description:
          "Gulf South supplier of moulding, interior and exterior doors, windows, select stair products, hardware, shutters, and related millwork for contractors, builders, and homeowners.",
        category: "Moulding & Millwork Supply",
        services: [
          "Plan and measurement review for doors, windows, and millwork",
          "Product selection and quote preparation",
          "Moulding and trim supply",
          "Interior and exterior door supply",
          "Window supply",
          "Contractor and builder support",
          "Product and style coordination",
        ],
        website: "https://mouldingmillworksupply.com/",
        address: "5601 Caterpillar Pt.",
        city: "Harahan",
        stateCode: "LA",
        zipCode: "70123",
        contactPreference: "message",
        phone: MOULDING_MILLWORK_ROUTING_PHONE,
        notificationEmail: normalizedEmail,
        importExtras: {
          ...(existingProfileData.importExtras || {}),
          contact_name: "Brian Koontz",
          contact_role: "authorized_contact",
          contact_confirmation: "operator_confirmed_2026-07-20",
          legal_ownership_claim: "not_asserted",
          county_fips: "22051",
          county_name: "Jefferson Parish",
        },
        tradePartner: true,
        brandColors: {
          primary: "#3a2a17",
          primaryDark: "#20160c",
          accent: "#d9a441",
          secondary: "#8a7860",
          background: "#ffffff",
          surface: "#f7f2e8",
        },
      },
      claimStatus: existingBusiness?.claimStatus || "claimed",
      publicDiscoveryEnabled: existingBusiness
        ? existingBusiness.publicDiscoveryEnabled
        : true,
      sources: Array.from(businessSources),
      status: existingBusiness?.status || ("active" as const),
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
    if (!business) throw new Error("Moulding & Millwork business provisioning failed");

    const [jeffersonParish] = await tx
      .select({ id: counties.id })
      .from(counties)
      .where(eq(counties.fips, "22051"))
      .limit(1);
    if (!jeffersonParish?.id) {
      throw new Error("Moulding & Millwork requires the Jefferson Parish county record");
    }
    await tx
      .insert(businessCounties)
      .values({ businessId: business.id, countyId: jeffersonParish.id } as any)
      .onConflictDoNothing();

    // Recommendations still reference a legacy contractor ID. A newly created
    // compatibility row starts inactive and unverified. If an exact record
    // already exists, preserve its directory state rather than erasing it
    // during an idempotent boot.
    const exactRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(and(eq(contractors.userId, owner.id), eq(contractors.businessId, business.id)))
      .limit(2);
    const slugRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(eq(contractors.slug, MOULDING_MILLWORK_PROFILE_SLUG))
      .limit(2);
    const hasNoRecommendationBinding =
      exactRecommendationTargets.length === 0 && slugRecommendationTargets.length === 0;
    const hasSingleExactRecommendationBinding =
      exactRecommendationTargets.length === 1 &&
      slugRecommendationTargets.length === 1 &&
      String(exactRecommendationTargets[0].id) === String(slugRecommendationTargets[0].id) &&
      String(exactRecommendationTargets[0].slug) === MOULDING_MILLWORK_PROFILE_SLUG;

    if (!hasNoRecommendationBinding && !hasSingleExactRecommendationBinding) {
      console.warn(
        "[profile-provisioning] Skipping Moulding & Millwork recommendation target mutation: contractor binding is ambiguous or conflicting"
      );
    } else if (hasNoRecommendationBinding) {
      await tx.insert(contractors).values({
        userId: owner.id,
        businessId: business.id,
        companyName: "Moulding & Millwork Supply",
        slug: MOULDING_MILLWORK_PROFILE_SLUG,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: false,
      });
    } else {
      const recommendationTarget = exactRecommendationTargets[0];
      await tx
        .update(contractors)
        .set({
          companyName: "Moulding & Millwork Supply",
          updatedAt: now,
        })
        .where(eq(contractors.id, recommendationTarget.id));
    }

    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, MOULDING_MILLWORK_PROFILE_SLUG))
      .limit(1);
    if (existingProfile && String(existingProfile.ownerUserId) !== String(owner.id)) {
      throw new Error("Moulding & Millwork profile slug is owned by a different account");
    }

    const profileValues = {
      ownerUserId: owner.id,
      businessId: business.id,
      roleContext: "business_owner" as const,
      slug: MOULDING_MILLWORK_PROFILE_SLUG,
      displayName: "Moulding & Millwork Supply",
      headline: "Moulding, doors, windows, and millwork for the Gulf South.",
      contentBlocks: MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Start a Request",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "Moulding & Millwork Supply | Harahan, Louisiana",
        description:
          "Request moulding, doors, windows, plan review, and millwork supply from Moulding & Millwork Supply in Harahan, Louisiana.",
      },
      status: existingProfile?.status || ("published" as const),
      updatedAt: now,
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
    if (!profile) throw new Error("Moulding & Millwork profile provisioning failed");

    const hasExplicitPublicProfileIds = Object.prototype.hasOwnProperty.call(
      existingPreferences,
      "publicProfileIds"
    );
    const existingPublicProfileIds = Array.isArray(existingPreferences.publicProfileIds)
      ? existingPreferences.publicProfileIds.map(String)
      : [];
    const legacyProfileWasPublic = existingPreferences.profileVisibility === "public";
    const profileCanBeReleased =
      profile.status === "published" &&
      business.status === "active" &&
      business.publicDiscoveryEnabled === true &&
      !operatorProfileAuthorityRevoked;
    const shouldSeedExactProfileRelease =
      !hasExplicitPublicProfileIds &&
      profileCanBeReleased &&
      (!existingOwner || !existingProfile || legacyProfileWasPublic);
    const nextOwnerPreferences = shouldSeedExactProfileRelease
      ? {
          ...existingPreferences,
          profileVisibility: existingPreferences.profileVisibility || "public",
          publicProfileIds: Array.from(
            new Set([...existingPublicProfileIds, String(profile.id)])
          ),
        }
      : undefined;

    await tx
      .update(users)
      .set({
        activeBusinessId: business.id,
        activeProfileId: profile.id,
        businessSlug: MOULDING_MILLWORK_PROFILE_SLUG,
        ...(nextOwnerPreferences ? { preferences: nextOwnerPreferences } : {}),
        updatedAt: now,
      } as any)
      .where(eq(users.id, owner.id));
  });
}
