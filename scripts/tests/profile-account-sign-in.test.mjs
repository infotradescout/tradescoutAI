/** Node 22.13+: node --experimental-vm-modules --test scripts/tests/profile-account-sign-in.test.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import http from "node:http";
import vm from "node:vm";
import test from "node:test";

const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout });
const reader = new vm.SourceTextModule(stripTypeScriptTypes(fs.readFileSync(new URL("../../client/src/lib/authSessionRead.ts", import.meta.url), "utf8")), { context });
await reader.link(() => { throw Error("Unexpected reader dependency"); });
const module = new vm.SourceTextModule(stripTypeScriptTypes(fs.readFileSync(new URL("../../client/src/lib/profileAccountSignIn.ts", import.meta.url), "utf8")), { context });
await module.link(name => { assert.equal(name, "./authSessionRead"); return reader; });
await module.evaluate();
const { signInToProfileAccount, confirmProfileAccountSession } = module.namespace;
const user = { id: "synthetic-company-user", onboardingCompleted: false, emailVerified: false };

async function fixture(t, options = {}) {
  const counts = { post: 0, get: 0, redirected: 0 }; let submitted;
  const server = http.createServer(async (req, res) => {
    if (req.url === "/unexpected") { counts.redirected++; return res.end("unexpected"); }
    if (req.url === "/api/auth/login") {
      counts.post++;
      let body = ""; for await (const chunk of req) body += chunk;
      submitted = JSON.parse(body);
      if (options.redirect) { res.writeHead(302, { Location: "/unexpected" }); return res.end(); }
      res.writeHead(options.status ?? 200, { "Content-Type": "application/json" });
      if (options.stall) { res.write('{"user":'); return; }
      return res.end(options.raw ?? JSON.stringify(options.login ?? { user }));
    }
    if (req.url === "/api/auth/user") {
      counts.get++;
      res.writeHead(options.sessionStatus ?? 200, { "Content-Type": "application/json" });
      return res.end(options.sessionRaw ?? JSON.stringify(options.session ?? { authenticated: true, user }));
    }
    res.writeHead(404); res.end();
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise(done => { server.close(done); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const invoke = () => signInToProfileAccount({ loginUrl: origin + "/api/auth/login", authUrl: origin + "/api/auth/user", email: " PERSON@EXAMPLE.INVALID ", password: " Synthetic1 ", timeoutMs: options.timeoutMs ?? 500 });
  return { invoke, counts, submitted: () => submitted };
}

test("same read-back identity completes company sign-in without onboarding or verification promotion", async t => {
  const f = await fixture(t); const result = await f.invoke();
  assert.equal(result.id, user.id); assert.equal(result.onboardingCompleted, false); assert.equal(result.emailVerified, false);
  assert.deepEqual(f.counts, { post: 1, get: 1, redirected: 0 });
  assert.deepEqual(f.submitted(), { email: "person@example.invalid", password: " Synthetic1 " });
});
for (const login of [{}, null, [], { user: {} }, { user: { id: "" } }, { user: { id: 12 } }, { user: { id: " user " } }, { authenticated: false, user }]) {
  test(`rejects malformed successful login ${JSON.stringify(login)}`, async t => {
    const f = await fixture(t, { raw: JSON.stringify(login) });
    await assert.rejects(f.invoke, { code: "AUTH_LOGIN_INVALID_RESPONSE" });
    assert.equal(f.counts.get, 0); assert.equal(f.counts.post, 1);
  });
}
for (const raw of ["<html>login</html>", "{bad", ""]) {
  test(`rejects unreadable login body ${JSON.stringify(raw)}`, async t => {
    const f = await fixture(t, { raw }); await assert.rejects(f.invoke, { code: "AUTH_LOGIN_INVALID_RESPONSE" });
    assert.equal(f.counts.get, 0);
  });
}
for (const code of ["AUTH_INCORRECT_PASSWORD", "AUTH_SOCIAL_ONLY", "AUTH_NO_ACCOUNT"]) {
  test(`preserves server rejection ${code}`, async t => {
    const f = await fixture(t, { status: 401, login: { message: "Synthetic rejection", code } });
    await assert.rejects(f.invoke, { code, status: 401 }); assert.equal(f.counts.get, 0);
  });
}
for (const session of [{ authenticated: false, user: null }, { authenticated: true, user: { id: "different-synthetic-user" } }]) {
  test(`does not complete sign-in when cookie read-back differs ${JSON.stringify(session)}`, async t => {
    const f = await fixture(t, { session }); await assert.rejects(f.invoke, { code: "AUTH_SESSION_NOT_CONFIRMED" });
    assert.equal(f.counts.post, 1); assert.equal(f.counts.get, 1);
  });
}
test("an auth probe failure after accepted credentials is not success or an automatic second login", async t => {
  const f = await fixture(t, { sessionStatus: 503 });
  await assert.rejects(f.invoke, { code: "AUTH_SESSION_HTTP_ERROR" }); assert.equal(f.counts.post, 1);
});
test("stalled login body observes the deadline", async t => {
  const f = await fixture(t, { stall: true, timeoutMs: 40 }); await assert.rejects(f.invoke, { code: "AUTH_LOGIN_TIMEOUT" });
  assert.equal(f.counts.post, 1); assert.equal(f.counts.get, 0);
});
test("login redirects are refused instead of becoming false success", async t => {
  const f = await fixture(t, { redirect: true }); await assert.rejects(f.invoke, { code: "AUTH_LOGIN_NETWORK_ERROR" });
  assert.equal(f.counts.redirected, 0);
});
for (const result of [undefined, {}, { data: null }, { data: {} }, { data: user, isError: true }, { data: user, error: new Error("synthetic") }]) {
  test(`registration/session refresh requires a successful identity result ${JSON.stringify(result)}`, async () => {
    await assert.rejects(() => confirmProfileAccountSession(async options => {
      assert.equal(options.throwOnError, true); return result;
    }), { code: "AUTH_SESSION_NOT_CONFIRMED" });
  });
}
test("a thrown refresh error remains a failure", async () => {
  await assert.rejects(() => confirmProfileAccountSession(async () => { throw new Error("synthetic refresh failure"); }), /synthetic refresh failure/);
});
test("registration/session confirmation never substitutes a different requested identity", async () => {
  await assert.rejects(() => confirmProfileAccountSession(async () => ({ data: user }), "other"), { code: "AUTH_SESSION_NOT_CONFIRMED" });
  assert.equal(await confirmProfileAccountSession(async () => ({ data: user }), user.id), user.id);
});
