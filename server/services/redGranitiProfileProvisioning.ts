import { and, eq, ne, or, sql } from "drizzle-orm";
import { businesses, contractors, profiles, users } from "@shared/schema";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import {
  RED_GRANITI_BUSINESS_NAME,
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_OFFICIAL_SOURCES,
  RED_GRANITI_OFFICIAL_WEBSITE,
  RED_GRANITI_PROFILE_CONTENT_BLOCKS,
  RED_GRANITI_PROFILE_CONTROL,
  RED_GRANITI_PROFILE_SLUG,
  RED_GRANITI_PUBLIC_IDENTITY,
} from "@shared/redGranitiProfile";
import { db } from "../db";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  hasVerifiedTradeScoutAdminCustody,
} from "./ownerConfirmedDirectProfile";
import {
  ensureStoneCoreTables,
  provisionRedGranitiStoneCore,
} from "./stoneCoreProvisioning";

export const RED_GRANITI_PROFILE_PROVISIONING_SOURCE =
  "operator_confirmed_company_profile";

const TRADE_SCOUT_DIRECT_CONNECT_INBOX = "contact@thetradescout.com";
// The R.E.D. company record never publishes a phone. Its dedicated profile
// sends calls and first-cut requests through JW Stone's protected contact path.
const REQUEST_ONLY_PHONE_SENTINEL = "request-only";

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

function isVerifiedJwOperator(owner: {
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
 * Publishes only the R.E.D. Graniti company identity under verified TradeScout
 * admin custody. Canonical materials, physical assets, inventory positions,
 * publication targets, and the JW Stone distribution right live in Stone Core.
 */
export async function provisionRedGranitiProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  await ensureStoneCoreTables();

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
      throw new Error("JW Stone business and profile ownership must match before rights are recorded");
    }

    const [jwOwner] = await tx
      .select({
        id: users.id,
        verifiedBadge: users.verifiedBadge,
        verificationStatus: users.verificationStatus,
      })
      .from(users)
      .where(eq(users.id, jwBusinessOwnerUserId))
      .limit(1);
    if (!jwOwner || !isVerifiedJwOperator(jwOwner)) {
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
      existingBusinessOwnerUserId &&
      existingProfileOwnerUserId &&
      existingBusinessOwnerUserId !== existingProfileOwnerUserId
    ) {
      throw new Error("Existing R.E.D. Graniti business and profile ownership records disagree");
    }
    if (
      existingBusiness &&
      existingProfile?.businessId &&
      String(existingProfile.businessId) !== String(existingBusiness.id)
    ) {
      throw new Error("Existing R.E.D. Graniti business and profile records disagree");
    }

    const existingOwnerUserId = existingProfileOwnerUserId || existingBusinessOwnerUserId;
    const adminSelection = {
      id: users.id,
      role: users.role,
      roles: users.roles,
      preferences: users.preferences,
      verifiedBadge: users.verifiedBadge,
      verificationStatus: users.verificationStatus,
    };
    const verifiedAdminPredicate = and(
      or(eq(users.role, "super_admin"), eq(users.role, "head_admin")),
      or(eq(users.verifiedBadge, true), eq(users.verificationStatus, "approved")),
      ne(users.id, jwOwner.id)
    );

    const [existingOwner] = existingOwnerUserId
      ? await tx
          .select(adminSelection)
          .from(users)
          .where(eq(users.id, existingOwnerUserId))
          .limit(1)
      : [];
    const existingOwnerIsAdmin = Boolean(
      existingOwner &&
        hasVerifiedTradeScoutAdminCustody({
          ownerRole: existingOwner.role,
          ownerRoles: existingOwner.roles,
          ownerVerifiedBadge: existingOwner.verifiedBadge,
          ownerVerificationStatus: existingOwner.verificationStatus,
        })
    );
    const existingOwnerIsCorrectableJwSeed = existingOwnerUserId === jwOwner.id;
    if (existingOwnerUserId && !existingOwnerIsAdmin && !existingOwnerIsCorrectableJwSeed) {
      throw new Error("Existing R.E.D. Graniti owner is not an approved TradeScout steward");
    }

    const configuredMasterAdminEmail = String(process.env.MASTER_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const [configuredAdmin] = existingOwnerIsAdmin
      ? []
      : configuredMasterAdminEmail
        ? await tx
            .select(adminSelection)
            .from(users)
            .where(
              and(
                sql`lower(${users.email}) = ${configuredMasterAdminEmail}`,
                verifiedAdminPredicate
              )
            )
            .limit(1)
        : [];
    const [fallbackAdmin] = existingOwnerIsAdmin || configuredAdmin
      ? []
      : await tx.select(adminSelection).from(users).where(verifiedAdminPredicate).limit(1);
    const adminOwner = existingOwnerIsAdmin ? existingOwner : configuredAdmin || fallbackAdmin;

    if (
      !adminOwner ||
      !hasVerifiedTradeScoutAdminCustody({
        ownerRole: adminOwner.role,
        ownerRoles: adminOwner.roles,
        ownerVerifiedBadge: adminOwner.verifiedBadge,
        ownerVerificationStatus: adminOwner.verificationStatus,
      })
    ) {
      throw new Error("R.E.D. Graniti needs a verified TradeScout admin steward");
    }
    if (adminOwner.id === jwOwner.id) {
      throw new Error("R.E.D. Graniti admin custody must remain separate from JW Stone ownership");
    }

    const now = new Date();
    const existingProfileData = recordValue(existingBusiness?.profileData);
    const existingImportExtras = recordValue(existingProfileData.importExtras);
    const cleanImportExtras = { ...existingImportExtras };
    for (const key of [
      "distribution_relationship",
      "distribution_operator",
      "territory_scope",
      "public_request_routing",
    ]) {
      delete cleanImportExtras[key];
    }
    const existingSources = stringList(existingBusiness?.sources).filter(
      (source) => source !== "jw_stone_exclusive_first_cut_distributor"
    );

    const businessValues = {
      name: RED_GRANITI_BUSINESS_NAME,
      slug: RED_GRANITI_PROFILE_SLUG,
      type: "vendor" as const,
      ownerUserId: adminOwner.id,
      roleContext: "business_owner" as const,
      profileData: {
        ...existingProfileData,
        tagline: RED_GRANITI_PUBLIC_IDENTITY.headline,
        description: RED_GRANITI_PUBLIC_IDENTITY.summary,
        category: "Natural stone quarries, blocks, and slabs",
        services: RED_GRANITI_PUBLIC_IDENTITY.capabilities.map((capability) => capability.title),
        website: RED_GRANITI_OFFICIAL_WEBSITE,
        contactPreference: "message",
        publicContactEnabled: false,
        publicLocationEnabled: true,
        publicWebsiteEnabled: true,
        phone: REQUEST_ONLY_PHONE_SENTINEL,
        notificationEmail: TRADE_SCOUT_DIRECT_CONNECT_INBOX,
        email: TRADE_SCOUT_DIRECT_CONNECT_INBOX,
        address: "Via Dorsale 12, 54100 Massa, Italy",
        city: "Massa",
        zipCode: "54100",
        tradePartner: false,
        importExtras: {
          ...cleanImportExtras,
          business_identity: "red_graniti",
          source_company_ownership: "independent",
          profile_control: RED_GRANITI_PROFILE_CONTROL,
          profile_steward: "tradescout_verified_admin",
          stone_core_source_profile: "true",
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
      claimStatus: "admin_managed",
      publicDiscoveryEnabled: true,
      sources: Array.from(
        new Set([
          ...existingSources,
          ADMIN_MANAGED_PROFILE_SOURCE,
          RED_GRANITI_PROFILE_PROVISIONING_SOURCE,
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

    await provisionRedGranitiStoneCore({
      tx,
      sourceBusinessId: String(business.id),
      distributorBusinessId: String(jwBusiness.id),
      verifiedByUserId: String(adminOwner.id),
    });

    const recommendationBindings = await tx
      .select({
        id: contractors.id,
        userId: contractors.userId,
        businessId: contractors.businessId,
        isActive: contractors.isActive,
        verifiedLicensed: contractors.verifiedLicensed,
        verifiedInsured: contractors.verifiedInsured,
      })
      .from(contractors)
      .where(eq(contractors.slug, RED_GRANITI_PROFILE_SLUG))
      .limit(2);

    if (recommendationBindings.length === 0) {
      await tx.insert(contractors).values({
        userId: adminOwner.id,
        businessId: business.id,
        companyName: RED_GRANITI_BUSINESS_NAME,
        slug: RED_GRANITI_PROFILE_SLUG,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: false,
      });
    } else if (recommendationBindings.length === 1) {
      const binding = recommendationBindings[0];
      const belongsToThisBusiness = String(binding.businessId || "") === String(business.id);
      const safeAdminBinding = String(binding.userId || "") === String(adminOwner.id);
      const safeFormerJwSeed =
        String(binding.userId || "") === String(jwOwner.id) &&
        binding.isActive === false &&
        binding.verifiedLicensed === false &&
        binding.verifiedInsured === false;
      if (belongsToThisBusiness && (safeAdminBinding || safeFormerJwSeed)) {
        await tx
          .update(contractors)
          .set({
            userId: adminOwner.id,
            businessId: business.id,
            companyName: RED_GRANITI_BUSINESS_NAME,
            slug: RED_GRANITI_PROFILE_SLUG,
            updatedAt: now,
          })
          .where(eq(contractors.id, binding.id));
      } else {
        console.warn(
          "[profile-provisioning] R.E.D. Graniti recommendation binding is not safe to transfer"
        );
      }
    } else {
      console.warn("[profile-provisioning] R.E.D. Graniti recommendation binding is ambiguous");
    }

    const profileValues = {
      ownerUserId: adminOwner.id,
      businessId: business.id,
      roleContext: "business_owner" as const,
      slug: RED_GRANITI_PROFILE_SLUG,
      displayName: RED_GRANITI_BUSINESS_NAME,
      headline: "Company-owned quarries, rough blocks, slabs, and worldwide distribution.",
      contentBlocks: RED_GRANITI_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Start a Request",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "R.E.D. Graniti | Quarries, Rough Blocks & Natural Stone Slabs",
        description:
          "Explore R.E.D. Graniti's company-owned quarry network, rough blocks, natural stone slabs, and worldwide distribution. Call JW Stone or send first-cut project details.",
        imageUrl: RED_GRANITI_LOGO_URL,
        faviconUrl: RED_GRANITI_LOGO_URL,
        imageWidth: 78,
        imageHeight: 78,
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

    const adminPreferences = recordValue(adminOwner.preferences);
    const publicProfileIds = Array.from(
      new Set([...stringList(adminPreferences.publicProfileIds), String(profile.id)])
    );
    await tx
      .update(users)
      .set({
        preferences: {
          ...adminPreferences,
          publicProfileIds,
        } as any,
        updatedAt: now,
      })
      .where(eq(users.id, adminOwner.id));
  });
}
