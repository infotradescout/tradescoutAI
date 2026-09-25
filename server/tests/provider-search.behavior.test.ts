import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    findCountyByNameOrFips: vi.fn(),
    getContractors: vi.fn(),
    getProvidersByCountyAndCategory: vi.fn(),
    getProvidersByStateAndCategory: vi.fn(),
    getTradeBySlug: vi.fn(),
    getUser: vi.fn(),
  },
  loadCanonicalPublicMapProfileUrls: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../storage", () => ({ storage: mocks.storage }));
vi.mock("../repositories/profileRepository", () => ({
  loadCanonicalPublicMapProfileUrls: mocks.loadCanonicalPublicMapProfileUrls,
}));
vi.mock("../db", () => ({
  db: {
    select: mocks.select,
  },
}));

import { registerProviderSearchRoutes } from "../routes/provider-search";

function buildApp() {
  const app = express();
  const passThroughLimiter = (_req: any, _res: any, next: () => void) => next();
  registerProviderSearchRoutes(app, passThroughLimiter, ["/api/business-providers/search"]);
  return app;
}

describe("provider search behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.findCountyByNameOrFips.mockResolvedValue(null);
    mocks.storage.getContractors.mockResolvedValue([]);
    mocks.storage.getProvidersByCountyAndCategory.mockResolvedValue([]);
    mocks.storage.getProvidersByStateAndCategory.mockResolvedValue([]);
    mocks.storage.getTradeBySlug.mockResolvedValue(null);
    mocks.storage.getUser.mockResolvedValue(null);
    mocks.loadCanonicalPublicMapProfileUrls.mockResolvedValue(new Map());
    mocks.select.mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(async () => []),
      };
      return chain;
    });
  });

  it("returns only contractors with canonical public-profile authority", async () => {
    mocks.storage.getContractors.mockResolvedValue([
      {
        id: "contractor-public",
        userId: "user-public",
        companyName: "Public Plumbing",
        slug: "public-plumbing",
        phone: "850-555-0100",
        email: "private@example.com",
      },
      {
        id: "contractor-private",
        userId: "user-private",
        companyName: "Private Plumbing",
        slug: "private-plumbing",
      },
    ]);
    mocks.loadCanonicalPublicMapProfileUrls.mockResolvedValue(
      new Map([["user-public", "/u/public-plumbing"]])
    );

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=FL&query=plumbing"
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: "contractor-public",
      companyName: "Public Plumbing",
      canonicalBusinessProfileUrl: "/u/public-plumbing",
      providerType: "contractor",
    });
    expect(response.body[0]).not.toHaveProperty("phone");
    expect(response.body[0]).not.toHaveProperty("email");
    expect(response.body[0]).not.toHaveProperty("userId");
    expect(response.text).not.toContain("contractor-private");
  });

  it("fails closed before either provider store when a trade slug does not resolve", async () => {
    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=FL&trade=not-a-real-trade"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mocks.storage.getContractors).not.toHaveBeenCalled();
    expect(mocks.storage.getProvidersByStateAndCategory).not.toHaveBeenCalled();
    expect(mocks.loadCanonicalPublicMapProfileUrls).not.toHaveBeenCalled();
  });

  it("passes canonical trade and query while counting contractor offset after public gating", async () => {
    mocks.storage.getTradeBySlug.mockResolvedValue({ id: "trade-1", slug: "plumbing" });

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=fl&trade=plumber&query=Acme&limit=20&offset=40"
    );

    expect(response.status).toBe(200);
    expect(mocks.storage.getContractors).toHaveBeenCalledWith({
      stateCode: "FL",
      tradeIds: ["trade-1"],
      query: "Acme",
      limit: 100,
      offset: 0,
    });
    expect(mocks.storage.getProvidersByStateAndCategory).toHaveBeenCalledWith({
      stateCode: "FL",
      tradeSlug: "plumbing",
      query: "Acme",
      limit: 20,
      offset: 40,
    });
  });

  it("uses the requested state while resolving duplicate county names", async () => {
    mocks.storage.findCountyByNameOrFips.mockResolvedValue({
      id: "county-fl-washington",
      name: "Washington County",
      stateCode: "FL",
    });

    const response = await request(buildApp()).get(
      "/api/business-providers/search?county=Washington&state=fl"
    );

    expect(response.status).toBe(200);
    expect(mocks.storage.findCountyByNameOrFips).toHaveBeenCalledWith({
      query: "Washington",
      stateCode: "FL",
    });
    expect(mocks.storage.getContractors).toHaveBeenCalledWith({
      countyId: "county-fl-washington",
      limit: 100,
      offset: 0,
    });
  });

  it("finds a published contractor after more than one page of unpublished local rows", async () => {
    mocks.storage.findCountyByNameOrFips.mockResolvedValue({
      id: "county-fl-escambia",
      stateCode: "FL",
    });
    mocks.storage.getTradeBySlug.mockResolvedValue({ id: "trade-plumbing", slug: "plumbing" });
    const rawContractors = [
      ...Array.from({ length: 125 }, (_, index) => ({
        id: `contractor-hidden-${index}`,
        userId: `user-hidden-${index}`,
        companyName: `Hidden ${index}`,
      })),
      {
        id: "contractor-published",
        userId: "user-published",
        companyName: "Published Plumbing",
        phone: "850-555-0100",
      },
    ];
    mocks.storage.getContractors.mockImplementation(async ({ offset, limit }) =>
      rawContractors.slice(offset, offset + limit)
    );
    mocks.loadCanonicalPublicMapProfileUrls.mockImplementation(async (ownerIds: string[]) =>
      new Map(
        ownerIds.includes("user-published")
          ? [["user-published", "/u/published-plumbing"]]
          : []
      )
    );

    const response = await request(buildApp()).get(
      "/api/business-providers/search?county=12033&state=FL&trade=plumbing&limit=30"
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: "contractor-published",
      canonicalBusinessProfileUrl: "/u/published-plumbing",
    });
    expect(response.body[0]).not.toHaveProperty("phone");
    expect(mocks.storage.getContractors).toHaveBeenCalledWith({
      countyId: "county-fl-escambia",
      tradeIds: ["trade-plumbing"],
      limit: 100,
      offset: 100,
    });
    expect(response.text).not.toContain("contractor-hidden");
  });

  it("returns a source error when canonical profile authority cannot be checked", async () => {
    mocks.storage.getContractors.mockResolvedValue([
      { id: "contractor-1", userId: "owner-1", companyName: "One Plumbing" },
    ]);
    mocks.loadCanonicalPublicMapProfileUrls.mockRejectedValue(new Error("profile source unavailable"));

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=FL"
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Failed to search providers" });
    expect(response.body).not.toEqual([]);
  });

  it("applies contractor pagination to visible profiles instead of hidden rows", async () => {
    const rawContractors = [
      { id: "hidden", userId: "owner-hidden", companyName: "Hidden" },
      { id: "public-first", userId: "owner-first", companyName: "First" },
      { id: "public-second", userId: "owner-second", companyName: "Second" },
    ];
    mocks.storage.getContractors.mockImplementation(async ({ offset, limit }) =>
      rawContractors.slice(offset, offset + limit)
    );
    mocks.loadCanonicalPublicMapProfileUrls.mockResolvedValue(
      new Map([
        ["owner-first", "/u/first"],
        ["owner-second", "/u/second"],
      ])
    );

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=FL&limit=1&offset=1"
    );

    expect(response.status).toBe(200);
    expect(response.body.map((provider: { id: string }) => provider.id)).toEqual([
      "public-second",
    ]);
  });

  it("reports an incomplete source instead of a checked empty result at the scan cap", async () => {
    mocks.storage.getContractors.mockImplementation(async ({ offset, limit }) =>
      Array.from({ length: limit }, (_, index) => ({
        id: `contractor-${offset + index}`,
        userId: `owner-${offset + index}`,
      }))
    );

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=FL&limit=30"
    );

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: "Local provider search is incomplete. Try again." });
    expect(mocks.storage.getContractors).toHaveBeenCalledTimes(11);
    expect(mocks.storage.getProvidersByStateAndCategory).not.toHaveBeenCalled();
  });

  it("preserves repository-paginated business rows instead of slicing them a second time", async () => {
    mocks.storage.getProvidersByStateAndCategory.mockResolvedValue([
      {
        businessId: "business-page-2",
        ownerUserId: null,
        name: "Page Two Plumbing",
        roleContext: "business_owner",
        slug: "page-two-plumbing",
        profileData: { category: "Plumbing" },
      },
    ]);

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=FL&limit=10&offset=10"
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      businessId: "business-page-2",
      providerType: "business",
    });
    expect(mocks.storage.getProvidersByStateAndCategory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 10 })
    );
  });
});
