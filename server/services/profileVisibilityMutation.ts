import { withProfileExplicitVisibility } from "../../shared/profileVisibility";
import { pool } from "../db";
import { derivePublishedProfileExposure } from "./ownerConfirmedDirectProfile";

type OwnedProfileVisibilityTarget = {
  id?: unknown;
  slug?: unknown;
  status?: unknown;
  roleContext?: unknown;
  businessId?: unknown;
  contentBlocks?: unknown;
};

type ProfileVisibilityTargetStore = {
  getProfileByIdForOwner: (
    ownerUserId: string,
    profileId: string
  ) => Promise<OwnedProfileVisibilityTarget | null | undefined>;
};

export type OwnedProfileVisibilityTargetResult =
  | {
      ok: true;
      profile: OwnedProfileVisibilityTarget;
      profileId: string;
      usedLegacyActiveProfileFallback: boolean;
    }
  | {
      ok: false;
      status: 400 | 404;
      message: string;
    };

const normalizedId = (value: unknown): string => String(value || "").trim();

const TARGET_BUSINESS_ROLE_CONTEXTS = new Set([
  "business_owner",
  "commercial_property",
  "franchise_owner",
  "startup_founder",
  "contractor",
  "service_provider",
  "specialty_tradesperson",
  "property_manager",
  "realtor",
  "car_dealer",
  "auto_service",
]);

export type TargetProfileVerificationPolicy = {
  roleContext: string;
  presenceType: "personal" | "represent_business";
  isBusinessTarget: boolean;
  isContractorTarget: boolean;
};

export function resolveTargetProfileVerificationPolicy(
  profile: OwnedProfileVisibilityTarget
): TargetProfileVerificationPolicy {
  const roleContext = String(profile?.roleContext || "")
    .trim()
    .toLowerCase();
  const blocks = Array.isArray(profile?.contentBlocks) ? profile.contentBlocks : [];
  const representsBusinessInContent = blocks.some((block: any) => {
    if (String(block?.type || "").trim() === "businessDraft") return true;
    return String(block?.data?.presenceType || "").trim() === "represent_business";
  });
  const isBusinessTarget =
    normalizedId(profile?.businessId).length > 0 ||
    TARGET_BUSINESS_ROLE_CONTEXTS.has(roleContext) ||
    representsBusinessInContent;

  return {
    roleContext,
    presenceType: isBusinessTarget ? "represent_business" : "personal",
    isBusinessTarget,
    isContractorTarget: roleContext === "contractor",
  };
}

type ProfileVisibilityQueryResult = {
  rows?: any[];
  rowCount?: number | null;
};

export type ProfileVisibilityTransactionClient = {
  query: (text: string, values?: unknown[]) => Promise<ProfileVisibilityQueryResult>;
  release?: () => void;
};

export type ProfileVisibilityTransactionPool = {
  connect: () => Promise<ProfileVisibilityTransactionClient>;
};

export const PROFILE_VISIBILITY_OWNER_LOCK_SQL = `
  SELECT id,
         active_profile_id,
         preferences,
         role,
         roles,
         provider,
         verified_badge,
         verification_status,
         address_verified
    FROM users
   WHERE id = $1
   FOR UPDATE
`;

export const PROFILE_VISIBILITY_TARGET_LOCK_SQL = `
  SELECT id,
         slug,
         status,
         publicly_released,
         role_context,
         business_id,
         headline,
         content_blocks
    FROM profiles
   WHERE id = $1
     AND owner_user_id = $2
   FOR UPDATE
`;

export const PROFILE_VISIBILITY_RELEASE_SQL = `
  UPDATE profiles
     SET status = CASE WHEN $3::boolean THEN 'published' ELSE 'draft' END,
         publicly_released = $3::boolean,
         updated_at = NOW()
   WHERE id = $1
     AND owner_user_id = $2
  RETURNING status, publicly_released
`;

export const PROFILE_VISIBILITY_BUSINESS_OWNER_LOCK_SQL = `
  SELECT owner_user_id,
         status,
         public_discovery_enabled,
         sources,
         claim_status
    FROM businesses
   WHERE id = $1
   FOR KEY SHARE
`;

export const PROFILE_VISIBILITY_PROFESSIONAL_APPROVAL_SQL = `
  SELECT CASE
           WHEN $2::text = 'realtor' THEN EXISTS (
             SELECT 1
               FROM realtor_profiles
              WHERE user_id = $1
                AND verification_status = 'approved'
                AND is_active = true
           )
           WHEN $2::text = 'car_dealer' THEN EXISTS (
             SELECT 1
               FROM car_salesman_profiles
              WHERE user_id = $1
                AND verification_status = 'approved'
                AND is_active = true
           )
           ELSE true
         END AS approved
`;

/**
 * Maintains legacy UI compatibility keys against the preferences value that
 * exists after the owner row lock is acquired. Anonymous authority lives only
 * on profiles.publicly_released; no preferences writer can publish a Profile.
 * No caller-supplied snapshot participates, so sibling UI state survives.
 */
export const PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL = `
  WITH owner_preferences AS (
    SELECT CASE
             WHEN jsonb_typeof(COALESCE(preferences, '{}'::jsonb)) = 'object'
               THEN COALESCE(preferences, '{}'::jsonb)
             ELSE '{}'::jsonb
           END AS value
      FROM users
     WHERE id = $1
  ),
  next_public_profile_ids AS (
    SELECT COALESCE(
             jsonb_agg(to_jsonb(candidate.profile_id) ORDER BY candidate.profile_id),
             '[]'::jsonb
           ) AS value
      FROM (
        SELECT DISTINCT btrim(existing.profile_id) AS profile_id
          FROM owner_preferences,
               LATERAL jsonb_array_elements_text(
                 CASE
                   WHEN jsonb_typeof(owner_preferences.value -> 'publicProfileIds') = 'array'
                     THEN owner_preferences.value -> 'publicProfileIds'
                   ELSE '[]'::jsonb
                 END
               ) AS existing(profile_id)
         WHERE btrim(existing.profile_id) <> ''
           AND ($3::boolean OR btrim(existing.profile_id) <> $2::text)
        UNION
        SELECT $2::text
         WHERE $3::boolean
      ) AS candidate
  )
  UPDATE users AS owner
     SET preferences = owner_preferences.value
         || jsonb_build_object('publicProfileIds', next_public_profile_ids.value)
         || CASE
              WHEN $4::boolean
                THEN jsonb_build_object('profileVisibility', $5::text)
              ELSE '{}'::jsonb
            END,
         updated_at = NOW()
    FROM owner_preferences, next_public_profile_ids
   WHERE owner.id = $1
  RETURNING owner.preferences
`;

export type ExactProfileVisibilityMutationResult =
  | {
      ok: true;
      profileId: string;
      profileSlug: string | null;
      profileStatus: string;
      preferences: Record<string, unknown>;
      legacyProfileVisibility: string | null;
      usedLegacyActiveProfileFallback: boolean;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 428;
      code?:
        | "BUSINESS_DISCOVERY_LOCKED"
        | "PROFILE_BUSINESS_OWNERSHIP_REQUIRED"
        | "PROFESSIONAL_APPROVAL_REQUIRED"
        | "PROFILE_EXPOSURE_REQUIREMENTS_UNMET";
      message: string;
      profileId?: string;
    }
  | {
      ok: false;
      status: 200;
      code: "CONTRACTOR_VERIFICATION_SUGGESTED";
      message: string;
      profileId: string;
      roleContext: string;
    };

function preferenceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Owns the complete status + exact-release transition. The user lock serializes
 * sibling visibility changes; the profile lock rechecks ownership and target
 * policy inside the same transaction. Any error rolls both writes back.
 */
export async function mutateExactProfileVisibilityAtomically(
  args: {
    ownerUserId: string;
    requestedProfileId?: unknown;
    allowLegacyActiveProfileFallback: boolean;
    profileVisibility: "public" | "private";
    proceedUnverified?: boolean;
  },
  transactionPool: ProfileVisibilityTransactionPool = pool as unknown as ProfileVisibilityTransactionPool
): Promise<ExactProfileVisibilityMutationResult> {
  const ownerUserId = normalizedId(args.ownerUserId);
  const requestedProfileId = normalizedId(args.requestedProfileId);
  if (!ownerUserId) {
    return { ok: false, status: 404, message: "User not found" };
  }
  if (!requestedProfileId && !args.allowLegacyActiveProfileFallback) {
    return { ok: false, status: 400, message: "profileId is required" };
  }

  const client = await transactionPool.connect();
  let transactionFinished = false;
  const rollbackWith = async <T extends ExactProfileVisibilityMutationResult>(
    result: T
  ): Promise<T> => {
    await client.query("ROLLBACK");
    transactionFinished = true;
    return result;
  };

  try {
    await client.query("BEGIN");
    const ownerResult = await client.query(PROFILE_VISIBILITY_OWNER_LOCK_SQL, [ownerUserId]);
    const owner = ownerResult.rows?.[0];
    if (!owner) {
      return await rollbackWith({ ok: false, status: 404, message: "User not found" });
    }

    const profileId = requestedProfileId || normalizedId(owner.active_profile_id);
    if (!profileId) {
      return await rollbackWith({ ok: false, status: 400, message: "profileId is required" });
    }
    const usedLegacyActiveProfileFallback = !requestedProfileId;

    const profileResult = await client.query(PROFILE_VISIBILITY_TARGET_LOCK_SQL, [
      profileId,
      ownerUserId,
    ]);
    const target = profileResult.rows?.[0];
    if (!target || normalizedId(target.id) !== profileId) {
      return await rollbackWith({ ok: false, status: 404, message: "Profile not found" });
    }

    const targetPolicy = resolveTargetProfileVerificationPolicy({
      id: target.id,
      slug: target.slug,
      status: target.status,
      roleContext: target.role_context,
      businessId: target.business_id,
      contentBlocks: target.content_blocks,
    });

    let linkedBusiness: Record<string, unknown> | null = null;
    if (args.profileVisibility === "public" && normalizedId(target.business_id)) {
      const businessResult = await client.query(PROFILE_VISIBILITY_BUSINESS_OWNER_LOCK_SQL, [
        normalizedId(target.business_id),
      ]);
      linkedBusiness = businessResult.rows?.[0] || null;
      const businessOwnerUserId = normalizedId(linkedBusiness?.owner_user_id);
      if (!businessOwnerUserId || businessOwnerUserId !== ownerUserId) {
        return await rollbackWith({
          ok: false,
          status: 404,
          code: "PROFILE_BUSINESS_OWNERSHIP_REQUIRED",
          message: "Business not found",
          profileId,
        });
      }
    }

    let professionalRoleApproved = true;
    if (
      args.profileVisibility === "public" &&
      (targetPolicy.roleContext === "realtor" || targetPolicy.roleContext === "car_dealer")
    ) {
      const approvalResult = await client.query(PROFILE_VISIBILITY_PROFESSIONAL_APPROVAL_SQL, [
        ownerUserId,
        targetPolicy.roleContext,
      ]);
      professionalRoleApproved = approvalResult.rows?.[0]?.approved === true;
      if (!professionalRoleApproved) {
        return await rollbackWith({
          ok: false,
          status: 403,
          code: "PROFESSIONAL_APPROVAL_REQUIRED",
          message: `An approved ${
            targetPolicy.roleContext === "realtor" ? "realtor" : "car dealer"
          } application is required for this Profile`,
          profileId,
        });
      }
    }
    const verificationStatus = String(owner.verification_status || "")
      .trim()
      .toLowerCase();
    const verifiedForBusinessDiscovery =
      owner.verified_badge === true || verificationStatus === "approved";

    if (
      args.profileVisibility === "public" &&
      targetPolicy.isBusinessTarget &&
      !verifiedForBusinessDiscovery
    ) {
      return await rollbackWith({
        ok: false,
        status: 428,
        code: "BUSINESS_DISCOVERY_LOCKED",
        message:
          "Business discovery is locked until verification is complete. You can continue setup and requests now, but public visibility stays private.",
        profileId,
      });
    }

    if (args.profileVisibility === "public") {
      const exposure = derivePublishedProfileExposure({
        profileId,
        profilePubliclyReleased: true,
        profileSlug: target.slug,
        profileStatus: "published",
        profileRoleContext: target.role_context,
        profileHeadline: target.headline,
        profileServicesDescription: preferenceRecord(owner.preferences).servicesDescription,
        profileContentBlocks: target.content_blocks,
        businessId: target.business_id,
        profileOwnerUserId: ownerUserId,
        ownerRole: owner.role,
        ownerRoles: owner.roles,
        ownerVerifiedBadge: owner.verified_badge,
        ownerVerificationStatus: owner.verification_status,
        ownerProvider: owner.provider,
        ownerPreferences: owner.preferences,
        businessStatus: linkedBusiness?.status,
        businessOwnerUserId: linkedBusiness?.owner_user_id,
        publicDiscoveryEnabled: linkedBusiness?.public_discovery_enabled,
        businessSources: linkedBusiness?.sources,
        businessClaimStatus: linkedBusiness?.claim_status,
        professionalRoleApproved,
      });
      if (exposure.mode === "private") {
        return await rollbackWith({
          ok: false,
          status: 428,
          code: "PROFILE_EXPOSURE_REQUIREMENTS_UNMET",
          message: `Profile cannot be publicly released: ${exposure.reason}`,
          profileId,
        });
      }
    }

    const verifiedForContractorSuggestion = verificationStatus === "approved";
    if (
      args.profileVisibility === "public" &&
      targetPolicy.isContractorTarget &&
      !verifiedForContractorSuggestion &&
      args.proceedUnverified !== true
    ) {
      return await rollbackWith({
        ok: false,
        status: 200,
        code: "CONTRACTOR_VERIFICATION_SUGGESTED",
        message: "Verification is recommended before publishing this contractor profile.",
        profileId,
        roleContext: targetPolicy.roleContext,
      });
    }

    const releaseResult = await client.query(PROFILE_VISIBILITY_RELEASE_SQL, [
      profileId,
      ownerUserId,
      args.profileVisibility === "public",
    ]);
    if (!releaseResult.rows?.[0]) {
      throw new Error("Atomic profile publication lost its locked target");
    }
    const profileStatus = String(
      releaseResult.rows[0].status || (args.profileVisibility === "public" ? "published" : "draft")
    );

    const preferencesResult = await client.query(PROFILE_VISIBILITY_ATOMIC_PREFERENCES_SQL, [
      ownerUserId,
      profileId,
      args.profileVisibility === "public",
      usedLegacyActiveProfileFallback,
      args.profileVisibility,
    ]);
    const preferencesRow = preferencesResult.rows?.[0];
    if (!preferencesRow) {
      throw new Error("Atomic profile publication lost its locked owner");
    }
    const preferences = preferenceRecord(preferencesRow.preferences);

    await client.query("COMMIT");
    transactionFinished = true;
    return {
      ok: true,
      profileId,
      profileSlug: normalizedId(target.slug) || null,
      profileStatus,
      preferences,
      legacyProfileVisibility:
        typeof preferences.profileVisibility === "string" ? preferences.profileVisibility : null,
      usedLegacyActiveProfileFallback,
    };
  } catch (error) {
    if (!transactionFinished) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
    }
    throw error;
  } finally {
    client.release?.();
  }
}

/**
 * Resolves visibility mutations only through an owner-scoped Profile read.
 * Older callers may omit profileId only when the account already has an exact
 * active profile; arbitrary first-profile selection and profile creation are
 * intentionally not compatibility behaviors.
 */
export async function resolveOwnedProfileVisibilityTarget(args: {
  storage: ProfileVisibilityTargetStore;
  ownerUserId: string;
  requestedProfileId?: unknown;
  activeProfileId?: unknown;
  allowLegacyActiveProfileFallback: boolean;
}): Promise<OwnedProfileVisibilityTargetResult> {
  const requestedProfileId = normalizedId(args.requestedProfileId);
  if (!requestedProfileId && !args.allowLegacyActiveProfileFallback) {
    return { ok: false, status: 400, message: "profileId is required" };
  }

  const profileId = requestedProfileId || normalizedId(args.activeProfileId);
  if (!profileId) {
    return { ok: false, status: 400, message: "profileId is required" };
  }

  const profile = await args.storage.getProfileByIdForOwner(args.ownerUserId, profileId);
  if (!profile || normalizedId(profile.id) !== profileId) {
    return { ok: false, status: 404, message: "Profile not found" };
  }

  return {
    ok: true,
    profile,
    profileId,
    usedLegacyActiveProfileFallback: !requestedProfileId,
  };
}

export function buildExactProfileVisibilityPreferences(args: {
  preferences: unknown;
  profileId: string;
  profileVisibility: "public" | "private";
  updateLegacyAccountVisibility?: boolean;
}): Record<string, unknown> {
  const preferences = withProfileExplicitVisibility({
    profileId: args.profileId,
    preferences: args.preferences,
    isPublic: args.profileVisibility === "public",
  });

  // Only an older caller that deliberately omitted profileId retains the old
  // account-level display preference. Explicit per-profile actions never widen
  // that legacy surface.
  return args.updateLegacyAccountVisibility
    ? { ...preferences, profileVisibility: args.profileVisibility }
    : preferences;
}
