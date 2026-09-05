import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateAdminBusinessImportRequest,
  evaluateAdminBusinessImportTarget,
  evaluateLockedAdminBusinessImportTarget,
  executeImportedOwnerProjectionAtomically,
  REAL_ACCOUNT_IMPORT_CONFIRMATION,
  resolvePostCommitClaimWriteWarning,
} from "../services/adminBusinessOwnerImportPolicy";

const routes = fs
  .readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8")
  .replace(/\r\n/g, "\n");
const projection = fs
  .readFileSync(
    path.resolve(process.cwd(), "server/services/adminBusinessOwnerImportProjection.ts"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");
const adminImportClient = fs
  .readFileSync(path.resolve(process.cwd(), "client/src/pages/admin-business-import.tsx"), "utf8")
  .replace(/\r\n/g, "\n");

describe("admin business real-account import policy", () => {
  it("keeps directory import available to ops but real-account creation super-only and audited", () => {
    const ops = { id: "ops", roles: ["ops_admin"] };
    expect(
      evaluateAdminBusinessImportRequest({
        actor: ops,
        createOwnerAccountsRequested: false,
        confirmation: "",
        reason: null,
      })
    ).toEqual({ outcome: "allowed" });
    expect(
      evaluateAdminBusinessImportRequest({
        actor: ops,
        createOwnerAccountsRequested: true,
        confirmation: REAL_ACCOUNT_IMPORT_CONFIRMATION,
        reason: "Create requested owner accounts.",
      })
    ).toMatchObject({ outcome: "denied", code: "REAL_ACCOUNT_IMPORT_SUPER_ADMIN_REQUIRED" });

    const superAdmin = { id: "super", roles: ["super_admin"] };
    expect(
      evaluateAdminBusinessImportRequest({
        actor: superAdmin,
        createOwnerAccountsRequested: true,
        confirmation: REAL_ACCOUNT_IMPORT_CONFIRMATION,
        reason: null,
      })
    ).toMatchObject({ outcome: "denied", code: "REAL_ACCOUNT_IMPORT_REASON_REQUIRED" });
    expect(
      evaluateAdminBusinessImportRequest({
        actor: superAdmin,
        createOwnerAccountsRequested: true,
        confirmation: REAL_ACCOUNT_IMPORT_CONFIRMATION,
        reason: "Create requested owner accounts.",
      })
    ).toEqual({ outcome: "allowed" });
  });

  it("rejects reserved identities and every protected existing target", () => {
    expect(evaluateAdminBusinessImportTarget({ email: "contact@thetradescout.com" })).toMatchObject(
      { outcome: "denied", code: "REAL_ACCOUNT_IMPORT_RESERVED_IDENTITY" }
    );

    for (const existingUser of [
      { email: "a@example.com", role: "admin" },
      { email: "a@example.com", roles: ["hoa_admin"] },
      { email: "a@example.com", activeRole: "realtor" },
      { email: "a@example.com", roles: ["car_dealer"] },
    ]) {
      expect(
        evaluateAdminBusinessImportTarget({ email: existingUser.email, existingUser })
      ).toMatchObject({ outcome: "denied", code: "REAL_ACCOUNT_IMPORT_TARGET_PROTECTED" });
    }
    expect(
      evaluateAdminBusinessImportTarget({
        email: "a@example.com",
        existingUser: { email: "a@example.com", roles: ["homeowner"] },
        hasProfessionalApplication: true,
      })
    ).toMatchObject({ outcome: "denied", code: "REAL_ACCOUNT_IMPORT_TARGET_PROTECTED" });
  });

  it("fails closed when a locked target changed identity or gained an application", () => {
    expect(
      evaluateLockedAdminBusinessImportTarget({
        inputEmail: "owner@example.com",
        lockedUser: { email: "changed@example.com", roles: ["homeowner"] },
        hasProfessionalApplication: false,
      })
    ).toMatchObject({ outcome: "denied", code: "REAL_ACCOUNT_IMPORT_STALE_IDENTITY" });
    expect(
      evaluateLockedAdminBusinessImportTarget({
        inputEmail: "OWNER@example.com",
        lockedUser: { email: "owner@example.com", roles: ["homeowner"] },
        hasProfessionalApplication: true,
      })
    ).toMatchObject({ outcome: "denied", code: "REAL_ACCOUNT_IMPORT_TARGET_PROTECTED" });
  });

  it("turns unsuccessful and exceptional post-commit claim writes into retry warnings", () => {
    expect(resolvePostCommitClaimWriteWarning({ result: { success: true } })).toBeNull();
    expect(
      resolvePostCommitClaimWriteWarning({
        result: { success: false, error: "claims disabled", reason: "disabled" },
      })
    ).toMatchObject({
      code: "POST_COMMIT_CLAIM_WRITE_FAILED",
      retryRequired: true,
      message: expect.stringContaining("claims disabled"),
    });
    expect(resolvePostCommitClaimWriteWarning({ error: new Error("network down") })).toMatchObject({
      code: "POST_COMMIT_CLAIM_WRITE_FAILED",
      retryRequired: true,
      message: expect.stringContaining("network down"),
    });
  });

  it("mounts real-account projection and its audit inside one row transaction", () => {
    const start = routes.indexOf('"/api/admin/businesses/import"');
    const end = routes.indexOf('// Admin: find "import-created"', start);
    const route = routes.slice(start, end);

    expect(route).toContain("evaluateAdminBusinessImportRequest({");
    expect(route).toContain("evaluateAdminBusinessImportTarget({");
    expect(route).toContain("createImportedOwnerProjectionAtomically");
    expect(routes).toContain(
      'import { createImportedOwnerProjectionAtomically } from "./services/adminBusinessOwnerImportProjection"'
    );
    expect(route).toContain("database: db");
    expect(route).toContain("actorId,");
    expect(projection).toContain("executeImportedOwnerProjectionAtomically({");
    expect(projection).toContain("project: async (tx)");
    expect(projection).toContain("database: tx");
    expect(projection).toContain("insert into public.auth_action_tokens");
    expect(projection.indexOf("insert into public.auth_action_tokens")).toBeLessThan(
      projection.indexOf('action: "admin_business_owner_account_import_target"')
    );
    expect(route).toContain("activation email failed");
    expect(route).toContain("claim write failed");
    expect(route).toContain("const claimResult = await writeClaimEvent({");
    expect(route).toContain("resolvePostCommitClaimWriteWarning({ result: claimResult })");
    expect(route).toContain("postCommitClaimWarnings += 1");
    expect(route).toContain("claimWarning,");
    expect(route).toContain("runBestEffortPrivilegedSummaryAudit({");
    expect(route).toContain("batchAuditWarning");
    expect(route).not.toContain("passwordResetService.createToken(userId)");
    expect(route).not.toContain("emailVerificationService.createToken(userId)");
    expect(route).not.toContain("userRecord = await storage.createUser({");
    expect(route).not.toContain("await storage.createBusinessForOwner(userId");
    expect(route).not.toContain("await storage.saveBusinessProfile({");
  });

  it("revalidates locked email and application authority without reversing professional lock order", () => {
    const realtorLock = projection.indexOf(".from(realtorProfiles)");
    const carLock = projection.indexOf(".from(carSalesmanProfiles)");
    const userLock = projection.indexOf("const lockedUsers");
    const postLockRevalidation = projection.indexOf(
      "// Revalidate identity and application authority after the user"
    );
    const targetCheck = projection.indexOf("evaluateLockedAdminBusinessImportTarget({");

    expect(realtorLock).toBeGreaterThan(-1);
    expect(carLock).toBeGreaterThan(realtorLock);
    expect(userLock).toBeGreaterThan(carLock);
    expect(postLockRevalidation).toBeGreaterThan(userLock);
    expect(targetCheck).toBeGreaterThan(postLockRevalidation);

    const revalidation = projection.slice(postLockRevalidation, targetCheck);
    expect(revalidation).toContain(".from(realtorProfiles)");
    expect(revalidation).toContain(".from(carSalesmanProfiles)");
    expect(revalidation).not.toContain('.for("update")');
    expect(projection.slice(targetCheck)).toContain("inputEmail: input.email");
    expect(projection.slice(targetCheck)).toContain("lockedUser: userRecord");
  });

  it("preserves and counts post-commit warnings across chunked client imports", () => {
    expect(adminImportClient).toContain("...(combined.warnings || [])");
    expect(adminImportClient).toContain("...(res.warnings || [])");
    expect(adminImportClient).toContain("new Set(");
    expect(adminImportClient).toContain("combined.postCommit.claimWriteWarnings +=");
    expect(adminImportClient).toContain("combined.totals.postCommitClaimWarnings =");
    expect(adminImportClient).toContain("res.totals.postCommitClaimWarnings || 0");
  });

  for (const failedStage of ["business", "profile", "token", "audit"] as const) {
    it(`rolls back the imported user and every prior stage when ${failedStage} fails`, async () => {
      const state: string[] = [];
      const database = {
        async transaction<T>(callback: (tx: { write(stage: string): void }) => Promise<T>) {
          const snapshot = [...state];
          try {
            return await callback({ write: (stage) => state.push(stage) });
          } catch (error) {
            state.splice(0, state.length, ...snapshot);
            throw error;
          }
        },
      };

      await expect(
        executeImportedOwnerProjectionAtomically({
          database,
          project: async (tx) => {
            for (const stage of ["user", "business", "profile", "token", "audit"]) {
              tx.write(stage);
              if (stage === failedStage) throw new Error(`${stage} failed`);
            }
            return { ok: true };
          },
        })
      ).rejects.toThrow(`${failedStage} failed`);
      expect(state).toEqual([]);
    });
  }
});
