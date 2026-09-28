import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfileAccount, loadProfileAccountState, parseProfileAccountResponse, registerProfileAccount } from "./profileAccountClient";

const guest = {
  policy: { enabled: true, profileSlug: "jw-stone", requiredIdentity: "business", includesBidRock: true },
  viewerBusiness: null, requiresBusinessSetup: true, account: null, entitlements: [],
};
const member = {
  ...guest,
  viewerBusiness: { id: "business-1", name: "Synthetic Company", verificationStatus: "pending" },
  requiresBusinessSetup: false,
  account: { id: "account-1", profileSlug: "jw-stone", identityKind: "business", status: "active", verificationStatus: "pending" },
  entitlements: [{ productKey: "jw_stone_member_pricing", status: "revoked" }],
};
afterEach(() => vi.unstubAllGlobals());

describe("company account response integrity", () => {
  it("accepts the explicit guest state without creating a relationship", () => {
    expect(parseProfileAccountResponse(guest, "jw-stone")).toBe(guest);
  });
  it("preserves pending verification and revoked pricing on a connected account", () => {
    const parsed = parseProfileAccountResponse(member, "jw-stone");
    expect(parsed).toBe(member);
    expect(parsed.account?.verificationStatus).toBe("pending");
    expect(parsed.entitlements[0].status).toBe("revoked");
  });
  it.each([null, undefined, [], "<html>login</html>", {}, { ...guest, policy: null },
    { ...guest, policy: { ...guest.policy, profileSlug: "another-company" } },
    { ...guest, policy: { ...guest.policy, requiredIdentity: "admin" } },
    { ...guest, requiresBusinessSetup: undefined }, { ...guest, entitlements: null },
    { ...guest, viewerBusiness: {} }, { ...guest, account: {} },
    { ...member, account: { ...member.account, profileSlug: "another-company" } },
    { ...member, account: { ...member.account, status: "unknown" } },
    { ...member, entitlements: [{ productKey: "bidrock", status: "approved" }] },
  ])("rejects incomplete or wrong-company state: %j", value => {
    expect(() => parseProfileAccountResponse(value, "jw-stone")).toThrow(/could not be checked/);
  });
  it.each(["suspended", "closed"])("does not change %s relationship status", status => {
    const value = { ...member, account: { ...member.account, status } };
    expect(parseProfileAccountResponse(value, "jw-stone").account?.status).toBe(status);
  });
  it("supports normal user-backed company accounts without inventing business verification", () => {
    const value = { ...guest, policy: { ...guest.policy, profileSlug: "local-shop", requiredIdentity: "user", includesBidRock: false }, requiresBusinessSetup: false,
      account: { id: "customer-account", profileSlug: "local-shop", identityKind: "user", status: "active", verificationStatus: "not_required" } };
    expect(parseProfileAccountResponse(value, "local-shop")).toBe(value);
  });
  it("turns an HTML account read into a recoverable error rather than a form crash", async () => {
    const fetch = vi.fn(async () => new Response("<html>cached page</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(loadProfileAccountState("jw-stone")).rejects.toMatchObject({ code: "PROFILE_ACCOUNT_INVALID_RESPONSE" });
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "include", cache: "no-store", redirect: "error" }));
  });
  it("does not accept a malformed 201 as registration success or retry the POST", async () => {
    const fetch = vi.fn(async () => Response.json({}, { status: 201 })); vi.stubGlobal("fetch", fetch);
    await expect(registerProfileAccount({ profileSlug: "jw-stone", businessName: "Synthetic", firstName: "Test", lastName: "Person", email: "test@example.invalid", phone: "2025550100", password: "SyntheticOnly1", acceptTerms: true, sourcePath: "/", next: "/u/jw-stone?profileAccount=1" })).rejects.toMatchObject({ code: "PROFILE_ACCOUNT_INVALID_RESPONSE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves real account-conflict codes instead of turning them into shape errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "AUTH_ACCOUNT_EXISTS", message: "Sign in to continue." }, { status: 409 })));
    await expect(createProfileAccount({ profileSlug: "jw-stone", sourcePath: "/" })).rejects.toMatchObject({ status: 409, code: "AUTH_ACCOUNT_EXISTS" });
  });
});
