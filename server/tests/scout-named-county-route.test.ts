import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveKnowledgeMock, getOnboardingSessionMock, governMock, publicDirectoryMock, publicToolsMock, publicPagesMock } =
  vi.hoisted(() => ({
    resolveKnowledgeMock: vi.fn(),
    getOnboardingSessionMock: vi.fn(),
    governMock: vi.fn(),
    publicDirectoryMock: vi.fn(),
    publicToolsMock: vi.fn(),
    publicPagesMock: vi.fn(),
  }));

vi.mock("../services/knowledgeService", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveKnowledge: resolveKnowledgeMock,
}));
vi.mock("../utils/onboardingService", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getOnboardingSession: getOnboardingSessionMock,
}));
vi.mock("../scout/governor", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  govern: governMock,
}));
vi.mock("../services/llmProvider", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  buildScoutLlmProviders: () => [],
}));
vi.mock("../routes/business-directory-public", () => ({
  listPublicDirectoryBusinesses: publicDirectoryMock,
}));
vi.mock("../scout/scoutCountyPostLookup", () => ({
  listRecentScoutCountyPosts: vi.fn(),
}));
vi.mock("../scout/scoutPublicTools", () => ({
  lookupScoutPublicTools: publicToolsMock,
}));
vi.mock("../repositories/profileRepository", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lookupScoutPublicProfiles: publicPagesMock,
}));

import scoutRouter from "../routes/scout";
import { listRecentScoutCountyPosts } from "../scout/scoutCountyPostLookup";
import { storage } from "../storage";

const app = express();
app.use(express.json());
app.use("/api/scout", scoutRouter);

describe("Scout named county public discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listRecentScoutCountyPosts).mockResolvedValue([]);
    vi.spyOn(storage, "listPromotions").mockResolvedValue([]);
    publicDirectoryMock.mockResolvedValue({ status: 200, body: { items: [] } });
    publicToolsMock.mockResolvedValue({ status: "checked", items: [] });
    publicPagesMock.mockResolvedValue({ status: "checked", items: [] });
    getOnboardingSessionMock.mockResolvedValue(undefined);
    governMock.mockResolvedValue({
      intervention: { action: "COMPLY", role: "guide", reasoning: "Read-only local discovery" },
      situation: { goal: "Find local activity", risks: [], unknowns: [], confidence: "medium" },
      outcomeGraph: null,
      confidence: "medium",
      requiresLLM: true,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("checks the named county across public sources despite a stale saved area", async () => {
    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: "Show me posts, deals, and businesses in Maricopa County",
      countyCode: "Orange County, FL",
      countyHint: "12095",
      stateCode: "FL",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata).toMatchObject({
      sourceUsed: "scout_mixed_discovery_recovery",
      discoveryChecks: { areaLabel: "Maricopa County, AZ" },
    });
    expect(listRecentScoutCountyPosts).toHaveBeenCalledWith("04013", expect.any(Date));
    expect(publicDirectoryMock).toHaveBeenCalledWith(expect.objectContaining({ countyFips: "04013" }));
    expect(publicToolsMock).toHaveBeenCalledWith(expect.objectContaining({ countyFips: "04013" }));
    expect(publicPagesMock).toHaveBeenCalledWith(expect.objectContaining({ countyFips: "04013" }));
    expect(resolveKnowledgeMock).not.toHaveBeenCalled();
  });
});
