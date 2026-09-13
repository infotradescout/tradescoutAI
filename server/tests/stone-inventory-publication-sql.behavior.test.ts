import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Execute the application's statement, not a second implementation of publication.
const service = readFileSync("server/services/stoneInventoryService.ts", "utf8");
const marker = "const inventoryUpdate = await client.query(";
const start = service.indexOf(marker);
if (start < 0) throw new Error("Inventory publication statement not found");
const statement = service.slice(start + marker.length).match(/`([^`]+)`/)?.[1];
if (!statement) throw new Error("Inventory publication SQL not found");
const publicationSql = statement;
const positionId = "a0000000-0000-4000-8000-000000000001";

describe("stone inventory publication SQL", () => {
  const database = new PGlite();
  beforeAll(async () => {
    await database.exec(`CREATE TABLE stone_inventory_positions (
      id uuid PRIMARY KEY,
      public_availability_status text NOT NULL,
      publication_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      published_at timestamptz,
      version bigint NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
  });
  beforeEach(async () => {
    await database.exec("TRUNCATE stone_inventory_positions");
    await database.query(
      "INSERT INTO stone_inventory_positions(id,public_availability_status) VALUES ($1::uuid,'private')",
      [positionId]
    );
  });
  afterAll(async () => { await database.close(); });

  it("publishes with the exact text audit actor using bound parameters", async () => {
    const actor = "synthetic-publisher-'quoted'";
    await database.query(publicationSql, [positionId, "published", true, actor, 0]);
    const { rows } = await database.query<Record<string, any>>(
      "SELECT * FROM stone_inventory_positions WHERE id=$1::uuid", [positionId]
    );
    expect(rows[0].public_availability_status).toBe("published");
    expect(rows[0].publication_evidence).toMatchObject({
      type: "seller_explicit_sale_ready", actorUserId: actor,
    });
    expect(rows[0].publication_evidence.recordedAt).toBeTruthy();
    expect(rows[0].published_at).not.toBeNull();
    expect(Number(rows[0].version)).toBe(1);
  });

  it("clears publication evidence and timing when the item is made private", async () => {
    await database.query(publicationSql, [positionId, "published", true, "synthetic-publisher", 0]);
    await database.query(publicationSql, [positionId, "private", false, "synthetic-publisher", 1]);
    const { rows } = await database.query<Record<string, any>>("SELECT * FROM stone_inventory_positions");
    expect(rows[0].public_availability_status).toBe("private");
    expect(rows[0].publication_evidence).toEqual({});
    expect(rows[0].published_at).toBeNull();
    expect(Number(rows[0].version)).toBe(2);
  });

  it("does not overwrite a row changed since the caller's version", async () => {
    await database.query(publicationSql, [positionId, "published", true, "synthetic-publisher", 7]);
    const { rows } = await database.query<Record<string, any>>("SELECT * FROM stone_inventory_positions");
    expect(rows[0].public_availability_status).toBe("private");
    expect(rows[0].publication_evidence).toEqual({});
    expect(rows[0].published_at).toBeNull();
    expect(Number(rows[0].version)).toBe(0);
  });
});
