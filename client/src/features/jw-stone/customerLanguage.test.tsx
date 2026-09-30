import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import { NewArrivalsSection } from "./CurrentInventorySection";

const queryFixture = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  data: { items: [] as PublicStoneInventoryItem[] },
}));

vi.mock("@tanstack/react-query", () => ({ useQuery: () => queryFixture }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));
vi.mock("./JwStoneMemberPricing", () => ({
  JwStoneMemberPriceDisplay: () => null,
  JwStoneOfferAction: () => <button>Make an Offer</button>,
}));

function arrival(overrides: Partial<PublicStoneInventoryItem> = {}): PublicStoneInventoryItem {
  return {
    id: `stone_${"a".repeat(32)}`,
    materialSlug: "test-stone",
    materialName: "Test Stone",
    materialClass: "natural_stone",
    materialFamily: "Granite",
    assetKind: "slab",
    quantity: 8,
    unit: "slabs",
    dimensions: { length: 120, height: 60, thickness: 1.25, unit: "in" },
    finishQuantities: [{ finish: "Polished", slabCount: 8 }],
    imageUrls: [],
    lastConfirmedAt: "2026-09-12T12:00:00.000Z",
    ...overrides,
  } as PublicStoneInventoryItem;
}

function renderArrivals(): string {
  return renderToStaticMarkup(
    <NewArrivalsSection onAsk={vi.fn()} onStartRequest={vi.fn()} />
  );
}

describe("JW Stone customer-facing inventory language", () => {
  beforeEach(() => {
    queryFixture.isLoading = false;
    queryFixture.isError = false;
    queryFixture.data.items = [arrival()];
  });

  it("shows the supplied quantity and finish without internal source language", () => {
    const html = renderArrivals();
    expect(html).toContain("New Arrivals");
    expect(html).toContain("Test Stone");
    expect(html).toContain("8 slabs");
    expect(html).toContain(">Finish</dt>");
    expect(html).toContain("8 Polished");
    expect(html).toContain("Updated ");
    expect(html).toContain("Make an Offer");
    expect(html).not.toMatch(/supplied source|confirmed finishes|verified|physical lots|known finish/i);
  });

  it("does not invent missing dimensions or finishes", () => {
    queryFixture.data.items = [arrival({ dimensions: null, finishQuantities: [] })];
    const html = renderArrivals();
    expect(html).not.toContain(">Dimensions</dt>");
    expect(html).not.toContain(">Finish</dt>");
    expect(html).toContain("8 slabs");
    expect(html).not.toMatch(/out of stock|unavailable stone/i);
  });

  it.each([undefined, null])("does not assign inches to an arrival with unit %s", (unit) => {
    queryFixture.data.items = [arrival({ dimensions: { length: 120, height: 60, unit } })];
    const html = renderArrivals();
    expect(html).toContain("Length: 120");
    expect(html).toContain("Height: 60");
    expect(html).toContain("Measurement unit needed");
    expect(html).not.toContain("120 × 60 in");
  });

  it.each(["in", "mm"] as const)("keeps partial axes labeled in %s", (unit) => {
    queryFixture.data.items = [arrival({ dimensions: { length: 120, height: null, thickness: 2, unit } })];
    const html = renderArrivals();
    expect(html).toContain(`Length: 120 ${unit}`);
    expect(html).toContain(`Thickness: 2 ${unit}`);
    expect(html).not.toContain(`120 × 2 ${unit}`);
    expect(html).not.toContain("Height:");
  });

  it("keeps complete measured dimensions compact and omits unknown thickness", () => {
    queryFixture.data.items = [arrival({ dimensions: { length: 3048, height: 1524, thickness: null, unit: "mm" } })];
    expect(renderArrivals()).toContain("3048 × 1524 mm");
  });

  it("does not claim an unknown update date is recent", () => {
    queryFixture.data.items = [arrival({ lastConfirmedAt: "not-a-date" })];
    expect(renderArrivals()).toContain("Update date unavailable");
    expect(renderArrivals()).not.toContain("Updated ");
  });

  it.each(["loading", "error", "empty"])(
    "preserves the existing hidden section when arrivals are %s",
    (state) => {
      queryFixture.isLoading = state === "loading";
      queryFixture.isError = state === "error";
      if (state === "empty") queryFixture.data.items = [];
      expect(renderArrivals()).toBe("");
    }
  );

  it("uses customer-facing profile fact labels", () => {
    expect(JW_STONE_PROFILE_PRESENTATION_BLOCK.data.audience.availableFacts).toEqual([
      "Stone photos",
      "Material categories",
      "Finishes",
      "Slab counts",
    ]);
  });
});
