import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProfileBySlugPublic: vi.fn(),
  getBusinessPublicById: vi.fn(),
  getMarketplaceListings: vi.fn(),
  getMarketplaceCategories: vi.fn(),
  buildExposureAuthorityMap: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: mocks.getProfileBySlugPublic,
    getBusinessPublicById: mocks.getBusinessPublicById,
    getMarketplaceListings: mocks.getMarketplaceListings,
    getMarketplaceCategories: mocks.getMarketplaceCategories,
  },
}));
vi.mock("../services/exposureAuthority", () => ({
  buildExposureAuthorityMap: mocks.buildExposureAuthorityMap,
}));
vi.mock("../db", () => ({ db: { select: mocks.select } }));

import { buildPublicProfileHtml } from "../publicProfileHtml";

const templateHtml = `<!doctype html><html><head><title>TradeScout</title><meta name="description" content="TradeScout" /><meta name="robots" content="index, follow" /><link rel="canonical" href="https://www.thetradescout.com" /></head><body><div id="root"></div></body></html>`;

const profile = {
  id: "profile-craftworks",
  slug: "craftworks",
  displayName: "Craftworks",
  headline: "Tools and repair in the local area.",
  roleContext: "business_owner",
  servicesDescription: "Equipment repair and available tools.",
  businessId: "business-craftworks",
  profileSections: { services: true, marketplaceListings: true },
  seoMeta: { customDomain: "craftworks.example" },
  contentBlocks: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfileBySlugPublic.mockResolvedValue(profile);
  mocks.getBusinessPublicById.mockResolvedValue({ name: "Craftworks", categories: ["Equipment"] });
  mocks.select.mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => [{ ownerUserId: "private-owner-id" }] }) }),
  });
  mocks.buildExposureAuthorityMap.mockResolvedValue({ "private-owner-id": true });
  mocks.getMarketplaceListings.mockResolvedValue([
    {
      id: "listing-1",
      sellerId: "private-owner-id",
      categoryId: "tools-category",
      title: "Available contractor tool kit",
      description: "Private supplier quote and terms are not in the profile summary.",
      price: "9999.00",
      status: "active",
    },
  ]);
  mocks.getMarketplaceCategories.mockResolvedValue([
    { id: "tools-category", name: "Tools & Hardware" },
  ]);
});

describe("contextual public profile links", () => {
  it("links the owner's approved active Exchange items and Direct Connect from a hosted profile", async () => {
    const html = await buildPublicProfileHtml({
      slug: "craftworks",
      origin: "https://craftworks.example",
      templateHtml,
    });

    expect(mocks.buildExposureAuthorityMap).toHaveBeenCalledWith(["private-owner-id"]);
    expect(mocks.getMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: "private-owner-id", status: "active", limit: 6 })
    );
    expect(html).toContain('data-seo-profile-exchange-links="true"');
    expect(html).toContain('href="https://www.thetradescout.com/exchange/tools/listing-1"');
    expect(html).toContain("Available contractor tool kit");
    expect(html).toContain(
      'href="https://www.thetradescout.com/direct-connect?profile=craftworks&amp;targetName=Craftworks&amp;source=profile_site"'
    );
    expect(html).not.toContain("private-owner-id");
    expect(html).not.toContain("9999.00");
    expect(html).not.toContain("Private supplier quote");
  });

  it("does not expose Exchange links without the owner's listing authority", async () => {
    mocks.buildExposureAuthorityMap.mockResolvedValue({ "private-owner-id": false });
    const html = await buildPublicProfileHtml({
      slug: "craftworks",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(mocks.getMarketplaceListings).not.toHaveBeenCalled();
    expect(html).not.toContain('data-seo-profile-exchange-links="true"');
  });

  it("respects a profile's hidden marketplace section", async () => {
    mocks.getProfileBySlugPublic.mockResolvedValue({
      ...profile,
      profileSections: { marketplaceListings: false },
    });
    const html = await buildPublicProfileHtml({
      slug: "craftworks",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(mocks.buildExposureAuthorityMap).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(html).not.toContain('data-seo-profile-exchange-links="true"');
  });

  it("keeps the published profile available if Exchange is unavailable", async () => {
    mocks.getMarketplaceListings.mockRejectedValue(new Error("Exchange unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = await buildPublicProfileHtml({
        slug: "craftworks",
        origin: "https://www.thetradescout.com",
        templateHtml,
      });

      expect(html).toContain("Craftworks");
      expect(html).toContain('data-seo-profile-connect="true"');
      expect(html).not.toContain('data-seo-profile-exchange-links="true"');
    } finally {
      errorLog.mockRestore();
    }
  });
});
