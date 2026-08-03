import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";
import { createAuthedAgent } from "./helpers/testAuth";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

vi.setConfig({ testTimeout: 30_000 });

describeWithDb("outcome onboarding integration (no mocks)", () => {
  it("persists an authenticated express result through the single completion route", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      onboardingCompleted: false,
    });

    const response = await agent.post("/api/onboarding/complete").send({
      kind: "express_result",
      goal: "Find a local provider for a time-sensitive repair",
      next: "/scout?source=onboarding_result",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      result: {
        kind: "express_result",
        resultRoute: "/scout?source=onboarding_result",
      },
    });

    const [persisted] = await db
      .select({
        onboardingCompleted: users.onboardingCompleted,
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, String(user.id)))
      .limit(1);

    expect(persisted?.onboardingCompleted).toBe(true);
    expect(persisted?.preferences).toMatchObject({
      onboardingOutcome: {
        kind: "express_result",
        resultRoute: "/scout?source=onboarding_result",
      },
    });
  });

  it("serializes concurrent completion into one canonical active business profile", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      onboardingCompleted: false,
    });
    const unique = crypto.randomUUID();
    const businessName = `Outcome Proof ${unique}`;

    const payload = {
      kind: "business_profile",
      goal: "Publish my local service business",
      business: {
        name: businessName,
        notes: "A local repair service created by the onboarding integration gate.",
        services: ["Repair coordination"],
      },
    };

    const responses = await Promise.all([
      agent.post("/api/onboarding/complete").send(payload),
      agent.post("/api/onboarding/complete").send(payload),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        result: {
          kind: "business_profile",
          profile: {
            saved: true,
            published: true,
            discovery: "verification_gated",
          },
        },
      });
    }

    const businessIds = responses.map((response) =>
      String(response.body?.result?.profile?.businessId || "")
    );
    const profileIds = responses.map((response) =>
      String(response.body?.result?.profile?.id || "")
    );
    expect(new Set(businessIds).size).toBe(1);
    expect(new Set(profileIds).size).toBe(1);
    const [businessId] = businessIds;
    const [profileId] = profileIds;
    expect(businessId).not.toBe("");
    expect(profileId).not.toBe("");

    const matchingBusinesses = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.ownerUserId, String(user.id)), eq(businesses.name, businessName)));
    const matchingProfiles = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.ownerUserId, String(user.id)), eq(profiles.businessId, businessId)));
    expect(matchingBusinesses).toHaveLength(1);
    expect(matchingProfiles).toHaveLength(1);
    const [business] = matchingBusinesses;
    const [profile] = matchingProfiles;
    const [persistedUser] = await db
      .select({
        activeBusinessId: users.activeBusinessId,
        activeProfileId: users.activeProfileId,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.id, String(user.id)))
      .limit(1);

    expect(business).toMatchObject({
      id: businessId,
      ownerUserId: String(user.id),
      name: businessName,
      status: "active",
      publicDiscoveryEnabled: true,
    });
    expect(profile).toMatchObject({
      id: profileId,
      ownerUserId: String(user.id),
      businessId,
      status: "published",
    });
    expect(persistedUser).toMatchObject({
      activeBusinessId: businessId,
      activeProfileId: profileId,
      onboardingCompleted: true,
    });
  });
});
