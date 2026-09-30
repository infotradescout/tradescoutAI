// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPromotionsPage from "./admin-promotions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

describe("Promotions Manager Scout placement", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.toast.mockReset();
    mocks.apiRequest.mockImplementation(async (method: string, _path: string, payload?: object) =>
      method === "GET" ? [] : { id: "deal-1", ...payload }
    );
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  function setField(selector: string, value: string) {
    const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    expect(field, selector).toBeTruthy();
    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
    act(() => {
      setter.call(field, value);
      field!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function createButton() {
    const button = Array.from(container.querySelectorAll("button"))
      .filter((candidate) => candidate.textContent?.trim() === "Create TradeDeal")
      .at(-1);
    expect(button).toBeTruthy();
    return button!;
  }

  it("requires an explicit opt-in and resets Scout placement after a successful paid TradeDeal creation", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AdminPromotionsPage />
        </QueryClientProvider>
      );
    });

    const scoutPlacement = container.querySelector<HTMLElement>("#scout-placement");
    expect(scoutPlacement?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("Off by default");

    setField('input[placeholder="Local TradeDeal title"]', "County tool offer");
    setField(
      'textarea[placeholder="One or two lines describing the TradeDeal."]',
      "A local offer."
    );
    setField('input[placeholder="06037, 48453"]', "04013");

    await act(async () => createButton().click());
    const posts = () => mocks.apiRequest.mock.calls.filter(([method]) => method === "POST");
    expect(posts()).toHaveLength(1);
    expect(posts()[0]).toEqual([
      "POST",
      "/api/admin/promotions",
      expect.objectContaining({
        title: "County tool offer",
        shortDescription: "A local offer.",
        countyFips: ["04013"],
        type: "trade_deal",
        tier: "paid_campaign",
        exclusive: true,
        status: "active",
        placementScout: false,
      }),
    ]);

    await act(async () => scoutPlacement!.click());
    expect(scoutPlacement?.getAttribute("aria-checked")).toBe("true");
    await act(async () => createButton().click());
    expect(posts()).toHaveLength(2);
    expect(posts()[1][2]).toEqual(expect.objectContaining({ placementScout: true }));
    expect(scoutPlacement?.getAttribute("aria-checked")).toBe("false");
  });

  it("keeps the paid tier when pausing a Scout-placed TradeDeal", async () => {
    mocks.apiRequest.mockImplementation(async (method: string) =>
      method === "GET"
        ? [
            {
              id: "deal-1",
              title: "County tool offer",
              shortDescription: "A local offer.",
              type: "trade_deal",
              tier: "paid_campaign",
              exclusive: true,
              status: "active",
              countyFips: ["04013"],
              placementCommunitySnapshot: true,
              placementScout: true,
              createdAt: "2026-09-23T12:00:00.000Z",
            },
          ]
        : {}
    );
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AdminPromotionsPage />
        </QueryClientProvider>
      );
    });
    const listTab = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "All promotions"
    );
    expect(listTab).toBeTruthy();
    await act(async () => {
      listTab!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(container.textContent).toContain("Scout placement");
    const pauseButton = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Pause"
    );
    expect(pauseButton, container.textContent || "empty page").toBeTruthy();
    await act(async () => pauseButton!.click());
    expect(mocks.apiRequest).toHaveBeenCalledWith("PUT", "/api/admin/promotions/deal-1", {
      status: "paused",
      tier: "paid_campaign",
    });
  });
});
