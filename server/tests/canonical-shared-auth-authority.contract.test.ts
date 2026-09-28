import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configuredOAuthCallbackUrl } from "../auth";
import { TRADESCOUT_AUTHORITY_ORIGIN } from "@shared/authAuthority";

function read(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
}

describe("shared TradeScout auth authority", () => {
  it("uses one production OAuth callback authority regardless of stale provider env callbacks", () => {
    const priorNodeEnv = process.env.NODE_ENV;
    const priorGoogle = process.env.GOOGLE_CALLBACK_URL;
    const priorFacebook = process.env.FACEBOOK_CALLBACK_URL;
    try {
      process.env.NODE_ENV = "production";
      process.env.GOOGLE_CALLBACK_URL = "https://tradescoutai.onrender.com/api/auth/google/callback";
      process.env.FACEBOOK_CALLBACK_URL = "https://jwstonelogistics.com/api/auth/facebook/callback";
      expect(configuredOAuthCallbackUrl("google")).toBe(
        `${TRADESCOUT_AUTHORITY_ORIGIN}/api/auth/google/callback`
      );
      expect(configuredOAuthCallbackUrl("facebook")).toBe(
        `${TRADESCOUT_AUTHORITY_ORIGIN}/api/auth/facebook/callback`
      );
    } finally {
      process.env.NODE_ENV = priorNodeEnv;
      if (priorGoogle === undefined) delete process.env.GOOGLE_CALLBACK_URL;
      else process.env.GOOGLE_CALLBACK_URL = priorGoogle;
      if (priorFacebook === undefined) delete process.env.FACEBOOK_CALLBACK_URL;
      else process.env.FACEBOOK_CALLBACK_URL = priorFacebook;
    }
  });

  it("moves mapped-domain OAuth entry to the authority before Passport creates state", () => {
    const routes = read("server/routes.ts");
    const redirectIndex = routes.indexOf("redirectOAuthEntryToCallbackOrigin");
    const googleAuthenticateIndex = routes.indexOf('passport.authenticate("google"', redirectIndex);
    const facebookAuthenticateIndex = routes.indexOf('passport.authenticate("facebook"', redirectIndex);

    expect(redirectIndex).toBeGreaterThan(-1);
    expect(googleAuthenticateIndex).toBeGreaterThan(redirectIndex);
    expect(facebookAuthenticateIndex).toBeGreaterThan(redirectIndex);
    expect(routes).toContain("A custom-domain cookie cannot accompany a canonical-domain callback.");
  });
});
