// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import WholesalerProfileTheme from "./WholesalerProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("./JwStoneMarketplaceProfile", () => ({
  default: ({ profileCanonicalUrl }: { profileCanonicalUrl: string }) => (
    <>
      <div data-testid="jw-stone-2-surface">JW Stone 2.0</div>
      <div data-testid="jw-stone-profile-seo" data-canonical={profileCanonicalUrl} />
    </>
  ),
}));

vi.mock("./WholesalerProfileThemeLegacy", () => ({
  default: ({ profileSlug }: { profileSlug: string }) => (
    <div data-testid="legacy-wholesaler-theme">{profileSlug}</div>
  ),
}));

const baseProps = {
  profileSlug: "jw-stone",
  displayName: "JW Stone Logistics",
  businessAddress: "2103 W Herman Ave, Pensacola, FL 32505",
  headline: "Natural stone, selected at the source.",
  contentBlocks: [],
  categories: ["Natural stone"],
  serviceAreas: ["Pensacola, FL"],
  hasViewerSession: false,
  isSuperAdminViewer: false,
  useExpressDirectConnect: true,
  allowExpressCall: true,
  profileShareDestination: "/u/jw-stone",
  tradeScoutReturnHref: "/",
  directConnectHref: "/direct-connect?profile=jw-stone",
  preScoutCreateHref: "/pre-scout-setup?mode=create",
  preScoutSignInHref: "/pre-scout-setup?mode=signin",
  trustActions: <div data-testid="profile-actions">Profile actions</div>,
};

const mounted: Array<() => void> = [];

afterEach(() => {
  while (mounted.length) mounted.pop()?.();
});

describe("WholesalerProfileTheme JW Stone profile selection", () => {
  it("keeps the lazy JW Stone 2.0 surface as the JW TradeScout profile theme", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
      container.remove();
    });

    await act(async () => root.render(<WholesalerProfileTheme {...baseProps} />));

    await act(async () => {
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="jw-stone-2-surface"]')).not.toBeNull();
      });
    });
    expect(container.querySelector('[data-testid="legacy-wholesaler-theme"]')).toBeNull();
    expect(
      container
        .querySelector('[data-testid="jw-stone-profile-seo"]')
        ?.getAttribute("data-canonical")
    ).toBe("/u/jw-stone");
  });

  it("leaves every other TradePartner on the existing wholesale theme", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
      container.remove();
    });

    act(() =>
      root.render(<WholesalerProfileTheme {...baseProps} profileSlug="another-tradepartner" />)
    );

    expect(container.querySelector('[data-testid="jw-stone-2-surface"]')).toBeNull();
    expect(container.querySelector('[data-testid="legacy-wholesaler-theme"]')?.textContent).toBe(
      "another-tradepartner"
    );
  });
});
