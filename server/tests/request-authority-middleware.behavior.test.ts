import { Router } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  getUser: vi.fn(),
  logEvent: vi.fn().mockResolvedValue(undefined),
  acceptance: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("../storage", () => ({ storage: data }));
vi.mock("../db", () => ({ db: {}, pool: {} }));
vi.mock("../scout/toolDiscoveryObserver", () => ({
  getToolBlueprintQueue: vi.fn(),
  getProposalById: vi.fn(),
  approveBlueprint: vi.fn(),
  rejectBlueprint: vi.fn(),
  deferBlueprint: vi.fn(),
  mergeBlueprints: vi.fn(),
}));
vi.mock("../services/adminProductionAcceptance", () => ({
  runProductionAcceptanceReport: data.acceptance,
}));
vi.mock("../services/adminEcosystemTruth", () => ({
  runAdminEcosystemTruthReport: vi.fn(),
}));

import { bindAuthenticatedRequestAuthority, isAuthenticated } from "../auth";
import { checkTrustedDevice, DeviceAuthService } from "../deviceAuth";
import adminToolDiscoveryRouter from "../routes/admin-tool-discovery";

const principal = { id: "admin-1", role: "super_admin", isSuperAdmin: true };
const target = { id: "target-1", role: "homeowner", isSuperAdmin: false };

function request(url = "/api/example") {
  return {
    method: "POST",
    url,
    originalUrl: url,
    headers: {},
    user: principal,
    session: {
      originalUser: { ...principal },
      isImpersonating: true,
      impersonatedUserId: target.id,
      impersonatingRole: target.role,
    },
    isAuthenticated() {
      return Boolean(this.user);
    },
  } as any;
}

// Dispatch the actual Express middleware/router chain in process. No network
// listener, production database, credentials, or real user records are used.
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

beforeEach(() => {
  vi.restoreAllMocks();
  data.getUser.mockReset().mockResolvedValue({ ...target });
  data.logEvent.mockClear();
  data.acceptance.mockClear();
});

describe("effective account middleware interactions", () => {
  it("does not let a trusted-device token replace the impersonated account", async () => {
    const validate = vi
      .spyOn(DeviceAuthService, "validateSessionToken")
      .mockResolvedValue(principal as any);
    const req = request();
    req.headers["x-trusted-session"] = "synthetic-device-token";
    const router = Router();
    router.use(checkTrustedDevice, bindAuthenticatedRequestAuthority, isAuthenticated);
    router.post("/api/example", (req: any, res) => res.json({ id: req.user.id }));

    expect(await dispatch(router, req)).toEqual({ status: 200, body: { id: target.id } });
    expect(validate).not.toHaveBeenCalled();
    expect(data.getUser).toHaveBeenCalledTimes(1);
    expect(data.logEvent).toHaveBeenCalledWith("user.session_started", { userId: target.id });
  });

  it("restores the bound target if later middleware changes req.user", async () => {
    const router = Router();
    router.use(bindAuthenticatedRequestAuthority);
    router.use((req: any, _res, next) => {
      req.user = principal;
      next();
    });
    router.use(isAuthenticated);
    router.post("/api/example", (req: any, res) => res.json({ id: req.user.id }));
    expect(await dispatch(router, request())).toEqual({ status: 200, body: { id: target.id } });
    expect(data.getUser).toHaveBeenCalledTimes(1);
  });

  it("binds a valid trusted-device sign-in before feature authority", async () => {
    vi.spyOn(DeviceAuthService, "validateSessionToken").mockResolvedValue(principal as any);
    const req = request();
    req.user = undefined;
    req.session = {};
    req.headers["x-trusted-session"] = "synthetic-device-token";
    const router = Router();
    router.use(checkTrustedDevice, bindAuthenticatedRequestAuthority, isAuthenticated);
    router.post("/api/example", (req: any, res) =>
      res.json({
        id: req.user.id,
        boundId: req.requestAuthorityContext.effectiveUserId,
      })
    );
    expect(await dispatch(router, req)).toEqual({
      status: 200,
      body: { id: principal.id, boundId: principal.id },
    });
  });

  it("rejects an invalid target before producing a session event or feature action", async () => {
    data.getUser.mockResolvedValue(null);
    const router = Router();
    router.use(isAuthenticated);
    router.post("/api/example", (_req, res) => res.json({ reached: true }));
    const result = await dispatch(router, request());
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("AUTH_IDENTITY_CONTEXT_INVALID");
    expect(data.logEvent).not.toHaveBeenCalled();
  });
});

describe("Admin tool router and session exits", () => {
  const exitPaths = [
    "/api/admin/stop-impersonation",
    "/api/admin/impersonate/stop",
    "/api/admin/impersonate/exit",
    "/API/ADMIN/IMPERSONATE/EXIT/",
  ];

  it.each(exitPaths)("allows %s through the real mounted tool router", async (url) => {
    for (const loadedTarget of [target, null, { ...target, isActive: false }]) {
      data.getUser.mockResolvedValue(loadedTarget);
      const router = Router();
      router.use(bindAuthenticatedRequestAuthority);
      router.use("/api/admin", adminToolDiscoveryRouter);
      router.post(url, isAuthenticated, (_req, res) => res.json({ exitReached: true }));
      expect(await dispatch(router, request(url))).toEqual({
        status: 200,
        body: { exitReached: true },
      });
    }
    expect(data.getUser).not.toHaveBeenCalled();
    expect(data.acceptance).not.toHaveBeenCalled();
  });

  it("still blocks the tool's own administrative operations while impersonating", async () => {
    const router = Router();
    router.use(bindAuthenticatedRequestAuthority);
    router.use("/api/admin", adminToolDiscoveryRouter);
    const req = request("/api/admin/production-acceptance");
    req.method = "GET";
    const result = await dispatch(router, req);
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("IMPERSONATION_PRIVILEGE_BOUNDARY");
    expect(data.acceptance).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/production-acceptance"],
    ["POST", "/production-acceptance/write-canary"],
    ["GET", "/ecosystem-truth"],
    ["GET", "/tool-blueprints"],
    ["GET", "/tool-blueprints/synthetic-id"],
    ["POST", "/tool-blueprints/synthetic-id/decision"],
    ["POST", "/tool-blueprints/synthetic-id/approve"],
    ["POST", "/tool-blueprints/synthetic-id/reject"],
  ])("requires super-admin authority for %s %s", async (method, path) => {
    const router = Router();
    router.use(bindAuthenticatedRequestAuthority);
    router.use("/api/admin", adminToolDiscoveryRouter);
    for (const accountState of ["anonymous", "ordinary", "impersonating"] as const) {
      const req = request(`/api/admin${path}`);
      req.method = method;
      if (accountState !== "impersonating") {
        req.session = {};
        req.user = accountState === "ordinary" ? target : undefined;
      }
      expect((await dispatch(router, req)).status).toBe(accountState === "anonymous" ? 401 : 403);
    }
    expect(data.acceptance).not.toHaveBeenCalled();
  });
});
