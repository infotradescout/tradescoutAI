// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
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

  it("shows confirmed facts, photo palette + Pairs with, and Ask JW about {name}", () => {
    const stone =
      JW_STONE_CATALOG.find((entry) => entry.id === "blue-dunes") ||
      JW_STONE_CATALOG.find((entry) => entry.wishlistEligible && entry.colorSwatches.length > 0);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a named wishlist-eligible stone with swatches");

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
    expect(dialog?.textContent).toContain("Colors from photo");
    expect(dialog?.textContent).toContain("Pairs with");
    expect(dialog?.querySelector('[aria-label^="Colors #"]')).not.toBeNull();
    expect(dialog?.querySelector('[aria-label^="Pairs with #"]')).not.toBeNull();
    expect(dialog?.querySelectorAll('[aria-label^="#"]').length).toBe(
      stone.colorSwatches.length + stone.pairingSwatches.length
    );

    if (stone.materialLabel) expect(dialog?.textContent).toContain(stone.materialLabel);
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

    expect(
      ask && save && (ask.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).toBe(true);

    click(ask);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });
});
