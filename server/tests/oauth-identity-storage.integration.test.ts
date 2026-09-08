import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { storage } from "../storage";
import { db } from "../db";
import { users } from "../../shared/schema";
import { OAuthIdentityCollisionError } from "../utils/oauthIdentityPolicy";

const enabled =
  process.env.RUN_INTEGRATION_TESTS === "true" && Boolean(process.env.TEST_DATABASE_URL);
const prefix = `oauth-${randomUUID()}`;
const email = (name: string) => `${prefix}-${name}@example.invalid`;
describe.skipIf(!enabled)("native OAuth identity storage", () => {
  beforeAll(() => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.startsWith("/tradescout_test_oauth_")
    ) {
      throw new Error("OAuth fixtures require their dedicated local disposable database");
    }
  });
  for (const provider of ["google", "facebook"] as const) {
    const lookup = (subject: string) =>
      provider === "google"
        ? storage.getUserByGoogleId(subject)
        : storage.getUserByFacebookId(subject);
    const field = provider === "google" ? "googleId" : "facebookId";
    it(`${provider}: resolves either representation but rejects duplicate owners`, async () => {
      const legacySubject = `${prefix}-${provider}-legacy`;
      const genericSubject = `${prefix}-${provider}-generic`;
      const [legacy, generic] = await db
        .insert(users)
        .values([
          { email: email(`${provider}-legacy`), [field]: legacySubject },
          { email: email(`${provider}-generic`), provider, providerId: genericSubject },
        ])
        .returning();
      expect((await lookup(legacySubject))?.id).toBe(legacy.id);
      expect((await lookup(genericSubject))?.id).toBe(generic.id);
      await db
        .insert(users)
        .values({ email: email(`${provider}-duplicate`), provider, providerId: legacySubject });
      await expect(lookup(legacySubject)).rejects.toBeInstanceOf(OAuthIdentityCollisionError);
    });
    it(`${provider}: rejects conflicting representations on one row`, async () => {
      const subject = `${prefix}-${provider}-conflict`;
      await db.insert(users).values({
        email: email(`${provider}-conflict`),
        provider,
        providerId: subject,
        [field]: `${subject}-other`,
      });
      await expect(lookup(subject)).rejects.toBeInstanceOf(OAuthIdentityCollisionError);
      await expect(lookup(`${subject}-other`)).rejects.toBeInstanceOf(OAuthIdentityCollisionError);
    });
    it(`${provider}: separates provider namespaces and empty subjects`, async () => {
      const subject = `${prefix}-${provider}-namespace`;
      await db.insert(users).values({
        email: email(`${provider}-namespace`),
        provider: provider === "google" ? "facebook" : "google",
        providerId: subject,
      });
      expect(await lookup(subject)).toBeUndefined();
      expect(await lookup(" ")).toBeUndefined();
    });
  }
  it("returns both legacy case-only email owners for collision decisions", async () => {
    const lower = email("case-duplicate");
    await db.insert(users).values([{ email: lower }, { email: lower.toUpperCase() }]);
    const matches = await storage.getOAuthUsersByEmail(` ${lower.toUpperCase()} `);
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((user) => user.email))).toEqual(
      new Set([lower, lower.toUpperCase()])
    );
  });
});
