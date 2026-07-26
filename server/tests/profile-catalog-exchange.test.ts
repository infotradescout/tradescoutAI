import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROFILE_CATALOG_EXCHANGE_CATEGORY,
  PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS,
} from "@shared/profileCatalogExchange";
import {
  getProfileCatalogExchangeItem,
  getPublicProfileCatalogExchangeItem,
  listProfileCatalogExchangeItems,
} from "../profileCatalogExchange";
import { buildPublicExchangeListingHtml } from "../publicExchangeListingHtml";
import { storage } from "../storage";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockPublishedCatalogAuthority() {
  vi.spyOn(storage, "getProfileBySlugPublic").mockResolvedValue({
    id: "profile-record-1",
  } as any);
  vi.spyOn(storage, "getProfileOwnerUserId").mockResolvedValue("profile-owner-1");
  vi.spyOn(storage, "getUsersByIds").mockResolvedValue([
    {
      id: "profile-owner-1",
      emailVerified: true,
      addressVerified: true,
    },
  ] as any);
  vi.spyOn(storage, "getUserVerificationSummary").mockResolvedValue({} as any);
}

describe("profile catalog Exchange spotlights", () => {
  it("defines exactly one immutable request-only spotlight per approved business", () => {
    expect(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS).toHaveLength(2);
    expect(Object.isFrozen(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS)).toBe(true);

    const byBusiness = new Map<string, number>();
    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      byBusiness.set(spotlight.businessName, (byBusiness.get(spotlight.businessName) ?? 0) + 1);
      expect(Object.isFrozen(spotlight)).toBe(true);
      expect(spotlight.commerceMode).toBe("request_only");
    }

    expect(Object.fromEntries(byBusiness)).toEqual({
      "JW Stone LLC": 1,
      "ISSA Build": 1,
    });
  });

  it("uses stable profile-catalog identity and the building-materials category", () => {
    expect(PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE).toBe("profile_catalog");
    expect(PROFILE_CATALOG_EXCHANGE_CATEGORY).toBe("building-materials");
    expect(PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.map((spotlight) => spotlight.id)).toEqual([
      "profile-catalog-jw-stone",
      "profile-catalog-issa-build",
    ]);

    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      expect(spotlight.sourceType).toBe(PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE);
      expect(spotlight.category).toBe(PROFILE_CATALOG_EXCHANGE_CATEGORY);
    }
  });

  it("does not invent transaction or inventory facts", () => {
    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      const record = spotlight as Readonly<Record<string, unknown>>;
      for (const forbiddenField of [
        "price",
        "stock",
        "stockQuantity",
        "availability",
        "condition",
        "finish",
        "shipping",
        "purchasePath",
      ]) {
        expect(record).not.toHaveProperty(forbiddenField);
      }

      const publicCopy = `${spotlight.title} ${spotlight.description} ${spotlight.actionLabel}`;
      expect(publicCopy).not.toMatch(
        /\$|\bin stock\b|\bavailable (?:now|today)\b|\bships? (?:now|today)\b/i
      );
    }
  });

  it("keeps every destination on the exact in-platform business profile", () => {
    for (const spotlight of PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS) {
      const expectedProfilePath = `/u/${spotlight.profileSlug}`;
      expect(spotlight.profilePath).toBe(expectedProfilePath);
      expect(spotlight.catalogPath.startsWith(`${expectedProfilePath}#`)).toBe(true);

      for (const destination of [spotlight.profilePath, spotlight.catalogPath]) {
        expect(destination).toMatch(/^\/u\/[a-z0-9]+(?:-[a-z0-9]+)*(?:#[a-z0-9-]+)?$/);
        expect(destination).not.toMatch(/^(?:https?:|mailto:|tel:)|\/direct-connect/i);
        expect(destination).not.toContain("..");
      }
    }
  });

  it("keeps JW Stone catalog identity cautious and ISSA Build showcase-only", () => {
    const jwStone = PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find(
      (spotlight) => spotlight.profileSlug === "jw-stone"
    );
    const issaBuild = PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find(
      (spotlight) => spotlight.profileSlug === "issa-build"
    );

    expect(jwStone?.catalogKind).toBe("material_catalog");
    expect(jwStone?.description).toContain("identity is still being confirmed");
    expect(issaBuild?.catalogKind).toBe("material_showcase");
    expect(issaBuild?.title).toContain("Honey Onyx and Multi Green Onyx");
  });

  it("adapts both records into quote-only Exchange items without commerce claims", () => {
    const items = listProfileCatalogExchangeItems({
      category: PROFILE_CATALOG_EXCHANGE_CATEGORY,
    });

    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.sourceType).toBe(PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE);
      expect(item.price).toBeNull();
      expect(item.pricingMode).toBe("request_quote");
      expect(item).not.toHaveProperty("condition");
      expect(item.contactAccess.mode).toBe("managed_profile_request");
      expect(item.publicProfilePath).toMatch(/^\/u\/[a-z0-9-]+#[a-z0-9-]+$/);
      expect(item).not.toHaveProperty("shippingCost");
      expect(item.specifications.visibilityBoundary).toContain(
        "Availability, project fit, and price are confirmed"
      );
    }
  });

  it("filters fail-closed and resolves only the two stable catalog IDs", () => {
    expect(listProfileCatalogExchangeItems({ category: "tools" })).toEqual([]);
    expect(
      listProfileCatalogExchangeItems({
        category: PROFILE_CATALOG_EXCHANGE_CATEGORY,
        hasPriceFilter: true,
      })
    ).toEqual([]);
    expect(
      listProfileCatalogExchangeItems({
        category: PROFILE_CATALOG_EXCHANGE_CATEGORY,
        search: "multi green",
      }).map((item) => item.id)
    ).toEqual(["profile-catalog-issa-build"]);

    expect(getProfileCatalogExchangeItem("profile-catalog-jw-stone")?.sellerName).toBe(
      "JW Stone LLC"
    );
    expect(getProfileCatalogExchangeItem("profile-catalog-issa-build")?.sellerName).toBe(
      "ISSA Build"
    );
    expect(getProfileCatalogExchangeItem("profile-catalog-unknown")).toBeNull();
  });

  it("keeps existing JW Stone inventory current while new historical identities stay cautious", () => {
    const repoRoot = path.resolve(process.cwd());
    const profileSource = fs.readFileSync(
      path.resolve(repoRoot, "client/src/pages/profile-sites/WholesalerProfileTheme.tsx"),
      "utf8"
    );
    const shareSource = fs.readFileSync(
      path.resolve(repoRoot, "shared/profileItemShare.ts"),
      "utf8"
    );
    const publicCatalogCopy = `${profileSource}\n${shareSource}`;

    expect(publicCatalogCopy).toContain("Amazonic Green · current inventory");
    expect(publicCatalogCopy).toContain("Rhino White · current inventory");
    expect(
      PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS.find(
        (spotlight) => spotlight.profileSlug === "jw-stone"
      )?.description
    ).toContain("identity is still being confirmed");
  });

  it("makes old-site reconciliation additive-only and treats current inventory as read-only", () => {
    const contract = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "docs/runbooks/JW_STONE_OLD_SITE_INVENTORY_SHEET_CONTRACT.md"
      ),
      "utf8"
    );
    const normalizedContract = contract.replace(/\s+/g, " ");

    expect(normalizedContract).toContain(
      "only to candidate slabs and bundles recovered from the old website"
    );
    expect(normalizedContract).toContain(
      "every public data change is a newly added old-site item"
    );
    expect(normalizedContract).toContain(
      "this import lane must treat those rows as read-only reference records"
    );
    expect(normalizedContract).toContain(
      "may not update, replace, reclassify, rename, hide, reorder, or delete an existing current-inventory record"
    );
  });

  it("fails closed when the backing public profile is unpublished or revoked", async () => {
    vi.spyOn(storage, "getProfileBySlugPublic").mockResolvedValue(undefined);

    await expect(
      getPublicProfileCatalogExchangeItem("profile-catalog-jw-stone")
    ).resolves.toBeNull();
  });

  it("renders catalog SSR without merchant schema, price, stock, or product framing", async () => {
    mockPublishedCatalogAuthority();

    const html = await buildPublicExchangeListingHtml({
      origin: "https://www.thetradescout.com",
      categoryParam: PROFILE_CATALOG_EXCHANGE_CATEGORY,
      listingId: "profile-catalog-jw-stone",
      templateHtml: `<!doctype html>
        <html>
          <head>
            <title>TradeScout</title>
            <meta name="description" content="" />
            <link rel="canonical" href="" />
            <meta property="og:title" content="" />
            <meta property="og:description" content="" />
            <meta property="og:url" content="" />
            <meta property="og:image" content="" />
            <meta property="og:type" content="" />
          </head>
          <body><div id="root"></div></body>
        </html>`,
    });

    expect(html).not.toBeNull();
    expect(html).toContain('content="website"');
    expect(html).toContain("submit a managed TradeScout request");
    expect(html).not.toMatch(/"@type"\s*:\s*"(?:Product|Offer)"/);
    expect(html).not.toMatch(/\$0(?:\.00)?|\bInStock\b|\bOutOfStock\b/);
  });
});
