import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import scoutRouter from "../routes/scout";

const screenshotPrompt =
  "Search TradeScout and my area for posts & deals in my county. Look in Site, Near me, Latest, assume I care about this week, and keep it simple. Include matching pages, tools, local results, posts, requests, and anything nearby that may help. Show the best matches, why they matter, and what I can safely do next before I contact anyone.";

const app = express();
app.use(express.json());
app.use("/api/scout", scoutRouter);

describe("Scout mixed county discovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOnboardingSessionMock.mockResolvedValue(undefined);
    governMock.mockResolvedValue({
      intervention: { action: "COMPLY", role: "guide", reasoning: "Read-only local discovery" },
      situation: { goal: "Find local activity", risks: [], unknowns: [], confidence: "medium" },
      outcomeGraph: null,
      confidence: "medium",
      requiresLLM: true,
    });
  });

  it("answers the screenshot prompt with a complete client contract and only a verified post card", async () => {
    resolveKnowledgeMock.mockResolvedValue({
      answer: "Synthetic county post data",
      sources: ["TradeScout Database (community_posts)"],
      layer: 2,
      confidence: "high",
      meta: {
        communityPosts: {
          count: 1,
          items: [
            {
              id: "post_123",
              title: "Neighborhood tool swap",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      },
    });

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(resolveKnowledgeMock).toHaveBeenCalledWith(
      expect.objectContaining({ countyCode: "Maricopa County, AZ", countyFips: "04013" }),
      null
    );
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
      metadata: { sourceUsed: "scout_mixed_discovery_recovery" },
    });
    expect(response.body.answer).toContain("I checked recent county posts only");
    expect(response.body.answer).toContain(
      "I have not checked deals, businesses, pages, tools, or other requests yet"
    );
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "NAVIGATE",
          target: "/community-feed?geo=local&feed=recent",
        }),
        expect.objectContaining({ type: "NAVIGATE", target: "/contractors" }),
      ])
    );
    expect(response.body.entities.map((entity: { type: string }) => entity.type)).toEqual([
      "community_post",
    ]);
  });

  it("keeps empty limited discovery truthful and action-ready", async () => {
    resolveKnowledgeMock.mockResolvedValue({
      answer: "",
      sources: [],
      layer: 4,
      confidence: "low",
      meta: {},
    });

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
    expect(response.body.answer).toContain("could not verify a county post");
    expect(response.body.answer).not.toMatch(
      /no (posts|deals|businesses)|0 (posts|deals|businesses)/i
    );
    expect(response.body.allowed_actions.length).toBeGreaterThan(0);
  });
});
