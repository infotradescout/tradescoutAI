import { describe, expect, it, vi } from "vitest";
import {
  isAdmin,
  isAuthenticated,
  isHeadAdmin,
  isModerator,
  isSuperAdmin,
  requireAdmin,
  requireAuth,
  requireRole,
} from "../auth";

function requestFor(user: Record<string, unknown>, isImpersonating = false) {
  return {
    isAuthenticated: () => true,
    originalUrl: "/api/admin/example",
    path: "/api/admin/example",
    method: "POST",
    user,
    requestAuthorityContext: {
      ok: true,
      principalUser: user,
      effectiveUser: user,
      principalUserId: String(user.id || "actor"),
      effectiveUserId: String(user.id || "actor"),
      isImpersonating,
    },
  } as any;
}

function responseRecorder() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

describe("canonical authority guards", () => {
  it("keeps compatibility exports as the same guard instances", () => {
    expect(requireAuth).toBe(isAuthenticated);
    expect(requireAdmin).toBe(isAdmin);
    expect(isModerator).toBe(isAdmin);
    expect(isHeadAdmin).toBe(isSuperAdmin);
  });

  it("does not promote a generic admin flag to super-admin authority", async () => {
    const guard = requireRole(["super_admin"]);
    const response = responseRecorder();
    const next = vi.fn();

    await guard(
      requestFor({ id: "moderator-1", role: "moderator", isAdmin: true }),
      response as any,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: "Insufficient permissions" });
  });

  it("accepts an explicit super-admin flag at the super-admin boundary", async () => {
    const guard = requireRole(["super_admin"]);
    const response = responseRecorder();
    const next = vi.fn();

    await guard(
      requestFor({ id: "super-1", role: "homeowner", isSuperAdmin: true }),
      response as any,
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
  });

  it("blocks super-admin actions while impersonating", async () => {
    const guard = requireRole(["super_admin"]);
    const response = responseRecorder();
    const next = vi.fn();

    await guard(requestFor({ id: "super-1", role: "super_admin" }, true), response as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      message: "Administrative authority is unavailable while acting as another user.",
      code: "IMPERSONATION_PRIVILEGE_BOUNDARY",
    });
  });
});
