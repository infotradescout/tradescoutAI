import { eq } from "drizzle-orm";
import { carSalesmanProfiles, realtorProfiles, users } from "@shared/schema";
import { isAdminTierRole, normalizeAuthorityRole } from "../utils/authorityPolicy";

export const PROFESSIONAL_APPROVAL_REQUIRED_ROLE_VALUES = [
  "realtor",
  "car_dealer",
  "car_salesman",
  "vehicle_dealer",
] as const;

export const CANONICAL_APPROVED_PROFESSIONAL_ROLE_VALUES = ["realtor", "car_dealer"] as const;

export type CanonicalApprovedProfessionalRole =
  (typeof CANONICAL_APPROVED_PROFESSIONAL_ROLE_VALUES)[number];

export const PROFESSIONAL_APPROVAL_REQUIRED_ROLES: ReadonlySet<string> = new Set(
  PROFESSIONAL_APPROVAL_REQUIRED_ROLE_VALUES
);

export const PROFESSIONAL_APPROVAL_REQUIRED_RESPONSE = {
  message: "Realtor and car dealer roles require an approved professional application.",
  code: "PROFESSIONAL_APPROVAL_REQUIRED",
} as const;

export const PROFESSIONAL_VERIFICATION_DECISION_REQUIRED_RESPONSE = {
  message:
    "Realtor and car dealer roles must be granted through the professional verification decision endpoints.",
  code: "PROFESSIONAL_VERIFICATION_DECISION_REQUIRED",
  verificationEndpoints: [
    "/api/admin/realtor/verify/:profileId",
    "/api/admin/car-salesman/verify/:profileId",
  ],
} as const;

export function canonicalizeProfessionalRole(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

  return PROFESSIONAL_APPROVAL_REQUIRED_ROLES.has(normalized) ? normalized : undefined;
}

export function requestedProfessionalRole(values: readonly unknown[]): string | undefined {
  return values.map((value) => canonicalizeProfessionalRole(value)).find(Boolean);
}

export function unapprovedRequestedProfessionalRole(
  values: readonly unknown[],
  approvedRoles: readonly CanonicalApprovedProfessionalRole[]
): string | undefined {
  const approved = new Set<string>(approvedRoles);

  return values
    .map((value) => canonicalizeProfessionalRole(value))
    .find((role) => {
      if (!role) return false;
      if (role === "car_salesman" || role === "vehicle_dealer") return true;
      return !approved.has(role);
    });
}

export function isActiveApprovedProfessionalProfile(profile: any): boolean {
  return (
    String(profile?.verificationStatus || "")
      .trim()
      .toLowerCase() === "approved" && profile?.isActive === true
  );
}

export function approvedProfessionalRolesFromProfiles(
  realtorProfile: any,
  carSalesmanProfile: any
): CanonicalApprovedProfessionalRole[] {
  const approvedRoles: CanonicalApprovedProfessionalRole[] = [];
  if (isActiveApprovedProfessionalProfile(realtorProfile)) approvedRoles.push("realtor");
  if (isActiveApprovedProfessionalProfile(carSalesmanProfile)) approvedRoles.push("car_dealer");
  return approvedRoles;
}

type ProfessionalAuthorityUserPatch = Record<string, unknown> & {
  role?: unknown;
  roles?: readonly unknown[];
  activeRole?: unknown;
};

type LockedProfessionalAuthorityContext = {
  currentUser: any;
  approvedProfessionalRoles: CanonicalApprovedProfessionalRole[];
};

export type ProfessionalAuthorityUserUpdateResult =
  | {
      outcome: "updated";
      user: any;
      approvedProfessionalRoles: CanonicalApprovedProfessionalRole[];
    }
  | {
      outcome: "not_found" | "rejected";
      approvedProfessionalRoles: CanonicalApprovedProfessionalRole[];
    }
  | {
      outcome: "professional_approval_required";
      role: string;
      approvedProfessionalRoles: CanonicalApprovedProfessionalRole[];
    };

function normalizeRoleForPersistence(value: unknown, approvedRoles: ReadonlySet<string>): string {
  const professionalRole = canonicalizeProfessionalRole(value);
  if (professionalRole) {
    if (professionalRole === "car_salesman" || professionalRole === "vehicle_dealer") return "";
    return approvedRoles.has(professionalRole) ? professionalRole : "";
  }
  return typeof value === "string" ? value.trim() : "";
}

export function reconcileUserRolePatchWithApprovedProfessionalRoles(input: {
  currentUser: any;
  patch: ProfessionalAuthorityUserPatch;
  approvedProfessionalRoles: readonly CanonicalApprovedProfessionalRole[];
  requestedProfessionalRoleValues?: readonly unknown[];
}):
  | { outcome: "allowed"; patch: ProfessionalAuthorityUserPatch }
  | { outcome: "professional_approval_required"; role: string } {
  const approvedRoles = new Set<string>(input.approvedProfessionalRoles);
  const hasExplicitRoles = Array.isArray(input.patch.roles);
  const requestedValues = [
    ...(input.requestedProfessionalRoleValues || []),
    ...(hasExplicitRoles ? (input.patch.roles as readonly unknown[]) : []),
    ...(Object.prototype.hasOwnProperty.call(input.patch, "role") ? [input.patch.role] : []),
    ...(Object.prototype.hasOwnProperty.call(input.patch, "activeRole")
      ? [input.patch.activeRole]
      : []),
  ];
  const unapprovedRole = unapprovedRequestedProfessionalRole(
    requestedValues,
    input.approvedProfessionalRoles
  );
  if (unapprovedRole) {
    return { outcome: "professional_approval_required", role: unapprovedRole };
  }

  const baseRoles = hasExplicitRoles
    ? (input.patch.roles as readonly unknown[])
    : Array.isArray(input.currentUser?.roles)
      ? input.currentUser.roles
      : [];
  const roles = Array.from(
    new Set(
      [...baseRoles, ...input.approvedProfessionalRoles]
        .map((role) => normalizeRoleForPersistence(role, approvedRoles))
        .filter(Boolean)
    )
  );

  const hasExplicitPrimary = Object.prototype.hasOwnProperty.call(input.patch, "role");
  const hasExplicitActive = Object.prototype.hasOwnProperty.call(input.patch, "activeRole");
  const primaryCandidate = normalizeRoleForPersistence(
    hasExplicitPrimary ? input.patch.role : input.currentUser?.role,
    approvedRoles
  );
  const activeCandidate = normalizeRoleForPersistence(
    hasExplicitActive ? input.patch.activeRole : input.currentUser?.activeRole,
    approvedRoles
  );
  const fallbackRole = roles[0] || "homeowner";
  const role = primaryCandidate || activeCandidate || fallbackRole;
  const activeRole = activeCandidate || role;

  return {
    outcome: "allowed",
    patch: {
      ...input.patch,
      roles: Array.from(new Set([...roles, role, activeRole])),
      role,
      activeRole,
    },
  };
}

export async function updateUserPreservingApprovedProfessionalRoles(input: {
  database: any;
  userId: string;
  requestedProfessionalRoleValues?: readonly unknown[];
  buildPatch: (
    context: LockedProfessionalAuthorityContext
  ) => ProfessionalAuthorityUserPatch | null;
}): Promise<ProfessionalAuthorityUserUpdateResult> {
  return input.database.transaction(async (tx: any) => {
    // Match professional decision lock order: profile authority first, then the user projection.
    const [realtorProfile] = await tx
      .select({
        verificationStatus: realtorProfiles.verificationStatus,
        isActive: realtorProfiles.isActive,
      })
      .from(realtorProfiles)
      .where(eq(realtorProfiles.userId, input.userId))
      .limit(1)
      .for("update");
    const [carSalesmanProfile] = await tx
      .select({
        verificationStatus: carSalesmanProfiles.verificationStatus,
        isActive: carSalesmanProfiles.isActive,
      })
      .from(carSalesmanProfiles)
      .where(eq(carSalesmanProfiles.userId, input.userId))
      .limit(1)
      .for("update");
    const approvedProfessionalRoles = approvedProfessionalRolesFromProfiles(
      realtorProfile,
      carSalesmanProfile
    );

    const [currentUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for("update");
    if (!currentUser) {
      return { outcome: "not_found", approvedProfessionalRoles };
    }

    const proposedPatch = input.buildPatch({ currentUser, approvedProfessionalRoles });
    if (!proposedPatch) {
      return { outcome: "rejected", approvedProfessionalRoles };
    }

    const reconciled = reconcileUserRolePatchWithApprovedProfessionalRoles({
      currentUser,
      patch: proposedPatch,
      approvedProfessionalRoles,
      requestedProfessionalRoleValues: input.requestedProfessionalRoleValues,
    });
    if (reconciled.outcome === "professional_approval_required") {
      return { ...reconciled, approvedProfessionalRoles };
    }

    const [updatedUser] = await tx
      .update(users)
      .set(reconciled.patch)
      .where(eq(users.id, input.userId))
      .returning();

    return { outcome: "updated", user: updatedUser, approvedProfessionalRoles };
  });
}

export function resolvePersistedClientAuthority(
  baseUser: any,
  approvedRoles: readonly CanonicalApprovedProfessionalRole[]
): any {
  if (!baseUser) return baseUser;
  const persistedUser = { ...baseUser };
  delete persistedUser.claims;

  const normalizeAuthorizedPersistedRole = (role: unknown): string => {
    const professionalRole = canonicalizeProfessionalRole(role);
    if (professionalRole) {
      return unapprovedRequestedProfessionalRole([professionalRole], approvedRoles)
        ? ""
        : professionalRole;
    }
    const normalizedRole = normalizeAuthorityRole(role);
    if (!normalizedRole) return "";
    return normalizedRole;
  };

  const roles = Array.from(
    new Set(
      [
        ...(Array.isArray(persistedUser.roles) ? persistedUser.roles : []),
        persistedUser.role,
        persistedUser.activeRole,
        ...approvedRoles,
      ]
        .map((role) => normalizeAuthorizedPersistedRole(role))
        .filter(Boolean)
    )
  );
  const persistedAdminRole = roles.find((role) => isAdminTierRole(role)) || "";
  const resolvedRole =
    normalizeAuthorizedPersistedRole(persistedUser.activeRole) ||
    normalizeAuthorizedPersistedRole(persistedUser.role) ||
    roles[0] ||
    "";
  const effectiveRole = persistedAdminRole || resolvedRole;

  return {
    ...persistedUser,
    role: effectiveRole || undefined,
    activeRole: effectiveRole || undefined,
    roles,
    isAdmin: persistedUser.isAdmin === true || roles.some((role) => isAdminTierRole(role)),
    isSuperAdmin: persistedUser.isSuperAdmin === true || roles.includes("super_admin"),
  };
}
