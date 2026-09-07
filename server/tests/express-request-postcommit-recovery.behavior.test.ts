import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ADMIN_MANAGED_PROFILE_SOURCE } from "@shared/publicProfileExposureRegistry";

const mocks = vi.hoisted(() => ({
  inserted: {} as Record<string, any[]>,
  transactionFails: false,
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  activationToken: vi.fn(),
  verificationToken: vi.fn(),
  notifyOwner: vi.fn(),
  recordRequestAction: vi.fn(),
}));

vi.mock("../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const target = {
    profileId: "synthetic-profile",
    profileSlug: "louisiana-stone-solutions",
    profileStatus: "published",
    businessId: "synthetic-business",
    businessName: "Louisiana Stone Solutions",
    ownerUserId: "synthetic-business-owner",
    businessOwnerUserId: "synthetic-business-owner",
    businessStatus: "active",
    businessClaimStatus: "claimed",
    businessSources: [ADMIN_MANAGED_PROFILE_SOURCE],
    publicDiscoveryEnabled: false,
    ownerProvider: "local",
    ownerEmailVerified: false,
    ownerPreferences: {
      profileVisibility: "private",
      publicProfileIds: ["synthetic-profile"],
    },
    profileData: { notificationEmail: "selected-business@example.invalid" },
  };
  const db: any = {
    execute: vi.fn(async () => ({
      rows: [{
        request_metadata: mocks.inserted.work_request_events?.find(
          (event) => event.type === "created"
        )?.metadata,
      }],
    })),
    transaction: async (run: any) => {
      if (mocks.transactionFails) throw new Error("synthetic transaction failure");
      return run(db);
    },
    insert: (table: any) => ({
      values: (values: any) => {
        const name = getTableName(table);
        const rows = (Array.isArray(values) ? values : [values]).map((value: any) => ({
          id: "synthetic-committed-request",
          ...value,
        }));
        mocks.inserted[name] = [...(mocks.inserted[name] || []), ...rows];
        return { returning: async () => rows };
      },
    }),
  };
  const query: any = { limit: async () => [target] };
  for (const method of ["from", "innerJoin", "where"]) query[method] = () => query;
  db.select = () => query;
  return { db, pool: { query: vi.fn(async () => ({ rows: [] })) } };
});
vi.mock("../storage", () => ({
  storage: {
    getUserByEmail: mocks.getUserByEmail,
    createUser: mocks.createUser,
    updateUser: mocks.updateUser,
    logEvent: vi.fn(),
  },
}));
vi.mock("../services/passwordResetService", () => ({
  passwordResetService: { createToken: mocks.activationToken },
}));
vi.mock("../services/emailVerificationService", () => ({
  emailVerificationService: { createToken: mocks.verificationToken },
}));
vi.mock("../notification-service", () => ({
  notificationService: { createNotification: mocks.notifyOwner },
}));
vi.mock("../services/directConnectBetaOversight", () => ({
  notifySuperAdminsOfDirectConnectRequest: vi.fn(),
}));
vi.mock("../services/discoveryObservatoryService", () => ({
  DiscoveryObservatoryService: class {
    recordRequestAction = mocks.recordRequestAction;
    recordProviderDeliveryAttempt = vi.fn();
  },
}));

// Actual registered request handler and email composition, with synthetic
// persistence, token services and captured email transport. No live records.
describe("Express request success after the request transaction commits", () => {
  const contact = {
    name: "Submitted Visitor",
    email: "visitor@example.invalid",
    phone: "(225) 555-0102",
  };
  let provider: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.inserted = {};
    mocks.transactionFails = false;
    mocks.getUserByEmail.mockResolvedValue(null);
    mocks.createUser.mockImplementation(async (values: any) => ({
      id: "synthetic-new-requester",
      ...values,
    }));
    mocks.activationToken.mockResolvedValue({ token: "synthetic-activation-token" });
    mocks.verificationToken.mockResolvedValue({ token: "synthetic-verification-token" });
    mocks.notifyOwner.mockResolvedValue(undefined);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "synthetic-test-key");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "account_creation_only");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    provider = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ messageId: "synthetic-provider-receipt" }),
    });
    vi.stubGlobal("fetch", provider);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function submit() {
    const { registerTradePartnerExpressRoutes } = await import("../routes/tradepartner-express");
    const app = express();
    app.use(express.json());
    registerTradePartnerExpressRoutes(app);
    return request(app)
      .post("/api/tradepartner-profiles/louisiana-stone-solutions/express-request")
      .send({ ...contact, requestType: "request_service", message: "I need countertops and tile." });
  }

  function assertCommittedContact() {
    expect(mocks.inserted.work_requests).toHaveLength(1);
    expect(mocks.inserted.work_request_assignments).toHaveLength(1);
    expect(mocks.inserted.work_request_assignments[0]).toMatchObject({
      workRequestId: "synthetic-committed-request",
      responderUserId: "synthetic-business-owner",
    });
    const event = mocks.inserted.work_request_events.find((row) => row.type === "created");
    expect(event.metadata.requesterContact).toEqual({
      ...contact,
      consent: "share_with_selected_business",
    });
    const payloads = provider.mock.calls.map((call) => JSON.parse(call[1].body));
    const business = payloads.filter(
      (payload) => payload.to[0].email === "selected-business@example.invalid"
    );
    expect(business).toHaveLength(1);
    expect(business[0].textContent).toContain("Name: Submitted Visitor");
    expect(business[0].textContent).toContain("Phone: (225) 555-0102");
    expect(business[0].replyTo).toEqual({ email: contact.email });
    return payloads;
  }

  it.each(["activation", "verification"] as const)(
    "keeps the saved request successful when %s setup fails",
    async (stage) => {
      const service = stage === "activation" ? mocks.activationToken : mocks.verificationToken;
      service.mockRejectedValue(new Error("synthetic-private-token-error-do-not-log"));
      const response = await submit();
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        requestId: "synthetic-committed-request",
        status: "routed",
        accountCreated: true,
        onboardingPath: null,
        onboardingEmailStatus: "failed",
      });
      expect(response.body.requestWorkspacePath).toContain("requestId=synthetic-committed-request");
      expect(response.body.message).toBeUndefined();
      const payloads = assertCommittedContact();
      expect(payloads.filter((payload) => payload.to[0].email === contact.email)).toHaveLength(0);
      expect(response.text).not.toContain("synthetic-activation-token");
      expect(response.text).not.toContain("synthetic-verification-token");
      expect(JSON.stringify([
        vi.mocked(console.warn).mock.calls,
        vi.mocked(console.error).mock.calls,
      ])).not.toContain("synthetic-private-token-error-do-not-log");
    }
  );

  it("preserves normal new-account setup and one business notification", async () => {
    const response = await submit();
    expect(response.status).toBe(201);
    expect(response.body.onboardingEmailStatus).toBe("sent");
    expect(response.body.onboardingPath).toContain("/reset-password?token=synthetic-activation-token");
    const payloads = assertCommittedContact();
    expect(payloads.filter((payload) => payload.to[0].email === contact.email)).toHaveLength(1);
    expect(mocks.activationToken).toHaveBeenCalledTimes(1);
    expect(mocks.verificationToken).toHaveBeenCalledTimes(1);
  });

  it("does not require account-setup services for an existing requester", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: "synthetic-existing-requester", ...contact });
    mocks.activationToken.mockRejectedValue(new Error("unused"));
    mocks.verificationToken.mockRejectedValue(new Error("unused"));
    const response = await submit();
    expect(response.status).toBe(201);
    expect(response.body.accountCreated).toBe(false);
    expect(mocks.activationToken).not.toHaveBeenCalled();
    expect(mocks.verificationToken).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    assertCommittedContact();
  });

  it("does not claim success when the request transaction fails", async () => {
    mocks.transactionFails = true;
    const response = await submit();
    expect(response.status).toBe(500);
    expect(mocks.inserted.work_requests).toBeUndefined();
    expect(mocks.activationToken).not.toHaveBeenCalled();
    expect(mocks.verificationToken).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
    expect(mocks.notifyOwner).not.toHaveBeenCalled();
  });
});
