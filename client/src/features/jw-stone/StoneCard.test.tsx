// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { StoneCard } from "./StoneCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("StoneCard", () => {
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

  it("shows compact stone palette + Pairs with under editorial facts", () => {
    const stone =
      JW_STONE_CATALOG.find((entry) => entry.id === "blue-dunes") ||
      JW_STONE_CATALOG.find(
        (entry) =>
          entry.wishlistEligible &&
          entry.colorSwatches.length > 0 &&
          entry.pairingSwatches.length > 0
      );
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a named stone with palette swatches");

    act(() =>
      root.render(
        <StoneCard stone={stone} saved={false} onToggleSaved={vi.fn()} onOpen={vi.fn()} />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("Pairs with");
    expect(card?.querySelector('[aria-label^="Colors #"]')).not.toBeNull();
    expect(card?.querySelector('[aria-label^="Pairs with #"]')).not.toBeNull();
    expect(card?.querySelectorAll('[aria-label^="#"]').length).toBe(
      stone.colorSwatches.length + stone.pairingSwatches.length
    );
    expect(card?.querySelector("img")?.className).toMatch(/object-contain/);
  });
});
