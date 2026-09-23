// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExchangeListingDetail from "./ExchangeListingDetail";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  listing: null as any,
  navigate: vi.fn(),
  mutate: vi.fn(),
  api: vi.fn(),
}));
vi.mock("wouter", () => ({
  useParams: () => ({
    category: state.listing?.category || "building-materials",
    listingId: state.listing?.id,
  }),
  useLocation: () => ["/exchange/building-materials/tradescout-stone-aj-quartz", state.navigate],
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) =>
    queryKey[0] === "/api/marketplace/listings"
      ? { data: state.listing, isLoading: false, isError: false }
      : { data: [], isLoading: false, isError: false },
  useMutation: () => ({ mutate: state.mutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => state.api(...args) }));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null }));

const retailListing = {
  id: "tradescout-stone-aj-quartz",
  title: "AJ Quartz | TradeScout Stone",
  description:
    "Importer stock passage repeated across every item. Call for fabrication and installation.",
  price: 30,
  category: "building-materials",
  condition: "new",
  images: ["/synthetic-slab.jpg"],
  location: "United States",
  seller: { id: "trade-scout", name: "TradeScout", rating: 0, verified: false },
  createdAt: "2026-09-20T00:00:00Z",
  featured: false,
  views: 0,
  favorites: 0,
  isLocalPickupOnly: false,
  shippingCost: null,
  sourceType: "tradescout_stone_retail",
  specifications: {
    commerceChannel: "tradescout_stone_retail",
    material: "Engineered Quartz",
    priceUnit: "sqft",
    referenceSizesInches: "128x64, 127.5x64",
  },
};

function buttonContaining(scope: ParentNode, label: string): HTMLButtonElement | null {
  return (
    Array.from(scope.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(label)
    ) || null
  );
}

describe("retail stone detail", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    window.history.replaceState({}, "", "/exchange/building-materials/tradescout-stone-aj-quartz");
    window.sessionStorage.clear();
    state.navigate.mockReset();
    state.mutate.mockReset();
    state.api.mockReset();
    state.listing = structuredClone(retailListing);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  async function renderDetail() {
    await act(async () => root.render(<ExchangeListingDetail />));
  }

  it("shows calculated slab material range beside a contained image and opens review without sending", async () => {
    await renderDetail();
    expect(host.querySelector("h1")?.textContent).toBe("AJ Quartz");
    expect(host.querySelector('[data-testid="exchange-stone-slab-price"]')?.textContent).toBe(
      "$1,700.00–$1,706.67"
    );
    expect(host.querySelector('[data-testid="exchange-stone-unit-rate"]')?.textContent).toBe(
      "$30.00 / sq ft"
    );
    expect(host.textContent).toContain("128 × 64 in, 127.5 × 64 in");
    expect(host.querySelector("img")?.className).toContain("object-contain");
    expect(host.textContent).not.toContain("0 views");
    expect(host.textContent).not.toContain("Importer stock passage");
    expect(host.textContent).not.toContain("Seller profile");
    expect(buttonContaining(host, "Ask TradeScout about availability")).not.toBeNull();
    expect(buttonContaining(host, "Review Protected Connection")).toBeNull();
    await act(async () => buttonContaining(host, "Ask TradeScout about availability")?.click());
    expect(document.body.textContent).toContain("Review your stone request");
    expect(document.body.textContent).toContain("Sign in to send");
    expect(state.api).not.toHaveBeenCalled();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("labels the approved rate as a rate when slab dimensions are missing", async () => {
    delete state.listing.specifications.referenceSizesInches;
    await renderDetail();
    expect(host.textContent).toContain("Slab price TBD");
    expect(host.querySelector('[data-testid="exchange-stone-slab-price"]')?.textContent).toBe(
      "$30.00 / sq ft"
    );
    expect(host.querySelector('[data-testid="exchange-stone-unit-rate"]')).toBeNull();
    expect(host.textContent).toContain("A full slab total needs confirmed dimensions");
  });

  it("keeps a long reference-size list collapsed after the full-slab price", async () => {
    state.listing.specifications.referenceSizesInches = Array.from(
      { length: 17 },
      (_, i) => `${128 - i}x64`
    ).join(", ");
    await renderDetail();
    const price = host.querySelector('[data-testid="exchange-stone-slab-price"]');
    const sizes = host.querySelector("details");
    expect(price).not.toBeNull();
    expect(sizes).not.toBeNull();
    expect(sizes?.open).toBe(false);
    expect(
      price &&
        sizes &&
        (price.compareDocumentPosition(sizes) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).toBe(true);
    expect(sizes?.querySelector("summary")?.textContent).toContain("17 reference sizes");
  });

  it("keeps ordinary Exchange listing detail behavior outside the retail channel", async () => {
    state.listing = {
      ...structuredClone(retailListing),
      id: "ordinary-listing",
      title: "Used cabinet",
      description: "Cabinet pickup description",
      price: 450,
      specifications: {},
    };
    await renderDetail();
    expect(host.querySelector("img")?.className).toContain("object-cover");
    expect(host.textContent).toContain("0 views");
    expect(host.textContent).toContain("Cabinet pickup description");
    expect(host.textContent).toContain("Seller profile");
    expect(host.textContent).toContain("$450");
    expect(buttonContaining(host, "Review Protected Connection")).not.toBeNull();
  });
});
