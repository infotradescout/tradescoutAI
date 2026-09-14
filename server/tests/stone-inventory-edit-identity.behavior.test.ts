import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
vi.mock("../db", () => ({ pool: bridge, db: {} }));
vi.mock("../services/stoneCoreProvisioning", () => ({ ensureStoneCoreTables: async () => {} }));
vi.mock("../services/bidrockService", () => ({
  assertBidRockInventoryHasNoCurrentAuction: async () => {},
  refreshBidRockListingProjection: vi.fn(),
}));
import {
  upsertCurrentStoneInventory,
  retireStoneInventory,
  type StoneInventoryProfileTarget,
} from "../services/stoneInventoryService";

const database = new PGlite();
const target = {
  profileSlug: "jw-stone",
  businessId: "jw-business",
  businessOwnerUserId: "owner",
  ownerUserId: "owner",
} as StoneInventoryProfileTarget;
const publicId = (letter: string) => `stone_${letter.repeat(32)}`;
const mutation = {
  publicId: publicId("a"),
  materialSlug: "test-stone",
  materialName: "Synthetic stone",
  materialFamily: "granite",
  materialClass: "natural_stone" as const,
  assetKind: "bundle" as const,
  quantity: 5,
  unit: "slabs",
  dimensions: {},
  finishQuantities: [],
  imageUrls: [],
  lastConfirmedAt: "2026-09-08T12:00:00.000Z",
  confirmationExpiresAt: "2026-10-08T12:00:00.000Z",
};
beforeAll(async () => {
  const query = (sql: string, params?: any[]) => database.query(sql, params);
  bridge.query.mockImplementation(query);
  bridge.connect.mockResolvedValue({ query, release: vi.fn() });
  await database.exec(`
    CREATE TABLE stone_materials(id uuid primary key,slug text,source_business_id text);
    CREATE TABLE stone_asset_passports(id uuid primary key,public_id text,source_business_id text,material_id uuid);
    CREATE TABLE stone_inventory_positions(id uuid primary key,asset_passport_id uuid,holder_business_id text,held_quantity numeric,version bigint,lifecycle_status text,
      public_availability_status text,publication_evidence jsonb,published_at timestamptz,released_at timestamptz,updated_at timestamptz);
    CREATE TABLE bidrock_listings(inventory_position_id uuid,status text);
    INSERT INTO stone_materials VALUES
      ('00000000-0000-0000-0000-000000000001','test-stone','foreign-business'),
      ('00000000-0000-0000-0000-000000000002','test-stone','jw-business');
    INSERT INTO stone_asset_passports VALUES
      ('00000000-0000-0000-0000-000000000011','${publicId("a")}','foreign-business','00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000012','${publicId("b")}','foreign-business','00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000013','${publicId("c")}','jw-business','00000000-0000-0000-0000-000000000002'),
      ('00000000-0000-0000-0000-000000000014','${publicId("d")}','jw-business','00000000-0000-0000-0000-000000000002');
    INSERT INTO stone_inventory_positions(id,asset_passport_id,holder_business_id,held_quantity,version,lifecycle_status) VALUES
      ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','foreign-business',0,1,'available'),
      ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000012','jw-business',0,1,'available'),
      ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000013','jw-business',0,1,'available'),
      ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000014','jw-business',1,1,'available');
  `);
});
afterAll(async () => database.close());
describe("existing inventory identity and custody guard with SQL", () => {
  it("rejects an actual foreign publicId on edit and retirement without touching its record", async () => {
    await expect(upsertCurrentStoneInventory(target, mutation)).rejects.toThrow(
      "Inventory position not found for this seller"
    );
    await expect(retireStoneInventory({ target, publicId: mutation.publicId })).resolves.toBe(
      false
    );
    const rows = await database.query(
      "SELECT holder_business_id,lifecycle_status,version FROM stone_inventory_positions WHERE id='00000000-0000-0000-0000-000000000021'"
    );
    expect(rows.rows[0]).toMatchObject({
      holder_business_id: "foreign-business",
      lifecycle_status: "available",
      version: 1,
    });
  });
  it("does not let custody silently replace the material's source owner", async () => {
    await expect(
      upsertCurrentStoneInventory(target, { ...mutation, publicId: publicId("b") })
    ).rejects.toThrow("Inventory source ownership does not match this seller");
  });
  it("rejects changing a passport's material identity", async () => {
    await expect(
      upsertCurrentStoneInventory(target, {
        ...mutation,
        publicId: publicId("c"),
        materialSlug: "replacement-stone",
      })
    ).rejects.toThrow("Material identity is immutable");
  });
  it("keeps reserved quantity protected from both edit and retirement", async () => {
    await expect(
      upsertCurrentStoneInventory(target, { ...mutation, publicId: publicId("d") })
    ).rejects.toThrow("Reserved inventory cannot be edited");
    await expect(retireStoneInventory({ target, publicId: publicId("d") })).resolves.toBe(false);
    const rows = await database.query(
      "SELECT held_quantity,lifecycle_status FROM stone_inventory_positions WHERE id='00000000-0000-0000-0000-000000000024'"
    );
    expect(rows.rows[0]).toMatchObject({ held_quantity: "1", lifecycle_status: "available" });
  });
});
