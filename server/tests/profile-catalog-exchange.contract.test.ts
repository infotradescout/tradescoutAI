import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileRepository } from "../repositories/profileRepository";
import {
  listPublicProfileCatalogExchangeItems,
  getPublicProfileCatalogExchangeItem,
  projectProfileInventoryExchangeItems,
} from "../profileCatalogExchange";
import { inventoryCategoriesForProfile } from "../profileItemShareMetadata";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import { isProfileInventoryItemPubliclyAddressable } from "../profileSitemapDiscovery";
import { buildExposureAuthorityMap } from "../services/exposureAuthority";
import {
  OWNER_CONFIRMED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
} from "@shared/publicProfileExposureRegistry";
import {
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
} from "@shared/steelHomePackagesProfile";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  select: vi.fn(),
  discovery: vi.fn(),
  owner: vi.fn(),
  users: vi.fn(),
  verification: vi.fn(),
}));
vi.mock("../db", () => ({ pool: { query: mocks.query }, db: { select: mocks.select } }));
vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugForDiscovery: mocks.discovery,
    getProfileOwnerUserId: mocks.owner,
    getUsersByIds: mocks.users,
    getUserVerificationSummary: mocks.verification,
  },
}));

const profile = (overrides: Record<string, unknown> = {}) => ({
  id: "profile-1",
  slug: "stone-yard",
  displayName: "Stone Yard",
  status: "published",
  publiclyReleased: true,
  roleContext: "business_owner",
  businessId: "business-1",
  profileOwnerUserId: "owner-1",
  businessOwnerUserId: "owner-1",
  businessStatus: "active",
  ownerVerificationStatus: "approved",
  ownerVerifiedBadge: false,
  ownerEmailVerified: false,
  ownerRole: "business_owner",
  ownerRoles: ["business_owner"],
  publicDiscoveryEnabled: true,
  ownerCity: "Pensacola",
  ownerState: "FL",
  updatedAt: new Date("2026-01-01"),
  contentBlocks: [
    {
      type: "publicDiscovery",
      data: { routes: { inventory: "stones" }, sitemap: { inventory: true } },
    },
    {
      type: "inventoryCatalog",
      data: {
        exchangeCategorySlug: "building-materials",
        categories: [
          {
            category: "Granite",
            categorySlug: "granite",
            stones: [
              {
                name: "Blue Dunes",
                slug: "blue-dunes",
                images: ["/images/blue-dunes.webp"],
                publicSummary: "Blue Dunes granite.",
              },
            ],
          },
        ],
      },
    },
  ],
  ...overrides,
});

let row: ReturnType<typeof profile>;
const repository = new ProfileRepository();
beforeEach(() => {
  vi.resetAllMocks();
  row = profile();
  const chain: any = {};
  for (const method of ["from", "innerJoin", "leftJoin", "where"]) chain[method] = () => chain;
  chain.limit = vi.fn(async () => (row ? [row] : []));
  mocks.select.mockReturnValue(chain);
  mocks.query.mockResolvedValue({ rows: [{ slug: row.slug }] });
  mocks.discovery.mockImplementation((slug) => repository.getProfileBySlugForDiscovery(slug));
  mocks.owner.mockResolvedValue("owner-1");
  mocks.users.mockResolvedValue([
    {
      id: "owner-1",
      emailVerified: false,
      addressVerified: true,
      verificationStatus: "approved",
      stateCode: "FL",
      state: "Florida",
      countyFips: "12033",
      county: "Escambia",
    },
  ]);
  mocks.verification.mockResolvedValue({});
});

describe("profile inventory Exchange discovery", () => {
  it("uses the real repository policy for released approved discovery, distinct from sale eligibility", async () => {
    const [item] = await listPublicProfileCatalogExchangeItems({ category: "building-materials" });
    expect(item).toMatchObject({
      title: "Blue Dunes",
      sellerId: "owner-1",
      sellerName: "Stone Yard",
      price: null,
      pricingMode: "request_quote",
      publicProfilePath: "/u/stone-yard/stones/blue-dunes",
      profileItemSlug: "blue-dunes",
      images: ["/images/blue-dunes.webp"],
      specifications: { material: "Granite", commerceMode: "request_only" },
      contactAccess: { mode: "managed_profile_request" },
    });
    expect(await getPublicProfileCatalogExchangeItem(item.id)).toEqual(item);
    for (const field of [
      "createdAt",
      "updatedAt",
      "condition",
      "views",
      "viewCount",
      "stock",
      "stockQuantity",
      "shippingCost",
      "phone",
      "email",
    ])
      expect(item).not.toHaveProperty(field);
    expect(item.seller).not.toHaveProperty("rating");
    expect(await buildExposureAuthorityMap(["owner-1"])).toEqual({ "owner-1": false });
  });

  it.each([
    ["private release", { publiclyReleased: false }],
    ["direct only", { publicDiscoveryEnabled: false }],
    ["unknown discovery", { publicDiscoveryEnabled: null }],
    ["inactive business", { businessStatus: "inactive" }],
    ["owner mismatch", { businessOwnerUserId: "different" }],
    ["unapproved owner", { ownerVerificationStatus: "pending" }],
    ["suspended owner", { ownerVerificationStatus: "suspended", ownerVerifiedBadge: true }],
    ["internal profile", { roleContext: "super_admin" }],
    ["professional approval missing", { roleContext: "realtor", professionalRoleApproved: false }],
    [
      "registered direct profile",
      {
        slug: JRS_PROFILE_SLUG,
        publicDiscoveryEnabled: false,
        businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
      },
    ],
    [
      "unlisted Steel Home review",
      {
        slug: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
        ownerRole: "super_admin",
        ownerRoles: ["super_admin"],
        ownerPreferences: { profileVisibility: "public", publicProfileIds: ["profile-1"] },
        businessStatus: "draft",
        publicDiscoveryEnabled: false,
        businessClaimStatus: "unclaimed",
        businessSources: [STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE],
      },
    ],
  ])("denies %s in feed and exact item lookup", async (_name, overrides) => {
    row = profile(overrides as Record<string, unknown>);
    expect(await listPublicProfileCatalogExchangeItems()).toEqual([]);
    expect(
      await getPublicProfileCatalogExchangeItem(`profile-catalog-item:${row.slug}:blue-dunes`)
    ).toBeNull();
  });

  it("requires a real published repository row, current owner, and successful authoritative read", async () => {
    row = undefined as any;
    expect(await listPublicProfileCatalogExchangeItems()).toEqual([]);
    row = profile();
    mocks.owner.mockResolvedValue(null);
    expect(await listPublicProfileCatalogExchangeItems()).toEqual([]);
    mocks.discovery.mockRejectedValue(new Error("database unavailable"));
    await expect(listPublicProfileCatalogExchangeItems()).rejects.toThrow("database unavailable");
    await expect(
      getPublicProfileCatalogExchangeItem("profile-catalog-item:stone-yard:blue-dunes")
    ).rejects.toThrow("database unavailable");
  });

  it("matches name, owner and material, filters geography, and never pretends catalog items have a price/condition", async () => {
    for (const search of ["Blue Dunes", "Stone Yard", "granite"])
      expect(await listPublicProfileCatalogExchangeItems({ search })).toHaveLength(1);
    expect(await listPublicProfileCatalogExchangeItems({ search: "marble" })).toEqual([]);
    expect(
      await listPublicProfileCatalogExchangeItems({ filterState: "FL", filterCounty: "12033" })
    ).toHaveLength(1);
    expect(await listPublicProfileCatalogExchangeItems({ filterState: "Louisiana" })).toEqual([]);
    expect(await listPublicProfileCatalogExchangeItems({ filterCounty: "99999" })).toEqual([]);
    expect(await listPublicProfileCatalogExchangeItems({ hasPriceFilter: true })).toEqual([]);
    expect(await listPublicProfileCatalogExchangeItems({ condition: "new" })).toEqual([]);
    expect(await listPublicProfileCatalogExchangeItems({ category: "tools" })).toEqual([]);
  });

  it("projects current canonical JW items once with their exact profile route and photos", () => {
    const jw = profile({ slug: "jw-stone", displayName: "JW Stone LLC" });
    const source = listProfileInventoryItems(
      inventoryCategoriesForProfile("jw-stone", jw.contentBlocks)
    ).filter((item) => isProfileInventoryItemPubliclyAddressable(jw.contentBlocks, item));
    const items = projectProfileInventoryExchangeItems(jw as any, "owner-1");
    expect(items.length).toBeGreaterThan(100);
    expect(items).toHaveLength(source.length);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const original of source) {
      const item = items.find((item) => item.profileItemSlug === original.slug)!;
      expect(item.images).toEqual(original.images);
      expect(item.title).toBe(original.hasPublicName ? original.name : "Material selection");
      expect(item.publicProfilePath).toBe(`/u/jw-stone/stones/${original.slug}`);
    }
    expect(items.some((item) => /Trending Selection \d/.test(item.title))).toBe(false);
  });

  it("keeps malformed, duplicate and nonaddressable items out; honors current lead images", () => {
    const source = profile();
    const inventory: any = source.contentBlocks[1];
    inventory.data.leadImageBySlug = { "blue-dunes": "/images/second.webp" };
    const stone = inventory.data.categories[0].stones[0];
    stone.images.push("/images/second.webp");
    inventory.data.categories[0].stones.push(stone, {
      name: "Bad",
      slug: "bad",
      images: ["javascript:alert(1)"],
    });
    const [item] = projectProfileInventoryExchangeItems(source as any, "owner-1");
    expect(projectProfileInventoryExchangeItems(source as any, "owner-1")).toHaveLength(1);
    expect(item.images[0]).toBe("/images/second.webp");
    expect(source.contentBlocks[1]).toBe(inventory);
  });

  it("keeps the early public-profile asset router from replacing the canonical Exchange feed", () => {
    const source = fs.readFileSync("server/routes/public-profile-app.ts", "utf8");
    expect(source).not.toContain('app.get("/api/exchange/items"');
    expect(source).not.toContain("res.json =");
    expect(source).toContain("getPublicProfileCatalogExchangeItem(req.params.id)");
  });
});
