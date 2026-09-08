import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

assert.equal(process.env.NODE_ENV, "test");
const target = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.pathname, "/ts_operator_test");
const directory = path.resolve("test-results/operator-http-proof");
const fixture = JSON.parse(await readFile(path.join(directory, "fixture.private.json"), "utf8"));
assert.equal(fixture.baseUrl, "http://127.0.0.1:5218");
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await client.connect();
assert.equal(
  (await client.query("SELECT current_database() AS name")).rows[0].name,
  "ts_operator_test"
);
// This SQL-owned accounting dependency is intentionally outside Drizzle's schema.
if (!(await client.query("SELECT to_regclass('public.documents') AS relation")).rows[0].relation)
  await client.query(await readFile("migrations/0005_documents.sql", "utf8"));
if (
  !(await client.query("SELECT to_regclass('public.accounting_automation_events') AS relation"))
    .rows[0].relation
)
  await client.query(await readFile("migrations/0094_accounting_books_foundation.sql", "utf8"));
await client.query("ALTER DATABASE ts_operator_test SET timezone TO 'UTC'");
const evidence: any[] = [];
const attemptId = randomUUID();
const cookies: Record<string, string> = {};
async function call(
  actor: string,
  method: string,
  url: string,
  body?: unknown,
  expected?: number | number[]
) {
  const response = await fetch(fixture.baseUrl + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 Synthetic Operator Route Proof",
      ...(cookies[actor] ? { Cookie: cookies[actor] } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookie = response.headers.getSetCookie();
  if (cookie.length) cookies[actor] = cookie.map((value) => value.split(";")[0]).join("; ");
  const payload = await response.json();
  evidence.push({ actor, method, url, status: response.status });
  console.log(`${actor} ${method} ${url} => ${response.status}`);
  if (expected !== undefined)
    assert.ok(
      (Array.isArray(expected) ? expected : [expected]).includes(response.status),
      `${response.status}: ${JSON.stringify(payload)}`
    );
  return payload;
}
try {
  for (const [actor, user] of Object.entries<any>(fixture.identities)) {
    await client.query("UPDATE users SET phone = '2025550147' WHERE id = $1", [user.id]);
    const login = await call(
      actor,
      "POST",
      "/api/auth/login",
      { email: user.email, password: fixture.password },
      200
    );
    assert.equal(login.user.id, user.id);
  }
  await call(
    "anonymous",
    "GET",
    "/api/admin/direct-connect/requests/missing/messages",
    undefined,
    401
  );
  await call(
    "ordinary-admin",
    "GET",
    "/api/admin/direct-connect/requests/missing/messages",
    undefined,
    403
  );
  const request = await call(
    "requester",
    "POST",
    "/api/direct-connect/requests",
    {
      operationId: `http-proof-${attemptId}`,
      title: "Synthetic Alachua installation request",
      description: "Replace a kitchen counter and clarify the installation schedule.",
      category: "service_request",
      countyFips: "12001",
      stateCode: "FL",
      autoRoute: false,
    },
    [200, 201]
  );
  const requestId = request.id;
  assert.ok(requestId);
  fixture.requestId = requestId;
  const base = `/api/admin/direct-connect/requests/${requestId}`;
  await call("requester", "GET", `${base}/messages`, undefined, 403);
  await call(
    "provider",
    "POST",
    `${base}/assignments`,
    {
      operationId: `unauthorized-${fixture.runId}`,
      providerId: fixture.providerId,
      reason: "Synthetic permission rejection proof.",
    },
    403
  );
  await client.query("DELETE FROM contractor_counties WHERE contractor_id = $1", [
    fixture.providerId,
  ]);
  const invite = {
    operationId: `invite-http-${fixture.runId}`,
    providerId: fixture.providerId,
    reason: "Requester requested this eligible local installer.",
  };
  await call("operator", "POST", `${base}/assignments`, invite, 422);
  await client.query(
    "INSERT INTO contractor_counties (contractor_id, county_id) SELECT $1, id FROM counties WHERE fips = '12001'",
    [fixture.providerId]
  );
  await client.query("UPDATE direct_connect_dispatch_requests SET user_id=$2 WHERE id=$1", [
    requestId,
    fixture.identities.unrelated.id,
  ]);
  await call("operator", "POST", `${base}/assignments`, invite, 409);
  await client.query("UPDATE direct_connect_dispatch_requests SET user_id=$2 WHERE id=$1", [
    requestId,
    fixture.identities.requester.id,
  ]);
  for (const [table, condition] of [
    [
      "direct_connect_dispatch_candidates",
      "eligibility_reasons <> '[\"admin_manual_eligible_provider\"]'::jsonb",
    ],
    ["admin_audit_log", "type <> 'admin_direct_connect_provider_invited'"],
  ]) {
    await client.query(
      `ALTER TABLE ${table} ADD CONSTRAINT operator_http_failure CHECK (${condition}) NOT VALID`
    );
    try {
      await call("operator", "POST", `${base}/assignments`, invite, 500);
      const counts = (
        await client.query(
          `SELECT
        (SELECT count(*) FROM work_request_assignments WHERE work_request_id=$1)::int AS assignments,
        (SELECT count(*) FROM direct_connect_dispatch_candidates WHERE request_id=$1)::int AS candidates,
        (SELECT count(*) FROM work_request_events WHERE work_request_id=$1 AND type='provider_invited')::int AS events,
        (SELECT count(*) FROM admin_audit_log WHERE metadata->>'requestId'=$1)::int AS audits`,
          [requestId]
        )
      ).rows[0];
      assert.deepEqual(counts, { assignments: 0, candidates: 0, events: 0, audits: 0 });
      assert.equal(
        (await client.query("SELECT status FROM work_requests WHERE id=$1", [requestId])).rows[0]
          .status,
        "open"
      );
    } finally {
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT operator_http_failure`);
    }
  }
  const assignment = await call("operator", "POST", `${base}/assignments`, invite, 201);
  fixture.assignmentId = assignment.assignmentId;
  assert.equal(assignment.notificationQueued, true);
  const replay = await call("operator", "POST", `${base}/assignments`, invite, 200);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.assignmentId, assignment.assignmentId);
  await call(
    "operator",
    "POST",
    `${base}/assignments`,
    { ...invite, reason: "Changed payload must fail replay validation." },
    409
  );
  assert.equal(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM work_request_assignments WHERE work_request_id=$1",
          [requestId]
        )
      ).rows[0].count
    ),
    1
  );
  assert.equal(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM admin_audit_log WHERE COALESCE(metadata->>'requestId',metadata->>'workRequestId')=$1",
          [requestId]
        )
      ).rows[0].count
    ),
    1
  );
  assert.equal(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM direct_connect_dispatch_candidates WHERE request_id=$1 AND contractor_id=$2 AND responder_user_id=$3",
          [requestId, fixture.providerId, fixture.identities.provider.id]
        )
      ).rows[0].count
    ),
    1
  );
  const reply = {
    operationId: `reply-http-${fixture.runId}`,
    assignmentId: fixture.assignmentId,
    content: "The requester confirmed the counter replacement scope and installation timing.",
    reason: "Staff is helping clarify the existing project scope.",
  };
  await call("operator", "POST", `${base}/replies`, reply, 409);
  const acceptance = await call(
    "provider",
    "POST",
    `/api/direct-connect/assignments/${fixture.assignmentId}/respond`,
    {
      decision: "accept",
      availabilityWindow: "Next week",
      priceBand: "custom_quote",
      scopeNote: "Review existing counter dimensions and agree on installation timing.",
    },
    200
  );
  const events = (
    await client.query(
      "SELECT metadata FROM work_request_events WHERE work_request_id=$1 AND type='provider_accepted'",
      [requestId]
    )
  ).rows;
  assert.equal(events.length, 1);
  fixture.conversationId = events[0].metadata.conversationId;
  assert.equal(events[0].metadata.assignmentId, fixture.assignmentId);
  assert.ok(fixture.conversationId);
  await call("operator", "POST", `${base}/replies`, reply, 409);
  await call(
    "unrelated",
    "POST",
    `/api/direct-connect/requests/${requestId}/contact-gate`,
    { nextState: "released" },
    403
  );
  await call(
    "unrelated",
    "POST",
    `/api/direct-connect/contractor/requests/${requestId}/request-contact`,
    {},
    403
  );
  await call(
    "provider",
    "POST",
    `/api/direct-connect/contractor/requests/${requestId}/request-contact`,
    {},
    200
  );
  await call(
    "requester",
    "POST",
    `/api/direct-connect/requests/${requestId}/contact-gate`,
    { nextState: "released" },
    409
  );
  await call(
    "requester",
    "POST",
    `/api/direct-connect/requests/${requestId}/contact-gate`,
    { nextState: "user_approved" },
    200
  );
  await call(
    "requester",
    "POST",
    `/api/direct-connect/requests/${requestId}/contact-gate`,
    { nextState: "released" },
    200
  );
  await call("requester", "POST", `${base}/replies`, reply, 403);
  const sent = await call("operator", "POST", `${base}/replies`, reply, 201);
  const replyReplay = await call("operator", "POST", `${base}/replies`, reply, 200);
  assert.equal(replyReplay.messageId, sent.messageId);
  const history = await call("operator", "GET", `${base}/messages`, undefined, 200);
  assert.equal(history.replyAssignmentId, fixture.assignmentId);
  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0].senderType, "staff");
  const adminDetail = await call("operator", "GET", base, undefined, 200);
  assert.equal(adminDetail.assignments[0].responderName, "Synthetic County Installer");
  assert.equal(adminDetail.assignments[0].responderUserId, fixture.identities.provider.id);
  for (const [responderUserId, expectedName] of [
    [fixture.identities.unrelated.id, null],
    [fixture.identities.provider.id, "Synthetic County Installer"],
  ]) {
    await client.query("UPDATE work_request_assignments SET responder_user_id=$2 WHERE id=$1", [
      fixture.assignmentId,
      responderUserId,
    ]);
    const dualIdentity = await call("operator", "GET", base, undefined, 200);
    assert.equal(dualIdentity.assignments[0].responderName, expectedName);
    if (expectedName === null) assert.equal(dualIdentity.assignments[0].responderUserId, null);
  }
  await client.query("UPDATE work_request_assignments SET responder_user_id=NULL WHERE id=$1", [
    fixture.assignmentId,
  ]);
  const providerMessages = await call(
    "provider",
    "GET",
    `/api/conversations/${fixture.conversationId}/messages`,
    undefined,
    200
  );
  const requestMessages = providerMessages.filter(
    (message: any) => message.metadata?.workRequestId === requestId
  );
  assert.equal(requestMessages.length, 1);
  assert.equal(requestMessages[0].content, reply.content);
  assert.equal(requestMessages[0].metadata.author.kind, "staff");
  assert.notEqual(fixture.providerId, fixture.identities.provider.id);
  assert.ok(!JSON.stringify(providerMessages).includes(reply.reason));
  await call(
    "requester",
    "GET",
    `/api/conversations/${fixture.conversationId}/messages`,
    undefined,
    200
  );
  await call(
    "unrelated",
    "GET",
    `/api/conversations/${fixture.conversationId}/messages`,
    undefined,
    403
  );
  const job = await call(
    "provider",
    "GET",
    `/api/direct-connect/messages/threads/${fixture.conversationId}/job`,
    undefined,
    200
  );
  assert.equal(job.requestId, requestId);
  assert.equal(job.request.county, "12001");
  assert.equal(job.assignment.id, fixture.assignmentId);
  const threadList = await call(
    "provider",
    "GET",
    "/api/messages/threads?limit=50&offset=0",
    undefined,
    200
  );
  assert.equal(
    threadList.threads.find((thread: any) => thread.id === fixture.conversationId)?.context
      .entityId,
    requestId
  );
  async function expectThreadContext(threadId: string, requestId: string | null) {
    const detail = await call(
      "provider",
      "GET",
      `/api/messages/threads/${threadId}`,
      undefined,
      200
    );
    assert.equal(detail.thread.context.kind, requestId ? "direct_connect" : "general");
    assert.equal(detail.thread.context.entityId ?? null, requestId);
  }
  await expectThreadContext(fixture.conversationId, requestId);
  await call("unrelated", "GET", `/api/messages/threads/${fixture.conversationId}`, undefined, 403);
  await call(
    "unrelated",
    "GET",
    `/api/direct-connect/messages/threads/${fixture.conversationId}/job`,
    undefined,
    403
  );
  // Adversarial persisted-state fixtures, separate from the actual HTTP journey above.
  const secondThread = randomUUID(),
    secondRequest = randomUUID(),
    secondAssignment = randomUUID(),
    secondEvent = randomUUID();
  await client.query(
    "INSERT INTO conversations (id, homeowner_id, contractor_id, status) VALUES ($1,$2,$3,'active')",
    [secondThread, fixture.identities.requester.id, fixture.providerId]
  );
  await call(
    "provider",
    "GET",
    `/api/direct-connect/messages/threads/${secondThread}/job`,
    undefined,
    404
  );
  await client.query(
    "INSERT INTO work_requests (id, created_by_user_id, title, description, source, status, county_fips) VALUES ($1,$2,'Second synthetic request','Separate scope for exact thread proof','direct_connect','in_progress','12001')",
    [secondRequest, fixture.identities.requester.id]
  );
  await expectThreadContext(secondThread, null);
  await client.query(
    "INSERT INTO work_request_assignments (id, work_request_id, contractor_id, status, created_at) VALUES ($1,$2,$3,'accepted',NOW() - INTERVAL '1 minute')",
    [secondAssignment, secondRequest, fixture.providerId]
  );
  const secondMetadata = {
    contractorId: fixture.providerId,
    assignmentId: secondAssignment,
    conversationId: secondThread,
  };
  await client.query(
    "INSERT INTO work_request_events (id, work_request_id, type, actor_user_id, metadata) VALUES ($1,$2,'provider_accepted',$3,$4::jsonb)",
    [secondEvent, secondRequest, fixture.identities.provider.id, JSON.stringify(secondMetadata)]
  );
  assert.equal(
    (
      await call(
        "provider",
        "GET",
        `/api/direct-connect/messages/threads/${secondThread}/job`,
        undefined,
        200
      )
    ).requestId,
    secondRequest
  );
  assert.equal(
    (
      await call(
        "provider",
        "GET",
        `/api/direct-connect/messages/threads/${fixture.conversationId}/job`,
        undefined,
        200
      )
    ).requestId,
    requestId
  );
  await client.query(
    "UPDATE work_request_events SET metadata = metadata || $2::jsonb WHERE id=$1",
    [secondEvent, JSON.stringify({ assignmentId: "wrong-assignment" })]
  );
  await call(
    "provider",
    "GET",
    `/api/direct-connect/messages/threads/${secondThread}/job`,
    undefined,
    404
  );
  await client.query(
    "UPDATE work_request_events SET metadata = metadata - 'assignmentId' WHERE id=$1",
    [secondEvent]
  );
  assert.equal(
    (
      await call(
        "provider",
        "GET",
        `/api/direct-connect/messages/threads/${secondThread}/job`,
        undefined,
        200
      )
    ).assignment.id,
    secondAssignment
  );
  const duplicateEvent = randomUUID();
  await expectThreadContext(secondThread, secondRequest);
  await client.query(
    "INSERT INTO work_request_events (id, work_request_id, type, actor_user_id, metadata) SELECT $2,work_request_id,type,actor_user_id,metadata FROM work_request_events WHERE id=$1",
    [secondEvent, duplicateEvent]
  );
  await call(
    "provider",
    "GET",
    `/api/direct-connect/messages/threads/${secondThread}/job`,
    undefined,
    404
  );
  await expectThreadContext(secondThread, null);
  await client.query("DELETE FROM work_request_events WHERE id=$1", [duplicateEvent]);
  await client.query(
    "UPDATE work_request_events SET metadata = metadata || $2::jsonb WHERE id=$1",
    [secondEvent, JSON.stringify({ conversationId: fixture.conversationId })]
  );
  await call(
    "provider",
    "GET",
    `/api/direct-connect/messages/threads/${fixture.conversationId}/job`,
    undefined,
    404
  );
  await expectThreadContext(fixture.conversationId, null);
  await client.query("UPDATE work_request_events SET metadata=$2::jsonb WHERE id=$1", [
    secondEvent,
    JSON.stringify(secondMetadata),
  ]);
  assert.equal(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM messages WHERE conversation_id=$1 AND metadata->>'workRequestId'=$2",
          [fixture.conversationId, requestId]
        )
      ).rows[0].count
    ),
    1
  );
  assert.equal(
    Number(
      (
        await client.query(
          "SELECT count(*) FROM admin_audit_log WHERE COALESCE(metadata->>'requestId',metadata->>'workRequestId')=$1",
          [requestId]
        )
      ).rows[0].count
    ),
    2
  );
  await writeFile(
    path.join(directory, "fixture.private.json"),
    JSON.stringify({ ...fixture, cookies, evidence, acceptance }, null, 2)
  );
  await writeFile(
    path.join(directory, "http-evidence.json"),
    JSON.stringify(
      {
        runId: fixture.runId,
        evidence,
        requestId,
        assignmentId: fixture.assignmentId,
        conversationId: fixture.conversationId,
        stage: "staff_reply_read_by_provider",
        requestSource: "actual authenticated request creation",
        database: "isolated synthetic native PostgreSQL",
      },
      null,
      2
    )
  );
} finally {
  await client.end();
}
