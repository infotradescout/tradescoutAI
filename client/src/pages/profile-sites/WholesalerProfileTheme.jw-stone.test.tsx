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

vi.mock("./RedGranitiWebsiteProfile", () => ({
  default: ({ profileSlug }: { profileSlug: string }) => (
    <div data-testid="red-graniti-theme">{profileSlug}</div>
  ),
}));

vi.mock("./IssaBuildProfileTruthFrame", () => ({
  default: ({ profileSlug }: { profileSlug: string }) => (
    <div data-testid="issa-build-theme">{profileSlug}</div>
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

  it.each([
    ["  JW-Stone  ", "jw-stone-2-surface"],
    ["  RED-GRANITI  ", "red-graniti-theme"],
    ["  ISSA-BUILD  ", "issa-build-theme"],
    ["jw-stones", "legacy-wholesaler-theme"],
    ["red-graniti-logistics", "legacy-wholesaler-theme"],
    ["issa-builder", "legacy-wholesaler-theme"],
  ])("normalizes exact slug %s without accepting near matches", async (profileSlug, testId) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
      container.remove();
    });

    await act(async () => root.render(<WholesalerProfileTheme {...baseProps} profileSlug={profileSlug} />));
    await act(async () => {
      await vi.waitFor(() => expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull());
    });
  });

  it("cleans JW marketplace scroll ownership when dispatch changes or unmounts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
      container.remove();
    });

    await act(async () => root.render(<WholesalerProfileTheme {...baseProps} />));
    document.documentElement.classList.add("jw-marketplace-scroll");
    document.body.classList.add("jw-marketplace-scroll");
    await act(async () =>
      root.render(<WholesalerProfileTheme {...baseProps} profileSlug="another-tradepartner" />)
    );
    expect(document.documentElement.classList.contains("jw-marketplace-scroll")).toBe(false);
    expect(document.body.classList.contains("jw-marketplace-scroll")).toBe(false);
  });

  it("cleans JW marketplace scroll ownership on direct JW unmount", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<WholesalerProfileTheme {...baseProps} />));
    document.documentElement.classList.add("jw-marketplace-scroll");
    document.body.classList.add("jw-marketplace-scroll");
    act(() => root.unmount());
    expect(document.documentElement.classList.contains("jw-marketplace-scroll")).toBe(false);
    expect(document.body.classList.contains("jw-marketplace-scroll")).toBe(false);
    container.remove();
  });

  it("does not claim JW scroll cleanup for a generic TradePartner render", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(<WholesalerProfileTheme {...baseProps} profileSlug="another-tradepartner" />)
    );
    document.documentElement.classList.add("jw-marketplace-scroll");
    document.body.classList.add("jw-marketplace-scroll");
    act(() => root.unmount());
    expect(document.documentElement.classList.contains("jw-marketplace-scroll")).toBe(true);
    expect(document.body.classList.contains("jw-marketplace-scroll")).toBe(true);
    document.documentElement.classList.remove("jw-marketplace-scroll");
    document.body.classList.remove("jw-marketplace-scroll");
    container.remove();
  });
});
