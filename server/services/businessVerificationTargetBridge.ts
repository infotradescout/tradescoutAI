import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { businesses, profiles, userProfiles, users, type User } from "@shared/schema";
import { computeVerificationRequirements } from "./profileVerificationService";
import { z } from "zod";
import {
  adminBusinessVerificationDecisionSchema,
  buildVerificationFieldReviewState,
  deriveOverallBusinessVerificationStatus,
  isOwnedPrivateObjectKey,
  mergeVerificationSubmission,
  profileVerificationSubmissionSchema,
  REVIEWABLE_BUSINESS_VERIFICATION_FIELDS,
  recordVerificationDecision,
  selectOwnedVerificationProfile,
  sanitizeVerificationSubmissions,
} from "./businessVerificationWorkflow";
import type {
  VerificationRequirementsShape,
  VerificationStatusShape,
} from "./businessVerificationWorkflow";

export type BusinessVerificationTarget = {
  userId: string;
  businessId: string;
  publicProfileId: string;
};

const TARGET_KEY = "businessVerificationTarget";

/** Separate, stable verification identity; neither public Profile nor Business IDs are reused. */
export function businessVerificationProfileId(target: BusinessVerificationTarget): string {
  const hex = createHash("sha256")
    .update(
      JSON.stringify([
        "tradescout-business-verification-v1",
        target.userId,
        target.businessId,
        target.publicProfileId,
      ])
    )
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function storedTarget(row: any): BusinessVerificationTarget | null {
  const value = row?.verificationSubmissions?.[TARGET_KEY];
  if (!value || typeof value !== "object") return null;
  const target = {
    userId: String(value.userId || "").trim(),
    businessId: String(value.businessId || "").trim(),
    publicProfileId: String(value.publicProfileId || "").trim(),
  };
  return target.userId &&
    target.businessId &&
    target.publicProfileId &&
    target.userId === String(row.userId) &&
    businessVerificationProfileId(target) === String(row.id)
    ? target
    : null;
}

export async function lockBusinessVerificationOwner(tx: any, userId: string): Promise<any | null> {
  const [owner] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for("update");
  return owner || null;
}

async function loadOwnedPublicTarget(
  tx: any,
  target: Pick<BusinessVerificationTarget, "userId" | "publicProfileId">,
  lock: boolean
) {
  const profileQuery = tx
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, target.publicProfileId), eq(profiles.ownerUserId, target.userId)))
    .limit(1);
  let [profile] = await profileQuery;
  if (!profile?.businessId) return null;
  let businessQuery = tx
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, profile.businessId), eq(businesses.ownerUserId, target.userId)))
    .limit(1);
  if (lock) businessQuery = businessQuery.for("update");
  const [business] = await businessQuery;
  if (!business) return null;
  if (lock) {
    [profile] = await tx
      .select()
      .from(profiles)
      .where(
        and(
          eq(profiles.id, target.publicProfileId),
          eq(profiles.ownerUserId, target.userId),
          eq(profiles.businessId, business.id)
        )
      )
      .limit(1)
      .for("update");
    if (!profile) return null;
  }
  return { profile, business, target: { ...target, businessId: String(business.id) } };
}

/** Called in the existing onboarding transaction: initialize requirements, never trust. */
export async function ensureBusinessVerificationProfile(
  tx: any,
  args: { userId: string; business: any; profile: any }
): Promise<any> {
  if (
    String(args.business.ownerUserId) !== args.userId ||
    String(args.profile.ownerUserId) !== args.userId ||
    String(args.profile.businessId) !== String(args.business.id)
  ) {
    throw new Error("Business verification target is not owned");
  }
  const target = {
    userId: args.userId,
    businessId: String(args.business.id),
    publicProfileId: String(args.profile.id),
  };
  const id = businessVerificationProfileId(target);
  const role = String(args.profile.roleContext || "business_owner");
  const serviceProvider = ["contractor", "service_provider", "specialty_tradesperson"].includes(
    role
  );
  // Unclassified business identities keep the schema's nullable subtype.
  // The business intent still requires tax ID and business registration.
  const businessType = serviceProvider ? "service_provider" : null;
  const serviceTags = serviceProvider ? [role] : [];
  const requirements = await computeVerificationRequirements("business", businessType, serviceTags);
  const [created] = await tx
    .insert(userProfiles)
    .values({
      id,
      userId: args.userId,
      userIntent: "business",
      businessType,
      role: serviceProvider ? "contractor" : "business_owner",
      roles: [],
      serviceTags,
      sellerTags: [],
      displayName: args.profile.displayName || args.business.name,
      profileVisibility: "private",
      verifiedBadge: false,
      verificationStatus: "pending",
      verificationRequirements: requirements,
      verificationSubmissions: { [TARGET_KEY]: target },
      isPrimary: false,
    } as any)
    .onConflictDoNothing({ target: userProfiles.id })
    .returning();
  if (created) return created;
  const [existing] = await tx.select().from(userProfiles).where(eq(userProfiles.id, id)).limit(1);
  if (!existing || !storedTarget(existing))
    throw new Error("Business verification identity conflict");
  return existing;
}

export async function resolveOwnedPublicVerificationProfile(
  tx: any,
  args: { userId: string; publicProfileId: string; lock?: boolean }
): Promise<any | null> {
  const owned = await loadOwnedPublicTarget(tx, args, Boolean(args.lock));
  if (!owned) return null;
  const id = businessVerificationProfileId(owned.target);
  let query = tx
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.id, id), eq(userProfiles.userId, args.userId)))
    .limit(1);
  if (args.lock) query = query.for("update");
  const [verification] = await query;
  const target = storedTarget(verification);
  return target &&
    target.businessId === owned.target.businessId &&
    target.publicProfileId === args.publicProfileId
    ? verification
    : null;
}

/** Resolve mapping before locking the verification row: owner -> Business -> public Profile -> verification. */
export async function validateReviewedBusinessVerificationTarget(
  tx: any,
  row: any
): Promise<BusinessVerificationTarget | null> {
  if (!row?.verificationSubmissions?.[TARGET_KEY]) return null; // Existing legacy workflow.
  const target = storedTarget(row);
  if (!target)
    throw Object.assign(new Error("Invalid business verification target"), { status: 404 });
  const owned = await loadOwnedPublicTarget(tx, target, true);
  if (!owned || owned.target.businessId !== target.businessId) {
    throw Object.assign(new Error("Business verification target is no longer owned"), {
      status: 404,
    });
  }
  return target;
}

export function allBusinessVerificationRequirementsSatisfied(
  requirements: VerificationRequirementsShape,
  status: VerificationStatusShape
): boolean {
  return Object.entries(requirements).every(
    ([field, required]) => !required || status[field as keyof VerificationStatusShape] === true
  );
}

/** Only actual canonical review can promote the account authority publication consumes. */
export async function syncReviewedBusinessVerificationAuthority(
  tx: any,
  args: {
    owner: any;
    verificationProfile: any;
    target: BusinessVerificationTarget | null;
    overallStatus: "pending" | "approved" | "rejected";
    requirements: VerificationRequirementsShape;
    status: VerificationStatusShape;
  }
): Promise<void> {
  if (!args.target) return;
  if (args.owner.verificationStatus === "suspended") return;
  const rows: any[] = await tx
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, args.target.userId));
  // Provenance lives only in private, server-written verification metadata.
  // Account preferences can be replaced or erased without changing it.
  const grantors = rows.filter(
    (row) => row.verificationSubmissions?.releaseAuthorityGranted === true && storedTarget(row)
  );
  const ownsAuthority = grantors.some((row) => row.id === args.verificationProfile.id);
  if (
    args.owner.verifiedBadge === true ||
    (args.owner.verificationStatus === "approved" && grantors.length === 0)
  )
    return;
  const approved =
    args.overallStatus === "approved" &&
    allBusinessVerificationRequirementsSatisfied(args.requirements, args.status);
  if (!approved && !ownsAuthority) return;
  // The owner lock serializes source movement; at most one row grants authority.
  for (const grantor of grantors) {
    if (approved && grantor.id === args.verificationProfile.id) continue;
    await tx
      .update(userProfiles)
      .set({
        verificationSubmissions: {
          ...grantor.verificationSubmissions,
          releaseAuthorityGranted: false,
        },
      } as any)
      .where(and(eq(userProfiles.id, grantor.id), eq(userProfiles.userId, args.target.userId)));
  }
  if (approved && !ownsAuthority) {
    await tx
      .update(userProfiles)
      .set({
        verificationSubmissions: {
          ...args.verificationProfile.verificationSubmissions,
          releaseAuthorityGranted: true,
        },
      } as any)
      .where(
        and(
          eq(userProfiles.id, args.verificationProfile.id),
          eq(userProfiles.userId, args.target.userId)
        )
      );
  }
  await tx
    .update(users)
    .set({
      verificationStatus: approved
        ? "approved"
        : args.overallStatus === "rejected"
          ? "rejected"
          : "pending",
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, args.target.userId));
}

export function businessVerificationStatus(profile: any, owner: any): VerificationStatusShape {
  return {
    email: Boolean(owner?.emailVerified || profile?.email_verified),
    address: Boolean(owner?.addressVerified || profile?.address_verified),
    license: Boolean(profile?.license_verified),
    insurance: Boolean(profile?.insurance_verified),
    tax_id: Boolean(profile?.tax_id_verified),
    business_registration: Boolean(profile?.business_registration_verified),
  };
}

function workflowError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

/** Existing submission rules, serialized with review and exact public release. */
export async function submitOwnedBusinessVerification(
  tx: any,
  args: {
    userId: string;
    input: z.infer<typeof profileVerificationSubmissionSchema>;
  }
) {
  const owner = await lockBusinessVerificationOwner(tx, args.userId);
  if (!owner) throw workflowError("User not found", 404);
  let profile: any;
  if (args.input.publicProfileId) {
    profile = await resolveOwnedPublicVerificationProfile(tx, {
      userId: args.userId,
      publicProfileId: args.input.publicProfileId,
      lock: true,
    });
  } else {
    const rows = await tx.select().from(userProfiles).where(eq(userProfiles.userId, args.userId));
    const selected: any = selectOwnedVerificationProfile(rows, args.input.businessProfileId);
    if (selected) {
      await validateReviewedBusinessVerificationTarget(tx, selected);
      [profile] = await tx
        .select()
        .from(userProfiles)
        .where(and(eq(userProfiles.id, selected.id), eq(userProfiles.userId, args.userId)))
        .limit(1)
        .for("update");
    }
  }
  if (!profile) throw workflowError("Business profile not found", 404);
  for (const field of [
    "licenseDocObjectKey",
    "insuranceDocObjectKey",
    "taxDocumentObjectKey",
    "businessRegistrationDocObjectKey",
  ] as const) {
    if (args.input[field] && !isOwnedPrivateObjectKey(args.input[field], args.userId)) {
      throw workflowError(`${field} is not an owned private object key`, 400);
    }
  }
  const requirements = await computeVerificationRequirements(
    profile.userIntent,
    profile.businessType,
    profile.serviceTags || [],
    profile.sellerTags || []
  );
  const nextSubmissions = mergeVerificationSubmission(
    profile.verificationSubmissions || {},
    args.input,
    new Date().toISOString()
  );
  const values: Record<string, unknown> = {
    verificationRequirements: requirements,
    verificationSubmissions: nextSubmissions,
    verificationStatus: "pending",
    updatedAt: new Date(),
  };
  if (args.input.licenseNumber || args.input.licenseDocObjectKey) values.license_verified = false;
  if (args.input.insuranceDocObjectKey) values.insurance_verified = false;
  if (args.input.taxIdLast4 || args.input.taxDocumentObjectKey) values.tax_id_verified = false;
  if (args.input.businessRegistrationDocObjectKey) values.business_registration_verified = false;
  const [updated] = await tx
    .update(userProfiles)
    .set(values as any)
    .where(and(eq(userProfiles.id, profile.id), eq(userProfiles.userId, args.userId)))
    .returning();
  if (!updated) throw workflowError("Business profile not found", 404);
  const status = businessVerificationStatus(updated, owner);
  await syncReviewedBusinessVerificationAuthority(tx, {
    owner,
    verificationProfile: updated,
    target: storedTarget(updated),
    overallStatus: "pending",
    requirements,
    status,
  });
  return {
    profile: updated,
    requirements,
    status,
    submissions: nextSubmissions,
    fieldReview: buildVerificationFieldReviewState({
      requirements,
      status,
      submissions: nextSubmissions,
    }),
  };
}

/** Invoked only behind the existing authenticated admin review route. */
export async function reviewBusinessVerification(
  tx: any,
  args: {
    verificationProfileId: string;
    reviewerId: string;
    decision: z.infer<typeof adminBusinessVerificationDecisionSchema>;
  }
) {
  const [candidate] = await tx
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, args.verificationProfileId))
    .limit(1);
  if (!candidate) throw workflowError("Profile not found", 404);
  const owner = await lockBusinessVerificationOwner(tx, candidate.userId);
  if (!owner) throw workflowError("User not found", 404);
  const target = await validateReviewedBusinessVerificationTarget(tx, candidate);
  const [profile] = await tx
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.id, args.verificationProfileId), eq(userProfiles.userId, owner.id)))
    .limit(1)
    .for("update");
  if (!profile) throw workflowError("Profile not found", 404);
  const requirements = await computeVerificationRequirements(
    profile.userIntent,
    profile.businessType,
    profile.serviceTags || [],
    profile.sellerTags || []
  );
  const { field, decision, rejectionReason } = args.decision;
  if (!requirements[field]) throw workflowError("This verification field is not required", 400);
  // A bridge approval must review actual submitted evidence, not create it.
  const evidence = sanitizeVerificationSubmissions(profile.verificationSubmissions || {});
  const hasEvidence = {
    license: Boolean(evidence.licenseNumber || evidence.evidence.licenseDocument),
    insurance: evidence.evidence.insuranceDocument,
    tax_id: Boolean(evidence.taxIdLast4 || evidence.evidence.taxDocument),
    business_registration: evidence.evidence.businessRegistrationDocument,
  };
  if (target && decision === "approved" && !hasEvidence[field]) {
    throw workflowError("Submit evidence for this verification field before review", 400);
  }
  const nextSubmissions = recordVerificationDecision({
    submissions: profile.verificationSubmissions || {},
    field,
    decision,
    reviewerId: args.reviewerId,
    reviewedAt: new Date().toISOString(),
    rejectionReason,
  });
  const status = {
    ...businessVerificationStatus(profile, owner),
    [field]: decision === "approved",
  };
  const fieldReview = buildVerificationFieldReviewState({
    requirements,
    status,
    submissions: nextSubmissions,
    includeReviewer: true,
  });
  const overallStatus = deriveOverallBusinessVerificationStatus({
    requirements,
    fieldReviewState: fieldReview,
  });
  const columns = {
    license: "license_verified",
    insurance: "insurance_verified",
    tax_id: "tax_id_verified",
    business_registration: "business_registration_verified",
  } as const;
  const [updated] = await tx
    .update(userProfiles)
    .set({
      [columns[field]]: decision === "approved",
      verificationRequirements: requirements,
      verificationSubmissions: nextSubmissions,
      verificationStatus: overallStatus,
      updatedAt: new Date(),
    } as any)
    .where(and(eq(userProfiles.id, profile.id), eq(userProfiles.userId, owner.id)))
    .returning();
  if (!updated) throw workflowError("Profile not found", 404);
  await syncReviewedBusinessVerificationAuthority(tx, {
    owner,
    verificationProfile: updated,
    target,
    overallStatus,
    requirements,
    status,
  });
  return {
    profile: updated,
    requirements,
    status,
    fieldReview,
    submissions: nextSubmissions,
    overallStatus,
  };
}

/** Independent authorized account approval takes over provenance in the same owner transaction. */
export async function clearBusinessVerificationGrantAuthority(
  tx: any,
  userId: string
): Promise<void> {
  const rows: any[] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  for (const row of rows) {
    if (row.verificationSubmissions?.releaseAuthorityGranted !== true) continue;
    await tx
      .update(userProfiles)
      .set({
        verificationSubmissions: {
          ...row.verificationSubmissions,
          releaseAuthorityGranted: false,
        },
      } as any)
      .where(and(eq(userProfiles.id, row.id), eq(userProfiles.userId, userId)));
  }
}

/** Completing canonical identity requirements reuses previous authorized document decisions. */
export async function refreshReviewedBusinessVerificationForOwner(
  tx: any,
  userId: string
): Promise<void> {
  const owner = await lockBusinessVerificationOwner(tx, userId);
  if (!owner || owner.verificationStatus === "suspended" || owner.verifiedBadge === true) return;
  const rows: any[] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  const candidates = rows
    .filter((row) => storedTarget(row) && row.verificationStatus === "approved")
    .sort((left, right) => {
      const priority = (row: any) =>
        row.verificationSubmissions?.releaseAuthorityGranted === true
          ? 0
          : storedTarget(row)?.publicProfileId === owner.activeProfileId
            ? 1
            : 2;
      return priority(left) - priority(right) || String(left.id).localeCompare(String(right.id));
    });
  for (const candidate of candidates) {
    let target: BusinessVerificationTarget | null;
    try {
      target = await validateReviewedBusinessVerificationTarget(tx, candidate);
    } catch (error) {
      if ((error as any)?.status === 404) continue;
      throw error;
    }
    if (!target) continue;
    const [profile] = await tx
      .select()
      .from(userProfiles)
      .where(and(eq(userProfiles.id, candidate.id), eq(userProfiles.userId, userId)))
      .limit(1)
      .for("update");
    if (!profile || profile.verificationStatus !== "approved") continue;
    const requirements = await computeVerificationRequirements(
      profile.userIntent,
      profile.businessType,
      profile.serviceTags || [],
      profile.sellerTags || []
    );
    const requiredDocumentFields = REVIEWABLE_BUSINESS_VERIFICATION_FIELDS.filter(
      (field) => requirements[field]
    );
    if (
      requiredDocumentFields.length === 0 ||
      !requiredDocumentFields.every((field) => {
        const review = profile.verificationSubmissions?.fieldReview?.[field];
        return (
          review?.status === "approved" &&
          typeof review.reviewedBy === "string" &&
          review.reviewedBy.trim() &&
          typeof review.reviewedAt === "string" &&
          Number.isFinite(Date.parse(review.reviewedAt))
        );
      })
    )
      continue;
    const status = businessVerificationStatus(profile, owner);
    const fieldReview = buildVerificationFieldReviewState({
      requirements,
      status,
      submissions: profile.verificationSubmissions || {},
    });
    const overallStatus = deriveOverallBusinessVerificationStatus({
      requirements,
      fieldReviewState: fieldReview,
    });
    await syncReviewedBusinessVerificationAuthority(tx, {
      owner,
      verificationProfile: profile,
      target,
      overallStatus,
      requirements,
      status,
    });
    // All candidates share the same canonical identity checks. Keep the current
    // source or exact active target rather than moving across every business.
    if (
      allBusinessVerificationRequirementsSatisfied(requirements, status) ||
      profile.verificationSubmissions?.releaseAuthorityGranted === true
    )
      break;
  }
}

/** Canonical user writer hook; caller retains the existing authorization for these fields. */
export async function updateUserWithBusinessVerificationAuthority(
  tx: any,
  args: {
    userId: string;
    updates: Partial<User>;
  }
): Promise<User> {
  const owner = await lockBusinessVerificationOwner(tx, args.userId);
  if (!owner) throw workflowError("User not found", 404);
  if (args.updates.verificationStatus === "approved" || args.updates.verifiedBadge === true) {
    await clearBusinessVerificationGrantAuthority(tx, args.userId);
  }
  const [updated] = await tx
    .update(users)
    .set({ ...args.updates, updatedAt: new Date() })
    .where(eq(users.id, args.userId))
    .returning();
  if (!updated) throw workflowError("User not found", 404);
  if (
    args.updates.verificationStatus !== "approved" &&
    args.updates.verifiedBadge !== true &&
    (args.updates.emailVerified !== undefined || args.updates.addressVerified !== undefined)
  ) {
    await refreshReviewedBusinessVerificationForOwner(tx, args.userId);
  }
  const [finalOwner] = await tx.select().from(users).where(eq(users.id, args.userId)).limit(1);
  if (!finalOwner) throw workflowError("User not found", 404);
  return finalOwner;
}
