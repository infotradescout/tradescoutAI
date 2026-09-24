/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPostedDealEndTime } from "@shared/scoutDealDisplay";

const route = vi.hoisted(() => ({ id: "11111111-2222-4333-8444-555555555555" }));
vi.mock("wouter", () => ({
  useParams: () => ({ id: route.id }),
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null }));

import DealDetail from "./deal-detail";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "11111111-2222-4333-8444-555555555555";
const deal = {
  id: ID,
  title: "County tool rental offer",
  description: "Posted terms for one tool rental offer.",
  startsAt: "2020-01-01T00:00:00.000Z",
  endsAt: "2099-01-01T01:32:45.000Z",
  scope: "county" as const,
  source: "TradeScout posted promotion",
};

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    if (predicate()) return;
  }
  throw new Error("Timed out waiting for Deal detail");
}

describe("public TradeDeal detail page", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    route.id = ID;
    window.history.replaceState({}, "", `/deals/${ID}?county=04013`);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DealDetail />
        </QueryClientProvider>
      );
    });
  }

  it("opens only the requested county promotion and shows safe posted terms", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deal }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="deal-detail-content"]')));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/deals/${ID}?county=04013`,
      expect.objectContaining({ cache: "no-store" })
    );
    expect(container.textContent).toContain("Promotional TradeDeal");
    expect(container.textContent).toContain("County tool rental offer");
    expect(container.textContent).toContain("Listed for the selected county");
    expect(container.textContent).toContain("Posted end time: 2099-01-01 01:32 UTC");
    expect(container.textContent).not.toContain("Available in the selected county");
    expect(container.textContent).toContain("Viewing it does not contact anyone");
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/scout");
  });

  it("shows global posted terms without a county parameter", async () => {
    window.history.replaceState({}, "", `/deals/${ID}`);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deal: { ...deal, scope: "global" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await mount();
    await waitFor(() => Boolean(container.querySelector('[data-testid="deal-detail-content"]')));
    expect(fetchMock).toHaveBeenCalledWith(`/api/deals/${ID}`, expect.any(Object));
    expect(container.textContent).toContain("Listed for all counties");
  });

  it("uses the UTC posted end time when the local calendar date is earlier", () => {
    const receiptInstant = "2026-10-01T06:32:45.000Z";
    expect(
      new Date(receiptInstant).toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
      })
    ).toBe("9/30/2026");
    expect(formatPostedDealEndTime(receiptInstant)).toBe("2026-10-01 06:32 UTC");
  });

  it("does not request an offer when the county query is ambiguous", async () => {
    window.history.replaceState({}, "", `/deals/${ID}?county=04013&county=06037`);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await mount();
    expect(container.querySelector('[data-testid="deal-detail-unavailable"]')).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows no offer when the API rejects it or its timing and scope are invalid", async () => {
    const cases = [
      { response: { ok: false, status: 404 }, county: "04013" },
      {
        response: {
          ok: true,
          json: async () => ({ deal: { ...deal, endsAt: "2020-01-01T00:00:00.000Z" } }),
        },
        county: "04013",
      },
      {
        response: { ok: true, json: async () => ({ deal }) },
        county: null,
      },
    ];

    for (const entry of cases) {
      window.history.replaceState(
        {},
        "",
        `/deals/${ID}${entry.county ? `?county=${entry.county}` : ""}`
      );
      const fetchMock = vi.fn().mockResolvedValue(entry.response);
      vi.stubGlobal("fetch", fetchMock);
      await mount();
      await waitFor(() =>
        Boolean(container.querySelector('[data-testid="deal-detail-unavailable"]'))
      );
      expect(container.querySelector('[data-testid="deal-detail-content"]')).toBeNull();
      await act(async () => root.unmount());
      root = createRoot(container);
    }
  });

  it("separates a temporary service failure and recovers after retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ deal }) });
    vi.stubGlobal("fetch", fetchMock);

    await mount();
    await waitFor(() =>
      Boolean(container.querySelector('[data-testid="deal-detail-temporary-error"]'))
    );
    expect(container.textContent).toContain("temporarily unavailable");
    expect(container.querySelector('[data-testid="deal-detail-unavailable"]')).toBeNull();

    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });
    await waitFor(() => Boolean(container.querySelector('[data-testid="deal-detail-content"]')));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
