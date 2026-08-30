import { and, desc, eq, sql } from "drizzle-orm";
import {
  adminAuditLog,
  businesses,
  businessVerifications,
  contractors,
  profiles,
  trustLedgerEvents,
  trustSnapshots,
  userProfiles,
  users,
} from "@shared/schema";
import {
  LA_PLUMBING_PROFILE_CONTENT_BLOCKS,
  LA_PLUMBING_PROFILE_SLUG,
} from "@shared/localServiceProfile";
import { db } from "../db";
import { runTrustSnapshotForUser, TRUST_SNAPSHOTS_VERSION } from "./trustSnapshotsJob";
import { CVS_BOOST_POLICIES, ensureCvsPolicyBoost } from "./cvsBoostPolicy";
import { isProvisionedProfileAccountControlConfirmed } from "./provisionedProfileAccountControl";

const LA_PLUMBING_OWNER_EMAIL = Buffer.from(
  "dHJhY3lAbGFwbHVtYmluZ3NvbHV0aW9ucy5jb20=",
  "base64"
).toString("utf8");
const LA_PLUMBING_ROUTING_PHONE = Buffer.from("KDk4NSkgNTUxLTA1ODk=", "base64").toString("utf8");

const PROFILE_SOURCE = "admin_verified_profile_provisioning";
const ADMIN_AUDIT_ACTION = "admin_business_profile_verify_and_publish";
const TRUST_EVENT_TYPE = "admin_verification_approved";
const COUNTY_FIPS = "22105";

// Internal identity history used for matching, deduplication, and admin context.
// This is deliberately kept out of the public profile presentation and API.
export const LA_PLUMBING_INTERNAL_FORMER_NAME = "Pristine Plumbing";

export const LA_PLUMBING_PUBLIC_SOURCES = [
  "https://www.laplumbingsolutions.com/",
  "https://www.laplumbingsolutions.com/about-us",
  "https://www.laplumbingsolutions.com/our-services",
  "https://www.laplumbingsolutions.com/reviews",
  "https://business.tangipahoachamber.org/list/member/la-plumbing-solutions-llc-6716",
  "https://www.bbb.org/us/la/hammond/profile/plumber/la-plumbing-solutions-llc-0835-90046533",
  "https://lslbc.louisiana.gov/wp-content/uploads/agenda_com_12152022.pdf",
] as const;

const VERIFICATION_REQUIREMENTS = {
  email: true,
  address: true,
  license: true,
  insurance: true,
  tax_id: false,
  business_registration: false,
} as const;

async function ensureApprovedBusinessVerification(
  tx: any,
  input: {
    userId: string;
    verificationType: "license" | "insurance";
    jurisdiction: string;
    metadata: Record<string, unknown>;
  }
): Promise<boolean> {
  const [latest] = await tx
    .select()
    .from(businessVerifications)
    .where(
      and(
        eq(businessVerifications.providerUserId, input.userId),
        eq(businessVerifications.verificationType, input.verificationType)
      )
    )
    .orderBy(desc(businessVerifications.createdAt))
    .limit(1);

  if (String(latest?.status || "").toLowerCase() === "approved") return false;

  await tx.insert(businessVerifications).values({
    providerUserId: input.userId,
    verificationType: input.verificationType,
    jurisdiction: input.jurisdiction,
    status: "approved",
    verifiedAt: new Date(),
    source: PROFILE_SOURCE,
    metadata: {
      ...input.metadata,
      profileSlug: LA_PLUMBING_PROFILE_SLUG,
      approvedByPolicy: true,
    },
  });
  return true;
}

/**
 * Installs LA Plumbing Solutions as a claimed, published, fully verified
 * service-provider profile. Private routing details remain in account/business
 * records and are never copied into public profile content.
 *
 * Verification is an explicit operator decision with both an admin audit row
 * and an immutable Trust Ledger event. CVS is then recomputed by the same
 * shared scoring SQL as the nightly job; no paid or ad-hoc score override is
 * used.
 */
export async function provisionLaPlumbingProfile(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const provisioningResult = await db.transaction(async (tx) => {
    const normalizedEmail = LA_PLUMBING_OWNER_EMAIL.trim().toLowerCase();
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
        "LA Plumbing owner provisioning refused an unconfirmed pre-existing account"
      );
    }

    const existingPreferences: Record<string, any> =
      existingOwner?.preferences && typeof existingOwner.preferences === "object"
        ? (existingOwner.preferences as Record<string, any>)
        : {};
    const existingRoles = Array.isArray(existingOwner?.roles) ? existingOwner.roles : [];
    const roles = Array.from(new Set([...existingRoles, "specialty_tradesperson", "contractor"]));
    const existingBadges = Array.isArray(existingOwner?.badges) ? existingOwner.badges : [];
    // Community Builder is earned through its own program events. Preserve an
    // existing award, but never manufacture the role or badge during profile
    // provisioning.
    const badges = Array.from(new Set(existingBadges));
    const shouldShowBadges = existingPreferences.badges?.show !== false;
    const shouldShowRolesAndBadges = existingPreferences.profileSections?.rolesAndBadges !== false;

    const ownerValues = {
      firstName: existingOwner?.firstName || "LA Plumbing",
      lastName: existingOwner?.lastName || "Solutions",
      address: "13073 Hwy 190 West",
      city: "Hammond",
      state: "Louisiana",
      stateCode: "LA",
      county: "Tangipahoa Parish",
      countyName: "Tangipahoa Parish",
      countyFips: COUNTY_FIPS,
      zipCode: "70401",
      role: "specialty_tradesperson" as const,
      roles,
      badges,
      activeRole: "specialty_tradesperson",
      phone: existingOwner?.phone || LA_PLUMBING_ROUTING_PHONE,
      provider: existingOwner?.provider || "admin_provisioned",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved" as const,
      verifiedBadge: true,
      // Verification establishes the neutral CVS baseline. Existing earned
      // performance is preserved here and synchronized from the canonical
      // Trust Snapshot after provisioning.
      trustScore: existingOwner ? existingOwner.trustScore : 50,
      onboardingCompleted: true,
      profileVisibility: "discoverable" as const,
      preferences: {
        ...existingPreferences,
        profileVisibility: "public",
        badges: {
          ...(existingPreferences.badges || {}),
          show: shouldShowBadges,
        },
        servicesDescription:
          "Residential and commercial plumbing repairs, renovations, water and sewer systems, gas, water heaters, backflow, and new construction.",
        profileSections: {
          ...(existingPreferences.profileSections || {}),
          about: true,
          rolesAndBadges: shouldShowRolesAndBadges,
          stats: false,
          services: true,
          marketplaceListings: false,
          reviews: true,
          communityActivity: true,
          contactCard: true,
        },
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
    if (!owner) throw new Error("LA Plumbing owner provisioning failed");

    const [existingVerificationProfile] = await tx
      .select({
        id: userProfiles.id,
        trustScore: userProfiles.trustScore,
      })
      .from(userProfiles)
      .where(
        and(eq(userProfiles.userId, owner.id), eq(userProfiles.businessType, "service_provider"))
      )
      .orderBy(desc(userProfiles.isPrimary), desc(userProfiles.updatedAt))
      .limit(1);

    const verificationProfileValues = {
      userIntent: "business" as const,
      businessType: "service_provider" as const,
      serviceTags: ["plumber", "commercial plumbing", "residential plumbing"],
      sellerTags: [],
      role: "specialty_tradesperson" as const,
      roles,
      profileVisibility: "discoverable" as const,
      verifiedBadge: true,
      trustScore: existingVerificationProfile ? existingVerificationProfile.trustScore : 50,
      verificationRequirements: VERIFICATION_REQUIREMENTS,
      verificationStatus: "approved" as const,
      email_verified: true,
      address_verified: true,
      license_verified: true,
      insurance_verified: true,
      tax_id_verified: false,
      business_registration_verified: false,
      isPrimary: true,
      displayName: "LA Plumbing Solutions",
      updatedAt: now,
    };

    if (existingVerificationProfile) {
      await tx
        .update(userProfiles)
        .set(verificationProfileValues as any)
        .where(eq(userProfiles.id, existingVerificationProfile.id));
    } else {
      // Keep this provisioning path compatible with databases that have not yet
      // applied the legacy verification_submissions column. Drizzle inserts all
      // declared table columns (including omitted defaults), while this explicit
      // insert writes only the canonical verification fields used here.
      await tx.execute(sql`
        INSERT INTO user_profiles (
          user_id,
          user_intent,
          profile_business_type,
          service_tags,
          seller_tags,
          role,
          roles,
          profile_visibility,
          verified_badge,
          trust_score,
          verification_requirements,
          verification_status,
          email_verified,
          address_verified,
          license_verified,
          insurance_verified,
          tax_id_verified,
          business_registration_verified,
          is_primary,
          display_name,
          updated_at
        ) VALUES (
          ${owner.id},
          'business',
          'service_provider',
          ARRAY['plumber', 'commercial plumbing', 'residential plumbing']::text[],
          ARRAY[]::text[],
          'specialty_tradesperson',
          ARRAY['specialty_tradesperson', 'contractor']::text[],
          'discoverable',
          true,
          50,
          ${JSON.stringify(VERIFICATION_REQUIREMENTS)}::jsonb,
          'approved',
          true,
          true,
          true,
          true,
          false,
          false,
          true,
          'LA Plumbing Solutions',
          ${now}
        )
      `);
    }

    const licenseAdded = await ensureApprovedBusinessVerification(tx, {
      userId: owner.id,
      verificationType: "license",
      jurisdiction: "Louisiana",
      metadata: {
        licenseNumber: "75460",
        credentialLabel: "Commercial plumbing",
        evidenceUrls: [
          "https://www.bbb.org/us/la/hammond/profile/plumber/la-plumbing-solutions-llc-0835-90046533",
          "https://lslbc.louisiana.gov/wp-content/uploads/agenda_com_12152022.pdf",
        ],
      },
    });
    const insuranceAdded = await ensureApprovedBusinessVerification(tx, {
      userId: owner.id,
      verificationType: "insurance",
      jurisdiction: "Louisiana",
      metadata: {
        decisionAuthority: "TradeScout operator",
        evidenceBasis: "operator_attestation",
      },
    });

    const [existingBusiness] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.slug, LA_PLUMBING_PROFILE_SLUG))
      .limit(1);
    if (
      existingBusiness?.ownerUserId &&
      String(existingBusiness.ownerUserId) !== String(owner.id)
    ) {
      throw new Error("LA Plumbing business slug is owned by a different account");
    }

    const existingProfileData: Record<string, any> =
      existingBusiness?.profileData && typeof existingBusiness.profileData === "object"
        ? (existingBusiness.profileData as Record<string, any>)
        : {};
    const businessValues = {
      name: "LA Plumbing Solutions",
      slug: LA_PLUMBING_PROFILE_SLUG,
      type: "contractor" as const,
      ownerUserId: owner.id,
      roleContext: "specialty_tradesperson" as const,
      profileData: {
        ...existingProfileData,
        tagline: "Residential and commercial plumbers serving southeast Louisiana.",
        description:
          "Family-owned residential and commercial plumbing serving southeast Louisiana.",
        category: "Plumbing",
        services: [
          "Plumbing repairs and replacements",
          "Drain clearing and hydro jetting",
          "Water, sewer, and gas systems",
          "Water heaters and backflow",
          "Renovations and new construction",
        ],
        website: "https://www.laplumbingsolutions.com/",
        address: "13073 Hwy 190 West",
        city: "Hammond",
        stateCode: "LA",
        zipCode: "70401",
        contactPreference: "message",
        phone: LA_PLUMBING_ROUTING_PHONE,
        notificationEmail: normalizedEmail,
        importExtras: {
          ...(existingProfileData.importExtras || {}),
          former_business_name: LA_PLUMBING_INTERNAL_FORMER_NAME,
          former_business_name_normalized: "pristine plumbing",
          former_business_name_source: "operator_provided",
          former_business_name_visibility: "internal_only",
          license_number: "75460",
          license_jurisdiction: "Louisiana",
          license_status: "approved",
          license_source: "lslbc_public_record",
        },
        tradePartner: false,
        brandColors: {
          primary: "#1ba9dc",
          primaryDark: "#0878a6",
          accent: "#f97316",
          secondary: "#eef8fc",
          background: "#061117",
          surface: "#0d2430",
        },
      },
      claimStatus: "claimed",
      publicDiscoveryEnabled: true,
      sources: [...LA_PLUMBING_PUBLIC_SOURCES, PROFILE_SOURCE],
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
    if (!business) throw new Error("LA Plumbing business provisioning failed");

    // Recommendations still reference a legacy contractor ID. A newly created
    // compatibility row starts inactive and unverified. If an exact record
    // already exists, preserve its directory and credential state rather than
    // erasing legitimate historical verification during an idempotent boot.
    const exactRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(and(eq(contractors.userId, owner.id), eq(contractors.businessId, business.id)))
      .limit(2);
    const slugRecommendationTargets = await tx
      .select()
      .from(contractors)
      .where(eq(contractors.slug, LA_PLUMBING_PROFILE_SLUG))
      .limit(2);
    const hasNoRecommendationBinding =
      exactRecommendationTargets.length === 0 && slugRecommendationTargets.length === 0;
    const hasSingleExactRecommendationBinding =
      exactRecommendationTargets.length === 1 &&
      slugRecommendationTargets.length === 1 &&
      String(exactRecommendationTargets[0].id) === String(slugRecommendationTargets[0].id) &&
      String(exactRecommendationTargets[0].slug) === LA_PLUMBING_PROFILE_SLUG;

    if (!hasNoRecommendationBinding && !hasSingleExactRecommendationBinding) {
      // Fail closed for Recommend without rolling back the otherwise valid
      // profile. A later data repair can establish one exact binding.
      console.warn(
        "[profile-provisioning] Skipping LA Plumbing recommendation target mutation: contractor binding is ambiguous or conflicting"
      );
    } else if (hasNoRecommendationBinding) {
      await tx.insert(contractors).values({
        userId: owner.id,
        businessId: business.id,
        companyName: "LA Plumbing Solutions",
        slug: LA_PLUMBING_PROFILE_SLUG,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: false,
      });
    } else {
      const recommendationTarget = exactRecommendationTargets[0];
      await tx
        .update(contractors)
        .set({
          companyName: "LA Plumbing Solutions",
          updatedAt: now,
        })
        .where(eq(contractors.id, recommendationTarget.id));
    }

    const [existingProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.slug, LA_PLUMBING_PROFILE_SLUG))
      .limit(1);
    if (existingProfile && String(existingProfile.ownerUserId) !== String(owner.id)) {
      throw new Error("LA Plumbing profile slug is owned by a different account");
    }

    const profileValues = {
      ownerUserId: owner.id,
      businessId: business.id,
      roleContext: "specialty_tradesperson" as const,
      slug: LA_PLUMBING_PROFILE_SLUG,
      displayName: "LA Plumbing Solutions",
      headline:
        "Family-owned plumbing for repairs, renovations, and new construction across southeast Louisiana.",
      contentBlocks: LA_PLUMBING_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Direct Connect",
          kind: "message" as const,
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "LA Plumbing Solutions | Hammond, Louisiana",
        description: "See residential and commercial work from LA Plumbing Solutions.",
        imageUrl:
          "https://www.thetradescout.com/images/businesses/la-plumbing-solutions/social-preview.jpg",
        imageWidth: 1200,
        imageHeight: 630,
        faviconUrl:
          "https://www.thetradescout.com/images/businesses/la-plumbing-solutions/logo.jpg",
      },
      status: "published" as const,
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
    if (!profile) throw new Error("LA Plumbing profile provisioning failed");

    await tx
      .update(users)
      .set({
        activeBusinessId: business.id,
        activeProfileId: profile.id,
        businessSlug: LA_PLUMBING_PROFILE_SLUG,
        updatedAt: now,
      } as any)
      .where(eq(users.id, owner.id));

    const masterAdminEmail = String(process.env.MASTER_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const [adminActor] = masterAdminEmail
      ? await tx
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = ${masterAdminEmail}`)
          .limit(1)
      : await tx.select({ id: users.id }).from(users).where(eq(users.role, "super_admin")).limit(1);
    const adminActorId = adminActor?.id || null;
    const launchBoostPolicy = CVS_BOOST_POLICIES.verified_profile_launch;
    const operatorBoostPolicy = CVS_BOOST_POLICIES.operator_firsthand_attestation;
    const portfolioBoostPolicy = CVS_BOOST_POLICIES.verified_portfolio_evidence;
    const launchBoostAdded = await ensureCvsPolicyBoost(tx, {
      userId: String(owner.id),
      adminActorId,
      policyKey: "verified_profile_launch",
      profileSlug: LA_PLUMBING_PROFILE_SLUG,
      businessId: String(business.id),
      grantedAt: now,
      evidence: {
        publicSourceCount: LA_PLUMBING_PUBLIC_SOURCES.length,
        profileStatus: "published",
        claimStatus: "claimed",
      },
    });
    const operatorBoostAdded = await ensureCvsPolicyBoost(tx, {
      userId: String(owner.id),
      adminActorId,
      policyKey: "operator_firsthand_attestation",
      profileSlug: LA_PLUMBING_PROFILE_SLUG,
      businessId: String(business.id),
      grantedAt: now,
      evidence: {
        attestation:
          "TradeScout operator reports firsthand knowledge of the company and its work quality.",
        relationshipDisclosed: true,
        relationshipType: "personal_knowledge",
      },
    });
    const portfolioBoostAdded = await ensureCvsPolicyBoost(tx, {
      userId: String(owner.id),
      adminActorId,
      policyKey: "verified_portfolio_evidence",
      profileSlug: LA_PLUMBING_PROFILE_SLUG,
      businessId: String(business.id),
      grantedAt: now,
      evidence: {
        completedWorkAssetCount: 8,
        source: "official_company_site",
        classification: "completed_work_not_inventory",
      },
    });
    const policyBoostAdded = launchBoostAdded || operatorBoostAdded || portfolioBoostAdded;
    const boostPolicies = [launchBoostPolicy, operatorBoostPolicy, portfolioBoostPolicy];
    const totalBoostPoints = boostPolicies.reduce((sum, policy) => sum + policy.points, 0);

    const [existingAudit] = await tx
      .select({ id: adminAuditLog.id })
      .from(adminAuditLog)
      .where(
        and(
          eq(adminAuditLog.type, ADMIN_AUDIT_ACTION),
          eq(adminAuditLog.targetUserId, owner.id),
          sql`${adminAuditLog.metadata} ->> 'profileSlug' = ${LA_PLUMBING_PROFILE_SLUG}`
        )
      )
      .limit(1);
    if (!existingAudit) {
      await tx.insert(adminAuditLog).values({
        type: ADMIN_AUDIT_ACTION,
        adminId: adminActorId,
        targetUserId: owner.id,
        metadata: {
          action: ADMIN_AUDIT_ACTION,
          profileSlug: LA_PLUMBING_PROFILE_SLUG,
          businessId: business.id,
          reason:
            "TradeScout operator approved the client profile and all service-provider verification requirements.",
          verificationRequirements: VERIFICATION_REQUIREMENTS,
          verificationOutcome: "approved",
          scoreMethod: `trust_snapshots_v${TRUST_SNAPSHOTS_VERSION}`,
          verifiedBaseline: 50,
          boostPolicies: boostPolicies.map((policy) => policy.key),
          boostPoints: totalBoostPoints,
          noPaidBoost: true,
          sources: LA_PLUMBING_PUBLIC_SOURCES,
        },
      });
    }

    const [existingTrustEvent] = await tx
      .select({ id: trustLedgerEvents.id })
      .from(trustLedgerEvents)
      .where(
        and(
          eq(trustLedgerEvents.entityType, "business_profile"),
          eq(trustLedgerEvents.entityId, LA_PLUMBING_PROFILE_SLUG),
          eq(trustLedgerEvents.eventType, TRUST_EVENT_TYPE),
          eq(trustLedgerEvents.sourceSurface, "profile_provisioning")
        )
      )
      .limit(1);
    if (!existingTrustEvent) {
      await tx.insert(trustLedgerEvents).values({
        actorUserId: adminActorId,
        entityType: "business_profile",
        entityId: LA_PLUMBING_PROFILE_SLUG,
        eventType: TRUST_EVENT_TYPE,
        sourceSurface: "profile_provisioning",
        verificationLevel: "system_verified",
        confidence: "1.000",
        metadata: {
          userId: owner.id,
          businessId: business.id,
          verificationRequirements: VERIFICATION_REQUIREMENTS,
          scoreMethod: `trust_snapshots_v${TRUST_SNAPSHOTS_VERSION}`,
          verifiedBaseline: 50,
          boostPolicies: boostPolicies.map((policy) => policy.key),
          boostPoints: totalBoostPoints,
          noPaidBoost: true,
        },
      });
    }

    const [latestTrustSnapshot] = await tx
      .select()
      .from(trustSnapshots)
      .where(and(eq(trustSnapshots.userId, owner.id), eq(trustSnapshots.countyFips, COUNTY_FIPS)))
      .orderBy(desc(trustSnapshots.computedAt))
      .limit(1);
    const complianceRiskFlags = new Set([
      "unverified_address",
      "verification_not_approved",
      "license_unverified",
      "insurance_unverified",
      "license_expired",
      "insurance_expired",
      "verification_rejected",
      "verification_suspended",
    ]);
    const snapshotIsCurrent =
      Number(latestTrustSnapshot?.version || 0) === TRUST_SNAPSHOTS_VERSION &&
      String(latestTrustSnapshot?.verificationStatus || "") === "approved" &&
      String(latestTrustSnapshot?.licenseStatus || "") === "approved" &&
      String(latestTrustSnapshot?.insuranceStatus || "") === "approved" &&
      !(latestTrustSnapshot?.riskFlags || []).some((flag) => complianceRiskFlags.has(flag));

    return {
      ownerId: String(owner.id),
      trustNeedsRefresh:
        !snapshotIsCurrent ||
        !existingAudit ||
        !existingTrustEvent ||
        policyBoostAdded ||
        licenseAdded ||
        insuranceAdded,
    };
  });

  if (provisioningResult.trustNeedsRefresh) {
    const result = await runTrustSnapshotForUser(provisioningResult.ownerId);
    if (result.inserted !== 1) {
      throw new Error("LA Plumbing Trust/CVS snapshot was not created");
    }
  }

  const [canonicalSnapshot] = await db
    .select({ cvsScore: trustSnapshots.cvsScore })
    .from(trustSnapshots)
    .where(
      and(
        eq(trustSnapshots.userId, provisioningResult.ownerId),
        eq(trustSnapshots.countyFips, COUNTY_FIPS)
      )
    )
    .orderBy(desc(trustSnapshots.computedAt))
    .limit(1);
  const canonicalScore = Number(canonicalSnapshot?.cvsScore ?? 50);

  // Legacy mirrors remain synchronized for surfaces that have not yet moved
  // to trust_snapshots. They never become an independent score override.
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ trustScore: canonicalScore, updatedAt: new Date() } as any)
      .where(eq(users.id, provisioningResult.ownerId));
    await tx
      .update(userProfiles)
      .set({ trustScore: canonicalScore, updatedAt: new Date() } as any)
      .where(eq(userProfiles.userId, provisioningResult.ownerId));
  });
}
