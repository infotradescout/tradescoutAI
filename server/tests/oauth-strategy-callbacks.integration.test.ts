import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import passport from "passport";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupAuth } from "../auth";
import { db, pool } from "../db";
import { storage } from "../storage";
import { users } from "../../shared/schema";

const enabled =
  process.env.RUN_INTEGRATION_TESTS === "true" && Boolean(process.env.TEST_DATABASE_URL);
const prefix = `oauth-callback-${randomUUID()}`;
const email = (name: string) => `${prefix}-${name}@example.invalid`;
const welcome = vi.fn();

type Provider = "google" | "facebook";
function invoke(provider: Provider, subject: string, providerEmail: string) {
  // Real registered Passport verifier, storage, and PostgreSQL advisory locks.
  // Only the already-verified provider profile is synthetic: no token exchange.
  const strategy = (passport as any)._strategy(provider);
  return new Promise<{ error: any; user: any; info: any }>((resolve) => {
    strategy._verify(
      "synthetic-token",
      "",
      {
        id: subject,
        displayName: "Synthetic Native Fixture",
        emails: [{ value: providerEmail }],
      },
      (error: any, user: any, info: any) => resolve({ error, user, info })
    );
  });
}

describe.skipIf(!enabled)("native registered OAuth callbacks", () => {
  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.startsWith("/tradescout_test_oauth_")
    ) {
      throw new Error("OAuth fixtures require their dedicated local disposable database");
    }
    for (const [name, value] of Object.entries({
      SESSION_SECRET: "synthetic-native-session-secret",
      DISABLE_FACEBOOK_AUTH: "false",
      GOOGLE_CLIENT_ID: "synthetic-google",
      GOOGLE_CLIENT_SECRET: "synthetic-secret",
      FACEBOOK_APP_ID: "synthetic-facebook",
      FACEBOOK_APP_SECRET: "synthetic-secret",
      GOOGLE_CALLBACK_URL: "http://localhost:5202/api/auth/google/callback",
      FACEBOOK_CALLBACK_URL: "http://localhost:5202/api/auth/facebook/callback",
      PRIVILEGED_ALIAS_EMAILS: email("reserved"),
    }))
      vi.stubEnv(name, value);
    await setupAuth({ set: vi.fn(), use: vi.fn() } as any, { onNewSocialUser: welcome });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await pool.end();
  });

  for (const provider of ["google", "facebook"] as const) {
    const field = provider === "google" ? "googleId" : "facebookId";

    it(`${provider}: creates exactly one unverified account under same-subject contention`, async () => {
      const subject = `${prefix}-${provider}-race`;
      const address = email(`${provider}-race`);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => invoke(provider, subject, address))
      );
      expect(results.every((result) => !result.error)).toBe(true);
      const successes = results.filter((result) => result.user);
      expect(successes.length).toBeGreaterThan(0);
      expect(new Set(successes.map((result) => result.user.id)).size).toBe(1);
      expect(
        results
          .filter((result) => !result.user)
          .every((result) => result.info.code === "AUTH_OAUTH_RETRY")
      ).toBe(true);
      const records = await db.select().from(users).where(eq(users[field], subject));
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        email: address,
        provider,
        providerId: subject,
        role: null,
        roles: [],
        emailVerified: false,
        onboardingCompleted: false,
      });
      const calls = () => welcome.mock.calls.filter(([user]) => user.id === records[0].id);
      expect(calls()).toHaveLength(1);
      expect((await invoke(provider, subject, address)).user.id).toBe(records[0].id);
      expect(calls()).toHaveLength(1);
    });

    it(`${provider}: never attaches an email-only match or changes its authority`, async () => {
      const [existing] = await db
        .insert(users)
        .values({
          email: email(`${provider}-email-only`),
          role: "homeowner",
          roles: ["homeowner"],
        })
        .returning();
      const result = await invoke(
        provider,
        `${prefix}-${provider}-unattached`,
        existing.email.toUpperCase()
      );
      expect(result.error).toBeNull();
      expect(result.user).toBe(false);
      expect(result.info.code).toBe("AUTH_ACCOUNT_LINK_REQUIRED");
      const [stored] = await db.select().from(users).where(eq(users.id, existing.id));
      expect(stored).toEqual(existing);
    });

    it(`${provider}: refuses a subject and email owned by different accounts`, async () => {
      const subject = `${prefix}-${provider}-conflict`;
      await db
        .insert(users)
        .values({ email: email(`${provider}-subject-owner`), [field]: subject });
      const address = email(`${provider}-different-email-owner`);
      await db.insert(users).values({ email: address });
      const result = await invoke(provider, subject, address);
      expect(result.user).toBe(false);
      expect(result.info.code).toBe("AUTH_IDENTITY_COLLISION");
    });

    it(`${provider}: preserves the linked account when provider email changes`, async () => {
      const subject = `${prefix}-${provider}-changed-email`;
      const [existing] = await db
        .insert(users)
        .values({
          email: email(`${provider}-old-email`),
          provider,
          providerId: subject,
          role: "homeowner",
          roles: ["homeowner"],
        })
        .returning();
      const result = await invoke(provider, subject, email(`${provider}-new-email`));
      expect(result.error).toBeNull();
      expect(result.user.id).toBe(existing.id);
      expect(result.user.email).toBe(existing.email);
      expect(result.user.role).toBe("homeowner");
    });

    it(`${provider}: denies reserved new signup but allows its already linked owner`, async () => {
      const subject = `${prefix}-${provider}-reserved`;
      const address = email("reserved");
      const first = await invoke(provider, subject, address);
      // The other provider's fixture may already own the reserved email. Both
      // denials preserve the same no-new-account and no-silent-link boundary.
      expect(first.user).toBe(false);
      expect(["AUTH_ACCOUNT_EXISTS", "AUTH_ACCOUNT_LINK_REQUIRED"]).toContain(first.info.code);
      const existing = (await storage.getOAuthUsersByEmail(address))[0];
      const [linked] = existing
        ? await db
            .update(users)
            .set({ [field]: subject })
            .where(eq(users.id, existing.id))
            .returning()
        : await db
            .insert(users)
            .values({ email: address, [field]: subject, role: "homeowner" })
            .returning();
      expect((await invoke(provider, subject, address)).user.id).toBe(linked.id);
    });
  }

  it("serializes matching normalized email across Google and Facebook", async () => {
    const address = email("cross-provider");
    const results = await Promise.all(
      (["google", "facebook"] as const).map((provider) =>
        invoke(provider, `${prefix}-${provider}-cross-provider`, address.toUpperCase())
      )
    );
    expect(results.every((result) => !result.error)).toBe(true);
    expect(results.filter((result) => result.user)).toHaveLength(1);
    const rejected = results.find((result) => !result.user)!;
    expect(["AUTH_OAUTH_RETRY", "AUTH_ACCOUNT_LINK_REQUIRED"]).toContain(rejected.info.code);
    const records = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${address}`);
    expect(records).toHaveLength(1);
    const losingProvider = records[0].provider === "google" ? "facebook" : "google";
    const retry = await invoke(
      losingProvider,
      `${prefix}-${losingProvider}-cross-provider`,
      address
    );
    expect(retry.user).toBe(false);
    expect(retry.info.code).toBe("AUTH_ACCOUNT_LINK_REQUIRED");
    expect(
      await db
        .select()
        .from(users)
        .where(and(eq(users.provider, losingProvider), eq(users.email, address)))
    ).toHaveLength(0);
  });
});
