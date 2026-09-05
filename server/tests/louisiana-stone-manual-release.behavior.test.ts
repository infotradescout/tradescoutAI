import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_MANAGED_PROFILE_SOURCE } from "@shared/publicProfileExposureRegistry";

const mocks = vi.hoisted(() => ({ row: {} as Record<string, any> }));
vi.mock("../db", () => {
  const query: any = {};
  let selection: Record<string, unknown> = {};
  query.select = vi.fn((fields: Record<string, unknown>) => {
    selection = fields;
    return query;
  });
  for (const method of ["from", "innerJoin", "leftJoin", "where"]) {
    query[method] = vi.fn(() => query);
  }
  query.limit = vi.fn(async () => [
    Object.fromEntries(Object.keys(selection).map((key) => [key, mocks.row[key]])),
  ]);
  return { db: query, pool: { query: vi.fn(async () => ({ rows: [] })) } };
});
vi.mock("../storage", () => ({ storage: { logEvent: vi.fn() } }));

import { ProfileRepository } from "../repositories/profileRepository";
import { canServeLinkedBusinessProfileToViewer } from "../routes/profiles";
import { isOwnerConfirmedDirectProfile } from "../services/ownerConfirmedDirectProfile";
import { registerTradePartnerExpressRoutes } from "../routes/tradepartner-express";

describe("manual admin publication through real public readers and contact resolver", () => {
  beforeEach(() => {
    mocks.row = {
      id: "synthetic-profile",
      profileId: "synthetic-profile",
      slug: "louisiana-stone-solutions",
      profileSlug: "louisiana-stone-solutions",
      profileStatus: "published",
      displayName: "Louisiana Stone Solutions",
      roleContext: "business_owner",
      headline: "Countertops",
      contentBlocks: [],
      ctaConfig: {},
      seoMeta: {},
      businessId: "synthetic-business",
      businessName: "Louisiana Stone Solutions",
      profileOwnerUserId: "synthetic-owner",
      ownerUserId: "synthetic-owner",
      businessOwnerUserId: "synthetic-owner",
      businessStatus: "active",
      businessClaimStatus: "claimed",
      businessSources: [ADMIN_MANAGED_PROFILE_SOURCE],
      publicDiscoveryEnabled: false,
      ownerProvider: "local",
      ownerRole: "business_owner",
      ownerRoles: ["business_owner"],
      ownerEmailVerified: false,
      ownerVerifiedBadge: false,
      ownerVerificationStatus: "pending",
      ownerPreferences: { profileVisibility: "private", publicProfileIds: ["synthetic-profile"] },
      profileData: { phone: "2255550198", email: "private@example.invalid" },
      businessProfileData: { phone: "2255550198", email: "private@example.invalid" },
    };
  });

  it("allows anonymous reading and the API viewer check without elevating the visitor", async () => {
    const result = await new ProfileRepository().getProfileBySlugPublic(
      "louisiana-stone-solutions"
    );
    expect(result?.slug).toBe("louisiana-stone-solutions");
    expect(result).not.toHaveProperty("ownerPreferences");
    expect(result).not.toHaveProperty("ownerEmailVerified");
    expect(result).not.toHaveProperty("businessProfileData");
    expect(JSON.stringify(result)).not.toContain("2255550198");
    expect(JSON.stringify(result)).not.toContain("private@example.invalid");
    expect(
      canServeLinkedBusinessProfileToViewer({
        ownerUser: { emailVerified: false, verifiedBadge: false, verificationStatus: "pending" },
        ownerConfirmedDirectProfile: isOwnerConfirmedDirectProfile(mocks.row as any),
        authenticatedViewerCanManage: false,
      })
    ).toBe(true);
  });

  it("allows the admin-bound phone after a call decision and honors publication revocation", async () => {
    const app = express();
    app.use(express.json());
    registerTradePartnerExpressRoutes(app);
    const url = "/api/tradepartner-profiles/louisiana-stone-solutions/express-contact/reveal";
    expect((await request(app).post(url).send({})).status).toBe(400);
    const decision = { authorityGate: "profile_direct_connect", decision: "call" };
    const response = await request(app).post(url).send(decision);
    expect(response.status).toBe(200);
    expect(response.body.tel).toContain("2255550198");
    expect(response.text).not.toContain("private@example.invalid");
    mocks.row.businessSources = [];
    expect(
      await new ProfileRepository().getProfileBySlugPublic("louisiana-stone-solutions")
    ).toBeUndefined();
    expect((await request(app).post(url).send(decision)).status).toBe(404);
  });
});
