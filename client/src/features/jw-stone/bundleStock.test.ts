import { describe, expect, it } from "vitest";
import { parseJwStoneBundleStock, searchJwStoneBundleStock } from "./bundleStock";

const lot = (index = 1) => ({
  id: "stone_" + index.toString(16).padStart(32, "0"),
  materialName: index === 1 ? "Honey Onyx" : "Fantasy Brown",
  materialFamily: "Natural stone",
  assetKind: "slab",
  quantity: 1,
  unit: "slabs",
  dimensions: { length: 120, height: 60, unit: "in" },
  imageUrls: [],
  finishQuantities: [{ finish: "Polished", slabCount: 1 }],
});
const response = (items: unknown[]) => ({ profileSlug: "jw-stone", items });

describe("JW Stone bundle stock selection", () => {
  it("keeps distinct stock lots and sorts readable material names", () => {
    const result = parseJwStoneBundleStock(response([lot(1), lot(2)]));
    expect(result.map((item) => item.materialName)).toEqual(["Fantasy Brown", "Honey Onyx"]);
    expect(result.map((item) => item.quantity)).toEqual([1, 1]);
  });
  it.each([
    { assetKind: "block" }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.5 },
    { unit: "bundles" }, { dimensions: null }, { materialName: "" },
    { dimensions: { length: 0, height: 60, unit: "in" } },
    { dimensions: { length: 120, height: 60, unit: "feet" } },
    { id: "not-a-stock-id" },
  ])("does not turn incompatible or unmeasured stock into selectable slabs: %j", (invalid) => {
    expect(parseJwStoneBundleStock(response([{ ...lot(), ...invalid }]))).toEqual([]);
  });
  it("rejects duplicated physical lot IDs rather than displaying the stock twice", () => {
    expect(() => parseJwStoneBundleStock(response([lot(), lot()]))).toThrow(/Refresh/);
  });
  it("binds the list to JW Stone and rejects an unexpected response shape", () => {
    expect(() => parseJwStoneBundleStock({ profileSlug: "other", items: [lot()] })).toThrow();
    expect(() => parseJwStoneBundleStock({ profileSlug: "jw-stone", items: {} })).toThrow();
  });
  it("does not retain price, internal cost, or buyer-specific fields from the inventory response", () => {
    const [item] = parseJwStoneBundleStock(response([{ ...lot(), slabPriceCents: 123, landedCostCents: 1, buyerUserId: "private" }]));
    expect(item).not.toHaveProperty("slabPriceCents");
    expect(item).not.toHaveProperty("landedCostCents");
    expect(item).not.toHaveProperty("buyerUserId");
  });
  it("searches names, material families and finishes without case sensitivity", () => {
    const items = parseJwStoneBundleStock(response([lot(1), lot(2)]));
    expect(searchJwStoneBundleStock(items, "honey").map((item) => item.materialName)).toEqual(["Honey Onyx"]);
    expect(searchJwStoneBundleStock(items, "POLISHED")).toHaveLength(2);
    expect(searchJwStoneBundleStock(items, "natural")).toHaveLength(2);
    expect(searchJwStoneBundleStock(items, "not listed")).toEqual([]);
    expect(searchJwStoneBundleStock(items, " ")).toHaveLength(2);
  });
});
