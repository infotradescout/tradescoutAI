import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROFILE_CATALOG_EXCHANGE_CATEGORY,
  PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS,
} from "@shared/profileCatalogExchange";
import {
  getProfileCatalogExchangeItem,
  getPublicProfileCatalogExchangeItem,
  listProfileCatalogExchangeItems,
  listPublicProfileCatalogExchangeItems,
} from "../profileCatalogExchange";

const authorityMocks = vi.hoisted(() => ({
  getProfileBySlugPublic: vi.fn(),
  getProfileOwnerUserId: vi.fn(),
  hasExposureAuthority: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: authorityMocks.getProfileBySlugPublic,
    getProfileOwnerUserId: authorityMocks.getProfileOwnerUserId,
  },
}));

vi.mock("../services/exposureAuthority", () => ({
  hasExposureAuthority: authorityMocks.hasExposureAuthority,
}));

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile catalog Exchange contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authorityMocks.getProfileBySlugPublic.mockImplementation(async (slug: string) => ({
      id: `profile-${slug}`,
    }));
    authorityMocks.getProfileOwnerUserId.mockImplementation(async (profileId: string) =>
      profileId.replace("profile-", "owner-")
    );
    authorityMocks.hasExposureAuthority.mockResolvedValue(true);
  });

  it("defines exactly one immutable request-only spotlight per approved business", () => {
    expect(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS).toHaveLength(2);
    expect(Object.isFrozen(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS)).toBe(true);
    expect(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.map((item) => item.businessName)).toEqual([
      "JW Stone LLC",
      "ISSA Build",
    ]);
    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      expect(Object.isFrozen(spotlight)).toBe(true);
      expect(spotlight.commerceMode).toBe("request_only");
    }
  });

  it("carries no transaction, stock, shipping, condition, or direct-contact claim", () => {
    expect(PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE).toBe("profile_catalog");
    expect(PROFILE_CATALOG_EXCHANGE_CATEGORY).toBe("building-materials");
    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      const record = spotlight as Readonly<Record<string, unknown>>;
      for (const field of [
        "price",
        "stock",
        "stockQuantity",
        "availability",
        "condition",
        "shipping",
        "purchasePath",
        "phone",
        "email",
      ]) {
        expect(record).not.toHaveProperty(field);
      }
      expect(`${spotlight.title} ${spotlight.description}`).not.toMatch(
        /\$|\bin stock\b|\bavailable (?:now|today)\b/i
      );
    }
  });

  it("adapts to quote-only discovery records and rejects listing filters", () => {
    const items = listProfileCatalogExchangeItems({ category: "building-materials" });
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.price).toBeNull();
      expect(item.pricingMode).toBe("request_quote");
      expect(item.contactAccess.mode).toBe("managed_profile_request");
      expect(item).not.toHaveProperty("condition");
      expect(item).not.toHaveProperty("shippingCost");
    }
    expect(listProfileCatalogExchangeItems({ category: "tools" })).toEqual([]);
    expect(
      listProfileCatalogExchangeItems({ category: "building-materials", hasPriceFilter: true })
    ).toEqual([]);
    expect(getProfileCatalogExchangeItem("profile-catalog-unknown")).toBeNull();
  });

  it("keeps destinations on exact maintained profiles and Direct Connect authority there", () => {
    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      expect(spotlight.profilePath).toBe(`/u/${spotlight.profileSlug}`);
      expect(spotlight.catalogPath.startsWith(`${spotlight.profilePath}#`)).toBe(true);
      expect(spotlight.catalogPath).not.toMatch(/^(?:https?:|mailto:|tel:)|\/direct-connect/i);
    }
  });

  it("uses canonical public-profile authority and non-merchant SSR", () => {
    const adapter = read("server/profileCatalogExchange.ts");
    const html = read("server/publicExchangeListingHtml.ts");
    const routes = read("server/routes.ts");

    expect(adapter).toContain("storage.getProfileBySlugPublic(item.sellerId)");
    expect(adapter).toContain("hasExposureAuthority(ownerUserId)");
    expect(html).toContain('listing.sourceType === "profile_catalog"');
    expect(html).toContain('? "website" : "product"');
    expect(routes).toContain("listPublicProfileCatalogExchangeItems({");
    expect(routes).toContain("getPublicProfileCatalogExchangeItem(id)");
  });

  it("fails closed when the maintained profile or its owner authority is absent", async () => {
    authorityMocks.getProfileBySlugPublic.mockResolvedValueOnce(null);
    await expect(getPublicProfileCatalogExchangeItem("profile-catalog-jw-stone")).resolves.toBeNull();
    expect(authorityMocks.getProfileOwnerUserId).not.toHaveBeenCalled();
    expect(authorityMocks.hasExposureAuthority).not.toHaveBeenCalled();

    authorityMocks.getProfileBySlugPublic.mockResolvedValueOnce({ id: "profile-jw-stone" });
    authorityMocks.getProfileOwnerUserId.mockResolvedValueOnce(null);
    await expect(getPublicProfileCatalogExchangeItem("profile-catalog-jw-stone")).resolves.toBeNull();
    expect(authorityMocks.hasExposureAuthority).not.toHaveBeenCalled();

    authorityMocks.getProfileBySlugPublic.mockResolvedValueOnce({ id: "profile-jw-stone" });
    authorityMocks.getProfileOwnerUserId.mockResolvedValueOnce("owner-jw-stone");
    authorityMocks.hasExposureAuthority.mockResolvedValueOnce(false);
    await expect(getPublicProfileCatalogExchangeItem("profile-catalog-jw-stone")).resolves.toBeNull();
  });

  it("returns only catalog entries whose public profile and owner both retain authority", async () => {
    authorityMocks.hasExposureAuthority.mockImplementation(
      async (ownerId: string) => ownerId === "owner-jw-stone"
    );

    const visible = await listPublicProfileCatalogExchangeItems({
      category: "building-materials",
    });

    expect(visible.map((item) => item.id)).toEqual(["profile-catalog-jw-stone"]);
    expect(visible[0]?.publicProfilePath).toBe("/u/jw-stone#inventory-browser");
  });

  it("suppresses a catalog entry when authority resolution errors", async () => {
    authorityMocks.getProfileBySlugPublic.mockRejectedValueOnce(new Error("authority unavailable"));
    await expect(getPublicProfileCatalogExchangeItem("profile-catalog-jw-stone")).resolves.toBeNull();
  });

  it("keeps the old-site lane additive-only and leaves current inventory untouched", () => {
    const contract = read("docs/runbooks/JW_STONE_OLD_SITE_INVENTORY_SHEET_CONTRACT.md");
    expect(contract).toContain("current reconciled inventory remains authoritative and unchanged");
    expect(contract).toContain("may not update, replace, reclassify, rename, hide");
    expect(contract).toContain("every public data change is a newly added old-site item");
  });
});
