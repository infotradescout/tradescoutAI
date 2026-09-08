import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import passport from "passport";
import { setupAuth } from "../auth";
import { OAuthIdentityCollisionError } from "../utils/oauthIdentityPolicy";

const data = vi.hoisted(() => ({
  getUserByGoogleId: vi.fn(),
  getUserByFacebookId: vi.fn(),
  getOAuthUsersByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  welcome: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("../storage", () => ({ storage: data }));
vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../utils/advisoryLocks", () => ({ withAdvisoryLock: data.lock }));
vi.mock("connect-pg-simple", () => ({ default: () => class SyntheticSessionStore {} }));
vi.mock("express-session", () => ({ default: () => (_req: any, _res: any, next: any) => next() }));

beforeAll(async () => {
  for (const [name, value] of Object.entries({
    SESSION_SECRET: "synthetic-session-secret",
    DISABLE_FACEBOOK_AUTH: "false",
    GOOGLE_CLIENT_ID: "synthetic-google",
    GOOGLE_CLIENT_SECRET: "synthetic-secret",
    FACEBOOK_APP_ID: "synthetic-facebook",
    FACEBOOK_APP_SECRET: "synthetic-secret",
    GOOGLE_CALLBACK_URL: "http://localhost:5202/api/auth/google/callback",
    FACEBOOK_CALLBACK_URL: "http://localhost:5202/api/auth/facebook/callback",
    PRIVILEGED_ALIAS_EMAILS: "reserved@example.invalid",
  }))
    vi.stubEnv(name, value);
  await setupAuth({ set: vi.fn(), use: vi.fn() } as any, { onNewSocialUser: data.welcome });
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  data.getUserByGoogleId.mockReset().mockResolvedValue(undefined);
  data.getUserByFacebookId.mockReset().mockResolvedValue(undefined);
  data.getOAuthUsersByEmail.mockReset().mockResolvedValue([]);
  data.createUser
    .mockReset()
    .mockImplementation(async (values) => ({ id: "new-account", ...values }));
  data.lock.mockReset().mockImplementation(async (_key, operation) => operation());
  data.welcome.mockReset().mockResolvedValue(undefined);
});

for (const provider of ["google", "facebook"] as const) {
  describe(`${provider} registered strategy callback`, () => {
    const providerLookup =
      provider === "google" ? data.getUserByGoogleId : data.getUserByFacebookId;
    const existing = { id: "existing-account", email: "member@example.invalid", role: "homeowner" };
    function invoke(overrides: Record<string, unknown> = {}) {
      // Execute the callback registered on the real Passport strategy, not a
      // copied resolver. Token exchange/network is outside this synthetic proof.
      const strategy = (passport as any)._strategy(provider);
      expect(strategy.name).toBe(provider);
      return new Promise<{ error: any; user: any; info: any }>((resolve) => {
        strategy._verify(
          "synthetic-token",
          "",
          {
            id: "provider-subject",
            displayName: "Synthetic Person",
            emails: [{ value: " Member@Example.Invalid " }],
            name: { givenName: "Synthetic", familyName: "Person" },
            ...overrides,
          },
          (error: any, user: any, info: any) => resolve({ error, user, info })
        );
      });
    }

    it("signs in the stored subject owner with unchanged authority", async () => {
      providerLookup.mockResolvedValue(existing);
      data.getOAuthUsersByEmail.mockResolvedValue([existing]);
      const result = await invoke();
      expect(result.error).toBeNull();
      expect(result.user).toEqual({ ...existing, _wasNewSocialUser: false });
      expect(providerLookup).toHaveBeenCalledWith("provider-subject");
      expect(data.updateUser).not.toHaveBeenCalled();
      expect(data.createUser).not.toHaveBeenCalled();
      expect(data.welcome).not.toHaveBeenCalled();
    });
    it("retains the subject owner when their provider email changes or disappears", async () => {
      providerLookup.mockResolvedValue(existing);
      for (const emails of [[{ value: "changed@example.invalid" }], []]) {
        expect((await invoke({ emails })).user.id).toBe(existing.id);
      }
      expect(data.updateUser).not.toHaveBeenCalled();
      expect(data.createUser).not.toHaveBeenCalled();
    });
    it("requires the existing sign-in method for an email-only match", async () => {
      data.getOAuthUsersByEmail.mockResolvedValue([existing]);
      const result = await invoke();
      expect(result.user).toBe(false);
      expect(result.info.code).toBe("AUTH_ACCOUNT_LINK_REQUIRED");
      expect(data.createUser).not.toHaveBeenCalled();
      expect(data.updateUser).not.toHaveBeenCalled();
      expect(data.welcome).not.toHaveBeenCalled();
    });
    it("rejects a different email owner instead of switching accounts", async () => {
      providerLookup.mockResolvedValue(existing);
      data.getOAuthUsersByEmail.mockResolvedValue([{ id: "other-account" }]);
      const result = await invoke();
      expect(result.user).toBe(false);
      expect(result.info.code).toBe("AUTH_IDENTITY_COLLISION");
      expect(data.createUser).not.toHaveBeenCalled();
      expect(data.updateUser).not.toHaveBeenCalled();
    });
    it("rejects ambiguous case-insensitive email records even if one owns the subject", async () => {
      providerLookup.mockResolvedValue(existing);
      data.getOAuthUsersByEmail.mockResolvedValue([existing, { id: "duplicate-account" }]);
      expect((await invoke()).info.code).toBe("AUTH_IDENTITY_COLLISION");
      expect(data.createUser).not.toHaveBeenCalled();
    });
    it("rejects storage-level subject collisions", async () => {
      providerLookup.mockRejectedValue(new OAuthIdentityCollisionError());
      const result = await invoke();
      expect(result.user).toBe(false);
      expect(result.info.code).toBe("AUTH_IDENTITY_COLLISION");
      expect(data.createUser).not.toHaveBeenCalled();
    });
    it("creates an unverified, unfinished account and dispatches the real setup hook once", async () => {
      const result = await invoke();
      expect(result.error).toBeNull();
      expect(result.user._wasNewSocialUser).toBe(true);
      expect(data.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "member@example.invalid",
          provider,
          providerId: "provider-subject",
          [provider === "google" ? "googleId" : "facebookId"]: "provider-subject",
          role: null,
          emailVerified: false,
          onboardingCompleted: false,
        })
      );
      expect(data.welcome).toHaveBeenCalledExactlyOnceWith(result.user, provider);
      expect(data.updateUser).not.toHaveBeenCalled();
    });
    it("does not make welcome-service failure a second signup or failed login", async () => {
      data.welcome.mockRejectedValue(new Error("synthetic welcome failure"));
      expect((await invoke()).user.id).toBe("new-account");
      expect(data.createUser).toHaveBeenCalledOnce();
    });
    it("preserves reserved-signup denial without email-alias authority", async () => {
      const result = await invoke({ emails: [{ value: "reserved@example.invalid" }] });
      expect(result.user).toBe(false);
      expect(result.info.code).toBe("AUTH_ACCOUNT_EXISTS");
      expect(data.createUser).not.toHaveBeenCalled();
      expect(data.welcome).not.toHaveBeenCalled();
    });
    it("rejects missing subject before acquiring locks or writing", async () => {
      expect((await invoke({ id: " " })).info.code).toBe("AUTH_IDENTITY_CONTEXT_INVALID");
      expect(data.lock).not.toHaveBeenCalled();
      expect(providerLookup).not.toHaveBeenCalled();
      expect(data.createUser).not.toHaveBeenCalled();
    });
    it("fails closed on account-storage failure", async () => {
      providerLookup.mockRejectedValue(new Error("synthetic lookup unavailable"));
      const result = await invoke();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.user).toBeUndefined();
      expect(data.createUser).not.toHaveBeenCalled();
    });
    it.each([1, 2])(
      "denies contention at lock %s before creating another account",
      async (lockNumber) => {
        let calls = 0;
        data.lock.mockImplementation(async (_key, operation) =>
          ++calls === lockNumber ? null : operation()
        );
        expect((await invoke()).info.code).toBe("AUTH_OAUTH_RETRY");
        expect(data.createUser).not.toHaveBeenCalled();
      }
    );
    it("handles a wrapped uniqueness race without attaching the winning email account", async () => {
      data.createUser.mockRejectedValue({ cause: { code: "23505" } });
      expect((await invoke()).info.code).toBe("AUTH_ACCOUNT_LINK_REQUIRED");
      expect(data.updateUser).not.toHaveBeenCalled();
      expect(data.welcome).not.toHaveBeenCalled();
    });
  });
}
