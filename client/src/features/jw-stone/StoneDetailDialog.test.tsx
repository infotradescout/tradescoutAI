// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { firstCutPhotoAsDetailStone, JW_STONE_FIRST_CUT_PHOTO_SLOTS } from "./firstCut";
import { StoneDetailDialog } from "./StoneDetailDialog";
import { ExpressOfferEntryProvider } from "./express/ExpressOfferEntryContext";

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
        <ExpressOfferEntryProvider canMakeOffer={() => true} makeOffer={vi.fn()}>
          <StoneDetailDialog
            stone={stone}
            saved={false}
            onOpenChange={vi.fn()}
            onToggleSaved={onToggleSaved}
            onAsk={onAsk}
          />
        </ExpressOfferEntryProvider>
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
      expect(dialog?.textContent).toMatch(/Available now|slabs available/i);
    }

    const ask = buttonContaining(dialog, `Ask JW about ${stone.displayName}`);
    const save = buttonContaining(dialog, "Save this stone");
    expect(ask).not.toBeNull();
    expect(save).not.toBeNull();
    expect(dialog?.textContent).not.toMatch(
      /Recorded source counts|Full slabs vary|Learn about stone/i
    );
    expect(dialog?.textContent).not.toMatch(/Dual Finish/i);
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-make-offer"]')).not.toBeNull();

    expect(
      ask && save && (ask.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).toBe(true);

    click(ask);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });

  it("exposes prev/next and thumbnails when a stone has multiple mapped photos", () => {
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
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-prev"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumbs"]')).not.toBeNull();
    expect(dialog?.querySelectorAll('[data-testid^="jw-stone-detail-photo-thumb-"]').length).toBe(
      stone.images.length
    );

    const leadSrc = dialog?.querySelector("img")?.getAttribute("src");
    expect(leadSrc).toBe(stone.images[0]);

    click(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]') ?? null);
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe(stone.images[1]);

    click(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumb-0"]') ?? null);
    expect(dialog?.querySelector("img")?.getAttribute("src")).toBe(stone.images[0]);
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
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-prev"]')).toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]')).toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumbs"]')).toBeNull();
  });

  it("keeps Ask and Share for First Cut photos without Save or invented specs", () => {
    const stone = firstCutPhotoAsDetailStone(JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!);
    const onAsk = vi.fn();

    act(() =>
      root.render(
        <ExpressOfferEntryProvider canMakeOffer={() => true} makeOffer={vi.fn()}>
          <StoneDetailDialog
            stone={stone}
            saved={false}
            onOpenChange={vi.fn()}
            onToggleSaved={vi.fn()}
            onAsk={onAsk}
          />
        </ExpressOfferEntryProvider>
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
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-make-offer"]')).toBeNull();

    click(ask ?? null);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });
});
