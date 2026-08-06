// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_NAMED_CATALOG } from "./catalog";
import { MaterialStonePager } from "./MaterialStonePager";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("MaterialStonePager", () => {
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

  it("keeps status quiet, overlays prev/next on media, and pages with buttons + keys", () => {
    const stones = JW_STONE_NAMED_CATALOG.slice(0, 3);
    expect(stones.length).toBe(3);
    const onOpen = vi.fn();
    const noop = vi.fn();

    act(() =>
      root.render(
        <MaterialStonePager
          materialLabel="Gray & silver"
          stones={stones}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={onOpen}
          onAsk={noop}
        />
      )
    );

    const rail = container.querySelector<HTMLElement>('[data-testid="jw-material-stone-rail"]');
    expect(rail).not.toBeNull();
    expect(rail?.getAttribute("aria-roledescription")).toBe("carousel");

    const status = container.querySelector('[data-testid="jw-material-stone-status"]');
    expect(status?.textContent).toBe("Gray & silver · 1 of 3");
    expect(status?.className).toMatch(/text-\[var\(--jw-muted\)\]/);

    const progress = container.querySelector('[data-testid="jw-material-stone-progress"]');
    expect(progress?.getAttribute("aria-valuenow")).toBe("1");
    expect(progress?.getAttribute("aria-valuemax")).toBe("3");

    const media = container.querySelector("[data-stone-card] .relative");
    const prev = container.querySelector('[data-testid="jw-material-stone-prev"]');
    const next = container.querySelector('[data-testid="jw-material-stone-next"]');
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    expect(media?.contains(prev)).toBe(true);
    expect(media?.contains(next)).toBe(true);
    expect(prev?.className).toMatch(/absolute/);
    expect(next?.className).toMatch(/absolute/);

    expect(
      container.querySelector(`[data-testid="jw-material-stone-${stones[0]!.id}"]`)
    ).not.toBeNull();

    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(status?.textContent).toBe("Gray & silver · 2 of 3");
    expect(progress?.getAttribute("aria-valuenow")).toBe("2");
    expect(
      container.querySelector(`[data-testid="jw-material-stone-${stones[1]!.id}"]`)
    ).not.toBeNull();

    act(() => {
      rail?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
      );
    });
    expect(status?.textContent).toBe("Gray & silver · 3 of 3");

    act(() => {
      rail?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
      );
    });
    expect(status?.textContent).toBe("Gray & silver · 2 of 3");

    expect(container.textContent).toContain("View stone");
    expect(container.textContent).toMatch(/Ask/i);
  });

  it("hides edge controls when only one stone is in the set", () => {
    const stone = JW_STONE_NAMED_CATALOG[0];
    expect(stone).toBeTruthy();
    const noop = vi.fn();

    act(() =>
      root.render(
        <MaterialStonePager
          materialLabel="Granite"
          stones={[stone!]}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    expect(container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent).toBe(
      "Granite · 1 of 1"
    );
    expect(container.querySelector('[data-testid="jw-material-stone-prev"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-next"]')).toBeNull();
  });
});
