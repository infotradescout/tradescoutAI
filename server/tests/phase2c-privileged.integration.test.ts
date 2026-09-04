import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { affiliateAccounts, counties, communityPosts } from "@shared/schema";
import { executeAssistantAction } from "../assistantActions";
import { clearAdminAuditLog, getAdminAuditLog } from "../services/adminAuditLogService";
import { createAuthedAgent, createUserOnly } from "./helpers/testAuth";

const hasTestDb =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.RUN_INTEGRATION_TESTS === "true";

const describeDb = hasTestDb ? describe : describe.skip;
const INTEGRATION_TIMEOUT_MS = 300000;

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

  it(
    "support-edit rejects email-only targeting and records a denied audit",
    async () => {
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
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "role-based impersonation is fail-closed and audited",
    async () => {
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
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "homescout approval requires an explicit reason and emits a completed audit",
    async () => {
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
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "assistant password reset rejects email-only privileged targeting",
    async () => {
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
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "assistant override create requires reason and emits denied privileged audit",
    async () => {
      const adminUser = await createUserOnly({ role: "admin" as any });

      const result = await executeAssistantAction(
        {
          type: "admin_override_create",
          params: {
            overrideType: "fact",
            key: "county-trust-note",
            value: "Validated local trust guidance",
          },
        },
        {
          id: adminUser.id,
          role: "admin" as any,
        }
      );

      expect(result.success).toBe(false);
      expect(String(result.error || "")).toContain("reason is required");

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("assistant_admin_override_create");
      expect(auditEntry?.outcome).toBe("denied");
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "assistant override delete emits completed privileged audit with explicit reason",
    async () => {
      const adminUser = await createUserOnly({ role: "admin" as any });

      const result = await executeAssistantAction(
        {
          type: "admin_override_delete",
          params: {
            overrideType: "fact",
            key: "county-trust-note",
            reason: "Remove stale override after verified governance update.",
          },
        },
        {
          id: adminUser.id,
          role: "admin" as any,
        }
      );

      expect(result.success).toBe(true);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("assistant_admin_override_delete");
      expect(auditEntry?.outcome).toBe("completed");
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "assistant knowledge upsert requires reason and emits denied privileged audit",
    async () => {
      const adminUser = await createUserOnly({ role: "admin" as any });

      const result = await executeAssistantAction(
        {
          type: "admin_upsert_knowledge",
          params: {
            key: "county-intent-policy",
            content: "Knowledge payload",
            scope: "global",
          },
        },
        {
          id: adminUser.id,
          role: "admin" as any,
        }
      );

      expect(result.success).toBe(false);
      expect(String(result.error || "")).toContain("reason is required");

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("assistant_admin_upsert_knowledge");
      expect(auditEntry?.outcome).toBe("denied");
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "admin user-control audit payload follows the shared privileged contract shape",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const targetUser = await createUserOnly({ role: "contractor" });

      const response = await adminAgent
        .post(`/api/admin/user-controls/suspend/${targetUser.id}`)
        .send({
          reason: "Suspend account after verified policy abuse investigation.",
        });

      expect(response.status).toBe(200);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_user_suspend");
      expect(auditEntry?.route).toBe("/api/admin/user-controls/suspend/:userId");
      expect(auditEntry?.operationType).toBe("suspend_user");
      expect(auditEntry?.targetType).toBe("user");
      expect(String(auditEntry?.targetId || "")).toBe(String(targetUser.id));
      expect(auditEntry?.resolutionSource).toBe("route_param:user_id");
      expect(auditEntry?.outcome).toBe("completed");
      expect(typeof auditEntry?.reason).toBe("string");
      expect(Array.isArray(auditEntry?.actorRoles)).toBe(true);
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "legacy admin reset-password rejects email-only privileged targeting",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const targetUser = await createUserOnly({ role: "contractor" });

      const response = await adminAgent.post("/api/admin/users/reset-password").send({
        email: targetUser.email,
        newPassword: "P@ssw0rd-Phase2C-legacy",
        reason: "Restore account access after verified support review.",
        adminSafety: {
          reason: "Restore account access after verified support review.",
          confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
        },
      });

      expect(response.status).toBe(400);
      expect(String(response.body?.error || "")).toContain("userId is required");

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_user_reset_password");
      expect(auditEntry?.outcome).toBe("denied");
      expect(auditEntry?.resolutionSource).toBe("target_email_only");
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "legacy admin reset-password requires reason and emits completed privileged audit",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const targetUser = await createUserOnly({ role: "contractor" });

      const missingReason = await adminAgent.post("/api/admin/users/reset-password").send({
        userId: targetUser.id,
        newPassword: "P@ssw0rd-Phase2C-legacy",
        adminSafety: {
          reason: "Restore account access after verified support review.",
          confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
        },
      });
      expect(missingReason.status).toBe(400);

      const completed = await adminAgent.post("/api/admin/users/reset-password").send({
        userId: targetUser.id,
        newPassword: "P@ssw0rd-Phase2C-legacy",
        reason: "Restore account access after verified support review.",
        adminSafety: {
          reason: "Restore account access after verified support review.",
          confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
        },
      });

      expect(completed.status).toBe(200);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_user_reset_password");
      expect(auditEntry?.route).toBe("/api/admin/users/reset-password");
      expect(auditEntry?.operationType).toBe("reset_user_password");
      expect(auditEntry?.outcome).toBe("completed");
      expect(String(auditEntry?.targetId || "")).toBe(String(targetUser.id));
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "legacy admin role update now requires explicit reason",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const targetUser = await createUserOnly({ role: "contractor" });

      const response = await adminAgent.put(`/api/admin/users/${targetUser.id}/role`).send({
        role: "homeowner",
        adminSafety: {
          confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
        },
      });

      expect(response.status).toBe(400);
      expect(String(response.body?.message || "")).toContain("reason is required");
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "admin module roles patch requires reason and emits completed privileged audit",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const targetUser = await createUserOnly({ role: "contractor" });

      const missingReason = await adminAgent.patch(`/api/admin/users/${targetUser.id}/roles`).send({
        roles: ["contractor", "homeowner"],
        activeRole: "contractor",
      });
      expect(missingReason.status).toBe(400);

      const completed = await adminAgent.patch(`/api/admin/users/${targetUser.id}/roles`).send({
        roles: ["contractor", "homeowner"],
        activeRole: "contractor",
        reason: "Align user claims to verified capability assignment policy.",
        confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
      });
      expect(completed.status).toBe(200);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_user_roles_update");
      expect(auditEntry?.route).toBe("/api/admin/users/:userId/roles");
      expect(auditEntry?.operationType).toBe("update_user_roles");
      expect(auditEntry?.outcome).toBe("completed");
      expect(String(auditEntry?.targetId || "")).toBe(String(targetUser.id));
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "admin module badges patch requires reason and emits completed privileged audit",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const targetUser = await createUserOnly({ role: "contractor" });

      const missingReason = await adminAgent
        .patch(`/api/admin/users/${targetUser.id}/badges`)
        .send({
          badges: ["trusted-pro", "county-verified"],
        });
      expect(missingReason.status).toBe(400);

      const completed = await adminAgent.patch(`/api/admin/users/${targetUser.id}/badges`).send({
        badges: ["trusted-pro", "county-verified"],
        reason: "Apply validated trust badges after completed compliance review.",
      });
      expect(completed.status).toBe(200);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_user_badges_update");
      expect(auditEntry?.route).toBe("/api/admin/users/:userId/badges");
      expect(auditEntry?.operationType).toBe("update_user_badges");
      expect(auditEntry?.outcome).toBe("completed");
      expect(String(auditEntry?.targetId || "")).toBe(String(targetUser.id));
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "admin community post delete requires reason and emits completed privileged audit",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const county = await getCountyFixture();
      const author = await createUserOnly({ role: "homeowner" });

      const [post] = await db
        .insert(communityPosts)
        .values({
          authorId: author.id,
          content: `Phase2C moderation target ${crypto.randomUUID().slice(0, 8)}`,
          scope: "county",
          category: "general",
          stateCode: county.stateCode,
          countyFips: county.fips,
        } as any)
        .returning({ id: communityPosts.id });

      const missingReason = await adminAgent
        .delete(`/api/admin/community/posts/${post.id}`)
        .send({});
      expect(missingReason.status).toBe(400);

      const completed = await adminAgent.delete(`/api/admin/community/posts/${post.id}`).send({
        reason: "Remove post after verified policy breach moderation decision.",
      });
      expect(completed.status).toBe(200);

      const auditEntries = await getAdminAuditLog(10);
      const auditEntry = auditEntries.find(
        (entry) => entry?.action === "admin_community_post_delete"
      );
      expect(auditEntry?.action).toBe("admin_community_post_delete");
      expect(auditEntry?.route).toBe("/api/admin/community/posts/:postId");
      expect(auditEntry?.operationType).toBe("delete_community_post");
      expect(auditEntry?.outcome).toBe("completed");
      expect(String(auditEntry?.targetId || "")).toBe(String(post.id));
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "affiliate commission update requires reason and emits completed privileged audit",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const affiliateUser = await createUserOnly({ role: "contractor" });
      const [affiliate] = await db
        .insert(affiliateAccounts)
        .values({
          affiliateId: affiliateUser.id,
          referralCode: `phase2c-${crypto.randomUUID().slice(0, 8)}`,
        } as any)
        .returning({ id: affiliateAccounts.id });

      const missingReason = await adminAgent
        .put(`/api/admin/affiliates/${affiliate.id}/commission-rate`)
        .send({ commissionRate: 0.07 });
      expect(missingReason.status).toBe(400);

      const completed = await adminAgent
        .put(`/api/admin/affiliates/${affiliate.id}/commission-rate`)
        .send({
          commissionRate: 0.07,
          reason: "Adjust rate after verified partner performance governance review.",
        });
      expect(completed.status).toBe(200);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_affiliate_commission_rate_update");
      expect(auditEntry?.route).toBe("/api/admin/affiliates/:id/commission-rate");
      expect(auditEntry?.operationType).toBe("update_affiliate_commission_rate");
      expect(auditEntry?.outcome).toBe("completed");
      expect(String(auditEntry?.targetId || "")).toBe(String(affiliate.id));
    },
    INTEGRATION_TIMEOUT_MS
  );

  it(
    "affiliate payout create requires reason and emits completed privileged audit",
    async () => {
      const { agent: adminAgent } = await createAuthedAgent({ role: "super_admin" });
      const affiliateUser = await createUserOnly({ role: "contractor" });
      const [affiliate] = await db
        .insert(affiliateAccounts)
        .values({
          affiliateId: affiliateUser.id,
          referralCode: `phase2c-${crypto.randomUUID().slice(0, 8)}`,
        } as any)
        .returning({ id: affiliateAccounts.id });

      const missingReason = await adminAgent
        .post(`/api/admin/affiliates/${affiliate.id}/payout`)
        .send({
          amount: 125.5,
          payoutMethod: "manual",
        });
      expect(missingReason.status).toBe(400);

      const completed = await adminAgent.post(`/api/admin/affiliates/${affiliate.id}/payout`).send({
        amount: 125.5,
        payoutMethod: "manual",
        reason: "Issue payout after approved affiliate ledger reconciliation.",
      });
      expect(completed.status).toBe(201);

      const [auditEntry] = await getAdminAuditLog(5);
      expect(auditEntry?.action).toBe("admin_affiliate_payout_create");
      expect(auditEntry?.route).toBe("/api/admin/affiliates/:id/payout");
      expect(auditEntry?.operationType).toBe("create_affiliate_payout");
      expect(auditEntry?.outcome).toBe("completed");
      expect(String(auditEntry?.targetId || "")).toBe(String(affiliate.id));
    },
    INTEGRATION_TIMEOUT_MS
  );
});
