// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExchangeListingDetail from "./ExchangeListingDetail";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  listing: null as any,
  listingId: "tradescout-stone-aj-quartz",
  query: null as any,
  enforceKey: false,
  allowedKey: "",
  seo: null as any,
  share: vi.fn(),
  navigate: vi.fn(),
  mutate: vi.fn(),
  api: vi.fn(),
}));
vi.mock("wouter", () => ({
  useParams: () => ({
    category: state.listing?.category || "building-materials",
    listingId: state.listing?.id || state.listingId,
  }),
  useLocation: () => [window.location.pathname + window.location.search, state.navigate],
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    if (options.queryKey[0] !== "/api/marketplace/listings")
      return { data: [], isLoading: false, isError: false };
    state.query = options;
    return {
      data: state.enforceKey && JSON.stringify(options.queryKey) !== state.allowedKey ? null : state.listing,
      isLoading: false,
      isError: false,
    };
  },
  useMutation: () => ({ mutate: state.mutate, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => state.api(...args) }));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: (props: any) => { state.seo = props; return null; } }));
vi.mock("@/utils/share", () => ({ share: (...args: any[]) => state.share(...args) }));

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
    state.share.mockReset();
    state.listingId = "tradescout-stone-aj-quartz";
    state.query = null;
    state.enforceKey = false;
    state.allowedKey = "";
    state.seo = null;
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

  it("keeps hydration, image, share, and cache scoped to the selected market", async () => {
    const texas = "?audienceState=TX&audienceCountry=US";
    const texasPath = `/exchange/building-materials/${state.listingId}${texas}`;
    window.history.replaceState({}, "", texasPath);
    state.listing = null;
    state.enforceKey = true;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        ...retailListing,
        images: [`/api/exchange/stone-media/${state.listingId}`],
        publicDetailPath: texasPath,
      }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    try {
      await renderDetail();
      const texasKey = JSON.stringify(state.query.queryKey);
      expect(state.query.enabled).toBe(true);
      const normalized = await state.query.queryFn();
      expect(fetchMock).toHaveBeenCalledWith(`/api/marketplace/listings/${state.listingId}${texas}`);
      expect(normalized.publicDetailPath).toBe(texasPath);
      state.listing = normalized;
      state.allowedKey = texasKey;
      await renderDetail();
      expect(host.querySelector("img")?.getAttribute("src")).toBe(`/api/exchange/stone-media/${state.listingId}${texas}`);
      expect(state.seo.ogImage).toBe(`/api/exchange/stone-media/${state.listingId}${texas}`);
      expect(state.seo.canonical).toBe(texasPath);
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Share listing"]')?.click());
      expect(state.share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}${texasPath}` }));
      delete state.listing.specifications.referenceSizesInches;
      await renderDetail();
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Share listing"]')?.click());
      expect(state.share).toHaveBeenLastCalledWith(expect.objectContaining({
        title: expect.stringContaining("Slab price TBD"),
        text: expect.stringContaining("Published material rate $30.00 / sq ft"),
      }));

      window.history.replaceState({}, "", `/exchange/building-materials/${state.listingId}?audienceState=FL&audienceCity=Pensacola&audienceCountry=US`);
      await renderDetail();
      expect(JSON.stringify(state.query.queryKey)).not.toBe(texasKey);
      expect(state.query.enabled).toBe(true);
      expect(host.querySelector("h1")).toBeNull();
      expect(host.textContent).toContain("could not be found");
      await expect(state.query.queryFn()).rejects.toThrow("Listing not found");
      expect(fetchMock).toHaveBeenLastCalledWith(`/api/marketplace/listings/${state.listingId}?audienceState=FL&audienceCity=Pensacola&audienceCountry=US`);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
