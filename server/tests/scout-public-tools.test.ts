import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { marketplaceListings } from "@shared/schema";
import { lookupScoutPublicTools } from "../scout/scoutPublicTools";
import { MarketplaceAndHomeScoutStorageRepository } from "../storage/repositories/marketplace-and-homescout";
import type { IStorage } from "../storage/contracts";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../db", () => ({
  get db() {
    return state.db;
  },
  pool: {},
}));
vi.mock("../storage", () => ({ storage: {} }));

const database = new PGlite();
const repository = new MarketplaceAndHomeScoutStorageRepository();
const category = { id: "tools-category", name: "Tools & Hardware", isActive: true };
const source = {
  getMarketplaceCategories: vi.fn(async () => [category]),
  getMarketplaceListings: repository.getMarketplaceListings.bind(repository),
} as unknown as Pick<IStorage, "getMarketplaceCategories" | "getMarketplaceListings">;

async function insertListing(input: {
  id: string;
  title: string;
  description?: string;
  county?: string;
  state?: string;
  sellerId?: string;
  categoryId?: string;
  status?: string;
  approvedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
}) {
  await database.query(
    `INSERT INTO marketplace_listings
      (id,seller_id,category_id,title,description,price,county,state,status,condition,
       approved_at,expires_at,created_at)
     VALUES ($1,$2,$3,$4,$5,45,$6,$7,$8,'good',$9,$10,$11)`,
    [
      input.id,
      input.sellerId ?? "owner",
      input.categoryId ?? "tools-category",
      input.title,
      input.description ?? "Public tool listing",
      input.county ?? "Maricopa County",
      input.state ?? "AZ",
      input.status ?? "active",
      input.approvedAt === undefined ? "2024-01-01" : input.approvedAt,
      input.expiresAt ?? null,
      input.createdAt ?? "2024-01-01",
    ]
  );
}

beforeAll(async () => {
  const columns = Object.values(getTableColumns(marketplaceListings))
    .map((column) => `"${column.name}" ${column.getSQLType()}`)
    .join(",");
  await database.exec(`CREATE TABLE marketplace_listings(${columns});
    CREATE TABLE users(id varchar PRIMARY KEY, email_verified boolean, address_verified boolean, verification_status varchar);
    CREATE TABLE business_verifications(provider_user_id varchar, verification_type varchar, status varchar, expires_at timestamp);
    INSERT INTO users VALUES('owner',true,true,'approved'),('hidden-owner',false,true,'approved');`);
  state.db = drizzle(database);

  await insertListing({
    id: "fips-tool",
    title: "Electrical drill",
    county: "04013",
    createdAt: "2024-01-01",
  });
  await insertListing({
    id: "full-tool",
    title: "Compact driver",
    description: "Electrical driver. Email seller@example.com or call 602-555-0123.",
    county: "Maricopa County",
    createdAt: "2025-03-01",
  });
  await insertListing({
    id: "short-tool",
    title: "Electrical meter",
    county: "Maricopa",
    createdAt: "2025-02-01",
  });
  await insertListing({ id: "other-county", title: "Electrical saw", county: "Pinal County", createdAt: "2026-01-01" });
  await insertListing({ id: "other-state", title: "Electrical saw", state: "NM", createdAt: "2026-01-02" });
  await insertListing({ id: "pending", title: "Electrical saw", status: "pending_approval", createdAt: "2026-01-03" });
  await insertListing({ id: "unapproved", title: "Electrical saw", approvedAt: null, createdAt: "2026-01-04" });
  await insertListing({ id: "expired", title: "Electrical saw", expiresAt: "2025-01-01", createdAt: "2026-01-05" });
  await insertListing({ id: "hidden-seller", title: "Electrical saw", sellerId: "hidden-owner", createdAt: "2026-01-06" });
  await insertListing({ id: "wrong-category", title: "Electrical saw", categoryId: "electronics", createdAt: "2026-01-07" });
  await insertListing({ id: "substring", title: "Photoelectrical meter", createdAt: "2026-01-08" });
  for (let index = 0; index < 12; index++) {
    await insertListing({
      id: `newer-wrong-county-${index}`,
      title: "Electrical drill",
      county: "Pinal County",
      createdAt: `2026-02-${String(index + 1).padStart(2, "0")}`,
    });
  }
});

afterAll(async () => {
  await database.close();
});

describe("Scout public Tools & Hardware source", () => {
  it("returns only approved exposed active county tools, matching title or description by whole words", async () => {
    const result = await lookupScoutPublicTools({ countyFips: "04013", topic: "electrical", limit: 8 }, source);
    expect(result.status).toBe("checked");
    expect(result.items.map((item) => item.id)).toEqual(["full-tool", "short-tool", "fips-tool"]);
    expect(result.items.map((item) => item.topicMatchSource)).toEqual([
      "description",
      "title",
      "title",
    ]);
    expect(result.items.every((item) => item.countyFips === "04013" && item.state === "AZ")).toBe(true);
    expect(result.items[0]).toMatchObject({
      detailPath: "/exchange/tools/full-tool",
      county: "Maricopa County",
      createdAt: "2025-03-01T00:00:00.000Z",
    });
    expect(JSON.stringify(result.items[0])).not.toMatch(/seller@example\.com|602-555-0123|sellerId|latitude|zipCode/i);
    expect(result.items[0].description).toContain("Continue through TradeScout");
    expect(JSON.stringify(result.items)).not.toContain("this week");
  });

  it("applies county, state, topic, approval, expiry and seller gates before LIMIT", async () => {
    const result = await lookupScoutPublicTools({ countyFips: "04013", topic: "electrical", limit: 1 }, source);
    expect(result).toMatchObject({ status: "checked", items: [{ id: "full-tool" }] });
    expect(result.items).toHaveLength(1);
    const unrelated = await lookupScoutPublicTools({ countyFips: "04013", topic: "plumbing", limit: 1 }, source);
    expect(unrelated).toEqual({ status: "checked", items: [] });
  });

  it("distinguishes invalid area and source/category failure from a checked empty result", async () => {
    expect(await lookupScoutPublicTools({ countyFips: "99999" }, source)).toEqual({
      status: "area_unavailable",
      items: [],
      reason: "invalid_county",
    });
    const noCategory = {
      ...source,
      getMarketplaceCategories: vi.fn(async () => []),
    } as unknown as Pick<IStorage, "getMarketplaceCategories" | "getMarketplaceListings">;
    expect(await lookupScoutPublicTools({ countyFips: "04013" }, noCategory)).toEqual({
      status: "error",
      items: [],
      reason: "category_unavailable",
    });
    const failedSource = {
      ...source,
      getMarketplaceListings: vi.fn(async () => {
        throw new Error("synthetic source fault");
      }),
    } as unknown as Pick<IStorage, "getMarketplaceCategories" | "getMarketplaceListings">;
    expect(await lookupScoutPublicTools({ countyFips: "04013" }, failedSource)).toEqual({
      status: "error",
      items: [],
      reason: "source_unavailable",
    });
  });
});
