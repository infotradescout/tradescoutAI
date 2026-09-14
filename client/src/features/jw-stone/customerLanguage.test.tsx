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

// Render the public customer view: arrivals data is independent of guest auth
// and the employee permission response. Query fixtures must retain those boundaries.
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "/api/auth/user") return { data: null, isLoading: false, isError: false };
    if (queryKey[1] === "new-arrivals") return queryFixture;
    if (queryKey[1] === "receiving-access")
      return {
        data: { viewerId: "", allowed: false, enabled: false },
        isLoading: false,
        isError: false,
      };
    if (queryKey[1] === "arrival-prices")
      return { data: { viewerId: "", prices: [] }, isLoading: false, isError: false };
    throw new Error(`Unexpected customer-language query: ${queryKey.join("/")}`);
  },
}));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  ApiError: class extends Error {
    status?: number;
  },
}));
vi.mock("./JwStoneMemberPricing", () => ({
  JwStoneMemberPriceDisplay: () => null,
  useJwStoneMemberCart: () => ({ cartEnabled: false, addToCart: vi.fn() }),
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
  return renderToStaticMarkup(<NewArrivalsSection onAsk={vi.fn()} onStartRequest={vi.fn()} />);
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
    expect(html).toContain("Ask about this arrival");
    expect(html).not.toMatch(/supplied source|confirmed|verified|physical lots|known finish/i);
  });

  it("does not invent missing dimensions or finishes", () => {
    queryFixture.data.items = [arrival({ dimensions: null, finishQuantities: [] })];
    const html = renderArrivals();
    expect(html).not.toContain(">Dimensions</dt>");
    expect(html).not.toContain(">Finish</dt>");
    expect(html).toContain("8 slabs");
    expect(html).not.toMatch(/out of stock|unavailable stone/i);
  });

  it("does not claim an unknown update date is recent", () => {
    queryFixture.data.items = [arrival({ lastConfirmedAt: "not-a-date" })];
    expect(renderArrivals()).toContain("Update date unavailable");
    expect(renderArrivals()).not.toMatch(/recently|confirmed/i);
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
