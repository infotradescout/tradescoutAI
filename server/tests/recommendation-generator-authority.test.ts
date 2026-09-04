import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    analyzeContractorPerformance: vi.fn(),
    createRecommendationCampaign: vi.fn(),
    createRecommendationGoal: vi.fn(),
    deleteRecommendationCampaign: vi.fn(),
    getContractor: vi.fn(),
    getContractorByUserId: vi.fn(),
    getContractorCampaigns: vi.fn(),
    getContractorGoals: vi.fn(),
    getRecommendationInsight: vi.fn(),
    getRecommendations: vi.fn(),
    updateGoalProgress: vi.fn(),
    updateRecommendationCampaign: vi.fn(),
  },
}));

vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { registerRecommendationGeneratorRoutes } from "../routes/recommendation-generator";

function buildApp(user: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  registerRecommendationGeneratorRoutes(app);
  return app;
}

const crossUserRequests = [
  { method: "get", path: "/api/contractors/contractor-b/insights" },
  { method: "post", path: "/api/contractors/contractor-b/insights/refresh" },
  { method: "get", path: "/api/contractors/contractor-b/goals" },
  {
    method: "post",
    path: "/api/contractors/contractor-b/goals",
    body: { targetRecommendations: 5, targetRating: 4, targetTimeframe: "30_days" },
  },
  { method: "post", path: "/api/contractors/contractor-b/goals/update-progress" },
  { method: "get", path: "/api/contractors/contractor-b/campaigns" },
  {
    method: "post",
    path: "/api/contractors/contractor-b/campaigns",
    body: { name: "Follow up", campaignType: "email_followup", targetCustomers: [] },
  },
  {
    method: "put",
    path: "/api/contractors/contractor-b/campaigns/campaign-b",
    body: { name: "Updated" },
  },
  { method: "delete", path: "/api/contractors/contractor-b/campaigns/campaign-b" },
] as const;

describe("recommendation generator contractor authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.storage.getContractor.mockImplementation(async (contractorId: string) => ({
      id: contractorId,
      userId: contractorId === "contractor-a" ? "user-a" : "user-b",
    }));
    mocks.storage.getRecommendationInsight.mockResolvedValue({ id: "insight-1" });
    mocks.storage.getContractorGoals.mockResolvedValue([]);
    mocks.storage.getContractorCampaigns.mockResolvedValue([]);
    mocks.storage.getRecommendations.mockResolvedValue([]);
  });

  it.each(crossUserRequests)(
    "blocks cross-user $method $path before contractor data access",
    async ({ method, path, body }) => {
      const app = buildApp({ id: "user-a", role: "contractor_user", roles: ["contractor_user"] });
      const pending = (request(app) as any)[method](path);
      const response = body ? await pending.send(body) : await pending;

      expect(response.status).toBe(403);
      expect(mocks.storage.getRecommendationInsight).not.toHaveBeenCalled();
      expect(mocks.storage.analyzeContractorPerformance).not.toHaveBeenCalled();
      expect(mocks.storage.createRecommendationGoal).not.toHaveBeenCalled();
      expect(mocks.storage.updateGoalProgress).not.toHaveBeenCalled();
      expect(mocks.storage.createRecommendationCampaign).not.toHaveBeenCalled();
      expect(mocks.storage.updateRecommendationCampaign).not.toHaveBeenCalled();
      expect(mocks.storage.deleteRecommendationCampaign).not.toHaveBeenCalled();
    }
  );

  it("does not treat HOA or arbitrary admin substrings as an admin override", async () => {
    for (const role of ["hoa_admin", "assistant_admin"]) {
      const response = await request(buildApp({ id: "user-a", role })).get(
        "/api/contractors/contractor-b/insights"
      );
      expect(response.status).toBe(403);
    }
  });

  it("allows an explicit canonical admin tier to inspect another contractor", async () => {
    const response = await request(buildApp({ id: "admin-1", role: "ops_admin" })).get(
      "/api/contractors/contractor-b/insights"
    );

    expect(response.status).toBe(200);
    expect(mocks.storage.getRecommendationInsight).toHaveBeenCalledWith("contractor-b");
  });

  it("resolves the legacy user-id path only to that user's durable contractor row", async () => {
    mocks.storage.getContractor.mockResolvedValueOnce(undefined);
    mocks.storage.getContractorByUserId.mockResolvedValueOnce({
      id: "contractor-a",
      userId: "user-a",
    });

    const response = await request(buildApp({ id: "user-a", role: "contractor_user" })).get(
      "/api/contractors/user-a/insights"
    );

    expect(response.status).toBe(200);
    expect(mocks.storage.getContractorByUserId).toHaveBeenCalledWith("user-a");
    expect(mocks.storage.getRecommendationInsight).toHaveBeenCalledWith("contractor-a");
  });

  it("rejects unrecognized campaign update fields before a write", async () => {
    const response = await request(
      buildApp({ id: "user-a", role: "contractor_user", roles: ["contractor_user"] })
    )
      .put("/api/contractors/contractor-a/campaigns/campaign-a")
      .send({ name: "Updated", contractorId: "contractor-b" });

    expect(response.status).toBe(400);
    expect(mocks.storage.updateRecommendationCampaign).not.toHaveBeenCalled();
  });

  it("scopes campaign updates and deletes to the authorized contractor", async () => {
    mocks.storage.updateRecommendationCampaign.mockResolvedValueOnce(undefined);
    mocks.storage.deleteRecommendationCampaign.mockResolvedValueOnce(false);
    const app = buildApp({ id: "user-a", role: "contractor_user" });

    const updateResponse = await request(app)
      .put("/api/contractors/contractor-a/campaigns/campaign-b")
      .send({ name: "Updated" });
    const deleteResponse = await request(app).delete(
      "/api/contractors/contractor-a/campaigns/campaign-b"
    );

    expect(updateResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
    expect(mocks.storage.updateRecommendationCampaign).toHaveBeenCalledWith(
      "contractor-a",
      "campaign-b",
      { name: "Updated" }
    );
    expect(mocks.storage.deleteRecommendationCampaign).toHaveBeenCalledWith(
      "contractor-a",
      "campaign-b"
    );
  });
});
