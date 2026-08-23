import { describe, expect, it } from "vitest";
import { resolveRequestEffectiveUser } from "../utils/requestEffectiveUser";

describe("resolveRequestEffectiveUser", () => {
  it("uses the authenticated principal when no impersonation marker exists", () => {
    expect(
      resolveRequestEffectiveUser({
        user: { id: "principal-user", claims: { sub: "claims-user" } },
        session: { cookie: {} },
      })
    ).toEqual({
      ok: true,
      principalUserId: "principal-user",
      effectiveUserId: "principal-user",
      isImpersonating: false,
    });

    expect(resolveRequestEffectiveUser({ user: { claims: { sub: "claims-user" } } })).toEqual({
      ok: true,
      principalUserId: "claims-user",
      effectiveUserId: "claims-user",
      isImpersonating: false,
    });
  });

  it("uses the server-recorded target for a complete coherent impersonation session", () => {
    expect(
      resolveRequestEffectiveUser({
        user: { id: "admin-user" },
        session: {
          originalUser: { id: "admin-user", role: "super_admin" },
          isImpersonating: true,
          impersonatedUserId: "target-user",
          impersonatingRole: "contractor",
        },
      })
    ).toEqual({
      ok: true,
      principalUserId: "admin-user",
      effectiveUserId: "target-user",
      isImpersonating: true,
    });
  });

  it("fails closed instead of falling back for incomplete or contradictory markers", () => {
    const ambiguousRequests = [
      {
        user: { id: "admin-user" },
        session: { isImpersonating: true, impersonatedUserId: "target-user" },
      },
      {
        user: { id: "admin-user" },
        session: {
          originalUser: { id: "admin-user" },
          isImpersonating: false,
          impersonatedUserId: "target-user",
          impersonatingRole: "contractor",
        },
      },
      {
        user: { id: "admin-user" },
        session: {
          originalUser: { id: "different-admin" },
          isImpersonating: true,
          impersonatedUserId: "target-user",
          impersonatingRole: "contractor",
        },
      },
      {
        user: { id: "admin-user" },
        session: { originalUser: { id: "admin-user" } },
      },
      {
        user: { id: "admin-user" },
        session: {
          originalUser: { id: ["admin-user"] },
          isImpersonating: true,
          impersonatedUserId: ["target-user"],
          impersonatingRole: { arbitrary: true },
        },
      },
      {
        user: { id: 12345 },
        session: {},
      },
    ];

    for (const request of ambiguousRequests) {
      expect(resolveRequestEffectiveUser(request).ok).toBe(false);
    }
  });

  it("fails closed when no authenticated principal can be resolved", () => {
    expect(resolveRequestEffectiveUser({ user: {}, session: {} })).toEqual({
      ok: false,
      reason: "missing_principal",
    });
  });
});
