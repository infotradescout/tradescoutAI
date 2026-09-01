import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAdminQuickUserControl } from "../services/adminQuickUserControlPolicy";
import { reconcileUserRolePatchWithApprovedProfessionalRoles } from "../services/professionalRoleAuthority";

const routes = fs
  .readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8")
  .replace(/\r\n/g, "\n");

describe("admin quick user-control authority", () => {
  it("denies moderator, self-target, and ops mutations of every protected target shape", () => {
    expect(
      evaluateAdminQuickUserControl({
        actor: { id: "moderator", roles: ["moderator"] },
        actorId: "moderator",
        target: { id: "member", roles: ["homeowner"] },
        targetUserId: "member",
      })
    ).toMatchObject({ outcome: "denied", code: "QUICK_CONTROL_AUTHORITY_REQUIRED" });

    expect(
      evaluateAdminQuickUserControl({
        actor: { id: "super", roles: ["super_admin"] },
        actorId: "super",
        target: { id: "super", roles: ["super_admin"] },
        targetUserId: "super",
      })
    ).toMatchObject({ outcome: "denied", code: "SELF_QUICK_CONTROL_FORBIDDEN" });

    for (const target of [
      { id: "protected", role: "admin" },
      { id: "protected", roles: ["hoa_admin"] },
      { id: "protected", activeRole: "super_admin" },
      { id: "protected", email: "contact@thetradescout.com", roles: ["homeowner"] },
    ]) {
      expect(
        evaluateAdminQuickUserControl({
          actor: { id: "ops", roles: ["ops_admin"] },
          actorId: "ops",
          target,
          targetUserId: "protected",
        })
      ).toMatchObject({ outcome: "denied", code: "SUPER_ADMIN_TARGET_REQUIRED" });
    }
  });

  it("allows ops on an ordinary target but never lets ops assign protected authority", () => {
    expect(
      evaluateAdminQuickUserControl({
        actor: { id: "ops", roles: ["ops_admin"] },
        actorId: "ops",
        target: { id: "member", roles: ["homeowner"] },
        targetUserId: "member",
      })
    ).toEqual({ outcome: "allowed", actorIsSuperAdmin: false, targetIsProtected: false });

    expect(
      evaluateAdminQuickUserControl({
        actor: { id: "ops", roles: ["ops_admin"] },
        actorId: "ops",
        target: { id: "member", roles: ["homeowner"] },
        targetUserId: "member",
        requestedRoles: ["super_admin"],
      })
    ).toMatchObject({ outcome: "denied", code: "SUPER_ADMIN_ASSIGNMENT_REQUIRED" });
  });

  it("replaces removable authority on demotion while retaining only approved professional roles", () => {
    const result = reconcileUserRolePatchWithApprovedProfessionalRoles({
      currentUser: {
        role: "super_admin",
        activeRole: "super_admin",
        roles: ["homeowner", "ops_admin", "super_admin", "realtor"],
      },
      patch: {
        roles: ["homeowner"],
        role: "homeowner",
        activeRole: "homeowner",
      },
      approvedProfessionalRoles: ["realtor"],
    });

    expect(result).toEqual({
      outcome: "allowed",
      patch: {
        roles: ["homeowner", "realtor"],
        role: "homeowner",
        activeRole: "homeowner",
      },
    });
  });

  it("mounts every shipped quick control through one locked transactional helper", () => {
    const start = routes.indexOf("type LockedQuickControlResult");
    const end = routes.indexOf("registerQuoteCalculatorRoutes", start);
    const section = routes.slice(start, end);

    expect(section).toContain("const mutateUserThroughLockedQuickControl");
    expect(section).toContain("db.transaction(async (tx)");
    expect(section).toContain('.for("update")');
    expect(section).toContain("evaluateAdminQuickUserControl({");
    expect(section).toContain("auditPrivilegedAction({");
    expect(section).toContain("database: tx");
    expect(section).toContain("roles: [parsedRole.activeRole]");
    expect(section).toContain("activeRole: parsedRole.activeRole");
    expect(section).not.toContain("await storage.updateUser(userId");
    expect(section).not.toContain("await storage.getUser(userId)");
  });
});
