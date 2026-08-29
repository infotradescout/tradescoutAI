import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    selectQueue: [] as any[][],
    updates: [] as Array<Record<string, unknown>>,
    preferenceWrites: [] as Array<{
      userId: string;
      preferences: Record<string, unknown>;
    }>,
  };

  const database: any = {
    execute: vi.fn(async () => ({ rows: [] })),
    select: vi.fn(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        innerJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(async () => state.selectQueue.shift() || []),
      };
      return chain;
    }),
    update: vi.fn(() => {
      const chain: any = {
        set: vi.fn((value: Record<string, unknown>) => {
          state.updates.push(value);
          return chain;
        }),
        where: vi.fn(async () => ({ rowCount: 1 })),
      };
      return chain;
    }),
  };
  database.transaction = vi.fn(async (work: (tx: any) => unknown) => work(database));

  return {
    state,
    database,
    resolveTxt: vi.fn(),
    writeProfileDomainPreferences: vi.fn(
      async (args: { userId: string; preferences: Record<string, unknown> }) => {
        state.preferenceWrites.push({
          userId: args.userId,
          preferences: args.preferences,
        });
      }
    ),
    storage: {
      getProfileByIdForOwner: vi.fn(),
      getBusinessProfileByUserId: vi.fn(),
      saveBusinessProfile: vi.fn(),
    },
  };
});

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => {
    req.user = { id: "owner-a" };
    next();
  },
}));
vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../db", () => ({ db: mocks.database }));
vi.mock("dns/promises", () => ({ resolveTxt: mocks.resolveTxt }));
vi.mock("../profileDomainPreferenceWriter", () => ({
  writeProfileDomainPreferences: mocks.writeProfileDomainPreferences,
}));

import { registerBusinessProfileRoutes } from "../routes/business-profile";

const activeProfile = {
  id: "profile-a",
  ownerUserId: "owner-a",
  slug: "profile-a",
  seoMeta: { title: "Profile A", description: "Public description", customDomain: "old.example" },
};

function preferencesFor(args?: { state?: "pending" | "failed" | "verified"; token?: string }): any {
  return {
    theme: "dark",
    profileDomainStates: {
      "profile-a": {
        candidateDomain: "new.example",
        verification: {
          state: args?.state || "pending",
          profileId: "profile-a",
          token: args?.token || "txt-token",
          verifiedAt: null,
          lastCheckedAt: null,
          error: null,
        },
      },
    },
  };
}

function app() {
  const instance = express();
  instance.use(express.json());
  registerBusinessProfileRoutes(instance);
  return instance;
}

describe("profile-scoped custom domain routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.selectQueue = [];
    mocks.state.updates = [];
    mocks.state.preferenceWrites = [];
    mocks.storage.getBusinessProfileByUserId.mockResolvedValue(null);
    mocks.storage.getProfileByIdForOwner.mockResolvedValue({
      ...activeProfile,
      seoMeta: { ...activeProfile.seoMeta },
    });
  });

  it("reads selected-profile status without requiring a business presence", async () => {
    mocks.state.selectQueue.push([{ preferences: preferencesFor() }]);

    const response = await request(app()).get(
      "/api/business-profile/domain/status?profileId=profile-a"
    );

    expect(response.status).toBe(200);
    expect(response.body.domainStatus).toMatchObject({
      profileId: "profile-a",
      activeDomain: "old.example",
      candidateDomain: "new.example",
      verification: { state: "pending", profileId: "profile-a", token: "txt-token" },
    });
    expect(mocks.storage.getBusinessProfileByUserId).not.toHaveBeenCalled();
  });

  it("starts ownership proof for any exactly owned rich profile and preserves its active host", async () => {
    mocks.state.selectQueue.push([], [], [], [{ preferences: { theme: "dark" } }]);

    const response = await request(app())
      .post("/api/business-profile/domain/start")
      .send({ profileId: "profile-a", domain: "www.NEW.example" });

    expect(response.status).toBe(200);
    expect(response.body.domainStatus.activeDomain).toBe("old.example");
    expect(response.body.domainStatus.candidateDomain).toBe("new.example");
    expect(response.body.domainStatus.verification.state).toBe("pending");
    expect(mocks.storage.getBusinessProfileByUserId).not.toHaveBeenCalled();
    const [preferencesWrite] = mocks.state.preferenceWrites;
    expect(preferencesWrite.userId).toBe("owner-a");
    expect(preferencesWrite.preferences.theme).toBe("dark");
    expect(preferencesWrite.preferences.profileDomainStates["profile-a"].candidateDomain).toBe(
      "new.example"
    );
    expect(activeProfile.seoMeta.customDomain).toBe("old.example");
  });

  it("rejects a profile that is not exactly owned", async () => {
    mocks.storage.getProfileByIdForOwner.mockResolvedValue(null);

    const response = await request(app())
      .post("/api/business-profile/domain/start")
      .send({ profileId: "profile-b", domain: "new.example" });

    expect(response.status).toBe(404);
    expect(mocks.database.transaction).not.toHaveBeenCalled();
  });

  it.each(["localhost", "127.0.0.1", "not a host", "single-label", "ftp://example.com"])(
    "rejects invalid or non-host-only domain input: %s",
    async (domain) => {
      const response = await request(app())
        .post("/api/business-profile/domain/start")
        .send({ profileId: "profile-a", domain });

      expect(response.status).toBe(400);
      expect(mocks.database.transaction).not.toHaveBeenCalled();
    }
  );

  it("blocks apex/www collisions before recording a pending proof", async () => {
    mocks.state.selectQueue.push([{ id: "other-profile" }]);

    const response = await request(app())
      .post("/api/business-profile/domain/start")
      .send({ profileId: "profile-a", domain: "www.claimed.example" });

    expect(response.status).toBe(409);
    expect(mocks.state.updates).toEqual([]);
  });

  it("keeps the active profile mapping untouched when DNS verification fails", async () => {
    const preferences = preferencesFor();
    mocks.state.selectQueue.push([{ preferences }], [{ preferences }]);
    mocks.resolveTxt.mockRejectedValue(new Error("not found"));

    const response = await request(app())
      .post("/api/business-profile/domain/verify")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.domainStatus.activeDomain).toBe("old.example");
    expect(response.body.domainStatus.verification.state).toBe("failed");
    expect(mocks.state.updates.some((update) => "seoMeta" in update)).toBe(false);
  });

  it("keeps the platform profile canonical after ownership passes until hosting is provisioned", async () => {
    const preferences = preferencesFor();
    mocks.state.selectQueue.push([{ preferences }], [{ preferences }]);
    mocks.resolveTxt.mockResolvedValue([["txt-token"]]);

    const response = await request(app())
      .post("/api/business-profile/domain/verify")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.verification).toMatchObject({
      ownershipVerified: true,
      activationPending: true,
      state: "pending",
    });
    expect(response.body.domainStatus.activeDomain).toBe("old.example");
    expect(response.body.domainStatus.candidateDomain).toBe("new.example");
    expect(response.body.domainStatus.verification.error).toContain(
      "hosting and TLS setup must be completed"
    );
    expect(mocks.state.updates.some((update) => "seoMeta" in update)).toBe(false);
  });

  it("accepts split TXT chunks without publishing the candidate domain", async () => {
    const preferences = preferencesFor();
    mocks.state.selectQueue.push([{ preferences }], [{ preferences }]);
    mocks.resolveTxt.mockResolvedValue([["txt-", "token"]]);

    const response = await request(app())
      .post("/api/business-profile/domain/verify")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.verification).toMatchObject({
      ownershipVerified: true,
      activationPending: true,
      state: "pending",
    });
    expect(response.body.domainStatus.activeDomain).toBe("old.example");
    expect(mocks.state.updates.some((update) => "seoMeta" in update)).toBe(false);
  });

  it("does not let a slow TXT lookup overwrite a newer setup attempt", async () => {
    const preferences = preferencesFor();
    const changedPreferences = preferencesFor({ token: "newer-token" });
    mocks.state.selectQueue.push([{ preferences }], [{ preferences: changedPreferences }]);
    mocks.resolveTxt.mockResolvedValue([["txt-token"]]);

    const response = await request(app())
      .post("/api/business-profile/domain/verify")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(409);
    expect(mocks.state.updates.some((update) => "seoMeta" in update)).toBe(false);
  });

  it("disconnects only the selected mapping and matching provisional proof", async () => {
    mocks.state.selectQueue.push(
      [{ id: "profile-a", seoMeta: { ...activeProfile.seoMeta } }],
      [{ preferences: preferencesFor({ state: "verified" }) }]
    );

    const response = await request(app())
      .delete("/api/business-profile/domain")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    expect(response.body.disconnectedDomain).toBe("old.example");
    expect(response.body.seoMeta).toEqual({
      title: "Profile A",
      description: "Public description",
    });
    const [preferencesWrite] = mocks.state.preferenceWrites;
    expect(preferencesWrite.preferences.profileDomainStates["profile-a"]).toBeUndefined();
  });

  it("clears a matching legacy provisional proof during disconnect", async () => {
    const legacyPreferences = {
      provisional: {
        profileDraft: {
          customDomain: "old.example",
          customDomainVerification: {
            state: "verified",
            profileId: "profile-a",
            token: "legacy-token",
          },
        },
      },
    };
    mocks.state.selectQueue.push(
      [{ id: "profile-a", seoMeta: { ...activeProfile.seoMeta } }],
      [{ preferences: legacyPreferences }]
    );

    const response = await request(app())
      .delete("/api/business-profile/domain")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    const [preferencesWrite] = mocks.state.preferenceWrites;
    expect(preferencesWrite.preferences.provisional.profileDraft.customDomain).toBeNull();
    expect(preferencesWrite.preferences.provisional.profileDraft.customDomainVerification).toBeNull();
  });

  it("cancels pending setup even when no active domain has been published", async () => {
    mocks.state.selectQueue.push(
      [{ id: "profile-a", seoMeta: { title: "Profile A" } }],
      [{ preferences: preferencesFor() }]
    );

    const response = await request(app())
      .delete("/api/business-profile/domain")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    expect(response.body.disconnectedDomain).toBeNull();
    const [preferencesWrite] = mocks.state.preferenceWrites;
    expect(preferencesWrite.preferences.profileDomainStates["profile-a"]).toBeUndefined();
  });

  it("preserves another profile's provisional proof when disconnecting the selected profile", async () => {
    const otherProfilePreferences = preferencesFor();
    otherProfilePreferences.profileDomainStates["profile-b"] = {
      ...otherProfilePreferences.profileDomainStates["profile-a"],
      verification: {
        ...otherProfilePreferences.profileDomainStates["profile-a"].verification,
        profileId: "profile-b",
      },
    };
    delete otherProfilePreferences.profileDomainStates["profile-a"];
    mocks.state.selectQueue.push(
      [{ id: "profile-a", seoMeta: { ...activeProfile.seoMeta } }],
      [{ preferences: otherProfilePreferences }]
    );

    const response = await request(app())
      .delete("/api/business-profile/domain")
      .send({ profileId: "profile-a" });

    expect(response.status).toBe(200);
    expect(mocks.state.preferenceWrites).toEqual([]);
    expect(mocks.state.updates.some((update) => "seoMeta" in update)).toBe(true);
  });
});
