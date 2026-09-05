// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JwStoneMemberPriceDisplay,
  JwStoneMemberPricingProvider,
  sanitizeJwStonePricingResponse,
} from "./JwStoneMemberPricing";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const apiRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: apiRequestMock };
});

describe("JW Stone member pricing client boundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  async function render(viewerId: string | null) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <JwStoneMemberPricingProvider viewerId={viewerId}>
            <JwStoneMemberPriceDisplay stoneName="Blue Dunes" presentation="detail" />
          </JwStoneMemberPricingProvider>
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    apiRequestMock.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
  });

  it("does not request or render private prices for a signed-out viewer", async () => {
    await render(null);
    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("pricing");
    expect(container.textContent).not.toContain("$");
  });

  it("renders slab and bundle prices while discarding landed cost for a member", async () => {
    const response = {
      profileSlug: "jw-stone",
      viewerId: "member-1",
      currency: "USD",
      unit: "square_foot",
      sourceUpdatedAt: "2026-09-05T02:50:50.000Z",
      access: "member",
      prices: [
        {
          stoneName: "Blue Dunes",
          stoneKey: "blue dunes",
          slabPriceCents: 2050,
          bundlePriceCents: 1850,
          landedCostCents: 1100,
        },
      ],
    };
    queryClient.setQueryData(
      ["jw-stone", "member-pricing", "member-1"],
      sanitizeJwStonePricingResponse(response, "member-1")
    );
    await render("member-1");

    expect(container.textContent).toContain("Business member pricing");
    expect(container.textContent).toContain("$20.50");
    expect(container.textContent).toContain("$18.50");
    expect(container.textContent).not.toContain("landed");
    expect(container.textContent).not.toContain("$11.00");
  });

  it("shows landed cost only for an internal projection bound to the current viewer", async () => {
    const response = {
      profileSlug: "jw-stone",
      viewerId: "staff-1",
      currency: "USD",
      unit: "square_foot",
      sourceUpdatedAt: "2026-09-05T02:50:50.000Z",
      access: "internal",
      prices: [
        {
          stoneName: "Blue Dunes",
          stoneKey: "blue dunes",
          slabPriceCents: 2050,
          bundlePriceCents: 1850,
          landedCostCents: 1100,
        },
      ],
    };
    queryClient.setQueryData(
      ["jw-stone", "member-pricing", "staff-1"],
      sanitizeJwStonePricingResponse(response, "staff-1")
    );
    await render("staff-1");
    expect(container.textContent).toContain("Internal landed cost");
    expect(container.textContent).toContain("$11.00");

    await render("different-viewer");
    expect(container.textContent).not.toContain("$11.00");
  });
});
