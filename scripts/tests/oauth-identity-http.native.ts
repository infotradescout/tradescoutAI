import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
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
const { emailService } = await import("../../server/services/emailService");
const emailWaiters = new Map<string, (text: string) => void>();
// Capture generated verification links without delivering mail.
(emailService as any).sendEmail = async (message: any) => {
  emailWaiters.get(String(message.to))?.(String(message.text || ""));
  return { success: true };
};
const timeout = setTimeout(() => {
  console.error("OAUTH_HTTP_TIMEOUT");
  process.exit(2);
}, 90000);
const prefix = `oauth-http-${randomUUID()}`;
let base = "";
const requestAsHost = (requestPath: string, host: string) =>
  new Promise<Response>((resolve, reject) => {
    const request = httpRequest(
      `${base}${requestPath}`,
      {
        headers: { Host: host, "X-Forwarded-Proto": "https" },
      },
      (response) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
            headers.append(key, item);
        }
        response.resume();
        response.on("end", () =>
          resolve(new Response(null, { status: response.statusCode, headers }))
        );
      }
    );
    request.on("error", reject);
    request.end();
  });
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
    let tokenExchanges = 0;
    let identityVerifications = 0;
    const registeredVerifier = strategy._verify;
    strategy._verify = (...args: any[]) => {
      identityVerifications += 1;
      return registeredVerifier(...args);
    };
    // Simulate only the external provider response: Passport strategy, registered
    // verification callback, storage, advisory locks, routes and sessions are real.
    strategy._oauth2.getOAuthAccessToken = (_code: any, _params: any, done: any) => {
      tokenExchanges += 1;
      done(null, "synthetic-token", "", {});
    };
    strategy.userProfile = (_token: any, done: any) => done(null, profile);
    process.env.NODE_ENV = "production";
    try {
      const customEntry = await requestAsHost(
        `/api/auth/${provider}?next=${encodeURIComponent(returnPath)}`,
        "business.example.invalid"
      );
      assert.equal(customEntry.status, 302);
      const handoff = new URL(customEntry.headers.get("location")!);
      assert.equal(handoff.origin, "https://www.thetradescout.com");
      assert.equal(handoff.pathname, `/api/auth/${provider}`);
      assert.equal(handoff.searchParams.get("next"), returnPath);
      assert.equal(handoff.searchParams.has("state"), false);
      assert.equal(
        customEntry.headers.getSetCookie().length,
        0,
        "custom host must not create the OAuth nonce session"
      );
      // Follow the canonical entry through the loopback listener with a
      // synthetic canonical Host; never follow the external provider URL.
      const canonicalEntry = await requestAsHost(
        `${handoff.pathname}${handoff.search}`,
        handoff.host
      );
      assert.equal(canonicalEntry.status, 302);
      const authorization = new URL(canonicalEntry.headers.get("location")!);
      assert.match(authorization.searchParams.get("state") || "", /^[A-Za-z0-9]{24}$/);
      assert.equal(
        authorization.searchParams.get("redirect_uri"),
        `https://www.thetradescout.com/api/auth/${provider}/callback`
      );
      assert.ok(canonicalEntry.headers.getSetCookie().length);
      results.push({
        provider,
        label: "production custom-host entry aligns nonce and callback origin",
        preservedContinuation: true,
      });
    } finally {
      process.env.NODE_ENV = "test";
    }
    const begin = async (requestedNext = returnPath) => {
      const response = await fetch(
        `${base}/api/auth/${provider}?next=${encodeURIComponent(requestedNext)}`,
        { redirect: "manual" }
      );
      assert.equal(response.status, 302);
      const state = new URL(response.headers.get("location")!).searchParams.get("state");
      assert.match(state || "", /^[A-Za-z0-9]{24}$/, "authorization entry must mint a nonce");
      const cookie = response.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      assert.ok(cookie, "the authorization nonce must be persisted in a browser session");
      return { state: state!, cookie };
    };
    const rejectState = async (
      label: string,
      cookie: string,
      state?: string,
      existingId: string | null = null
    ) => {
      const before = { tokenExchanges, identityVerifications };
      const response = await fetch(
        `${base}/api/auth/${provider}/callback?code=attacker-code${state === undefined ? "" : `&state=${encodeURIComponent(state)}`}`,
        {
          redirect: "manual",
          headers: { cookie },
        }
      );
      assert.equal(response.status, 302, label);
      const redirect = new URL(response.headers.get("location")!, base);
      assert.equal(redirect.origin, base);
      assert.equal(redirect.searchParams.get("oauthError"), "AUTH_OAUTH_FAILED", label);
      assert.equal(tokenExchanges, before.tokenExchanges, `${label}: reject before token exchange`);
      assert.equal(
        identityVerifications,
        before.identityVerifications,
        `${label}: reject before account resolution`
      );
      const identity = await fetch(`${base}/__oauth-smoke-identity`, { headers: { cookie } });
      assert.equal((await identity.json()).id, existingId, `${label}: no new login`);
      results.push({
        provider,
        label,
        rejectedBeforeTokenExchange: true,
        rejectedBeforeIdentity: true,
      });
    };
    const run = async (
      label: string,
      p: any,
      expectedId: string | null,
      failure?: string,
      requestedNext = returnPath,
      needsOnboarding = false,
      needsEmailVerification = false
    ) => {
      profile = p;
      const { state, cookie } = await begin(requestedNext);
      const verificationMail = needsEmailVerification
        ? new Promise<string>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Verification message was not generated")),
              5000
            );
            emailWaiters.set(p.emails[0].value, (text) => {
              clearTimeout(timer);
              resolve(text);
            });
          })
        : null;
      const response = await fetch(
        `${base}/api/auth/${provider}/callback?code=synthetic&state=${encodeURIComponent(state)}`,
        {
          redirect: "manual",
          headers: { cookie },
        }
      );
      assert.equal(response.status, 302, label);
      if (expectedId === "new-account") {
        const created = await db.select().from(users).where(eq(users.email, p.emails[0].value));
        assert.equal(created.length, 1);
        assert.equal(created[0].role, null);
        assert.equal(created[0].onboardingCompleted, false);
        assert.equal(created[0].emailVerified, false);
        expectedId = created[0].id;
      }
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
      } else if (needsOnboarding) {
        const onboardingPath = `/onboarding/profile?next=${encodeURIComponent(requestedNext)}`;
        if (needsEmailVerification) {
          assert.equal(redirect.pathname, "/check-email");
          assert.equal(redirect.searchParams.get("next"), onboardingPath);
          const mail = await verificationMail!;
          const verificationLink = new URL(mail.match(/https?:\/\/\S+/)![0]);
          assert.equal(
            verificationLink.searchParams.get("next"),
            onboardingPath,
            "verification email retains the captured county and claim destination"
          );
          emailWaiters.delete(p.emails[0].value);
        } else assert.equal(response.headers.get("location"), onboardingPath);
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
      return { state, cookie, freshCookie };
    };
    for (const kind of ["missing", "wrong", "other-session", "no-session"]) {
      const flow = await begin();
      const other = kind === "other-session" ? await begin() : flow;
      await rejectState(
        `${kind} state`,
        kind === "no-session" ? "" : other.cookie,
        kind === "missing" ? undefined : kind === "wrong" ? "wrong-state" : flow.state
      );
    }
    const signedIn = await run(
      "stored subject owner",
      { id: subject, emails: [{ value: ownerEmail }] },
      owner.id
    );
    await rejectState("replayed state with original session", signedIn.cookie, signedIn.state);
    await rejectState(
      "replayed state with authenticated session",
      signedIn.freshCookie,
      signedIn.state,
      owner.id
    );
    await run(
      "new account keeps county and claim continuation through email and onboarding",
      {
        id: `${subject}-fresh`,
        emails: [{ value: `${subject}-fresh@example.invalid` }],
      },
      "new-account",
      undefined,
      returnPath,
      true,
      true
    );
    const [incomplete] = await db
      .insert(users)
      .values({
        email: `${subject}-incomplete@example.invalid`,
        [field]: `${subject}-incomplete`,
        role: null,
        onboardingCompleted: false,
        emailVerified: true,
      })
      .returning();
    await run(
      "incomplete account keeps county and claim continuation",
      {
        id: `${subject}-incomplete`,
        emails: [{ value: incomplete.email }],
      },
      incomplete.id,
      undefined,
      returnPath,
      true
    );
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
