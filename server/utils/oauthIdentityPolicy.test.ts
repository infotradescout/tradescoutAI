import { describe, expect, it } from "vitest";
import { safeOAuthReturnPath } from "./oauthIdentityPolicy";
import { decideOAuthIdentity, oauthIdentityFailure } from "./oauthIdentityPolicy";

describe("OAuth identity policy", () => {
  it.each([
    "//evil.invalid/",
    "/\\evil.invalid",
    "/%5Cevil.invalid",
    "/%2f%2fevil.invalid",
    "https://evil.invalid/",
    "/bad\npath",
    "/entry/..//evil.invalid",
    "/.%2e//evil.invalid",
    "/entry/%2E%2E//evil.invalid",
  ])("rejects unsafe return destination %s", (path) => {
    expect(safeOAuthReturnPath(path)).toBe("");
  });
  it("preserves the onboarding return URL, county query and hash", () => {
    const path = "/pre-scout-setup?mode=create&next=%2Fdirect-connect%3Fcounty%3D22005#form";
    expect(safeOAuthReturnPath(path)).toBe(path);
  });
  it("uses a matching provider subject as existing identity", () => {
    expect(
      decideOAuthIdentity({
        providerUserId: "user-1",
        emailUserId: "user-1",
      })
    ).toEqual({ kind: "existing", userId: "user-1" });
  });

  it("allows account creation only when neither subject nor email finds an account", () => {
    expect(decideOAuthIdentity({})).toEqual({ kind: "create" });
  });

  it("requires an authenticated link when only email finds an existing account", () => {
    const decision = decideOAuthIdentity({ emailUserId: "local-user" });

    expect(decision).toEqual({
      kind: "link_required",
      existingUserId: "local-user",
    });
    expect(oauthIdentityFailure("google", decision)).toEqual({
      code: "AUTH_ACCOUNT_LINK_REQUIRED",
      message:
        "An account with this email already exists. Sign in to that account before linking Google.",
    });
  });

  it("fails closed when provider subject and email point at different users", () => {
    const decision = decideOAuthIdentity({
      providerUserId: "provider-user",
      emailUserId: "email-user",
    });

    expect(decision).toEqual({
      kind: "identity_collision",
      providerUserId: "provider-user",
      emailUserId: "email-user",
    });
    expect(oauthIdentityFailure("facebook", decision)?.code).toBe("AUTH_IDENTITY_COLLISION");
  });

  it("does not expose a failure for safe existing or create decisions", () => {
    expect(
      oauthIdentityFailure("google", {
        kind: "existing",
        userId: "user-1",
      })
    ).toBeNull();
    expect(oauthIdentityFailure("facebook", { kind: "create" })).toBeNull();
  });
});
