// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { firstCutPhotoAsDetailStone, JW_STONE_FIRST_CUT_PHOTO_SLOTS } from "./firstCut";
import { StoneDetailDialog } from "./StoneDetailDialog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function buttonContaining(root: ParentNode | null, label: string): HTMLButtonElement | null {
  if (!root) return null;
  return (
    Array.from(root.querySelectorAll("button")).find((button) =>
      (button.textContent || "").includes(label)
    ) || null
  );
}

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("StoneDetailDialog", () => {
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

  it("shows confirmed facts and Ask JW about {name} without color swatches or Pairs with", () => {
    const stone =
      JW_STONE_CATALOG.find((entry) => entry.id === "blue-dunes") ||
      JW_STONE_CATALOG.find((entry) => entry.wishlistEligible);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a named wishlist-eligible stone");

    const onAsk = vi.fn();
    const onToggleSaved = vi.fn();

    act(() =>
      root.render(
        <StoneDetailDialog
          stone={stone}
          saved={false}
          onOpenChange={vi.fn()}
          onToggleSaved={onToggleSaved}
          onAsk={onAsk}
        />
      )
    );

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain(stone.displayName || "");
    expect(dialog?.textContent).not.toContain("Colors from photo");
    expect(dialog?.textContent).not.toContain("Pairs with");
    expect(dialog?.querySelector('[aria-label^="Colors #"]')).toBeNull();
    expect(dialog?.querySelector('[aria-label^="Pairs with #"]')).toBeNull();

    if (stone.materialLabel) expect(dialog?.textContent).toContain(stone.materialLabel);
    if (stone.origin) {
      expect(dialog?.textContent).toContain("Origin");
      expect(dialog?.textContent).toContain(stone.origin.country);
    }
    if (stone.sourceEvidence?.counts?.length) {
      expect(dialog?.textContent).toMatch(/Confirm current availability with JW Stone/i);
      expect(dialog?.textContent).not.toMatch(/Available now|slabs available/i);
    }

    const ask = buttonContaining(dialog, `Ask JW about ${stone.displayName}`);
    const save = buttonContaining(dialog, "Save this stone");
    expect(ask).not.toBeNull();
    expect(save).not.toBeNull();
    expect(dialog?.textContent).not.toMatch(
      /Recorded source counts|Full slabs vary|Learn about stone/i
    );
    expect(dialog?.textContent).not.toMatch(/Dual Finish/i);

    expect(
      ask && save && (ask.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).toBe(true);

    click(ask);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });

  it("keeps a stable detail stage while photos move through a native momentum rail", () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.images.length > 1);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a multi-image stone");

    act(() =>
      root.render(
        <StoneDetailDialog
          stone={stone}
          saved={false}
          onOpenChange={vi.fn()}
          onToggleSaved={vi.fn()}
          onAsk={vi.fn()}
        />
      )
    );

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const media = dialog?.querySelector<HTMLElement>('[data-testid="jw-stone-detail-media"]');
    const rail = dialog?.querySelector<HTMLElement>('[data-testid="jw-stone-detail-photo-rail"]');
    const leadImages = rail?.querySelectorAll("img") || [];
    expect(dialog?.className).toMatch(/w-full/);
    expect(dialog?.className).toMatch(/overflow-x-hidden/);
    expect(media?.className).toMatch(/overflow-hidden/);
    expect(rail?.className).toMatch(/h-\[52dvh\]/);
    expect(rail?.className).toMatch(/overflow-x-auto/);
    expect(rail?.className).toMatch(/overscroll-x-contain/);
    expect(rail?.className).toContain("[-webkit-overflow-scrolling:touch]");
    expect(rail?.className).not.toMatch(/snap-/);
    expect(leadImages).toHaveLength(stone.images.length);
    expect(leadImages[0]?.className).toMatch(/h-full/);
    expect(leadImages[0]?.className).toMatch(/w-full/);
    expect(leadImages[0]?.className).toMatch(/object-contain/);
    expect(leadImages[0]?.className).not.toMatch(/h-auto|object-cover/);
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-prev"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumbs"]')).not.toBeNull();
    expect(dialog?.querySelectorAll('[data-testid^="jw-stone-detail-photo-thumb-"]').length).toBe(
      stone.images.length
    );

    const leadSrc = leadImages[0]?.getAttribute("src");
    expect(leadSrc).toBe(stone.images[0]);

    click(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]') ?? null);
    expect(
      dialog
        ?.querySelector('[data-testid="jw-stone-detail-photo-thumb-1"]')
        ?.getAttribute("aria-current")
    ).toBe("true");
    expect(media?.textContent).toContain(`2 / ${stone.images.length}`);

    click(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumb-0"]') ?? null);
    expect(
      dialog
        ?.querySelector('[data-testid="jw-stone-detail-photo-thumb-0"]')
        ?.getAttribute("aria-current")
    ).toBe("true");
  });

  it("omits gallery chrome for single-image stones", () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.images.length === 1);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a single-image stone");

    act(() =>
      root.render(
        <StoneDetailDialog
          stone={stone}
          saved={false}
          onOpenChange={vi.fn()}
          onToggleSaved={vi.fn()}
          onAsk={vi.fn()}
        />
      )
    );

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const figure = dialog?.querySelector<HTMLElement>('[data-testid="jw-stone-detail-photo-0"]');
    const image = figure?.querySelector("img");
    const descriptionId = dialog?.getAttribute("aria-describedby");
    const description = descriptionId ? document.getElementById(descriptionId) : null;
    expect(dialog?.querySelectorAll('[data-momentum-item="true"]')).toHaveLength(1);
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-prev"]')).toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]')).toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumbs"]')).toBeNull();
    expect(figure?.getAttribute("aria-label")).toBeNull();
    expect(image?.getAttribute("alt")).not.toMatch(/view 1|1 of 1/i);
    expect(description?.textContent).not.toMatch(/image 1 of 1/i);
    expect(dialog?.textContent).not.toMatch(/1 \/ 1/);
    const accessibleLabels = Array.from(
      dialog?.querySelectorAll<HTMLElement>("[aria-label]") || []
    ).map((element) => element.getAttribute("aria-label") || "");
    expect(accessibleLabels.some((label) => /1 of 1/i.test(label))).toBe(false);
  });

  it("keeps Ask and Share for First Cut photos without Save or invented specs", () => {
    const stone = firstCutPhotoAsDetailStone(JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!);
    const onAsk = vi.fn();

    act(() =>
      root.render(
        <StoneDetailDialog
          stone={stone}
          saved={false}
          onOpenChange={vi.fn()}
          onToggleSaved={vi.fn()}
          onAsk={onAsk}
        />
      )
    );

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("First Cut");
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-pending"]')?.textContent).toMatch(
      /First Cut Exclusive/i
    );
    expect(dialog?.querySelector("dl")).toBeNull();
    expect(dialog?.textContent).not.toContain("Available now");
    expect(dialog?.textContent).not.toContain("Approximate slab dimensions");

    const ask = dialog?.querySelector('[data-testid="jw-stone-detail-ask"]');
    expect(ask?.textContent).toContain("Ask JW about this First Cut");
    expect(dialog?.querySelector('[data-testid="jw-stone-share"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-save"]')).toBeNull();
    expect(buttonContaining(dialog, "Save this stone")).toBeNull();

    click(ask ?? null);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });
});
