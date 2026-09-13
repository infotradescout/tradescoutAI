import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as cart from "../shared/jwStoneCart.ts";
import * as pricing from "../shared/jwStoneMemberPricing.ts";
const root = new URL("../", import.meta.url);
async function load(path, dependencies) {
  const context = createContext({ console, Date, Map, Set, JSON, Number, Object, String, Error });
  const source = stripTypeScriptTypes(await readFile(new URL(path, root), "utf8"));
  const module = new SourceTextModule(source, { context });
  await module.link(async name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`);
    const values = dependencies[name];
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return module.namespace;
}
const clone = value => JSON.parse(JSON.stringify(value));
const ID = "stone_" + "a".repeat(32), SECOND = "stone_" + "b".repeat(32);
const intent = [{ inventoryPublicId: ID, quantity: 2 }];
const stock = { publicId: ID, materialName: "Test Granite", materialSlug: "test-granite", assetKind: "bundle", unit: "slabs", quantity: 8, heldQuantity: 2, saleReady: true, dimensions: { length: 120, height: 60, unit: "in" }, rate: { unit: "square_foot", sellPriceCents: 1250, bundlePriceCents: 1000, bundleMinSlabs: 6 } };
function review(patch = {}, requested = intent) { return cart.reviewJwStoneCart("member-a", requested, [{ ...stock, ...patch }]); }
test("a lot is priced from measured face area and whole slab quantity", () => { const r = review(); assert.equal(r.subtotalCents, 125000); assert.equal(r.lines[0].oneSlabTotalCents, 62500); });
test("millimeters produce the same price as inches", () => assert.equal(review({ dimensions: { length: 3048, height: 1524, unit: "mm" } }).subtotalCents, review().subtotalCents));
test("per-slab rates are not multiplied by square footage", () => assert.equal(review({ rate: { unit: "slab", sellPriceCents: 120000 }, dimensions: null }).subtotalCents, 240000));
test("bundle threshold is applied to this lot only", () => { const r = review({}, [{ inventoryPublicId: ID, quantity: 6 }]); assert.equal(r.subtotalCents, 300000); assert.equal(r.lines[0].pricingTier, "bundle"); });
test("below-threshold quantities use the slab rate", () => assert.equal(review({}, [{ inventoryPublicId: ID, quantity: 5 }]).subtotalCents, 312500));
test("held stock is subtracted before quantity approval", () => { const r = review({}, [{ inventoryPublicId: ID, quantity: 7 }]); assert.equal(r.lines[0].availableQuantity, 6); assert.equal(r.lines[0].status, "insufficient_quantity"); assert.equal(r.subtotalCents, null); });
test("fractional inventory requires slab confirmation and corrupt counts fail closed", () => { assert.equal(review({ quantity: 2.9, heldQuantity: 1 }).lines[0].status, "slab_quantity_required"); for (const n of [-1, NaN, Infinity]) assert.equal(review({ heldQuantity: n }).lines[0].status, "unavailable"); });
test("unpublished or removed stock exposes no private descriptors", () => { const r = review({ saleReady: false }); assert.equal(r.lines[0].status, "unavailable"); assert.equal(r.lines[0].materialName, undefined); });
test("missing price does not create a partial subtotal", () => { const r = cart.reviewJwStoneCart("a", [...intent, { inventoryPublicId: SECOND, quantity: 1 }], [stock, { ...stock, publicId: SECOND, rate: null }]); assert.equal(r.lines[0].status, "ready"); assert.equal(r.subtotalCents, null); assert.equal(r.materialReady, false); });
test("unknown dimensions and unknown units never default to inches", () => { for (const dimensions of [null, {}, { length: 120, height: 60 }, { length: 120, height: 60, unit: "cm" }, { length: Infinity, height: 60, unit: "in" }]) assert.equal(review({ dimensions }).lines[0].status, "dimensions_required"); });
test("containers, pieces and non-slab units cannot be priced as slab counts", () => { for (const patch of [{ assetKind: "container" }, { assetKind: "piece" }, { unit: "square_feet" }]) assert.equal(review(patch).lines[0].status, "slab_quantity_required"); });
test("invalid monetary values and broken bundle rates fail closed", () => { for (const value of [0, -1, 12.5, NaN, 10000001]) assert.equal(review({ rate: { unit: "slab", sellPriceCents: value } }).lines[0].status, "price_unavailable"); assert.equal(review({ rate: { unit: "slab", sellPriceCents: 10, bundleMinSlabs: 2 } }).lines[0].status, "price_unavailable"); });
test("review is not a payment or reservation promise", () => { const r = review(); assert.equal(r.materialReady, true); assert.equal(r.readyForCheckout, false); assert.equal(r.inventoryReserved, false); });
test("review projection excludes costs, notes and rack data", () => { const r = review({ landedCostCents: 123, notes: "PRIVATE", locationLabel: "SECRET", rate: { ...stock.rate, landedCostCents: 999 } }); assert.ok(!JSON.stringify(r).includes("PRIVATE")); assert.ok(!JSON.stringify(r).includes("landedCost")); assert.ok(!JSON.stringify(r).includes("location")); });
test("duplicate browser rows combine against the same physical stock limit", () => { const r = review({}, [...intent, ...intent, ...intent, ...intent]); assert.equal(r.lines.length, 1); assert.equal(r.lines[0].requestedQuantity, 8); assert.equal(r.lines[0].status, "insufficient_quantity"); });
test("invalid input shape and injected prices are rejected", () => { for (const body of [null, {}, { lines: [] }, { lines: intent, price: 1 }, { lines: [{ ...intent[0], sellPriceCents: 1 }] }, { lines: [{ inventoryPublicId: "catalog", quantity: 1 }] }]) assert.throws(() => cart.jwStoneCartReviewRequestSchema.parse(body)); });
test("requested counts must be integers from 1 to 999", () => { for (const quantity of [0, -1, 1.5, 1000, "2", null, NaN, Infinity]) assert.throws(() => cart.jwStoneCartReviewRequestSchema.parse({ lines: [{ inventoryPublicId: ID, quantity }] })); });
test("stored intent strips stale estimates and private fields while retaining exact stock selection", () => {
  const line = cart.restoreJwStoneCart([{ id: "stock:" + ID, inventoryPublicId: ID, stoneName: "Test", stoneKey: "test", quantity: 2, landedCostCents: 1, slabRateCents: 2, minimumTotalCents: 3 }])[0];
  assert.deepEqual(line, { id: "stock:" + ID, inventoryPublicId: ID, stoneName: "Test", stoneKey: "test", quantity: 2 });
});
test("legacy estimate IDs never imply physical inventory", () => {
  const line = cart.restoreJwStoneCart([{ id: ID, stoneName: "Test", stoneKey: "test", quantity: 1, slabRateCents: 1 }])[0];
  assert.equal(line.inventoryPublicId, undefined); assert.equal(line.slabRateCents, undefined);
});
function memory() { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; }
const storeModule = await load("client/src/features/jw-stone/jwStoneCartStore.ts", { "../../../../shared/jwStoneCart": cart, "../../../../shared/jwStoneMemberPricing": pricing });
test("account carts remain isolated; initial restore does not overwrite", () => { const m = memory(), a = storeModule.createJwStoneCartStore(m, "a"), b = storeModule.createJwStoneCartStore(m, "b"); a.add({ id: ID, inventoryPublicId: ID, stoneKey: "a", stoneName: "A" }); assert.equal(b.getSnapshot().lines.length, 0); assert.equal(storeModule.createJwStoneCartStore(m, "a").getSnapshot().lines.length, 1); });
test("stored payload must match the signed-in account identifier", () => { const m = memory(); m.setItem(storeModule.JW_STONE_CART_STORAGE_PREFIX + "a", JSON.stringify({ version: 2, viewerId: "b", lines: [{ id: ID, kind: "lot", stoneName: "Private", quantity: 1 }] })); assert.equal(storeModule.createJwStoneCartStore(m, "a").getSnapshot().lines.length, 0); });
test("cart clearing cannot resurrect legacy estimates", () => { const m = memory(); m.setItem(storeModule.JW_STONE_LEGACY_CART_STORAGE_PREFIX + "a", JSON.stringify([{ id: "old", stoneName: "Old", stoneKey: "old", quantity: 1, slabRateCents: 100 }])); const a = storeModule.createJwStoneCartStore(m, "a"); assert.equal(a.getSnapshot().lines.length, 1); a.clear(); assert.equal(storeModule.createJwStoneCartStore(m, "a").getSnapshot().lines.length, 0); });
test("sequential edits from two tabs rebase on latest stored state", () => { const m = memory(), a = storeModule.createJwStoneCartStore(m, "a"), b = storeModule.createJwStoneCartStore(m, "a"); a.add({ id: ID, inventoryPublicId: ID, stoneKey: "one", stoneName: "One" }); b.add({ id: SECOND, inventoryPublicId: SECOND, stoneKey: "two", stoneName: "Two" }); a.refresh(); assert.equal(a.getSnapshot().lines.length, 2); b.clear(); a.refresh(); assert.equal(a.getSnapshot().lines.length, 0); });
test("storage failures retain in-memory edits and report them as unpersisted", () => { const m = memory(); m.setItem = () => { throw new Error("quota"); }; const a = storeModule.createJwStoneCartStore(m, "a"); a.add({ id: ID, inventoryPublicId: ID, stoneKey: "one", stoneName: "One" }); a.refresh(); assert.equal(a.getSnapshot().lines.length, 1); assert.equal(a.getSnapshot().persisted, false); });
test("storage subscribers observe changes without React updater side effects", () => { const a = storeModule.createJwStoneCartStore(memory(), "a"); let calls = 0; const unsubscribe = a.subscribe(() => calls++); a.add({ id: ID, inventoryPublicId: ID, stoneKey: "one", stoneName: "One" }); unsubscribe(); a.clear(); assert.equal(calls, 1); });
const eligible = new Set(Array.from({ length: 55 }, (_, i) => `stone-${i}`));
const wishlist = await load("client/src/features/jw-stone/wishlist.ts", { "./catalog": { JW_STONE_NAMED_IDS: eligible }, "@shared/jwStoneLegacyAliases": { resolveJwStoneLegacyItemSlug: id => id } });
const wishlistStore = await load("client/src/features/jw-stone/jwStoneWishlistStore.ts", { "./wishlist": wishlist });
test("wishlist clear remains durable if legacy-key removal fails", () => { const m = memory(); m.setItem(wishlist.JW_STONE_LEGACY_WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, ids: ["stone-1"] })); m.removeItem = () => { throw new Error("blocked"); }; assert.equal(wishlist.clearWishlist(m).persisted, true); assert.equal(wishlist.loadWishlist(m).ids.length, 0); });
test("malformed modern wishlist never revives an old legacy selection", () => { const m = memory(); m.setItem(wishlist.JW_STONE_WISHLIST_STORAGE_KEY, "broken"); m.setItem(wishlist.JW_STONE_LEGACY_WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, ids: ["stone-1"] })); assert.equal(wishlist.loadWishlist(m).status, "malformed"); assert.equal(wishlist.loadWishlist(m).ids.length, 0); });
test("wishlist rapid toggles and subscriber replays do not duplicate mutations", () => { const s = wishlistStore.createJwStoneWishlistStore(memory()); const unsubscribe = s.subscribe(() => s.getSnapshot()); s.refresh(); s.toggle("stone-1"); s.toggle("stone-2"); s.toggle("stone-1"); assert.deepEqual(clone(s.getSnapshot().ids), ["stone-2"]); unsubscribe(); });
test("wishlist reload, another-tab changes and clear are reflected", () => { const m = memory(), a = wishlistStore.createJwStoneWishlistStore(m), b = wishlistStore.createJwStoneWishlistStore(m); a.refresh(); b.refresh(); a.toggle("stone-1"); b.toggle("stone-2"); a.refresh(); assert.equal(a.getSnapshot().ids.length, 2); m.data.clear(); a.refresh(); assert.equal(a.getSnapshot().ids.length, 0); });
test("wishlist capacity produces a visible notice", () => { const m = memory(); wishlist.saveWishlist(m, [...eligible].slice(0, 50)); const s = wishlistStore.createJwStoneWishlistStore(m); s.refresh(); s.toggle("stone-51"); assert.match(s.getSnapshot().notice, /50/); assert.equal(s.getSnapshot().ids.length, 50); });
test("blocked wishlist storage preserves the current visit's selections", () => { const s = wishlistStore.createJwStoneWishlistStore(null); s.refresh(); s.toggle("stone-1"); s.toggle("stone-2"); s.refresh(); assert.equal(s.getSnapshot().persisted, false); assert.equal(s.getSnapshot().ids.length, 2); });

async function routeHarness(role = "member") {
  const endpoints = new Map(); let reviews = 0, workbookReads = 0;
  const routes = await load("server/routes/jw-stone-member-pricing.ts", {
    "./jw-stone-receiving": { registerJwStoneReceivingRoutes() {} },
    "@shared/jwStoneMemberPricing": { JW_STONE_PRICING_PROFILE_SLUG: "jw-stone" },
    "@shared/jwStoneCart": cart,
    "../auth": { isAuthenticated() {} }, "../schemaPreflight": { requireCriticalSchema() { return () => {}; } },
    "../services/jwStoneDrivePricing": { getJwStonePricingSnapshot: async () => { workbookReads++; throw new Error("workbook offline"); } },
    "../services/jwStonePricingAccess": { resolveJwStonePricingAccess: async () => role },
    "../services/jwStoneCartService": { getJwStoneCartReview: async (viewerId, request) => { reviews++; return cart.reviewJwStoneCart(viewerId, request.lines, [stock], new Date(), request.fulfillment); } },
  });
  routes.registerJwStoneMemberPricingRoutes({ use() {}, get(path, ...handlers) { endpoints.set(`GET ${path}`, handlers.at(-1)); }, post(path, ...handlers) { endpoints.set(`POST ${path}`, handlers.at(-1)); } });
  return { async call(method, suffix, user = { id: "a" }, body = { lines: intent }) {
    const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, vary() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await endpoints.get(`${method} /api/u/jw-stone/member-pricing/${suffix}`)({ user, body }, res);
    return res;
  }, get reviews() { return reviews; }, get workbookReads() { return workbookReads; }, routes };
}
test("nonmembers and internal staff do not gain buyer cart-review privileges", async () => { for (const role of ["none", "internal"]) { const h = await routeHarness(role); const res = await h.call("POST", "cart-review"); assert.equal(res.statusCode, 403); assert.equal(h.reviews, 0); } });
test("missing session identity is rejected before review", async () => { const h = await routeHarness(); assert.equal((await h.call("POST", "cart-review", undefined)).statusCode, 200); assert.equal((await h.call("POST", "cart-review", null)).statusCode, 401); });
test("cart access survives a workbook outage and remains private", async () => { const h = await routeHarness(); const res = await h.call("GET", "cart-access"); assert.equal(res.body.allowed, true); assert.equal(res.headers["Cache-Control"], "private, no-store"); assert.equal(h.workbookReads, 0); });
test("authenticated duplicate rows are reviewed as combined stock quantities", async () => { const h = await routeHarness(); const res = await h.call("POST", "cart-review", { id: "a" }, { lines: [...intent, ...intent] }); assert.equal(res.statusCode, 200); assert.equal(res.body.lines.length, 1); assert.equal(res.body.lines[0].requestedQuantity, 4); assert.equal(h.reviews, 1); });
test("route returns reviewed rates without claiming payment or reservation", async () => { const h = await routeHarness(); const res = await h.call("POST", "cart-review"); assert.equal(res.statusCode, 200); assert.equal(res.body.subtotalCents, 125000); assert.equal(res.body.readyForCheckout, false); assert.equal(h.reviews, 1); });
test("member catalog projection still omits landed costs", async () => { const h = await routeHarness(); const res = h.routes.projectJwStonePricingResponse({ viewerId: "a", access: "member", snapshot: { sourceUpdatedAt: "2026-09-12T12:00:00Z", prices: [{ stoneName: "Test", stoneKey: "test", slabPriceCents: 100, bundlePriceCents: 80, landedCostCents: 50 }] } }); assert.equal(res.prices[0].landedCostCents, undefined); });

async function serviceHarness({ received = true, published = true, workbookOffline = false, validReceipt = true, contextBusiness = "jw-business", expired = false } = {}) {
  let queries = [], workbookReads = 0;
  const receipt = { receiptId: "a".repeat(32), priceUnit: "slab", sellPriceCents: 120000, bundlePriceCents: 100000, bundleMinSlabs: 6, landedCostCents: 40000 };
  const row = { public_id: ID, source_asset_ref: received ? "jw-receiving:fixture" : "seller-managed:fixture", asset_kind: "bundle", passport_status: "verified", dimensions_json: stock.dimensions, condition_json: { ownerConfirmedName: "Test Granite", lastConfirmedAt: "2026-09-12T12:00:00Z", confirmationExpiresAt: "2026-10-01T12:00:00Z", privateNote: "SECRET", jwReceiving: { state: "published", receipt } }, material_slug: "test-granite", canonical_name: "Test Granite", quantity: "8", held_quantity: "2", unit: "slabs", lifecycle_status: "available", public_availability_status: published ? "published_current" : "not_published", published_at: published ? new Date() : null, publication_evidence: published ? { approved: true } : {} };
  const service = await load("server/services/jwStoneCartService.ts", {
    "../db": { pool: { query: async (sql, params) => { queries.push({ sql, params }); return { rows: [row] }; } } },
    "../routes/profiles": { getPublicProfileTrustContext: async () => ({ businessId: contextBusiness }) },
    "./stoneInventoryService": { getStoneInventoryProfileTarget: async () => ({ businessId: "jw-business" }) },
    "./jwStoneDrivePricing": { getJwStonePricingSnapshot: async () => { workbookReads++; if (workbookOffline) throw new Error("offline"); return { sourceUpdatedAt: "2026-09-12T00:00:00.000Z", prices: [{ stoneKey: "test-granite", slabPriceCents: 1250, bundlePriceCents: 1000, bundleMinSlabs: 6, landedCostCents: 100 }] }; } },
    "@shared/jwStoneMemberPricing": { jwStonePriceKey: name => name.toLowerCase().replaceAll(" ", "-") },
    "@shared/jwStoneReceiving": { parseJwStoneReceipt: value => { if (!validReceipt) throw new Error("bad receipt"); return value; }, jwStoneReceiptPublicId: () => ID },
    "@shared/stoneInventory": { isStoneInventoryConfirmationFresh: () => !expired },
    "@shared/jwStoneCart": cart,
  });
  return { run: () => service.getJwStoneCartReview("a", { lines: intent }), get queries() { return queries; }, get workbookReads() { return workbookReads; } };
}
test("received-lot review uses the receipt rate and skips the catalog workbook", async () => { const h = await serviceHarness({ workbookOffline: true }); const r = await h.run(); assert.equal(r.subtotalCents, 240000); assert.equal(h.workbookReads, 0); });
test("legacy physical inventory uses its current catalog rate", async () => { const h = await serviceHarness({ received: false }); assert.equal((await h.run()).subtotalCents, 125000); assert.equal(h.workbookReads, 1); });
test("bad received-lot rates never fall back to a catalog rate", async () => { const h = await serviceHarness({ validReceipt: false }); const r = await h.run(); assert.equal(r.lines[0].status, "price_unavailable"); assert.equal(h.workbookReads, 0); });
test("a catalog outage returns an unresolved line rather than a stale rate", async () => { const h = await serviceHarness({ received: false, workbookOffline: true }); assert.equal((await h.run()).subtotalCents, null); });
test("inventory query is read-only and scoped to the exact JW business and requested IDs", async () => { const h = await serviceHarness(); await h.run(); assert.equal(h.queries.length, 1); assert.match(h.queries[0].sql, /WHERE ip.holder_business_id = \$1 AND ap.public_id = ANY\(\$2::text\[\]\)/); assert.deepEqual(clone(h.queries[0].params), ["jw-business", [ID]]); assert.ok(!/\b(UPDATE|INSERT|DELETE)\b/.test(h.queries[0].sql)); });
test("profile-business mismatch prevents all inventory access", async () => { const h = await serviceHarness({ contextBusiness: "another-business" }); await assert.rejects(h.run(), /unavailable/); assert.equal(h.queries.length, 0); });
test("expired or unpublished lots never get a reviewed subtotal", async () => { for (const args of [{ expired: true }, { published: false }]) { const h = await serviceHarness(args); assert.equal((await h.run()).subtotalCents, null); } });
test("service projections never return the private receipt or cost", async () => { const h = await serviceHarness(); const raw = JSON.stringify(await h.run()); for (const term of ["SECRET", "landedCost", "receiptId", "privateNote"]) assert.ok(!raw.includes(term)); });
