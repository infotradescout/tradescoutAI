// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { firstCutPhotoAsDetailStone, JW_STONE_FIRST_CUT_PHOTO_SLOTS } from "./firstCut";
import { StoneDetailDialog } from "./StoneDetailDialog";
import { stoneRoomDestination } from "./StoneRoomLink";
import { stoneRoomBasePath } from "./marketplaceRoutes";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
function buttonContaining(root: ParentNode | null, label: string): HTMLButtonElement | null {
  return root
    ? Array.from(root.querySelectorAll("button")).find((button) =>
        (button.textContent || "").includes(label)
      ) || null
    : null;
}
function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
describe("StoneDetailDialog", async () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url !== "/api/u/jw-stone/features")
          throw new Error("Unexpected fixture request: " + url);
        return {
          ok: true,
          json: async () => ({
            profileSlug: "jw-stone",
            enabled: true,
            configured: true,
            revision: 1,
          }),
        };
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  it("shows confirmed facts and one primary Make an Offer instead of Ask", async () => {
    const stone =
      JW_STONE_CATALOG.find((entry) => entry.id === "blue-dunes") ||
      JW_STONE_CATALOG.find((entry) => entry.wishlistEligible);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a named wishlist-eligible stone");
    const onAsk = vi.fn();
    await act(async () =>
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
    expect(dialog?.textContent).toContain(stone.displayName || "");
    expect(dialog?.textContent).not.toContain("Colors from photo");
    expect(dialog?.textContent).not.toContain("Pairs with");
    expect(dialog?.querySelector('[aria-label^="Colors #"]')).toBeNull();
    expect(dialog?.querySelector('[aria-label^="Pairs with #"]')).toBeNull();
    if (stone.materialLabel) expect(dialog?.textContent).toContain(stone.materialLabel);
    if (stone.origin) {
      expect(dialog?.textContent).toMatch(/Country of origin/i);
      expect(dialog?.textContent).toContain(stone.origin.country);
    }
    if (stone.sourceEvidence?.counts?.length) {
      expect(dialog?.textContent).toMatch(/Confirm current availability with JW Stone/i);
      expect(dialog?.textContent).not.toMatch(/Available now|slabs available/i);
    }
    const offer = buttonContaining(dialog, "Make an Offer"),
      save = buttonContaining(dialog, "Save this stone");
    expect(offer).not.toBeNull();
    expect(save).not.toBeNull();
    expect(dialog?.querySelectorAll('[data-testid="jw-stone-make-offer-detail"]')).toHaveLength(1);
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-actions"]')?.contains(offer!)).toBe(
      true
    );
    expect(buttonContaining(dialog, "Ask JW")).toBeNull();
    expect(dialog?.textContent).not.toMatch(
      /Recorded source counts|Full slabs vary|Learn about stone/i
    );
    expect(dialog?.textContent).not.toMatch(/Dual Finish/i);
    expect(
      offer &&
        save &&
        (offer.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).toBe(true);
    click(offer);
    expect(onAsk).not.toHaveBeenCalled();
  });
  it("keeps a stable detail stage while photos move through a native momentum rail", async () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.images.length > 1);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a multi-image stone");
    await act(async () =>
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
    expect(leadImages[0]?.getAttribute("src")).toBe(stone.images[0]);
    click(dialog?.querySelector('[data-testid="jw-stone-detail-photo-next"]') ?? null);
    expect(
      dialog
        ?.querySelector('[data-testid="jw-stone-detail-photo-thumb-1"]')
        ?.getAttribute("aria-current")
    ).toBe("true");
    expect(media?.textContent).toContain(`2 / ${stone.images.length}`);
    expect(
      dialog?.querySelector('[data-testid="jw-stone-detail-room"]')?.getAttribute("href")
    ).toBe(stoneRoomDestination(stone, stone.images[1]!, stoneRoomBasePath()));
    click(dialog?.querySelector('[data-testid="jw-stone-detail-photo-thumb-0"]') ?? null);
    expect(
      dialog
        ?.querySelector('[data-testid="jw-stone-detail-photo-thumb-0"]')
        ?.getAttribute("aria-current")
    ).toBe("true");
  });
  it("omits gallery chrome for single-image stones", async () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.images.length === 1);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a single-image stone");
    await act(async () =>
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
  it("keeps request-details and Share for unidentified First Cut without invented offer specifications", async () => {
    const stone = firstCutPhotoAsDetailStone(JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!);
    const onAsk = vi.fn();
    await act(async () =>
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
    const request = dialog?.querySelector('[data-testid="jw-stone-detail-request-details"]');
    expect(request?.textContent).toContain("Request details");
    expect(dialog?.querySelector('[data-testid="jw-stone-share"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-save"]')).toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-room"]')).toBeNull();
    expect(buttonContaining(dialog, "Save this stone")).toBeNull();
    click(request ?? null);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });
});
