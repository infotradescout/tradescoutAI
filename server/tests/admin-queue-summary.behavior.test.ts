import express from "express";
import request from "supertest";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { loadAdminQueueSnapshot, projectAdminQueueSnapshot } from "../services/adminQueueSummary";

const fixture = vi.hoisted(() => ({
  query: vi.fn(),
  actorId: "operator" as string | null,
  presence: vi.fn(),
}));
vi.mock("../db/pg", () => ({ pool: { query: fixture.query } }));
vi.mock("../services/presenceCustomerTasks", () => ({
  presenceCustomerTaskHealth: fixture.presence,
}));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) => {
    if (!req.headers["x-role"]) return res.status(401).end();
    req.user = {
      id: fixture.actorId,
      role: req.headers["x-role"],
      activeRole: req.headers["x-active-role"],
    };
    next();
  },
}));

async function app() {
  const router = (await import("../routes/admin-tool-notifications")).default;
  return express().use("/api/admin/tool-notifications", router);
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  fixture.actorId = "operator";
  fixture.presence.mockResolvedValue({ observedAt: new Date().toISOString() });
  fixture.query.mockImplementation(async (sql: string) => ({
    rows: [
      {
        count: sql.includes("tradepartner_rsvp")
          ? 2
          : sql.includes("address_verifications")
            ? 3
            : sql.includes("realtor_profiles")
              ? 5
              : sql.includes("car_salesman_profiles")
                ? 7
                : 11,
      },
    ],
  }));
});
afterEach(() => vi.useRealTimers());

describe("actual admin tool notifications route", () => {
  it("preserves authentication and rejects non-admin sessions before reading storage", async () => {
    const server = await app();
    expect((await request(server).get("/api/admin/tool-notifications")).status).toBe(401);
    expect(
      (await request(server).get("/api/admin/tool-notifications").set("x-role", "homeowner")).status
    ).toBe(403);
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("deduplicates aliases and routes license/insurance work to its real review workspace", async () => {
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(response.status).toBe(200);
    expect(response.body.byTool).toEqual({
      "tradepartner-rsvps": 2,
      verification: 3,
      "professional-verification": 12,
      "commercial-directory": 11,
    });
    expect(response.body.totalUnread).toBe(28);
    expect(response.body.byTool).not.toHaveProperty("contractor-settings");
    expect(response.body.countsAvailable).toBe(true);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toContain("Cookie");
    expect(response.headers.vary).toContain("Authorization");
  });
  it("uses authenticated primary role like admin health even when active session role is higher", async () => {
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "moderator")
      .set("x-active-role", "super_admin");
    expect(response.status).toBe(200);
    expect(response.body.totalUnread).toBe(16);
    expect(response.body.byTool).not.toHaveProperty("professional-verification");
    expect(response.body.counts).not.toHaveProperty("professionalVerificationsPending");
  });
  it("withholds queue scope but preserves independently authorized Presence if the actor cannot be resolved", async () => {
    fixture.actorId = null;
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "super_admin");
    expect(response.status).toBe(200);
    expect(response.body.totalUnread).toBeNull();
    expect(response.body.queueScopeAvailable).toBe(false);
    expect(response.body.presenceTaskHealth.available).toBe(true);
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("preserves existing admitted staff aggregates without inferring a higher primary role", async () => {
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "business_owner")
      .set("x-active-role", "super_admin");
    expect(response.status).toBe(200);
    expect(response.body.queueScopeAvailable).toBe(false);
    expect(response.body.byTool).toEqual({});
    expect(response.body.totalUnread).toBeNull();
    expect(response.body.presenceTaskHealth.available).toBe(true);
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("keeps available queues actionable on a partial storage/schema failure without reporting a total", async () => {
    fixture.query.mockImplementation(async (sql: string) => {
      if (sql.includes("verification_documents"))
        throw Object.assign(new Error("missing table"), { code: "42P01" });
      return { rows: [{ count: 4 }] };
    });
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(response.status).toBe(200);
    expect(response.body.partiallyAvailable).toBe(true);
    expect(response.body.byTool["commercial-directory"]).toBeNull();
    expect(response.body.byTool.verification).toBe(4);
    expect(response.body.totalUnread).toBeNull();
    expect(fixture.query).toHaveBeenCalledTimes(5); // No fallback counting all historical rows.
  });
  it("returns 503 and unknown counts when queue sources and independent Presence both fail", async () => {
    fixture.query.mockRejectedValue(new Error("storage unavailable"));
    fixture.presence.mockRejectedValue(new Error("presence unavailable"));
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(response.status).toBe(503);
    expect(response.body.countsAvailable).toBe(false);
    expect(response.body.totalUnread).toBeNull();
    expect(Object.values(response.body.byTool)).toEqual([null, null, null, null]);
  });
  it("preserves independent Presence when all queue sources fail", async () => {
    fixture.query.mockRejectedValue(new Error("storage unavailable"));
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(response.status).toBe(200);
    expect(response.body.countsAvailable).toBe(false);
    expect(response.body.totalUnread).toBeNull();
    expect(response.body.presenceTaskHealth.available).toBe(true);
  });
  it("retains the source observation time while cached and refreshes it after expiry", async () => {
    const server = await app();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    const first = await request(server)
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    vi.setSystemTime(new Date("2026-10-01T12:00:15Z"));
    const cached = await request(server)
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(cached.body.updatedAt).toBe(first.body.updatedAt);
    expect(fixture.query).toHaveBeenCalledTimes(5);
    vi.setSystemTime(new Date("2026-10-01T12:00:31Z"));
    const refreshed = await request(server)
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(refreshed.body.updatedAt).not.toBe(first.body.updatedAt);
    expect(fixture.query).toHaveBeenCalledTimes(10);
  });
  it("keeps valid queue counts when Presence health alone is unavailable", async () => {
    fixture.presence.mockRejectedValue(new Error("presence unavailable"));
    const response = await request(await app())
      .get("/api/admin/tool-notifications")
      .set("x-role", "ops_admin");
    expect(response.status).toBe(200);
    expect(response.body.countsAvailable).toBe(true);
    expect(response.body.degraded).toBe(true);
    expect(response.body.presenceTaskHealth.available).toBe(false);
  });
});

describe("queue SQL semantics", () => {
  it("counts only pending records in a disposable PostgreSQL database", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    try {
      await db.exec(`
        create table tradepartner_rsvp_submissions(attendance_status text);
        insert into tradepartner_rsvp_submissions values ('pending'), ('showed_up'), ('cancelled');
        create table address_verifications(status text);
        insert into address_verifications values ('submitted'), ('approved'), ('rejected');
        create table realtor_profiles(verification_status text);
        insert into realtor_profiles values ('pending'), ('approved');
        create table car_salesman_profiles(verification_status text);
        insert into car_salesman_profiles values ('under_review'), ('approved');
        create table verification_documents(status text, type text);
        insert into verification_documents values ('pending', 'license'), ('approved', 'insurance'), ('pending', 'other');
      `);
      const snapshot = await loadAdminQueueSnapshot((sql) => db.query(sql));
      expect(projectAdminQueueSnapshot(snapshot, "ops_admin").byTool).toEqual({
        "tradepartner-rsvps": 1,
        verification: 1,
        "professional-verification": 2,
        "commercial-directory": 1,
      });
    } finally {
      await db.close();
    }
  }, 20_000);
});
