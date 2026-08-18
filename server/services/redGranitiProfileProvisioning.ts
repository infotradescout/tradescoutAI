import { and, eq, or } from "drizzle-orm";
import { businesses, contractors, profiles, users } from "@shared/schema";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import {
  RED_GRANITI_BUSINESS_NAME,
  RED_GRANITI_OFFICIAL_SOURCES,
  RED_GRANITI_OFFICIAL_WEBSITE,
  RED_GRANITI_PROFILE_CONTENT_BLOCKS,
  RED_GRANITI_PROFILE_SLUG,
  RED_GRANITI_QUARRY_MEDIA,
} from "@shared/redGranitiProfile";
import { db } from "../db";

export const RED_GRANITI_PROFILE_PROVISIONING_SOURCE =
  "operator_confirmed_distribution_profile";
export const RED_GRANITI_DISTRIBUTION_RELATIONSHIP =
  "jw_stone_exclusive_first_cut_distributor";

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];
}

function isVerifiedPublicOperator(owner: {
  verifiedBadge: unknown;
  verificationStatus: unknown;
}): boolean {
  return (
    owner.verifiedBadge === true ||
    String(owner.verificationStatus || "")
      .trim()
      .toLowerCase() === "approved"
  );
}

/**
 * Publishes R.E.D. Graniti as an independent source-company profile operated
 * through JW Stone's exact account for this operator-confirmed distribution
 * relationship. The profile never copies R.E.D. Graniti's public phone or
 * email into Direct Connect; requests route to JW Stone through shared custody.
 */
export async function provisionRedGranitiProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await db.transaction(async (tx) => {
    const [jwBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);
    const [jwProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, JW_STONE_PROFILE_SLUG))
      .limit(1);

    if (!jwBusiness || !jwProfile) {
      throw new Error("R.E.D. Graniti requires the canonical JW Stone business and profile");
    }
    if (jwBusiness.status !== "active" || jwProfile.status !== "published") {
      throw new Error("R.E.D. Graniti requires JW Stone to remain active and published");
    }

    const jwBusinessOwnerUserId = String(jwBusiness.ownerUserId || "").trim();
    const jwProfileOwnerUserId = String(jwProfile.ownerUserId || "").trim();
    if (
      !jwBusinessOwnerUserId ||
      !jwProfileOwnerUserId ||
      jwBusinessOwnerUserId !== jwProfileOwnerUserId
    ) {
      throw new Error("JW Stone business and profile ownership must match before routing R.E.D.");
    }

    const [jwOwner] = await tx
      .select({
        id: users.id,
        preferences: users.preferences,
        verifiedBadge: users.verifiedBadge,
        verificationStatus: users.verificationStatus,
      })
      .from(users)
      .where(eq(users.id, jwBusinessOwnerUserId))
      .limit(1);
    if (!jwOwner || !isVerifiedPublicOperator(jwOwner)) {
      throw new Error("R.E.D. Graniti requires JW Stone's verified public operator account");
    }

    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, RED_GRANITI_PROFILE_SLUG))
      .limit(1);
    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, RED_GRANITI_PROFILE_SLUG))
      .limit(1);

    const existingBusinessOwnerUserId = String(existingBusiness?.ownerUserId || "").trim();
    const existingProfileOwnerUserId = String(existingProfile?.ownerUserId || "").trim();
    if (
      (existingBusinessOwnerUserId && existingBusinessOwnerUserId !== jwOwner.id) ||
      (existingProfileOwnerUserId && existingProfileOwnerUserId !== jwOwner.id)
    ) {
      throw new Error("Existing R.E.D. Graniti ownership conflicts with JW Stone routing");
    }
    if (
      existingBusiness &&
      existingProfile?.businessId &&
      String(existingProfile.businessId) !== String(existingBusiness.id)
    ) {
      throw new Error("Existing R.E.D. Graniti business and profile records disagree");
    }

    const now = new Date();
    const existingProfileData = recordValue(existingBusiness?.profileData);
    const existingImportExtras = recordValue(existingProfileData.importExtras);
    const existingSources = stringList(existingBusiness?.sources);

    const businessValues = {
      name: RED_GRANITI_BUSINESS_NAME,
      slug: RED_GRANITI_PROFILE_SLUG,
      type: "vendor" as const,
      ownerUserId: jwOwner.id,
      roleContext: "business_owner" as const,
      profileData: {
        ...existingProfileData,
        tagline: "From quarry to first cut.",
        description:
          "R.E.D. Graniti quarry-origin natural stone in rough blocks and slabs, with exclusive first-cut distribution through JW Stone.",
        category: "Quarry-origin natural stone",
        services: [
          "Quarry-origin natural stone",
          "Rough stone blocks",
          "Natural stone slabs",
          "Exclusive first-cut distribution through JW Stone",
        ],
        website: RED_GRANITI_OFFICIAL_WEBSITE,
        contactPreference: "message",
        publicContactEnabled: false,
        publicLocationEnabled: true,
        publicWebsiteEnabled: true,
        // Preserve private operator-entered contact only. Never seed R.E.D.'s
        // corporate phone or email into the JW Stone Direct Connect route.
        phone: String(existingProfileData.phone || "").trim(),
        email: String(existingProfileData.email || "").trim(),
        address: "Via Dorsale 12, 54100 Massa, Italy",
        tradePartner: true,
        importExtras: {
          ...existingImportExtras,
          business_identity: "red_graniti",
          source_company_ownership: "independent",
          profile_operator: "jw_stone",
          distribution_relationship: RED_GRANITI_DISTRIBUTION_RELATIONSHIP,
          territory_scope: "not_publicly_specified",
          public_request_routing: "jw_stone_direct_connect",
          official_company_source: RED_GRANITI_OFFICIAL_WEBSITE,
        },
        brandColors: {
          primary: "#241f20",
          primaryDark: "#111111",
          accent: "#d71920",
          secondary: "#7b7370",
          background: "#f3f0eb",
          surface: "#ffffff",
        },
      },
      claimStatus:
        existingBusiness?.claimStatus && existingBusiness.claimStatus !== "unclaimed"
          ? existingBusiness.claimStatus
          : "partner_managed",
      publicDiscoveryEnabled: true,
      sources: Array.from(
        new Set([
          ...existingSources,
          RED_GRANITI_PROFILE_PROVISIONING_SOURCE,
          RED_GRANITI_DISTRIBUTION_RELATIONSHIP,
          ...RED_GRANITI_OFFICIAL_SOURCES,
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
    if (!business) throw new Error("R.E.D. Graniti business provisioning failed");

    const exactRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(and(eq(contractors.userId, jwOwner.id), eq(contractors.businessId, business.id)))
      .limit(2);
    const slugRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(eq(contractors.slug, RED_GRANITI_PROFILE_SLUG))
      .limit(2);
    const hasNoRecommendationBinding =
      exactRecommendationTargets.length === 0 && slugRecommendationTargets.length === 0;
    const hasSingleExactRecommendationBinding =
      exactRecommendationTargets.length === 1 &&
      slugRecommendationTargets.length === 1 &&
      String(exactRecommendationTargets[0].id) === String(slugRecommendationTargets[0].id);

    if (!hasNoRecommendationBinding && !hasSingleExactRecommendationBinding) {
      console.warn(
        "[profile-provisioning] Skipping R.E.D. Graniti recommendation target mutation: contractor binding is ambiguous or conflicting"
      );
    } else if (hasNoRecommendationBinding) {
      await tx.insert(contractors).values({
        userId: jwOwner.id,
        businessId: business.id,
        companyName: RED_GRANITI_BUSINESS_NAME,
        slug: RED_GRANITI_PROFILE_SLUG,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: false,
      });
    } else {
      await tx
        .update(contractors)
        .set({
          companyName: RED_GRANITI_BUSINESS_NAME,
          slug: RED_GRANITI_PROFILE_SLUG,
          updatedAt: now,
        })
        .where(eq(contractors.id, exactRecommendationTargets[0].id));
    }

    const profileValues = {
      ownerUserId: jwOwner.id,
      businessId: business.id,
      roleContext: "business_owner" as const,
      slug: RED_GRANITI_PROFILE_SLUG,
      displayName: RED_GRANITI_BUSINESS_NAME,
      headline: "Quarry-origin stone. Exclusive first-cut distribution through JW Stone.",
      contentBlocks: RED_GRANITI_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Start a Request",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "R.E.D. Graniti Quarry Stone | JW Stone First-Cut Distribution",
        description:
          "Explore source-backed R.E.D. Graniti quarry materials in blocks and slabs. Start an exclusive first-cut distribution request with JW Stone through TradeScout.",
        imageUrl: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl,
        faviconUrl: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl,
        imageWidth: 1600,
        imageHeight: 1067,
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
    if (!profile) throw new Error("R.E.D. Graniti profile provisioning failed");

    const ownerPreferences = recordValue(jwOwner.preferences);
    const publicProfileIds = Array.from(
      new Set([...stringList(ownerPreferences.publicProfileIds), String(profile.id)])
    );
    await tx
      .update(users)
      .set({
        preferences: {
          ...ownerPreferences,
          publicProfileIds,
        } as any,
        updatedAt: now,
      })
      .where(eq(users.id, jwOwner.id));
  });
}
