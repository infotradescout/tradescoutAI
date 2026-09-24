import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveKnowledgeMock, getOnboardingSessionMock, governMock, publicDirectoryMock } = vi.hoisted(() => ({
  resolveKnowledgeMock: vi.fn(),
  getOnboardingSessionMock: vi.fn(),
  governMock: vi.fn(),
  publicDirectoryMock: vi.fn(),
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

import scoutRouter from "../routes/scout";
import { storage } from "../storage";

const screenshotPrompt =
  "Search TradeScout and my area for posts & deals in my county. Look in Site, Near me, Latest, assume I care about this week, and keep it simple. Include matching pages, tools, local results, posts, requests, and anything nearby that may help. Show the best matches, why they matter, and what I can safely do next before I contact anyone.";

const app = express();
app.use(express.json());
app.use("/api/scout", scoutRouter);

describe("Scout mixed county discovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(storage, "getCommunityPosts").mockResolvedValue([]);
    vi.spyOn(storage, "listPromotions").mockResolvedValue([]);
    publicDirectoryMock.mockResolvedValue({ status: 200, body: { items: [] } });
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
    vi.mocked(storage.getCommunityPosts).mockResolvedValue([
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
    expect(storage.getCommunityPosts).toHaveBeenCalledWith({
      scope: "county",
      countyFips: "04013",
      sort: "recent",
      limit: 10,
    });
    expect(publicDirectoryMock).toHaveBeenCalledWith({
      public: "1",
      countyFips: "04013",
      claimed: "any",
      limit: 10,
      offset: 0,
    });
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
      metadata: {
        sourceUsed: "scout_mixed_discovery_recovery",
        postCheck: "checked",
        businessCheck: "checked",
      },
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

  it("offers a broader user-controlled next step when all three county sources are checked-empty", async () => {
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
    expect(response.body.metadata).toMatchObject({
      postCheck: "checked",
      dealCheck: "checked",
      businessCheck: "checked",
    });
    expect(response.body.answer).toContain(
      "Scout checked published county posts from the last 7 days in Maricopa County, AZ"
    );
    expect(response.body.answer).toContain("none were returned");
    expect(response.body.answer).toContain("no eligible TradeDeals were returned");
    expect(response.body.answer).toContain("Other deal sources were not checked");
    expect(response.body.answer).toContain("public business profiles for Maricopa County, AZ; none were returned");
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

  it("shows only public same-county business cards and never passes directory contact fields through", async () => {
    publicDirectoryMock.mockResolvedValue({
      status: 200,
      body: {
        items: [
          {
            id: "business_1",
            name: "Maricopa Repair",
            slug: "maricopa-repair",
            counties: [{ fips: "04013" }],
            ownerUserId: "private_owner",
            phone: "private_phone",
          },
          {
            id: "business_other",
            name: "Other County",
            slug: "other-county",
            counties: [{ fips: "06037" }],
          },
        ],
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
    expect(response.body.metadata.businessCheck).toBe("checked");
    expect(response.body.entities).toEqual([
      expect.objectContaining({
        id: "business_1",
        type: "business",
        name: "Maricopa Repair",
        url: "/business/maricopa-repair",
      }),
    ]);
    expect(response.body.answer).toContain("public business profile listed for Maricopa County, AZ");
    expect(response.body.answer).toContain("were not filtered to this week");
    expect(response.body.knowledge.sources).toContain("TradeScout public business directory");
    expect(JSON.stringify(response.body)).not.toMatch(/private_owner|private_phone|Other County/);
  });

  it("marks public Businesses unavailable when its publication-gated query fails", async () => {
    publicDirectoryMock.mockRejectedValue(new Error("synthetic directory failure"));

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata.businessCheck).toBe("error");
    expect(response.body.answer).toContain(
      "Public business profiles for Maricopa County, AZ could not be checked right now"
    );
    expect(response.body.answer).not.toContain("public business profiles for Maricopa County, AZ; none were returned");
    expect(response.body.entities).toEqual([]);
  });

  it("describes only the county post cards it actually returns", async () => {
    vi.mocked(storage.getCommunityPosts).mockResolvedValue([
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `post_${index + 1}`,
        title: `County post ${index + 1}`,
        content: "Published local post",
        createdAt: new Date(),
        isPublished: true,
        isHidden: false,
        scope: "county",
        countyFips: "04013",
      })),
      {
        id: "hidden",
        title: "Hidden",
        content: "Private",
        createdAt: new Date(),
        isPublished: true,
        isHidden: true,
        scope: "county",
        countyFips: "04013",
      },
      {
        id: "unpublished",
        title: "Unpublished",
        content: "Draft",
        createdAt: new Date(),
        isPublished: false,
        isHidden: false,
        scope: "county",
        countyFips: "04013",
      },
      {
        id: "other_county",
        title: "Other county",
        content: "Elsewhere",
        createdAt: new Date(),
        isPublished: true,
        isHidden: false,
        scope: "county",
        countyFips: "06037",
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
    expect(response.body.entities).toHaveLength(3);
    expect(response.body.answer).toContain("includes 3 published county posts");
    expect(response.body.answer).not.toContain("includes 4 published county posts");
    expect(JSON.stringify(response.body)).not.toContain("Hidden");
    expect(JSON.stringify(response.body)).not.toContain("Unpublished");
    expect(JSON.stringify(response.body)).not.toContain("Other county");
  });

  it("returns a partial answer with retry when the county post source fails", async () => {
    vi.mocked(storage.getCommunityPosts).mockRejectedValue(
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
    vi.mocked(storage.getCommunityPosts).mockRejectedValue(
      new Error("synthetic post source failure")
    );
    vi.mocked(storage.listPromotions).mockRejectedValue(new Error("synthetic deal source failure"));
    publicDirectoryMock.mockRejectedValue(new Error("synthetic directory failure"));

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata).toMatchObject({
      postCheck: "error",
      dealCheck: "error",
      businessCheck: "error",
    });
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
      businessCheck: "not_checked",
    });
    expect(response.body.knowledge.layer).toBe(0);
    expect(storage.getCommunityPosts).not.toHaveBeenCalled();
    expect(storage.listPromotions).not.toHaveBeenCalled();
    expect(publicDirectoryMock).not.toHaveBeenCalled();
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ target: "/settings", primary: true })])
    );
  });
});
