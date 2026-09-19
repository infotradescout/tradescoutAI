// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JwStoneMemberPricingProvider, JwStoneMemberPriceDisplay } from "./JwStoneMemberPricing";
import { getJwStoneBundleProgress, priceJwStoneBundleLine } from "@shared/jwStoneBundle";
import {
  JW_STONE_CART_STORAGE_PREFIX,
  JW_STONE_LEGACY_CART_STORAGE_PREFIX,
  parseJwStoneCartReview,
  restoreJwStoneCart,
} from "@shared/jwStoneCart";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/queryClient")>()),
  apiRequest: api,
}));
vi.mock("@/pages/profile-sites/ExpressDirectConnectPanel", () => ({
  default: ({
    open,
    initialMessage,
    jwStoneOffer,
  }: {
    open: boolean;
    initialMessage?: string;
    jwStoneOffer?: unknown;
  }) =>
    open ? (
      jwStoneOffer ? (
        <div data-testid="native-offer-handoff">{JSON.stringify(jwStoneOffer)}</div>
      ) : (
        <div data-testid="native-quote-handoff">{initialMessage}</div>
      )
    ) : null,
}));
const stockId = `stone_${"a".repeat(32)}`;
const stockItem = {
  id: stockId,
  materialName: "Honey Onyx",
  quantity: 3,
  unit: "slabs",
  assetKind: "slab",
  dimensions: { length: 120, height: 60, thickness: 1.25, unit: "in" },
  imageUrls: [],
  finishQuantities: [],
};
function makeReview(viewerId: string, quantity = 1, fulfillment: unknown = { method: "pickup" }) {
  const rate = quantity >= 2 ? 200 : 300;
  return {
    profileSlug: "jw-stone",
    viewerId,
    currency: "USD",
    sourceUpdatedAt: "2026-09-12T00:00:00.000Z",
    reviewedAt: "2026-09-12T00:00:00.000Z",
    materialReady: true,
    readyForCheckout: false,
    inventoryReserved: false,
    subtotalCents: rate * 50 * quantity,
    deliveryFeeCents: null,
    estimatedDeliveryDate: null,
    fulfillment,
    lines: [
      {
        inventoryPublicId: stockId,
        requestedQuantity: quantity,
        availableQuantity: 3,
        materialName: "Honey Onyx",
        materialSlug: "honey-onyx",
        assetKind: "slab",
        dimensions: stockItem.dimensions,
        pricingTier: quantity >= 2 ? "bundle" : "slab",
        unitRateCents: rate,
        oneSlabTotalCents: rate * 50,
        lineTotalCents: rate * 50 * quantity,
        status: "ready",
      },
    ],
  };
}
function makeHoldRecovery(viewerId: string) {
  return {
    viewerId,
    hold: {
      reservationId: `jwh_${"b".repeat(32)}`,
      status: "active",
      expiresAt: "2026-09-12T00:30:00.000Z",
      serverTime: "2026-09-12T00:00:00.000Z",
      totalSlabs: 1,
      lines: [
        {
          inventoryPublicId: stockId,
          materialName: "Honey Onyx",
          quantity: 1,
        },
      ],
    },
  };
}
function makeHoldReceipt(data: any) {
  return {
    reservationId: `jwh_${"b".repeat(32)}`,
    status: "active",
    expiresAt: "2026-09-12T00:30:00.000Z",
    serverTime: "2026-09-12T00:00:00.000Z",
    currency: "USD",
    materialSubtotalCents: data.expectedSubtotalCents,
    paymentStatus: "not_started",
    readyForCheckout: false,
    fulfillment: data.fulfillment,
    deliveryFeeCents: null,
    estimatedDeliveryDate: null,
    lines: data.lines.map((line: { inventoryPublicId: string; quantity: number }) => ({
      inventoryPublicId: line.inventoryPublicId,
      materialName: "Honey Onyx",
      quantity: line.quantity,
      unitRateCents: 300,
      oneSlabTotalCents: 15000,
      lineTotalCents: 15000 * line.quantity,
      pricingTier: "slab",
    })),
  };
}
function makeBundleReview(
  viewerId: string,
  quantity: number,
  fulfillment: unknown,
  availableQuantity: number
) {
  const bundlePricing = {
    slabRateCents: 300,
    bundleRateCents: 200,
    minimumSlabs: 7,
    regularOneSlabCents: 15000,
    bundleOneSlabCents: 10000,
  };
  const candidate = {
    ...makeReview(viewerId, quantity, fulfillment).lines[0],
    bundlePricing,
    availableQuantity,
  };
  const progress = getJwStoneBundleProgress([candidate]);
  const line = {
    ...candidate,
    ...priceJwStoneBundleLine(bundlePricing, quantity, progress.unlocked),
  };
  return {
    ...makeReview(viewerId, quantity, fulfillment),
    lines: [line],
    subtotalCents: line.lineTotalCents,
    bundle: {
      ...progress,
      regularSubtotalCents: 15000 * quantity,
      savingsCents: 15000 * quantity - line.lineTotalCents,
    },
  };
}
function click(element: Element | null) {
  if (!element) throw new Error("Missing button");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function eventually(check: () => void) {
  let failure: unknown;
  for (let i = 0; i < 60; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      check();
      return;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}
const button = (label: string) => document.querySelector(`button[aria-label="${label}"]`);

describe("JW Stone member cart", () => {
  let root: Root, host: HTMLDivElement, client: QueryClient;
  let viewer = "member-a",
    access = "member",
    denied = false;
  let bundleMode = false,
    bundleAvailable = 20,
    bundleFailure = false,
    holdFailures = 0,
    recoverCreatedHold = false;
  let holdRequests: any[] = [];
  let operationRecoveries: string[] = [];
  const render = (inventoryPublicId?: string) =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <JwStoneMemberPricingProvider viewerId={viewer || null}>
            <JwStoneMemberPriceDisplay
              stoneName="Honey Onyx"
              slabDimensions="120 x 60"
              inventoryPublicId={inventoryPublicId}
            />
          </JwStoneMemberPricingProvider>
        </QueryClientProvider>
      )
    );
  const add = async () => {
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]'));
    // Opening is asynchronous: exercise the rendered cart, not a pending chunk import.
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).not.toBeNull()
    );
  };
  beforeEach(() => {
    viewer = "member-a";
    access = "member";
    denied = false;
    bundleMode = false;
    bundleAvailable = 20;
    bundleFailure = false;
    holdFailures = 0;
    recoverCreatedHold = false;
    holdRequests = [];
    operationRecoveries = [];
    window.localStorage.clear();
    window.sessionStorage.clear();
    api.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.mockImplementation(async (first: string, second?: any) => {
      const url = first === "GET" || first === "POST" ? second : first;
      if (url.endsWith("/member-pricing")) {
        if (denied) throw Object.assign(new Error("Membership required"), { status: 403 });
        return {
          profileSlug: "jw-stone",
          viewerId: viewer,
          access,
          currency: "USD",
          unit: "square_foot",
          sourceUpdatedAt: "2026-09-12T00:00:00.000Z",
          prices: [
            {
              stoneName: "Honey Onyx",
              stoneKey: "honey onyx",
              slabPriceCents: 300,
              bundlePriceCents: 200,
              bundleMinSlabs: 2,
              ...(access === "internal" ? { landedCostCents: 100 } : {}),
            },
          ],
        };
      }
      if (url.endsWith("/current")) return { profileSlug: "jw-stone", items: [stockItem] };
      if (url.endsWith("/cart-review")) {
        if (denied) throw Object.assign(new Error("Membership required"), { status: 403 });
        if (bundleMode) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (bundleFailure) throw new Error("Bundle review unavailable");
          return makeBundleReview(
            viewer,
            second.data.lines.reduce(
              (sum: number, line: { quantity: number }) => sum + line.quantity,
              0
            ),
            second.data.fulfillment,
            bundleAvailable
          );
        }
        return makeReview(
          viewer,
          second.data.lines.reduce(
            (sum: number, line: { quantity: number }) => sum + line.quantity,
            0
          ),
          second.data.fulfillment
        );
      }
      if (url.includes("/member-pricing/holds/operations/")) {
        operationRecoveries.push(url);
        return recoverCreatedHold ? makeHoldRecovery(viewer) : { viewerId: viewer, hold: null };
      }
      if (url.endsWith("/member-pricing/holds")) {
        holdRequests.push(second.data);
        if (holdFailures > 0) {
          holdFailures--;
          throw new Error("Reservation response was interrupted.");
        }
        return makeHoldReceipt(second.data);
      }
      throw new Error("Unexpected API request: " + url);
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    vi.unstubAllGlobals();
  });
  it.each(["guest", "internal", "denied"])(
    "does not expose shopping controls for %s",
    async (kind) => {
      if (kind === "guest") viewer = "";
      if (kind === "internal") access = "internal";
      if (kind === "denied") denied = true;
      render();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')).toBeNull();
      expect(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]')).toBeNull();
    }
  );
  it("does not load stock or review a cart merely by viewing member prices", async () => {
    render(stockId);
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-add-to-cart-card"]')).not.toBeNull()
    );
    expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull();
    expect(api.mock.calls.some(([url]) => /\/(current|cart-review)$/.test(String(url)))).toBe(
      false
    );
  });
  it("adds, changes quantity, removes, and closes an empty cart", async () => {
    render();
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).not.toBeNull()
    );
    click(button("Increase Honey Onyx quantity"));
    await eventually(() =>
      expect(
        (document.querySelector('input[aria-label="Quantity for Honey Onyx"]') as HTMLInputElement)
          .value
      ).toBe("2")
    );
    click(button("Remove Honey Onyx from cart"));
    await eventually(() => expect(document.body.textContent).toContain("Your cart is empty"));
    click(button("Close cart"));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull()
    );
  });
  it("requires exact stock before a subtotal and sends no browser prices", async () => {
    render();
    await add();
    await eventually(() =>
      expect(
        document.querySelector(
          'select[aria-label="Stock for Honey Onyx"] option[value="' + stockId + '"]'
        )
      ).not.toBeNull()
    );
    expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')).toBeNull();
    const select = document.querySelector(
      'select[aria-label="Stock for Honey Onyx"]'
    ) as HTMLSelectElement;
    act(() => {
      select.value = stockId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await eventually(() =>
      expect(
        document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent
      ).toContain("$150.00")
    );
    const call = api.mock.calls.find(([url]) => String(url).endsWith("/cart-review"));
    expect(call?.[1].data).toEqual({
      lines: [{ inventoryPublicId: stockId, quantity: 1 }],
      fulfillment: { method: "pickup" },
    });
    expect(JSON.stringify(call?.[1].data)).not.toMatch(/price|Cents|cost/i);
    click(button("Increase Honey Onyx quantity"));
    await eventually(() =>
      expect(
        document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent
      ).toContain("$200.00")
    );
    expect(document.body.textContent).toContain("Quantity rate applied");
  });
  it("restores legacy selections but removes persisted price authority", async () => {
    window.localStorage.setItem(
      JW_STONE_LEGACY_CART_STORAGE_PREFIX + viewer,
      JSON.stringify([
        {
          id: "old-selection",
          stoneName: "Honey Onyx",
          stoneKey: "honey onyx",
          quantity: 2,
          slabRateCents: 1,
          minimumTotalCents: 1,
          maximumTotalCents: 1,
        },
      ])
    );
    render();
    await eventually(() =>
      expect(
        document
          .querySelector('[data-testid="jw-stone-member-cart-button"]')
          ?.getAttribute("aria-label")
      ).toContain("2 slabs")
    );
    click(document.querySelector('[data-testid="jw-stone-member-cart-button"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).not.toBeNull()
    );
    expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')).toBeNull();
    expect(window.localStorage.getItem(JW_STONE_LEGACY_CART_STORAGE_PREFIX + viewer)).toBeNull();
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer)).not.toMatch(
      /RateCents|TotalCents|landed/
    );
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer)).toContain(
      "old-selection"
    );
  });
  it("carries stock and quantities into the native editable quote form", async () => {
    render(stockId);
    await add();
    await eventually(() =>
      expect(
        document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent
      ).toContain("$150.00")
    );
    click(document.querySelector('[data-testid="jw-cart-request-quote"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="native-quote-handoff"]')).not.toBeNull()
    );
    const text = document.querySelector('[data-testid="native-quote-handoff"]')?.textContent;
    expect(text).toContain(stockId);
    expect(text).toContain("1 slab(s): Honey Onyx");
    expect(text).toContain("Pickup requested");
    expect(text).toContain("not a final quote");
  });
  it("does not display or overwrite the previous member's cart when accounts change", async () => {
    render();
    await add();
    click(button("Increase Honey Onyx quantity"));
    await eventually(() =>
      expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + "member-a")).toContain(
        '"quantity":2'
      )
    );
    viewer = "member-b";
    render();
    await eventually(() =>
      expect(
        document
          .querySelector('[data-testid="jw-stone-member-cart-button"]')
          ?.getAttribute("aria-label")
      ).toContain("0 slabs")
    );
    expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull();
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + "member-a")).toContain(
      '"quantity":2'
    );
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + "member-b")).toBe("[]");
  });
  it("removes cart access when the server rejects the membership during review", async () => {
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')).not.toBeNull()
    );
    denied = true;
    click(
      [...document.querySelectorAll("button")].find(
        (element) => element.textContent === "Recheck total"
      ) || null
    );
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull()
    );
    expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')).toBeNull();
  });
  it("rejects a late response for a different member or changed quantity", () => {
    const request = { lines: [{ inventoryPublicId: stockId, quantity: 1 }] };
    expect(() => parseJwStoneCartReview(makeReview("member-a"), "member-b", request)).toThrow();
    expect(() => parseJwStoneCartReview(makeReview("member-a", 2), "member-a", request)).toThrow();
  });
  it("builds a seven-slab bundle in one click, then removes the discount below seven", async () => {
    bundleMode = true;
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-builder"]')?.textContent).toContain(
        "Add 6 more eligible slabs"
      )
    );
    expect(document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("1");
    click(document.querySelector('[data-testid="jw-bundle-complete-line"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-builder"]')?.textContent).toContain(
        "Bundle pricing unlocked"
      )
    );
    expect(document.querySelector('[data-testid="jw-bundle-savings"]')?.textContent).toContain(
      "$350.00"
    );
    expect(
      document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent
    ).toContain("$700.00");
    expect(document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("7");
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer)).toContain(
      '"quantity":7'
    );
    click(button("Decrease Honey Onyx quantity"));
    expect(document.querySelector('[data-testid="jw-bundle-savings"]')).toBeNull();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-builder"]')?.textContent).toContain(
        "Add 1 more eligible slab"
      )
    );
    expect(
      document.querySelector('[data-testid="jw-cart-reviewed-subtotal"]')?.textContent
    ).toContain("$900.00");
    expect(document.querySelector('[data-testid="jw-bundle-savings"]')).toBeNull();
  });
  it("does not offer one-click completion beyond server-checked available stock", async () => {
    bundleMode = true;
    bundleAvailable = 5;
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-builder"]')?.textContent).toContain(
        "Add 6 more eligible slabs"
      )
    );
    expect(document.querySelector('[data-testid="jw-bundle-complete-line"]')).toBeNull();
  });
  it("removes stale savings and unlocked claims when rechecking fails", async () => {
    bundleMode = true;
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-complete-line"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-bundle-complete-line"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-savings"]')).not.toBeNull()
    );
    bundleFailure = true;
    click(
      [...document.querySelectorAll("button")].find(
        (element) => element.textContent === "Recheck total"
      ) || null
    );
    await eventually(() =>
      expect(document.body.textContent).toContain("The total could not be checked")
    );
    expect(document.querySelector('[data-testid="jw-bundle-savings"]')).toBeNull();
    expect(document.querySelector('[data-testid="jw-bundle-builder"]')?.textContent).not.toContain(
      "Bundle pricing unlocked"
    );
  });
  it("carries the checked bundle quantities and savings into the quote request", async () => {
    bundleMode = true;
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-complete-line"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-bundle-complete-line"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-bundle-savings"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-cart-request-quote"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="native-quote-handoff"]')?.textContent).toContain(
        "Seven-slab bundle pricing applied to 7 eligible slabs"
      )
    );
    expect(document.querySelector('[data-testid="native-quote-handoff"]')?.textContent).toContain(
      "$350.00"
    );
  });
  it("rejects malformed storage and discards price fields in otherwise valid selections", () => {
    expect(restoreJwStoneCart({})).toEqual([]);
    expect(
      restoreJwStoneCart([
        { id: "x", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: -1 },
      ])
    ).toEqual([]);
    expect(
      restoreJwStoneCart([
        {
          id: "x",
          stoneName: "Honey Onyx",
          stoneKey: "honey onyx",
          quantity: 1,
          landedCostCents: 55,
        },
      ])
    ).toEqual([{ id: "x", stoneName: "Honey Onyx", stoneKey: "honey onyx", quantity: 1 }]);
  });
  it("reuses one reservation operation id after an ambiguous response and never starts payment", async () => {
    holdFailures = 1;
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-cart-reserve-stock"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-cart-reserve-stock"]'));
    await eventually(() =>
      expect(document.body.textContent).toContain("Reservation response was interrupted.")
    );
    expect(holdRequests).toHaveLength(1);
    expect(operationRecoveries).toHaveLength(1);
    const firstOperationId = holdRequests[0].idempotencyKey;
    expect(firstOperationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(holdRequests[0]).toMatchObject({
      lines: [{ inventoryPublicId: stockId, quantity: 1 }],
      expectedSubtotalCents: 15000,
      fulfillment: { method: "pickup" },
    });
    click(document.querySelector('[data-testid="jw-cart-reserve-stock"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull()
    );
    expect(holdRequests).toHaveLength(2);
    expect(holdRequests[1].idempotencyKey).toBe(firstOperationId);
    expect(JSON.stringify(holdRequests[1])).not.toMatch(/payment|card|checkout/i);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("recovers a successful-but-lost reservation without issuing a second reserve", async () => {
    holdFailures = 1;
    recoverCreatedHold = true;
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-cart-reserve-stock"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-cart-reserve-stock"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull()
    );
    expect(holdRequests).toHaveLength(1);
    expect(operationRecoveries).toHaveLength(1);
    expect(operationRecoveries[0]).toContain(holdRequests[0].idempotencyKey);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("uses the confirmed hold cache to block a second cart reservation", async () => {
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-cart-reserve-stock"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-cart-reserve-stock"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull()
    );
    expect(holdRequests).toHaveLength(1);

    click(document.querySelector('[data-testid="jw-stone-member-cart-button"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).not.toBeNull()
    );
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-cart-owned-reservation-line"]')?.textContent)
        .toContain("1 slab already reserved")
    );
    const reserve = document.querySelector(
      '[data-testid="jw-cart-reserve-stock"]'
    ) as HTMLButtonElement;
    expect(reserve.disabled).toBe(true);
    expect(reserve.textContent).toContain("Active reservation already exists");
    act(() => reserve.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(holdRequests).toHaveLength(1);
  });

  it("opens a full-cart offer with the displayed total without changing saved quantities", async () => {
    render(stockId);
    await add();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-cart-make-offer"]')).not.toBeNull()
    );
    const saved = window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer);
    click(document.querySelector('[data-testid="jw-cart-make-offer"]'));
    await eventually(() =>
      expect(document.querySelector('[data-testid="native-offer-handoff"]')).not.toBeNull()
    );
    expect(
      JSON.parse(document.querySelector('[data-testid="native-offer-handoff"]')!.textContent!)
    ).toMatchObject({
      scope: "cart",
      viewerId: viewer,
      displayedSubtotalCents: 15000,
      selection: { lines: [{ inventoryPublicId: stockId, quantity: 1 }] },
    });
    expect(window.localStorage.getItem(JW_STONE_CART_STORAGE_PREFIX + viewer)).toBe(saved);
  });
});
