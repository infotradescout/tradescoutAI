// Actual contracts/service/route handlers; PostgreSQL and HTTP framework ports are mocked.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as contract from "../shared/jwStoneEmployeeAccess.ts";
const source = stripTypeScriptTypes(await readFile(new URL("../server/services/jwStoneEmployeeAccessService.ts", import.meta.url), "utf8"));
const routeSource = stripTypeScriptTypes(await readFile(new URL("../server/routes/jw-stone-employee-access.ts", import.meta.url), "utf8"));
const target = { profileSlug: "jw-stone", businessId: "test-jw", businessOwnerUserId: "owner" };
const owner = { id: "owner" };
const scopes = [...contract.JW_STONE_EMPLOYEE_SCOPES];
const change = (overrides = {}) => contract.parseJwStoneEmployeeAccessChange({ userId: "employee", allowed: true, expectedRevision: null, confirmed: true, ...overrides });
const err = status => error => error instanceof contract.JwStoneEmployeeAccessError && error.status === status;
async function load(source, deps, context = createContext({ console, URL, process: { env: {} } })) {
  const module = new SourceTextModule(source, { context });
  await module.link(async key => {
    assert.ok(deps[key], `unexpected dependency ${key}`);
    return new SyntheticModule(Object.keys(deps[key]), function () { for (const [name, value] of Object.entries(deps[key])) this.setExport(name, value); }, { context });
  });
  await module.evaluate();
  return module.namespace;
}
async function harness(options = {}) {
  const users = new Map([
    ["owner", { userId: "owner", email: "owner@example.test", role: "business_owner" }],
    ["employee", { userId: "employee", email: "employee@example.test", firstName: "Test", lastName: "Staff", role: "homeowner" }],
    ["buyer", { userId: "buyer", email: "buyer@example.test", role: "business_owner" }],
    ["admin", { userId: "admin", email: "admin@example.test", roles: ["head_admin"] }],
  ]);
  let record = options.record ? structuredClone(options.record) : null;
  let savedRecord, savedAuditCount, transaction = false, revision = 0;
  const audit = [], log = [];
  const joined = user => ({ ...user, ...(user.userId === "employee" ? record : null) });
  const query = async (sql, values = []) => {
    log.push({ sql, values });
    if (sql === "BEGIN") { transaction = true; savedRecord = structuredClone(record); savedAuditCount = audit.length; return { rows: [] }; }
    if (sql === "COMMIT") { transaction = false; return { rows: [] }; }
    if (sql === "ROLLBACK") { record = savedRecord; audit.length = savedAuditCount; transaction = false; if (options.rollbackFails) throw new Error("rollback failed"); return { rows: [] }; }
    if (sql.startsWith("SET LOCAL")) return { rows: [] };
    if (sql.includes("pg_advisory_xact_lock")) { assert.equal(transaction, true); if (options.lockFails) throw Object.assign(new Error("lock timeout"), { code: "55P03" }); return { rows: [] }; }
    if (sql.includes("FROM stone_inventory_delegations") && !sql.startsWith("INSERT")) {
      assert.equal(values[0], "test-jw"); assert.match(sql, /delegate_business_id IS NULL/);
      if (options.databaseFails) throw new Error("database unavailable");
      return { rows: values[1] === "employee" && record ? [structuredClone(record)] : [] };
    }
    if (sql.includes("FROM users u")) {
      assert.equal(values[0], "test-jw"); assert.match(sql, /d.holder_business_id = \$1/);
      if (sql.includes("FOR UPDATE OF u")) return { rows: users.has(values[1]) ? [joined(users.get(values[1]))] : [] };
      if (sql.includes("WHERE lower(u.email) = $2")) {
        const found = [...users.values()].filter(user => user.email.toLowerCase() === values[1]);
        return { rows: options.ambiguous ? [joined(users.get("employee")), joined(users.get("employee"))] : found.map(joined) };
      }
      return { rows: [joined(users.get("owner")), joined(users.get("employee"))] };
    }
    if (sql.startsWith("INSERT INTO stone_inventory_delegations")) {
      assert.equal(transaction, true); assert.equal(values[0], target.businessId); assert.equal(values[1], "employee");
      assert.match(sql, /ON CONFLICT \(holder_business_id, delegate_user_id\)/);
      assert.match(sql, /WHERE stone_inventory_delegations.updated_at::text = \$6/);
      if (options.writeConflict) return { rows: [] };
      record = { status: values[3], scopes: values[2], revision: `revision-${++revision}`, expired: false };
      return { rows: [{ revision: record.revision }] };
    }
    if (sql.startsWith("INSERT INTO admin_audit_log")) {
      assert.equal(transaction, true);
      if (options.auditFails) throw new Error("audit write failed");
      audit.push({ type: values[0], actor: values[1], userId: values[2], metadata: JSON.parse(values[3]) });
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const client = { query, release: destroy => log.push({ release: destroy }) };
  const service = await load(source, {
    "../db": { pool: { query, connect: async () => client } },
    "./stoneInventoryService": { getStoneInventoryProfileTarget: async () => options.noTarget ? null : options.otherTarget ? { ...target, profileSlug: "other" } : target },
    "@shared/jwStoneEmployeeAccess": contract,
  }, createContext({ console, process: { env: { JW_STONE_EMPLOYEE_USER_IDS: options.configured || "" } } }));
  return { service, log, audit, get record() { return record; } };
}

test("mutation requires an immutable account ID, explicit choice, revision and confirmation", () => {
  assert.equal(change().confirmed, true);
  for (const input of [null, [], {}, { ...change(), confirmed: false }, { ...change(), allowed: "true" }, { ...change(), expectedRevision: undefined }, { ...change(), userId: "\n" }, { ...change(), scopes: scopes }, { ...change(), businessId: "other" }]) assert.throws(() => contract.parseJwStoneEmployeeAccessChange(input), err(400));
});
test("exact email lookup normalizes case and rejects partial or unexpected data", () => {
  assert.equal(contract.parseJwStoneEmployeeLookup({ email: " STAFF@Example.test " }), "staff@example.test");
  for (const input of [null, {}, { email: "staff" }, { email: "x@example.test", userId: "admin" }, { email: "x@example.test y" }]) assert.throws(() => contract.parseJwStoneEmployeeLookup(input), err(400));
});
test("anonymous and missing or wrong JW profile linkage fail closed", async () => {
  assert.equal((await (await harness()).service.getJwStoneEmployeeAccess(undefined)).allowed, false);
  for (const options of [{ noTarget: true }, { otherTarget: true }]) assert.equal((await (await harness(options)).service.getJwStoneEmployeeAccess(owner)).canManageStaff, false);
});
test("owner and platform super/head administrators can manage assignments", async () => {
  const h = await harness();
  for (const user of [owner, { id: "admin", role: "super_admin" }, { id: "admin", roles: ["head_admin"] }]) {
    const access = await h.service.getJwStoneEmployeeAccess(user);
    assert.equal(access.allowed, true); assert.equal(access.canManageStaff, true);
  }
});
test("customer membership and self-declared employment never grant employee access", async () => {
  const h = await harness();
  for (const user of [{ id: "buyer", role: "business_member", isEmployee: true }, { id: "employee", role: "employee" }, { id: "buyer", role: "business_owner" }]) {
    assert.equal((await h.service.getJwStoneEmployeeAccess(user)).allowed, false);
    await assert.rejects(h.service.setJwStoneEmployeeAccess(user, change()), err(403));
  }
  assert.equal(h.audit.length, 0);
});
test("exact directly assigned full scopes permit receiving, not staff management", async () => {
  const h = await harness({ record: { status: "active", scopes, revision: "r1", expired: false } });
  assert.equal((await h.service.jwStoneEmployeeTarget({ id: "employee" })).businessId, target.businessId);
  assert.equal((await h.service.getJwStoneEmployeeAccess({ id: "employee" })).canManageStaff, false);
  await assert.rejects(h.service.listJwStoneEmployeeAccounts({ id: "employee" }), err(403));
});
for (const [label, record] of [
  ["revoked", { status: "revoked", scopes, revision: "r1", expired: false }],
  ["revoked-timestamp", { status: "active", scopes, revision: "r1", expired: false, revoked: true }],
  ["expired", { status: "active", scopes, revision: "r1", expired: true }],
  ["read-only", { status: "active", scopes: ["inventory_read"], revision: "r1", expired: false }],
]) test(`${label} database assignment overrides the old configured allowlist`, async () => {
  const h = await harness({ configured: "employee", record });
  assert.equal((await h.service.getJwStoneEmployeeAccess({ id: "employee" })).allowed, false);
});
test("old configured IDs work only when no explicit database record exists", async () => {
  const h = await harness({ configured: "employee,another-user" });
  assert.equal((await h.service.getJwStoneEmployeeAccess({ id: "employee" })).allowed, true);
  assert.equal((await h.service.getJwStoneEmployeeAccess({ id: "emp" })).allowed, false);
});
test("database failure cannot silently fall back to a configured grant", async () => {
  const h = await harness({ configured: "employee", databaseFails: true });
  await assert.rejects(h.service.getJwStoneEmployeeAccess({ id: "employee" }), /database unavailable/);
});
test("lookup returns exact account and limited identity fields without granting anything", async () => {
  const h = await harness();
  const result = await h.service.findJwStoneEmployeeAccount(owner, "employee@example.test");
  assert.equal(result.account.userId, "employee"); assert.equal(result.account.allowed, false);
  assert.deepEqual(Object.keys(result.account).sort(), ["userId", "email", "name", "allowed", "source", "revision", "expired"].sort());
  assert.equal(h.record, null); assert.equal(h.audit.length, 0);
});
test("unmatched, ambiguous and employee-initiated lookups fail without writes", async () => {
  await assert.rejects((await harness()).service.findJwStoneEmployeeAccount(owner, "missing@example.test"), err(404));
  await assert.rejects((await harness({ ambiguous: true })).service.findJwStoneEmployeeAccount(owner, "employee@example.test"), err(409));
  await assert.rejects((await harness({ configured: "employee" })).service.findJwStoneEmployeeAccount({ id: "employee" }, "employee@example.test"), err(403));
});
test("owner grant takes effect on the next authorization check and records its actor", async () => {
  const h = await harness();
  const result = await h.service.setJwStoneEmployeeAccess(owner, change());
  assert.equal(result.account.allowed, true); assert.equal(h.record.status, "active");
  assert.equal((await h.service.getJwStoneEmployeeAccess({ id: "employee" })).allowed, true);
  assert.equal(h.audit[0].actor, "owner"); assert.equal(h.audit[0].metadata.businessId, "test-jw");
  assert.deepEqual([...h.audit[0].metadata.scopes], scopes);
  assert.ok(h.log.findIndex(row => row.sql?.includes("admin_audit_log")) < h.log.findIndex(row => row.sql === "COMMIT"));
});
test("revoking an allowlisted account creates a durable deny record", async () => {
  const h = await harness({ configured: "employee" });
  await h.service.setJwStoneEmployeeAccess(owner, change({ allowed: false }));
  assert.equal(h.record.status, "revoked"); assert.equal(h.record.scopes.length, 0);
  assert.equal((await h.service.getJwStoneEmployeeAccess({ id: "employee" })).allowed, false);
  assert.equal(h.audit[0].type, "jw_stone_employee_access_revoked");
});
test("regrant uses the current record revision rather than creating another delegation", async () => {
  const h = await harness({ record: { status: "revoked", scopes: [], revision: "old", expired: true } });
  const result = await h.service.setJwStoneEmployeeAccess(owner, change({ expectedRevision: "old" }));
  assert.equal(result.account.allowed, true); assert.equal(result.account.expired, false);
});
test("stale manager views and conflicting writes return 409 without audit or grants", async () => {
  for (const options of [{ record: { status: "revoked", scopes: [], revision: "newer" } }, { writeConflict: true }]) {
    const h = await harness(options);
    await assert.rejects(h.service.setJwStoneEmployeeAccess(owner, change()), err(409));
    assert.equal(h.audit.length, 0); assert.ok(h.log.some(row => row.sql === "ROLLBACK"));
  }
});
test("owner and administrator roles cannot be removed through employee delegation", async () => {
  const h = await harness();
  for (const id of ["owner", "admin"]) await assert.rejects(h.service.setJwStoneEmployeeAccess(owner, change({ userId: id, allowed: false })), err(409));
  assert.equal(h.audit.length, 0);
});
test("no assignment persists if the audit insert fails", async () => {
  const h = await harness({ auditFails: true });
  await assert.rejects(h.service.setJwStoneEmployeeAccess(owner, change()), /audit write failed/);
  assert.equal(h.record, null); assert.equal(h.audit.length, 0); assert.equal(h.log.at(-1).release, false);
});
test("lock conflicts return retryable 409 and failed rollback destroys the connection", async () => {
  const h = await harness({ lockFails: true, rollbackFails: true });
  await assert.rejects(h.service.setJwStoneEmployeeAccess(owner, change()), err(409));
  assert.equal(h.log.at(-1).release, true);
});
test("list projects owner, explicit permissions and existing configured accounts", async () => {
  const h = await harness({ configured: "employee" });
  const result = await h.service.listJwStoneEmployeeAccounts(owner);
  assert.equal(result.viewerId, "owner"); assert.equal(result.accounts[0].source, "owner");
  assert.equal(result.accounts[1].source, "server_configuration");
});

async function routes(options = {}) {
  const rows = [], calls = [];
  const noop = (_req, _res, next) => next?.();
  const api = { listJwStoneEmployeeAccounts: async () => ({ viewerId: "owner", accounts: [] }),
    findJwStoneEmployeeAccount: async (...args) => { calls.push(args); return { viewerId: "owner" }; },
    setJwStoneEmployeeAccess: async (...args) => { calls.push(args); if (options.error) throw options.error; return { viewerId: "owner" }; } };
  const module = await load(routeSource, {
    "express-rate-limit": { default: () => noop }, "../auth": { isAuthenticated: noop },
    "../schemaPreflight": { requireCriticalSchema: () => noop }, "@shared/jwStoneEmployeeAccess": contract,
    "../services/jwStoneEmployeeAccessService": api,
  });
  const app = Object.fromEntries(["use", "get", "post", "put"].map(method => [method, (...args) => rows.push({ method, path: args[0], handlers: args.slice(1) })]));
  module.registerJwStoneEmployeeAccessRoutes(app);
  const request = (body, overrides = {}) => ({ protocol: "https", user: owner, body, get: key => ({ Origin: "https://jw.example.test", Host: "jw.example.test", "X-JW-Receiving": "1", ...overrides })[key] });
  const response = () => ({ code: 200, headers: {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(key,value) { this.headers[key]=value; }, vary() {} });
  return { module, rows, calls, request, response };
}
test("staff writes require same-origin browser intent and reject missing or cross-origin headers", async () => {
  const h = await routes();
  assert.equal(h.module.isJwStoneStaffSameOrigin(h.request({})), true);
  assert.equal(h.module.isJwStoneStaffSameOrigin({ ...h.request({}), protocol: "http" }), false);
  for (const headers of [{ Origin: undefined }, { Origin: "null" }, { Origin: "https://evil.test" }, { "X-JW-Receiving": undefined }, { Origin: "https://jw.example.test/path" }]) {
    const res = h.response(); await h.rows.find(row => row.method === "put").handlers.at(-1)(h.request(change(), headers), res);
    assert.equal(res.code, 403);
  }
  assert.equal(h.calls.length, 0);
});
test("staff responses disable browser and CDN caching", async () => {
  const h = await routes(), res = h.response();
  h.rows.find(row => row.method === "use").handlers[0]({}, res, () => {});
  assert.equal(res.headers["Cache-Control"], "private, no-store"); assert.equal(res.headers["CDN-Cache-Control"], "no-store");
});
test("route validates the explicit assignment before invoking the service", async () => {
  const h = await routes(), handler = h.rows.find(row => row.method === "put").handlers.at(-1);
  const bad = h.response(); await handler(h.request({ ...change(), confirmed: false }), bad);
  assert.equal(bad.code, 400); assert.equal(h.calls.length, 0);
  const good = h.response(); await handler(h.request(change()), good); assert.equal(good.code, 200); assert.equal(h.calls.length, 1);
});
test("route retains service conflict status instead of reporting a successful grant", async () => {
  const h = await routes({ error: new contract.JwStoneEmployeeAccessError("Stale revision", 409) });
  const res = h.response(); await h.rows.find(row => row.method === "put").handlers.at(-1)(h.request(change()), res);
  assert.equal(res.code, 409); assert.equal(res.data.message, "Stale revision");
});
