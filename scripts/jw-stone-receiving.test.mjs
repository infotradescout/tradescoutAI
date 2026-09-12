import test from "node:test";
import assert from "node:assert/strict";
import { parseJwStoneReceipt, jwStoneReceivingCents, jwStoneReceiptDimensions, jwStoneReceiptMemberPrice, jwStoneReceiptPublicId, isManuallyAssignedJwStoneEmployee, jwStoneReceivingMaterialSlug, jwStoneReceivingPhotoKey } from "../shared/jwStoneReceiving.ts";
const receipt = { receiptId: "d6f3fb18-33ec-4d87-9d6c-a5298fa8e47a", materialName: "Test Granite", materialFamily: "granite", materialClass: "natural_stone", lotLabel: "TEST-001", quantity: 2, length: 120, height: 60, dimensionUnit: "in", thicknessMm: 30, finish: "polished", locationLabel: "Test rack", priceUnit: "square_foot", sellPriceCents: 1250, bundlePriceCents: null, bundleMinSlabs: null, landedCostCents: 700, notes: "Test-only fixture, not live inventory" };
test("accepts a complete employee-entered receipt", () => assert.deepEqual(parseJwStoneReceipt(receipt), receipt));
for (const field of ["quantity", "length", "height", "thicknessMm", "sellPriceCents"]) {
  test(`${field} requires an actual positive numeric value`, () => {
    for (const value of [0, -1, null, undefined, "12", NaN, Infinity]) assert.throws(() => parseJwStoneReceipt({ ...receipt, [field]: value }));
  });
}
test("physical counts and currency cannot be fractional", () => {
  for (const field of ["quantity", "sellPriceCents", "bundlePriceCents", "landedCostCents"]) assert.throws(() => parseJwStoneReceipt({ ...receipt, [field]: 1.5 }));
});
test("requires material identity, measured units, finish, location and lot label", () => {
  for (const field of ["materialName", "materialFamily", "materialClass", "lotLabel", "finish", "locationLabel", "dimensionUnit", "priceUnit"]) assert.throws(() => parseJwStoneReceipt({ ...receipt, [field]: "" }));
});
test("bundle rates require an explicit minimum, not an assumed threshold", () => {
  assert.throws(() => parseJwStoneReceipt({ ...receipt, bundlePriceCents: 1000 }));
  assert.throws(() => parseJwStoneReceipt({ ...receipt, bundleMinSlabs: 6 }));
  assert.equal(parseJwStoneReceipt({ ...receipt, bundlePriceCents: 1000, bundleMinSlabs: 6 }).bundleMinSlabs, 6);
});
test("unit conversion never treats 30 mm as 30 inches", () => {
  assert.deepEqual(jwStoneReceiptDimensions(receipt), { length: 3048, height: 1524, thickness: 30, unit: "mm" });
  assert.deepEqual(jwStoneReceiptDimensions({ ...receipt, dimensionUnit: "mm", length: 3000, height: 1500 }), { length: 3000, height: 1500, thickness: 30, unit: "mm" });
});
test("the same receipt ID resolves to the same public ID on every retry", () => {
  assert.equal(jwStoneReceiptPublicId(receipt.receiptId), "stone_d6f3fb1833ec4d879d6ca5298fa8e47a");
  assert.equal(jwStoneReceiptPublicId(receipt.receiptId.toUpperCase()), jwStoneReceiptPublicId(receipt.receiptId));
  assert.throws(() => jwStoneReceiptPublicId("../../other-business"));
});
test("member price projection excludes landed cost, notes, locations and employee information", () => {
  const result = jwStoneReceiptMemberPrice(receipt);
  assert.deepEqual(Object.keys(result).sort(), ["publicId", "currency", "unit", "sellPriceCents", "bundlePriceCents", "bundleMinSlabs"].sort());
  assert.ok(!JSON.stringify(result).includes(receipt.notes));
  assert.equal(result.sellPriceCents, 1250);
});
test("money conversion is exact and rejects ambiguous input", () => {
  assert.equal(jwStoneReceivingCents("12.50"), 1250);
  assert.equal(jwStoneReceivingCents("0.29"), 29);
  assert.equal(jwStoneReceivingCents("12.5"), 1250);
  assert.equal(jwStoneReceivingCents(""), null);
  for (const value of ["-1", "1.999", "1e3", "$12", "1,000", "NaN", "9999999"]) assert.throws(() => jwStoneReceivingCents(value));
});
test("zero internal cost is distinct from missing cost; zero selling price is forbidden", () => {
  assert.equal(parseJwStoneReceipt({ ...receipt, landedCostCents: 0 }).landedCostCents, 0);
  assert.equal(parseJwStoneReceipt({ ...receipt, landedCostCents: null }).landedCostCents, null);
  assert.throws(() => parseJwStoneReceipt({ ...receipt, sellPriceCents: 0 }));
});
test("manual employee access matches immutable IDs exactly, never a membership claim or substring", () => {
  assert.equal(isManuallyAssignedJwStoneEmployee("staff-1", "staff-1, staff-2\nstaff-3"), true);
  assert.equal(isManuallyAssignedJwStoneEmployee("staff", "staff-1"), false);
  assert.equal(isManuallyAssignedJwStoneEmployee("member", "staff-1"), false);
  assert.equal(isManuallyAssignedJwStoneEmployee("", ""), false);
});
test("rejects unexpected properties including inherited-name lookalikes", () => {
  for (const key of ["businessId", "published", "isEmployee", "toString", "__proto__"]) assert.throws(() => parseJwStoneReceipt(JSON.parse(JSON.stringify(receipt).slice(0, -1) + `,"${key}":true}`)));
});
test("material slugs are bounded, stable, and cannot inject a path", () => {
  assert.equal(jwStoneReceivingMaterialSlug("  Crème / Test  "), "creme-test");
  assert.ok(jwStoneReceivingMaterialSlug("a".repeat(200)).length <= 120);
  assert.throws(() => parseJwStoneReceipt({ ...receipt, materialName: "///" }));
});

test("photo routing is restricted to sanitized numbered JPEGs in this receipt", () => {
  assert.equal(jwStoneReceivingPhotoKey(receipt.receiptId, "1-0123456789abcdef0123.jpg"), `public-media/images/businesses/jw-stone/receiving/${receipt.receiptId}/1-0123456789abcdef0123.jpg`);
  for (const file of ["receipt.json", "../secret", "1-0123456789abcdef0123.jpg/receipt.json", "9-0123456789abcdef0123.jpg", "1-0123456789abcdef0123.svg"]) assert.equal(jwStoneReceivingPhotoKey(receipt.receiptId, file), null);
  assert.equal(jwStoneReceivingPhotoKey("../jw", "1-0123456789abcdef0123.jpg"), null);
});
