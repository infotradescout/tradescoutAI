import { describe, expect, it, vi } from "vitest";
import { resolveRequestAuthorityContext } from "../utils/requestEffectiveUser";

describe("resolveRequestAuthorityContext", () => {
  it("keeps a normal authenticated user as both principal and effective authority", async () => {
    const principalUser = { id: "user-1", role: "homeowner" };
    const loadUser = vi.fn();

    await expect(
      resolveRequestAuthorityContext({ user: principalUser, session: { cookie: {} } }, loadUser)
    ).resolves.toEqual({
      ok: true,
      principalUser,
      effectiveUser: principalUser,
      principalUserId: "user-1",
      effectiveUserId: "user-1",
      isImpersonating: false,
    });
    expect(loadUser).not.toHaveBeenCalled();
  });

  it("loads the target record and never carries the principal record into customer authority", async () => {
    const principalUser = { id: "admin-1", role: "super_admin", isSuperAdmin: true };
    const targetUser = { id: "customer-1", role: "homeowner", isSuperAdmin: false };
    const loadUser = vi.fn().mockResolvedValue(targetUser);

    await expect(
      resolveRequestAuthorityContext(
        {
          user: principalUser,
          session: {
            originalUser: { id: "admin-1", role: "super_admin" },
            isImpersonating: true,
            impersonatedUserId: "customer-1",
            impersonatingRole: "homeowner",
          },
        },
        loadUser
      )
    ).resolves.toEqual({
      ok: true,
      principalUser,
      effectiveUser: targetUser,
      principalUserId: "admin-1",
      effectiveUserId: "customer-1",
      isImpersonating: true,
    });
    expect(loadUser).toHaveBeenCalledWith("customer-1");
  });

  it("fails closed for a missing, inactive, or mismatched effective account", async () => {
    const request = {
      user: { id: "admin-1", role: "super_admin" },
      session: {
        originalUser: { id: "admin-1", role: "super_admin" },
        isImpersonating: true,
        impersonatedUserId: "customer-1",
        impersonatingRole: "homeowner",
      },
    };

    await expect(resolveRequestAuthorityContext(request, async () => null)).resolves.toEqual({
      ok: false,
      reason: "effective_user_missing",
    });
    await expect(
      resolveRequestAuthorityContext(request, async () => ({
        id: "customer-1",
        isActive: false,
      }))
    ).resolves.toEqual({ ok: false, reason: "effective_user_inactive" });
    await expect(
      resolveRequestAuthorityContext(request, async () => ({ id: "different-customer" }))
    ).resolves.toEqual({ ok: false, reason: "effective_user_mismatch" });
  });

  it("fails closed when the freshly deserialized principal has been deactivated", async () => {
    await expect(
      resolveRequestAuthorityContext(
        { user: { id: "suspended-user", isActive: false }, session: { cookie: {} } },
        async () => null
      )
    ).resolves.toEqual({ ok: false, reason: "principal_user_inactive" });
  });
});
