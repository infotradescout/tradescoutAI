import { sql } from "drizzle-orm";
import { carSalesmanProfiles, profiles, realtorProfiles } from "../../shared/schema";

export const PROFESSIONAL_PROFILE_ROLE_CONTEXTS = new Set(["realtor", "car_dealer"]);

export function normalizeProfileRoleContext(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function isProfessionalProfileRoleContext(value: unknown): boolean {
  return PROFESSIONAL_PROFILE_ROLE_CONTEXTS.has(normalizeProfileRoleContext(value));
}

export function hasDurableProfessionalApplicationApproval(profile: unknown): boolean {
  const record = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
  return (
    String(record.verificationStatus || "")
      .trim()
      .toLowerCase() === "approved" && record.isActive === true
  );
}

/**
 * Correlated SQL expression used by every canonical public Profile reader.
 * Non-professional contexts are true; professional contexts require the
 * server-owned application row created by the admin decision workflow.
 */
export const durableProfessionalProfileApprovalSql = sql<boolean>`
  CASE
    WHEN ${profiles.roleContext} = 'realtor' THEN EXISTS (
      SELECT 1
        FROM ${realtorProfiles}
       WHERE ${realtorProfiles.userId} = ${profiles.ownerUserId}
         AND ${realtorProfiles.verificationStatus} = 'approved'
         AND ${realtorProfiles.isActive} = true
    )
    WHEN ${profiles.roleContext} = 'car_dealer' THEN EXISTS (
      SELECT 1
        FROM ${carSalesmanProfiles}
       WHERE ${carSalesmanProfiles.userId} = ${profiles.ownerUserId}
         AND ${carSalesmanProfiles.verificationStatus} = 'approved'
         AND ${carSalesmanProfiles.isActive} = true
    )
    ELSE true
  END
`;

type ProfileTargetAuthorityStore = {
  getBusinessByIdForOwner: (ownerUserId: string, businessId: string) => Promise<unknown>;
  getRealtorProfileByUserId: (ownerUserId: string) => Promise<unknown>;
  getCarSalesmanProfileByUserId: (ownerUserId: string) => Promise<unknown>;
};

export type ProfileTargetAuthorityDecision =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 404;
      code: "PROFILE_BUSINESS_OWNERSHIP_REQUIRED" | "PROFESSIONAL_APPROVAL_REQUIRED";
      message: string;
    };

export async function validateProfileTargetAuthority(args: {
  storage: ProfileTargetAuthorityStore;
  ownerUserId: string;
  businessId?: unknown;
  roleContext?: unknown;
}): Promise<ProfileTargetAuthorityDecision> {
  const ownerUserId = String(args.ownerUserId || "").trim();
  const businessId = String(args.businessId || "").trim();
  const roleContext = normalizeProfileRoleContext(args.roleContext);

  if (businessId) {
    const ownedBusiness = await args.storage.getBusinessByIdForOwner(ownerUserId, businessId);
    if (!ownedBusiness) {
      return {
        ok: false,
        status: 404,
        code: "PROFILE_BUSINESS_OWNERSHIP_REQUIRED",
        message: "Business not found",
      };
    }
  }

  if (roleContext === "realtor") {
    const application = await args.storage.getRealtorProfileByUserId(ownerUserId);
    if (!hasDurableProfessionalApplicationApproval(application)) {
      return {
        ok: false,
        status: 403,
        code: "PROFESSIONAL_APPROVAL_REQUIRED",
        message: "An approved realtor application is required for this Profile",
      };
    }
  }

  if (roleContext === "car_dealer") {
    const application = await args.storage.getCarSalesmanProfileByUserId(ownerUserId);
    if (!hasDurableProfessionalApplicationApproval(application)) {
      return {
        ok: false,
        status: 403,
        code: "PROFESSIONAL_APPROVAL_REQUIRED",
        message: "An approved car dealer application is required for this Profile",
      };
    }
  }

  return { ok: true };
}
