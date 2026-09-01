import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("admin provisioning contract guards", () => {
  const readRouteSources = () =>
    [read("server/routes.ts"), read("server/routes/worker-tasks.ts")].join("\n");

  it("provision route keeps activation/verification email toggles", () => {
    const routesSource = readRouteSources();

    expect(routesSource).toContain("/api/admin/users/provision");
    expect(routesSource).toContain("sendActivationEmail");
    expect(routesSource).toContain("sendVerificationEmail");
    expect(routesSource).toContain("activationLinkIncluded");
    expect(routesSource).toContain("verifyLinkIncluded");
  });

  it("admin provisioning UI sends expected payload keys", () => {
    const adminProvisioningSource = read("client/src/pages/admin-provisioning.tsx");

    expect(adminProvisioningSource).toContain("sendEmail");
    expect(adminProvisioningSource).toContain("sendActivationEmail");
    expect(adminProvisioningSource).toContain("sendVerificationEmail");
    expect(adminProvisioningSource).toContain("verifyLink");
  });

  it("support provisioning UI keeps profile creation payload", () => {
    const adminProvisionUserSource = read("client/src/pages/admin-provision-user.tsx");

    expect(adminProvisionUserSource).toContain("profile:");
    expect(adminProvisionUserSource).toContain("create: true");
    expect(adminProvisionUserSource).toContain("createBusinessRecord");
    expect(adminProvisionUserSource).toContain("profileAbout");
    expect(adminProvisionUserSource).toContain("businessWebsite");
    expect(adminProvisionUserSource).toContain("provisionUserTypes");
    expect(adminProvisionUserSource).toContain("businessTags");
    expect(adminProvisionUserSource).toContain("SelectTrigger");
    expect(adminProvisionUserSource).toContain(
      'className="w-full sm:w-auto bg-ts-orange hover:bg-ts-orange-dark"'
    );
  });

  it("provision route persists extended contact/location payload", () => {
    const routesSource = readRouteSources();

    expect(routesSource).toContain("const stateCodeRaw");
    expect(routesSource).toContain("countyFips must be 5 characters");
    expect(routesSource).toContain("profile.about must be 5000 characters or fewer");
    expect(routesSource).toContain("contentBlocks: profileAbout");
    expect(routesSource).toContain("provisionUserTypes");
    expect(routesSource).toContain("services: businessTags.length > 0 ? businessTags : undefined");
  });

  it("keeps professional role grants out of generic admin provisioning", () => {
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const start = workerRoutes.indexOf('app.post("/api/admin/users/provision"');
    const end = workerRoutes.indexOf("Error provisioning user:", start);
    const provisionRoute = workerRoutes.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(provisionRoute).toContain("requestedProfessionalRole");
    expect(provisionRoute).toContain("PROFESSIONAL_APPROVAL_REQUIRED_RESPONSE");
    expect(provisionRoute).toContain("role, profileRoleContext, ...rawProvisionUserTypes");

    const guard = provisionRoute.indexOf("if (requestedProvisionProfessionalRole)");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(provisionRoute.indexOf("executeAdminProvisioningAtomically"));
    expect(provisionRoute).not.toContain("storage.createUser");
    expect(provisionRoute).not.toContain("storage.updateUser(user.id, patch)");
    expect(provisionRoute).not.toContain("createProfileForOwner");
  });

  it("requires ops-level authority, bounded reason, and audited provisioning", () => {
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const start = workerRoutes.indexOf('app.post("/api/admin/users/provision"');
    const end = workerRoutes.indexOf("Error provisioning user:", start);
    const provisionRoute = workerRoutes.slice(start, end);

    expect(provisionRoute).toContain(
      'actorHasPrivilegedCapability(actor, ["ops_admin", "super_admin"])'
    );
    expect(provisionRoute).toContain("await storage.getUser(sessionActorId)");
    expect(provisionRoute).toContain(
      "normalizePrivilegedReason(body?.adminSafety?.reason ?? body?.reason, 12, 500)"
    );
    expect(provisionRoute).toContain('action: "admin_user_provision"');
    expect(provisionRoute).toContain('outcome: "denied"');
    expect(provisionRoute).toContain('"completed"');
    expect(provisionRoute).not.toContain(
      'app.post("/api/admin/users/provision", isAuthenticated, isAdmin'
    );
  });

  it("rejects privileged role tokens and protected or reserved targets before side effects", () => {
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const start = workerRoutes.indexOf('app.post("/api/admin/users/provision"');
    const end = workerRoutes.indexOf("Error provisioning user:", start);
    const provisionRoute = workerRoutes.slice(start, end);
    const privilegedGuard = provisionRoute.indexOf("requestedPrivilegedProvisionRole");
    const transaction = provisionRoute.indexOf("executeAdminProvisioningAtomically");
    const tradeTagWrite = provisionRoute.indexOf(".insert(trades)", transaction);

    expect(provisionRoute).toContain("isPrivilegedOrAdminRoleToken");
    expect(provisionRoute).toContain("PRIVILEGED_ROLE_PROVISIONING_FORBIDDEN");
    expect(provisionRoute).toContain("isReservedSignupIdentityEmail(email)");
    expect(provisionRoute).toContain("PROTECTED_PROVISION_TARGET");
    expect(privilegedGuard).toBeGreaterThan(-1);
    expect(privilegedGuard).toBeLessThan(transaction);
    expect(transaction).toBeLessThan(tradeTagWrite);
  });

  it("never overwrites an existing password during provisioning", () => {
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const start = workerRoutes.indexOf('app.post("/api/admin/users/provision"');
    const end = workerRoutes.indexOf("Error provisioning user:", start);
    const provisionRoute = workerRoutes.slice(start, end);
    const validationStart = provisionRoute.indexOf("validate: async (tx: any)");
    const mutationStart = provisionRoute.indexOf("mutate: async (tx: any", validationStart);
    expect(provisionRoute.indexOf("EXISTING_PASSWORD_IMMUTABLE")).toBeGreaterThan(validationStart);
    expect(provisionRoute.indexOf("EXISTING_PASSWORD_IMMUTABLE")).toBeLessThan(mutationStart);
    expect(provisionRoute).not.toContain("patch.password =");
  });

  it("locks existing-user role and preference projection during provisioning", () => {
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const start = workerRoutes.indexOf('app.post("/api/admin/users/provision"');
    const end = workerRoutes.indexOf("Error provisioning user:", start);
    const provisionRoute = workerRoutes.slice(start, end);
    const validationStart = provisionRoute.indexOf("validate: async (tx: any)");
    const mutationStart = provisionRoute.indexOf("mutate: async (tx: any", validationStart);
    const existingValidation = provisionRoute.slice(validationStart, mutationStart);

    expect(existingValidation).toContain('.for("update")');
    expect(existingValidation).toContain("currentUser.preferences");
    expect(existingValidation).toContain("currentUser.roles");
    expect(existingValidation).toContain("reconcileUserRolePatchWithApprovedProfessionalRoles");
    expect(existingValidation).toContain(
      "requestedProfessionalRoleValues: [resolvedProvisionRole]"
    );
    expect(existingValidation).toContain("isPrivilegedOrAdminRoleToken(targetRole)");
    expect(provisionRoute).not.toContain("storage.updateUser(user.id, patch)");
  });

  it("commits user, declaration, business, profile, and tokens in one validation-first transaction", () => {
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const start = workerRoutes.indexOf('app.post("/api/admin/users/provision"');
    const end = workerRoutes.indexOf("Error provisioning user:", start);
    const provisionRoute = workerRoutes.slice(start, end);
    const transactionStart = provisionRoute.indexOf("executeAdminProvisioningAtomically({");
    const validationStart = provisionRoute.indexOf("validate: async (tx: any)", transactionStart);
    const mutationStart = provisionRoute.indexOf("mutate: async (tx: any", validationStart);
    const afterCommitStart = provisionRoute.indexOf("afterCommit: async", mutationStart);
    const validation = provisionRoute.slice(validationStart, mutationStart);
    const mutation = provisionRoute.slice(mutationStart, afterCommitStart);
    const afterCommit = provisionRoute.slice(afterCommitStart);

    expect(transactionStart).toBeGreaterThan(-1);
    expect(validationStart).toBeLessThan(mutationStart);
    expect(mutationStart).toBeLessThan(afterCommitStart);
    expect(validation).toContain("buildComputedProviderEligibilities");
    expect(validation).toContain("ELIGIBILITY_REQUIRED");
    expect(validation).not.toContain(".insert(users)");
    expect(validation).not.toContain(".update(users)");
    expect(mutation).toContain(".insert(users)");
    expect(mutation).toContain(".update(users)");
    expect(mutation).toContain(".insert(providerDeclarations)");
    expect(mutation).toContain(".insert(businesses)");
    expect(mutation).toContain(".insert(profiles)");
    expect(mutation).toContain("createProvisioningPasswordResetToken(tx, user.id)");
    expect(mutation).toContain("createProvisioningEmailVerificationToken(tx, user.id)");
    expect(mutation).toContain('auditProvisionAttempt(\n              "completed"');
    expect(mutation).toContain("user.id,\n              tx");
    expect(provisionRoute).not.toContain("passwordResetService.createToken");
    expect(provisionRoute).not.toContain("emailVerificationService.createToken");
    expect(afterCommit).toContain("emailService.sendEmail");
    expect(afterCommit).not.toContain('auditProvisionAttempt(\n        "completed"');
  });

  it("keeps the admin-account creator narrow, audited, and outside professional grants", () => {
    const routes = read("server/routes.ts");
    const start = routes.indexOf('"/api/admin/create-account"');
    const end = routes.indexOf("// OAuth strategies are configured", start);
    const createAdminRoute = routes.slice(start, end);
    const client = read("client/src/pages/admin-create-account.tsx");

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(createAdminRoute).toContain('actorHasPrivilegedCapability(actor, ["super_admin"])');
    expect(createAdminRoute).toContain(
      "normalizePrivilegedReason(\n          (req.body as any)?.reason"
    );
    expect(createAdminRoute).toContain('new Set(["moderator", "ops_admin", "super_admin"])');
    expect(createAdminRoute).toContain("requestedProfessionalRole([role])");
    expect(createAdminRoute).toContain("sendProfessionalVerificationDecisionRequired(res)");
    expect(createAdminRoute).toContain("isReservedSignupIdentityEmail(email)");
    expect(createAdminRoute).toContain('action: "admin_account_create"');
    expect(createAdminRoute).toContain('outcome: "started"');
    expect(createAdminRoute).toContain('outcome: "completed"');
    expect(createAdminRoute).toContain("roles: [requestedRole]");
    expect(createAdminRoute).toContain("activeRole: requestedRole");
    expect(createAdminRoute.indexOf("allowedAdminCreationRoles.has(requestedRole)")).toBeLessThan(
      createAdminRoute.indexOf("storage.createUser")
    );

    expect(client).toContain("isSuperAdminLike");
    expect(client).toContain("reason: z.string().trim().min(12");
    expect(client).toContain('{...form.register("reason")}');
    expect(client).toContain("Password must be at least 12 characters");
    expect(client).not.toContain('user?.role === "ops_admin" || user?.role === "super_admin"');
  });

  it("provisioning clients supply the required audit reason", () => {
    for (const clientFile of [
      "client/src/pages/admin-provisioning.tsx",
      "client/src/pages/admin-provision-user.tsx",
      "client/src/components/admin/UserManagement.tsx",
    ]) {
      const source = read(clientFile);
      expect(source).toContain("adminSafety");
      expect(source).toContain("reason");
    }
  });

  it("provision and support edit wire trade tags into routing declarations", () => {
    const routesSource = readRouteSources();
    const adminProvisionUserSource = read("client/src/pages/admin-provision-user.tsx");

    expect(routesSource).toContain("const rawProvisionTradeTags");
    expect(routesSource).toContain("normalizedTradeInputs");
    expect(routesSource).toContain(".insert(trades)");
    expect(routesSource).toContain("resolvedTradeTags: validated.resolvedTradeSlugs");
    expect(routesSource).toContain("upsertProviderDeclarationForUser");
    expect(routesSource).toContain("const rawSupportTradeTags");
    expect(routesSource).toContain("const supportTradeTagsProvided");
    expect(routesSource).toContain("resolveOrCreateTradeTagSlugs(supportTradeTags)");
    expect(routesSource).toContain("safePrefs[key] = resolvedSupportTradeTags?.slugs || []");
    expect(routesSource).toContain("let mergedTradeIds = Array.from");
    expect(adminProvisionUserSource).toContain(
      "tradeTags: normalizedTradeTags.length > 0 ? normalizedTradeTags : undefined"
    );
    expect(adminProvisionUserSource).toContain("patch.tradeTags = normalizedEditTradeTags");
    expect(adminProvisionUserSource).toContain(
      "Trade tags for routing (comma separated, optional)"
    );
    expect(adminProvisionUserSource).toContain("Resolved trade tags:");
  });

  it("bulk import keeps optional public profile toggle", () => {
    const adminImportSource = read("client/src/pages/admin-business-import.tsx");
    const routesSource = read("server/routes.ts");

    expect(adminImportSource).toContain("createPublicProfiles");
    expect(routesSource).toContain("createPublicProfiles");
    expect(routesSource).toContain("createdPublicProfiles");
  });
});
