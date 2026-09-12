// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JwStoneMemberPricingProvider, JwStoneMemberPriceDisplay } from "./JwStoneMemberPricing";
import { JW_STONE_CART_STORAGE_PREFIX, JW_STONE_LEGACY_CART_STORAGE_PREFIX, parseJwStoneCartReview, restoreJwStoneCart } from "@shared/jwStoneCart";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/queryClient")>(), apiRequest: api }));
vi.mock("@/pages/profile-sites/ExpressDirectConnectPanel", () => ({
  default: ({ open, initialMessage }: { open: boolean; initialMessage?: string }) => open ? <div data-testid="native-quote-handoff">{initialMessage}</div> : null,
}));
const stockId = `stone_${"a".repeat(32)}`;
const stockItem = { id: stockId, materialName: "Honey Onyx", quantity: 3, unit: "slabs", assetKind: "slab",
  dimensions: { length: 120, height: 60, thickness: 1.25, unit: "in" }, imageUrls: [], finishQuantities: [] };
function makeReview(viewerId: string, quantity = 1, fulfillment: unknown = { method: "pickup" }) {
  const rate = quantity >= 2 ? 200 : 300;
  return { profileSlug: "jw-stone", viewerId, currency: "USD", sourceUpdatedAt: "2026-09-12T00:00:00.000Z",
    reviewedAt: "2026-09-12T00:00:00.000Z", materialReady: true, readyForCheckout: false, inventoryReserved: false,
    subtotalCents: rate * 50 * quantity, deliveryFeeCents: null, estimatedDeliveryDate: null, fulfillment,
    lines: [{ inventoryPublicId: stockId, requestedQuantity: quantity, availableQuantity: 3, materialName: "Honey Onyx",
      materialSlug: "honey-onyx", assetKind: "slab", dimensions: stockItem.dimensions,
      pricingTier: quantity >= 2 ? "bundle" : "slab", unitRateCents: rate, oneSlabTotalCents: rate * 50,
      lineTotalCents: rate * 50 * quantity, status: "ready" }] };
}
function click(element: Element | null) {
  if (!element) throw new Error("Missing button");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function eventually(check: () => void) {
  let failure: unknown;
  for (let i = 0; i < 60; i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    try { check(); return; } catch (error) { failure = error; }
  }
  throw failure;
}
const button = (label: string) => document.querySelector(`button[aria-label="${label}"]`);

describe("JW Stone member cart", () => {
  let root: Root, host: HTMLDivElement, client: QueryClient;
  let viewer = "member-a", access = "member", denied = false;
  const render = (inventoryPublicId?: string) => act(() => root.render(<QueryClientProvider client={client}>
    <JwStoneMemberPricingProvider viewerId={viewer || null}>
      <JwStoneMemberPriceDisplay stoneName="Honey Onyx" slabDimensions="120 x 60" inventoryPublicId={inventoryPublicId} />
    </JwStoneMemberPricingProvider>
  </QueryClientProvider>));
  const add = async () => { await eventually(() => expect(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]')).not.toBeNull()); click(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]')); };
  beforeEach(() => {
    viewer = "member-a"; access = "member"; denied = false;
    window.localStorage.clear(); api.mockReset();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.mockImplementation(async (first: string, second?: any) => {
      const url = first === "GET" || first === "POST" ? second : first;
      if (url.endsWith("/member-pricing")) {
        if (denied) throw Object.assign(new Error("Membership required"), { status: 403 });
        return { profileSlug: "jw-stone", viewerId: viewer, access, currency: "USD", unit: "square_foot", sourceUpdatedAt: "2026-09-12T00:00:00.000Z",
          prices: [{ stoneName: "Honey Onyx", stoneKey: "honey onyx", slabPriceCents: 300, bundlePriceCents: 200, bundleMinSlabs: 2, ...(access === "internal" ? { landedCostCents: 100 } : {}) }] };
      }
      if (url.endsWith("/current")) return { profileSlug: "jw-stone", items: [stockItem] };
      if (url.endsWith("/cart-review")) {
        if (denied) throw Object.assign(new Error("Membership required"), { status: 403 });
        return makeReview(viewer, second.data.lines.reduce((sum: number, line: { quantity: number }) => sum + line.quantity, 0), second.data.fulfillment);
      }
      throw new Error("Unexpected API request: " + url);
    });
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals(); });
  it.each(["guest", "internal", "denied"])("does not expose shopping controls for %s", async (kind) => {
    if (kind === "guest") viewer = "";
    if (kind === "internal") access = "internal";
    if (kind === "denied") denied = true;
    render();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')).toBeNull();
    expect(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]')).toBeNull();
  });
  it("adds, changes quantity, removes, and closes an empty cart", async () => {
    render(); await add();
    await eventually(() => expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).not.toBeNull());
    click(button("Increase Honey Onyx quantity"));
    await eventually(() => expect((document.querySelector('input[aria-label="Quantity for Honey Onyx"]') as HTMLInputElement).value).toBe("2"));
    click(button("Remove Honey Onyx from cart"));
    await eventually(() => expect(document.body.textContent).toContain("Your cart is empty"));
    click(button("Close cart"));
    await eventually(() => expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull());
  });
  it("requires exact stock before a subtotal and sends no browser prices", async () => {
    render(); await add();
    await eventually(() => expect(document.querySelector('select[aria-label="Stock for Honey Onyx"] option[value="'+stockId+'"]')).not.toBeNull());
    expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')).toBeNull();
    const select = document.querySelector('select[aria-label="Stock for Honey Onyx"]') as HTMLSelectElement;
    act(() => { select.value = stockId; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await eventually(() => expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent).toContain("$150.00"));
    const call = api.mock.calls.find(([url]) => String(url).endsWith("/cart-review"));
    expect(call?.[1].data).toEqual({ lines: [{ inventoryPublicId: stockId, quantity: 1 }], fulfillment: { method: "pickup" } });
    expect(JSON.stringify(call?.[1].data)).not.toMatch(/price|Cents|cost/i);
    click(button("Increase Honey Onyx quantity"));
    await eventually(() => expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent).toContain("$200.00"));
    expect(document.body.textContent).toContain("Quantity rate applied");
  });
  it("restores legacy selections but removes persisted price authority", async () => {
    window.localStorage.setItem(JW_STONE_LEGACY_CART_STORAGE_PREFIX + viewer, JSON.stringify([{ id: "old-selection", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: 2, slabRateCents: 1, minimumTotalCents: 1, maximumTotalCents: 1 }]));
    render();
    await eventually(() => expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')?.getAttribute("aria-label")).toContain("2 slabs"));
    click(document.querySelector('[data-testid="jw-stone-member-cart-button"]'));
    await eventually(() => expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).not.toBeNull());
    expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')).toBeNull();
    expect(window.localStorage.getItem(JW_STONE_LEGACY_CART_STORAGE_PREFIX + viewer)).toBeNull();
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer)).not.toMatch(/RateCents|TotalCents|landed/);
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer)).toContain("old-selection");
  });
  it("carries stock and quantities into the native editable quote form", async () => {
    render(stockId); await add();
    await eventually(() => expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent).toContain("$150.00"));
    click(document.querySelector('[data-testid="jw-cart-request-quote"]'));
    await eventually(() => expect(document.querySelector('[data-testid="native-quote-handoff"]')).not.toBeNull());
    const text = document.querySelector('[data-testid="native-quote-handoff"]')?.textContent;
    expect(text).toContain(stockId); expect(text).toContain("1 slab(s): Honey Onyx"); expect(text).toContain("Pickup requested");
    expect(text).toContain("not a final quote");
  });
  it("does not display or overwrite the previous member's cart when accounts change", async () => {
    render(); await add(); click(button("Increase Honey Onyx quantity"));
    await eventually(() => expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + "member-a")).toContain('"quantity":2'));
    viewer = "member-b"; render();
    await eventually(() => expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')?.getAttribute("aria-label")).toContain("0 slabs"));
    expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull();
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + "member-a")).toContain('"quantity":2');
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + "member-b")).toBe("[]");
  });
  it("removes cart access when the server rejects the membership during review", async () => {
    render(stockId); await add();
    await eventually(() => expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')).not.toBeNull());
    denied = true;
    click([...document.querySelectorAll("button")].find((element) => element.textContent === "Recheck total") || null);
    await eventually(() => expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull());
    expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')).toBeNull();
  });
  it("rejects a late response for a different member or changed quantity", () => {
    const request = { lines: [{ inventoryPublicId: stockId, quantity: 1 }] };
    expect(() => parseJwStoneCartReview(makeReview("member-a"), "member-b", request)).toThrow();
    expect(() => parseJwStoneCartReview(makeReview("member-a", 2), "member-a", request)).toThrow();
  });
  it("rejects malformed storage and discards price fields in otherwise valid selections", () => {
    expect(restoreJwStoneCart({})).toEqual([]);
    expect(restoreJwStoneCart([{ id: "x", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: -1 }])).toEqual([]);
    expect(restoreJwStoneCart([{ id: "x", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: 1, landedCostCents: 55 }])).toEqual([{ id: "x", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: 1 }]);
  });
});
