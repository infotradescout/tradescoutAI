// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExchangeListingDetail from "./ExchangeListingDetail";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  listing: null as any,
  listingId: "tradescout-stone-aj-quartz",
  authUser: null as any,
  authLoading: false,
  query: null as any,
  enforceKey: false,
  allowedKey: "",
  seo: null as any,
  share: vi.fn(),
  navigate: vi.fn(),
  mutate: vi.fn(),
  executeMutations: false,
  authRefetch: vi.fn(),
  counties: [] as any[],
  simulateViewerRefetch: false,
  lastListingKey: "",
  listingQueryPhase: "ready" as "ready" | "loading" | "error",
  api: vi.fn(),
}));
vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    useParams: () => ({
      category: state.listing?.category || "building-materials",
      listingId: state.listing?.id || state.listingId,
    }),
    // Mirror Wouter's pathname-only location and use the installed reactive search hook.
    useLocation: () => [window.location.pathname, state.navigate],
    useSearch: actual.useSearch,
  };
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    if (options.queryKey[0] === "/api/counties")
      return { data: state.counties, isLoading: false, isError: false, refetch: vi.fn() };
    if (options.queryKey[0] !== "/api/marketplace/listings")
      return { data: [], isLoading: false, isError: false };
    state.query = options;
    const key = JSON.stringify(options.queryKey);
    if (state.simulateViewerRefetch && state.lastListingKey && key !== state.lastListingKey) {
      state.listingQueryPhase = "loading";
    }
    state.lastListingKey = key;
    if (state.listingQueryPhase === "loading")
      return { data: undefined, isLoading: true, isError: false };
    if (state.listingQueryPhase === "error")
      return { data: undefined, isLoading: false, isError: true };
    return {
      data: state.enforceKey && JSON.stringify(options.queryKey) !== state.allowedKey ? null : state.listing,
      isLoading: false,
      isError: false,
    };
  },
  useMutation: (options: any) => ({
    mutate: (input: any) => {
      state.mutate(input);
      if (state.executeMutations) {
        void Promise.resolve(options.mutationFn(input))
          .then((result) => options.onSuccess?.(result, input))
          .catch((error) => options.onError?.(error))
          .finally(() => options.onSettled?.());
      }
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({
  isAuthenticated: Boolean(state.authUser),
  isLoading: state.authLoading,
  user: state.authUser,
  refetch: state.authRefetch,
}) }));
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

async function changeControl(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), "value")?.set?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("retail stone detail", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    window.history.replaceState({}, "", "/exchange/building-materials/tradescout-stone-aj-quartz");
    window.sessionStorage.clear();
    state.navigate.mockReset();
    state.mutate.mockReset();
    state.executeMutations = false;
    state.authRefetch.mockReset();
    state.counties = [];
    state.simulateViewerRefetch = false;
    state.lastListingKey = "";
    state.listingQueryPhase = "ready";
    state.api.mockReset();
    state.share.mockReset();
    state.listingId = "tradescout-stone-aj-quartz";
    state.authUser = null;
    state.authLoading = false;
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

  it("saves a fresh buyer's explicit home area before a separate stone inquiry send", async () => {
    window.history.replaceState({}, "", `/exchange/building-materials/${state.listingId}?audienceState=TX&audienceCountry=US`);
    state.simulateViewerRefetch = true;
    state.authUser = { id: "new-stone-buyer", email: "buyer@example.test", countryCode: "US", stateCode: null, city: "Dallas", countyFips: null };
    state.counties = [{ fips: "48113", name: "Dallas", stateCode: "TX" }];
    state.api.mockImplementation(async (method: string, path: string, body: any) => {
      if (method === "PUT" && path === "/api/user/profile") return { ...state.authUser, ...body };
      if (method === "POST" && path === "/api/decision-cards") return { id: "stone-home-area-decision" };
      if (method === "POST" && path === "/api/marketplace/inquiries")
        return { id: "stone-home-area-inquiry", listingId: state.listingId, conversationId: "stone-home-area-thread" };
      throw new Error(`Unexpected API call: ${method} ${path}`);
    });
    state.authRefetch.mockImplementation(async () => {
      state.authUser = { ...state.authUser, state: "TX", stateCode: "TX", city: "Dallas", countyFips: "48113", locationCommitted: true };
      return { data: state.authUser, error: null };
    });

    await renderDetail();
    await act(async () => buttonContaining(host, "Ask TradeScout about availability")?.click());
    let dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    const draft = "Please confirm stock for my kitchen project next month.";
    await changeControl(dialog.querySelector("textarea") as HTMLTextAreaElement, draft);
    expect(dialog.querySelector("textarea")?.value).toBe(draft);
    expect(dialog.textContent).toContain("Confirm your home area");
    expect(buttonContaining(dialog, "Confirm & Send")).toBeNull();
    expect(state.api).not.toHaveBeenCalled();

    await changeControl(dialog.querySelector('[data-testid="stone-home-state"]') as HTMLSelectElement, "TX");
    await changeControl(dialog.querySelector('[data-testid="stone-home-county"]') as HTMLSelectElement, "48113");
    expect((dialog.querySelector('[data-testid="stone-home-city"]') as HTMLInputElement).value).toBe("Dallas");
    await act(async () => buttonContaining(dialog, "Save home area")?.click());
    expect(state.api).toHaveBeenCalledWith("PUT", "/api/user/profile", expect.objectContaining({
      stateCode: "TX", city: "Dallas", countyFips: "48113",
    }));
    expect(state.authRefetch).toHaveBeenCalledTimes(1);
    expect(state.api.mock.calls.some(([method, path]) => method === "POST" && path === "/api/marketplace/inquiries")).toBe(false);

    expect(state.listingQueryPhase).toBe("loading");
    expect(host.textContent).toContain("Loading listing");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    state.listingQueryPhase = "ready";
    await renderDetail();
    dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector("textarea")?.value).toBe(draft);
    expect(buttonContaining(dialog, "Confirm & Send")).not.toBeNull();
    state.executeMutations = true;
    await act(async () => buttonContaining(dialog, "Confirm & Send")?.click());
    await vi.waitFor(() => expect(state.api).toHaveBeenCalledWith("POST", "/api/marketplace/inquiries", expect.objectContaining({
      listingId: state.listingId,
      authorityGate: "decision_card",
    })));
  });

  it("drops the retained draft when a changed viewer location makes the stone unavailable", async () => {
    window.history.replaceState({}, "", `/exchange/building-materials/${state.listingId}?audienceState=TX&audienceCountry=US`);
    state.simulateViewerRefetch = true;
    state.authUser = { id: "stone-buyer", countryCode: "US", stateCode: "TX", city: "Dallas", countyFips: "48113" };
    await renderDetail();
    await act(async () => buttonContaining(host, "Ask TradeScout about availability")?.click());
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    await changeControl(dialog.querySelector("textarea") as HTMLTextAreaElement, "Please hold one slab for Tuesday.");

    state.authUser = { ...state.authUser, city: "Austin" };
    await renderDetail();
    expect(host.textContent).toContain("Loading listing");
    state.listingQueryPhase = "error";
    await renderDetail();
    expect(host.textContent).toContain("unavailable in the selected area");
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(state.api).not.toHaveBeenCalled();
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
      expect(state.seo.ogImage).toBe(`${window.location.origin}/api/exchange/stone-media/${state.listingId}${texas}`);
      expect(state.seo.canonical).toBe(`${window.location.origin}${texasPath}`);
      expect(state.seo.omitCanonical).toBe(true);
      expect(state.seo.robots).toBe("noindex, follow");
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Share listing"]')?.click());
      expect(state.share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}${texasPath}` }));
      delete state.listing.specifications.referenceSizesInches;
      await renderDetail();
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Share listing"]')?.click());
      expect(state.share).toHaveBeenLastCalledWith(expect.objectContaining({
        title: expect.stringContaining("Slab price TBD"),
        text: expect.stringContaining("Published material rate $30.00 / sq ft"),
      }));

      await act(async () => {
        window.history.pushState({}, "", `/exchange/building-materials/${state.listingId}?audienceState=FL&audienceCity=Pensacola&audienceCountry=US`);
      });
      expect(JSON.stringify(state.query.queryKey)).not.toBe(texasKey);
      expect(state.query.enabled).toBe(true);
      expect(host.querySelector("h1")).toBeNull();
      expect(host.textContent).toContain("This stone is unavailable in the selected area or can no longer be found.");
      expect(host.textContent).not.toContain("has been removed");
      await expect(state.query.queryFn()).rejects.toThrow("Listing not found");
      expect(fetchMock).toHaveBeenLastCalledWith(`/api/marketplace/listings/${state.listingId}?audienceState=FL&audienceCity=Pensacola&audienceCountry=US`);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("normalizes a non-Florida city before fetching the server-qualified stone path", async () => {
    window.history.replaceState({}, "", `/exchange/building-materials/${state.listingId}?audienceState=TX&audienceCity=Dallas&audienceCountry=US`);
    state.listing = null;
    const expectedPath = `/exchange/building-materials/${state.listingId}?audienceState=TX&audienceCountry=US`;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ...retailListing, publicDetailPath: expectedPath }),
    } as Response);
    try {
      await renderDetail();
      const result = await state.query.queryFn();
      expect(fetchMock).toHaveBeenCalledWith(`/api/marketplace/listings/${state.listingId}?audienceState=TX&audienceCountry=US`);
      expect(result.publicDetailPath).toBe(expectedPath);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("hides guest stone data while auth resolves and isolates an excluded account at the same URL", async () => {
    const texas = "?audienceState=TX&audienceCountry=US";
    window.history.replaceState({}, "", `/exchange/building-materials/${state.listingId}${texas}`);
    state.listing = null;
    state.enforceKey = true;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        ...retailListing,
        publicDetailPath: `/exchange/building-materials/${state.listingId}${texas}`,
      }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    try {
      await renderDetail();
      const guestKey = JSON.stringify(state.query.queryKey);
      state.listing = await state.query.queryFn();
      state.allowedKey = guestKey;
      await renderDetail();
      expect(host.querySelector("h1")?.textContent).toBe("AJ Quartz");

      state.authLoading = true;
      await renderDetail();
      expect(state.query.enabled).toBe(false);
      expect(host.querySelector("h1")).toBeNull();
      expect(host.textContent).toContain("Loading listing");

      state.authUser = { id: "synthetic-pensacola-viewer", city: "Pensacola", stateCode: "FL", countryCode: "US" };
      state.authLoading = false;
      await renderDetail();
      expect(JSON.stringify(state.query.queryKey)).not.toBe(guestKey);
      expect(state.query.queryKey[3]).toEqual(["synthetic-pensacola-viewer", "Pensacola", "FL", "US"]);
      expect(host.querySelector("h1")).toBeNull();
      expect(host.textContent).toContain("unavailable in the selected area");
      await expect(state.query.queryFn()).rejects.toThrow("Listing not found");
      expect(fetchMock).toHaveBeenLastCalledWith(`/api/marketplace/listings/${state.listingId}${texas}`);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("retains the ordinary listing error wording outside the stone channel", async () => {
    state.listing = null;
    state.listingId = "ordinary-listing";
    window.history.replaceState({}, "", "/exchange/building-materials/ordinary-listing");
    await renderDetail();
    expect(host.textContent).toContain("This listing could not be found or has been removed.");
    expect(host.textContent).not.toContain("selected area");
  });
});
