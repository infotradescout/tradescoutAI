import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { derivePresencePlan } from "../services/presencePlan";
import { onboardingRouter } from "../routes/onboarding";

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  getBusinessByIdForOwner: vi.fn(),
  getProfileByIdForOwner: vi.fn(),
  updateBusinessForOwner: vi.fn(),
  updateProfileForOwner: vi.fn(),
  completeOutcomeBusinessProfile: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: mock.getUser,
    getBusinessByIdForOwner: mock.getBusinessByIdForOwner,
    getProfileByIdForOwner: mock.getProfileByIdForOwner,
    updateBusinessForOwner: mock.updateBusinessForOwner,
    updateProfileForOwner: mock.updateProfileForOwner,
    completeOutcomeBusinessProfile: mock.completeOutcomeBusinessProfile,
  },
}));

vi.mock("../db", () => ({
  db: {
    select: mock.select,
    insert: mock.insert,
    update: mock.update,
    transaction: mock.transaction,
  },
}));

const businessId = "business-owner-1";
const profileId = "profile-owner-1";
const ownerId = "owner-1";

function outcome(overrides: Record<string, unknown> = {}) {
  return {
    kind: "business_profile",
    businessId,
    profileId,
    provenance: {
      evidence: {
        name: "Private Owner Business",
        links: [],
        services: [],
        photoUrls: [],
        ...overrides,
      },
    },
  };
}

function app() {
  const testApp = express();
  testApp.use(express.json());
  // This middleware supplies the authenticated principal to the real router.
  // Session establishment itself is outside this focused route test.
  testApp.use((req, _res, next) => {
    const principal = req.header("x-test-principal");
    if (principal) (req as any).user = { id: principal };
    next();
  });
  testApp.use(onboardingRouter);
  return testApp;
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockImplementation(async (userId: string) => ({
    id: userId,
    preferences: { onboardingOutcome: outcome() },
  }));
  mock.getBusinessByIdForOwner.mockImplementation(async (userId: string, requestedId: string) =>
    userId === ownerId && requestedId === businessId
      ? { id: businessId, ownerUserId: ownerId, profileData: {} }
      : null
  );
  mock.getProfileByIdForOwner.mockImplementation(async (userId: string, requestedId: string) =>
    userId === ownerId && requestedId === profileId
      ? { id: profileId, ownerUserId: ownerId, businessId }
      : null
  );
});

describe("presence plan HTTP owner boundary", () => {
  it("returns an existing plan only through the authenticated owner's identity", async () => {
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: outcome(),
      externalWebsiteUrl: null,
    });
    mock.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: "plan-owner-1",
              businessId,
              profileId,
              revision: 2,
              evidenceDigest: plan.evidenceDigest,
              planHash: plan.planHash,
              plan,
              sitePath: null,
              reviewedAt: null,
            },
          ],
        }),
      }),
    }));

    const response = await request(app())
      .get("/api/presence/plan")
      .set("x-test-principal", ownerId);

    expect(response.status).toBe(200);
    expect(response.body.plan).toMatchObject({
      id: "plan-owner-1",
      businessId,
      profileId,
      status: "draft",
      executionAuthorized: false,
    });
    expect(mock.getUser).toHaveBeenCalledExactlyOnceWith(ownerId);
    expect(mock.getBusinessByIdForOwner).toHaveBeenCalledExactlyOnceWith(ownerId, businessId);
    expect(mock.getProfileByIdForOwner).toHaveBeenCalledExactlyOnceWith(ownerId, profileId);
    expect(mock.select).toHaveBeenCalledTimes(1);
  });

  it("denies a different authenticated principal before reading the plan", async () => {
    const response = await request(app())
      .get("/api/presence/plan")
      .set("x-test-principal", "other-user");

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PRESENCE_OWNERSHIP_MISMATCH");
    expect(response.text).not.toContain("plan-owner-1");
    expect(response.text).not.toContain("Private Owner Business");
    expect(mock.getUser).toHaveBeenCalledExactlyOnceWith("other-user");
    expect(mock.getBusinessByIdForOwner).toHaveBeenCalledExactlyOnceWith("other-user", businessId);
    expect(mock.getProfileByIdForOwner).toHaveBeenCalledExactlyOnceWith("other-user", profileId);
    expect(mock.select).not.toHaveBeenCalled();
  });

  it("fails closed for an authenticated user without completed business onboarding", async () => {
    mock.getUser.mockResolvedValueOnce({ id: "new-user", preferences: {} });

    const response = await request(app())
      .get("/api/presence/plan")
      .set("x-test-principal", "new-user");

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("COMPLETED_BUSINESS_ONBOARDING_REQUIRED");
    expect(mock.getUser).toHaveBeenCalledExactlyOnceWith("new-user");
    expect(mock.getBusinessByIdForOwner).not.toHaveBeenCalled();
    expect(mock.getProfileByIdForOwner).not.toHaveBeenCalled();
    expect(mock.select).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("blocks identity-conflicting review before a database or action write", async () => {
    const conflictingOutcome = outcome({ targetBusinessId: "different-business" });
    mock.getUser.mockResolvedValueOnce({
      id: ownerId,
      preferences: { onboardingOutcome: conflictingOutcome },
    });
    const plan = derivePresencePlan({
      businessId,
      profileId,
      onboardingEvidence: conflictingOutcome,
      externalWebsiteUrl: null,
    });

    const response = await request(app())
      .post("/api/presence/plan/review")
      .set("x-test-principal", ownerId)
      .send({
        expectedDigest: plan.evidenceDigest,
        expectedRevision: 1,
        sitePath: "hosted_new",
      });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe("PRESENCE_IDENTITY_CONFLICT");
    expect(mock.getUser).toHaveBeenCalledExactlyOnceWith(ownerId);
    expect(mock.getBusinessByIdForOwner).toHaveBeenCalledExactlyOnceWith(ownerId, businessId);
    expect(mock.getProfileByIdForOwner).toHaveBeenCalledExactlyOnceWith(ownerId, profileId);
    expect(mock.select).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.transaction).not.toHaveBeenCalled();
    expect(mock.updateBusinessForOwner).not.toHaveBeenCalled();
    expect(mock.updateProfileForOwner).not.toHaveBeenCalled();
    expect(mock.completeOutcomeBusinessProfile).not.toHaveBeenCalled();
  });
});
