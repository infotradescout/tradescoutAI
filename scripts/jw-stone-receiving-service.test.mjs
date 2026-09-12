// Service tests use mocked PostgreSQL, image decoding and storage, not live integrations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as shared from "../shared/jwStoneReceiving.ts";

const source = stripTypeScriptTypes(await readFile(new URL("../server/services/jwStoneReceivingService.ts", import.meta.url), "utf8"));
const target = { profileSlug: "jw-stone", businessId: "test-jw-business", businessOwnerUserId: "test-owner" };
const receipt = shared.parseJwStoneReceipt({ receiptId: "d6f3fb18-33ec-4d87-9d6c-a5298fa8e47a", materialName: "Test Granite", materialFamily: "granite", materialClass: "natural_stone", lotLabel: "TEST-001", quantity: 2, length: 120, height: 60, dimensionUnit: "in", thicknessMm: 30, finish: "polished", locationLabel: "Test rack", priceUnit: "square_foot", sellPriceCents: 1250, bundlePriceCents: null, bundleMinSlabs: null, landedCostCents: 700, notes: "TEST ONLY" });
const photos = [Buffer.from("MOCK IMAGE: decoder is stubbed")];
const constants = {
  STONE_CURRENT_INVENTORY_AVAILABLE_STATUS: "available",
  STONE_CURRENT_INVENTORY_FRESHNESS_DAYS: 45,
  STONE_CURRENT_INVENTORY_PRIVATE_STATUS: "not_published",
  STONE_CURRENT_INVENTORY_PUBLIC_STATUS: "published_current",
  STONE_CURRENT_INVENTORY_VERIFIED_STATUS: "verified",
};
async function harness(options = {}) {
  const log = [];
  let condition, published = false, savedTransaction;
  let rowsCreated = 0, failUpload = options.failUpload || false;
  let mediaCalls = 0;
  const client = {
    async query(sql, params = []) {
      log.push(sql);
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: !options.lockBusy }] };
      if (sql.includes("pg_advisory_unlock")) return { rows: [{ pg_advisory_unlock: true }] };
      if (sql === "BEGIN") { savedTransaction = { condition: structuredClone(condition), published, rowsCreated }; return { rows: [] }; }
      if (sql === "COMMIT") { savedTransaction = undefined; return { rows: [] }; }
      if (sql === "ROLLBACK") { if (savedTransaction) ({ condition, published, rowsCreated } = savedTransaction); return { rows: [] }; }
      if (sql.includes("AS published")) return { rows: condition ? [{ id: "test-passport", condition_json: structuredClone(condition), published }] : [] };
      if (sql.includes("lower(ap.condition_json")) return { rows: options.duplicate ? [{ public_id: "existing" }] : [] };
      if (sql.startsWith("INSERT INTO stone_materials")) return { rows: [] };
      if (sql.startsWith("SELECT id, material_class")) return { rows: [{ id: "test-material", material_class: "natural_stone", material_family: options.wrongFamily ? "marble" : "granite" }] };
      if (sql.startsWith("INSERT INTO stone_asset_passports")) { condition = JSON.parse(params[7]); rowsCreated += 1; return { rows: [{ id: "test-passport" }] }; }
      if (sql.startsWith("INSERT INTO stone_inventory_positions")) return { rows: [], rowCount: 1 };
      if (sql.includes("jsonb_set(condition_json")) { condition.jwReceiving = JSON.parse(params[1]); return { rows: [], rowCount: 1 }; }
      if (sql.startsWith("UPDATE stone_asset_passports SET condition_json = $2")) { condition = JSON.parse(params[1]); return { rows: [{ id: "test-passport" }] }; }
      if (sql.startsWith("UPDATE stone_inventory_positions")) { if (options.failPublication) return { rows: [] }; published = true; return { rows: [{ id: "test-position" }] }; }
      throw new Error(`Unexpected mock SQL: ${sql}`);
    },
    release(destroy) { log.push(`release:${destroy}`); },
  };
  const context = createContext({ Buffer, console, process: { env: { JW_STONE_EMPLOYEE_USER_IDS: "test-employee" } } });
  const image = { metadata: async () => ({ format: options.badImage ? "svg" : "jpeg" }), rotate() { return this; }, resize() { return this; }, jpeg() { return this; }, toBuffer: async () => Buffer.from("MOCK SANITIZED JPEG") };
  const deps = {
    sharp: { default: () => image },
    "../db": { pool: { connect: async () => client } },
    "./stoneCoreProvisioning": { ensureStoneCoreTables: async () => {} },
    "./stoneInventoryService": { getStoneInventoryProfileTarget: async () => options.noTarget ? null : target },
    "./jwStoneReceivingMedia": {
      receivingHash: value => createHash("sha256").update(value).digest("hex"),
      createReceivingMediaSession: async () => {
        mediaCalls += 1;
        return {
          folderId: "test-private-source-folder",
          allocateIds: async count => { log.push("allocate"); return Array.from({ length: count }, (_, i) => `test-drive-${i}`); },
          putFile: async (id, name, mime, bytes) => {
            assert.equal(condition.jwReceiving.driveIds.length, 2, "IDs are durable before any upload");
            assert.equal(published, false, "no publication before source uploads");
            log.push(`drive:${id}:${mime}`);
            if (failUpload) { failUpload = false; throw new Error("MOCK Drive outage"); }
            if (mime === "application/json") assert.equal(JSON.parse(bytes.toString()).receipt.landedCostCents, 700);
          },
          putPublicPhoto: async () => { assert.equal(published, false); log.push("public-photo"); return `/images/businesses/jw-stone/receiving/${receipt.receiptId}/1-0123456789abcdef0123.jpg`; },
        };
      },
    },
    "@shared/jwStoneReceiving": shared,
    "@shared/stoneInventory": constants,
  };
  const module = new SourceTextModule(source, { context });
  await module.link(async specifier => {
    const exports = deps[specifier];
    if (!exports) throw new Error(`Unexpected import ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return { service: module.namespace, log, get condition() { return condition; }, get published() { return published; }, get rowsCreated() { return rowsCreated; }, get mediaCalls() { return mediaCalls; } };
}

test("only assigned employee IDs, JW business owner, and platform super-admins have receiving access", async () => {
  const h = await harness();
  for (const user of [{ id: "test-employee" }, { id: "test-owner" }, { id: "test-admin", role: "super_admin" }]) assert.equal((await h.service.jwStoneEmployeeTarget(user))?.businessId, target.businessId);
  for (const user of [undefined, { id: "business-member", role: "business_member", isEmployee: true }, { id: "test", role: "employee" }, { id: "other-owner", role: "business_owner" }]) assert.equal(await h.service.jwStoneEmployeeTarget(user), null);
});
test("missing JW business linkage denies even an administrator", async () => {
  const h = await harness({ noTarget: true });
  assert.equal(await h.service.jwStoneEmployeeTarget({ id: "test-admin", isSuperAdmin: true }), null);
});
test("publication occurs only after private receipt and public photos are saved", async () => {
  const h = await harness();
  const result = await h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos);
  assert.equal(result.published, true); assert.equal(h.rowsCreated, 1);
  assert.equal(h.condition.jwReceiving.actorUserId, "test-employee");
  assert.equal(h.condition.showAsNewArrival, true);
  assert.ok(h.log.findIndex(line => line.endsWith(":application/json")) < h.log.findIndex(line => line.startsWith("UPDATE stone_inventory_positions")));
  assert.equal(h.log.at(-1), "release:false");
});
test("a lost success response can be retried without new inventory or uploads", async () => {
  const h = await harness();
  await h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos);
  const result = await h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos);
  assert.equal(result.alreadySaved, true); assert.equal(result.published, true);
  assert.equal(h.rowsCreated, 1); assert.equal(h.mediaCalls, 1);
});
test("changed payload under the same receipt ID is rejected", async () => {
  const h = await harness();
  await h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos);
  await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", { ...receipt, quantity: 3 }, photos), /different details/);
  assert.equal(h.rowsCreated, 1);
});
test("Drive failure leaves a private draft, and same-submission retry resumes it", async () => {
  const h = await harness({ failUpload: true });
  await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos), /MOCK Drive outage/);
  assert.equal(h.published, false); assert.equal(h.condition.jwReceiving.state, "pending");
  const ids = [...h.condition.jwReceiving.driveIds];
  const result = await h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos);
  assert.equal(result.published, true); assert.equal(h.rowsCreated, 1);
  assert.deepEqual([...h.condition.jwReceiving.driveIds], ids);
  assert.equal(h.log.filter(line => line === "allocate").length, 1);
});
test("failed final inventory update rolls publication back to the private draft", async () => {
  const h = await harness({ failPublication: true });
  await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos), /cannot be published/);
  assert.equal(h.published, false); assert.equal(h.condition.jwReceiving.state, "pending");
  assert.ok(h.log.includes("ROLLBACK")); assert.equal(h.log.at(-1), "release:false");
});
test("simultaneous receipt lock contention does not create stock", async () => {
  const h = await harness({ lockBusy: true });
  await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos), /already being saved/);
  assert.equal(h.rowsCreated, 0); assert.equal(h.mediaCalls, 0); assert.equal(h.log.at(-1), "release:false");
});
test("duplicate labels and conflicting material identities never create another record", async () => {
  for (const options of [{ duplicate: true }, { wrongFamily: true }]) {
    const h = await harness(options);
    await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos), error => error instanceof shared.JwStoneReceivingInputError && /already exists|different material type/.test(error.message));
    assert.equal(h.rowsCreated, 0); assert.equal(h.published, false);
  }
});
test("bad images, empty photo sets, and other business targets fail before writing", async () => {
  const h = await harness({ badImage: true });
  await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", receipt, photos), /photo could not be read/);
  await assert.rejects(h.service.receiveJwStoneArrival(target, "test-employee", receipt, []), /one and eight/);
  await assert.rejects(h.service.receiveJwStoneArrival({ ...target, profileSlug: "other" }, "test-employee", receipt, photos), /JW Stone employee access/);
  assert.equal(h.rowsCreated, 0); assert.equal(h.log.length, 0);
});
