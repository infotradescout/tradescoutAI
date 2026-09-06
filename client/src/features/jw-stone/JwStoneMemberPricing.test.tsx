// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  estimateJwStoneSlabCost,
  JwStoneMemberPriceDisplay,
  JwStoneMemberPricingProvider,
  sanitizeJwStonePricingResponse,
  type JwStoneSlabDimensionsInput,
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

  async function render(
    viewerId: string | null,
    slabDimensions: JwStoneSlabDimensionsInput = null
  ) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <JwStoneMemberPricingProvider viewerId={viewerId}>
            <JwStoneMemberPriceDisplay
              stoneName="Blue Dunes"
              slabDimensions={slabDimensions}
              presentation="detail"
            />
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

  it("shows exact quantity labels only when the authorized response supplies a valid minimum", async () => {
    const response = {
      profileSlug: "jw-stone",
      viewerId: "member-1",
      currency: "USD",
      unit: "square_foot",
      sourceUpdatedAt: "2026-09-06T03:00:00Z",
      access: "member",
      prices: [
        {
          stoneName: "Blue Dunes",
          stoneKey: "blue dunes",
          slabPriceCents: 300,
          bundlePriceCents: 200,
          bundleMinSlabs: 2,
        },
      ],
    };
    queryClient.setQueryData(
      ["jw-stone", "member-pricing", "member-1"],
      sanitizeJwStonePricingResponse(response, "member-1")
    );
    await render("member-1");
    expect(container.textContent).toContain("1 slab $3.00");
    expect(container.textContent).toContain("2+ slabs $2.00");
    expect(container.textContent).not.toContain("Bundle");
    for (const minimum of [null, 1, 2.5, 1000, "2"]) {
      expect(
        sanitizeJwStonePricingResponse(
          { ...response, prices: [{ ...response.prices[0], bundleMinSlabs: minimum }] },
          "member-1"
        )
      ).toBeNull();
    }
    await render(null);
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
    await render("member-1", '133×78.5"');

    expect(container.textContent).toContain("Business member pricing");
    expect(container.textContent).toContain("$20.50");
    expect(container.textContent).toContain("$18.50");
    expect(container.textContent).toContain("Approx. slab total");
    expect(container.textContent).toContain("$1,486.32");
    expect(container.textContent).toContain("Confirm the exact slab size");
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

  it("loads prices for the same signed-in viewer after membership changes", async () => {
    apiRequestMock.mockRejectedValueOnce(new Error("Membership required"));
    await render("member-1");
    expect(container.textContent).not.toContain("$");

    apiRequestMock.mockResolvedValue({
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
        },
      ],
    });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["jw-stone", "member-pricing", "member-1"] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("$20.50");
    expect(container.textContent).toContain("$18.50");
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it("removes previously displayed prices when refreshed access is denied", async () => {
    queryClient.setQueryData(["jw-stone", "member-pricing", "member-1"], {
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
        },
      ],
    });
    await render("member-1");
    expect(container.textContent).toContain("$20.50");
    apiRequestMock.mockRejectedValue(new Error("Membership revoked"));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["jw-stone", "member-pricing", "member-1"] });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).not.toContain("$");
  });
});

describe("JW Stone approximate slab cost", () => {
  it("calculates a single slab total from catalog inches", () => {
    expect(estimateJwStoneSlabCost(2050, '133×78.5"')).toEqual({
      minimumTotalCents: 148632,
      maximumTotalCents: 148632,
    });
  });

  it("returns a range when two source-backed slab sizes are recorded", () => {
    expect(estimateJwStoneSlabCost(2050, '126×78" · 127×77.5"')).toEqual({
      minimumTotalCents: 139913,
      maximumTotalCents: 140119,
    });
  });

  it("supports structured millimeter dimensions and rejects incomplete dimensions", () => {
    expect(
      estimateJwStoneSlabCost(2050, {
        length: 3378.2,
        height: 1993.9,
        unit: "mm",
      })
    ).toEqual({
      minimumTotalCents: 148632,
      maximumTotalCents: 148632,
    });
    expect(estimateJwStoneSlabCost(2050, { length: 133, unit: "in" })).toBeNull();
  });
});
