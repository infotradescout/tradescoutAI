// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BidRockCatalogResponse } from "@shared/bidrock";
import BidRockWorkspace from "./BidRockWorkspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  placeMaximum: vi.fn(),
  authenticated: false,
  catalog: null as BidRockCatalogResponse | null,
}));

const baseListing: BidRockCatalogResponse["listings"][number] = {
  id: "listing-1",
  sourceProfileSlug: "jw-stone",
  sourceProfileName: "JW Stone",
  assetKind: "slab",
  materialSlug: "blue-dunes",
  title: "Blue Dunes",
  materialFamily: "Granite",
  imageUrl: "https://images.example.test/blue-dunes.jpg",
  dimensions: { length: 133, height: 78.5, unit: "in" },
  quantity: 8,
  unit: "slabs",
  finishQuantities: [{ finish: "Polished", slabCount: 8 }],
  status: "active",
  fresh: true,
  saleReady: true,
  saved: false,
  lastConfirmedAt: "2026-08-20T12:00:00.000Z",
  confirmationExpiresAt: "2026-10-04T12:00:00.000Z",
  canManage: false,
  canOffer: false,
  auction: {
    id: "bra_1234567890abcdefghijklmnop",
    lotNumber: "BR-000101",
    status: "live",
    startsAt: "2026-08-20T10:00:00.000Z",
    endsAt: "2026-08-20T12:30:00.000Z",
    originalEndsAt: "2026-08-20T12:30:00.000Z",
    serverTime: "2026-08-20T12:00:00.000Z",
    bidCount: 3,
    reserveState: "not_met",
    pickupTerms: "Pickup by appointment in Austin, Texas.",
    freightTerms: "Buyer may arrange insured freight after release.",
    softCloseSeconds: 120,
    extended: false,
    canBid: false,
    bidderStatus: "none",
  },
};

function guestCatalog(): BidRockCatalogResponse {
  return {
    generatedAt: "2026-08-20T12:00:00.000Z",
    viewer: {
      authenticated: false,
      admin: false,
      verifiedBusiness: false,
      accountStatus: "none",
      canSell: false,
    },
    listings: [baseListing],
  };
}

function verifiedCatalog(): BidRockCatalogResponse {
  const auction = baseListing.auction;
  if (!auction) throw new Error("Expected auction fixture");
  return {
    ...guestCatalog(),
    viewer: {
      authenticated: true,
      admin: false,
      verifiedBusiness: true,
      accountStatus: "active",
      canSell: false,
    },
    listings: [
      {
        ...baseListing,
        auction: {
          ...auction,
          canBid: true,
          openingBid: { amountCents: 200_000, currency: "USD" },
          currentBid: { amountCents: 225_000, currency: "USD" },
          minimumNextBid: { amountCents: 230_000, currency: "USD" },
          minimumIncrement: { amountCents: 5_000, currency: "USD" },
        },
      },
    ],
  };
}

const invalidateQueries = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries, setQueryData: vi.fn() }),
    useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const root = String(queryKey[0] || "");
      const leaf = String(queryKey[1] || "");
      const data = root === "profile-account" ? null : leaf === "catalog" ? mocks.catalog : [];
      return {
        data,
        isLoading: false,
        isError: false,
        refetch: vi.fn().mockResolvedValue({ data }),
      };
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: mocks.authenticated }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null }));
vi.mock("@/components/profile/PublicProfileAccountDialog", () => ({
  PublicProfileAccountDialog: () => null,
}));
vi.mock("@/components/profile/profileAccountClient", () => ({
  loadProfileAccountState: vi.fn(),
  profileAccountActionLabel: () => "Create business account",
}));
vi.mock("./bidrockClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./bidrockClient")>();
  return { ...actual, placeBidRockMaximum: mocks.placeMaximum };
});

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function setInput(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function buttonContaining(scope: ParentNode, text: string): HTMLButtonElement | null {
  return (
    [...scope.querySelectorAll("button")].find((button) => button.textContent?.includes(text)) ??
    null
  );
}

describe("BidRock auction-first routed workspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.catalog = guestCatalog();
    mocks.authenticated = false;
    mocks.placeMaximum.mockReset();
    mocks.placeMaximum.mockResolvedValue(verifiedCatalog().listings[0].auction);
    invalidateQueries.mockClear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 1023px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    container.remove();
    document.body
      .querySelectorAll('[data-testid="bidrock-mobile-lot-detail"]')
      .forEach((node) => node.remove());
  });

  function render() {
    root = createRoot(container);
    act(() => root.render(<BidRockWorkspace />));
  }

  it("makes the first screen unmistakably a timed stone auction with countdown and activity", () => {
    render();
    expect(container.textContent).toContain("Natural and engineered stone on the block");
    expect(container.textContent).toContain("Business-only stone auction house");
    expect(container.textContent).toContain("Auction floor");
    expect(container.textContent).toContain("Closing soon");
    expect(container.textContent).toContain("BR-000101");
    expect(container.textContent).toContain("Open lot");
    expect(container.textContent).toContain("Watch");
    expect(container.textContent).toContain("slab");
    expect(container.textContent).toContain("1 timed lot");
    expect(container.textContent).not.toContain("1 timed lots");
    expect(container.textContent).toContain("3 bids");
    expect(container.textContent).toContain("30m 00s");
    expect(container.textContent).not.toContain("Inventory workspace");
    expect(container.textContent).not.toContain("Submit offer");
  });

  it("redacts every dollar amount for a guest while retaining non-price activity", () => {
    render();
    expect(container.textContent).toContain("Bid values private");
    expect(container.textContent).toContain("Business verification required to view bids");
    expect(container.textContent).toContain("Reserve not met");
    expect(container.textContent).not.toContain("$");
  });

  it("keeps the comparison title readable and uses singular bid grammar", () => {
    const secondAuction = baseListing.auction;
    if (!secondAuction) throw new Error("Expected auction fixture");
    mocks.catalog = {
      ...guestCatalog(),
      listings: [
        baseListing,
        {
          ...baseListing,
          id: "listing-2",
          materialSlug: "cristallo",
          title: "Cristallo",
          auction: {
            ...secondAuction,
            id: "bra_1234567890abcdefghijklmnox",
            lotNumber: "BR-000102",
            bidCount: 1,
          },
        },
      ],
    };
    render();
    const cards = [
      container.querySelector('[data-testid="bidrock-listing-listing-1"]'),
      container.querySelector('[data-testid="bidrock-listing-listing-2"]'),
    ];
    const compareButtons = cards.map((card) => buttonContaining(card ?? container, "Compare"));
    const saveButtons = cards.map((card) => buttonContaining(card ?? container, "Watch"));
    for (const button of [...compareButtons, ...saveButtons]) {
      expect(button?.className).toContain("text-stone-700");
      expect(button?.className).not.toMatch(/(?:^|\s)text-white(?:\/\d+)?(?:\s|$)/);
    }
    click(compareButtons[0] ?? null);
    click(compareButtons[1] ?? null);
    const selectedCompare = buttonContaining(container, "Compared");
    expect(selectedCompare?.className).toContain("text-stone-950");
    expect(selectedCompare?.className).not.toMatch(/(?:^|\s)text-white(?:\/\d+)?(?:\s|$)/);
    const compareCount = buttonContaining(container, "Compare 2");
    expect(compareCount?.className).toContain("text-stone-700");
    expect(compareCount?.className).not.toMatch(/(?:^|\s)text-white(?:\/\d+)?(?:\s|$)/);
    click(compareCount);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.querySelector("h2")?.className).toContain("text-stone-950");
    expect(dialog?.textContent).toContain("3 bids · not met");
    expect(dialog?.textContent).toContain("1 bid · not met");
    expect(dialog?.textContent).not.toContain("1 bids");
  });

  it("opens the selected auction in a mobile sheet without losing lot context", () => {
    render();
    expect(container.querySelector('[aria-label="Auction filters"]')?.className).toContain(
      "lg:block"
    );
    expect(container.querySelector("details")?.className).toContain("lg:hidden");
    click(container.querySelector('[aria-label="Open BR-000101: Blue Dunes"]'));
    const mobileDetail = document.body.querySelector('[data-testid="bidrock-mobile-lot-detail"]');
    expect(mobileDetail).not.toBeNull();
    expect(mobileDetail?.textContent).toContain("BR-000101");
    expect(mobileDetail?.textContent).toContain("133 × 78.5 in");
  });

  it("lets a verified business place a private maximum bid from the primary action", async () => {
    mocks.catalog = verifiedCatalog();
    mocks.authenticated = true;
    render();
    const input = container.querySelector<HTMLInputElement>('[aria-label="Your maximum bid"]');
    if (!input) throw new Error("Expected maximum-bid input");
    setInput(input, "2500");
    await act(async () => {
      buttonContaining(container, "Place bid")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.placeMaximum).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionId: "bra_1234567890abcdefghijklmnop",
        maximumBid: "2500",
      })
    );
  });

  it("keeps bidding available through a soft-close window after discovery freshness expires", () => {
    const catalog = verifiedCatalog();
    mocks.catalog = {
      ...catalog,
      listings: catalog.listings.map((listing) => ({
        ...listing,
        fresh: false,
        saleReady: false,
      })),
    };
    mocks.authenticated = true;
    render();
    expect(container.querySelector('[aria-label="Your maximum bid"]')).not.toBeNull();
    expect(buttonContaining(container, "Place bid")).not.toBeNull();
  });

  it("preserves the typed maximum when a recoverable bid submission fails", async () => {
    mocks.catalog = verifiedCatalog();
    mocks.authenticated = true;
    mocks.placeMaximum.mockRejectedValueOnce(new Error("Auction changed while placing bid"));
    render();
    const input = container.querySelector<HTMLInputElement>('[aria-label="Your maximum bid"]');
    if (!input) throw new Error("Expected maximum-bid input");
    setInput(input, "2600");
    await act(async () => {
      buttonContaining(container, "Place bid")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(input.value).toBe("2600");
  });
});
