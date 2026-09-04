import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_MUTATION_CONFIRMATION,
  evaluateAdminRoleMutationAuthority,
  parseAdminRoleMutationRequest,
} from "../services/adminRoleMutationPolicy";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("admin multi-role mutation policy", () => {
  it("denies moderator self-escalation before any role mutation", () => {
    const parsed = parseAdminRoleMutationRequest(["moderator", "super_admin"], "super_admin");
    expect(parsed).toMatchObject({ outcome: "allowed", includesProtectedRole: true });

    expect(
      evaluateAdminRoleMutationAuthority({
        actor: { id: "moderator-1", roles: ["moderator"] },
        actorId: "moderator-1",
        target: { id: "moderator-1", roles: ["moderator"] },
        targetUserId: "moderator-1",
        requestedRoles: ["moderator", "super_admin"],
      })
    ).toMatchObject({ outcome: "denied", code: "ROLE_MUTATION_AUTHORITY_REQUIRED" });
  });

  it("denies ops escalation and stripping of protected targets", () => {
    const ops = { id: "ops-1", roles: ["ops_admin"] };
    expect(
      evaluateAdminRoleMutationAuthority({
        actor: ops,
        actorId: ops.id,
        target: { id: "member-1", roles: ["homeowner"] },
        targetUserId: "member-1",
        requestedRoles: ["homeowner", "super_admin"],
      })
    ).toMatchObject({ outcome: "denied", code: "SUPER_ADMIN_ROLE_ASSIGNMENT_REQUIRED" });

    expect(
      evaluateAdminRoleMutationAuthority({
        actor: ops,
        actorId: ops.id,
        target: { id: "admin-1", roles: ["super_admin"] },
        targetUserId: "admin-1",
        requestedRoles: ["homeowner"],
      })
    ).toMatchObject({ outcome: "denied", code: "SUPER_ADMIN_TARGET_MUTATION_REQUIRED" });
  });

  it("fails closed on every self-target, including super admins", () => {
    expect(
      evaluateAdminRoleMutationAuthority({
        actor: { id: "super-1", roles: ["super_admin"] },
        actorId: "super-1",
        target: { id: "super-1", roles: ["super_admin"] },
        targetUserId: "super-1",
        requestedRoles: ["homeowner"],
      })
    ).toMatchObject({ outcome: "denied", code: "SELF_ROLE_MUTATION_FORBIDDEN" });
  });

  it("allows ops to perform a safe nonprivileged multi-role update", () => {
    const parsed = parseAdminRoleMutationRequest(
      ["homeowner", "contractor", "business_owner"],
      "contractor"
    );
    expect(parsed).toEqual({
      outcome: "allowed",
      roles: ["homeowner", "contractor", "business_owner"],
      activeRole: "contractor",
      includesProtectedRole: false,
    });
    if (parsed.outcome !== "allowed") throw new Error("expected allowed role mutation");

    expect(
      evaluateAdminRoleMutationAuthority({
        actor: { id: "ops-1", roles: ["ops_admin"] },
        actorId: "ops-1",
        target: { id: "member-1", roles: ["homeowner"] },
        targetUserId: "member-1",
        requestedRoles: parsed.roles,
      })
    ).toEqual({ outcome: "allowed", actorIsSuperAdmin: false, targetIsProtected: false });
  });

  it.each(["realtor", "ReAlTor", "car_dealer", "car-dealer", "car salesman"])(
    "keeps professional role variant %s behind verification decisions",
    (role) => {
      expect(parseAdminRoleMutationRequest(["homeowner", role], role)).toMatchObject({
        outcome: "professional_decision_required",
      });
    }
  );

  it("rejects unknown and legacy generic admin tokens outside the exact allowlist", () => {
    expect(parseAdminRoleMutationRequest(["homeowner", "admin"], "admin")).toMatchObject({
      outcome: "invalid",
      code: "ROLE_NOT_ALLOWED",
    });
    expect(parseAdminRoleMutationRequest(["homeowner", "hoa_admin"], "hoa_admin")).toMatchObject({
      outcome: "invalid",
      code: "ROLE_NOT_ALLOWED",
    });
    expect(parseAdminRoleMutationRequest(["homeowner"], "contractor")).toMatchObject({
      outcome: "invalid",
      code: "ACTIVE_ROLE_NOT_ASSIGNED",
    });
  });

  it("rechecks target policy inside the professional profile-to-user lock", () => {
    const adminRoutes = read("server/routes/admin.ts");
    const authorityService = read("server/services/professionalRoleAuthority.ts");
    const start = adminRoutes.indexOf('"/api/admin/users/:userId/roles"');
    const end = adminRoutes.indexOf('"/api/admin/users/:userId/badges"', start);
    const roleRoute = adminRoutes.slice(start, end);

    expect(roleRoute).toContain("const actor = sessionActorId ? await storage.getUser");
    expect(roleRoute).toContain("updateUserPreservingApprovedProfessionalRoles({");
    expect(roleRoute).toContain("buildPatch: ({ currentUser })");
    expect(roleRoute).toContain("target: currentUser");
    expect(roleRoute).toContain("lockedAuthorityDenial = lockedAuthority");
    expect(roleRoute).toContain('outcome: "started"');
    expect(roleRoute).toContain('auditRoleMutation("denied"');
    expect(roleRoute).toContain('auditRoleMutation("completed"');
    expect(roleRoute).toContain("ADMIN_ROLE_MUTATION_CONFIRMATION");
    expect(authorityService.match(/\.for\("update"\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the client on canonical nonprofessional choices and sends audit context", () => {
    const client = read("client/src/components/admin/UserManagement.tsx");

    expect(client).toContain(
      `const ROLE_MUTATION_CONFIRMATION = "${ADMIN_ROLE_MUTATION_CONFIRMATION}"`
    );
    expect(client).toContain("body: { roles, activeRole, reason, confirmPhrase }");
    expect(client).toContain("availableRolesForActor");
    expect(client).toContain("PROFESSIONAL_DECISION_ROLE_VALUES");
    expect(client).toContain("const editableRoles = (user.roles || [user.role]).filter(");
    expect(client).not.toContain('value: "realtor"');
    expect(client).not.toContain('value: "car_salesman"');
    expect(client).not.toContain('value: "contractor_user"');
    expect(client).not.toContain('value: "helper"');
  });
});
