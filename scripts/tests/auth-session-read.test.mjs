/** Node 22.13+: node --test scripts/tests/auth-session-read.test.mjs */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { after, before, test } from "node:test";

// Execute the production module with real loopback HTTP responses. No live
// account, database, OAuth provider, credentials or company records are used.
const file = new URL("../../client/src/lib/authSessionRead.ts", import.meta.url);
const source = stripTypeScriptTypes(readFileSync(file, "utf8"));
const { readAuthSessionUser, parseAuthSessionUser, shouldRetryAuthSessionRead, AuthSessionReadError } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const customer = { id: "synthetic-company-user", email: "synthetic@example.invalid",
  onboardingCompleted: false, emailVerified: false, role: "homeowner" };
let origin;
let server;
let landingRequests = 0;
const timers = new Set();
const observedHeaders = [];
function later(callback) {
  const timer = setTimeout(() => { timers.delete(timer); callback(); }, 1000);
  timers.add(timer);
}
before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://loopback.invalid");
    if (url.pathname === "/landing") { landingRequests++; res.end("not an auth response"); return; }
    observedHeaders.push({ method: req.method, accept: req.headers.accept });
    const scenario = url.searchParams.get("case");
    res.setHeader("Content-Type", "application/json");
    switch (scenario) {
      case "status": res.statusCode = Number(url.searchParams.get("status")); res.end('{}'); break;
      case "guest": res.end('{"authenticated":false,"user":null}'); break;
      case "legacy-guest": res.end('null'); break;
      case "user": res.end(JSON.stringify({ authenticated: true, user: customer })); break;
      case "legacy-user": res.end(JSON.stringify(customer)); break;
      case "html": res.setHeader("Content-Type", "text/html"); res.end('<html>login</html>'); break;
      case "invalid-json": res.end('{"authenticated":'); break;
      case "empty": res.end(); break;
      case "invalid-shape": res.end('{"authenticated":true}'); break;
      case "contradictory": res.end(JSON.stringify({ authenticated: false, user: customer })); break;
      case "delay-headers": later(() => res.end(JSON.stringify(customer))); break;
      case "delay-body": res.writeHead(200); res.flushHeaders(); later(() => res.end(JSON.stringify(customer))); break;
      case "disconnect": req.socket.destroy(); break;
      case "redirect": res.writeHead(302, { Location: "/landing" }); res.end(); break;
      default: res.writeHead(404); res.end('{}');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  for (const timer of timers) clearTimeout(timer);
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
const probe = (scenario, timeoutMs = 2000) =>
  readAuthSessionUser(`${origin}/api/auth/user?case=${scenario}`, { timeoutMs });

for (const scenario of ["guest", "legacy-guest", "status&status=401"]) {
  test(`explicit guest evidence resolves null: ${scenario}`, async () => {
    assert.equal(await probe(scenario), null);
  });
}
for (const scenario of ["user", "legacy-user"]) {
  test(`retains the same lightweight identity without completing onboarding: ${scenario}`, async () => {
    assert.deepEqual(await probe(scenario), customer);
  });
}
for (const status of [403, 404, 429, 500, 502, 503]) {
  test(`HTTP ${status} rejects instead of replacing the session with guest`, async () => {
    await assert.rejects(probe(`status&status=${status}`), error => {
      assert.equal(error.code, "AUTH_SESSION_HTTP_ERROR");
      assert.equal(error.status, status);
      assert.equal(error.retryable, status === 429 || status >= 500);
      return true;
    });
  });
}
for (const scenario of ["html", "invalid-json", "empty", "invalid-shape", "contradictory"]) {
  test(`unreadable or contradictory success response is not a logout: ${scenario}`, async () => {
    await assert.rejects(probe(scenario), { code: "AUTH_SESSION_INVALID_RESPONSE" });
  });
}
for (const scenario of ["delay-headers", "delay-body"]) {
  test(`deadline covers ${scenario}`, async () => {
    const started = Date.now();
    await assert.rejects(probe(scenario, 100), { code: "AUTH_SESSION_TIMEOUT", retryable: true });
    assert.ok(Date.now() - started < 900, "probe must end before delayed response");
  });
}
test("a disconnected request rejects and is eligible for bounded retry", async () => {
  await assert.rejects(probe("disconnect"), { code: "AUTH_SESSION_NETWORK_ERROR", retryable: true });
});
test("an auth redirect is not silently followed into another page/origin", async () => {
  const previous = landingRequests;
  await assert.rejects(probe("redirect"), { code: "AUTH_SESSION_NETWORK_ERROR" });
  assert.equal(landingRequests, previous);
});
test("the real request is a JSON GET", async () => {
  await probe("user");
  assert.deepEqual(observedHeaders.at(-1), { method: "GET", accept: "application/json" });
});
for (const payload of [undefined, false, true, 0, "", "signed-in", [], {}, { id: "" },
  { id: "   " }, { id: 7 }, { authenticated: "false" }, { authenticated: true, user: {} }]) {
  test(`malformed payload is not auth evidence: ${JSON.stringify(payload)}`, () => {
    assert.throws(() => parseAuthSessionUser(payload), { code: "AUTH_SESSION_INVALID_RESPONSE" });
  });
}
test("a valid identity is returned without adding verification or authority", () => {
  const value = Object.freeze({ ...customer, verificationBypass: { active: false, reason: "none" } });
  assert.equal(parseAuthSessionUser(value), value);
  assert.equal(parseAuthSessionUser({ authenticated: true, user: value }), value);
  assert.equal(value.onboardingCompleted, false);
  assert.equal(value.emailVerified, false);
});
test("transient retry is capped at two retries and never matches arbitrary error strings", () => {
  const transient = new AuthSessionReadError("AUTH_SESSION_TIMEOUT", true);
  for (const count of [0, 1]) assert.equal(shouldRetryAuthSessionRead(count, transient), true);
  for (const count of [2, 3, 10]) assert.equal(shouldRetryAuthSessionRead(count, transient), false);
  assert.equal(shouldRetryAuthSessionRead(0, new Error("Failed to fetch")), false);
  assert.equal(shouldRetryAuthSessionRead(0, new AuthSessionReadError("AUTH_SESSION_INVALID_RESPONSE")), false);
});
test("invalid deadlines fail before requesting anything", async () => {
  for (const timeoutMs of [0, -1, Infinity, NaN]) {
    await assert.rejects(readAuthSessionUser(`${origin}/api/auth/user`, { timeoutMs }), RangeError);
  }
});
test("failure messages do not include the request URL or private payload", async () => {
  await assert.rejects(probe("invalid-json&private=synthetic-sensitive-value"), error => {
    assert.equal(error.message.includes("synthetic-sensitive-value"), false);
    assert.equal(error.message.includes(origin), false);
    return true;
  });
});
