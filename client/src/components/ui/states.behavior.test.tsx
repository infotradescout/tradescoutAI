// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "./states";
import CommunityModerationDemo from "../../pages/CommunityModerationDemo";
import CarSalesTradeIn from "../../pages/car-sales-trade-in";
import CarSalesVinLookup from "../../pages/car-sales-vin-lookup";
import CarSalesmanDashboard from "../../pages/car-salesman-dashboard";
import HelpDemo from "../../pages/help-demo";
import HomeownerDashboard from "../../pages/homeowner-dashboard";
import RealtorCMA from "../../pages/realtor-cma";
import RealtorDashboard from "../../pages/realtor-dashboard";
import RealtorMarketAnalysis from "../../pages/realtor-market-analysis";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/homeowner-dashboard", navigate] }));

describe("canonical empty-state page migration", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    navigate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    [CommunityModerationDemo, "Community Moderation"],
    [CarSalesTradeIn, "Trade-In Valuations"],
    [CarSalesVinLookup, "VIN Lookup"],
    [CarSalesmanDashboard, "Auto Sales Dashboard"],
    [HelpDemo, "Help & Support"],
    [RealtorCMA, "Realtor Tools"],
    [RealtorDashboard, "Realtor Tools"],
    [RealtorMarketAnalysis, "Realtor Tools"],
  ] as const)("preserves %s page content and its full-page card", (Page, title) => {
    act(() => root.render(<Page />));
    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain("No data available yet.");
    expect(container.firstElementChild?.classList.contains("py-24")).toBe(true);
    expect(container.querySelector(".max-w-xl")).not.toBeNull();
    expect(container.querySelector("svg.lucide-inbox")).not.toBeNull();
  });

  it("retains the requester's real Start a Request action", () => {
    act(() => root.render(<HomeownerDashboard />));
    expect(container.textContent).toContain("Requester dashboard");
    expect(container.textContent).toContain("routing your first job");
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Start a Request");
    act(() => button?.click());
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/direct-connect");
  });

  it("preserves the existing section presentation and action callback", () => {
    const onAction = vi.fn();
    act(() =>
      root.render(
        <EmptyState
          title="No results"
          description="Try another county."
          actionLabel="Try again"
          onAction={onAction}
        />
      )
    );
    expect(container.querySelector("h3")?.textContent).toBe("No results");
    expect(container.textContent).toContain("Try another county.");
    expect(container.firstElementChild?.classList.contains("py-12")).toBe(true);
    expect(container.querySelector(".max-w-xl")).toBeNull();
    act(() => container.querySelector("button")?.click());
    expect(onAction).toHaveBeenCalledOnce();
  });
});
