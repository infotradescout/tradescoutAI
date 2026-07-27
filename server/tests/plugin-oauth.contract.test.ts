import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { normalizeScopes, secretHash, verifyPkce } from "../plugin/oauth";

describe("TradeScout plugin OAuth contract", () => {
  it("requires business.read and rejects unknown scopes", () => {
    expect(normalizeScopes("business.read profile.write")).toEqual([
      "business.read",
      "profile.write",
    ]);
    expect(() => normalizeScopes("profile.write")).toThrow("business.read");
    expect(() => normalizeScopes("business.read admin.write")).toThrow("Unsupported");
  });

  it("validates S256 PKCE without accepting malformed verifiers", () => {
    const verifier = "A".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(`${verifier}x`, challenge)).toBe(false);
    expect(verifyPkce("short", challenge)).toBe(false);
  });

  it("stores one-way hashes instead of raw OAuth codes", () => {
    expect(secretHash("authorization-code")).toHaveLength(64);
    expect(secretHash("authorization-code")).not.toContain("authorization-code");
  });
});
