import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { marketplaceListings } from "@shared/schema";
import { MarketplaceAndHomeScoutStorageRepository } from "../storage/repositories/marketplace-and-homescout";
import { mergeExchangeDiscoveryItems, readExchangeSourcePages } from "../exchangeDiscovery";

const state = vi.hoisted(() => ({ db: undefined as any }));
vi.mock("../db", () => ({
  get db() {
    return state.db;
  },
  pool: {},
}));
vi.mock("../storage", () => ({ storage: {} }));
const database = new PGlite();
const repository = new MarketplaceAndHomeScoutStorageRepository();
const statements: string[] = [];

beforeAll(async () => {
  const columns = Object.values(getTableColumns(marketplaceListings))
    .map((column) => `"${column.name}" ${column.getSQLType()}`)
    .join(",");
  await database.exec(`CREATE TABLE marketplace_listings(${columns});
    CREATE TABLE users(id varchar PRIMARY KEY, email_verified boolean, address_verified boolean, verification_status varchar);
    CREATE TABLE business_verifications(provider_user_id varchar, verification_type varchar, status varchar, expires_at timestamp);
    INSERT INTO users VALUES('owner',true,true,'approved'),('hidden-owner',false,true,'approved');
    INSERT INTO marketplace_listings(id,seller_id,status,price,created_at)
      SELECT 'undated-' || lpad(i::text,3,'0'),'owner','active',i,NULL FROM generate_series(1,120) i;
    INSERT INTO marketplace_listings(id,seller_id,status,price,created_at)
      SELECT 'dated-' || lpad(i::text,3,'0'),'owner','active',i,'2026-01-01'::timestamp + (i % 7)*interval '1 day' FROM generate_series(1,120) i;
    INSERT INTO marketplace_listings(id,seller_id,status,price,created_at)
      SELECT 'hidden-' || lpad(i::text,3,'0'),'hidden-owner','active',i,NULL FROM generate_series(1,110) i;`);
  state.db = drizzle(database, {
    logger: {
      logQuery(query: string) {
        statements.push(query);
      },
    },
  });
});
afterAll(async () => {
  await database.close();
});

describe("Exchange source ordering in PostgreSQL", () => {
  it.each(["date_desc", "date_asc", "price_desc", "price_asc"] as const)(
    "traverses nullable native records once with the real repository for %s",
    async (sort) => {
      const catalog = { id: "catalog-item", createdAt: null, price: null };
      const collected: any[] = [];
      for (let offset = 0; offset < 500; offset += 48) {
        const rows = await readExchangeSourcePages(async (sourceOffset, limit) => {
          const items = await repository.getMarketplaceListings({
            status: "active",
            publicExposureOnly: true,
            sortBy: sort,
            offset: sourceOffset,
            limit,
          });
          return { items, sourceCount: items.length };
        }, offset + 48);
        const page = mergeExchangeDiscoveryItems<any>([rows, [catalog]], {
          sort,
          offset,
          limit: 48,
        });
        collected.push(...page);
        if (page.length < 48) break;
      }
      const key = sort.startsWith("date") ? "created_at" : "price";
      const direction = sort.endsWith("asc") ? "ASC" : "DESC";
      const expected = await database.query<{ id: string }>(`
        SELECT id FROM (
          SELECT id,created_at,price FROM marketplace_listings WHERE seller_id='owner'
          UNION ALL SELECT 'catalog-item',NULL::timestamp,NULL::numeric
        ) items ORDER BY ${key} ${direction} NULLS LAST, id COLLATE "C" ASC`);
      expect(collected.map((row) => row.id)).toEqual(expected.rows.map((row) => row.id));
      expect(new Set(collected.map((row) => row.id)).size).toBe(241);
      expect(
        statements.some((query) => query.includes("NULLS LAST") && query.includes('COLLATE "C"'))
      ).toBe(true);
    }
  );

  it("leaves other repository consumers' null order and exposure behavior unchanged", async () => {
    const [row] = await repository.getMarketplaceListings({ sortBy: "date_desc", limit: 1 });
    expect(row.createdAt).toBeNull();
    expect(row.sellerId).toBe("hidden-owner");
    expect(statements.at(-1)).not.toContain("NULLS LAST");
    expect(statements.at(-1)).not.toContain("business_verifications");
  });
});
