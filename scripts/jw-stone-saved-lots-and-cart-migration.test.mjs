// Actual contracts/stores; mocked storage ports and route dependencies. No live writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import * as cart from "../shared/jwStoneCart.ts";
import * as pricing from "../shared/jwStoneMemberPricing.ts";
import * as saved from "../client/src/features/jw-stone/jwStoneSavedLotsStore.ts";
const root = new URL("../", import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const id = n => `stone_${n.toString(16).padStart(32, "0")}`;
const lot = n => ({ id: id(n), stoneName: `Test stone ${n}` });
const lines = n => Array.from({ length: n }, (_, i) => ({ ...lot(i + 1), stoneKey: pricing.jwStonePriceKey(lot(i + 1).stoneName), inventoryPublicId: id(i + 1), quantity: i + 1 }));
function storage(initial = {}) {
  const map = new Map(Object.entries(initial)); let badRead = false, badWrite = false;
  return { map, getItem(key) { if (badRead) throw new Error("Read blocked"); return map.get(key) ?? null; }, setItem(key, value) { if (badWrite) throw new Error("Quota exceeded"); map.set(key, value); }, failRead(value = true) { badRead = value; }, failWrite(value = true) { badWrite = value; } };
}
async function load(path, deps) {
  const context = createContext({ console, Date, Set, Map });
  const module = new SourceTextModule(stripTypeScriptTypes(await readFile(new URL(path, root), "utf8")), { context });
  await module.link(async specifier => {
    const exports = deps[specifier]; if (!exports) throw new Error(`Unexpected dependency ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate(); return module.namespace;
}
const stores = await load("client/src/features/jw-stone/jwStoneCartStore.ts", { "../../../../shared/jwStoneCart": cart, "../../../../shared/jwStoneMemberPricing": pricing });

const draft = n => ({ ...lot(n), stoneKey: pricing.jwStonePriceKey(lot(n).stoneName), inventoryPublicId: id(n) });
test("canonical v1 and v2 arrays retain all 100 selections without writing on restore", () => {
  for (const prefix of [stores.JW_STONE_LEGACY_CART_STORAGE_PREFIX, stores.JW_STONE_CART_STORAGE_PREFIX]) {
    const raw = JSON.stringify(lines(100).map(line => ({ ...line, slabRateCents: 123, landedCostCents: 99 })));
    const port = storage({ [prefix + "member-a"]: raw }); const store = stores.createJwStoneCartStore(port, "member-a");
    assert.equal(store.getSnapshot().lines.length, 100); assert.equal(store.getSnapshot().lines.at(-1).id, id(100));
    assert.equal(port.map.size, 1); assert.equal(port.map.get(prefix + "member-a"), raw);
    assert.ok(!JSON.stringify(store.getSnapshot().lines).includes("Cents"));
  }
});
test("account envelope lots retain exact inventory IDs while catalog estimates stay unselected", () => {
  const value = { version: 2, viewerId: "member-a", lines: [{ ...lot(1), kind: "lot", quantity: 1 }, { ...lot(2), kind: "catalog", quantity: 2, slabRateCents: 100 }] };
  const store = stores.createJwStoneCartStore(storage({ [stores.JW_STONE_CART_STORAGE_PREFIX + "member-a"]: JSON.stringify(value) }), "member-a");
  assert.equal(store.getSnapshot().lines[0].id, id(1)); assert.equal(store.getSnapshot().lines[0].inventoryPublicId, id(1));
  assert.equal(store.getSnapshot().lines[1].id, id(2)); assert.equal(store.getSnapshot().lines[1].inventoryPublicId, undefined);
  assert.ok(!JSON.stringify(store.getSnapshot().lines).includes("Cents"));
});
test("legacy catalog IDs resembling a lot never acquire stock authority", () => {
  const legacy = [{ ...lot(1), stoneKey: pricing.jwStonePriceKey(lot(1).stoneName), quantity: 1 }];
  const store = stores.createJwStoneCartStore(storage({ [stores.JW_STONE_LEGACY_CART_STORAGE_PREFIX + "member-a"]: JSON.stringify(legacy) }), "member-a");
  assert.equal(store.getSnapshot().lines[0].inventoryPublicId, undefined);
});
test("the request boundary remains limited to 50 even with 100 stored selections", () => {
  assert.equal(cart.restoreJwStoneCart(lines(100)).length, 100);
  assert.equal(cart.jwStoneCartReviewRequestSchema.safeParse({ lines: lines(51).map(line => ({ inventoryPublicId: line.inventoryPublicId, quantity: 1 })) }).success, false);
});
test("adding an already-saved line preserves every overflow selection", () => {
  const store = stores.createJwStoneCartStore(storage({ [stores.JW_STONE_CART_STORAGE_PREFIX + "a"]: JSON.stringify(lines(100)) }), "a");
  store.add(draft(100)); assert.equal(store.getSnapshot().lines.length, 100); assert.equal(store.getSnapshot().lines.at(-1).quantity, 101);
  assert.throws(() => store.add(draft(101)), /100.*preserved/);
});
test("quantity corrections, stock changes and removals leave other overflow lines intact", () => {
  const store = stores.createJwStoneCartStore(storage({ [stores.JW_STONE_CART_STORAGE_PREFIX + "a"]: JSON.stringify(lines(100)) }), "a");
  store.setQuantity(id(75), 2); store.setStock(id(75), id(105));
  assert.equal(store.getSnapshot().lines.length, 100); assert.equal(store.getSnapshot().lines[74].quantity, 2); assert.equal(store.getSnapshot().lines[74].inventoryPublicId, id(105));
  store.setQuantity(id(1), 0); assert.equal(store.getSnapshot().lines.length, 99); assert.equal(store.getSnapshot().lines.at(-1).id, id(100));
});
test("batch paging covers the complete saved cart exactly once", () => {
  const source = lines(100), first = stores.jwStoneCartBatch(source, 0), second = stores.jwStoneCartBatch(source, 1);
  assert.equal(first.pages, 2); assert.equal(second.start, 50); assert.deepEqual([...first.lines, ...second.lines], source);
});
test("page indexes clamp safely after removals and for invalid inputs", () => {
  assert.equal(stores.jwStoneCartBatch(lines(49), 1).page, 0);
  for (const value of [NaN, Infinity, -2, 1.5]) assert.equal(stores.jwStoneCartBatch(lines(100), value).page, 0);
  assert.equal(stores.jwStoneCartBatch([], 9).lines.length, 0);
});
test("legacy migration survives modification, reload and intentional clear without deleting the old key", () => {
  const port = storage({ [stores.JW_STONE_LEGACY_CART_STORAGE_PREFIX + "member-a"]: JSON.stringify(lines(100)) });
  const store = stores.createJwStoneCartStore(port, "member-a"); store.setQuantity(id(100), 9);
  const restored = stores.createJwStoneCartStore(port, "member-a");
  assert.equal(restored.getSnapshot().lines.length, 100); assert.equal(restored.getSnapshot().lines.at(-1).quantity, 9);
  restored.clear(); assert.equal(stores.createJwStoneCartStore(port, "member-a").getSnapshot().lines.length, 0);
  assert.ok(port.map.has(stores.JW_STONE_LEGACY_CART_STORAGE_PREFIX + "member-a"));
});
test("cart storage never copies another account's selections", () => {
  const port = storage(), a = stores.createJwStoneCartStore(port, "member-a"), b = stores.createJwStoneCartStore(port, "member-b");
  a.add(draft(1)); b.refresh(); assert.equal(b.getSnapshot().lines.length, 0); assert.equal(port.map.has(stores.JW_STONE_CART_STORAGE_PREFIX + "member-b"), false);
});
test("unreadable, future-version and wrong-account carts are not overwritten by edits", () => {
  const key = stores.JW_STONE_CART_STORAGE_PREFIX + "member-a";
  for (const text of ['{"version":9,"lines":[]}', '{"version":2,"viewerId":"other","lines":[]}', "{broken"]) {
    const port = storage({ [key]: text }), store = stores.createJwStoneCartStore(port, "member-a"); store.add(draft(1));
    assert.equal(store.getSnapshot().persisted, false); assert.equal(port.map.get(key), text); assert.equal(store.getSnapshot().lines.length, 1);
  }
});
test("cart quota failure retains the full overflow cart in memory", () => {
  const port = storage({ [stores.JW_STONE_LEGACY_CART_STORAGE_PREFIX + "member-a"]: JSON.stringify(lines(100)) });
  const store = stores.createJwStoneCartStore(port, "member-a"); port.failWrite(); store.setQuantity(id(1), 8); store.refresh();
  assert.equal(store.getSnapshot().lines.length, 100); assert.equal(store.getSnapshot().persisted, false); assert.equal(store.getSnapshot().lines[0].quantity, 8);
});
test("recovered reads never replace the saved cart with edits made while it was unreadable", () => {
  const key = stores.JW_STONE_CART_STORAGE_PREFIX + "member-a", original = JSON.stringify(lines(1));
  const port = storage({ [key]: original }); port.failRead();
  const store = stores.createJwStoneCartStore(port, "member-a"); store.add(draft(2)); port.failRead(false); store.add(draft(3)); store.refresh();
  assert.equal(port.map.get(key), original); assert.equal(store.getSnapshot().persisted, false);
  assert.deepEqual(plain(store.getSnapshot().lines.map(line => line.id)), [id(2), id(3)]);
});
test("valid saved lots strip every private and volatile property", () => {
  assert.deepEqual(saved.savedJwStoneLot({ id: id(1), materialName: "Test stone", sellPriceCents: 123, landedCostCents: 456, quantity: 8, imageUrls: ["https://example.invalid"], locationLabel: "private rack", notes: "internal" }), { id: id(1), stoneName: "Test stone" });
});
test("saved-lot validation rejects catalog IDs, path injection, and control characters", () => {
  for (const value of [null, "stone", {}, { ...lot(1), id: "catalog-stone" }, { ...lot(1), id: "../secret" }, { ...lot(1), stoneName: "Name\nInjected" }, { ...lot(1), stoneName: "" }, { ...lot(1), stoneName: "x".repeat(161) }]) assert.equal(saved.savedJwStoneLot(value), null);
});
test("normalization is bounded and distinguishes different lots of the same stone", () => {
  assert.equal(saved.normalizeJwStoneSavedLots([lot(1), lot(1), { ...lot(2), stoneName: lot(1).stoneName }]).length, 2);
  assert.equal(saved.normalizeJwStoneSavedLots(lines(100)).length, 50);
});
test("save, reload, remove, and clear retain only explicit public references", () => {
  const port = storage(); const store = saved.createJwStoneSavedLotsStore(port);
  assert.equal(store.getSnapshot().restored, false); store.refresh(); store.toggle(lot(1)); store.toggle(lot(2));
  const again = saved.createJwStoneSavedLotsStore(port); again.refresh(); assert.equal(again.getSnapshot().lots.length, 2);
  again.remove(id(1)); assert.deepEqual(again.getSnapshot().lots, [lot(2)]);
  again.clear(); assert.deepEqual(JSON.parse(port.map.get(saved.JW_STONE_SAVED_LOTS_KEY)), { version: 1, lots: [] });
});
test("same-page listeners update with stable snapshots and unsubscribe", () => {
  const store = saved.createJwStoneSavedLotsStore(storage()); store.refresh();
  const first = store.getSnapshot(); assert.equal(store.getSnapshot(), first);
  let calls = 0; const stop = store.subscribe(() => calls++);
  store.toggle(lot(1)); assert.equal(calls, 1); stop(); store.toggle(lot(2)); assert.equal(calls, 1);
});
test("sequential tab changes read the latest saved list rather than stale initial state", () => {
  const port = storage(); const a = saved.createJwStoneSavedLotsStore(port), b = saved.createJwStoneSavedLotsStore(port);
  a.refresh(); b.refresh(); a.toggle(lot(1)); b.toggle(lot(2)); a.refresh();
  assert.deepEqual(a.getSnapshot().lots, [lot(1), lot(2)]);
});
test("browser storage clear is reflected without resaving old favorites", () => {
  const port = storage(); const store = saved.createJwStoneSavedLotsStore(port); store.toggle(lot(1));
  port.map.clear(); store.refresh(); assert.equal(store.getSnapshot().lots.length, 0); assert.equal(port.map.size, 0);
});
test("saved lot capacity is visible and does not evict an earlier favorite", () => {
  const store = saved.createJwStoneSavedLotsStore(storage());
  for (let i = 1; i <= 50; i++) store.toggle(lot(i));
  store.toggle(lot(51)); assert.equal(store.getSnapshot().lots.length, 50); assert.match(store.getSnapshot().notice, /50/);
  store.toggle(lot(1)); store.toggle(lot(51)); assert.equal(store.getSnapshot().lots.at(-1).id, id(51));
});
test("quota failure preserves visible favorites and reports non-durable edits", () => {
  const port = storage(); const store = saved.createJwStoneSavedLotsStore(port); store.toggle(lot(1));
  port.failWrite(); store.toggle(lot(2)); store.refresh();
  assert.equal(store.getSnapshot().persisted, false); assert.equal(store.getSnapshot().lots.length, 2);
  assert.match(store.getSnapshot().notice, /visit only/);
  assert.equal(JSON.parse(port.map.get(saved.JW_STONE_SAVED_LOTS_KEY)).lots.length, 1);
});
test("a failed clear does not resurrect favorites during the same visit", () => {
  const port = storage(); const store = saved.createJwStoneSavedLotsStore(port); store.toggle(lot(1)); port.failWrite(); store.clear(); store.refresh();
  assert.equal(store.getSnapshot().lots.length, 0); assert.equal(store.getSnapshot().persisted, false);
});
test("future and malformed saved-lot envelopes are not destructively replaced", () => {
  for (const text of ["{broken", '{"version":2,"lots":[]}']) {
    const port = storage({ [saved.JW_STONE_SAVED_LOTS_KEY]: text }); const store = saved.createJwStoneSavedLotsStore(port);
    store.refresh(); store.toggle(lot(1)); assert.equal(port.map.get(saved.JW_STONE_SAVED_LOTS_KEY), text); assert.equal(store.getSnapshot().persisted, false);
  }
});
test("missing storage still supports a clearly non-persistent saved list", () => {
  const store = saved.createJwStoneSavedLotsStore(null); store.refresh(); store.toggle(lot(1));
  assert.deepEqual(store.getSnapshot().lots, [lot(1)]); assert.equal(store.getSnapshot().persisted, false);
});
test("inventory-check failure differs from a missing public listing", () => {
  assert.equal(saved.jwStoneSavedLotStatus(id(1), null), "unknown");
  assert.equal(saved.jwStoneSavedLotStatus(id(1), new Set()), "not_listed");
  assert.equal(saved.jwStoneSavedLotStatus(id(1), new Set([id(1)])), "listed");
});
test("a lot inquiry retains its exact ID without claiming a reservation or quoting stored prices", () => {
  const text = saved.jwStoneLotInquiry({ ...lot(1), sellPriceCents: 99999 });
  assert.ok(text.includes(id(1))); assert.ok(text.includes(lot(1).stoneName)); assert.ok(!text.includes("99999"));
  assert.throws(() => saved.jwStoneLotInquiry({ id: "catalog", stoneName: "Test" }));
});

async function routes(options = {}) {
  const registrations = new Map(); const calls = [];
  const publicItems = [{ id: id(1), materialName: "Public test lot", quantity: 2 }];
  const fakeMulter = Object.assign(() => ({ array: () => () => {} }), { memoryStorage: () => ({}) });
  const middleware = () => {};
  const target = { businessId: "jw-business", profileSlug: "jw-stone" };
  const mod = await load("server/routes/jw-stone-receiving.ts", {
    "./jw-stone-employee-access": { registerJwStoneEmployeeAccessRoutes: () => {} },
    "../services/jwStoneEmployeeAccessService": { getJwStoneEmployeeAccess: async () => ({ allowed: false, canManageStaff: false, target: null }) },
    "../publicMediaStorage": { streamPublicObject: async () => "served" },
    "../services/stoneNewArrivalsService": { listPublicStoneNewArrivals: async () => { calls.push("arrivals"); return []; } },
    "@shared/stoneInventory": { STONE_CURRENT_INVENTORY_FRESHNESS_DAYS: 45 },
    "../utils/multipartUpload": { default: fakeMulter }, "express-rate-limit": { default: () => middleware }, "../auth": { isAuthenticated: middleware },
    "../db": { pool: { query: async () => { throw new Error("Unexpected private SQL on public inventory route"); } } },
    "../schemaPreflight": { requireCriticalSchema: () => middleware },
    "./profiles": { getPublicProfileTrustContext: async () => options.noProfile ? null : ({ businessId: options.mismatch ? "other-business" : "jw-business" }) },
    "../services/stoneInventoryService": { getStoneInventoryProfileTarget: async () => options.noTarget ? null : target, listPublicCurrentStoneInventory: async () => { calls.push("current"); if (options.failure) throw new Error("Database unavailable"); return publicItems; } },
    "../services/jwStonePricingAccess": { resolveJwStonePricingAccess: async () => "none" },
    "../services/jwStoneReceivingMedia": { receivingConfigured: () => false },
    "../services/jwStoneReceivingService": { jwStoneEmployeeTarget: async () => null, receivingUserId: () => "visitor", receiveJwStoneArrival: async () => {}, JwStoneReceivingConflict: class extends Error {} },
    "@shared/jwStoneReceiving": { JW_STONE_RECEIVING_MAX_PHOTOS: 8, JW_STONE_RECEIVING_MAX_PHOTO_BYTES: 10e6, JwStoneReceivingInputError: class extends Error {}, parseJwStoneReceipt: () => {}, jwStoneReceiptMemberPrice: () => {}, jwStoneReceivingPhotoKey: () => null },
  });
  const register = (paths, ...handlers) => { for (const path of Array.isArray(paths) ? paths : [paths]) registrations.set(path, handlers.at(-1)); };
  mod.registerJwStoneReceivingRoutes({ get: register, head: () => {}, post: () => {} });
  return { calls, async request(suffix) {
    const path = `/api/u/jw-stone/receiving/${suffix}`; const headers = {}; let status = 200, body;
    const res = { setHeader(key, value) { headers[key] = value; }, vary() {}, status(value) { status = value; return this; }, json(value) { body = value; return this; } };
    await registrations.get(path)({ path, user: {} }, res);
    return { status, headers, body: plain(body) };
  } };
}
test("saved-lot inventory reads all public current stock, not only New Arrivals", async () => {
  const h = await routes(); const result = await h.request("inventory");
  assert.equal(result.status, 200); assert.equal(result.body.items[0].id, id(1)); assert.deepEqual(h.calls, ["current"]);
});
test("New Arrivals retains its explicit merchandising subset", async () => {
  const h = await routes(); const result = await h.request("arrivals");
  assert.equal(result.status, 200); assert.deepEqual(result.body.items, []); assert.deepEqual(h.calls, ["arrivals"]);
});
test("public inventory refresh forbids browser and CDN caching", async () => {
  const h = await routes(); const result = await h.request("inventory");
  assert.equal(result.headers["Cache-Control"], "no-store"); assert.equal(result.headers["CDN-Cache-Control"], "no-store");
});
test("public inventory fails closed for missing or mismatched JW business linkage", async () => {
  for (const options of [{ noProfile: true }, { noTarget: true }, { mismatch: true }]) {
    const h = await routes(options); assert.equal((await h.request("inventory")).status, 404); assert.deepEqual(h.calls, []);
  }
});
test("a failed public inventory read is a 503, never a successful empty stock list", async () => {
  const h = await routes({ failure: true }); const result = await h.request("inventory");
  assert.equal(result.status, 503); assert.equal(result.body.items, undefined);
});
test("public lot browsing does not confer member-price or employee-receipt access", async () => {
  const h = await routes(); assert.equal((await h.request("prices")).status, 403); assert.equal((await h.request("receipts")).status, 403);
});
