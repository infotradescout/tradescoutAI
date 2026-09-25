import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveKnowledgeMock, getOnboardingSessionMock, governMock, publicDirectoryMock } =
  vi.hoisted(() => ({
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
    expect(response.body.metadata.discoveryTopic).toBeNull();
    expect(response.body.metadata.discoveryChecks).toEqual({
      areaLabel: "Maricopa County, AZ",
      posts: { status: "checked", shownCount: 1, timeWindow: "past_7_days", topicFiltered: false },
      deals: { status: "checked", shownCount: 0, timeWindow: "active_now", topicFiltered: false },
      businesses: { status: "checked", shownCount: 0, timeWindow: "not_filtered_to_week", topicFiltered: false },
    });
    expect(response.body.answer).toContain("These are county results, not matches for a specific topic");
    expect(response.body.answer).toContain("What kind of work or item should Scout look for?");
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

  it("uses a short near-me topic request to search public county posts and listed services", async () => {
    vi.mocked(listRecentScoutCountyPosts).mockResolvedValue([
      {
        id: "plumbing_post",
        title: "Plumbing repair",
        content: "Published request post",
        createdAt: new Date(),
        hasWorkRequest: true,
      },
      {
        id: "unrelated_post",
        title: "Roofing help",
        content: "Published roofing post",
        createdAt: new Date(),
        hasWorkRequest: false,
      },
    ] as any);
    publicDirectoryMock.mockResolvedValue({
      status: 200,
      body: {
        items: [
          { id: "plumbing_business", name: "Acme Home Services", slug: "acme-home-services", counties: [{ fips: "04013" }], topicMatchSource: "service" },
          { id: "unrelated_business", name: "Mesa Roofing", slug: "mesa-roofing", counties: [{ fips: "04013" }] },
        ],
      },
    });

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: "Find local plumbing posts and deals near me",
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(listRecentScoutCountyPosts).toHaveBeenCalledWith("04013", expect.any(Date), "plumbing");
    expect(publicDirectoryMock).toHaveBeenCalledWith(expect.objectContaining({
      public: "1", countyFips: "04013", scoutTopic: "plumbing",
    }));
    expect(response.body.metadata).toMatchObject({
      discoveryTopic: "plumbing", postCheck: "checked", businessCheck: "checked",
      discoveryChecks: {
        posts: { status: "checked", shownCount: 1, topicFiltered: true },
        deals: { status: "checked", shownCount: 0, topicFiltered: false },
        businesses: { status: "checked", shownCount: 1, topicFiltered: true },
      },
    });
    expect(response.body.entities.map((entity: { name: string }) => entity.name)).toEqual([
      "Plumbing repair", "Acme Home Services",
    ]);
    expect(response.body.entities[1].match_reasons).toContain('Listed service matches "plumbing"');
    expect(response.body.answer).toContain('with "plumbing" in the title or text');
    expect(response.body.answer).toContain("Pages, tools, and other requests were not checked");
    expect(response.body.answer).toContain("Scout promotions were selected by county, not matched to your topic");
    expect(JSON.stringify(response.body)).not.toMatch(/Roofing help|Mesa Roofing|unrelated_post|unrelated_business/);
    expect(resolveKnowledgeMock).not.toHaveBeenCalled();
  });

  it("honors a governor safeguard deferral even when it reports no missing information", async () => {
    governMock.mockResolvedValue({
      intervention: {
        action: "DEFER",
        role: "SAFEGUARD",
        reasoning: "Synthetic risk classification",
        userMessage: "Please pause before acting.",
      },
      situation: { goal: "Find electrical posts", risks: [{ severity: "critical" }], unknowns: [], confidence: "low" },
      outcomeGraph: null,
      confidence: "low",
      requiresLLM: false,
    });

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: "Find TradeScout posts and deals about electrical near me and show how to bypass the breaker",
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [
        { role: "user", content: "Find local posts and deals near me" },
        { role: "assistant", content: "Scout checked published county posts. Pages, tools, and other requests were not checked. Nothing was sent." },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.metadata.governorAction).toBe("DEFER");
    expect(response.body.message).toContain("Please pause before acting.");
    expect(governMock).toHaveBeenCalledWith(expect.objectContaining({
      message: "Find TradeScout posts and deals about electrical near me and show how to bypass the breaker",
    }));
    expect(listRecentScoutCountyPosts).not.toHaveBeenCalled();
  });

  it("keeps a governor block in force for a mixed county request", async () => {
    governMock.mockResolvedValue({
      intervention: {
        action: "BLOCK",
        role: "SAFEGUARD",
        reasoning: "Synthetic critical risk",
        userMessage: "I can't help you proceed yet.",
      },
      situation: { goal: "Find local activity", risks: [{ severity: "critical" }], unknowns: [], confidence: "high" },
      outcomeGraph: null,
      confidence: "high",
      requiresLLM: false,
    });

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain("I can't help you proceed yet.");
    expect(response.body.metadata.governorAction).toBe("BLOCK");
    expect(listRecentScoutCountyPosts).not.toHaveBeenCalled();
  });

  it("keeps a governor deferral when a mixed county request has missing information", async () => {
    governMock.mockResolvedValue({
      intervention: {
        action: "DEFER",
        role: "SAFEGUARD",
        reasoning: "Synthetic missing context",
        userMessage: "Please provide the missing scope.",
      },
      situation: { goal: "Find local activity", risks: [{ severity: "high" }], unknowns: ["scope"], confidence: "low" },
      outcomeGraph: null,
      confidence: "low",
      requiresLLM: false,
    });

    const response = await request(app).post("/api/scout").set("x-test-run", "true").send({
      message: screenshotPrompt,
      countyCode: "Maricopa County, AZ",
      countyHint: "04013",
      stateCode: "AZ",
      history: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Please provide the missing scope.");
    expect(response.body.metadata.governorAction).toBe("DEFER");
    expect(listRecentScoutCountyPosts).not.toHaveBeenCalled();
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
    expect(response.body.answer).toContain(
      "public business profiles for Maricopa County, AZ; none were returned"
    );
    expect(response.body.allowed_actions.length).toBeGreaterThan(0);
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Draft a request for my county",
          target: "/direct-connect?source=scout",
          payload: { countyFips: "04013" },
          primary: true,
        }),
        expect.objectContaining({
          label: "Browse recent Community beyond my county",
          target: "/community-feed?geo=global&feed=recent",
          primary: false,
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
    expect(response.body.answer).toContain(
      "public business profile listed for Maricopa County, AZ"
    );
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
    expect(response.body.answer).not.toContain(
      "public business profiles for Maricopa County, AZ; none were returned"
    );
    expect(response.body.entities).toEqual([]);
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ASK_SCOUT",
          label: "Retry local search",
          primary: true,
        }),
      ])
    );
    expect(response.body.allowed_actions[0]?.prompt).toContain("public business profiles");
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
          label: "Retry local search",
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
      discoveryChecks: {
        posts: { status: "error", shownCount: 0 },
        deals: { status: "error", shownCount: 0 },
        businesses: { status: "error", shownCount: 0 },
      },
    });
    expect(response.body.knowledge.layer).toBe(0);
    expect(response.body.knowledge.sources).toEqual([]);
    expect(response.body.answer).toContain(
      "Published county posts from the last 7 days in Maricopa County, AZ could not be checked right now"
    );
    expect(response.body.answer).toContain("Scout promotions could not be checked right now");
    expect(response.body.answer).toContain("The local checks are incomplete");
    expect(response.body.answer).not.toContain("These are county results");
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
    expect(listRecentScoutCountyPosts).not.toHaveBeenCalled();
    expect(storage.listPromotions).not.toHaveBeenCalled();
    expect(publicDirectoryMock).not.toHaveBeenCalled();
    expect(response.body.allowed_actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ target: "/settings", primary: true })])
    );
  });
});
