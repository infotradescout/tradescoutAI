import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveKnowledgeMock, getOnboardingSessionMock, governMock } = vi.hoisted(() => ({
  resolveKnowledgeMock: vi.fn(),
  getOnboardingSessionMock: vi.fn(),
  governMock: vi.fn(),
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
vi.mock("../scout/scoutCountyPostLookup", () => ({
  listRecentScoutCountyPosts: vi.fn(),
}));

import scoutRouter from "../routes/scout";
import { listRecentScoutCountyPosts } from "../scout/scoutCountyPostLookup";
import { storage } from "../storage";

const screenshotPrompt =
  "Search TradeScout and my area for posts & deals in my county. Look in Site, Near me, Latest, assume I care about this week, and keep it simple. Include matching pages, tools, local results, posts, requests, and anything nearby that may help. Show the best matches, why they matter, and what I can safely do next before I contact anyone.";

const app = express();
app.use(express.json());
app.use("/api/scout", scoutRouter);

describe("Scout mixed county discovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listRecentScoutCountyPosts).mockResolvedValue([]);
    vi.spyOn(storage, "listPromotions").mockResolvedValue([]);
    getOnboardingSessionMock.mockResolvedValue(undefined);
    governMock.mockResolvedValue({
      intervention: { action: "COMPLY", role: "guide", reasoning: "Read-only local discovery" },
      situation: { goal: "Find local activity", risks: [], unknowns: [], confidence: "medium" },
      outcomeGraph: null,
      confidence: "medium",
      requiresLLM: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers the screenshot prompt with a complete client contract and only a verified post card", async () => {
    vi.mocked(listRecentScoutCountyPosts).mockResolvedValue([
      {
        id: "post_123",
        title: "Neighborhood tool swap",
        content: "A neighbor is sharing tools",
        createdAt: new Date(),
        isPublished: true,
        isHidden: false,
        scope: "county",
        countyFips: "04013",
        hasWorkRequest: true,
      },
    ] as any);

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(listRecentScoutCountyPosts).toHaveBeenCalledWith("04013", expect.any(Date));
    expect(resolveKnowledgeMock).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      contract_version: "scout_result.v1",
      message: expect.any(String),
      answer: expect.any(String),
      ambiguity_options: expect.any(Array),
      entities: [
        {
          id: "post_123",
          type: "community_post",
          name: "Neighborhood tool swap",
          url: "/community/posts/post_123",
          match_reasons: expect.any(Array),
        },
      ],
      evidence: expect.any(Array),
      allowed_actions: expect.any(Array),
      working_memory_update: expect.any(Object),
      metadata: { sourceUsed: "scout_mixed_discovery_recovery", postCheck: "checked" },
    });
    expect(response.body.answer).toContain("This Scout result includes");
    expect(response.body.answer).toContain("no eligible TradeDeals were returned");
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "NAVIGATE",
          target: "/community/posts/post_123",
          primary: true,
        }),
        expect.objectContaining({
          type: "NAVIGATE",
          target: "/community-feed?geo=local&feed=recent",
          primary: false,
        }),
        expect.objectContaining({ type: "NAVIGATE", target: "/contractors" }),
      ])
    );
    expect(response.body.entities.map((entity: { type: string }) => entity.type)).toEqual([
      "community_post",
    ]);
    expect(response.body.entities[0].match_reasons).toContain(
      "Published county post linked to a request"
    );
    expect(JSON.stringify(response.body.entities[0])).not.toContain("workRequestId");
  });

  it("offers a broader user-controlled next step when both county sources are checked-empty", async () => {
    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.contract_version).toBe("scout_result.v1");
    expect(response.body.entities).toEqual([]);
    expect(response.body.metadata).toMatchObject({ postCheck: "checked", dealCheck: "checked" });
    expect(response.body.answer).toContain(
      "Scout checked published county posts from the last 7 days in Maricopa County, AZ"
    );
    expect(response.body.answer).toContain("none were returned");
    expect(response.body.answer).toContain("no eligible TradeDeals were returned");
    expect(response.body.answer).toContain("Other deal sources were not checked");
    expect(response.body.allowed_actions.length).toBeGreaterThan(0);
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Browse recent Community beyond my county",
          target: "/community-feed?geo=global&feed=recent",
          primary: true,
        }),
        expect.objectContaining({ label: "Change my area", target: "/settings" }),
        expect.objectContaining({ label: "Browse Businesses", target: "/contractors" }),
      ])
    );
    expect(response.body.allowed_actions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "/community-feed?geo=local&feed=recent", primary: true }),
      ])
    );
  });

  it("describes only the three county post cards it actually returns", async () => {
    vi.mocked(listRecentScoutCountyPosts).mockResolvedValue([
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `post_${index + 1}`,
        title: `County post ${index + 1}`,
        content: "Published local post",
        createdAt: new Date(),
        hasWorkRequest: false,
      })),
    ] as any);

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.entities).toHaveLength(3);
    expect(response.body.answer).toContain("includes 3 published county posts");
    expect(response.body.answer).not.toContain("includes 4 published county posts");
  });

  it("returns a partial answer with retry when the county post source fails", async () => {
    vi.mocked(listRecentScoutCountyPosts).mockRejectedValue(
      new Error("synthetic post source failure")
    );

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata).toMatchObject({ postCheck: "error", dealCheck: "checked" });
    expect(response.body.knowledge.layer).toBe(2);
    expect(response.body.entities).toEqual([]);
    expect(response.body.answer).toContain(
      "Published county posts from the last 7 days in Maricopa County, AZ could not be checked right now"
    );
    expect(response.body.answer).not.toContain("none were returned. It checked Scout promotions");
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ASK_SCOUT",
          label: "Retry local posts and deals",
          primary: true,
        }),
      ])
    );
    expect(resolveKnowledgeMock).not.toHaveBeenCalled();
  });

  it("marks both failed county sources unavailable without pretending a database check succeeded", async () => {
    vi.mocked(listRecentScoutCountyPosts).mockRejectedValue(
      new Error("synthetic post source failure")
    );
    vi.mocked(storage.listPromotions).mockRejectedValue(new Error("synthetic deal source failure"));

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata).toMatchObject({ postCheck: "error", dealCheck: "error" });
    expect(response.body.knowledge.layer).toBe(0);
    expect(response.body.knowledge.sources).toEqual([]);
    expect(response.body.answer).toContain(
      "Published county posts from the last 7 days in Maricopa County, AZ could not be checked right now"
    );
    expect(response.body.answer).toContain("Scout promotions could not be checked right now");
    expect(response.body.entities).toEqual([]);
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "ASK_SCOUT", primary: true })])
    );
  });

  it("does not query either county source before a county is set", async () => {
    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata).toMatchObject({
      postCheck: "not_checked",
      dealCheck: "not_checked",
    });
    expect(response.body.knowledge.layer).toBe(0);
    expect(listRecentScoutCountyPosts).not.toHaveBeenCalled();
    expect(storage.listPromotions).not.toHaveBeenCalled();
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ target: "/settings", primary: true })])
    );
  });
});
