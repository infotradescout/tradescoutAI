// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BidRockCatalogResponse } from "@shared/bidrock";
import BidRockWorkspace from "./BidRockWorkspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const catalog: BidRockCatalogResponse = {
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
      materialSlug: "blue-dunes",
      title: "Blue Dunes",
      materialFamily: "Granite",
      imageUrl: null,
      dimensions: { length: 133, height: 78.5, unit: "in" },
      quantity: 8,
      unit: "slabs",
      finishQuantities: [],
      status: "active",
      fresh: true,
      saleReady: true,
      saved: false,
      lastConfirmedAt: "2026-08-20T12:00:00.000Z",
      confirmationExpiresAt: "2026-10-04T12:00:00.000Z",
      canManage: false,
      canOffer: false,
    },
  ],
};

const invalidateQueries = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries, setQueryData: vi.fn() }),
    useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      const key = String(queryKey[1] || "");
      const data = key === "catalog" ? catalog : key === "profile-account" ? null : [];
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
  useAuth: () => ({ user: null, isAuthenticated: false }),
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

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("BidRock responsive routed workspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    root = createRoot(container);
    act(() => root.render(<BidRockWorkspace />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body
      .querySelectorAll('[data-testid="bidrock-mobile-lot-detail"]')
      .forEach((node) => node.remove());
  });

  it("opens the selected lot in a mobile detail sheet instead of placing details after results", () => {
    const workspace = container.querySelector('[data-testid="bidrock-workspace"]');
    expect(workspace?.className).toContain("bidrock-theme");
    expect(container.querySelector('[aria-label="Market filters"]')?.className).toContain(
      "lg:block"
    );
    expect(container.querySelector("details")?.className).toContain("lg:hidden");

    click(container.querySelector('[aria-label="Open Blue Dunes details"]'));
    const mobileDetail = document.body.querySelector('[data-testid="bidrock-mobile-lot-detail"]');
    expect(mobileDetail).not.toBeNull();
    expect(mobileDetail?.className).toContain("lg:hidden");
    expect(mobileDetail?.textContent).toContain("Blue Dunes");
    expect(mobileDetail?.textContent).toContain("133 × 78.5 in");
  });
});
