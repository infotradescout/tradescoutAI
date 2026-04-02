import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import impersonationRouter from "../routes/admin/impersonation";
import { clearAdminAuditLog, getAdminAuditLog } from "../services/adminAuditLogService";

function createImpersonationTestApp(user: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use("/api/admin/impersonation", impersonationRouter);
  return app;
}

describe("Phase 2C token impersonation router", () => {
  beforeEach(async () => {
    process.env.IMPERSONATION_SECRET = "phase2c-test-secret";
    await clearAdminAuditLog();
  });

  it("requires explicit reason for impersonation start", async () => {
    const app = createImpersonationTestApp({ id: "admin-1", role: "super_admin" });

    const response = await request(app).post("/api/admin/impersonation/start/user-123").send({});

    expect(response.status).toBe(400);
    expect(String(response.body?.error || "")).toContain("reason is required");
  });

  it("records canonical audit payload for token impersonation start", async () => {
    const app = createImpersonationTestApp({
      id: "admin-2",
      role: "super_admin",
      roles: ["super_admin"],
    });

    const response = await request(app)
      .post("/api/admin/impersonation/start/user-456")
      .send({ reason: "Need impersonation token for supervised support debugging." });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
    expect(typeof response.body?.token).toBe("string");

    const [auditEntry] = await getAdminAuditLog(10);
    expect(auditEntry?.action).toBe("admin_impersonation_token_start");
    expect(auditEntry?.route).toBe("/api/admin/impersonation/start/:userId");
    expect(auditEntry?.operationType).toBe("impersonation_start");
    expect(auditEntry?.targetType).toBe("user");
    expect(auditEntry?.targetId).toBe("user-456");
    expect(auditEntry?.resolutionSource).toBe("route_param:user_id");
    expect(auditEntry?.outcome).toBe("started");
    expect(Array.isArray(auditEntry?.actorRoles)).toBe(true);
  });

  it("records canonical audit payload for token impersonation exit", async () => {
    const app = createImpersonationTestApp({ id: "admin-3", role: "super_admin" });

    const response = await request(app).post("/api/admin/impersonation/exit").send({});

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);

    const [auditEntry] = await getAdminAuditLog(10);
    expect(auditEntry?.action).toBe("admin_impersonation_token_exit");
    expect(auditEntry?.route).toBe("/api/admin/impersonation/exit");
    expect(auditEntry?.operationType).toBe("impersonation_stop");
    expect(auditEntry?.resolutionSource).toBe("admin_impersonation_session");
    expect(auditEntry?.outcome).toBe("stopped");
  });

  it("denies non-super-admin actors", async () => {
    const app = createImpersonationTestApp({ id: "user-1", role: "homeowner" });

    const response = await request(app)
      .post("/api/admin/impersonation/start/user-456")
      .send({ reason: "Trying to start impersonation without authority." });

    expect(response.status).toBe(403);
    expect(String(response.body?.error || "")).toContain("Super admin privileges required");
  });
});
