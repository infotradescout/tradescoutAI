import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { counties } from "@shared/schema";
import { executeAssistantAction } from "../assistantActions";
import { clearAdminAuditLog, getAdminAuditLog } from "../services/adminAuditLogService";
import { createAuthedAgent, createUserOnly } from "./helpers/testAuth";

const hasTestDb =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.RUN_INTEGRATION_TESTS === "true";

const describeDb = hasTestDb ? describe : describe.skip;

async function getCountyFixture() {
  const [county] = await db
    .select({
      fips: counties.fips,
      stateCode: counties.stateCode,
      name: counties.name,
    })
    .from(counties)
    .limit(1);

  if (!county) {
    throw new Error("Phase 2C integration tests require at least one seeded county record");
  }

  return county;
}

describeDb("Phase 2C privileged path hardening", () => {
  beforeEach(async () => {
    await clearAdminAuditLog();
  });

  it("support-edit rejects email-only targeting and records a denied audit", async () => {
    const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
    const targetUser = await createUserOnly({ role: "contractor" });

    const response = await adminAgent.post("/api/admin/users/support-edit").send({
      targetEmail: targetUser.email,
      patch: { firstName: "Updated" },
      adminSafety: {
        reason: "Need to correct a contractor profile field safely.",
        confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
      },
    });

    expect(response.status).toBe(400);
    expect(String(response.body?.message || "")).toContain("targetUserId is required");

    const [auditEntry] = await getAdminAuditLog(5);
    expect(auditEntry?.action).toBe("admin_support_user_edit");
    expect(auditEntry?.outcome).toBe("denied");
    expect(auditEntry?.resolutionSource).toBe("target_email_only");
  });

  it("role-based impersonation is fail-closed and audited", async () => {
    const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });

    const response = await adminAgent.post("/api/admin/impersonate").send({
      role: "homeowner",
      reason: "Need to inspect a privileged flow with an immutable target policy.",
    });

    expect(response.status).toBe(410);
    expect(response.body?.reasonCode).toBe("IMMUTABLE_TARGET_REQUIRED");

    const [auditEntry] = await getAdminAuditLog(5);
    expect(auditEntry?.action).toBe("admin_impersonation_start_role_denied");
    expect(auditEntry?.outcome).toBe("denied");
    expect(auditEntry?.targetType).toBe("role");
  });

  it("homescout approval requires an explicit reason and emits a completed audit", async () => {
    const county = await getCountyFixture();
    const { agent: sellerAgent } = await createAuthedAgent({ role: "homeowner" });
    const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });

    const created = await sellerAgent.post("/api/homescout/listings").send({
      countyFips: county.fips,
      stateCode: county.stateCode,
      city: county.name,
      zipCode: "70809",
      address1: `318 Cypress Court ${crypto.randomUUID().slice(0, 8)}`,
      title: "Pending HomeScout listing for moderation proof",
      description: "Fresh listing pending privileged approval.",
      price: 412000,
      propertyType: "house",
    });

    expect(created.status).toBe(201);

    const missingReason = await adminAgent
      .post(`/api/admin/homescout/listings/${created.body.id}/approve`)
      .send({});
    expect(missingReason.status).toBe(400);

    const approved = await adminAgent
      .post(`/api/admin/homescout/listings/${created.body.id}/approve`)
      .send({ reason: "Listing verified against moderation standards for county exposure." });

    expect(approved.status).toBe(200);

    const [auditEntry] = await getAdminAuditLog(5);
    expect(auditEntry?.action).toBe("admin_homescout_listing_approve");
    expect(auditEntry?.outcome).toBe("completed");
    expect(String(auditEntry?.targetId || "")).toBe(String(created.body.id));
  });

  it("assistant password reset rejects email-only privileged targeting", async () => {
    const adminUser = await createUserOnly({ role: "super_admin" });
    const targetUser = await createUserOnly({ role: "contractor" });

    const result = await executeAssistantAction(
      {
        type: "admin_reset_user_password",
        params: {
          email: targetUser.email,
          newPassword: "P@ssw0rd-Phase2C",
          reason: "Need to restore account access after a verified support review.",
        },
      },
      {
        id: adminUser.id,
        role: "super_admin" as any,
      }
    );

    expect(result.success).toBe(false);
    expect(String(result.error || "")).toContain("userId is required");

    const [auditEntry] = await getAdminAuditLog(5);
    expect(auditEntry?.action).toBe("assistant_admin_reset_user_password");
    expect(auditEntry?.outcome).toBe("denied");
    expect(auditEntry?.resolutionSource).toBe("target_email_only");
  });
});
