import { Router, type RequestHandler } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "../../shared/roles";

const data = vi.hoisted(() => ({
  getUser: vi.fn(),
  logEvent: vi.fn().mockResolvedValue(undefined),
  deserializeUser: vi.fn(),
  getPromptStatus: vi.fn().mockReturnValue({ loaded: true }),
}));
vi.mock("../storage", () => ({ storage: data }));
vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../services/promptService", () => ({
  getPromptStatus: data.getPromptStatus,
  reloadSystemPrompt: vi.fn(),
}));
vi.mock("connect-pg-simple", () => ({ default: () => class SyntheticSessionStore {} }));
vi.mock("express-session", () => ({ default: () => (_req: any, _res: any, next: any) => next() }));
vi.mock("passport", () => ({
  default: {
    initialize: () => (_req: any, _res: any, next: any) => next(),
    session: () => (_req: any, _res: any, next: any) => next(),
    use: vi.fn(),
    serializeUser: vi.fn(),
    deserializeUser: data.deserializeUser,
  },
}));

import {
  bindAuthenticatedRequestAuthority,
  isAdmin,
  isAuthenticated,
  isCommunityModerator,
  isHeadAdmin,
  isModerator,
  isStaff,
  isSuperAdmin,
  requireAdmin,
  requireAuth,
  requireRole,
  setupAuth,
} from "../auth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";
import adminControl from "../routes/admin-control";
import promptAdmin from "../routes/promptAdmin";

const ordinary = { id: "synthetic-account", role: "homeowner" };
const admin = { id: "synthetic-admin", role: "super_admin" };
function request(user: any = ordinary, url = "/operation") {
  return {
    method: "GET",
    url,
    originalUrl: url,
    headers: {},
    user,
    session: {},
    isAuthenticated() {
      return Boolean(this.user);
    },
  } as any;
}

// Run actual Express middleware/router dispatch with synthetic server identities.
// There are no network listeners, database writes, prompt writes or live accounts.
function dispatch(router: ReturnType<typeof Router>, req: any) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    let status = 200;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      setHeader() {},
      json(body: any) {
        resolve({ status, body });
        return this;
      },
    };
    (router as any).handle(req, res, (error: unknown) => {
      if (error) reject(error);
      else resolve({ status: 404, body: null });
    });
  });
}

function runGuard(guard: RequestHandler, req = request()) {
  const router = Router();
  router.use(guard);
  router.get("/operation", (req: any, res) => res.json({ id: req.user.id }));
  return dispatch(router, req);
}

function impersonating(targetRole = "super_admin") {
  const req = request(admin);
  req.session = {
    originalUser: admin,
    isImpersonating: true,
    impersonatedUserId: ordinary.id,
    impersonatingRole: targetRole,
  };
  return req;
}

beforeEach(() => {
  data.getUser.mockReset().mockResolvedValue(ordinary);
  data.logEvent.mockClear();
  data.getPromptStatus.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("canonical role guard identity", () => {
  it("keeps legacy entry points as the same canonical guard instances", () => {
    expect(requireAuth).toBe(isAuthenticated);
    expect(requireAdmin).toBe(isAdmin);
    expect(isModerator).toBe(isAdmin);
    expect(isHeadAdmin).toBe(isSuperAdmin);
    expect(requireSuperAdmin).toBe(isSuperAdmin);
  });

  it("allows a generic admin flag only at the explicitly named moderator tier", async () => {
    const user = { ...ordinary, isAdmin: true };
    expect((await runGuard(isAdmin, request(user))).status).toBe(200);
    expect((await runGuard(isSuperAdmin, request(user))).status).toBe(403);
    expect((await runGuard(requireRole(["ops_admin"]), request(user))).status).toBe(403);
    expect((await runGuard(requireRole(["homeowner"]), request(user))).status).toBe(200);
  });

  it.each([
    { role: "super_admin" },
    { role: "owner" },
    { role: " HEAD_ADMIN " },
    { activeRole: "super_admin" },
    { roles: ["super_admin"] },
    { isSuperAdmin: true },
  ])("accepts an explicit persisted super-admin grant %j", async (grant) => {
    expect((await runGuard(isSuperAdmin, request({ ...ordinary, ...grant }))).status).toBe(200);
  });

  it.each([{ isAdmin: "true" }, { isSuperAdmin: "true" }, { role: "regional_admin" }, {}])(
    "does not infer privilege from %j",
    async (grant) => {
      expect((await runGuard(isAdmin, request({ ...ordinary, ...grant }))).status).toBe(403);
    }
  );

  it.each(["moderator", "ops_admin", "super_admin"] as UserRole[])(
    "retains named admin access for %s",
    async (role) => {
      expect((await runGuard(isAdmin, request({ ...ordinary, role }))).status).toBe(200);
    }
  );

  it.each([
    "support_agent",
    "content_moderator",
    "territory_manager",
    "contractor_success",
    "content_seo",
    "analytics_specialist",
    "marketing_specialist",
    "moderator",
    "ops_admin",
    "super_admin",
  ] as UserRole[])("retains named staff access for %s", async (role) => {
    expect((await runGuard(isStaff, request({ ...ordinary, role }))).status).toBe(200);
  });

  it.each([
    "community_moderator",
    "community_leader",
    "moderator",
    "ops_admin",
    "super_admin",
  ] as UserRole[])("retains named community moderation access for %s", async (role) => {
    expect((await runGuard(isCommunityModerator, request({ ...ordinary, role }))).status).toBe(200);
  });

  it.each([
    ["support_agent", "community_moderator"],
    ["super_admin", "contractor_user"],
    ["content_seo", "support_agent"],
    ["community_leader", "realtor"],
  ] as [UserRole, UserRole][])("denies %s an unrelated %s grant", async (role, allowed) => {
    expect((await runGuard(requireRole([allowed]), request({ ...ordinary, role }))).status).toBe(
      403
    );
  });

  it("honors explicit secondary roles without numeric inheritance", async () => {
    const user = { ...ordinary, roles: ["support_agent", "contractor_user"] };
    expect((await runGuard(requireRole(["support_agent"]), request(user))).status).toBe(200);
    expect((await runGuard(isCommunityModerator, request(user))).status).toBe(403);
    expect((await runGuard(requireRole([]), request(user))).status).toBe(403);
  });

  it("keeps reserved email aliases powerless with a valid ordinary identity", async () => {
    vi.stubEnv("PRIVILEGED_ALIAS_EMAILS", "synthetic-reserved@example.invalid");
    for (const emailGrant of [
      { email: "synthetic-reserved@example.invalid" },
      { claims: { email: "synthetic-reserved@example.invalid" } },
    ]) {
      for (const guard of [isAdmin, isSuperAdmin]) {
        const result = await runGuard(guard, request({ ...ordinary, ...emailGrant }));
        expect(result).toEqual({ status: 403, body: { message: "Insufficient permissions" } });
      }
    }
  });
});

describe("request identity and role guards", () => {
  it("hydrates the current role from storage when deserializing a session ID", async () => {
    vi.stubEnv("SESSION_SECRET", "synthetic-session-secret");
    vi.stubEnv("DISABLE_FACEBOOK_AUTH", "true");
    vi.stubEnv("FACEBOOK_APP_ID", "");
    vi.stubEnv("FACEBOOK_CLIENT_ID", "");
    await setupAuth({ set: vi.fn(), use: vi.fn() } as any);
    const deserialize = data.deserializeUser.mock.calls.at(-1)![0];
    for (const loaded of [{ ...ordinary, role: "super_admin" }, ordinary]) {
      data.getUser.mockResolvedValue(loaded);
      const done = vi.fn();
      await deserialize(ordinary.id, done);
      expect(data.getUser).toHaveBeenLastCalledWith(ordinary.id);
      expect(done).toHaveBeenCalledWith(null, loaded);
      expect((await runGuard(isSuperAdmin, request(done.mock.calls[0][1]))).status).toBe(
        loaded.role === "super_admin" ? 200 : 403
      );
    }
    data.getUser.mockRejectedValueOnce(new Error("synthetic storage failure"));
    const done = vi.fn();
    await deserialize(ordinary.id, done);
    expect(done).toHaveBeenCalledWith(expect.any(Error));
  });

  it("rejects unauthenticated and inactive principal accounts", async () => {
    expect((await runGuard(isAdmin, request(null))).status).toBe(401);
    const result = await runGuard(isSuperAdmin, request({ ...admin, isActive: false }));
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("AUTH_IDENTITY_CONTEXT_INVALID");
  });

  it("denies privileged guards during impersonation even outside admin URL prefixes", async () => {
    data.getUser.mockResolvedValue({ ...ordinary, role: "super_admin", isSuperAdmin: true });
    const result = await runGuard(isSuperAdmin, impersonating());
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("IMPERSONATION_PRIVILEGE_BOUNDARY");
    expect(data.getUser).toHaveBeenCalledWith(ordinary.id);
  });

  it.each([null, { ...ordinary, isActive: false }, { ...ordinary, id: "wrong-target" }])(
    "fails closed for an invalid fresh target %j",
    async (target) => {
      data.getUser.mockResolvedValue(target);
      const result = await runGuard(requireRole(["homeowner"]), impersonating("homeowner"));
      expect(result.status).toBe(403);
      expect(result.body.code).toBe("AUTH_IDENTITY_CONTEXT_INVALID");
    }
  );

  it("does not use claimed impersonation roles if target loading fails", async () => {
    data.getUser.mockRejectedValueOnce(new Error("synthetic storage failure"));
    const result = await runGuard(isAdmin, impersonating());
    expect(result.status).toBe(503);
    expect(result.body.code).toBe("AUTH_IDENTITY_CONTEXT_UNAVAILABLE");
  });

  it("restores the bound effective identity before evaluating later role guards", async () => {
    const router = Router();
    router.use(bindAuthenticatedRequestAuthority);
    router.use((req: any, _res, next) => {
      req.user = admin;
      next();
    });
    router.use(requireRole(["support_agent"]));
    router.get("/operation", (req: any, res) => res.json({ id: req.user.id }));
    data.getUser.mockResolvedValue({ ...ordinary, role: "support_agent" });
    const result = await dispatch(router, impersonating("homeowner"));
    expect(result).toEqual({ status: 200, body: { id: ordinary.id } });
    expect(data.getUser).toHaveBeenCalledTimes(1);
  });
});

describe("standalone privileged router boundaries", () => {
  it.each([
    ["/api/admin-control/state", "/api/admin-control", adminControl],
    ["/api/prompt-admin/status", "/api/prompt-admin", promptAdmin],
  ] as const)("enforces the canonical guard at %s", async (url, mount, featureRouter) => {
    const router = Router();
    router.use(mount, featureRouter);
    for (const [user, expected] of [
      [null, 401],
      [ordinary, 403],
      [{ ...ordinary, isAdmin: true }, 403],
      [{ ...ordinary, roles: ["super_admin"] }, 200],
      [admin, 200],
    ] as const) {
      expect((await dispatch(router, request(user, url))).status).toBe(expected);
    }
    const req = impersonating();
    req.url = req.originalUrl = url;
    data.getUser.mockResolvedValue({ ...ordinary, role: "super_admin" });
    const result = await dispatch(router, req);
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("IMPERSONATION_PRIVILEGE_BOUNDARY");
  });
});
