import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  adminAuditLog,
  businesses,
  contractors,
  conversations,
  messages,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";

const fixture = vi.hoisted(() => ({
  client: null as import("@electric-sql/pglite").PGlite | null,
  getUser: vi.fn(),
  filterContractors: vi.fn(),
  filterBusinesses: vi.fn(),
  notifyProvider: vi.fn(),
}));
vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.client = new PGlite();
  return { db: drizzle(fixture.client) };
});
vi.mock("../storage", () => ({ storage: fixture }));
import { registerDirectConnectAdminOperations } from "../routes/direct-connect/admin-operations";

const app = express();
app.use(express.json());
registerDirectConnectAdminOperations(app, {
  isAuthenticated: (req: any, res, next) => {
    if (!req.headers["x-test-role"]) return res.status(401).end();
    req.user = { id: "operator", role: req.headers["x-test-role"] };
    next();
  },
  isOperator: (req: any, res, next) => {
    if (!["ops_admin", "super_admin"].includes(req.user.role)) return res.status(403).end();
    next();
  },
  filterContractors: fixture.filterContractors,
  filterBusinesses: fixture.filterBusinesses,
  notifyProvider: fixture.notifyProvider,
});
const sql = (text: string, values: unknown[] = []) => fixture.client!.query(text, values);
const post = (path: string, payload: unknown, role = "ops_admin") =>
  request(app)
    .post(`/api/admin/direct-connect/requests/request-1/${path}`)
    .set("x-test-role", role)
    .send(payload);
const invitation = {
  operationId: "invite-operation-1",
  providerId: "contractor-1",
  reason: "Requester asked for this provider.",
};
const reply = {
  operationId: "reply-operation-1",
  assignmentId: "assignment-1",
  content: "The project scope has been clarified.",
  reason: "Helping the requester clarify scope.",
};

beforeAll(async () => {
  // Actual PostgreSQL query/transaction execution against a disposable typed projection.
  // This intentionally does not claim a full production migration/constraint replay.
  const types: Record<string, string> = {
    boolean: "boolean",
    number: "double precision",
    json: "jsonb",
    date: "timestamp",
    array: "text[]",
  };
  for (const table of [
    adminAuditLog,
    businesses,
    contractors,
    conversations,
    messages,
    workRequestAssignments,
    workRequestEvents,
    workRequests,
  ]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(
      (column) =>
        `"${column.name}" ${types[column.dataType] || "text"}${column.name === "id" ? " PRIMARY KEY DEFAULT gen_random_uuid()" : column.dataType === "date" ? " DEFAULT now()" : ""}`
    );
    await fixture.client!.exec(`CREATE TABLE "${config.name}" (${columns.join(", ")})`);
  }
  await fixture.client!.exec(
    "CREATE TABLE direct_connect_dispatch_requests (id text PRIMARY KEY, user_id text, contact_gate_state text)"
  );
}, 30000);
beforeEach(async () => {
  await fixture.client!.exec(
    "TRUNCATE admin_audit_log, businesses, contractors, conversations, messages, work_request_assignments, work_request_events, work_requests, direct_connect_dispatch_requests"
  );
  fixture.getUser
    .mockReset()
    .mockResolvedValue({ id: "requester", role: "homeowner", addressVerified: true });
  fixture.filterContractors.mockReset().mockImplementation(async (rows) => ({ eligible: rows }));
  fixture.filterBusinesses.mockReset().mockImplementation(async (rows) => ({ eligible: rows }));
  fixture.notifyProvider.mockReset().mockResolvedValue({ id: "notification-1" });
  await sql(
    "INSERT INTO work_requests (id, created_by_user_id, source, status, county_fips) VALUES ('request-1', 'requester', 'direct_connect', 'open', '12001')"
  );
  await sql("INSERT INTO contractors (id, user_id) VALUES ('contractor-1', 'provider')");
});
afterAll(async () => {
  await fixture.client?.close();
});

async function seedAccepted() {
  await sql("UPDATE work_requests SET status = 'in_progress'");
  await sql(
    "INSERT INTO work_request_assignments (id, work_request_id, contractor_id, status, created_at) VALUES ('assignment-1', 'request-1', 'contractor-1', 'accepted', '2026-09-01')"
  );
  await sql(
    "INSERT INTO conversations (id, homeowner_id, contractor_id, status) VALUES ('conversation-1', 'requester', 'contractor-1', 'active')"
  );
  await sql(
    "INSERT INTO work_request_events (id, work_request_id, type, actor_user_id, metadata, created_at) VALUES ('event-1', 'request-1', 'provider_accepted', 'provider', $1, '2026-09-02')",
    [
      JSON.stringify({
        contractorId: "contractor-1",
        conversationId: "conversation-1",
        assignmentId: "assignment-1",
      }),
    ]
  );
  await sql(
    "INSERT INTO direct_connect_dispatch_requests VALUES ('request-1', 'requester', 'released')"
  );
}

describe("Direct Connect audited operator operations", () => {
  it("supports a business responder without inventing a contractor identity", async () => {
    await sql("INSERT INTO businesses (id, owner_user_id) VALUES ('business-1', 'business-owner')");
    const response = await post("assignments", { ...invitation, providerId: "business-1" });
    expect(response.status).toBe(201);
    expect(
      (await sql("SELECT contractor_id, responder_user_id, status FROM work_request_assignments"))
        .rows
    ).toEqual([{ contractor_id: null, responder_user_id: "business-owner", status: "invited" }]);
    expect(fixture.filterBusinesses).toHaveBeenCalledTimes(1);
  });
  it("does not invite the same owner again through their business alias", async () => {
    await post("assignments", invitation);
    await sql("INSERT INTO businesses (id, owner_user_id) VALUES ('business-alias', 'provider')");
    expect(
      (
        await post("assignments", {
          ...invitation,
          operationId: "alias-operation",
          providerId: "business-alias",
        })
      ).status
    ).toBe(409);
    expect((await sql("SELECT * FROM work_request_assignments")).rows).toHaveLength(1);
  });
  it("reports notification failure without claiming delivery or rolling back a committed invitation", async () => {
    fixture.notifyProvider.mockRejectedValueOnce(new Error("Synthetic notification failure"));
    const response = await post("assignments", invitation);
    expect(response.status).toBe(201);
    expect(response.body.notificationQueued).toBe(false);
    expect((await sql("SELECT * FROM work_request_assignments")).rows).toHaveLength(1);
  });
  it("keeps internal audit reasons out of requester-visible events", async () => {
    await post("assignments", invitation);
    expect(
      (await sql("SELECT metadata->>'reason' AS reason FROM work_request_events")).rows
    ).toEqual([{ reason: null }]);
    expect((await sql("SELECT metadata->>'reason' AS reason FROM admin_audit_log")).rows).toEqual([
      { reason: invitation.reason },
    ]);
  });
  it("rolls back a staff message when its audit cannot be recorded", async () => {
    await seedAccepted();
    await sql(
      "ALTER TABLE admin_audit_log ADD CONSTRAINT reject_staff_audit CHECK (type <> 'admin_direct_connect_staff_reply')"
    );
    try {
      expect((await post("replies", reply)).status).toBe(500);
      expect((await sql("SELECT * FROM messages")).rows).toHaveLength(0);
      expect(
        (await sql("SELECT * FROM work_request_events WHERE type = 'updated'")).rows
      ).toHaveLength(0);
    } finally {
      await sql("ALTER TABLE admin_audit_log DROP CONSTRAINT reject_staff_audit");
    }
  });
  it("paginates exact history and rejects malformed page offsets", async () => {
    await seedAccepted();
    await sql(`INSERT INTO messages (id, conversation_id, content, metadata, created_at)
      SELECT 'page-' || n, 'conversation-1', 'Message ' || n,
        '{"workRequestId":"request-1","connectionId":"assignment-1"}'::jsonb,
        timestamp '2026-09-03' + n * interval '1 minute' FROM generate_series(1, 51) n`);
    const first = await request(app)
      .get("/api/admin/direct-connect/requests/request-1/messages")
      .set("x-test-role", "ops_admin");
    expect(first.body.messages).toHaveLength(50);
    expect(first.body.hasMore).toBe(true);
    expect(first.body.messages.at(-1).content).toBe("Message 51");
    const second = await request(app)
      .get("/api/admin/direct-connect/requests/request-1/messages?page=1")
      .set("x-test-role", "ops_admin");
    expect(second.body.messages.map((m: any) => m.content)).toEqual(["Message 1"]);
    expect(second.body.hasMore).toBe(false);
    expect(
      (
        await request(app)
          .get("/api/admin/direct-connect/requests/request-1/messages?page=-1")
          .set("x-test-role", "ops_admin")
      ).status
    ).toBe(400);
  });
  it("denies unauthenticated and non-operator requests before data access", async () => {
    expect(
      (await request(app).get("/api/admin/direct-connect/requests/request-1/messages")).status
    ).toBe(401);
    for (const role of ["homeowner", "contractor", "moderator", "staff", "support_agent"]) {
      expect((await post("assignments", invitation, role)).status).toBe(403);
      expect((await post("replies", reply, role)).status).toBe(403);
    }
    expect(fixture.filterContractors).not.toHaveBeenCalled();
  });
  it("invites once, audits the actual staff actor, and replays without another notification", async () => {
    const first = await post("assignments", invitation);
    expect(first.status).toBe(201);
    const second = await post("assignments", invitation);
    expect(second.status).toBe(200);
    expect(second.body.assignmentId).toBe(first.body.assignmentId);
    expect(second.body.idempotentReplay).toBe(true);
    expect((await sql("SELECT * FROM work_request_assignments")).rows).toHaveLength(1);
    expect((await sql("SELECT admin_id FROM admin_audit_log")).rows).toEqual([
      { admin_id: "operator" },
    ]);
    expect((await sql("SELECT status FROM work_requests")).rows).toEqual([{ status: "routed" }]);
    expect(fixture.notifyProvider).toHaveBeenCalledTimes(1);
    expect(fixture.filterContractors.mock.calls[0][1].countyFips).toBe("12001");
  });
  it("rejects changed replay input and existing provider assignments", async () => {
    await post("assignments", invitation);
    expect(
      (await post("assignments", { ...invitation, reason: "A different explanation now." })).status
    ).toBe(409);
    expect(
      (await post("assignments", { ...invitation, operationId: "another-operation" })).status
    ).toBe(409);
    expect((await sql("SELECT * FROM admin_audit_log")).rows).toHaveLength(1);
  });
  it("fails closed on verification and county/trade/trust ineligibility", async () => {
    fixture.getUser.mockResolvedValueOnce({ role: "homeowner", addressVerified: false });
    expect((await post("assignments", invitation)).status).toBe(428);
    fixture.filterContractors.mockResolvedValueOnce({ eligible: [] });
    expect((await post("assignments", invitation)).status).toBe(422);
    expect((await sql("SELECT * FROM work_request_assignments")).rows).toHaveLength(0);
    expect(fixture.notifyProvider).not.toHaveBeenCalled();
  });
  it("does not accept, replace, or reopen an existing accepted provider", async () => {
    await seedAccepted();
    expect((await post("assignments", invitation)).status).toBe(409);
    expect((await sql("SELECT status FROM work_request_assignments")).rows).toEqual([
      { status: "accepted" },
    ]);
  });
  it("rolls back the invitation and request status when the durable audit insert fails", async () => {
    await sql(
      "ALTER TABLE admin_audit_log ADD CONSTRAINT reject_test_audit CHECK (type <> 'admin_direct_connect_provider_invited')"
    );
    try {
      expect((await post("assignments", invitation)).status).toBe(500);
      expect((await sql("SELECT * FROM work_request_assignments")).rows).toHaveLength(0);
      expect((await sql("SELECT * FROM work_request_events")).rows).toHaveLength(0);
      expect((await sql("SELECT status FROM work_requests")).rows).toEqual([{ status: "open" }]);
      expect(fixture.notifyProvider).not.toHaveBeenCalled();
    } finally {
      await sql("ALTER TABLE admin_audit_log DROP CONSTRAINT reject_test_audit");
    }
  });
  it("persists a request-bound staff reply with replay-safe atomic audit", async () => {
    await seedAccepted();
    const first = await post("replies", reply, "super_admin");
    expect(first.status).toBe(201);
    expect((await post("replies", reply)).body.messageId).toBe(first.body.messageId);
    const saved = (await sql("SELECT sender_id, sender_type, metadata FROM messages"))
      .rows as any[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      sender_id: "operator",
      sender_type: "staff",
      metadata: {
        workRequestId: "request-1",
        connectionId: "assignment-1",
        author: { kind: "staff", userId: "operator" },
      },
    });
    expect((await sql("SELECT * FROM admin_audit_log")).rows).toHaveLength(1);
    expect(fixture.notifyProvider).not.toHaveBeenCalled();
  });
  it.each([
    "UPDATE direct_connect_dispatch_requests SET contact_gate_state = 'locked'",
    "UPDATE conversations SET status = 'closed'",
    "UPDATE conversations SET homeowner_id = 'different-requester'",
    "UPDATE work_request_events SET actor_user_id = 'wrong-provider'",
    'UPDATE work_request_events SET metadata = metadata || \'{"assignmentId":"wrong-assignment"}\'::jsonb',
    "INSERT INTO work_request_events SELECT 'event-2', work_request_id, type, actor_user_id, from_status, to_status, metadata, created_at FROM work_request_events",
  ])("rejects stale, closed, ambiguous, or unreleased reply authority: %s", async (mutation) => {
    await seedAccepted();
    await sql(mutation);
    expect((await post("replies", reply)).status).toBe(409);
    expect((await sql("SELECT * FROM messages")).rows).toHaveLength(0);
  });
  it.each([
    "Call me at 555-222-1234",
    "Email customer@example.com",
    "Continue at https://example.com",
  ])("prevents staff contact-release bypass in content: %s", async (content) => {
    await seedAccepted();
    expect((await post("replies", { ...reply, content })).status).toBe(422);
    expect((await sql("SELECT * FROM messages")).rows).toHaveLength(0);
  });
  it("shows only exact request/assignment/conversation history and omits unbound legacy messages", async () => {
    await seedAccepted();
    await post("replies", reply);
    await sql(
      "INSERT INTO conversations (id, homeowner_id, contractor_id, status) VALUES ('other-conversation', 'requester', 'contractor-1', 'active')"
    );
    await sql(
      "INSERT INTO messages (id, conversation_id, content, metadata) VALUES ('cross-conversation', 'other-conversation', 'Same parties but a different engagement', $1)",
      [JSON.stringify({ workRequestId: "request-1", connectionId: "assignment-1" })]
    );
    for (const [id, metadata] of [
      ["unbound", {}],
      ["other-request", { workRequestId: "request-2", connectionId: "assignment-1" }],
      ["wrong-assignment", { workRequestId: "request-1", connectionId: "assignment-2" }],
    ]) {
      await sql(
        "INSERT INTO messages (id, conversation_id, content, metadata) VALUES ($1, 'conversation-1', 'Private unrelated content', $2)",
        [id, JSON.stringify(metadata)]
      );
    }
    const result = await request(app)
      .get("/api/admin/direct-connect/requests/request-1/messages")
      .set("x-test-role", "ops_admin");
    expect(result.status).toBe(200);
    expect(result.body.messages.map((message: any) => message.content)).toEqual([reply.content]);
    expect(result.body.replyAssignmentId).toBe("assignment-1");
  });
});
