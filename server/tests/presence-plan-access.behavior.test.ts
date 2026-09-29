import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  loadOwnedPresenceContext,
  nextPresenceDraftRevision,
  reviewOwnedPresencePlan,
} from "../services/presencePlanService";
import { derivePresencePlan } from "../services/presencePlan";
import { onboardingRouter } from "../routes/onboarding";

function ownerStorage(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const outcome = {
    kind: "business_profile",
    businessId: "business-1",
    profileId: "profile-1",
    provenance: {
      evidence: { name: "Example Shop", links: [], services: [], photoUrls: [] },
    },
  };
  const storage = {
    getUser: vi.fn(async () => {
      calls.push("getUser");
      return overrides.user ?? { id: "owner-1", preferences: { onboardingOutcome: outcome } };
    }),
    getBusinessByIdForOwner: vi.fn(async () => {
      calls.push("getBusinessByIdForOwner");
      return (
        overrides.business ?? {
          id: "business-1",
          ownerUserId: "owner-1",
          profileData: {},
        }
      );
    }),
    getProfileByIdForOwner: vi.fn(async () => {
      calls.push("getProfileByIdForOwner");
      return (
        overrides.profile ?? {
          id: "profile-1",
          ownerUserId: "owner-1",
          businessId: "business-1",
        }
      );
    }),
    completeOutcomeOnboarding: vi.fn(() => {
      throw new Error("completion must never be invoked by planning");
    }),
    updateUser: vi.fn(() => {
      throw new Error("planning must not update the user");
    }),
    createBusinessForOwner: vi.fn(() => {
      throw new Error("planning must not create a business");
    }),
    updateProfileForOwner: vi.fn(() => {
      throw new Error("planning must not publish a profile");
    }),
  };
  return { storage, calls };
}

describe("owner-bound presence plan access", () => {
  it("requires authentication on every presence plan route", async () => {
    const app = express();
    app.use(express.json());
    app.use(onboardingRouter);
    for (const [method, path] of [
      ["get", "/api/presence/plan"],
      ["post", "/api/presence/plan/refresh"],
      ["post", "/api/presence/plan/review"],
    ] as const) {
      const response = await request(app)[method](path);
      expect(response.status).toBe(401);
    }
  });

  it("reads the completed canonical identity without completion, publication, or provider calls", async () => {
    const { storage, calls } = ownerStorage();
    const context = await loadOwnedPresenceContext(storage, "owner-1");
    expect(context.businessId).toBe("business-1");
    expect(context.profileId).toBe("profile-1");
    expect(calls).toEqual(["getUser", "getBusinessByIdForOwner", "getProfileByIdForOwner"]);
    expect(storage.completeOutcomeOnboarding).not.toHaveBeenCalled();
    expect(storage.updateUser).not.toHaveBeenCalled();
    expect(storage.createBusinessForOwner).not.toHaveBeenCalled();
    expect(storage.updateProfileForOwner).not.toHaveBeenCalled();
  });

  it("rejects a claimable shell with no completed owner outcome", async () => {
    const { storage } = ownerStorage({ user: { id: "owner-1", preferences: {} } });
    await expect(loadOwnedPresenceContext(storage, "owner-1")).rejects.toMatchObject({
      code: "COMPLETED_BUSINESS_ONBOARDING_REQUIRED",
    });
    expect(storage.getBusinessByIdForOwner).not.toHaveBeenCalled();
  });

  it("rejects a profile linked to another business", async () => {
    const { storage } = ownerStorage({
      profile: { id: "profile-1", ownerUserId: "owner-1", businessId: "other-business" },
    });
    await expect(loadOwnedPresenceContext(storage, "owner-1")).rejects.toMatchObject({
      code: "PRESENCE_OWNERSHIP_MISMATCH",
    });
  });

  it("increments a draft revision only when source evidence changes", () => {
    expect(nextPresenceDraftRevision(null, { evidenceDigest: "a" })).toBe(1);
    expect(
      nextPresenceDraftRevision({ revision: 4, evidenceDigest: "a" }, { evidenceDigest: "a" })
    ).toBe(4);
    expect(
      nextPresenceDraftRevision({ revision: 4, evidenceDigest: "a" }, { evidenceDigest: "b" })
    ).toBe(5);
  });

  it("rejects stale review before any database or action adapter is loaded", async () => {
    const { storage } = ownerStorage();
    await expect(
      reviewOwnedPresencePlan(storage, {
        ownerUserId: "owner-1",
        expectedDigest: "0".repeat(64),
        expectedRevision: 1,
        sitePath: "hosted_new",
      })
    ).rejects.toMatchObject({ code: "PRESENCE_PLAN_STALE" });
    expect(storage.completeOutcomeOnboarding).not.toHaveBeenCalled();
  });

  it("keeps a conflicting intake target quarantined before owner review", async () => {
    const { storage } = ownerStorage({
      user: {
        id: "owner-1",
        preferences: {
          onboardingOutcome: {
            kind: "business_profile",
            businessId: "business-1",
            profileId: "profile-1",
            provenance: { evidence: { targetBusinessId: "another-business", links: [] } },
          },
        },
      },
    });
    const context = await loadOwnedPresenceContext(storage, "owner-1");
    const current = derivePresencePlan({
      businessId: context.businessId,
      profileId: context.profileId,
      onboardingEvidence: context.onboardingEvidence,
      externalWebsiteUrl: context.externalWebsiteUrl,
    });
    await expect(
      reviewOwnedPresencePlan(storage, {
        ownerUserId: "owner-1",
        expectedDigest: current.evidenceDigest,
        expectedRevision: 1,
        sitePath: "hosted_new",
      })
    ).rejects.toMatchObject({ code: "PRESENCE_IDENTITY_CONFLICT" });
  });
});
