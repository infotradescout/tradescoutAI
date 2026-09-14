import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { once } from "node:events";
import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseJwStoneReceipt } from "@shared/jwStoneReceiving";
import {
  createSyntheticReceivingDrive,
  syntheticReceivingEnvironment,
} from "../../scripts/jw-stone-drive-workflow-fixture.mjs";

// Actual media, receiving service, migration-owned SQL and public streaming.
// Only the SQL connection transport and external Drive HTTP boundary differ.
const bridge = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn() }));
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
import { receiveJwStoneArrival } from "../services/jwStoneReceivingService";
import { streamPublicObject } from "../publicMediaStorage";
import { getServerObjectStorageConfiguration } from "../serverObjectStorage";

describe("synthetic Drive with actual receiving and PostgreSQL public-media services", () => {
  const database = new PGlite();
  const target = {
    profileId: "jw-profile",
    profileSlug: "jw-stone",
    profileStatus: "published",
    ownerUserId: "owner",
    businessId: "jw-business",
    businessOwnerUserId: "owner",
  } as any;
  let drive: ReturnType<typeof createSyntheticReceivingDrive>;
  let original: Buffer;
  const input = () =>
    parseJwStoneReceipt({
      receiptId: randomUUID(),
      materialName: "Synthetic Media Granite",
      materialFamily: "granite",
      materialClass: "natural_stone",
      lotLabel: "SYNTHETIC-" + randomUUID(),
      quantity: 2,
      length: 120,
      height: 60,
      dimensionUnit: "in",
      thicknessMm: 30,
      finish: "polished",
      locationLabel: "SYNTHETIC PRIVATE RACK",
      priceUnit: "slab",
      sellPriceCents: 125000,
      bundlePriceCents: 110000,
      bundleMinSlabs: 2,
      landedCostCents: 731,
      notes: "SYNTHETIC PRIVATE NOTES",
    });
  const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  beforeAll(async () => {
    bridge.query.mockImplementation((sql, params) => database.query(sql, params));
    bridge.connect.mockImplementation(async () => ({ query: bridge.query, release() {} }));
    await database.exec(
      "CREATE TABLE businesses (id text PRIMARY KEY); CREATE TABLE users (id text PRIMARY KEY); INSERT INTO businesses VALUES ('jw-business'); INSERT INTO users VALUES ('owner'),('staff');"
    );
    for (const migration of ["0122_stone_core_schema.sql", "0127_public_media_objects.sql"])
      await database.exec(
        await readFile(new URL("../../migrations/" + migration, import.meta.url), "utf8")
      );
    original = await sharp({
      create: { width: 64, height: 32, channels: 3, background: "#6b7280" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
  });
  beforeEach(async () => {
    for (const [key, value] of Object.entries(syntheticReceivingEnvironment))
      vi.stubEnv(key, value);
    for (const key of [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      "AWS_S3_BUCKET",
      "JW_STONE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64",
      "GOOGLE_APPLICATION_CREDENTIALS",
    ])
      vi.stubEnv(key, "");
    vi.stubEnv("DATABASE_URL", "postgresql://synthetic@127.0.0.1/ts_jw_workflow_test");
    await database.exec(
      "DROP TRIGGER IF EXISTS synthetic_publication_failure ON stone_inventory_positions; TRUNCATE stone_inventory_positions, stone_asset_passports, stone_materials CASCADE; TRUNCATE public_media_objects;"
    );
    drive = createSyntheticReceivingDrive();
    vi.stubGlobal("fetch", drive.fetch);
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await database.close();
  });

  it("keeps a lost-ack receipt private, retries unchanged source IDs and streams the actual sanitized SQL bytes", async () => {
    expect(getServerObjectStorageConfiguration()?.provider).toBe("postgres-public-media");
    const receipt = input();
    await expect(receiveJwStoneArrival(target, "staff", receipt, [original])).rejects.toThrow(
      /source upload failed \(503\)/
    );
    const pending = (
      await database.query<any>(
        "SELECT ap.condition_json, ip.public_availability_status FROM stone_asset_passports ap JOIN stone_inventory_positions ip ON ip.asset_passport_id=ap.id"
      )
    ).rows;
    expect(pending).toHaveLength(1);
    expect(pending[0].public_availability_status).toBe("not_published");
    expect(pending[0].condition_json.jwReceiving.state).toBe("pending");
    const ids = pending[0].condition_json.jwReceiving.driveIds;
    expect(drive.snapshot().counts).toMatchObject({
      allocatedIds: 2,
      uploads: 2,
      lostAcknowledgements: 1,
      blockedRequests: 0,
    });
    const saved = await receiveJwStoneArrival(target, "staff", receipt, [original]);
    expect(saved).toMatchObject({ published: true, alreadySaved: false });
    expect(
      (await database.query<any>("SELECT condition_json FROM stone_asset_passports")).rows[0]
        .condition_json.jwReceiving.driveIds
    ).toEqual(ids);
    const sources = drive.snapshot().files;
    const sourcePhoto = sources.find((file: any) => file.mimeType === "image/jpeg")!;
    const manifest = sources.find((file: any) => file.mimeType === "application/json")!.manifest;
    expect(manifest.receipt).toEqual(receipt);
    expect(manifest.receivedByUserId).toBe("staff");
    expect(manifest.images[0]).toMatchObject({
      driveFileId: sourcePhoto.id,
      sha256: sourcePhoto.sha256,
    });
    const stored = (
      await database.query<any>("SELECT object_key, body, content_type FROM public_media_objects")
    ).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0].content_type).toBe("image/jpeg");
    expect(stored[0].object_key).toBe("public-media" + manifest.images[0].publicImageUrl);
    expect(digest(Buffer.from(stored[0].body))).toBe(sourcePhoto.sha256);
    const metadata = await sharp(Buffer.from(stored[0].body)).metadata();
    expect(metadata).toMatchObject({ width: 32, height: 64, format: "jpeg" });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    const output = new PassThrough() as any;
    const chunks: Buffer[] = [],
      headers: Record<string, unknown> = {};
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    output.setHeader = (name: string, value: unknown) => {
      headers[name.toLowerCase()] = value;
    };
    output.status = (value: number) => {
      output.statusCode = value;
      return output;
    };
    const finished = once(output, "end");
    expect(
      await streamPublicObject({
        req: {
          method: "GET",
          get() {
            return undefined;
          },
        } as any,
        res: output,
        key: stored[0].object_key,
      })
    ).toBe("served");
    await finished;
    expect(output.statusCode).toBe(200);
    expect(headers["content-type"]).toBe("image/jpeg");
    expect(digest(Buffer.concat(chunks))).toBe(sourcePhoto.sha256);
    expect(await receiveJwStoneArrival(target, "staff", receipt, [original])).toMatchObject({
      published: true,
      alreadySaved: true,
    });
    expect(drive.snapshot().counts).toMatchObject({
      allocatedIds: 2,
      uploads: 2,
      existingFileReads: 2,
      lostAcknowledgements: 1,
      blockedRequests: 0,
    });
    expect((await database.query("SELECT id FROM stone_inventory_positions")).rows).toHaveLength(1);
  });

  it("does not publish or duplicate sources when SQL publication fails after Drive has acknowledged them", async () => {
    const receipt = input();
    await expect(receiveJwStoneArrival(target, "staff", receipt, [original])).rejects.toThrow(
      /503/
    );
    await database.exec(`CREATE OR REPLACE FUNCTION synthetic_publication_failure_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.public_availability_status='published_current' THEN RAISE EXCEPTION 'synthetic SQL failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_publication_failure BEFORE UPDATE ON stone_inventory_positions FOR EACH ROW EXECUTE FUNCTION synthetic_publication_failure_fn();`);
    await expect(receiveJwStoneArrival(target, "staff", receipt, [original])).rejects.toThrow(
      /synthetic SQL failure/
    );
    expect(
      (
        await database.query<any>(
          "SELECT public_availability_status FROM stone_inventory_positions"
        )
      ).rows[0].public_availability_status
    ).toBe("not_published");
    await database.exec("DROP TRIGGER synthetic_publication_failure ON stone_inventory_positions");
    expect((await receiveJwStoneArrival(target, "staff", receipt, [original])).published).toBe(
      true
    );
    expect(drive.snapshot().counts).toMatchObject({
      allocatedIds: 2,
      uploads: 2,
      existingFileReads: 4,
      blockedRequests: 0,
    });
    await expect(
      receiveJwStoneArrival(target, "staff", { ...receipt, receiptId: randomUUID() }, [original])
    ).rejects.toThrow(/lot label already exists/);
    expect(drive.snapshot().counts.uploads).toBe(2);
  });

  it("rejects invalid image bytes before any source or public object write", async () => {
    await expect(
      receiveJwStoneArrival(target, "staff", input(), [Buffer.from("not an image")])
    ).rejects.toThrow(/photo could not be read/);
    expect(drive.snapshot().counts).toMatchObject({ allocatedIds: 0, uploads: 0 });
    expect((await database.query("SELECT object_key FROM public_media_objects")).rows).toHaveLength(
      0
    );
    expect((await database.query("SELECT id FROM stone_asset_passports")).rows).toHaveLength(0);
  });
});
