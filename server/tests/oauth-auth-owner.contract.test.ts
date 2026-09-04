import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout OAuth owner contract", () => {
  it("keeps every Passport login strategy behind the auth owner", () => {
    const auth = read("server/auth.ts");
    const routes = read("server/routes.ts");

    expect(auth).toContain('import { Strategy as LocalStrategy } from "passport-local"');
    expect(auth).toContain('import { Strategy as FacebookStrategy } from "passport-facebook"');
    expect(auth).toContain('import { Strategy as GoogleStrategy } from "passport-google-oauth20"');
    expect(auth).toContain("new LocalStrategy(");
    expect(auth).toContain("new FacebookStrategy(");
    expect(auth).toContain("new GoogleStrategy(");
    expect(routes).not.toContain("new GoogleStrategy(");
    expect(routes).not.toContain("passport-google-oauth20");
  });

  it("uses one provider-availability decision for setup and public reporting", () => {
    const auth = read("server/auth.ts");
    const routes = read("server/routes.ts");

    expect(auth).toContain("export function getAuthProviderAvailability()");
    expect(auth).toContain("const providerAvailability = getAuthProviderAvailability()");
    expect(routes).toContain("const authProviderAvailability = getAuthProviderAvailability()");
    expect(routes).toContain("diagnostics: authProviderAvailability.diagnostics");
  });

  it("treats email as collision evidence rather than silent link authority", () => {
    const auth = read("server/auth.ts");
    const policy = read("server/utils/oauthIdentityPolicy.ts");
    const storage = read("server/storage.ts");

    expect(auth).toContain("const decision = decideOAuthIdentity({");
    expect(auth).toContain("const failure = oauthIdentityFailure(input.provider, decision)");
    expect(auth).toContain("await storage.getUserByGoogleId(input.providerSubject)");
    expect(auth).toContain("await storage.getUserByFacebookId(input.providerSubject)");
    expect(auth).not.toContain("user = await storage.getUserByEmail(email)");
    expect(policy).toContain('kind: "link_required"');
    expect(policy).toContain('kind: "identity_collision"');
    expect(policy).toContain('code: "AUTH_ACCOUNT_LINK_REQUIRED"');
    expect(policy).toContain('code: "AUTH_IDENTITY_COLLISION"');
    expect(storage).toContain("async getUserByGoogleId(googleId: string)");
  });

  it("keeps product-specific welcome behavior outside the auth owner", () => {
    const routes = read("server/routes.ts");

    expect(routes).toContain(
      "onNewSocialUser: (user) => createAutomaticCommunityWelcomeForUser(user)"
    );
  });

  it("returns failed OAuth attempts to the canonical auth surface with a safe reason", () => {
    const routes = read("server/routes.ts");
    const preScout = read("client/src/pages/pre-scout-setup.tsx");

    expect(routes).toContain('target.searchParams.set("oauthError", code)');
    expect(routes).toContain('return completeOAuthCallback("facebook"');
    expect(routes).toContain('return completeOAuthCallback("google"');
    expect(routes).not.toContain('failureRedirect: "/login"');
    expect(preScout).toContain('code === "AUTH_ACCOUNT_LINK_REQUIRED"');
    expect(preScout).toContain('code === "AUTH_IDENTITY_COLLISION"');
    expect(preScout).toContain('setAuthMode("signin")');
  });
});
