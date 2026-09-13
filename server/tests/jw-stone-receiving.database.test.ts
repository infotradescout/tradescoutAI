import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseJwStoneReceipt } from "@shared/jwStoneReceiving";

// Executes the actual migration and services against PGlite, with real image
// decoding. Only the cloud media boundary is replaced; no native concurrency
// or real Drive receipt is claimed by this suite.
const bridge = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
const media = vi.hoisted(() => ({
  allocateIds: vi.fn(),
  putFile: vi.fn(),
  putPublicPhoto: vi.fn(),
}));
vi.mock("../db", () => ({ pool: bridge, db: {} }));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({
    profileId: "jw-profile",
    profileSlug: "jw-stone",
    profileStatus: "published",
    ownerUserId: "owner",
    businessId: "jw-business",
    businessOwnerUserId: "owner",
  }),
}));
vi.mock("../services/jwStoneReceivingMedia", () => ({
  receivingHash: (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex"),
  createReceivingMediaSession: async () => ({ folderId: "synthetic-private-folder", ...media }),
}));
import { receiveJwStoneArrival } from "../services/jwStoneReceivingService";
import {
  getJwStoneEmployeeAccess,
  setJwStoneEmployeeAccess,
} from "../services/jwStoneEmployeeAccessService";

describe("JW receiving and employee authority on migration-owned SQL", () => {
  const database = new PGlite();
  const target = {
    profileId: "jw-profile",
    profileSlug: "jw-stone",
    profileStatus: "published",
    ownerUserId: "owner",
    businessId: "jw-business",
    businessOwnerUserId: "owner",
  } as any;
  let photo: Buffer;
  const receipt = () =>
    parseJwStoneReceipt({
      receiptId: randomUUID(),
      materialName: "Synthetic Granite",
      materialFamily: "granite",
      materialClass: "natural_stone",
      lotLabel: `TEST-${randomUUID()}`,
      quantity: 2,
      length: 120,
      height: 60,
      dimensionUnit: "in",
      thicknessMm: 30,
      finish: "polished",
      locationLabel: "PRIVATE RACK",
      priceUnit: "slab",
      sellPriceCents: 125000,
      bundlePriceCents: 110000,
      bundleMinSlabs: 2,
      landedCostCents: 100,
      notes: "PRIVATE NOTES",
    });
  beforeAll(async () => {
    bridge.query.mockImplementation((sql, params) => database.query(sql, params));
    bridge.connect.mockImplementation(async () => ({ query: bridge.query, release() {} }));
    await database.exec(`CREATE TABLE businesses (id text PRIMARY KEY);
      CREATE TABLE users (id text PRIMARY KEY, email text, first_name text, last_name text, role text, roles text[]);
      CREATE TABLE admin_audit_log (id uuid DEFAULT gen_random_uuid(), type text, admin_id text, target_user_id text, metadata jsonb);
      INSERT INTO businesses VALUES ('jw-business');
      INSERT INTO users (id,email,role,roles) VALUES ('owner','owner@example.test','business_owner','{}'),
        ('staff','staff@example.test','user','{}'), ('buyer','buyer@example.test','business_owner','{}');`);
    await database.exec(
      await readFile(
        new URL("../../migrations/0122_stone_core_schema.sql", import.meta.url),
        "utf8"
      )
    );
    photo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#6b7280" } })
      .jpeg()
      .toBuffer();
  });
  beforeEach(async () => {
    vi.stubEnv("JW_STONE_EMPLOYEE_USER_IDS", "staff");
    await database.exec(`DROP TRIGGER IF EXISTS reject_test_publication ON stone_inventory_positions;
      DROP TRIGGER IF EXISTS reject_test_audit ON admin_audit_log;
      TRUNCATE stone_inventory_positions, stone_asset_passports, stone_materials CASCADE;
      TRUNCATE stone_inventory_delegations, admin_audit_log;`);
    media.allocateIds
      .mockReset()
      .mockImplementation(async (count: number) =>
        Array.from({ length: count }, () => randomUUID())
      );
    media.putFile
      .mockReset()
      .mockImplementation(async (id: string, _name: string, mimeType: string, bytes: Buffer) => {
        const state = (
          await database.query<{ condition_json: any }>(
            "SELECT condition_json FROM stone_asset_passports"
          )
        ).rows[0].condition_json.jwReceiving;
        expect(state.state).toBe("pending");
        expect(state.driveIds).toContain(id);
        const position = (
          await database.query<{ public_availability_status: string }>(
            "SELECT public_availability_status FROM stone_inventory_positions"
          )
        ).rows[0];
        expect(position.public_availability_status).toBe("not_published");
        if (mimeType === "image/jpeg") expect((await sharp(bytes).metadata()).format).toBe("jpeg");
        if (mimeType === "application/json")
          expect(JSON.parse(bytes.toString()).receipt.landedCostCents).toBe(100);
      });
    media.putPublicPhoto
      .mockReset()
      .mockImplementation(
        async (receiptId: string) =>
          `/images/businesses/jw-stone/receiving/${receiptId}/1-${"a".repeat(20)}.jpg`
      );
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await database.close();
  });

  it("publishes one lot only after durable source IDs, normalized photos and the private manifest", async () => {
    const input = receipt();
    const saved = await receiveJwStoneArrival(target, "staff", input, [photo]);
    expect(saved).toMatchObject({ published: true, alreadySaved: false });
    const rows = (
      await database.query<any>(`SELECT ap.condition_json, ap.dimensions_json, ip.quantity, ip.public_availability_status,
      ip.publication_evidence, ap.passport_status FROM stone_asset_passports ap JOIN stone_inventory_positions ip ON ip.asset_passport_id=ap.id`)
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      quantity: "2",
      public_availability_status: "published_current",
      passport_status: "verified",
    });
    expect(rows[0].dimensions_json).toEqual({
      length: 3048,
      height: 1524,
      thickness: 30,
      unit: "mm",
    });
    expect(rows[0].condition_json.jwReceiving.state).toBe("published");
    expect(rows[0].publication_evidence.actorUserId).toBe("staff");
    expect(media.putFile).toHaveBeenCalledTimes(2);
    expect(await receiveJwStoneArrival(target, "staff", input, [photo])).toMatchObject({
      published: true,
      alreadySaved: true,
    });
    expect(media.putFile).toHaveBeenCalledTimes(2);
    await expect(
      receiveJwStoneArrival(target, "staff", { ...input, quantity: 3 }, [photo])
    ).rejects.toThrow(/different details/);
  });
  it("rolls publication back after a database failure and safely retries the durable draft", async () => {
    await database.exec(`CREATE OR REPLACE FUNCTION reject_test_publication_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.public_availability_status='published_current' THEN RAISE EXCEPTION 'synthetic publication failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_test_publication BEFORE UPDATE ON stone_inventory_positions FOR EACH ROW EXECUTE FUNCTION reject_test_publication_fn();`);
    const input = receipt();
    await expect(receiveJwStoneArrival(target, "staff", input, [photo])).rejects.toThrow(
      /synthetic publication failure/
    );
    const pending = (
      await database.query<any>("SELECT passport_status, condition_json FROM stone_asset_passports")
    ).rows[0];
    expect(pending.passport_status).toBe("draft");
    expect(pending.condition_json.jwReceiving.state).toBe("pending");
    const ids = pending.condition_json.jwReceiving.driveIds;
    await database.exec("DROP TRIGGER reject_test_publication ON stone_inventory_positions");
    expect((await receiveJwStoneArrival(target, "staff", input, [photo])).published).toBe(true);
    const restored = (await database.query<any>("SELECT condition_json FROM stone_asset_passports"))
      .rows;
    expect(restored).toHaveLength(1);
    expect(restored[0].condition_json.jwReceiving.driveIds).toEqual(ids);
    expect(media.allocateIds).toHaveBeenCalledTimes(1);
  });
  it("denies duplicate lot labels under different submission IDs without another cloud write", async () => {
    const input = receipt();
    await receiveJwStoneArrival(target, "staff", input, [photo]);
    await expect(
      receiveJwStoneArrival(target, "staff", { ...input, receiptId: randomUUID() }, [photo])
    ).rejects.toThrow(/lot label already exists/);
    expect(media.putFile).toHaveBeenCalledTimes(2);
  });
  it("grants, revises and revokes exact staff authority independently of buyer membership", async () => {
    expect((await getJwStoneEmployeeAccess({ id: "buyer", role: "business_owner" })).allowed).toBe(
      false
    );
    const granted = await setJwStoneEmployeeAccess(
      { id: "owner" },
      { userId: "staff", allowed: true, expectedRevision: null }
    );
    expect(granted.account.allowed).toBe(true);
    expect((await getJwStoneEmployeeAccess({ id: "staff" })).allowed).toBe(true);
    await expect(
      setJwStoneEmployeeAccess(
        { id: "owner" },
        { userId: "staff", allowed: false, expectedRevision: null }
      )
    ).rejects.toThrow(/permissions changed/);
    const revoked = await setJwStoneEmployeeAccess(
      { id: "owner" },
      { userId: "staff", allowed: false, expectedRevision: granted.account.revision }
    );
    expect(revoked.account.allowed).toBe(false);
    expect((await getJwStoneEmployeeAccess({ id: "staff" })).allowed).toBe(false);
    expect((await database.query("SELECT * FROM admin_audit_log")).rows).toHaveLength(2);
    await expect(
      setJwStoneEmployeeAccess(
        { id: "buyer" },
        { userId: "staff", allowed: true, expectedRevision: revoked.account.revision }
      )
    ).rejects.toThrow(/Only the JW Stone/);
  });
  it("rolls back a new grant if its mandatory audit cannot be stored", async () => {
    vi.stubEnv("JW_STONE_EMPLOYEE_USER_IDS", "");
    await database.exec(`CREATE OR REPLACE FUNCTION reject_test_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'synthetic audit failure'; END $$;
      CREATE TRIGGER reject_test_audit BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION reject_test_audit_fn();`);
    await expect(
      setJwStoneEmployeeAccess(
        { id: "owner" },
        { userId: "staff", allowed: true, expectedRevision: null }
      )
    ).rejects.toThrow(/synthetic audit failure/);
    expect((await database.query("SELECT * FROM stone_inventory_delegations")).rows).toHaveLength(
      0
    );
    expect((await getJwStoneEmployeeAccess({ id: "staff" })).allowed).toBe(false);
  });
});
