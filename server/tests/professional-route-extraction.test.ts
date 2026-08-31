import fs from "node:fs";
import path from "node:path";
import express, { type Express, type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  isAdmin: vi.fn(),
  requireAdmin: vi.fn(),
  requireAddressVerification: vi.fn(),
  getPublicBaseUrlFromRequest: vi.fn(),
  sendEmail: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  storage: {
    getUserByEmail: vi.fn(),
    generateInvitationCode: vi.fn(),
    createInvitation: vi.fn(),
    incrementInvitationsSent: vi.fn(),
    getUserInvitations: vi.fn(),
    getInvitationByCode: vi.fn(),
    acceptInvitation: vi.fn(),
    incrementInvitationsAccepted: vi.fn(),
    getUser: vi.fn(),
    generateUserReferralCode: vi.fn(),
    getReferralStats: vi.fn(),
    getTopReferrers: vi.fn(),
    expireOldInvitations: vi.fn(),
    getRealtorProfile: vi.fn(),
    createRealtorProfile: vi.fn(),
    updateUserRole: vi.fn(),
    logEvent: vi.fn(),
    getCarSalesmanProfile: vi.fn(),
    createCarSalesmanProfile: vi.fn(),
    getPendingRealtorApplications: vi.fn(),
    getPendingCarSalesmanApplications: vi.fn(),
    updateRealtorVerificationStatus: vi.fn(),
    updateCarSalesmanVerificationStatus: vi.fn(),
  },
}));

vi.mock("../auth", () => ({
  isAuthenticated: mocks.isAuthenticated,
  isAdmin: mocks.isAdmin,
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("../requireAddressVerification", () => ({
  requireAddressVerification: mocks.requireAddressVerification,
}));

vi.mock("../services/emailService", () => ({
  emailService: {
    sendEmail: mocks.sendEmail,
  },
}));

vi.mock("../storage", () => ({
  storage: mocks.storage,
}));

vi.mock("../db", () => ({
  db: {
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
  },
}));

import { registerInvitationRoutes } from "../routes/invitations";
import { registerProfessionalNetworkRoutes } from "../routes/professional-network";
import { registerProfessionalPartnershipRoutes } from "../routes/professional-partnerships";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function configureMiddleware() {
  mocks.isAuthenticated.mockImplementation((req: any, _res: any, next: () => void) => {
    req.user = { id: "user-1", claims: { sub: "user-1" } };
    next();
  });
  mocks.isAdmin.mockImplementation((_req: any, _res: any, next: () => void) => next());
  mocks.requireAdmin.mockImplementation((_req: any, _res: any, next: () => void) => next());
  mocks.requireAddressVerification.mockImplementation((_req: any, _res: any, next: () => void) =>
    next()
  );
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerInvitationRoutes(app, {
    getPublicBaseUrlFromRequest: mocks.getPublicBaseUrlFromRequest,
  });
  registerProfessionalNetworkRoutes(app);
  registerProfessionalPartnershipRoutes(app);
  return app;
}

type CapturedRoute = {
  method: "get" | "post" | "patch";
  path: string;
  handlers: RequestHandler[];
};

function captureRouteRegistrations(): CapturedRoute[] {
  const routes: CapturedRoute[] = [];
  const app = {
    get: (routePath: string, ...handlers: RequestHandler[]) => {
      routes.push({ method: "get", path: routePath, handlers });
    },
    post: (routePath: string, ...handlers: RequestHandler[]) => {
      routes.push({ method: "post", path: routePath, handlers });
    },
    patch: (routePath: string, ...handlers: RequestHandler[]) => {
      routes.push({ method: "patch", path: routePath, handlers });
    },
  } as unknown as Express;

  registerInvitationRoutes(app, {
    getPublicBaseUrlFromRequest: mocks.getPublicBaseUrlFromRequest,
  });
  registerProfessionalNetworkRoutes(app);
  registerProfessionalPartnershipRoutes(app);
  return routes;
}

function middlewareSignature(route: CapturedRoute): string[] {
  return route.handlers.slice(0, -1).map((handler) => {
    if (handler === mocks.isAuthenticated) return "authenticated";
    if (handler === mocks.isAdmin) return "admin";
    if (handler === mocks.requireAdmin) return "admin";
    if (handler === mocks.requireAddressVerification) return "address";
    return "unknown";
  });
}

describe("professional route extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const mock of Object.values(mocks.storage)) mock.mockReset();
    mocks.dbSelect.mockReset();
    mocks.dbInsert.mockReset();
    mocks.getPublicBaseUrlFromRequest.mockReset().mockReturnValue("https://profiles.example");
    mocks.sendEmail.mockReset();
    configureMiddleware();
  });

  it("keeps the original 16 routes in order beside protected managed-partner operations", () => {
    const routes = captureRouteRegistrations();
    const managedRoutes = routes.filter((route) => route.path.includes("managed-partner"));
    const originalRoutes = routes.filter((route) => !route.path.includes("managed-partner"));

    expect(
      managedRoutes.map((route) => [route.method, route.path, middlewareSignature(route)])
    ).toEqual([
      ["get", "/api/admin/managed-partners", ["authenticated", "admin"]],
      ["get", "/api/admin/managed-partner-intakes", ["authenticated", "admin"]],
      ["post", "/api/admin/managed-partner-intakes", ["authenticated", "admin"]],
      ["patch", "/api/admin/managed-partner-intakes/:id", ["authenticated", "admin"]],
    ]);
    expect(
      originalRoutes.map((route) => [route.method, route.path, middlewareSignature(route)])
    ).toEqual([
      ["post", "/api/invitations/send", ["authenticated"]],
      ["get", "/api/invitations/my", ["authenticated"]],
      ["post", "/api/invitations/accept/:code", []],
      ["get", "/api/invitations/validate/:code", []],
      ["post", "/api/referrals/generate-code", ["authenticated"]],
      ["get", "/api/referrals/stats", ["authenticated"]],
      ["get", "/api/referrals/leaderboard", []],
      ["post", "/api/invitations/cleanup", ["authenticated", "admin"]],
      ["post", "/api/realtor/application", ["authenticated", "address"]],
      ["post", "/api/car-salesman/application", ["authenticated", "address"]],
      ["get", "/api/admin/professional/pending", ["authenticated", "admin"]],
      ["post", "/api/admin/realtor/verify/:profileId", ["authenticated", "admin"]],
      ["post", "/api/admin/car-salesman/verify/:profileId", ["authenticated", "admin"]],
      ["post", "/api/partnerships/request", ["authenticated"]],
      ["get", "/api/partnerships/my", ["authenticated"]],
      ["get", "/api/partnerships/find/:role", ["authenticated"]],
    ]);
    expect(routes.every((route) => route.handlers.at(-1) instanceof Function)).toBe(true);
  });

  it("wires the registrars once at the original root position and removes inline ownership", () => {
    const rootRoutes = read("server/routes.ts");
    const invitationCall = rootRoutes.indexOf(
      "registerInvitationRoutes(app, { getPublicBaseUrlFromRequest });"
    );
    const networkCall = rootRoutes.indexOf("registerProfessionalNetworkRoutes(app);");
    const partnershipCall = rootRoutes.indexOf("registerProfessionalPartnershipRoutes(app);");
    const affiliateRoutes = rootRoutes.indexOf(
      "// ==================== AFFILIATE SYSTEM ROUTES ===================="
    );

    expect(rootRoutes).toContain(
      'import { registerInvitationRoutes } from "./routes/invitations";'
    );
    expect(rootRoutes).toContain(
      'import { registerProfessionalNetworkRoutes } from "./routes/professional-network";'
    );
    expect(rootRoutes).toContain(
      'import { registerProfessionalPartnershipRoutes } from "./routes/professional-partnerships";'
    );
    expect(invitationCall).toBeGreaterThan(-1);
    expect(networkCall).toBeGreaterThan(invitationCall);
    expect(partnershipCall).toBeGreaterThan(networkCall);
    expect(affiliateRoutes).toBeGreaterThan(partnershipCall);

    for (const routePath of [
      "/api/invitations/send",
      "/api/referrals/stats",
      "/api/realtor/application",
      "/api/admin/professional/pending",
      "/api/partnerships/request",
      "/api/partnerships/find/:role",
    ]) {
      expect(rootRoutes).not.toContain(routePath);
    }
    expect(rootRoutes).not.toContain("professionalPartnerships,");
    expect(rootRoutes).not.toContain("insertRealtorProfileSchema,");
    expect(rootRoutes).not.toContain("insertCarSalesmanProfileSchema,");
  });

  it("keeps public invitation validation behavior outside authentication", async () => {
    mocks.storage.getInvitationByCode.mockResolvedValueOnce({
      status: "pending",
      inviteeEmail: "invitee@example.com",
      targetRole: "contractor",
      personalMessage: "Join our network",
    });

    const response = await request(buildApp()).get("/api/invitations/validate/code-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      valid: true,
      email: "invitee@example.com",
      targetRole: "contractor",
      personalMessage: "Join our network",
    });
    expect(mocks.storage.getInvitationByCode).toHaveBeenCalledWith("code-1");
    expect(mocks.isAuthenticated).not.toHaveBeenCalled();
  });

  it("preserves invitation creation, referral accounting, and email delivery", async () => {
    const invitation = { id: "invitation-1", invitationCode: "invite-code-1" };
    mocks.storage.getUserByEmail.mockResolvedValueOnce(undefined);
    mocks.storage.generateInvitationCode.mockResolvedValueOnce("invite-code-1");
    mocks.storage.createInvitation.mockResolvedValueOnce(invitation);
    mocks.storage.incrementInvitationsSent.mockResolvedValueOnce(undefined);
    mocks.sendEmail.mockResolvedValueOnce({ success: true });

    const response = await request(buildApp()).post("/api/invitations/send").send({
      email: "invitee@example.com",
      targetRole: "contractor",
      personalMessage: "Work with us",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(invitation);
    expect(mocks.storage.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        inviterId: "user-1",
        inviteeEmail: "invitee@example.com",
        targetRole: "contractor",
        invitationCode: "invite-code-1",
        type: "email",
        status: "pending",
        expiresAt: expect.any(Date),
      })
    );
    expect(mocks.storage.incrementInvitationsSent).toHaveBeenCalledWith("user-1");
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "invitee@example.com",
        purpose: "invitation",
        html: expect.stringContaining("https://profiles.example/register?invite=invite-code-1"),
      })
    );
  });

  it("preserves the address gate on professional applications", async () => {
    mocks.storage.getRealtorProfile.mockResolvedValueOnce({ id: "realtor-1" });

    const response = await request(buildApp()).post("/api/realtor/application").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "You already have a realtor profile" });
    expect(mocks.isAuthenticated).toHaveBeenCalledOnce();
    expect(mocks.requireAddressVerification).toHaveBeenCalledOnce();
    expect(mocks.storage.getRealtorProfile).toHaveBeenCalledWith("user-1");
  });

  it("preserves admin aggregation of pending professional applications", async () => {
    mocks.storage.getPendingRealtorApplications.mockResolvedValueOnce([{ id: "realtor-1" }]);
    mocks.storage.getPendingCarSalesmanApplications.mockResolvedValueOnce([{ id: "dealer-1" }]);

    const response = await request(buildApp()).get("/api/admin/professional/pending");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      realtors: [{ id: "realtor-1" }],
      carSalesmen: [{ id: "dealer-1" }],
    });
    expect(mocks.isAuthenticated).toHaveBeenCalledOnce();
    expect(mocks.isAdmin).toHaveBeenCalledOnce();
  });

  it("preserves duplicate checking and creation for professional partnerships", async () => {
    const selectLimit = vi.fn().mockResolvedValueOnce([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    mocks.dbSelect.mockReturnValueOnce({ from: selectFrom });

    const partnership = {
      id: "partnership-1",
      initiatorId: "user-1",
      partnerId: "partner-1",
      status: "pending",
    };
    const returning = vi.fn().mockResolvedValueOnce([partnership]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.dbInsert.mockReturnValueOnce({ values });

    const response = await request(buildApp()).post("/api/partnerships/request").send({
      partnerId: "partner-1",
      partnershipType: "referral",
      referralTerms: "Mutual referrals",
      partnershipDescription: "Serve the same county",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(partnership);
    expect(values).toHaveBeenCalledWith({
      initiatorId: "user-1",
      partnerId: "partner-1",
      partnershipType: "referral",
      referralTerms: "Mutual referrals",
      partnershipDescription: "Serve the same county",
      status: "pending",
    });
  });
});
