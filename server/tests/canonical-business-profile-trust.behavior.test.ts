import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
} from "../services/ownerConfirmedDirectProfile";

const mocks = vi.hoisted(() => ({ rows: [] as any[] }));

vi.mock("../db", () => {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.from = vi.fn(() => query);
  query.innerJoin = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(async () => mocks.rows);
  return { db: query };
});

import {
  canUseLinkedProfileAsCanonicalBusinessRoute,
  resolveCanonicalBusinessProfileRoute,
} from "../services/canonicalBusinessProfileRoute";

function pendingLinkedProfile(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1",
    slug: "pending-onboarding-profile",
    businessId: "business-1",
    profileOwnerUserId: "owner-1",
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "local",
    ownerPreferences: { profileVisibility: "public" },
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: ["selective_intelligence_onboarding"],
    businessClaimStatus: "claimed",
    ...overrides,
  };
}

describe("canonical business profile route trust", () => {
  beforeEach(() => {
    mocks.rows = [pendingLinkedProfile()];
  });

  it("does not redirect a business page to a pending linked onboarding profile", async () => {
    await expect(resolveCanonicalBusinessProfileRoute("pending-business")).resolves.toBeNull();
  });

  it("skips a newer pending profile and resolves the next eligible verified profile", async () => {
    mocks.rows = [
      pendingLinkedProfile({ slug: "newer-pending" }),
      pendingLinkedProfile({ slug: "older-verified", ownerVerificationStatus: "approved" }),
    ];

    await expect(resolveCanonicalBusinessProfileRoute("business-one")).resolves.toEqual({
      slug: "older-verified",
      path: "/u/older-verified",
    });
  });

  it("preserves the exact established direct-profile exception", () => {
    expect(
      canUseLinkedProfileAsCanonicalBusinessRoute(
        pendingLinkedProfile({
          slug: JRS_PROFILE_SLUG,
          publicDiscoveryEnabled: false,
          businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
        })
      )
    ).toBe(true);
    expect(
      canUseLinkedProfileAsCanonicalBusinessRoute(
        pendingLinkedProfile({
          slug: "direct-lookalike",
          publicDiscoveryEnabled: false,
          businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
        })
      )
    ).toBe(false);
  });

  it("keeps private profiles non-canonical even when the owner is verified", () => {
    expect(
      canUseLinkedProfileAsCanonicalBusinessRoute(
        pendingLinkedProfile({
          ownerPreferences: { publicProfileIds: ["another-profile"] },
          ownerVerificationStatus: "approved",
        })
      )
    ).toBe(false);
  });

  it("honors the exact target profile marker without publishing a sibling", () => {
    expect(
      canUseLinkedProfileAsCanonicalBusinessRoute(
        pendingLinkedProfile({
          ownerPreferences: { publicProfileIds: ["profile-1"] },
          ownerVerificationStatus: "approved",
        })
      )
    ).toBe(true);
    expect(
      canUseLinkedProfileAsCanonicalBusinessRoute(
        pendingLinkedProfile({
          profileId: "profile-2",
          ownerPreferences: { publicProfileIds: ["profile-1"] },
          ownerVerificationStatus: "approved",
        })
      )
    ).toBe(false);
  });
});
