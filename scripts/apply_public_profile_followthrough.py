from pathlib import Path

ROOT = Path(".")

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")

def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise AssertionError(f"target not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))

def replace_all_checked(path: str, old: str, new: str, minimum: int = 1) -> None:
    text = read(path)
    count = text.count(old)
    if count < minimum:
        raise AssertionError(f"expected at least {minimum} targets in {path}, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new))

# Generic operator-confirmed managed-business authority.
replace_once(
    "shared/publicProfileExposureRegistry.ts",
    'export const ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile";\n',
    'export const ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile";\n'
    'export const OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE =\n'
    '  "operator_confirmed_managed_business_profile";\n'
    'export const OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE =\n'
    '  "operator_confirmed_managed_business_profile_revoked";\n',
)
replace_once(
    "server/services/ownerConfirmedDirectProfile.ts",
    '''  ADMIN_MANAGED_PROFILE_SOURCE,
  getDirectProfileAuthority,
''',
    '''  ADMIN_MANAGED_PROFILE_SOURCE,
  getDirectProfileAuthority,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
''',
)
replace_once(
    "server/services/ownerConfirmedDirectProfile.ts",
    '''  ADMIN_MANAGED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
''',
    '''  ADMIN_MANAGED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
''',
)
owner_authority_insert = r'''
const OPERATOR_CONFIRMED_MANAGED_CLAIM_STATUSES = new Set([
  "admin_managed",
  "claimed",
  "owner_confirmed_pending_transfer",
]);

/**
 * Reusable authority for a TradeScout-managed business profile whose authorized
 * business contact was confirmed by the operator. This opens the profile and
 * request route only. It does not grant a verification badge, license,
 * insurance, CVS, or public legal-ownership claim.
 */
export function hasOperatorConfirmedManagedBusinessAuthority(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
  const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();
  const claimStatus = String(candidate.businessClaimStatus || "")
    .trim()
    .toLowerCase();
  const sources = Array.isArray(candidate.businessSources) ? candidate.businessSources : [];

  return (
    String(candidate.profileStatus || "")
      .trim()
      .toLowerCase() === "published" &&
    String(candidate.businessStatus || "")
      .trim()
      .toLowerCase() === "active" &&
    profileOwnerUserId.length > 0 &&
    profileOwnerUserId === businessOwnerUserId &&
    String(candidate.ownerProvider || "")
      .trim()
      .toLowerCase() === "admin_provisioned" &&
    OPERATOR_CONFIRMED_MANAGED_CLAIM_STATUSES.has(claimStatus) &&
    sources.includes(OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE) &&
    !sources.includes(OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE)
  );
}

'''
replace_once(
    "server/services/ownerConfirmedDirectProfile.ts",
    "function hasExactPrecisionStewardAuthority(\n",
    owner_authority_insert + "function hasExactPrecisionStewardAuthority(\n",
)
replace_once(
    "server/services/ownerConfirmedDirectProfile.ts",
    '''    (isPubliclyVerifiedProfileOwner(candidate) || isOwnerConfirmedDirectProfile(candidate))
''',
    '''    (isPubliclyVerifiedProfileOwner(candidate) ||
      isOwnerConfirmedDirectProfile(candidate) ||
      hasOperatorConfirmedManagedBusinessAuthority(candidate))
''',
)
replace_once(
    "server/services/ownerConfirmedDirectProfile.ts",
    '''    if (!isPubliclyVerifiedProfileOwner(candidate)) {
      return { mode: "private", reason: "business_trust_missing" };
    }
    if (candidate.publicDiscoveryEnabled === true) {
''',
    '''    const operatorConfirmedManagedBusiness =
      hasOperatorConfirmedManagedBusinessAuthority(candidate);
    if (!isPubliclyVerifiedProfileOwner(candidate) && !operatorConfirmedManagedBusiness) {
      return { mode: "private", reason: "business_trust_missing" };
    }
    if (candidate.publicDiscoveryEnabled === true) {
''',
)
replace_once(
    "server/services/ownerConfirmedDirectProfile.ts",
    '''  return decision.mode === "public" || (decision.mode === "direct_only" && isOwnerConfirmedDirectProfile(candidate));
''',
    '''  return (
    decision.mode === "public" ||
    (decision.mode === "direct_only" &&
      (isOwnerConfirmedDirectProfile(candidate) ||
        hasOperatorConfirmedManagedBusinessAuthority(candidate)))
  );
''',
)

# Search authorization before LIMIT.
replace_once(
    "server/repositories/profileRepository.ts",
    'import { randomUUID } from "crypto";\n',
    'import { randomUUID } from "crypto";\n'
    'import { OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE } from "@shared/publicProfileExposureRegistry";\n',
)
replace_once(
    "server/repositories/profileRepository.ts",
    ''' * Only explicitly released, active, discovery-enabled businesses with an
 * established owner verification signal may enter the search result set.
''',
    ''' * Only explicitly released, active, discovery-enabled businesses with an
 * established owner verification signal or exact operator-confirmed managed
 * business authority may enter the search result set.
''',
)
replace_once(
    "server/repositories/profileRepository.ts",
    '''    AND (
      ${users.verifiedBadge} = true
      OR lower(COALESCE(${users.verificationStatus}::text, '')) = 'approved'
    )
''',
    '''    AND (
      ${users.verifiedBadge} = true
      OR lower(COALESCE(${users.verificationStatus}::text, '')) = 'approved'
      OR (
        ${profiles.ownerUserId} = ${businesses.ownerUserId}
        AND lower(COALESCE(${users.provider}, '')) = 'admin_provisioned'
        AND lower(COALESCE(${businesses.claimStatus}, '')) IN (
          'admin_managed',
          'claimed',
          'owner_confirmed_pending_transfer'
        )
        AND COALESCE(${businesses.sources}, '[]'::jsonb)
          @> jsonb_build_array(${OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE})
      )
    )
''',
)

# Moulding & Millwork authority, exact release, and request CTA.
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    'import { businesses, contractors, profiles, users } from "@shared/schema";\n',
    'import { businesses, contractors, profiles, users } from "@shared/schema";\n'
    'import {\n'
    '  OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,\n'
    '  OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,\n'
    '} from "@shared/publicProfileExposureRegistry";\n',
)
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    '''    const existingProfileData: Record<string, any> =
      existingBusiness?.profileData && typeof existingBusiness.profileData === "object"
        ? (existingBusiness.profileData as Record<string, any>)
        : {};

    const businessValues = {
''',
    '''    const existingProfileData: Record<string, any> =
      existingBusiness?.profileData && typeof existingBusiness.profileData === "object"
        ? (existingBusiness.profileData as Record<string, any>)
        : {};
    const existingBusinessSources = Array.isArray(existingBusiness?.sources)
      ? existingBusiness.sources.filter((value): value is string => typeof value === "string")
      : [];
    const businessSources = new Set([
      ...existingBusinessSources,
      ...MOULDING_MILLWORK_PUBLIC_SOURCES,
      PROFILE_SOURCE,
    ]);
    if (businessSources.has(OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE)) {
      businessSources.delete(OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE);
    } else {
      businessSources.add(OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE);
    }

    const businessValues = {
''',
)
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    '''          contact_confirmation: "operator_confirmed_2026-07-20",
          legal_ownership_claim: "not_asserted",
''',
    '''          contact_confirmation: "operator_confirmed_2026-07-20",
          legal_ownership_claim: "not_asserted",
          profile_authority: OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
          profile_authority_scope: "public_profile_and_request_routing",
          profile_authority_confirmed_at: "2026-07-20",
''',
)
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    '''      sources: Array.from(new Set([...MOULDING_MILLWORK_PUBLIC_SOURCES, PROFILE_SOURCE])),
''',
    '''      sources: Array.from(businessSources),
''',
)
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    '''          label: "Direct Connect",
''',
    '''          label: "Start a Request",
''',
)
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    '''        description: "See moulding, doors, windows, and millwork from Moulding & Millwork Supply.",
''',
    '''        description:
          "Moulding, doors, windows, and millwork for contractors, builders, and homeowners across the Gulf South. Start a request for product selection or a quote.",
''',
)
replace_once(
    "server/services/mouldingMillworkProfileProvisioning.ts",
    '''    await tx
      .update(users)
      .set({
        activeBusinessId: business.id,
        activeProfileId: profile.id,
        businessSlug: MOULDING_MILLWORK_PROFILE_SLUG,
        updatedAt: now,
      } as any)
      .where(eq(users.id, owner.id));
''',
    '''    const publicProfileIds = Array.isArray(existingPreferences.publicProfileIds)
      ? existingPreferences.publicProfileIds
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean)
      : [];
    const releasedProfileIds = Array.from(new Set([...publicProfileIds, String(profile.id)]));

    await tx
      .update(users)
      .set({
        activeBusinessId: business.id,
        activeProfileId: profile.id,
        businessSlug: MOULDING_MILLWORK_PROFILE_SLUG,
        preferences: {
          ...existingPreferences,
          profileVisibility: "public",
          publicProfileIds: releasedProfileIds,
        },
        updatedAt: now,
      } as any)
      .where(eq(users.id, owner.id));
''',
)

# ISSA Build: one operator and one request funnel.
replace_once(
    "server/services/issaBuildProfileProvisioning.ts",
    '''          "We craft translucent onyx for residential and commercial interiors — selection, customization, backlighting, installation, and private project consultation.",
''',
    '''          "ISSA Build handles material selection, customization, backlighting, and installation for Honey Onyx and Multi Green Onyx in residential and commercial interiors.",
''',
)
replace_once(
    "server/services/issaBuildProfileProvisioning.ts",
    '''          label: "Discuss a project",
''',
    '''          label: "Start a Request",
''',
)
replace_once(
    "server/services/issaBuildProfileProvisioning.ts",
    '''          "Honey Onyx and Multi Green Onyx for residential and commercial interiors. Private project consultation with us on TradeScout.",
''',
    '''          "ISSA Build handles selection, customization, backlighting, and installation for Honey Onyx and Multi Green Onyx. Start one project request through TradeScout.",
''',
)
replace_once(
    "shared/issaBuildProfile.ts",
    '''      text: "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors.",
''',
    '''      text: "ISSA Build handles material selection, customization, backlighting, and installation for Honey Onyx and Multi Green Onyx in residential and commercial interiors.",
''',
)
replace_once(
    "shared/issaBuildProfile.ts",
    '''          body: "Translucent onyx shows its depth when the material and how it is illuminated are planned together. We take projects from selection and customization through installation so the finished surface fits the space.",
''',
    '''          body: "Translucent onyx shows its depth when the material and lighting are planned together. ISSA Build handles selection, customization, backlighting, and installation as one project.",
''',
)
replace_once(
    "shared/issaBuildProfile.ts",
    '''          body: "We begin with the space, dimensions, intended use, and how the stone will be illuminated.",
''',
    '''          body: "Send the room once. ISSA Build handles material selection, customization, backlighting, and installation.",
''',
)
replace_all_checked(
    "shared/issaBuildProfile.ts",
    '"Tell us the space, dimensions, location, schedule, and whether you are considering backlighting."',
    '"Send the room, dimensions, location, timing, and backlighting idea once. ISSA Build handles selection, customization, backlighting, and installation."',
    minimum=4,
)
replace_once(
    "shared/issaBuildProfile.ts",
    '''      requestExamples: ["Discuss your project", "Ask about backlighting", "Something else"],
''',
    '''      requestExamples: ["Start my onyx project", "Ask about backlighting", "Something else"],
''',
)

# Precision Aerial: supported facts only and TradeScout-managed request routing.
replace_once(
    "shared/precisionAerialProfile.ts",
    '''export const PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS =
  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS.map((block) => {
''',
    '''export const PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS =
  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS.map((block) => {
''',
)
precision_current_append = r'''

/**
 * Current public content. The exact first-party accounts support Pensacola,
 * real-estate, construction-progress, land/site, and FPV work. No public phone,
 * hours, insurance, service radius, or credential number is asserted.
 */
export const PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS =
  PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS.map((block) => {
    if (block.type === "about") {
      return {
        ...block,
        data: {
          ...block.data,
          text: "Cameron provides aerial photo, traditional drone video, and FPV work for real estate, construction progress, and land or site documentation around Pensacola. Thermal imaging is planned but is not listed as available.",
        },
      };
    }
    if (block.type === "hero") {
      return {
        ...block,
        data: {
          ...block.data,
          text: "Aerial photo, video, and FPV for real estate, construction, and land.",
          upcomingService: "Thermal imaging — planned",
        },
      };
    }
    return block;
  });
'''
text = read("shared/precisionAerialProfile.ts")
if "export const PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS" not in text:
    raise AssertionError("Precision V4 rename failed")
if "export const PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS =" in text:
    raise AssertionError("Unexpected current Precision declaration remained after rename")
write("shared/precisionAerialProfile.ts", text.rstrip() + precision_current_append + "\n")
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    '''  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
''',
    '''  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS,
''',
)
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    '''const PRECISION_AERIAL_LEGACY_PROFILE_HEADLINE = "Drone photo and video in Pensacola.";
const PRECISION_AERIAL_PROFILE_HEADLINE = "FAA Part 107 aerial photo and video in Pensacola.";
const PRECISION_AERIAL_PROFILE_CTA = {
  primary: {
    label: "Direct Connect",
    kind: "message" as const,
    value: "/direct-connect",
  },
} as const;
''',
    '''const PRECISION_AERIAL_LEGACY_PROFILE_HEADLINE = "Drone photo and video in Pensacola.";
const PRECISION_AERIAL_V4_PROFILE_HEADLINE =
  "FAA Part 107 aerial photo and video in Pensacola.";
const PRECISION_AERIAL_PROFILE_HEADLINE = "Aerial photo, video, and FPV in Pensacola.";
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
''',
)
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    '''const PRECISION_AERIAL_PROFILE_SEO = {
  ...PRECISION_AERIAL_V2_PROFILE_SEO,
  description:
    "See aerial real estate, construction, land, and FPV work from FAA Part 107 licensed drone pilot Cameron in Pensacola.",
} as const;
''',
    '''const PRECISION_AERIAL_V4_PROFILE_SEO = {
  ...PRECISION_AERIAL_V2_PROFILE_SEO,
  description:
    "See aerial real estate, construction, land, and FPV work from FAA Part 107 licensed drone pilot Cameron in Pensacola.",
} as const;
const PRECISION_AERIAL_PROFILE_SEO = {
  ...PRECISION_AERIAL_V2_PROFILE_SEO,
  description:
    "See Pensacola aerial real estate, construction progress, land, and FPV work from Precision Aerial Services, then start a request.",
} as const;
''',
)
text = read("server/services/precisionAerialProfileProvisioning.ts")
sentinel_region_end = text.index("export function resolvePrecisionAerialProfileSeedFields")
sentinel_region = text[:sentinel_region_end].replace(
    "exactJsonMatch(profile.ctaConfig, PRECISION_AERIAL_PROFILE_CTA)",
    "exactJsonMatch(profile.ctaConfig, PRECISION_AERIAL_LEGACY_PROFILE_CTA)",
)
write("server/services/precisionAerialProfileProvisioning.ts", sentinel_region + text[sentinel_region_end:])
precision_v4_function = r'''
export function isPrecisionAerialV4SystemSeed(
  profile: ExistingProfileSeed | null | undefined,
  stewardPreferences: unknown
): boolean {
  if (!profile) return false;
  const preferences = asRecord(stewardPreferences);
  return (
    profile.displayName === PRECISION_AERIAL_BUSINESS_NAME &&
    profile.roleContext === "content_creator" &&
    profile.headline === PRECISION_AERIAL_V4_PROFILE_HEADLINE &&
    exactJsonMatch(profile.contentBlocks, PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS) &&
    exactJsonMatch(profile.ctaConfig, PRECISION_AERIAL_LEGACY_PROFILE_CTA) &&
    exactJsonMatch(profile.seoMeta, PRECISION_AERIAL_V4_PROFILE_SEO) &&
    exactJsonMatch(preferences.profileSections, DEFAULT_PROFILE_SECTIONS)
  );
}

'''
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    "export function resolvePrecisionAerialProfileSeedFields(\n",
    precision_v4_function + "export function resolvePrecisionAerialProfileSeedFields(\n",
)
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    '''    isPrecisionAerialV2SystemSeed(existingProfile, stewardPreferences) ||
    isPrecisionAerialV3SystemSeed(existingProfile, stewardPreferences)
''',
    '''    isPrecisionAerialV2SystemSeed(existingProfile, stewardPreferences) ||
    isPrecisionAerialV3SystemSeed(existingProfile, stewardPreferences) ||
    isPrecisionAerialV4SystemSeed(existingProfile, stewardPreferences)
''',
)
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    '''    const migrateExactSystemSeed =
      isPrecisionAerialV1SystemSeed(existingProfile, existingPreferences) ||
      isPrecisionAerialV2SystemSeed(existingProfile, existingPreferences);
''',
    '''    const migrateExactSystemSeed =
      isPrecisionAerialV1SystemSeed(existingProfile, existingPreferences) ||
      isPrecisionAerialV2SystemSeed(existingProfile, existingPreferences) ||
      isPrecisionAerialV3SystemSeed(existingProfile, existingPreferences) ||
      isPrecisionAerialV4SystemSeed(existingProfile, existingPreferences);
''',
)
replace_once(
    "server/services/precisionAerialProfileProvisioning.ts",
    '''  return {
    category: "Drone photo and video",
    tradePartner: false,
    ...existingProfileData,
''',
    '''  return {
    category: "Drone photo and video",
    description:
      "Aerial photo, traditional drone video, and FPV for real estate, construction progress, and land around Pensacola.",
    services: [
      "Real estate aerial photo and video",
      "Construction progress imagery",
      "Land and site aerials",
      "FPV drone video",
    ],
    serviceArea: "Pensacola area",
    contactPreference: "message",
    publicContactEnabled: false,
    notificationEmail: "contact@thetradescout.com",
    requestRouting: "tradescout_managed",
    tradePartner: false,
    ...existingProfileData,
''',
)

# Focused contracts and regressions.
replace_once(
    "server/tests/public-profile-publication-safety.behavior.test.ts",
    '''  OWNER_CONFIRMED_PROFILE_SOURCE,
  canDiscoverPublishedProfilePublicly,
''',
    '''  OWNER_CONFIRMED_PROFILE_SOURCE,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
  canDiscoverPublishedProfilePublicly,
''',
)
replace_once(
    "server/tests/public-profile-publication-safety.behavior.test.ts",
    '''  it("keeps Moulding & Millwork blocked while custody trust is missing", () => {
    const candidate = businessCandidate({
      profileSlug: "moulding-millwork-supply",
      ownerVerificationStatus: "pending",
      ownerVerifiedBadge: false,
      businessSources: ["operator_confirmed_selective_inheritance"],
    });
    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "private",
      reason: "business_trust_missing",
    });
  });
''',
    '''  it("publishes a reusable operator-confirmed managed business without granting a badge", () => {
    const candidate = businessCandidate({
      profileSlug: "moulding-millwork-supply",
      ownerVerificationStatus: "pending",
      ownerVerifiedBadge: false,
      ownerProvider: "admin_provisioned",
      businessSources: [
        "operator_confirmed_selective_inheritance",
        OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
      ],
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "public",
      reason: "public",
    });
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(true);
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
    expect(
      derivePublishedProfileExposure({
        ...candidate,
        profileSlug: "another-operator-confirmed-business",
      })
    ).toEqual({ mode: "public", reason: "public" });

    for (const rejected of [
      { ownerProvider: "local" },
      { businessSources: ["operator_confirmed_selective_inheritance"] },
      {
        businessSources: [
          OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
          OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
        ],
      },
      { businessOwnerUserId: "different-owner" },
    ]) {
      expect(
        derivePublishedProfileExposure({
          ...candidate,
          ...rejected,
        })
      ).toEqual({ mode: "private", reason: "business_trust_missing" });
    }
  });
''',
)
replace_once(
    "server/tests/profile-public-search-limit-trust.behavior.test.ts",
    '''import { canExposeLinkedBusinessProfilePublicly } from "../services/ownerConfirmedDirectProfile";
''',
    '''import { OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE } from "@shared/publicProfileExposureRegistry";
import { canExposeLinkedBusinessProfilePublicly } from "../services/ownerConfirmedDirectProfile";
''',
)
replace_once(
    "server/tests/profile-public-search-limit-trust.behavior.test.ts",
    '''    expect(predicate).toContain("${users.verificationStatus}");
    expect(predicate).not.toContain("profileVisibility");
''',
    '''    expect(predicate).toContain("${users.verificationStatus}");
    expect(predicate).toContain("OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE");
    expect(predicate).toContain("${users.provider}");
    expect(predicate).toContain("${businesses.claimStatus}");
    expect(predicate).toContain("${businesses.sources}");
    expect(predicate).not.toContain("profileVisibility");
''',
)
replace_once(
    "server/tests/profile-public-search-limit-trust.behavior.test.ts",
    '''    expect(predicate).not.toContain("ADMIN_MANAGED_PROFILE_SOURCE");
    expect(predicate).not.toContain("internalProfileSteward");
  });
''',
    '''    expect(predicate).not.toContain("ADMIN_MANAGED_PROFILE_SOURCE");
    expect(predicate).not.toContain("internalProfileSteward");
  });

  it("recognizes exact operator-confirmed managed authority without calling it verified", () => {
    const candidate = linkedCandidate({
      ownerProvider: "admin_provisioned",
      businessSources: [OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE],
    });
    expect(canExposeLinkedBusinessProfilePublicly(candidate)).toBe(true);
    expect(
      canExposeLinkedBusinessProfilePublicly({
        ...candidate,
        ownerProvider: "local",
      })
    ).toBe(false);
  });
''',
)
replace_once(
    "server/tests/moulding-millwork-profile.contract.test.ts",
    '''import { userRoleEnum } from "@shared/schema";
''',
    '''import { userRoleEnum } from "@shared/schema";
import {
  OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
} from "@shared/publicProfileExposureRegistry";
''',
)
replace_once(
    "server/tests/moulding-millwork-profile.contract.test.ts",
    '''    expect(provisioner).toContain("tradePartner: true");
''',
    '''    expect(provisioner).toContain("tradePartner: true");
    expect(provisioner).toContain("OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE");
    expect(provisioner).toContain("OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE");
    expect(provisioner).toContain('profile_authority_scope: "public_profile_and_request_routing"');
    expect(provisioner).toContain('label: "Start a Request"');
    expect(provisioner).toContain("publicProfileIds: releasedProfileIds");
    expect(OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE).toBe(
      "operator_confirmed_managed_business_profile"
    );
    expect(OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE).toBe(
      "operator_confirmed_managed_business_profile_revoked"
    );
''',
)
replace_once(
    "server/tests/issa-build-profile.contract.test.ts",
    '''    expect(provisioner).toContain("Project consultation");
''',
    '''    expect(provisioner).toContain("Project consultation");
    expect(provisioner).toContain('label: "Start a Request"');
    expect(provisioner).toContain(
      "ISSA Build handles material selection, customization, backlighting, and installation"
    );
    expect(JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS)).toContain(
      "Send the room once. ISSA Build handles material selection, customization, backlighting, and installation."
    );
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
''',
    '''  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS,
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''  isPrecisionAerialV3SystemSeed,
''',
    '''  isPrecisionAerialV3SystemSeed,
  isPrecisionAerialV4SystemSeed,
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''    expect(hero?.data.upcomingService).toBe("Thermal imaging");
''',
    '''    expect(hero?.data.upcomingService).toBe("Thermal imaging — planned");
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''      "insurance",
    ]) {
''',
    '''      "insurance",
      "licensed",
    ]) {
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''    expect(source).toContain("PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS");
''',
    '''    expect(source).toContain("PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS");
    expect(source).toContain('label: "Start a Request"');
    expect(source).toContain('notificationEmail: "contact@thetradescout.com"');
    expect(source).toContain('requestRouting: "tradescout_managed"');
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''    const freshProfile = resolvePrecisionAerialProfileSeedFields(null, {});
    expect(freshProfile.contentBlocks).toEqual(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);
    expect(freshProfile.headline).toBe("FAA Part 107 aerial photo and video in Pensacola.");
''',
    '''    const freshProfile = resolvePrecisionAerialProfileSeedFields(null, {});
    expect(freshProfile.contentBlocks).toEqual(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);
    expect(freshProfile.headline).toBe("Aerial photo, video, and FPV in Pensacola.");
    expect(freshProfile.ctaConfig).toMatchObject({
      primary: { label: "Start a Request", value: "/direct-connect" },
    });
''',
)
replace_once(
    "server/tests/precision-aerial-profile.contract.test.ts",
    '''    const customizedProfile = {
''',
    '''    const v4Profile = {
      ...v2Profile,
      headline: "FAA Part 107 aerial photo and video in Pensacola.",
      contentBlocks: PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS,
      seoMeta: {
        ...v2Profile.seoMeta,
        description:
          "See aerial real estate, construction, land, and FPV work from FAA Part 107 licensed drone pilot Cameron in Pensacola.",
      },
    };
    expect(isPrecisionAerialV4SystemSeed(v4Profile, { profileSections: v2Sections })).toBe(true);
    expect(
      resolvePrecisionAerialProfileSeedFields(v4Profile, {
        profileSections: v2Sections,
      })
    ).toMatchObject({
      headline: "Aerial photo, video, and FPV in Pensacola.",
      contentBlocks: PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
      ctaConfig: { primary: { label: "Start a Request" } },
    });

    const customizedProfile = {
''',
)

required_tokens = {
    "shared/publicProfileExposureRegistry.ts": [
        "OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE",
        "OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE",
    ],
    "server/services/ownerConfirmedDirectProfile.ts": [
        "hasOperatorConfirmedManagedBusinessAuthority",
        "operatorConfirmedManagedBusiness",
    ],
    "server/services/mouldingMillworkProfileProvisioning.ts": [
        'label: "Start a Request"',
        "publicProfileIds: releasedProfileIds",
    ],
    "server/services/issaBuildProfileProvisioning.ts": ['label: "Start a Request"'],
    "server/services/precisionAerialProfileProvisioning.ts": [
        "isPrecisionAerialV4SystemSeed",
        'label: "Start a Request"',
        'notificationEmail: "contact@thetradescout.com"',
    ],
    "shared/precisionAerialProfile.ts": [
        "PRECISION_AERIAL_V4_PROFILE_CONTENT_BLOCKS",
        "Thermal imaging — planned",
    ],
}
for path, tokens in required_tokens.items():
    body = read(path)
    for token in tokens:
        if token not in body:
            raise AssertionError((path, token))
