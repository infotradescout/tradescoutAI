import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { projectRequestStagesReport } from "../../shared/discoveryRequestStages";

const state = vi.hoisted(() => ({ queries: [] as { text: string; values?: unknown[] }[], connects: 0, releases: 0, fail: false, invalid: false }));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) => req.headers["x-fixture-role"] ? next() : res.status(401).json({ message: "Unauthorized" }),
  isSuperAdmin: (req: any, res: any, next: any) => req.headers["x-fixture-role"] === "super_admin" ? next() : res.status(403).json({ message: "Forbidden" }),
}));
vi.mock("../storage", () => ({ storage: { logEvent: vi.fn() } }));
vi.mock("../db", () => ({ pool: { connect: async () => {
  state.connects++;
  return { release: () => { state.releases++; }, query: async (text: string, values?: unknown[]) => {
    state.queries.push({ text, values });
    if (text.startsWith("\nWITH bounds")) {
      if (state.fail) throw new Error("private database diagnostic must not leak");
      const result: any = fixture();
      if (state.invalid) delete result.created_requests;
      return { rows: [{ report: result }] };
    }
    return { rows: [] };
  } };
}, query: vi.fn() } }));

function fixture() {
  return { schema_version: 1, created_requests: 3, linked_created_requests: 2, unlinked_created_requests: 1, requests_with_conflicting_creation_attribution: 1, linked_submitted_requests: 2, requests_with_provider_response: 1, requester_confirmed_completions: 0,
    source_groups: [{ source_group: "search_labeled", linked_created_requests: 2, linked_submitted_requests: 2, requests_with_provider_response: 1, requester_confirmed_completions: 0 }],
    qualified_requests: null, verified_unique_people: null, search_console_impressions: null, search_console_clicks: null };
}
let server: Server; let base: string;
beforeAll(async () => {
  const router = (await import("../routes/admin-discovery-observatory")).default;
  const app = express(); app.use("/api/admin/discovery-observatory", router);
  server = await new Promise<Server>((resolve) => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/discovery-observatory/request-stages`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
beforeEach(() => { state.queries = []; state.connects = state.releases = 0; state.fail = state.invalid = false; });
const parameters = "?from=2026-08-24T05:00:00Z&to=2026-09-21T05:00:00Z";
const request = (query = parameters, role = "super_admin") => fetch(base + query, { headers: role ? { "x-fixture-role": role } : {} });

describe("registered request-stages HTTP route, fixture identity and database", () => {
  it("denies guests and non-admin accounts before querying", async () => {
    expect((await request(parameters, "")).status).toBe(401);
    expect((await request(parameters, "member")).status).toBe(403);
    expect(state.connects).toBe(0);
  });
  it.each(["", "?from=x&to=y", "?from=2026-02-30T00:00:00Z&to=2026-03-02T00:00:00Z", "?from=2026-01-01T00:00:00Z&to=2026-09-01T00:00:00Z", parameters + "&from=2026-08-25T05:00:00Z", parameters + "&role=super_admin", "?from=2099-01-01T00:00:00Z&to=2099-01-02T00:00:00Z"])("rejects invalid/ambiguous windows without acquiring a connection: %s", async (query) => {
    expect((await request(query)).status).toBe(400); expect(state.connects).toBe(0);
  });
  it("returns aggregate-only counts under read-only transaction/timeout controls", async () => {
    const response = await request(); const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body.report).toMatchObject({ ...fixture(), window: { from: "2026-08-24T05:00:00.000Z", to: "2026-09-21T05:00:00.000Z" } });
    expect(state.queries[0].text).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(state.queries.map((entry) => entry.text)).toContain("SET LOCAL statement_timeout='8s'");
    expect(state.queries.map((entry) => entry.text)).toContain("SET LOCAL TIME ZONE 'UTC'");
    expect(state.queries.at(-1)?.text).toBe("COMMIT"); expect(state.releases).toBe(1);
    expect(JSON.stringify(body)).not.toContain("definitions");
  });
  it("rolls back and releases on query failure without leaking database details or zeros", async () => {
    state.fail = true; const response = await request(); const body = await response.json();
    expect(response.status).toBe(503); expect(body.report).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("private database");
    expect(state.queries.at(-1)?.text).toBe("ROLLBACK"); expect(state.releases).toBe(1);
  });
  it("rejects malformed aggregate output rather than filling absent counts", async () => {
    state.invalid = true; const response = await request();
    expect(response.status).toBe(503); expect((await response.json()).report).toBeUndefined(); expect(state.releases).toBe(1);
  });
});

describe("request-stage aggregate projection", () => {
  const complete = () => ({ ...fixture(), window: { from: "2026-08-24T05:00:00.000Z", to: "2026-09-21T05:00:00.000Z" } });
  it("drops extra fields and refuses unsupported qualification", () => {
    expect(projectRequestStagesReport({ ...complete(), privateText: "hidden" })).not.toHaveProperty("privateText");
    expect(() => projectRequestStagesReport({ ...complete(), qualified_requests: 3 })).toThrow();
  });
  it("refuses negative, missing, duplicated, unreconciled and unknown source counts", () => {
    for (const raw of [{ ...complete(), created_requests: -1 }, { ...complete(), created_requests: undefined }, { ...complete(), created_requests: 7 }, { ...complete(), source_groups: [...complete().source_groups, ...complete().source_groups] }, { ...complete(), source_groups: [{ ...complete().source_groups[0], source_group: "private arbitrary value" }] }]) expect(() => projectRequestStagesReport(raw)).toThrow();
  });
});
