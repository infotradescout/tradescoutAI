import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFESSIONAL_APPROVAL_REQUIRED_RESPONSE,
  PROFESSIONAL_APPROVAL_REQUIRED_ROLE_VALUES,
  PROFESSIONAL_VERIFICATION_DECISION_REQUIRED_RESPONSE,
  approvedProfessionalRolesFromProfiles,
  canonicalizeProfessionalRole,
  isActiveApprovedProfessionalProfile,
  reconcileUserRolePatchWithApprovedProfessionalRoles,
  requestedProfessionalRole,
  resolvePersistedClientAuthority,
  unapprovedRequestedProfessionalRole,
} from "../services/professionalRoleAuthority";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function section(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `${startMarker} should exist`).toBeGreaterThan(-1);
  expect(end, `${endMarker} should follow ${startMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("professional self-assignment authority", () => {
  it.each(PROFESSIONAL_APPROVAL_REQUIRED_ROLE_VALUES)(
    "classifies %s as application-and-approval only",
    (role) => {
      expect(requestedProfessionalRole(["homeowner", role])).toBe(role);
      expect(requestedProfessionalRole([`  ${role}  `])).toBe(role);
    }
  );

  it("does not broadly classify unrelated or lookalike roles", () => {
    expect(requestedProfessionalRole(["homeowner", "contractor", "realtor_assistant"])).toBe(
      undefined
    );
    expect(PROFESSIONAL_APPROVAL_REQUIRED_RESPONSE).toEqual({
      message: "Realtor and car dealer roles require an approved professional application.",
      code: "PROFESSIONAL_APPROVAL_REQUIRED",
    });
  });

  it.each([
    ["ReAlTor", "realtor"],
    ["car-dealer", "car_dealer"],
    ["car dealer", "car_dealer"],
    ["car salesman", "car_salesman"],
    ["vehicle-dealer", "vehicle_dealer"],
  ])("canonicalizes formatted professional role %s before authority checks", (input, expected) => {
    expect(canonicalizeProfessionalRole(input)).toBe(expected);
    expect(requestedProfessionalRole([input])).toBe(expected);
  });

  it("allows canonical selection only when durable approval has already been established", () => {
    expect(unapprovedRequestedProfessionalRole(["realtor"], [])).toBe("realtor");
    expect(unapprovedRequestedProfessionalRole(["car_dealer"], [])).toBe("car_dealer");
    expect(unapprovedRequestedProfessionalRole(["realtor"], ["realtor"])).toBeUndefined();
    expect(unapprovedRequestedProfessionalRole(["car_dealer"], ["car_dealer"])).toBeUndefined();
  });

  it("rejects legacy aliases even when the corresponding canonical role is approved", () => {
    expect(unapprovedRequestedProfessionalRole(["car_salesman"], ["car_dealer"])).toBe(
      "car_salesman"
    );
    expect(unapprovedRequestedProfessionalRole(["vehicle_dealer"], ["car_dealer"])).toBe(
      "vehicle_dealer"
    );
  });

  it("requires professional approval records to be explicitly active", () => {
    expect(
      isActiveApprovedProfessionalProfile({ verificationStatus: "approved", isActive: true })
    ).toBe(true);
    expect(
      isActiveApprovedProfessionalProfile({ verificationStatus: "approved", isActive: false })
    ).toBe(false);
    expect(isActiveApprovedProfessionalProfile({ verificationStatus: "approved" })).toBe(false);
    expect(
      isActiveApprovedProfessionalProfile({ verificationStatus: "pending", isActive: true })
    ).toBe(false);
    expect(
      approvedProfessionalRolesFromProfiles(
        { verificationStatus: "APPROVED", isActive: true },
        { verificationStatus: "approved", isActive: false }
      )
    ).toEqual(["realtor"]);
  });

  it("preserves durable approvals when a whole-array writer changes nonprofessional roles", () => {
    const reconciled = reconcileUserRolePatchWithApprovedProfessionalRoles({
      currentUser: {
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "realtor", "car_dealer"],
      },
      patch: { role: "homeowner", activeRole: "homeowner", roles: ["homeowner"] },
      approvedProfessionalRoles: ["realtor", "car_dealer"],
    });

    expect(reconciled).toEqual({
      outcome: "allowed",
      patch: {
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "realtor", "car_dealer"],
      },
    });
  });

  it("canonicalizes approved selections and strips stale or legacy professional projections", () => {
    const approved = reconcileUserRolePatchWithApprovedProfessionalRoles({
      currentUser: { role: "homeowner", activeRole: "homeowner", roles: ["homeowner"] },
      patch: { role: "homeowner", activeRole: "ReAlTor", roles: ["homeowner", "ReAlTor"] },
      approvedProfessionalRoles: ["realtor"],
      requestedProfessionalRoleValues: ["ReAlTor"],
    });
    expect(approved).toEqual({
      outcome: "allowed",
      patch: {
        role: "homeowner",
        activeRole: "realtor",
        roles: ["homeowner", "realtor"],
      },
    });

    const stale = reconcileUserRolePatchWithApprovedProfessionalRoles({
      currentUser: {
        role: "realtor",
        activeRole: "car_salesman",
        roles: ["homeowner", "realtor", "car_salesman"],
      },
      patch: { activeRole: "homeowner" },
      approvedProfessionalRoles: [],
    });
    expect(stale).toEqual({
      outcome: "allowed",
      patch: { activeRole: "homeowner", roles: ["homeowner"], role: "homeowner" },
    });
  });

  it("rejects unapproved formatted aliases before reconciling a role patch", () => {
    for (const role of ["ReAlTor", "car-dealer", "car salesman"]) {
      expect(
        reconcileUserRolePatchWithApprovedProfessionalRoles({
          currentUser: { role: "homeowner", activeRole: "homeowner", roles: ["homeowner"] },
          patch: { roles: ["homeowner"] },
          approvedProfessionalRoles: [],
          requestedProfessionalRoleValues: [role],
        })
      ).toMatchObject({ outcome: "professional_approval_required" });
    }
  });

  it("derives approved-role selection authority from durable profile decisions", () => {
    const routes = read("server/routes.ts");
    const loader = section(
      routes,
      "const loadApprovedProfessionalRoles = async",
      "type AuthMethod ="
    );

    expect(loader).toContain("storage.getRealtorProfileByUserId(userId)");
    expect(loader).toContain("storage.getCarSalesmanProfileByUserId(userId)");
    expect(loader).toContain(
      "approvedProfessionalRolesFromProfiles(realtorProfile, carSalesmanProfile)"
    );
    expect(loader).not.toContain("user.role");
    expect(loader).not.toContain("user.roles");
  });

  it("locks professional authority before atomically reconciling any user role projection", () => {
    const authorityService = read("server/services/professionalRoleAuthority.ts");
    const mutation = section(
      authorityService,
      "export async function updateUserPreservingApprovedProfessionalRoles",
      "export function resolvePersistedClientAuthority"
    );

    expect(mutation).toContain("input.database.transaction(async (tx: any) =>");
    expect(mutation.match(/\.for\("update"\)/g)).toHaveLength(3);
    expect(mutation.indexOf(".from(realtorProfiles)")).toBeLessThan(
      mutation.indexOf(".from(carSalesmanProfiles)")
    );
    expect(mutation.indexOf(".from(carSalesmanProfiles)")).toBeLessThan(
      mutation.indexOf(".from(users)")
    );
    expect(mutation.indexOf("reconcileUserRolePatchWithApprovedProfessionalRoles")).toBeLessThan(
      mutation.indexOf(".update(users)")
    );
  });

  it("uses only persisted roles and durable approvals for client-visible authority", () => {
    const routes = read("server/routes.ts");
    const authUser = section(
      routes,
      'app.get("/api/auth/user"',
      'app.get("/api/auth/setup-status"'
    );
    const mergeAuthority = section(
      authUser,
      "const approvedProfessionalRolesForAuth = await loadApprovedProfessionalRoles(userId);",
      "// Resolve the current super admin support account"
    );

    expect(mergeAuthority).toContain(
      "resolvePersistedClientAuthority(baseUser, approvedProfessionalRolesForAuth)"
    );
    expect(mergeAuthority).not.toContain("authUser");
    expect(mergeAuthority).not.toContain("authClaims");
    expect(mergeAuthority).not.toContain("claimsRolesRaw");
    expect(authUser).not.toContain("role: sessionAny.impersonatingRole");
    expect(authUser).toContain("originalRole: baseUser?.role");
  });

  it("ignores forged claim authority while filtering stale professional roles", () => {
    const resolved = resolvePersistedClientAuthority(
      {
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "realtor", "car_dealer"],
        isAdmin: false,
        isSuperAdmin: false,
        claims: {
          role: "super_admin",
          activeRole: "ops_admin",
          roles: ["super_admin", "realtor", "car_dealer"],
          isAdmin: true,
          isSuperAdmin: true,
        },
      },
      []
    );

    expect(resolved.role).toBe("homeowner");
    expect(resolved.activeRole).toBe("homeowner");
    expect(resolved.roles).toEqual(["homeowner"]);
    expect(resolved.isAdmin).toBe(false);
    expect(resolved.isSuperAdmin).toBe(false);
    expect(resolved).not.toHaveProperty("claims");
  });

  it("surfaces persisted admin authority and only approved professional roles", () => {
    const resolved = resolvePersistedClientAuthority(
      {
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner", "ops_admin", "realtor", "car_salesman"],
        isAdmin: false,
        isSuperAdmin: false,
      },
      ["realtor", "car_dealer"]
    );

    expect(resolved.role).toBe("ops_admin");
    expect(resolved.activeRole).toBe("ops_admin");
    expect(resolved.roles).toEqual(["homeowner", "ops_admin", "realtor", "car_dealer"]);
    expect(resolved.isAdmin).toBe(true);
    expect(resolved.isSuperAdmin).toBe(false);
  });

  it("rejects approval-only roles at public registration before account creation", () => {
    const routes = read("server/routes.ts");
    const registration = section(
      routes,
      "const handleRegister = async",
      "// Backward compatibility: allow both /auth/register"
    );
    const guard = registration.indexOf("if (requestedProfessionalRole(userTypesInput))");

    expect(guard).toBeGreaterThan(registration.indexOf("const userTypesInput ="));
    expect(guard).toBeLessThan(registration.indexOf("const userTypes = userTypesInput"));
    expect(guard).toBeLessThan(registration.indexOf("await storage.createUser"));
    expect(registration).toContain("return sendProfessionalApprovalRequired(res);");
  });

  it("atomically rejects approval-only roles at /api/user/roles and preserves grants", () => {
    const routes = read("server/routes.ts");
    const roleUpdate = section(
      routes,
      'app.patch("/api/user/roles"',
      "// Update user types (business/account personas)"
    );

    expect(roleUpdate).toContain("updateUserPreservingApprovedProfessionalRoles({");
    expect(roleUpdate).toContain("requestedProfessionalRoleValues: normalizedRoles");
    expect(roleUpdate).toContain("canonicalizeProfessionalRole(role) || role");
    expect(roleUpdate).not.toContain("await storage.updateUser");
    expect(roleUpdate).toContain("approvedProfessionalRoles.includes(");
    expect(roleUpdate).toContain("isPrivilegedOrAdminRoleToken(role)");
    expect(roleUpdate).toContain("sendPrivilegedRoleAssignmentForbidden(res)");
    expect(roleUpdate).not.toContain('"hoa_admin",');
  });

  it("atomically rejects approval-only roles at /api/user/user-types and preserves grants", () => {
    const routes = read("server/routes.ts");
    const typeUpdate = section(
      routes,
      'app.patch("/api/user/user-types"',
      "// Back-compat aliases used by onboarding UI"
    );

    expect(typeUpdate).toContain("updateUserPreservingApprovedProfessionalRoles({");
    expect(typeUpdate).toContain("requestedProfessionalRoleValues: rawTypes");
    expect(typeUpdate).toContain("canonicalizeProfessionalRole(typeId) || normalizeRole(typeId)");
    expect(typeUpdate).not.toContain("await storage.updateUser");
    expect(typeUpdate).toContain("approvedProfessionalRoles.includes(");
    expect(typeUpdate).toContain("isPrivilegedOrAdminRoleToken(role)");
    expect(typeUpdate).toContain("sendPrivilegedRoleAssignmentForbidden(res)");
  });

  it("requires durable approval before setup-profile can assign a professional role", () => {
    const routes = read("server/routes.ts");
    const setupProfile = section(
      routes,
      'app.post("/api/auth/setup-profile"',
      "registerPublicHeatmapRoutes(app, { storage });"
    );

    expect(setupProfile).toContain(
      "const requestedApprovalRole = requestedProfessionalRole([role])"
    );
    expect(setupProfile).toContain("updateUserPreservingApprovedProfessionalRoles({");
    expect(setupProfile).toContain("requestedProfessionalRoleValues: [role]");
    expect(setupProfile).not.toContain("await storage.updateUser");
    expect(setupProfile.indexOf('normalizedRole === "contractor" &&')).toBeLessThan(
      setupProfile.indexOf("updateUserPreservingApprovedProfessionalRoles({")
    );
    expect(
      setupProfile.indexOf('message: "Business name is required for contractor profiles"')
    ).toBeLessThan(setupProfile.indexOf("updateUserPreservingApprovedProfessionalRoles({"));
    expect(setupProfile).toContain("withAdvisoryLock(`setup-profile:${String(userId)}`");
    expect(setupProfile).toContain("setupProjectionKey: projectionKey");
    expect(setupProfile.indexOf("storage.listBusinessesByOwner")).toBeLessThan(
      setupProfile.indexOf("storage.createBusinessForOwner")
    );
    expect(setupProfile.indexOf("storage.getContractorByUserId")).toBeLessThan(
      setupProfile.indexOf("storage.createContractor")
    );
    expect(setupProfile.indexOf("storage.listProfilesByOwner")).toBeLessThan(
      setupProfile.indexOf("storage.createProfileForOwner")
    );
    expect(setupProfile).toContain('code: "PROFILE_SETUP_IN_PROGRESS"');
    expect(setupProfile).toContain('code: "PROFILE_SETUP_RETRYABLE"');
  });

  it("preserves approved professional projections in legacy onboarding and import writers", () => {
    const routes = read("server/routes.ts");
    const projection = read("server/services/adminBusinessOwnerImportProjection.ts");
    const authCompletion = section(
      routes,
      'app.post(\n    "/api/auth/complete-onboarding"',
      'app.post("/api/auth/skip-onboarding"'
    );
    const userCompletion = section(
      routes,
      'app.post(\n    "/api/user/complete-onboarding"',
      "// PHASE 3d-A: AI inference for Scout claim suggestion"
    );
    const existingImportWriter = projection;

    for (const writer of [authCompletion, userCompletion]) {
      expect(writer).toContain("updateUserPreservingApprovedProfessionalRoles({");
    }
    expect(existingImportWriter).toContain("executeImportedOwnerProjectionAtomically({");
    expect(existingImportWriter).toContain("project: async (tx)");
    expect(existingImportWriter).toContain("reconcileUserRolePatchWithApprovedProfessionalRoles({");
    expect(existingImportWriter).toContain("approvedProfessionalRolesFromProfiles(");
    expect(existingImportWriter).toContain('.for("update")');
    expect(authCompletion).not.toContain("await storage.updateUser");
    expect(userCompletion).not.toContain("await storage.updateUser");
    expect(existingImportWriter).not.toContain("storage.updateUser");
  });

  it("requires both an assigned role and durable approval before switching professional roles", () => {
    const routes = read("server/routes.ts");
    const switchRole = section(
      routes,
      'app.post("/api/auth/switch-role"',
      "// 1b. CORS DIAGNOSTICS"
    );

    expect(switchRole).toContain("const requestedApprovalRole = requestedProfessionalRole([role])");
    expect(switchRole).toContain("updateUserPreservingApprovedProfessionalRoles({");
    expect(switchRole).toContain("requestedProfessionalRoleValues: [role]");
    expect(switchRole).toContain("...approvedProfessionalRoles,");
    expect(switchRole).not.toContain(".update(users)");
  });

  it("rejects professional grants in both generic root admin role writers", () => {
    const routes = read("server/routes.ts");
    const quickControls = read("server/routes/admin-user-controls.ts");
    const adminRole = section(
      routes,
      'app.put("/api/admin/users/:userId/role"',
      'app.delete("/api/admin/users/:userId"'
    );
    const quickRole = section(
      quickControls,
      'app.post("/api/admin/user-controls/role/:userId"',
      "\n}"
    );

    for (const writer of [adminRole, quickRole]) {
      expect(writer).toContain("if (requestedProfessionalRole([");
      expect(writer).toContain("return sendProfessionalVerificationDecisionRequired(res);");
    }
    expect(
      adminRole.indexOf("return sendProfessionalVerificationDecisionRequired(res);")
    ).toBeLessThan(adminRole.indexOf("await storage.updateUser"));
    expect(
      quickRole.indexOf("return sendProfessionalVerificationDecisionRequired(res);")
    ).toBeLessThan(quickRole.indexOf("mutateUserThroughLockedQuickControl({"));
    expect(quickRole).not.toMatch(/^\s*"realtor",\s*$/m);
    expect(quickRole).not.toMatch(/^\s*"car_dealer",\s*$/m);
  });

  it("rejects professional grants in the multi-role admin writer", () => {
    const adminRoutes = read("server/routes/admin.ts");
    const roleWriter = section(
      adminRoutes,
      '"/api/admin/users/:userId/roles"',
      '"/api/admin/users/:userId/badges"'
    );

    expect(roleWriter).toContain("parseAdminRoleMutationRequest(roles, activeRole)");
    expect(roleWriter).toContain("PROFESSIONAL_VERIFICATION_DECISION_REQUIRED_RESPONSE");
    expect(roleWriter.indexOf("parseAdminRoleMutationRequest(roles, activeRole)")).toBeLessThan(
      roleWriter.indexOf("updateUserPreservingApprovedProfessionalRoles({")
    );
    expect(roleWriter).toContain("...parsedMutation.roles,");
    expect(roleWriter).toContain("parsedMutation.activeRole,");
    expect(PROFESSIONAL_VERIFICATION_DECISION_REQUIRED_RESPONSE.verificationEndpoints).toEqual([
      "/api/admin/realtor/verify/:profileId",
      "/api/admin/car-salesman/verify/:profileId",
    ]);
  });

  it("keeps role grants behind the authenticated admin approval decision", () => {
    const professionalRoutes = read("server/routes/professional-network.ts");
    const storage = read("server/storage/repositories/professional-applications.ts");
    const realtorApproval = section(
      professionalRoutes,
      '"/api/admin/realtor/verify/:profileId"',
      '"/api/admin/car-salesman/verify/:profileId"'
    );
    const carApprovalStart = professionalRoutes.indexOf(
      '"/api/admin/car-salesman/verify/:profileId"'
    );
    const carApproval = professionalRoutes.slice(carApprovalStart);
    const decisionPersistence = section(
      storage,
      "async function decide<TProfile extends ProfessionalProfile>",
      "\n  const realtorConfig"
    );

    expect(realtorApproval).toContain("isAuthenticated");
    expect(realtorApproval).toContain("isAdmin");
    expect(realtorApproval).toContain("await storage.decideRealtorApplication({");
    expect(carApproval).toContain("isAuthenticated");
    expect(carApproval).toContain("isAdmin");
    expect(carApproval).toContain("await storage.decideCarSalesmanApplication({");
    expect(decisionPersistence).toContain("return database.transaction(async (tx: any) =>");
    expect(decisionPersistence.indexOf(".from(realtorProfiles)")).toBeLessThan(
      decisionPersistence.indexOf(".from(carSalesmanProfiles)")
    );
    expect(decisionPersistence.indexOf(".from(carSalesmanProfiles)")).toBeLessThan(
      decisionPersistence.indexOf(".from(users)")
    );
    expect(decisionPersistence).toContain("const targetWillBeApproved = decision.approved");
    expect(decisionPersistence).toContain(
      'lockedRealtorProfile?.verificationStatus === "approved"'
    );
    expect(decisionPersistence).toContain(
      'lockedCarSalesmanProfile?.verificationStatus === "approved"'
    );
    expect(decisionPersistence).toContain('approvedProfessionalRoles.add("realtor")');
    expect(decisionPersistence).toContain('approvedProfessionalRoles.add("car_dealer")');
    expect(decisionPersistence).toContain("roleIsDurablyAuthorized");
    expect(decisionPersistence).toContain("verificationStatus: decision.approved");
    expect(decisionPersistence).toContain("reviewedBy: decision.reviewedBy");
    expect(decisionPersistence).toContain("await tx.update(users).set(userUpdates)");
  });
});
