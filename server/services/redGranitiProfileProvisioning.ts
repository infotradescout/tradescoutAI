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
} from "@shared/redGranitiProfile";
import { db } from "../db";
import { hasDirectConnectPhone } from "./directConnectPhone";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  hasVerifiedTradeScoutAdminCustody,
} from "./ownerConfirmedDirectProfile";

export const RED_GRANITI_PROFILE_PROVISIONING_SOURCE =
  "operator_confirmed_distribution_profile";
export const RED_GRANITI_DISTRIBUTION_RELATIONSHIP =
  "jw_stone_exclusive_first_cut_distributor";

const TRADE_SCOUT_DIRECT_CONNECT_INBOX = "contact@thetradescout.com";
// A private non-phone value prevents the Express resolver from falling back to
// the admin steward's personal phone when JW Stone has no callable number.
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
 * Publishes R.E.D. Graniti as an independent company profile controlled by a
 * verified TradeScout admin. JW Stone is the exclusive first-cut distributor,
 * not the owner of the R.E.D. Graniti business or profile records.
 *
 * The profile is intentionally managed through TradeScout until a deliberate
 * ownership transfer is approved. Requests remain in the TradeScout inbox for
 * manual dispatch. A gated Call option may use only JW Stone's already-stored
 * private number; the admin steward's phone and R.E.D. Graniti's public company
 * contact details are never substituted.
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
      throw new Error("JW Stone business and profile ownership must match before distribution routing");
    }

    const [jwOwner] = await tx
      .select({
        id: users.id,
        phone: users.phone,
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

    // Preserve an existing verified admin steward. The only non-admin custody
    // eligible for automatic correction is the exact JW Stone owner used by the
    // earlier unmerged seed; any unrelated owner still fails closed.
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
    const existingSources = stringList(existingBusiness?.sources);
    const jwProfileData = recordValue(jwBusiness.profileData);
    const rawJwPhone = String(jwProfileData.phone || jwOwner.phone || "").trim();
    const gatedJwPhone = hasDirectConnectPhone(rawJwPhone)
      ? rawJwPhone
      : REQUEST_ONLY_PHONE_SENTINEL;

    const businessValues = {
      name: RED_GRANITI_BUSINESS_NAME,
      slug: RED_GRANITI_PROFILE_SLUG,
      type: "vendor" as const,
      ownerUserId: adminOwner.id,
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
        // TradeScout owns the profile record and request workspace. JW Stone's
        // private phone is the only allowed Call recipient for this partnership.
        phone: gatedJwPhone,
        notificationEmail: TRADE_SCOUT_DIRECT_CONNECT_INBOX,
        email: TRADE_SCOUT_DIRECT_CONNECT_INBOX,
        address: "Via Dorsale 12, 54100 Massa, Italy",
        city: "Massa",
        zipCode: "54100",
        tradePartner: true,
        importExtras: {
          ...existingImportExtras,
          business_identity: "red_graniti",
          source_company_ownership: "independent",
          profile_control: RED_GRANITI_PROFILE_CONTROL,
          profile_steward: "tradescout_verified_admin",
          distribution_relationship: RED_GRANITI_DISTRIBUTION_RELATIONSHIP,
          distribution_operator: JW_STONE_PROFILE_SLUG,
          territory_scope: "not_publicly_specified",
          public_request_routing: "tradescout_admin_manual_dispatch_to_jw_stone",
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
      console.warn(
        "[profile-provisioning] R.E.D. Graniti recommendation binding is ambiguous"
      );
    }

    const profileValues = {
      ownerUserId: adminOwner.id,
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

    // Public visibility is scoped to this profile. Never change the admin's
    // active business, active profile, profile-wide visibility, roles, or contact.
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
