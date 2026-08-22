import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import { JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION } from "@shared/stoneInventory";
import { importJwStoneConfirmedStock } from "../services/jwStoneConfirmedStock";

const connectionString = String(process.env.BIDROCK_TEST_DATABASE_URL || "").trim();
const safeDisposableTarget = /(?:localhost|127\.0\.0\.1|test)/i.test(connectionString);
const describeWithPostgres = connectionString && safeDisposableTarget ? describe : describe.skip;

if (connectionString && !safeDisposableTarget) {
  describe("BidRock disposable PostgreSQL guard", () => {
    it("refuses a target that is not recognizably local or test-only", () => {
      expect(safeDisposableTarget).toBe(true);
    });
  });
}

describeWithPostgres("BidRock disposable PostgreSQL concurrency", () => {
  let databasePool: Pool;

  beforeAll(() => {
    databasePool = new Pool({ connectionString, max: 4 });
  });

  afterAll(async () => {
    await databasePool?.end();
  });

  it("upgrades a legacy /u-only profile_accounts source-path constraint", async () => {
    const client = await databasePool.connect();
    const schema = `bidrock_profile_upgrade_${Date.now()}`;
    try {
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}, public`);
      await client.query(`
        CREATE TABLE users (id TEXT PRIMARY KEY);
        CREATE TABLE businesses (id TEXT PRIMARY KEY);
        CREATE TABLE profiles (id TEXT PRIMARY KEY);
        CREATE TABLE user_profiles (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_intent TEXT NOT NULL,
          verification_status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE TABLE profile_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_user_id TEXT NOT NULL REFERENCES users(id),
          business_profile_id TEXT REFERENCES user_profiles(id),
          target_profile_id TEXT NOT NULL REFERENCES profiles(id),
          target_business_id TEXT REFERENCES businesses(id),
          identity_kind TEXT NOT NULL,
          priority_key TEXT NOT NULL DEFAULT 'profile_account',
          status TEXT NOT NULL DEFAULT 'active',
          verification_status TEXT NOT NULL DEFAULT 'not_required',
          source_path TEXT,
          resume_path TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (owner_user_id, target_profile_id),
          CONSTRAINT legacy_profile_source_path_check
            CHECK (source_path IS NULL OR source_path ~ '^/u/')
        );
        INSERT INTO users(id) VALUES ('upgrade-user');
        INSERT INTO profiles(id) VALUES ('upgrade-profile');
        INSERT INTO profile_accounts (
          owner_user_id, target_profile_id, identity_kind, source_path
        ) VALUES ('upgrade-user', 'upgrade-profile', 'user', '/u/jw-stone');
      `);
      const migration = fs.readFileSync(
        path.resolve(process.cwd(), "migrations/0123_profile_accounts_and_entitlements.sql"),
        "utf8"
      );
      await client.query(migration);
      const constraints = await client.query(
        `SELECT conname, convalidated
           FROM pg_constraint
          WHERE conrelid = 'profile_accounts'::regclass AND contype = 'c'`
      );
      expect(constraints.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            conname: "profile_accounts_source_path_safe_check",
            convalidated: true,
          }),
        ])
      );
      expect(
        constraints.rows.some((row) => row.conname === "legacy_profile_source_path_check")
      ).toBe(false);
      await client.query(`UPDATE profile_accounts SET source_path = '/jw-stone'`);
      await client.query(`UPDATE profile_accounts SET source_path = '/bidrock'`);
      await expect(
        client.query(`UPDATE profile_accounts SET source_path = '//unsafe.example'`)
      ).rejects.toThrow();
    } finally {
      await client.query(`SET search_path TO public`);
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      client.release();
    }
  }, 30_000);

  it("imports concurrently without duplicate passports or positions", async () => {
    await Promise.all([
      importJwStoneConfirmedStock({ databasePool }),
      importJwStoneConfirmedStock({ databasePool }),
    ]);
    await importJwStoneConfirmedStock({ databasePool });

    const result = await databasePool.query(
      `SELECT count(DISTINCT passport.id)::int AS passports,
                count(DISTINCT inventory.id)::int AS positions,
                count(*) FILTER (
                  WHERE inventory.public_availability_status = 'published_current'
                )::int AS buyer_visible
           FROM stone_asset_passports passport
           INNER JOIN stone_inventory_positions inventory
             ON inventory.asset_passport_id = passport.id
          WHERE passport.source_asset_ref LIKE $1`,
      [`${JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION}:%`]
    );

    expect(result.rows[0]).toMatchObject({ passports: 7, positions: 7, buyer_visible: 0 });
  }, 30_000);

  it("serializes competing full-quantity holds without oversubscription", async () => {
    const target = await databasePool.query(
      `SELECT inventory.id, inventory.quantity
           FROM stone_asset_passports passport
           INNER JOIN stone_inventory_positions inventory
             ON inventory.asset_passport_id = passport.id
          WHERE passport.source_asset_ref LIKE $1
          ORDER BY passport.source_asset_ref
          LIMIT 1`,
      [`${JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION}:%`]
    );
    expect(target.rows[0]).toBeTruthy();
    const inventoryId = target.rows[0].id;
    const quantity = Number(target.rows[0].quantity);
    await databasePool.query(
      `UPDATE stone_inventory_positions SET held_quantity = 0 WHERE id = $1::uuid`,
      [inventoryId]
    );

    const attemptHold = async () => {
      const client = await databasePool.connect();
      try {
        await client.query("BEGIN");
        const held = await client.query(
          `UPDATE stone_inventory_positions
                SET held_quantity = held_quantity + $2
              WHERE id = $1::uuid AND quantity - held_quantity >= $2
              RETURNING id`,
          [inventoryId, quantity]
        );
        await client.query("COMMIT");
        return held.rowCount;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };

    const outcomes = await Promise.all([attemptHold(), attemptHold()]);
    expect(outcomes.sort()).toEqual([0, 1]);
    const held = await databasePool.query(
      `SELECT quantity, held_quantity FROM stone_inventory_positions WHERE id = $1::uuid`,
      [inventoryId]
    );
    expect(Number(held.rows[0].held_quantity)).toBe(Number(held.rows[0].quantity));
    await databasePool.query(
      `UPDATE stone_inventory_positions SET held_quantity = 0 WHERE id = $1::uuid`,
      [inventoryId]
    );
  }, 30_000);
});
