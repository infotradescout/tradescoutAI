// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { JwStoneTopSellerBadge } from "./JwStoneTopSellerBadge";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JwStoneTopSellerBadge", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("marks Rhino White as the number-one top seller", () => {
    const stone = JW_STONE_CATALOG.find((item) => item.id === "rhino-white");
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected Rhino White in the catalog");

    act(() => root.render(<JwStoneTopSellerBadge stone={stone} />));

    expect(container.querySelector('[data-testid="jw-top-seller-badge"]')?.textContent).toBe(
      "#1 Top Seller"
    );
  });

  it("marks Taj Mahal and Bianco Carrara as top sellers and hides the badge elsewhere", () => {
    for (const id of ["taj-mahal", "bianco-carrara"] as const) {
      const stone = JW_STONE_CATALOG.find((item) => item.id === id);
      expect(stone).toBeTruthy();
      if (!stone) throw new Error(`Expected ${id} in the catalog`);

      act(() => root.render(<JwStoneTopSellerBadge stone={stone} />));
      expect(container.querySelector('[data-testid="jw-top-seller-badge"]')?.textContent).toBe(
        "Top Seller"
      );
    }

    const otherStone = JW_STONE_CATALOG.find((item) => item.id === "blue-dunes");
    expect(otherStone).toBeTruthy();
    if (!otherStone) throw new Error("Expected Blue Dunes in the catalog");

    act(() => root.render(<JwStoneTopSellerBadge stone={otherStone} />));
    expect(container.querySelector('[data-testid="jw-top-seller-badge"]')).toBeNull();
  });
});
