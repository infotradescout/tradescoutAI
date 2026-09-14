import fs from "node:fs";
import ts from "typescript";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
  exchangePageWindow,
  mergeExchangeDiscoveryItems,
  readExchangeSourcePages,
} from "../exchangeDiscovery";

const source = fs.readFileSync("server/routes.ts", "utf8");
const routeSource = source.slice(
  source.indexOf("  // Exchange routes"),
  source.indexOf("  // Exchange promotions")
);
const compiled = ts.transpileModule(routeSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function routeHarness() {
  const ordinary = Array.from({ length: 230 }, (_, index) => ({
    id: `listing-${String(index).padStart(3, "0")}`,
    sellerId: index < 110 ? "unverified" : "owner",
    title: `Granite ${index}`,
    description: "Stone",
    price: index,
    categoryId: "materials-category",
    condition: "new",
    city: "Pensacola",
    county: "Escambia",
    state: "FL",
    images: ["/stone.webp"],
    createdAt: new Date(2026, 0, 1).toISOString(),
  }));
  const offers = [
    {
      id: "offer-1",
      seller_user_id: "owner",
      title: "Profile item",
      price: "10",
      metadata: { exchangeCategorySlug: "building-materials", imageUrls: ["/offer.webp"] },
      created_at: new Date(2026, 0, 2).toISOString(),
    },
  ];
  const catalog = [
    {
      id: "catalog-item",
      sourceType: "profile_catalog",
      title: "Blue Dunes",
      price: null,
      category: "building-materials",
      publicProfilePath: "/u/yard/stones/blue-dunes",
      sellerId: "owner",
    },
  ];
  const authority = vi.fn(async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, id !== "unverified"]))
  );
  const sourceOrder = (rows: any[], sort: string, offer = false) =>
    [...rows].sort((a, b) => {
      const value = (row: any) =>
        sort.startsWith("price")
          ? Number(row.price)
          : new Date(offer ? row.created_at : row.createdAt).getTime();
      const difference = value(a) - value(b);
      return (
        (sort.endsWith("asc") ? difference : -difference) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
    });
  const getMarketplaceListings = vi.fn(async (filters: any) =>
    sourceOrder(ordinary, filters.sortBy || "date_desc").slice(
      filters.offset,
      filters.offset + filters.limit
    )
  );
  const query = vi.fn(async (sql: string, params: any[]) => {
    const sort = sql.includes("ORDER BY po.price ASC")
      ? "price_asc"
      : sql.includes("ORDER BY po.price DESC")
        ? "price_desc"
        : sql.includes("ORDER BY po.created_at ASC")
          ? "date_asc"
          : "date_desc";
    return {
      rows: sourceOrder(offers, sort, true).slice(params.at(-1), params.at(-1) + params.at(-2)),
    };
  });
  const profiles = vi.fn(async () => catalog);
  const chain = { from: () => ({ where: async () => [] }) };
  const handlers = new Map<string, Function>();
  const deps = {
    app: { get: (route: string, handler: Function) => handlers.set(route, handler) },
    storage: {
      getMarketplaceCategories: async () => [
        { id: "materials-category", name: "Building Materials & Surfaces" },
      ],
      getMarketplaceListings,
    },
    pool: { query },
    db: { select: () => chain },
    users: {},
    inArray: () => true,
    buildExposureAuthorityMap: authority,
    sanitizePublicListingText: (value: any) => String(value || ""),
    listProfileOfferImageUrls: (metadata: any) => metadata.imageUrls || [],
    toPublicExchangeListing: (value: any) => value,
    listPublicProfileCatalogExchangeItems: profiles,
    exchangePageWindow,
    mergeExchangeDiscoveryItems,
    readExchangeSourcePages,
    sql,
    PgDialect,
    exposureAuthoritySqlPredicate: () => sql`true`,
  };
  new Function(...Object.keys(deps), compiled)(...Object.values(deps));
  async function request(queryParams: Record<string, unknown>) {
    let body: any;
    let status = 200;
    const res = {
      json: (value: unknown) => {
        body = value;
        return res;
      },
      status: (value: number) => {
        status = value;
        return res;
      },
    };
    await handlers.get("/api/exchange/items")!({ query: queryParams }, res);
    expect(status).toBe(200);
    return body;
  }
  return { request, ordinary, offers, catalog, getMarketplaceListings, query, profiles, authority };
}

describe("composed Exchange feed", () => {
  it("bounds default source reads and honors the requested global order before paging", async () => {
    const h = routeHarness();
    h.ordinary.forEach((row) => {
      row.sellerId = "owner";
    });
    expect(await h.request({})).toHaveLength(48);
    expect(h.getMarketplaceListings).toHaveBeenCalledTimes(1);
    expect(h.getMarketplaceListings.mock.calls[0][0]).toMatchObject({
      limit: 100,
      publicExposureOnly: true,
    });
    expect(h.getMarketplaceListings.mock.calls[0][0]).not.toHaveProperty("preferredCountyFips");
    expect(exchangePageWindow({ limit: "9999", offset: "-2" })).toEqual({ limit: 100, offset: 0 });
  });

  it.each(["date_asc", "date_desc", "price_asc", "price_desc"])(
    "keeps all rows reachable across more than 100 rows per source for %s with stable ties",
    async (sort) => {
      const h = routeHarness();
      h.ordinary.forEach((row, index) => {
        row.price = index % 11;
        row.createdAt = new Date(2026, 0, 1 + (index % 7)).toISOString();
      });
      h.offers.splice(
        0,
        h.offers.length,
        ...Array.from({ length: 215 }, (_, index) => ({
          ...h.offers[0],
          id: `offer-${String(index).padStart(3, "0")}`,
          price: String(index % 13),
          created_at: new Date(2026, 0, 1 + (index % 7)).toISOString(),
        }))
      );
      const collected: any[] = [];
      for (let offset = 0; ; offset += 48) {
        const page = await h.request({ categoryId: "building-materials", sort, offset, limit: 48 });
        collected.push(...page);
        if (page.length < 48) break;
        expect(offset).toBeLessThan(1000);
      }
      expect(collected).toHaveLength(120 + h.offers.length + h.catalog.length);
      expect(new Set(collected.map((item) => item.id)).size).toBe(collected.length);
      expect(collected.at(-1)?.id).toBe("catalog-item");
      for (let index = 1; index < collected.length - 1; index++) {
        const a = collected[index - 1],
          b = collected[index];
        const value = (item: any) =>
          sort.startsWith("price") ? item.price : new Date(item.createdAt).getTime();
        const delta = value(b) - value(a);
        expect(sort.endsWith("asc") ? delta : -delta).toBeGreaterThanOrEqual(0);
        if (delta === 0) expect(a.id < b.id).toBe(true);
      }
      expect(h.query.mock.calls.some(([, params]) => params.at(-1) >= 200)).toBe(true);
    }
  );

  it("serves ordinary Building Materials and native offers together with item projections", async () => {
    const h = routeHarness();
    const result = [
      ...(await h.request({ categoryId: "building-materials", limit: 100 })),
      ...(await h.request({ categoryId: "building-materials", offset: 100, limit: 100 })),
    ];
    expect(result.some((item: any) => item.id === "listing-110")).toBe(true);
    expect(result.some((item: any) => item.id === "profile-offer-offer-1")).toBe(true);
    expect(result.some((item: any) => item.id === "catalog-item")).toBe(true);
    expect(
      result.some(
        (item: any) => Number(item.id.split("-")[1]) < 110 && item.id.startsWith("listing")
      )
    ).toBe(false);
    expect(h.getMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "materials-category",
        status: "active",
        offset: 0,
        limit: 100,
      })
    );
    expect(h.query.mock.calls[0][0]).toContain("po.is_active = true");
    expect(h.query.mock.calls[0][0]).toContain("po.offer_type = 'item'");
    expect(h.query.mock.calls[0][0]).toContain("exchangeCategorySlug");
  });

  it("pages the unified result after authority checks, including records beyond 100", async () => {
    const h = routeHarness();
    const all = [
      ...(await h.request({ categoryId: "building-materials", sort: "date_desc", limit: 100 })),
      ...(await h.request({
        categoryId: "building-materials",
        sort: "date_desc",
        offset: 100,
        limit: 100,
      })),
    ];
    const page = await h.request({
      categoryId: "building-materials",
      sort: "date_desc",
      offset: 105,
      limit: 10,
    });
    expect(page).toEqual(all.slice(105, 115));
    expect(page).toHaveLength(10);
    expect(h.getMarketplaceListings.mock.calls.some(([filters]) => filters.offset >= 200)).toBe(
      true
    );
    const offsetOnly = await h.request({ categoryId: "building-materials", offset: 120 });
    expect(offsetOnly).toEqual(all.slice(120));
  });

  it("forwards explicit county/state and native offer filters to their owners", async () => {
    const h = routeHarness();
    await h.request({
      categoryId: "building-materials",
      search: "granite",
      filterCounty: "12033",
      filterState: "FL",
      condition: "used",
      priceMin: "25",
    });
    expect(h.getMarketplaceListings).toHaveBeenCalledWith(
      expect.objectContaining({
        county: "12033",
        state: "FL",
        searchQuery: "granite",
        condition: "used",
        priceMin: 25,
      })
    );
    expect(h.profiles).toHaveBeenCalledWith(
      expect.objectContaining({
        filterCounty: "12033",
        filterState: "FL",
        search: "granite",
        condition: "used",
        hasPriceFilter: true,
      })
    );
    expect(h.query.mock.calls[0][1]).toEqual(
      expect.arrayContaining(["used", "building-materials", 25, "%granite%", "12033", "FL"])
    );
  });

  it("removes duplicate IDs and exact catalog paths before deterministic pagination without merging names", () => {
    const catalog = {
      id: "b",
      sourceType: "profile_catalog",
      sellerId: "owner",
      publicProfilePath: "/u/yard/stones/blue",
      price: null,
    };
    const items = mergeExchangeDiscoveryItems<any>(
      [
        [{ id: "a", price: 0 }, catalog],
        [catalog, { ...catalog, id: "c" }, { ...catalog, id: "d", sellerId: "other" }],
      ],
      { sort: "price_asc" }
    );
    expect(items.map((item) => item.id)).toEqual(["a", "b", "d"]);
    expect(mergeExchangeDiscoveryItems([items], { offset: 1, limit: 1 })).toEqual([catalog]);
    expect(
      mergeExchangeDiscoveryItems<any>([[catalog, { id: "paid", price: 1 }]], {
        sort: "price_desc",
      }).map((item) => item.id)
    ).toEqual(["paid", "b"]);
  });
});
