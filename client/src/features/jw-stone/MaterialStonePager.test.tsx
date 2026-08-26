// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_NAMED_CATALOG } from "./catalog";
import { MaterialStonePager } from "./MaterialStonePager";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

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

  it("renders every stone in a contained native momentum rail with precise controls", () => {
    const stones = JW_STONE_NAMED_CATALOG.slice(0, 3);
    expect(stones.length).toBe(3);
    const secondStone = stones[1];
    if (!secondStone) throw new Error("Expected a second stone");
    const noop = vi.fn();

    act(() =>
      root.render(
        <MaterialStonePager
          materialLabel="Gray & silver"
          stones={stones}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    const region = container.querySelector<HTMLElement>('[data-testid="jw-material-stone-rail"]');
    const track = container.querySelector<HTMLElement>('[data-testid="jw-material-stone-track"]');
    const status = container.querySelector('[data-testid="jw-material-stone-status"]');
    const progress = container.querySelector('[data-testid="jw-material-stone-progress"]');
    const prev = container.querySelector<HTMLButtonElement>(
      '[data-testid="jw-material-stone-prev"]'
    );
    const next = container.querySelector<HTMLButtonElement>(
      '[data-testid="jw-material-stone-next"]'
    );

    expect(region?.getAttribute("aria-roledescription")).toBe("carousel");
    expect(region?.className).toMatch(/max-w-full/);
    expect(region?.className).toMatch(/overflow-hidden/);
    expect(track?.className).toMatch(/overflow-x-auto/);
    expect(track?.className).toMatch(/overscroll-x-contain/);
    expect(track?.className).toContain("[-webkit-overflow-scrolling:touch]");
    expect(track?.className).not.toMatch(/snap-/);
    expect(track?.className).toMatch(/\bpx-0\b/);
    const firstItem = track?.querySelector<HTMLElement>('[data-momentum-item="true"]');
    expect(firstItem?.className).toMatch(/min-w-\[78%\]/);
    expect(firstItem?.className).toMatch(/sm:min-w-\[56%\]/);
    expect(firstItem?.className).toMatch(/lg:min-w-\[42%\]/);
    expect(firstItem?.className).toMatch(/xl:min-w-\[34%\]/);
    expect(track?.querySelectorAll("[data-stone-card]")).toHaveLength(3);
    expect(track?.querySelector('[data-testid="jw-stone-card-photo-dots"]')).toBeNull();
    expect(status?.textContent).toBe("Gray & silver · 1 of 3");
    expect(status?.className).toMatch(/uppercase/);
    expect(progress?.getAttribute("aria-valuenow")).toBe("1");
    expect(progress?.getAttribute("aria-valuemax")).toBe("3");
    expect(prev?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);
    expect(prev?.className).toMatch(/rounded-full/);
    expect(next?.className).toMatch(/rounded-full/);

    click(next);
    expect(status?.textContent).toBe("Gray & silver · 2 of 3");
    expect(progress?.getAttribute("aria-valuenow")).toBe("2");
    expect(
      container
        .querySelector(`[data-testid="jw-material-stone-${secondStone.id}"]`)
        ?.getAttribute("data-active")
    ).toBe("true");

    act(() => {
      region?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
      );
    });
    expect(status?.textContent).toBe("Gray & silver · 3 of 3");
    expect(next?.disabled).toBe(true);

    act(() => {
      region?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
      );
    });
    expect(status?.textContent).toBe("Gray & silver · 2 of 3");
    expect(container.textContent).toContain("View stone");
    expect(container.textContent).toMatch(/Ask/i);
  });

  it("updates position from free scrolling without introducing a hard snap", () => {
    const stones = JW_STONE_NAMED_CATALOG.slice(0, 3);
    const noop = vi.fn();

    act(() =>
      root.render(
        <MaterialStonePager
          materialLabel="Quartzite"
          stones={stones}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    const track = container.querySelector<HTMLElement>('[data-testid="jw-material-stone-track"]');
    if (!track) throw new Error("Expected material stone track");
    const items = Array.from(track.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset.momentumItem === "true"
    );
    Object.defineProperty(track, "clientWidth", { configurable: true, value: 100 });
    items.forEach((item, index) => {
      Object.defineProperty(item, "offsetLeft", { configurable: true, value: index * 100 });
      Object.defineProperty(item, "offsetWidth", { configurable: true, value: 92 });
    });

    track.scrollLeft = 96;
    act(() => track.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent).toBe(
      "Quartzite · 2 of 3"
    );
    expect(track.className).not.toMatch(/snap-/);
  });

  it("hides edge controls when only one stone is in the set", () => {
    const stone = JW_STONE_NAMED_CATALOG[0];
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a stone");
    const noop = vi.fn();

    act(() =>
      root.render(
        <MaterialStonePager
          materialLabel="Granite"
          stones={[stone]}
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
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(1);
  });
});
