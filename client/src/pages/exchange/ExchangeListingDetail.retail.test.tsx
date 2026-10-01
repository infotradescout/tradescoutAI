// @vitest-environment jsdom
// Public listing visibility is global; purchase and contact authority remain separate.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import ExchangeListingDetail from "./ExchangeListingDetail";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "@shared/exchangeListingRules";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  listing: null as any, listingId: "tradescout-stone-aj-quartz", authUser: null as any,
  authLoading: false, query: null as any, seo: null as any,
  executeMutation: false, pendingSubmission: null as Promise<unknown> | null,
  share: vi.fn(), navigate: vi.fn(), mutate: vi.fn(), api: vi.fn(),
}));
vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    useParams: () => ({ category: state.listing?.category || "building-materials", listingId: state.listing?.id || state.listingId }),
    useLocation: () => [window.location.pathname, state.navigate], useSearch: actual.useSearch,
  };
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    if (options.queryKey[0] !== "/api/exchange/public-listings") return { data: [], isLoading: false, isError: false };
    state.query = options;
    return { data: state.listing, isLoading: false, isError: false };
  },
  useMutation: (options: any) => ({ mutate: (input: any) => {
    state.mutate(input);
    if (state.executeMutation) state.pendingSubmission = options.mutationFn(input).then((result: any) => options.onSuccess?.(result, input)).finally(() => options.onSettled?.());
  }, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: Boolean(state.authUser), isLoading: state.authLoading, user: state.authUser }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => state.api(...args) }));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: (props: any) => { state.seo = props; return null; } }));
vi.mock("@/utils/share", () => ({ share: (...args: any[]) => state.share(...args) }));

const retailListing = {
  id: "tradescout-stone-aj-quartz", title: "AJ Quartz | TradeScout Stone",
  description: "Approved public description of this quartz material and its finish.",
  price: 30, category: "building-materials", condition: "new", images: ["/synthetic-slab.jpg"],
  publicDetailPath: "/exchange/building-materials/tradescout-stone-aj-quartz",
  location: "United States", seller: { id: "trade-scout", name: "TradeScout", rating: 0, verified: false },
  createdAt: "2026-09-20T00:00:00Z", featured: false, views: 0, favorites: 0,
  isLocalPickupOnly: false, shippingCost: null, sourceType: "tradescout_stone_retail",
  specifications: { commerceChannel: "tradescout_stone_retail", material: "Engineered Quartz", priceUnit: "sqft", referenceSizesInches: "128x64, 127.5x64" },
};
function buttonContaining(scope: ParentNode, label: string): HTMLButtonElement | null {
  return Array.from(scope.querySelectorAll("button")).find(button => button.textContent?.includes(label)) || null;
}

describe("Public Exchange detail and protected action separation", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    window.history.replaceState({}, "", retailListing.publicDetailPath);
    window.sessionStorage.clear();
    for (const mock of [state.navigate, state.mutate, state.api, state.share]) mock.mockReset();
    state.listingId = retailListing.id; state.authUser = null; state.authLoading = false; state.query = null; state.seo = null;
    state.executeMutation = false; state.pendingSubmission = null;
    state.listing = structuredClone(retailListing);
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
  async function renderDetail() { await act(async () => root.render(<ExchangeListingDetail />)); }

  it("keeps a public local-service discovery link separate from the TradeScout material price and protected inquiry", async () => {
    await renderDetail();
    const services = host.querySelector('[data-testid="exchange-stone-local-services"]')!;
    expect(services.textContent).toContain("Fabrication and installation near Pensacola");
    expect(services.textContent).toContain("Pensacola-area kitchen and bathroom projects");
    expect(services.textContent).toContain("Stone material pricing excludes fabrication and installation");
    const link = services.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/u/issa-build/services/countertops-fabrication");
    expect(link.textContent).toBe("Explore ISSA Build services");
    expect(host.querySelector('[data-testid="exchange-stone-slab-price"]')?.textContent).toMatch(/^\$1,700\.00[-–]\$1,706\.67$/);
    expect(host.querySelector('[data-testid="exchange-stone-purchase-details"]')?.textContent).toContain("Listed by TradeScout");
    expect(state.mutate).not.toHaveBeenCalled();
    expect(state.api).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("shows the full-slab range and public description; opening review sends nothing", async () => {
    await renderDetail();
    expect(host.querySelector("h1")?.textContent).toBe("AJ Quartz");
    expect(host.querySelector('[data-testid="exchange-stone-slab-price"]')?.textContent).toBe("$1,700.00–$1,706.67");
    expect(host.querySelector('[data-testid="exchange-stone-unit-rate"]')?.textContent).toBe("$30.00 / sq ft");
    expect(host.textContent).toContain("128 × 64 in, 127.5 × 64 in");
    expect(host.querySelector("img")?.className).toContain("object-contain");
    expect(host.textContent).toContain(retailListing.description);
    expect(host.querySelector('[data-testid="exchange-stone-purchase-details"]')?.textContent).toContain("Listed by TradeScout");
    expect(host.textContent).toContain("Availability: confirm the selected slab and available quantity.");
    expect(host.textContent).toContain("Pickup or delivery options and charges require confirmation before purchase.");
    expect(host.textContent).not.toContain("0 views");
    expect(buttonContaining(host, "Review Protected Connection")).toBeNull();
    await act(async () => buttonContaining(host, "Ask TradeScout about availability")?.click());
    expect(document.body.textContent).toContain("Review your stone request");
    expect(document.body.textContent).toContain("Sign in to send");
    expect(state.api).not.toHaveBeenCalled(); expect(state.mutate).not.toHaveBeenCalled();
  });
  it("does not invent a slab total when only the approved material rate is known", async () => {
    delete state.listing.specifications.referenceSizesInches;
    await renderDetail();
    expect(host.textContent).toContain("Slab price TBD");
    expect(host.querySelector('[data-testid="exchange-stone-slab-price"]')?.textContent).toBe("$30.00 / sq ft");
    expect(host.querySelector('[data-testid="exchange-stone-unit-rate"]')).toBeNull();
    expect(host.textContent).toContain("A full slab total needs confirmed dimensions");
  });
  it("preserves anonymous review through synthetic sign-in and sends only after explicit confirmation", async () => {
    vi.stubGlobal("crypto", webcrypto);
    window.history.replaceState({}, "", retailListing.publicDetailPath + "?audienceState=TX&audienceCountry=US");
    await renderDetail();
    await act(async () => buttonContaining(host, "Ask TradeScout about availability")?.click());
    await act(async () => buttonContaining(document.body, "Sign in to send")?.click());
    expect(state.navigate).toHaveBeenCalledWith(expect.stringContaining("/pre-scout-setup?mode=signin&next="));
    expect(state.api).not.toHaveBeenCalled();
    state.authUser = { id: "synthetic-only-buyer", city: "Dallas", stateCode: "TX", countryCode: "US" };
    await renderDetail();
    expect(document.body.textContent).toContain("Review your stone request");
    expect(state.api).not.toHaveBeenCalled();
    state.executeMutation = true;
    state.api.mockImplementation(async (method: string, path: string, body: any) => {
      if (method === "GET") return { audience: "eligible" };
      if (path === "/api/decision-cards") return { id: "synthetic-only-card" };
      return { id: "synthetic-only-receipt", listingId: body.listingId, conversationId: "synthetic-only-conversation" };
    });
    await act(async () => { buttonContaining(document.body, "Confirm & Send")?.click(); await state.pendingSubmission; });
    expect(state.api.mock.calls.map(call => call[1])).toEqual(["/api/exchange/stone?audienceState=TX&audienceCountry=US", "/api/decision-cards", "/api/marketplace/inquiries"]);
    expect(state.api).toHaveBeenLastCalledWith("POST", "/api/marketplace/inquiries", expect.objectContaining({ listingId: retailListing.id, authorityGate: "decision_card", sourceDecisionCardId: "synthetic-only-card", decisionScope: `marketplace_listing:${retailListing.id}` }));
    expect(document.body.textContent).not.toContain("Review your stone request");
    vi.unstubAllGlobals();
  });
  it("keeps long reference dimensions collapsed after the price", async () => {
    state.listing.specifications.referenceSizesInches = Array.from({ length: 17 }, (_, i) => `${128 - i}x64`).join(", ");
    await renderDetail();
    const price = host.querySelector('[data-testid="exchange-stone-slab-price"]');
    const sizes = host.querySelector("details");
    expect(sizes?.open).toBe(false);
    expect(price && sizes && (price.compareDocumentPosition(sizes) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
    expect(sizes?.querySelector("summary")?.textContent).toContain("17 reference sizes");
  });
  it.each(Object.keys(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME))("%s listings keep price, photos, seller and explicit protected contact", async category => {
    state.listing = { ...structuredClone(retailListing), id: "ordinary-listing", title: `Public ${category} item`, description: "Public pickup description", price: 450,
      category, publicDetailPath: `/exchange/${category}/ordinary-listing`, sourceType: "marketplace_listing", specifications: {} };
    await renderDetail();
    expect(host.querySelector("img")?.className).toContain("object-cover");
    expect(host.textContent).toContain("Public pickup description"); expect(host.textContent).toContain("Seller profile"); expect(host.textContent).toContain("$450");
    expect(state.seo.robots).toBe("index, follow");
    const cta = buttonContaining(host, "Review Protected Connection"); expect(cta).not.toBeNull();
    await act(async () => cta?.click());
    expect(state.navigate).toHaveBeenCalledWith(`/pre-scout-setup?mode=signin&next=${encodeURIComponent(state.listing.publicDetailPath)}`);
    expect(state.mutate).not.toHaveBeenCalled(); expect(state.api).not.toHaveBeenCalled();
  });
  it("uses one anonymous public read, canonical address and photo across buyer markets", async () => {
    const canonical = retailListing.publicDetailPath;
    window.history.replaceState({}, "", canonical + "?audienceState=TX&audienceCountry=US");
    state.listing = null;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ ...retailListing, images: [`/exchange/media/${retailListing.id}`] }) } as Response);
    await renderDetail();
    const key = JSON.stringify(state.query.queryKey);
    const normalized = await state.query.queryFn();
    expect(fetchMock).toHaveBeenCalledWith(`/api/exchange/public-listings/${retailListing.id}`, { credentials: "omit" });
    expect(normalized.publicDetailPath).toBe(canonical);
    state.listing = normalized; await renderDetail();
    expect(host.querySelector("img")?.getAttribute("src")).toBe(`/exchange/media/${retailListing.id}`);
    expect(state.seo.canonical).toBe(window.location.origin + canonical);
    expect(state.seo.robots).toBe("index, follow"); expect(state.seo.omitCanonical).not.toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Share listing"]')?.click());
    expect(state.share).toHaveBeenLastCalledWith(expect.objectContaining({ url: window.location.origin + canonical }));
    await act(async () => window.history.pushState({}, "", canonical + "?audienceState=FL&audienceCity=Pensacola&audienceCountry=US"));
    await renderDetail();
    expect(JSON.stringify(state.query.queryKey)).toBe(key); expect(host.querySelector("h1")?.textContent).toBe("AJ Quartz");
    expect(state.seo.robots).toBe("index, follow"); expect(state.mutate).not.toHaveBeenCalled();
  });
  it("does not hide a public listing while authentication loads or an excluded buyer signs in", async () => {
    await renderDetail(); const key = JSON.stringify(state.query.queryKey);
    state.authLoading = true; await renderDetail();
    expect(state.query.enabled).toBe(true); expect(host.querySelector("h1")?.textContent).toBe("AJ Quartz");
    state.authUser = { id: "synthetic-pensacola-viewer", city: "Pensacola", stateCode: "FL", countryCode: "US" }; state.authLoading = false;
    await renderDetail(); expect(JSON.stringify(state.query.queryKey)).toBe(key); expect(host.querySelector("h1")?.textContent).toBe("AJ Quartz");
    expect(state.api).not.toHaveBeenCalled(); expect(state.mutate).not.toHaveBeenCalled();
  });
  it("rejects a mismatched public response instead of displaying another listing", async () => {
    state.listing = null;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ ...retailListing, id: "wrong-id" }) } as Response);
    await renderDetail(); await expect(state.query.queryFn()).rejects.toThrow("Invalid public listing response");
  });
  it("rejects a market-qualified or external canonical from the public data response", async () => {
    state.listing = null;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ ...retailListing, publicDetailPath: retailListing.publicDetailPath + '?audienceState=TX' }) } as Response);
    await renderDetail(); await expect(state.query.queryFn()).rejects.toThrow("Invalid public listing address");
  });
  it("keeps a missing listing unavailable and noindex rather than conflating location with removal", async () => {
    state.listing = null; state.listingId = "ordinary-listing";
    await renderDetail(); expect(host.textContent).toContain("This listing is unavailable or could not be loaded."); expect(state.seo.noIndex).toBe(true);
    expect(host.textContent).not.toContain("selected area");
  });
  it.each([[0, "Free"], [null, "Request price"]])("distinguishes an ordinary price %s as %s", async (price, label) => {
    state.listing = { ...structuredClone(retailListing), id: "ordinary-listing", sourceType: "marketplace_listing", specifications: {}, price, pricingMode: price == null ? "request_quote" : "fixed" };
    await renderDetail(); expect(host.textContent).toContain(String(label));
  });
});
