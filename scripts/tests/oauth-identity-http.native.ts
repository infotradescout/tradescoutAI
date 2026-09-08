import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import passport from "passport";
import dotenv from "dotenv";
import { eq, or } from "drizzle-orm";
assert.equal(process.env.NODE_ENV, "test");
const connection = process.env.TEST_DATABASE_URL!;
const target = new URL(connection);
assert.equal(target.hostname, "127.0.0.1");
assert.ok(target.pathname.startsWith("/tradescout_test_oauth_"));
// No inherited providers, credentials, or dotenv target may enter this proof.
for (const key of Object.keys(process.env)) {
  if (
    !/^(path|systemroot|windir|comspec|pathext|temp|tmp|userprofile|appdata|localappdata|programfiles|programfiles\(x86\)|programdata|processor_architecture|number_of_processors)$/i.test(
      key
    )
  )
    delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: "test",
  TEST_DATABASE_URL: connection,
  DATABASE_URL: connection,
  ALLOW_INSECURE_TEST_DATABASE: "true",
  SESSION_SECRET: "synthetic-native-http-session",
  GOOGLE_CLIENT_ID: "synthetic-google",
  GOOGLE_CLIENT_SECRET: "synthetic-secret",
  FACEBOOK_APP_ID: "synthetic-facebook",
  FACEBOOK_APP_SECRET: "synthetic-secret",
  DISABLE_FACEBOOK_AUTH: "false",
  DISABLE_CRAWLER: "true",
  SCHEDULER_ENABLED: "false",
});
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
const { createApp } = await import("../../server/app");
const { db, pool } = await import("../../server/db");
const { users } = await import("../../shared/schema");
const timeout = setTimeout(() => {
  console.error("OAUTH_HTTP_TIMEOUT");
  process.exit(2);
}, 90000);
const prefix = `oauth-http-${randomUUID()}`;
let base = "";
const results: object[] = [];
const returnPath =
  "/pre-scout-setup?mode=create&next=%2Fdirect-connect%3Fcounty%3D22005&claimBusinessId=synthetic-claim#form";
try {
  const { server, app } = await createApp();
  // Test-only readout consumes the real already-established session.
  app.get("/__oauth-smoke-identity", (req: any, res) =>
    res.status(req.isAuthenticated() ? 200 : 401).json({ id: req.user?.id ?? null })
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  for (const provider of ["google", "facebook"] as const) {
    const field = provider === "google" ? "googleId" : "facebookId";
    const subject = `${prefix}-${provider}`;
    const ownerEmail = `${subject}-owner@example.invalid`;
    const localEmail = `${subject}-local@example.invalid`;
    const [owner, local] = await db
      .insert(users)
      .values([
        {
          email: ownerEmail,
          provider,
          providerId: subject,
          [field]: subject,
          role: "homeowner",
          onboardingCompleted: true,
          emailVerified: true,
        },
        { email: localEmail, role: "homeowner", onboardingCompleted: true, emailVerified: true },
      ])
      .returning();
    const strategy = (passport as any)._strategy(provider);
    let profile: any;
    // Simulate only the external provider response: Passport strategy, registered
    // verification callback, storage, advisory locks, routes and sessions are real.
    strategy._oauth2.getOAuthAccessToken = (_code: any, _params: any, done: any) =>
      done(null, "synthetic-token", "", {});
    strategy.userProfile = (_token: any, done: any) => done(null, profile);
    const run = async (
      label: string,
      p: any,
      expectedId: string | null,
      failure?: string,
      requestedNext = returnPath
    ) => {
      profile = p;
      const start = await fetch(
        `${base}/api/auth/${provider}?next=${encodeURIComponent(requestedNext)}`,
        { redirect: "manual" }
      );
      assert.equal(start.status, 302);
      const cookie = start.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      const response = await fetch(`${base}/api/auth/${provider}/callback?code=synthetic`, {
        redirect: "manual",
        headers: { cookie },
      });
      assert.equal(response.status, 302, label);
      const freshCookie =
        response.headers
          .getSetCookie()
          .map((v) => v.split(";")[0])
          .join("; ") || cookie;
      const identity = await fetch(`${base}/__oauth-smoke-identity`, {
        headers: { cookie: freshCookie },
      });
      assert.equal(identity.status, expectedId ? 200 : 401, label);
      const body: any = await identity.json();
      assert.equal(body.id, expectedId, label);
      if (expectedId && cookie) {
        assert.notEqual(freshCookie, cookie, "successful login must regenerate the session");
        const oldSession = await fetch(`${base}/__oauth-smoke-identity`, {
          headers: { cookie },
        });
        assert.equal(oldSession.status, 401, "the pre-login session must not gain authority");
      }
      const redirect = new URL(response.headers.get("location")!, base);
      assert.equal(redirect.origin, base, "every callback return remains same-origin");
      if (failure) {
        assert.equal(redirect.pathname, "/pre-scout-setup");
        assert.equal(redirect.searchParams.get("oauthError"), failure);
        assert.equal(redirect.searchParams.get("mode"), "signin");
        assert.equal(redirect.searchParams.get("next"), "/direct-connect?county=22005");
        assert.equal(redirect.searchParams.get("claimBusinessId"), "synthetic-claim");
      } else
        assert.equal(
          response.headers.get("location"),
          requestedNext === returnPath ? returnPath : "/pre-scout-setup",
          "session regeneration must retain only a safe return destination"
        );
      results.push({
        provider,
        label,
        status: response.status,
        authenticated: identity.status === 200,
        failure: failure ?? null,
      });
    };
    await run("stored subject owner", { id: subject, emails: [{ value: ownerEmail }] }, owner.id);
    for (const next of [
      "/entry/..//evil.invalid",
      "/.%2e//evil.invalid",
      "/entry/%2E%2E//evil.invalid",
      "/%5cevil.invalid",
    ]) {
      await run(
        `unsafe return ${next}`,
        { id: subject, emails: [{ value: ownerEmail }] },
        owner.id,
        undefined,
        next
      );
    }
    await run(
      "email-only account",
      { id: `${subject}-unlinked`, emails: [{ value: localEmail }] },
      null,
      "AUTH_ACCOUNT_LINK_REQUIRED"
    );
    await run(
      "different email owner",
      { id: subject, emails: [{ value: localEmail }] },
      null,
      "AUTH_IDENTITY_COLLISION"
    );
    await db
      .insert(users)
      .values({ email: `${subject}-duplicate@example.invalid`, provider, providerId: subject });
    await run(
      "duplicate subject owner",
      { id: subject, emails: [{ value: ownerEmail }] },
      null,
      "AUTH_IDENTITY_COLLISION"
    );
    const [untouched] = await db.select().from(users).where(eq(users.id, local.id));
    assert.equal(untouched[field], null);
    assert.equal(untouched.providerId, null);
    const concurrentSubject = `${subject}-concurrent`;
    const verify = (email: string) =>
      new Promise<any>((resolve) =>
        strategy._verify(
          "synthetic-token",
          "",
          { id: concurrentSubject, emails: [{ value: email }], displayName: "Synthetic" },
          (error: any, user: any, info: any) => resolve({ error, user, info })
        )
      );
    const concurrent = await Promise.all([
      verify(`${concurrentSubject}-a@example.invalid`),
      verify(`${concurrentSubject}-b@example.invalid`),
    ]);
    assert.ok(concurrent.some((r) => r.user));
    const accounts = await db
      .select()
      .from(users)
      .where(or(eq(users[field], concurrentSubject), eq(users.providerId, concurrentSubject)));
    assert.equal(accounts.length, 1, "same subject must not create two accounts");
    for (const r of concurrent) {
      assert.equal(r.error, null);
      if (r.user) assert.equal(r.user.id, accounts[0].id);
      else assert.equal(r.info.code, "AUTH_OAUTH_RETRY");
    }
    assert.equal(accounts[0].role, null);
    assert.equal(accounts[0].emailVerified, false);
    assert.equal(accounts[0].onboardingCompleted, false);
    results.push({
      provider,
      label: "concurrent callbacks",
      accountsCreated: accounts.length,
      claimsFirst: true,
    });
  }
  console.log("OAUTH_HTTP_SMOKE", JSON.stringify(results));
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  await pool.end();
  clearTimeout(timeout);
  process.exit(0);
} catch (error) {
  console.error("OAUTH_HTTP_FAILED", error instanceof Error ? error.message : String(error));
  clearTimeout(timeout);
  process.exit(1);
}
