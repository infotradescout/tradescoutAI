import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  database: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
  storage: {
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    logEvent: vi.fn(),
  },
  emailService: {
    isConfigured: vi.fn(),
    sendEmail: vi.fn(),
  },
  createEmailVerificationToken: vi.fn(),
  createPasswordResetToken: vi.fn(),
  createNotification: vi.fn(),
  sendNotification: vi.fn(),
  notifySuperAdmins: vi.fn(),
  recordRequestAction: vi.fn(),
  recordProviderDeliveryAttempt: vi.fn(),
  ensureSuperAdminConnection: vi.fn(),
  txValues: vi.fn(),
  txReturning: vi.fn(),
}));

vi.mock("../db", () => ({ db: mocks.database, pool: {} }));
vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
  isSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock("../services/emailService", () => ({
  emailService: mocks.emailService,
  maskEmailForLog: (value: unknown) => String(value || ""),
}));
vi.mock("../services/emailVerificationService", () => ({
  emailVerificationService: { createToken: mocks.createEmailVerificationToken },
}));
vi.mock("../services/passwordResetService", () => ({
  passwordResetService: { createToken: mocks.createPasswordResetToken },
}));
vi.mock("../notification-service", () => ({
  notificationService: {
    createNotification: mocks.createNotification,
    sendNotification: mocks.sendNotification,
  },
}));
vi.mock("../services/directConnectBetaOversight", () => ({
  notifySuperAdminsOfDirectConnectRequest: mocks.notifySuperAdmins,
}));
vi.mock("../services/ownerConfirmedDirectProfile", () => ({
  canExposePublishedProfilePublicly: () => true,
  hasTradeScoutPendingOwnerCustody: () => false,
}));
vi.mock("../services/discoveryObservatoryService", () => ({
  DiscoveryObservatoryService: class {
    recordRequestAction = mocks.recordRequestAction;
    recordProviderDeliveryAttempt = mocks.recordProviderDeliveryAttempt;
  },
}));
vi.mock("../utils/superAdminConnection", () => ({
  ensureSuperAdminConnectionForUser: mocks.ensureSuperAdminConnection,
}));

import { registerTradePartnerExpressRoutes } from "../routes/tradepartner-express";

const targetRow = {
  profileId: "profile-1",
  profileSlug: "public-profile",
  profileStatus: "published",
  ownerUserId: "provider-1",
  businessId: "business-1",
  businessName: "Example TradePartner",
  businessOwnerUserId: "provider-1",
  businessStatus: "active",
  businessClaimStatus: "claimed",
  businessSources: [],
  publicDiscoveryEnabled: true,
  profileData: { notificationEmail: "provider@example.com" },
  ownerProvider: "local",
  ownerPreferences: {},
  ownerVerifiedBadge: true,
  ownerVerificationStatus: "verified",
  ownerEmail: "provider@example.com",
};

const validBody = {
  name: "Guest Requester",
  email: "guest@example.com",
  phone: "404-555-0100",
  requestType: "request_quote",
  contactPreference: "platform_message",
  message: "Please provide a quote for this project.",
  updatesOptIn: true,
};

function buildApp(sessionUser?: { id?: string; claims?: { sub?: string } }) {
  const app = express();
  app.use(express.json());
  if (sessionUser) {
    app.use((req: any, _res, next) => {
      req.user = sessionUser;
      next();
    });
  }
  registerTradePartnerExpressRoutes(app);
  return app;
}

function expectNoDurableEffects() {
  expect(mocks.storage.createUser).not.toHaveBeenCalled();
  expect(mocks.storage.updateUser).not.toHaveBeenCalled();
  expect(mocks.database.transaction).not.toHaveBeenCalled();
  expect(mocks.createNotification).not.toHaveBeenCalled();
  expect(mocks.sendNotification).not.toHaveBeenCalled();
  expect(mocks.notifySuperAdmins).not.toHaveBeenCalled();
  expect(mocks.emailService.sendEmail).not.toHaveBeenCalled();
  expect(mocks.createEmailVerificationToken).not.toHaveBeenCalled();
  expect(mocks.createPasswordResetToken).not.toHaveBeenCalled();
  expect(mocks.recordRequestAction).not.toHaveBeenCalled();
  expect(mocks.recordProviderDeliveryAttempt).not.toHaveBeenCalled();
}

describe("tradepartner Express requester identity gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.resetAllMocks();

    const targetQuery: any = {};
    targetQuery.from = vi.fn(() => targetQuery);
    targetQuery.innerJoin = vi.fn(() => targetQuery);
    targetQuery.where = vi.fn(() => targetQuery);
    targetQuery.limit = vi.fn().mockResolvedValue([targetRow]);
    mocks.database.select.mockReturnValue(targetQuery);
    mocks.emailService.isConfigured.mockReturnValue(false);
    mocks.createNotification.mockResolvedValue(undefined);
    mocks.sendNotification.mockResolvedValue(undefined);
    mocks.notifySuperAdmins.mockResolvedValue(undefined);
    mocks.recordRequestAction.mockResolvedValue(undefined);
    mocks.recordProviderDeliveryAttempt.mockResolvedValue(undefined);
    mocks.ensureSuperAdminConnection.mockResolvedValue({ ensured: true });
  });

  it("rejects a stale session user id without falling back to the submitted email", async () => {
    mocks.storage.getUser.mockResolvedValue(null);

    const response = await request(buildApp({ id: "missing-session-user" }))
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send(validBody);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "SESSION_USER_NOT_FOUND",
      message: "Your session is no longer valid. Sign in again.",
    });
    expect(mocks.storage.getUser).toHaveBeenCalledWith("missing-session-user");
    expect(mocks.storage.getUserByEmail).not.toHaveBeenCalled();
    expectNoDurableEffects();
  });

  it("rejects a body email that differs from the authenticated account", async () => {
    mocks.storage.getUser.mockResolvedValue({
      id: "session-user-1",
      email: "session-owner@example.com",
      preferences: { marketingEmails: false },
    });

    const response = await request(buildApp({ claims: { sub: "session-user-1" } }))
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({ ...validBody, email: "victim@example.com", updatesOptIn: true });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "AUTHENTICATED_EMAIL_MISMATCH",
      message: "Use the email address for your signed-in account.",
    });
    expect(mocks.storage.getUserByEmail).not.toHaveBeenCalled();
    expectNoDurableEffects();
  });

  it("requires sign-in for a logged-out existing email before consent or request writes", async () => {
    const victim = {
      id: "victim-user-1",
      email: "victim@example.com",
      preferences: { marketingEmails: false },
    };
    mocks.storage.getUserByEmail.mockResolvedValue(victim);

    const response = await request(buildApp())
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({ ...validBody, email: "  Victim@Example.COM  ", updatesOptIn: true });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "EXISTING_ACCOUNT_SIGN_IN_REQUIRED",
      message: "Sign in to continue with this email.",
    });
    expect(mocks.storage.getUser).not.toHaveBeenCalled();
    expect(mocks.storage.getUserByEmail).toHaveBeenCalledWith("victim@example.com");
    expect(victim.preferences.marketingEmails).toBe(false);
    expectNoDurableEffects();
  });

  it("rejects an anonymous reserved recovery identifier without enumerating it", async () => {
    vi.stubEnv("MASTER_ADMIN_EMAIL", "reserved-recovery@example.com");

    const response = await request(buildApp())
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({
        ...validBody,
        email: " Reserved-Recovery@Example.com ",
        updatesOptIn: true,
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: "EXISTING_ACCOUNT_SIGN_IN_REQUIRED",
      message: "Sign in to continue with this email.",
    });
    expect(mocks.storage.getUser).not.toHaveBeenCalled();
    expect(mocks.storage.getUserByEmail).not.toHaveBeenCalled();
    expectNoDurableEffects();
  });

  it.each(["contact@thetradescout.com", "info.tradescout@gmail.com"])(
    "rejects reserved support inbox identity %s before guest provisioning",
    async (supportEmail) => {
      const response = await request(buildApp())
        .post("/api/tradepartner-profiles/public-profile/express-request")
        .send({ ...validBody, email: supportEmail, updatesOptIn: true });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        code: "EXISTING_ACCOUNT_SIGN_IN_REQUIRED",
        message: "Sign in to continue with this email.",
      });
      expect(mocks.storage.getUser).not.toHaveBeenCalled();
      expect(mocks.storage.getUserByEmail).not.toHaveBeenCalled();
      expectNoDurableEffects();
    }
  );

  it("rejects an authenticated owner before profile, consent, or request mutation", async () => {
    mocks.storage.getUser.mockResolvedValue({
      id: "provider-1",
      email: "provider@example.com",
      firstName: null,
      phone: null,
      preferences: { marketingEmails: false },
    });

    const response = await request(buildApp({ id: "provider-1" }))
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({
        ...validBody,
        email: "provider@example.com",
        updatesOptIn: true,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "EXPRESS_SELF_REQUEST_NOT_ALLOWED",
      message: "You cannot send a Direct Connect request to your own business profile.",
    });
    expect(mocks.storage.getUserByEmail).not.toHaveBeenCalled();
    expectNoDurableEffects();
  });

  it("preserves provisional onboarding for a genuinely new guest email", async () => {
    mocks.storage.getUserByEmail.mockResolvedValue(null);
    const createdGuest = {
      id: "new-guest-1",
      email: "new-guest@example.com",
      firstName: "New",
      lastName: "Guest",
      preferences: { marketingEmails: false },
    };
    const returningRows = [
      [createdGuest],
      [{ id: "request-1", status: "routed" }],
      [{ id: "decision-card-1" }],
      [{ id: "notification-1" }],
      [{ id: "permission-1" }],
    ];
    mocks.txValues.mockImplementation(() => ({
      returning: vi.fn(async () => returningRows.shift() || []),
    }));
    mocks.database.transaction.mockImplementation(async (work: (tx: any) => unknown) =>
      work({
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        insert: vi.fn(() => ({ values: mocks.txValues })),
      })
    );
    mocks.createPasswordResetToken.mockResolvedValue({ token: "activation-token" });
    mocks.createEmailVerificationToken.mockResolvedValue({ token: "verification-token" });

    const response = await request(buildApp())
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({ ...validBody, email: "new-guest@example.com", updatesOptIn: false });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      requestId: "request-1",
      accountCreated: true,
      contactPreference: "platform_message",
    });
    expect(mocks.storage.createUser).not.toHaveBeenCalled();
    expect(mocks.txValues.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        email: "new-guest@example.com",
        provider: "express_profile",
        onboardingCompleted: false,
        preferences: expect.objectContaining({ marketingEmails: false }),
      })
    );
    expect(mocks.database.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.ensureSuperAdminConnection).toHaveBeenCalledWith("new-guest-1");
    expect(mocks.createPasswordResetToken).toHaveBeenCalledWith("new-guest-1");
    expect(mocks.createEmailVerificationToken).toHaveBeenCalledWith("new-guest-1");
  });

  it("rolls guest provisioning back when durable authority creation fails", async () => {
    mocks.storage.getUserByEmail.mockResolvedValue(null);
    let durableUsers: any[] = [];
    mocks.database.transaction.mockImplementation(async (work: (tx: any) => Promise<unknown>) => {
      let stagedUsers = [...durableUsers];
      let insertIndex = 0;
      const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        insert: vi.fn(() => ({
          values: vi.fn((values: any) => {
            const currentIndex = insertIndex++;
            return {
              returning: vi.fn(async () => {
                if (currentIndex === 0) {
                  const stagedGuest = { id: "new-guest-1", ...values };
                  stagedUsers.push(stagedGuest);
                  return [stagedGuest];
                }
                if (currentIndex === 1) return [{ id: "request-1", ...values }];
                throw new Error("simulated Decision Card failure");
              }),
            };
          }),
        })),
      };
      const result = await work(tx);
      durableUsers = stagedUsers;
      return result;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(buildApp())
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({ ...validBody, email: "new-guest@example.com" });

    errorSpy.mockRestore();
    expect(response.status).toBe(500);
    expect(durableUsers).toEqual([]);
    expect(mocks.storage.createUser).not.toHaveBeenCalled();
    expect(mocks.storage.updateUser).not.toHaveBeenCalled();
    expect(mocks.ensureSuperAdminConnection).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
    expect(mocks.emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("rolls authenticated name, phone, and consent updates back with authority failure", async () => {
    const durableUser = {
      id: "session-user-1",
      email: "guest@example.com",
      firstName: null,
      lastName: null,
      phone: "404-555-0000",
      preferences: { marketingEmails: false },
    };
    mocks.storage.getUser.mockResolvedValue({ ...durableUser });
    let committedUser = { ...durableUser };
    mocks.database.transaction.mockImplementation(async (work: (tx: any) => Promise<unknown>) => {
      let stagedUser = { ...committedUser };
      let insertIndex = 0;
      const updateChain: any = {};
      updateChain.set = vi.fn((values: any) => {
        stagedUser = { ...stagedUser, ...values };
        return updateChain;
      });
      updateChain.where = vi.fn(() => updateChain);
      updateChain.returning = vi.fn(async () => [stagedUser]);
      const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        update: vi.fn(() => updateChain),
        insert: vi.fn(() => ({
          values: vi.fn((values: any) => {
            const currentIndex = insertIndex++;
            return {
              returning: vi.fn(async () => {
                if (currentIndex === 0) return [{ id: "request-1", ...values }];
                throw new Error("simulated Decision Card failure");
              }),
            };
          }),
        })),
      };
      const result = await work(tx);
      committedUser = stagedUser;
      return result;
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await request(buildApp({ id: "session-user-1" }))
      .post("/api/tradepartner-profiles/public-profile/express-request")
      .send({
        ...validBody,
        name: "Updated Requester",
        phone: "404-555-0100",
        updatesOptIn: true,
      });

    errorSpy.mockRestore();
    expect(response.status).toBe(500);
    expect(committedUser).toEqual(durableUser);
    expect(mocks.storage.updateUser).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
    expect(mocks.emailService.sendEmail).not.toHaveBeenCalled();
  });
});
