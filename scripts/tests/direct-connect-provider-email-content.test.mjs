/**
 * Focused source-executed tests. Database queries/conditional writes, county
 * lookup and the external email adapter are mocked. This does NOT prove native
 * PostgreSQL predicates/locking, migrations, a browser journey or delivery.
 * Run: node --test scripts/tests/direct-connect-provider-email-content.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const serviceSource = read("server/notification-service.ts");
const presentationSource = read("server/utils/directConnectProviderEmail.ts");
const shareSource = read("server/utils/workRequestShare.ts");

function load(source, dependencies, filename) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename, reportDiagnostics: true,
  });
  assert.deepEqual((compiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error), []);
  const exports = {};
  const env = { APP_URL: "https://www.thetradescout.com" };
  const sandbox = {
    exports, module: { exports }, URL, URLSearchParams, Date, console,
    process: { env },
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  vm.runInNewContext(compiled.outputText, sandbox, { filename, timeout: 5000 });
  return { exports: sandbox.module.exports, env };
}

// Execute only these unchanged pure functions from the real shared owner.
// Do not replace its budget/redaction behavior with a test reimplementation.
const shareAst = ts.createSourceFile("workRequestShare.ts", shareSource, ts.ScriptTarget.Latest, true);
const sharedNames = new Set(["formatCurrencyValue", "formatBudgetRange", "redactContactDetails"]);
const sharedFunctions = shareAst.statements
  .filter((node) => ts.isFunctionDeclaration(node) && sharedNames.has(node.name?.text))
  .map((node) => node.getText(shareAst)).join("\n");
assert.equal(sharedFunctions.match(/function /g)?.length, 3);
const shared = load(sharedFunctions, {}, "workRequestShare.functions.ts").exports;
const presentation = load(presentationSource, {
  "./workRequestShare": shared,
  "@shared/states-counties": { getCountyByFips: (fips) => fips === "12001"
    ? { fipsCode: "12001", name: "Alachua County", state: "FL" } : undefined },
}, "directConnectProviderEmail.ts").exports;

const tableNames = ["notifications", "notificationPreferences", "userPersonalEvents",
  "notificationTemplates", "notificationDeliveryLog", "notificationJobs", "users",
  "pushSubscriptions", "workRequests", "workRequestAssignments", "workRequestEvents",
  "contractors", "businesses"];
const schema = Object.fromEntries(tableNames.map((table) => [table,
  new Proxy({ table }, { get: (target, field) => field === "table" ? table : { table, field } }),
]));
const op = (kind) => (...args) => ({ kind, args });
const drizzle = Object.fromEntries(["eq", "and", "or", "desc", "asc", "isNull", "inArray"]
  .map((kind) => [kind, op(kind)]));
drizzle.sql = (parts, ...values) => ({ kind: "sql", parts: [...parts], values });
function matches(row, predicate) {
  if (!predicate) return true;
  const [left, right] = predicate.args || [];
  if (predicate.kind === "eq") return row[left.field] === right;
  if (predicate.kind === "inArray") return right.includes(row[left.field]);
  if (predicate.kind === "and") return predicate.args.every((entry) => matches(row, entry));
  throw new Error(`Unsupported mocked read predicate: ${predicate.kind}`);
}
class FixtureDeliveryError extends Error {
  constructor(disposition) { super(disposition); this.disposition = disposition; }
}
function fixture(kind = "contractor") {
  const at = new Date("2026-09-14T12:00:00.000Z");
  const request = {
    id: "request-1", createdByUserId: "requester", source: "direct_connect", status: "routed",
    title: "Kitchen plumbing", description: "Replace the sink at 12 Example Lane.\nStart next Tuesday; call +15555550123.",
    tradeId: "plumbing", category: "service_request", countyFips: "12001", stateCode: "FL",
    budgetMin: "1000", budgetMax: "2500", attachments: ["/private/a.jpg", "/private/b.jpg"],
  };
  const assignment = {
    id: "assignment-1", workRequestId: request.id, contractorId: kind === "contractor" ? "contractor-1" : null,
    responderUserId: "provider", workerId: null, status: "invited", createdAt: at,
    scoreSnapshot: { submissionContactRecipientUserId: "provider" },
  };
  const providerEvent = {
    id: "event-1", workRequestId: request.id, type: "provider_invited", actorUserId: "requester", createdAt: at,
    metadata: { source: "direct_connect", assignmentId: assignment.id,
      ...(kind === "contractor" ? { contractorId: "contractor-1", contractorUserId: "provider" }
        : { responderUserId: "provider", businessId: "business-1" }) },
  };
  const receipt = { version: 1, source: "request_submission", workRequestId: request.id,
    requesterUserId: "requester", name: "Submitted Customer", phone: "+15555550123" };
  const created = { id: "created-1", workRequestId: request.id, type: "created", actorUserId: "requester",
    createdAt: at, metadata: { source: "direct_connect", submissionContact: receipt } };
  const id = `dc-provider:${createHash("sha256").update(JSON.stringify([
    request.id, assignment.id, providerEvent.id, "provider",
  ])).digest("hex")}`;
  const notification = {
    id, userId: "provider", type: "new_project_request", title: "Untrusted notification text",
    message: "unrelated@example.net", deliveryMethods: ["email"],
    metadata: { directConnectProviderEmail: { requestId: request.id, assignmentId: assignment.id, eventId: providerEvent.id } },
    actionUrl: "https://attacker.example/collect", isArchived: false,
  };
  const tables = {
    workRequests: [request], workRequestAssignments: [assignment], workRequestEvents: [providerEvent, created],
    contractors: kind === "contractor" ? [{ id: "contractor-1", userId: "provider" }] : [],
    businesses: kind === "business" ? [{ id: "business-1", ownerUserId: "provider" }] : [],
    users: [{ id: "provider", email: "provider@example.com", firstName: "<Provider>", emailVerified: true },
      { id: "requester", email: "requester@example.com", firstName: "Different profile name", phone: "+15559999999" }],
    notifications: [notification], notificationPreferences: [{ userId: "provider", enableNotifications: true,
      enableEmailNotifications: true, typePreferences: { new_project_request: { enabled: true, delivery_methods: ["email"] } } }],
  };
  const f = { tables, request, assignment, providerEvent, created, receipt, notification,
    sent: [], outcomes: [], reads: [], writes: [], allowSubmission: true, eligible: async () => true };
  const db = {
    select(selection) {
      let table, predicate;
      const query = {
        from(value) { table = value.table; return query; },
        where(value) { predicate = value; return query; },
        innerJoin() { return query; }, leftJoin() { return query; },
        then(resolve, reject) {
          try {
            f.reads.push({ table, selection });
            const found = (tables[table] || []).filter((row) => matches(row, predicate));
            const result = found.map((row) => {
              if (selection?.notification === schema.notifications) return {
                notification: row, user: tables.users.find((u) => u.id === row.userId),
                preferences: tables.notificationPreferences.find((p) => p.userId === row.userId) || null,
              };
              return selection ? Object.fromEntries(Object.entries(selection).map(([key, col]) => [key, row[col.field]])) : row;
            });
            return Promise.resolve(structuredClone(result)).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      };
      return query;
    },
    update(table) {
      const write = { table: table.table };
      const query = {
        set(values) { write.values = values; return query; },
        where(predicate) { write.predicate = predicate; return query; },
        async returning() { f.writes.push(write); return f.allowSubmission ? [{ id: "job-1" }] : []; },
      };
      return query;
    },
  };
  const loaded = load(serviceSource, {
    "./db": { db }, "@shared/schema": schema, "drizzle-orm": drizzle, "node:crypto": { createHash },
    "web-push": {}, "./utils/directConnectProviderEmail": presentation,
    "./services/emailService": {
      emailService: { sendEmail: async (payload) => { f.sent.push(payload); return { provider: "fixture", messageId: "fixture-1" }; } },
      EmailDeliveryError: FixtureDeliveryError, maskEmailForLog: () => "masked",
    },
  }, "notification-service.ts");
  f.service = new loaded.exports.NotificationService();
  f.service.configureDirectConnectEmailEligibility((context) => f.eligible(context));
  f.service.finishEmailJob = async (_job, outcome) => { f.outcomes.push(outcome); };
  f.env = loaded.env;
  f.job = { id: `notification-email:${id}`, targetUserIds: ["provider"], retryCount: 1, maxRetries: 5,
    templateData: { notificationId: id, leaseId: "lease-1" } };
  f.run = () => f.service.deliverEmailJob(f.job);
  return f;
}

for (const kind of ["contractor", "business"]) {
  test(`authorized ${kind} receives complete request and captured name/phone without a second release`, async () => {
    const f = fixture(kind);
    await f.run();
    assert.equal(f.sent.length, 1);
    const mail = f.sent[0];
    assert.equal(mail.to, "provider@example.com");
    assert.equal(mail.subject, "Direct Connect — plumbing: Kitchen plumbing");
    for (const value of ["Kitchen plumbing", "plumbing", "Alachua County, FL", "$1,000-$2,500",
      "Attachments/photos: 2", "Submitted Customer", "+15555550123", "Account email: requester@example.com",
      "12 Example Lane", "Start next Tuesday"]) {
      assert.ok(mail.html.includes(value), `HTML missing ${value}`);
      assert.ok(mail.text.includes(value), `Text missing ${value}`);
    }
    assert.ok(mail.html.includes("<br>"));
    assert.ok(mail.html.includes("&lt;Provider&gt;"));
    assert.ok(mail.text.includes("/direct-connect/inbox?selected=assignment-1&filter=all&county=12001"));
    assert.ok(mail.html.includes("/direct-connect/inbox?selected=assignment-1&amp;filter=all&amp;county=12001"));
    for (const denied of ["attacker.example", "unrelated@example.net", "Different profile name", "+15559999999", "/private/a.jpg"]) {
      assert.ok(!mail.html.includes(denied) && !mail.text.includes(denied));
    }
    assert.equal(mail.singleAttempt, true);
    assert.equal(mail.correlationId, f.notification.id);
    assert.equal(f.outcomes[0].status, "accepted");
    for (const read of f.reads.filter((r) => r.table === "users")) {
      assert.deepEqual(Object.keys(read.selection), ["id", "email"]);
    }
  });
}

const rejectedMutations = {
  unassigned: (f) => { f.tables.contractors[0].userId = "other"; },
  "conflicting responder": (f) => { f.assignment.responderUserId = "other"; },
  "conflicting snapshot recipient": (f) => { f.assignment.scoreSnapshot.submissionContactRecipientUserId = "other"; },
  "empty snapshot recipient": (f) => { f.assignment.scoreSnapshot.submissionContactRecipientUserId = ""; },
  "ambiguous assignment": (f) => { f.tables.workRequestAssignments.push({ ...f.assignment, id: "another", status: "declined" }); },
  withdrawn: (f) => { f.assignment.status = "withdrawn"; },
  accepted: (f) => { f.assignment.status = "accepted"; },
  cancelled: (f) => { f.request.status = "cancelled"; },
  "requester is recipient": (f) => { f.request.createdByUserId = "provider"; },
  "stale bound event": (f) => { f.providerEvent.id = "replaced"; },
  "duplicate provider event": (f) => { f.tables.workRequestEvents.push({ ...f.providerEvent, id: "extra" }); },
  "duplicate created receipt": (f) => { f.tables.workRequestEvents.push({ ...f.created, id: "extra" }); },
  "wrong created actor": (f) => { f.created.actorUserId = "other"; },
  "staff created record": (f) => { f.created.metadata.author = { kind: "staff" }; },
  "Express record mixed into normal route": (f) => { f.created.metadata.source = "tradepartner_profile"; },
  "null receipt": (f) => { f.created.metadata.submissionContact = null; },
  "array receipt": (f) => { f.created.metadata.submissionContact = []; },
  "wrong receipt requester": (f) => { f.receipt.requesterUserId = "other"; },
  "wrong receipt request": (f) => { f.receipt.workRequestId = "other"; },
  "malformed phone": (f) => { f.receipt.phone = "555"; },
  "malformed name": (f) => { f.receipt.name = " "; },
  "missing requester": (f) => { f.tables.users.pop(); },
  "wrong job recipient": (f) => { f.job.targetUserIds = ["other"]; },
  "unverified recipient": (f) => { f.tables.users[0].emailVerified = false; },
  "provider opted out": (f) => { f.tables.notificationPreferences[0].enableEmailNotifications = false; },
  "ineligible provider": (f) => { f.eligible = async () => false; },
};
for (const [name, mutate] of Object.entries(rejectedMutations)) {
  test(`rejects ${name} without sending contact`, async () => {
    const f = fixture(); mutate(f); await f.run();
    assert.equal(f.sent.length, 0);
    assert.equal(f.outcomes[0].status, "cancelled");
  });
}

for (const field of ["email", "name", "scope"]) {
  test(`retries ${field} changed during asynchronous eligibility rather than sending stale content`, async () => {
    const f = fixture();
    f.eligible = async () => {
      if (field === "email") f.tables.users[1].email = "updated@example.com";
      if (field === "name") f.receipt.name = "Updated Customer";
      if (field === "scope") f.request.description = "Changed scope";
      return true;
    };
    await f.run();
    assert.equal(f.sent.length, 0);
    assert.equal(f.outcomes[0].status, "retry");
  });
}

test("honors a refused guarded submission transition", async () => {
  const f = fixture(); f.allowSubmission = false; await f.run();
  assert.equal(f.sent.length, 0);
  assert.equal(f.outcomes[0].code, "submission_authority_changed");
  const compiledGuard = JSON.stringify(f.writes[0].predicate);
  for (const token of ["provider_event", "creation_event", "requester.email", "owned_assignment", "leaseId"])
    assert.ok(compiledGuard.includes(token), `Missing guard fragment ${token}`);
});

test("keeps unresolved legacy notifications neutral instead of reading profile contact", async () => {
  const f = fixture(); f.tables.workRequestEvents.splice(1); await f.run();
  assert.equal(f.sent[0].subject, "Direct Connect update");
  assert.ok(!f.sent[0].html.includes("requester@example.com"));
  assert.equal(f.reads.filter((r) => r.table === "users").length, 0);
});

test("escapes body markup and keeps subject single-line and bounded", async () => {
  const f = fixture();
  f.request.title = "<img src=x onerror=alert(1)>\r\nBcc: forged@example.com" + "🧱".repeat(300);
  f.request.description = "<script>evil()</script>\nUse & protect the room";
  await f.run();
  assert.ok(!/[\r\n]/.test(f.sent[0].subject));
  assert.ok(Array.from(f.sent[0].subject).length <= 240);
  assert.ok(!f.sent[0].html.includes("<img") && !f.sent[0].html.includes("<script>"));
  assert.ok(f.sent[0].html.includes("&lt;script&gt;evil()&lt;/script&gt;<br>"));
  assert.ok(f.sent[0].text.includes("<script>evil()</script>"));
});

test("omits unsupplied optional data and never invents prices, addresses or dates", async () => {
  const f = fixture();
  Object.assign(f.request, { budgetMin: null, budgetMax: null, attachments: null, countyFips: null,
    stateCode: null, tradeId: null, category: null, description: "Scope only" });
  f.tables.users[1].email = null;
  await f.run();
  const mail = f.sent[0];
  for (const denied of ["Budget:", "Service area:", "Attachments/photos:", "Account email:", "12 Example", "Tuesday"])
    assert.ok(!mail.text.includes(denied));
  assert.ok(mail.text.includes("selected=assignment-1&filter=all&county="));
});

test("public contact redaction owner still removes phone and email", () => {
  const redacted = shared.redactContactDetails("Call +15555550123 or requester@example.com");
  assert.ok(!redacted.includes("15555550123") && !redacted.includes("requester@example.com"));
});
