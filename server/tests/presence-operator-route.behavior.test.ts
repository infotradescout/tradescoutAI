import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mock = vi.hoisted(() => ({
  query: vi.fn(),
  health: vi.fn(),
}));

vi.mock("../db/pg", () => ({ pool: { query: mock.query } }));
vi.mock("../services/presenceCustomerTasks", () => ({
  presenceCustomerTaskHealth: mock.health,
}));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: () => void) => {
    const role = req.header("x-test-role");
    const activeRole = req.header("x-test-active-role");
    const roles = req.header("x-test-roles");
    const isSuperAdmin = req.header("x-test-super-admin") === "true";
    if (!role && !activeRole && !roles && !isSuperAdmin)
      return res.status(401).json({ message: "Authentication required" });
    req.user = {
      id: "synthetic-user",
      role,
      activeRole,
      roles: roles?.split(","),
      isSuperAdmin,
    };
    next();
  },
}));

const aggregate = {
  activeTasks: {
    waitingCustomer: { select_site_path: 3, confirm_facts: 4, total: 7 },
    retrying: { select_site_path: 1, confirm_facts: 0, total: 1 },
    terminalAttention: { select_site_path: 0, confirm_facts: 2, total: 2 },
    totalActive: 10,
  },
  reminderAutomationStatus: "healthy",
  observedAt: "2026-09-29T12:00:00.000Z",
  terminalAttentionCount: 2,
  dueBacklogCount: 1,
  oldestDueAt: null,
  lastAttemptAt: null,
  lastSuccessfulTickAt: "2026-09-29T11:59:00.000Z",
  lastFailureAt: null,
  lastErrorCode: null,
};

async function app() {
  const testApp = express();
  const { default: router } = await import("../routes/admin-tool-notifications");
  testApp.use("/api/admin/tool-notifications", router);
  return testApp;
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mock.query.mockResolvedValue({ rows: [{ count: 0 }] });
  mock.health.mockResolvedValue(aggregate);
});

describe("Presence aggregate in the existing admin notifications route", () => {
  it("denies unauthenticated and ordinary customers before aggregate reads", async () => {
    const testApp = await app();
    const unauthenticated = await request(testApp).get("/api/admin/tool-notifications");
    const customer = await request(testApp)
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "business_owner");

    expect(unauthenticated.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(mock.query).not.toHaveBeenCalled();
    expect(mock.health).not.toHaveBeenCalled();
  });

  it("returns only aggregate Presence counts outside admin badge counts", async () => {
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "ops_admin");

    expect(response.status).toBe(200);
    expect(response.body.presenceTaskHealth).toMatchObject({ available: true, ...aggregate });
    expect(response.body.countsAvailable).toBe(true);
    expect(response.body.totalUnread).toBe(0);
    expect(response.body.byTool).not.toHaveProperty("presence");
    expect(response.text).not.toMatch(/synthetic-user|ownerUserId|businessId|profileId|factValue/);
  });

  it.each([
    ["legacy owner primary role", { "x-test-role": "owner" }],
    [
      "legacy head admin active role",
      { "x-test-role": "business_owner", "x-test-active-role": "head_admin" },
    ],
    [
      "persisted super-admin flag",
      { "x-test-role": "business_owner", "x-test-super-admin": "true" },
    ],
    [
      "existing support grant",
      { "x-test-role": "business_owner", "x-test-roles": "support_agent" },
    ],
  ])("accepts %s through the established admin boundary", async (_name, headers) => {
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set(headers);
    expect(response.status).toBe(200);
    expect(response.body.presenceTaskHealth.available).toBe(true);
  });

  it("coalesces concurrent reads and keeps a successful aggregate for 30 seconds", async () => {
    const testApp = await app();
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    let resolveHealth!: (value: typeof aggregate) => void;
    mock.health.mockReturnValueOnce(
      new Promise<typeof aggregate>((resolve) => {
        resolveHealth = resolve;
      })
    );
    const first = request(testApp)
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "ops_admin");
    const second = request(testApp)
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "ops_admin");
    const responses = Promise.all([first, second]);
    await vi.waitFor(() => expect(mock.health).toHaveBeenCalledTimes(1));
    resolveHealth(aggregate);
    const [a, b] = await responses;
    expect(a.body.presenceTaskHealth.activeTasks.totalActive).toBe(10);
    expect(b.body.presenceTaskHealth.activeTasks.totalActive).toBe(10);
    expect(mock.health).toHaveBeenCalledTimes(1);

    const cached = await request(testApp)
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "ops_admin");
    expect(cached.body.presenceTaskHealth.activeTasks.totalActive).toBe(10);
    expect(mock.health).toHaveBeenCalledTimes(1);

    clock.mockReturnValue(1_030_001);
    const refreshed = await request(testApp)
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "ops_admin");
    expect(refreshed.body.presenceTaskHealth.activeTasks.totalActive).toBe(10);
    expect(mock.health).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it.each(["Presence task runtime unavailable", "synthetic database unavailable"])(
    "never caches an unavailable aggregate as a healthy zero: %s",
    async (reason) => {
      const testApp = await app();
      mock.health.mockRejectedValueOnce(new Error(reason));
      const failed = await request(testApp)
        .get("/api/admin/tool-notifications")
        .set("x-test-role", "ops_admin");
      expect(failed.status).toBe(200);
      expect(failed.body.degraded).toBe(true);
      expect(failed.body.countsAvailable).toBe(true);
      expect(failed.body.presenceTaskHealth).toEqual({ available: false });

      const recovered = await request(testApp)
        .get("/api/admin/tool-notifications")
        .set("x-test-role", "ops_admin");
      expect(recovered.body.presenceTaskHealth).toMatchObject({ available: true, ...aggregate });
      expect(mock.health).toHaveBeenCalledTimes(2);
      expect(recovered.text).not.toContain(reason);
    }
  );

  it("marks legacy unread counts unavailable when their database read fails", async () => {
    mock.query.mockRejectedValueOnce(new Error("synthetic unread database failure"));
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-test-role", "ops_admin");

    expect(response.status).toBe(200);
    expect(response.body.degraded).toBe(true);
    expect(response.body.countsAvailable).toBe(false);
    expect(response.body.totalUnread).toBe(0);
    expect(response.body.byTool).toEqual({});
    expect(response.body.presenceTaskHealth).toEqual({ available: false });
    expect(response.text).not.toContain("synthetic unread database failure");
    expect(mock.health).not.toHaveBeenCalled();
  });
});
