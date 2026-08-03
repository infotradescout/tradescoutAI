// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JW_STONE_2_ANONYMOUS_STONES,
  JW_STONE_2_NAMED_STONES,
} from "@/features/jw-stone-2/inventory";
import { JW_STONE_2_WISHLIST_STORAGE_KEY } from "@/features/jw-stone-2/wishlistStorage";
import JwStoneMarketplacePage from "./JwStoneMarketplacePage";
import { StoneDetailsDialog } from "./StoneDetailsDialog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type MockDirectConnectProps = {
  open: boolean;
  initialItemId?: string | null;
  initialStoneName?: string | null;
  initialStoneSelections?: ReadonlyArray<{ itemId: string; itemName: string }> | null;
};

const routeMock = vi.hoisted(() => ({
  location: "/jw-stone",
  navigate: vi.fn(),
}));
const directConnectMock = vi.hoisted(() => ({
  props: null as MockDirectConnectProps | null,
}));

vi.mock("wouter", () => ({
  useLocation: () => [routeMock.location, routeMock.navigate],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("@/components/SEOHelmet", () => ({
  SEOHelmet: () => null,
}));

vi.mock("@/pages/profile-sites/ExpressDirectConnectPanel", () => ({
  default: (props: MockDirectConnectProps) => {
    directConnectMock.props = props;
    return props.open ? <div data-testid="direct-connect-open">Direct Connect open</div> : null;
  },
}));

function buttonContaining(text: string, root: ParentNode = document) {
  return Array.from(root.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text)
  );
}

function click(element: Element | undefined | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("JW Stone 2.0 marketplace journey", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    routeMock.location = "/jw-stone";
    routeMock.navigate.mockReset();
    directConnectMock.props = null;
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body
      .querySelectorAll(".jw2-dialog-backdrop,.jw2-drawer-backdrop")
      .forEach((node) => node.remove());
  });

  it("requires buyer first and color second before rendering a workspace", () => {
    act(() => root.render(<JwStoneMarketplacePage />));

    const mainSections = Array.from(container.querySelector("main")?.children || []);
    expect(mainSections[0]?.classList.contains("jw2-hero")).toBe(true);
    expect(mainSections[1]?.id).toBe("first-cut");
    expect(mainSections[2]?.id).toBe("discover");
    expect(container.querySelector(".jw2-buyer-choices")).not.toBeNull();
    expect(container.querySelector(".jw2-color-choices")).toBeNull();
    expect(container.querySelector(".jw2-workspace")).toBeNull();

    click(buttonContaining("Fabricator Desk", container));
    expect(container.querySelector(".jw2-color-choices")).not.toBeNull();
    expect(container.querySelectorAll(".jw2-color-choice")).toHaveLength(5);
    expect(container.querySelectorAll(".jw2-color-choice img")).toHaveLength(5);
    expect(container.textContent).not.toContain("All current selections");
    expect(container.querySelector(".jw2-workspace")).toBeNull();

    click(buttonContaining("Warm neutrals", container));
    expect(container.querySelector(".jw2-fabricator")).not.toBeNull();
    expect(container.textContent).toContain("Key details, lined up for comparison.");
    expect(routeMock.navigate).toHaveBeenLastCalledWith(
      "/jw-stone?buyer=fabricator&color=warm-neutrals",
      { replace: true }
    );
  });

  it("restores buyer, color, and supported filter state from a clean URL", () => {
    routeMock.location = "/jw-stone?buyer=builder&color=warm-neutrals&material=granite";
    act(() => root.render(<JwStoneMarketplacePage />));

    expect(container.querySelector(".jw2-builder")).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>("#jw2-material-filter")?.value).toBe(
      "granite"
    );
    expect(container.textContent).toContain("Builder Project Room");
  });

  it("restores query state when the router supplies only the pathname", () => {
    routeMock.location = "/jw-stone";
    window.history.replaceState(
      {},
      "",
      "/jw-stone?buyer=designer&color=cool-lights&finish=polished"
    );
    act(() => root.render(<JwStoneMarketplacePage />));

    expect(container.querySelector(".jw2-designer")).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>("#jw2-finish-filter")?.value).toBe(
      "polished"
    );
  });

  it("renders four structurally and editorially different buyer workspaces", () => {
    const expectations = [
      ["fabricator", ".jw2-fabricator", "Key details, lined up for comparison."],
      ["builder", ".jw2-builder-sheet", "Turn a broad collection into a project shortlist."],
      ["designer", ".jw2-designer-board", "Let the stone lead. Keep the specification honest."],
      [
        "homeowner",
        ".jw2-homeowner-grid",
        "Notice what you love. Save it. Ask when you are ready.",
      ],
    ] as const;

    for (const [buyer, selector, copy] of expectations) {
      routeMock.location = `/jw-stone?buyer=${buyer}&color=warm-neutrals`;
      act(() => root.render(<JwStoneMarketplacePage key={buyer} />));
      expect(container.querySelector(selector)).not.toBeNull();
      expect(container.textContent).toContain(copy);
    }
  });

  it("keeps anonymous Trending Selection nameless and outside public actions", () => {
    routeMock.location = "/jw-stone?buyer=designer&color=mixed-palette";
    act(() => root.render(<JwStoneMarketplacePage />));

    expect(JW_STONE_2_ANONYMOUS_STONES).toHaveLength(10);
    expect(container.querySelector(".jw2-trending")).not.toBeNull();
    expect(container.textContent).toContain("Call for availability");
    expect(container.textContent).toMatch(/\d+ slabs recorded/i);
    expect(container.textContent).not.toMatch(/trending-selection-\d+/i);
    expect(container.querySelector(".jw2-trending [aria-label^='Save']")).toBeNull();
    expect(container.querySelector(".jw2-trending [aria-label*='Ask']")).toBeNull();
    expect(container.textContent).not.toMatch(/anonymous|source record|request handoff/i);
  });

  it("renders no prohibited public labels, public pricing, or empty origin control", () => {
    routeMock.location = "/jw-stone?buyer=homeowner&color=cool-lights";
    act(() => root.render(<JwStoneMarketplacePage />));

    expect(container.textContent).not.toMatch(/\bprice(?:s|d|ing)?\b/i);
    expect(container.textContent).not.toContain("Dual Finish");
    expect(container.textContent).not.toContain("Name not confirmed");
    expect(container.textContent).not.toContain("Finish not confirmed");
    expect(container.textContent).not.toMatch(/Unnamed slab/i);
    expect(container.querySelector("#jw2-origin-filter")).toBeNull();
  });

  it("keeps First Cut as empty editorial positions outside inventory actions", () => {
    act(() => root.render(<JwStoneMarketplacePage />));

    expect(container.querySelectorAll(".jw2-first-cut-placeholder")).toHaveLength(3);
    expect(container.querySelector(".jw2-first-cut-assigned")).toBeNull();
    expect(container.textContent).toContain("First Cut selections will appear here");
    expect(container.textContent).not.toMatch(/explicit|assignment|supplies and verifies/i);
    expect(container.querySelector(".jw2-first-cut [aria-label^='Save']")).toBeNull();
    expect(container.querySelector(".jw2-first-cut button")).toBeNull();
  });

  it("persists named saves without contact and later carries only safe wishlist selections", () => {
    routeMock.location = "/jw-stone?buyer=homeowner&color=cool-lights";
    act(() => root.render(<JwStoneMarketplacePage />));

    const saveButton = container.querySelector<HTMLButtonElement>(
      '.jw2-homeowner [aria-label^="Save "]'
    );
    expect(saveButton).not.toBeNull();
    click(saveButton);

    const savedPayload = JSON.parse(
      window.localStorage.getItem(JW_STONE_2_WISHLIST_STORAGE_KEY) || "{}"
    );
    expect(savedPayload).toMatchObject({ version: 1 });
    expect(savedPayload.ids).toHaveLength(1);
    expect(document.querySelector("[data-testid='direct-connect-open']")).toBeNull();

    act(() => root.render(<div />));
    act(() => root.render(<JwStoneMarketplacePage key="return-visit" />));
    expect(container.querySelector(".jw2-nav button")?.textContent).toContain("1");

    click(container.querySelector(".jw2-nav button"));
    expect(document.querySelector(".jw2-drawer-item")).not.toBeNull();
    click(buttonContaining("Ask about these stones", document));

    expect(document.querySelector("[data-testid='direct-connect-open']")).not.toBeNull();
    const wishlistContactProps = directConnectMock.props;
    if (!wishlistContactProps?.initialStoneSelections) {
      throw new Error("Expected the wishlist Direct Connect selection payload");
    }
    expect(wishlistContactProps.initialStoneSelections).toEqual([
      {
        itemId: savedPayload.ids[0],
        itemName: expect.any(String),
      },
    ]);
    expect(wishlistContactProps.initialStoneSelections[0].itemName).not.toMatch(
      /trending|anonymous|unnamed/i
    );
    expect(wishlistContactProps.initialItemId).toBeUndefined();
  });

  it("opens Direct Connect only after a named stone contact action", () => {
    routeMock.location = "/jw-stone?buyer=fabricator&color=warm-neutrals";
    act(() => root.render(<JwStoneMarketplacePage />));

    expect(document.querySelector("[data-testid='direct-connect-open']")).toBeNull();
    click(buttonContaining("Ask about this stone", container));

    expect(document.querySelector("[data-testid='direct-connect-open']")).not.toBeNull();
    const singleContactProps = directConnectMock.props;
    if (!singleContactProps) throw new Error("Expected the named Direct Connect payload");
    expect(singleContactProps.initialItemId).toMatch(/^[a-z0-9-]+$/);
    expect(singleContactProps.initialStoneName).toEqual(expect.any(String));
    expect(singleContactProps.initialStoneName).not.toMatch(/trending|anonymous/i);
  });

  it("supports keyboard gallery navigation and Escape without leaking anonymous identity", () => {
    const item = JW_STONE_2_NAMED_STONES.find((stone) => stone.images.length > 1);
    expect(item).toBeDefined();
    const onClose = vi.fn();

    act(() =>
      root.render(
        <StoneDetailsDialog
          item={item || null}
          isSaved={false}
          onClose={onClose}
          onToggleSave={vi.fn()}
          onAsk={vi.fn()}
        />
      )
    );

    expect(document.querySelector(".jw2-dialog-gallery > img")?.getAttribute("alt")).toContain(
      "photograph 1"
    );
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(document.querySelector(".jw2-dialog-gallery > img")?.getAttribute("alt")).toContain(
      "photograph 2"
    );
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
