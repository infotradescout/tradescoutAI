import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { ADMIN_MANAGED_PROFILE_SOURCE } from "@shared/publicProfileExposureRegistry";

const mocks = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  target: null as Record<string, unknown> | null,
  inserted: {} as Record<string, any[]>,
  getUserByEmail: vi.fn(),
  getUser: vi.fn(),
  transactionUpdate: vi.fn(),
  updateUser: vi.fn(),
  recordRequestAction: vi.fn(),
}));
vi.mock("../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const db: any = {
    execute: vi.fn(async (query: any) => {
      if (new PgDialect().sqlToQuery(query).sql.includes("FROM contact_permissions")) {
        return { rows: [] };
      }
      return {
        rows: mocks.target
          ? [
              {
                request_metadata: mocks.inserted.work_request_events?.find(
                  (row) => row.type === "created"
                )?.metadata,
              },
            ]
          : [mocks.row],
      };
    }),
    transaction: async (run: any) => run(db),
    insert: (table: any) => ({
      values: (values: any) => {
        const name = getTableName(table);
        const rows = (Array.isArray(values) ? values : [values]).map((value: any) => ({
          id: "synthetic-express-request",
          ...value,
        }));
        mocks.inserted[name] = [...(mocks.inserted[name] || []), ...rows];
        return { returning: async () => rows };
      },
    }),
    update: () => ({
      set: (values: any) => {
        mocks.transactionUpdate(values);
        return {
          where: () => ({ returning: async () => [{ ...(await mocks.getUser()), ...values }] }),
        };
      },
    }),
  };
  const query: any = { limit: async () => [mocks.target] };
  for (const method of ["from", "innerJoin", "where"]) query[method] = () => query;
  db.select = () => query;
  return { db, pool: { query: vi.fn(async () => ({ rows: [] })) } };
});
vi.mock("../storage", () => ({
  storage: {
    getUserByEmail: mocks.getUserByEmail,
    getUser: mocks.getUser,
    updateUser: mocks.updateUser,
    logEvent: vi.fn(),
  },
}));
vi.mock("../notification-service", () => ({
  notificationService: { createNotification: vi.fn(), sendNotification: vi.fn() },
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

describe("Express request callback details at the email provider boundary", () => {
  const submittedContact = {
    name: "Submitted Visitor",
    email: "visitor@example.invalid",
    phone: "(225) 555-0102",
    consent: "share_with_selected_business",
  };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.target = null;
    mocks.inserted = {};
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "synthetic-test-key");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "account_creation_only");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ messageId: "synthetic-provider-receipt" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.row = {
      first_name: "Saved",
      last_name: "Account",
      email: "saved-account@example.invalid",
      phone: "(225) 555-0199",
      request_metadata: {
        source: "tradepartner_profile",
        connectionMode: "express",
        requesterContact: submittedContact,
      },
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function send() {
    const { emailService } = await import("../services/emailService");
    return emailService.sendEmail({
      to: "selected-business@example.invalid",
      subject: "New request for the selected business",
      text: "Submitted Visitor sent a request through your business profile on TradeScout.",
      purpose: "tradepartner_request_notification",
      requestId: "synthetic-express-request",
    });
  }

  it("delivers the details entered on this request instead of saved account details", async () => {
    await send();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.to).toEqual([{ email: "selected-business@example.invalid" }]);
    expect(payload.textContent).toContain("Name: Submitted Visitor");
    expect(payload.textContent).toContain("Phone: (225) 555-0102");
    expect(payload.textContent).toContain("Email: visitor@example.invalid");
    expect(payload.replyTo).toEqual({ email: "visitor@example.invalid" });
    expect(JSON.stringify(payload)).not.toContain("555-0199");
    expect(JSON.stringify(payload)).not.toContain("saved-account@example.invalid");
  });

  it("still delivers the submitted callback number when the account has no phone", async () => {
    mocks.row.phone = null;
    await expect(send()).resolves.toMatchObject({ skipped: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).textContent).toContain("555-0102");
  });

  it("does not replace missing request consent with another account's private contact", async () => {
    mocks.row.request_metadata = null;
    await expect(send()).rejects.toThrow("requester's name and phone number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { source: "community" },
    { connectionMode: "unknown" },
    { requesterContact: { ...submittedContact, consent: undefined } },
    { requesterContact: { ...submittedContact, phone: "555-01" } },
    { requesterContact: { ...submittedContact, email: "not-an-email" } },
  ])("does not send an invalid or unrelated contact snapshot (%j)", async (override) => {
    mocks.row.request_metadata = { ...(mocks.row.request_metadata as object), ...override };
    await expect(send()).rejects.toThrow("requester's name and phone number");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  function setReleasedTarget() {
    mocks.target = {
      profileId: "synthetic-profile",
      profileSlug: "louisiana-stone-solutions",
      profileStatus: "published",
      profilePubliclyReleased: true,
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
      ownerPreferences: { profileVisibility: "private", publicProfileIds: ["synthetic-profile"] },
      profileData: { notificationEmail: "selected-business@example.invalid" },
    };
  }

  it("requires an existing account to sign in before saving or sending a submitted callback", async () => {
    setReleasedTarget();
    mocks.getUserByEmail.mockResolvedValue({
      id: "synthetic-matched-account",
      firstName: "Saved",
      lastName: "Account",
      phone: "2255550199",
      email: submittedContact.email,
    });
    const { registerTradePartnerExpressRoutes } = await import("../routes/tradepartner-express");
    const app = express();
    app.use(express.json());
    registerTradePartnerExpressRoutes(app);
    const response = await request(app)
      .post("/api/tradepartner-profiles/louisiana-stone-solutions/express-request")
      .send({
        name: submittedContact.name,
        email: submittedContact.email,
        phone: submittedContact.phone,
        requestType: "request_service",
        serviceName: "Countertops, Tile",
        message: "I need countertops and tile.",
      });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("EXISTING_ACCOUNT_SIGN_IN_REQUIRED");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    expect(mocks.inserted).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.text).not.toContain(submittedContact.phone);
  });

  it("commits the authenticated sender receipt and delivers its callback to the assigned business", async () => {
    setReleasedTarget();
    mocks.getUser.mockResolvedValue({
      id: "synthetic-matched-account",
      firstName: "Saved",
      lastName: "Account",
      phone: "2255550199",
      email: submittedContact.email,
    });
    const { registerTradePartnerExpressRoutes } = await import("../routes/tradepartner-express");
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: "synthetic-matched-account" };
      next();
    });
    registerTradePartnerExpressRoutes(app);
    const response = await request(app)
      .post("/api/tradepartner-profiles/louisiana-stone-solutions/express-request")
      .send({
        name: submittedContact.name,
        email: submittedContact.email,
        phone: submittedContact.phone,
        requestType: "request_service",
        serviceName: "Countertops, Tile",
        message: "I need countertops and tile.",
      });
    expect(response.status).toBe(201);
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: submittedContact.phone })
    );
    const event = mocks.inserted.work_request_events.find((row) => row.type === "created");
    expect(event.metadata.requesterContact).toEqual(submittedContact);
    expect(event.metadata.submissionContact).toMatchObject({
      version: 1,
      workRequestId: "synthetic-express-request",
      requesterUserId: "synthetic-matched-account",
      name: submittedContact.name,
      phone: "2255550102",
    });
    expect(event.metadata.sourceDecisionCardId).toBeTruthy();
    expect(event.metadata.contactPermissionId).toBeTruthy();
    expect(mocks.inserted.work_request_assignments[0]).toMatchObject({
      responderUserId: "synthetic-business-owner",
      scoreSnapshot: { submissionContactRecipientUserId: "synthetic-business-owner" },
    });
    const businessPayload = fetchMock.mock.calls
      .map((call) => JSON.parse(call[1].body))
      .find((payload) => payload.to[0].email === "selected-business@example.invalid");
    expect(businessPayload.textContent).toContain("2255550102");
    expect(businessPayload.textContent).not.toContain("2255550199");
    expect(businessPayload.replyTo).toEqual({ email: submittedContact.email });
    expect(JSON.stringify(mocks.recordRequestAction.mock.calls)).not.toContain(
      submittedContact.phone
    );
    expect(response.text).not.toContain(submittedContact.phone);
  });
});
