// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { JwStoneMemberPricingProvider, JwStoneMemberPriceDisplay } from "./JwStoneMemberPricing";
import type { JwStoneOfferContext } from "@shared/jwStoneOffer";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", async (original) => ({
  ...(await original<typeof import("@/lib/queryClient")>()),
  apiRequest: api,
}));
vi.mock("wouter", () => ({ Link: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
const id = "stone_" + "d".repeat(32);
const stock = {
  id,
  materialName: "Honey Onyx",
  quantity: 20,
  unit: "slabs",
  assetKind: "slab",
  imageUrls: [],
  finishQuantities: [],
  dimensions: { length: 120, height: 60, unit: "in" },
};
const selection = (quantity: number) => ({
  lines: [{ inventoryPublicId: id, quantity }],
  fulfillment: { method: "pickup" as const },
});
const moneyReview = (request: any) => {
  const q = request.lines[0].quantity,
    rate = q >= 7 ? 200 : 300;
  return {
    profileSlug: "jw-stone",
    viewerId: "offer-member",
    currency: "USD",
    sourceUpdatedAt: "2026-09-16T00:00:00.000Z",
    reviewedAt: "2026-09-16T00:00:00.000Z",
    materialReady: true,
    readyForCheckout: false,
    inventoryReserved: false,
    subtotalCents: q * 50 * rate,
    fulfillment: request.fulfillment,
    deliveryFeeCents: null,
    estimatedDeliveryDate: null,
    lines: [
      {
        inventoryPublicId: id,
        requestedQuantity: q,
        availableQuantity: 20,
        materialName: stock.materialName,
        materialSlug: "honey-onyx",
        assetKind: "slab",
        dimensions: stock.dimensions,
        pricingTier: q >= 7 ? "bundle" : "slab",
        unitRateCents: rate,
        oneSlabTotalCents: rate * 50,
        lineTotalCents: q * rate * 50,
        status: "ready",
      },
    ],
  };
};
const click = (el: Element | null) => {
  if (!el) throw Error("Missing click target");
  act(() => (el as HTMLElement).click());
};
function change(el: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!el) throw Error("Missing field");
  act(() => {
    Object.getOwnPropertyDescriptor(
      el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      "value"
    )?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function eventually(check: () => void) {
  let failure: unknown;
  for (let n = 0; n < 80; n++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    try {
      check();
      return;
    } catch (e) {
      failure = e;
    }
  }
  throw failure;
}
const submitButton = () =>
  Array.from(document.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Submit offer")
  )!;
function fill(amount: string) {
  change(document.querySelector('input[aria-label="Your total offer (USD)"]'), amount);
  change(document.querySelector('input[autocomplete="name"]'), "Fixture Buyer");
  change(document.querySelector('input[type="email"]'), "fixture@example.invalid");
  change(document.querySelector('input[name="phone"]'), "2255550102");
  change(
    Array.from(document.querySelectorAll("select")).find((s) =>
      s.closest("label")?.textContent?.includes("I am a")
    )!,
    "fabricator"
  );
  click(document.querySelector('input[aria-label="I understand offer and payment terms"]'));
}
function submitTwice() {
  act(() => {
    const form = document.querySelector("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
describe("JW Stone real offer form", () => {
  let root: Root,
    host: HTMLDivElement,
    client: QueryClient,
    fetchMock: ReturnType<typeof vi.fn>,
    access: string,
    reviewUnavailable: boolean;
  beforeEach(() => {
    access = "member";
    reviewUnavailable = false;
    localStorage.clear();
    api.mockReset();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        requestId: "fixture-offer",
        offerStatus: "pending_review",
        paymentAllowed: false,
        inventoryReserved: false,
        deliveryCustody: "business",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.mockImplementation(async (first: string, second?: any) => {
      const url = first === "GET" ? second : first;
      if (url.endsWith("/member-pricing")) {
        if (access === "none") throw Object.assign(Error("Membership required"), { status: 403 });
        return {
          profileSlug: "jw-stone",
          viewerId: "offer-member",
          access,
          currency: "USD",
          unit: "square_foot",
          sourceUpdatedAt: "2026-09-16T00:00:00.000Z",
          prices: [
            {
              stoneName: "Honey Onyx",
              stoneKey: "honey onyx",
              slabPriceCents: 300,
              bundlePriceCents: 200,
              ...(access === "internal" ? { landedCostCents: 100 } : {}),
            },
          ],
        };
      }
      if (url.endsWith("/current")) return { profileSlug: "jw-stone", items: [stock] };
      if (url.endsWith("/cart-review")) {
        if (reviewUnavailable) throw Error("Pricing unavailable");
        return moneyReview(second.data);
      }
      throw Error("Unexpected API " + url);
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    vi.unstubAllGlobals();
  });
  const renderOffer = (context: JwStoneOfferContext) =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <ExpressDirectConnectPanel
            open
            onClose={() => {}}
            profileSlug="jw-stone"
            businessName="JW Stone"
            hasViewerSession
            allowCall={false}
            requestMode="materials"
            initialView="request"
            jwStoneOffer={context}
          />
        </QueryClientProvider>
      )
    );
  const renderCatalog = () =>
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <JwStoneMemberPricingProvider viewerId="offer-member">
            <JwStoneMemberPriceDisplay
              stoneName="Honey Onyx"
              inventoryPublicId={id}
              slabDimensions="120 x 60"
            />
          </JwStoneMemberPricingProvider>
        </QueryClientProvider>
      )
    );
  it("sends one pending stone offer on a double submit and never requests payment", async () => {
    renderOffer({
      scope: "stone",
      viewerId: "offer-member",
      stoneName: "Honey Onyx",
      inventoryPublicId: id,
    });
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-offer-listed-total"]')?.textContent).toBe(
        "$150.00"
      )
    );
    fill("120.25");
    await eventually(() => expect(submitButton().disabled).toBe(false));
    submitTwice();
    await eventually(() => expect(host.textContent).toContain("Offer submitted — pending review"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.requestType).toBe("make_offer");
    expect(payload.stoneOffer).toMatchObject({
      scope: "stone",
      offeredTotalCents: 12025,
      expectedSubtotalCents: 15000,
      termsAcknowledged: true,
    });
    expect(payload.stoneOffer.paymentAllowed).toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tradepartner-profiles/jw-stone/express-request");
    expect(host.textContent).toContain("No payment is accepted until JW Stone confirms");
  });
  it("uses the full cart quantity and already-discounted listed total", async () => {
    renderOffer({
      scope: "cart",
      viewerId: "offer-member",
      selection: selection(7),
      displayedSubtotalCents: 70000,
    });
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-offer-listed-total"]')?.textContent).toBe(
        "$700.00"
      )
    );
    fill("620");
    await eventually(() => expect(submitButton().disabled).toBe(false));
    submitTwice();
    await eventually(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stoneOffer).toMatchObject({
      scope: "cart",
      offeredTotalCents: 62000,
      expectedSubtotalCents: 70000,
      selection: selection(7),
    });
  });
  it("blocks stale cart totals even if a submit event is dispatched directly", async () => {
    renderOffer({
      scope: "cart",
      viewerId: "offer-member",
      selection: selection(7),
      displayedSubtotalCents: 69999,
    });
    await eventually(() => expect(host.textContent).toContain("The cart total changed"));
    fill("600");
    submitTwice();
    expect(submitButton().disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not submit without checked pricing or a valid amount", async () => {
    reviewUnavailable = true;
    renderOffer({
      scope: "stone",
      viewerId: "offer-member",
      stoneName: "Honey Onyx",
      inventoryPublicId: id,
    });
    await eventually(() =>
      expect(host.textContent).toContain("Prices and stock could not be checked")
    );
    fill("1.001");
    submitTwice();
    expect(submitButton().disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("opens stone offers separately without adding or changing cart slabs", async () => {
    renderCatalog();
    await eventually(() =>
      expect(document.querySelector('[data-testid="jw-stone-make-offer-card"]')).not.toBeNull()
    );
    click(document.querySelector('[data-testid="jw-stone-make-offer-card"]'));
    await eventually(() =>
      expect(document.querySelector('input[aria-label="Your total offer (USD)"]')).not.toBeNull()
    );
    expect(localStorage.getItem("tradescout:jw-stone:member-cart:v2:offer-member")).toBe("[]");
    expect(document.querySelector('[data-testid="jw-stone-member-cart"]')).toBeNull();
  });
  it.each(["none", "internal"])(
    "does not expose offer entry points for %s pricing access",
    async (value) => {
      access = value;
      renderCatalog();
      await eventually(() => expect(api).toHaveBeenCalled());
      expect(document.querySelector('[data-testid="jw-stone-make-offer-card"]')).toBeNull();
      expect(document.querySelector('[data-testid="jw-stone-member-cart-button"]')).toBeNull();
    }
  );
});

// This isolated suite assumes licensed tools are ON; real feature admission is exercised by the native feature suite.
vi.mock("./useJwStoneFeatures", () => ({ useJwStoneFeatures: () => ({ enabled: true }) }));
