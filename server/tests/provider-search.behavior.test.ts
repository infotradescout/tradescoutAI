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

  it("passes canonical trade, query, and pagination to both state-scoped stores", async () => {
    mocks.storage.getTradeBySlug.mockResolvedValue({ id: "trade-1", slug: "plumbing" });

    const response = await request(buildApp()).get(
      "/api/business-providers/search?state=fl&trade=plumber&query=Acme&limit=20&offset=40"
    );

    expect(response.status).toBe(200);
    expect(mocks.storage.getContractors).toHaveBeenCalledWith({
      stateCode: "FL",
      tradeIds: ["trade-1"],
      query: "Acme",
      limit: 20,
      offset: 40,
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
      limit: 30,
      offset: 0,
    });
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
