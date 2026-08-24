// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BidRockCatalogResponse } from "@shared/bidrock";
import BidRockWorkspace from "./BidRockWorkspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  userId: "buyer-a" as string | null,
  catalog: null as BidRockCatalogResponse | null,
  loadCatalog: vi.fn(),
}));

const guestCatalog: BidRockCatalogResponse = {
  generatedAt: "2026-08-20T12:00:00.000Z",
  viewer: {
    authenticated: false,
    admin: false,
    verifiedBusiness: false,
    accountStatus: "none",
    canSell: false,
  },
  listings: [
    {
      id: "listing-1",
      sourceProfileSlug: "jw-stone",
      sourceProfileName: "JW Stone",
      assetKind: "slab",
      materialClass: "natural_stone",
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
        freightTerms: "Buyer-arranged insured freight.",
        softCloseSeconds: 120,
        extended: false,
        canBid: false,
        bidderStatus: "none",
      },
    },
  ],
};

const verifiedCatalog: BidRockCatalogResponse = {
  ...guestCatalog,
  viewer: {
    authenticated: true,
    admin: false,
    verifiedBusiness: true,
    accountStatus: "active",
    canSell: false,
  },
  listings: guestCatalog.listings.map((listing) => ({
    ...listing,
    auction: listing.auction
      ? {
          ...listing.auction,
          canBid: true,
          currentBid: { amountCents: 225_000, currency: "USD" },
          minimumNextBid: { amountCents: 230_000, currency: "USD" },
          openingBid: { amountCents: 200_000, currency: "USD" },
          minimumIncrement: { amountCents: 5_000, currency: "USD" },
          ownMaximumBid: { amountCents: 250_000, currency: "USD" },
          bidderStatus: "leading",
        }
      : undefined,
  })),
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.userId ? { id: mocks.userId } : null,
    isAuthenticated: Boolean(mocks.userId),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null }));
vi.mock("@/components/profile/PublicProfileAccountDialog", () => ({
  PublicProfileAccountDialog: () => null,
}));
vi.mock("@/components/profile/profileAccountClient", () => ({
  loadProfileAccountState: vi.fn().mockResolvedValue(null),
  profileAccountActionLabel: () => "Create business account",
}));
vi.mock("./bidrockClient", () => ({
  loadBidRockCatalog: (...args: unknown[]) => mocks.loadCatalog(...args),
  loadBidRockProviderAssignments: vi.fn().mockResolvedValue([]),
  loadBidRockSellerInventory: vi.fn().mockResolvedValue([]),
  loadBidRockOrders: vi.fn().mockResolvedValue([]),
  loadBidRockOrder: vi.fn().mockResolvedValue(null),
  placeBidRockMaximum: vi.fn(),
  cancelBidRockOrder: vi.fn(),
  closeExpiredBidRockAuctions: vi.fn(),
  completeBidRockOrder: vi.fn(),
  configureBidRockAuction: vi.fn(),
  expireBidRockHolds: vi.fn(),
  importBidRockConfirmedStock: vi.fn(),
  linkBidRockOrderSystems: vi.fn(),
  markBidRockPaymentReady: vi.fn(),
  projectBidRockInventory: vi.fn(),
  recordBidRockHandoff: vi.fn(),
  setBidRockDelegation: vi.fn(),
  setBidRockPublication: vi.fn(),
  setBidRockSaved: vi.fn(),
  settleBidRockAch: vi.fn(),
}));

async function flushQueries() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("BidRock viewer-scoped catalog cache", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    mocks.userId = "buyer-a";
    mocks.catalog = verifiedCatalog;
    mocks.loadCatalog.mockReset();
    mocks.loadCatalog.mockImplementation(async () => mocks.catalog);
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it("does not reuse a verified buyer's dollar data after the same client becomes a guest", async () => {
    const renderWorkspace = () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <BidRockWorkspace />
        </QueryClientProvider>
      );

    act(renderWorkspace);
    await flushQueries();
    expect(container.textContent).toContain("$2,250.00");
    expect(container.textContent).toContain("$2,500.00");

    mocks.userId = null;
    mocks.catalog = guestCatalog;
    act(renderWorkspace);
    await flushQueries();

    expect(container.textContent).toContain("Bid values private");
    expect(container.textContent).not.toContain("$");
    expect(mocks.loadCatalog).toHaveBeenCalledTimes(2);
  });
});
