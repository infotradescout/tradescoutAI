/** @vitest-environment jsdom */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountertopDesigner from "./CountertopDesigner";
import {
  resolveCountertopPlannerDesign,
  type CountertopPlannerDesignInput,
} from "./countertopPlannerModel";
import {
  createEmptySteelHomeProjectDraft,
  loadSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
} from "./projectModel";
import SteelHomePackagesProfile from "../SteelHomePackagesProfile";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { stoneRoomDestination } from "@/features/jw-stone/StoneRoomLink";
import { stoneRoomBasePath } from "@/features/jw-stone/marketplaceRoutes";
import { buildStoneDesignerPhotoKey } from "./stoneDesignerImages";
import { getStoneProjectionDecision } from "./stoneProjectionSafety";
import {
  buildCountertopStudioShareUrl,
  parseCountertopStudioShareUrl,
} from "./countertopStudioShare";

vi.mock("./StoneVisualizer3D", () => ({
  default: () => <div data-testid="mock-countertop-3d" />,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function setInputValue(control: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function CountertopHarness({
  initialDesign,
  onChange,
  onRequest,
}: {
  initialDesign: CountertopPlannerDesignInput;
  onChange: (design: CountertopPlannerDesignInput) => void;
  onRequest: (intent: "stone" | "fabricator") => void;
}) {
  const [design, setDesign] = useState(initialDesign);
  return (
    <CountertopDesigner
      design={design}
      onChange={(next) => {
        setDesign(next);
        onChange(next);
      }}
      onRequest={onRequest}
    />
  );
}

describe("CountertopDesigner truthful measurement gates", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn<(design: CountertopPlannerDesignInput) => void>>;
  let onRequest: ReturnType<typeof vi.fn<(intent: "stone" | "fabricator") => void>>;

  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/countertops");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn<(design: CountertopPlannerDesignInput) => void>();
    onRequest = vi.fn<(intent: "stone" | "fabricator") => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function render(initialDesign: CountertopPlannerDesignInput) {
    await act(async () => {
      root.render(
        <CountertopHarness
          initialDesign={initialDesign}
          onChange={onChange}
          onRequest={onRequest}
        />
      );
      await Promise.resolve();
    });
  }

  it("hydrates the public parent's saved draft before applying one exact catalog photo", async () => {
    const stone = getCatalogItemById("arizona-gold")!;
    const index = stone.images.findIndex((image) => !getStoneProjectionDecision(image).allowed);
    expect(index).toBeGreaterThanOrEqual(0);
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops = {
      ...draft.countertops,
      stoneId: "cristallo",
      room: "Kitchen",
      wallAIn: 180,
      measurementsReviewed: true,
      roomWidthIn: 240,
      roomDepthIn: 192,
      sink: "Single-bowl undermount",
      sinkRun: "main",
      sinkPositionIn: 48,
      sinkFrontPositionIn: 12,
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
      notes: "Preserve existing cabinet layout",
      textureOffsetX: 0.25,
      textureScale: 1.5,
    };
    saveSteelHomeProjectDraft(window.localStorage, draft);
    const loaded = loadSteelHomeProjectDraft(window.localStorage);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    window.history.replaceState(
      null,
      "",
      stoneRoomDestination(stone, stone.images[index]!, stoneRoomBasePath())!
    );
    await act(async () => {
      root.render(
        <SteelHomePackagesProfile
          requestHref="/direct-connect"
          laborRequestHref="/direct-connect"
          initialBuilder="countertops"
        />
      );
    });
    await vi.waitFor(() => {
      expect(loadSteelHomeProjectDraft(window.localStorage).countertops.stoneId).toBe(stone.id);
    });
    const selection = {
      stoneId: stone.id,
      textureImageIndex: index,
      texturePhotoKey: buildStoneDesignerPhotoKey(stone.images[index]!),
    };
    expect(loadSteelHomeProjectDraft(window.localStorage)).toEqual({
      ...loaded,
      countertops: { ...loaded.countertops, ...selection },
    });
    for (const [key, value] of writes.mock.calls) {
      if (key !== STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY) continue;
      expect(JSON.parse(value).countertops).toMatchObject({
        wallAIn: 180,
        measurementsReviewed: true,
        notes: "Preserve existing cabinet layout",
      });
    }
    expect(container.textContent).toContain("Reference photo only");
    expect(window.location.search).toBe("");
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-view-plan"]')!
        .click()
    );
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="steel-home-countertop-run-a"]')
        ?.value
    ).toBe("180");
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="steel-home-countertop-room"]')
        ?.value
    ).toBe("Kitchen");
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("does not alter a saved design when the requested photo belongs to another stone", async () => {
    const stone = getCatalogItemById("arizona-gold")!;
    const foreign = getCatalogItemById("taj-mahal")!;
    window.history.replaceState(
      null,
      "",
      `?stone=${stone.shareSlug}&photo=${buildStoneDesignerPhotoKey(foreign.images[0]!)}`
    );
    await render({
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "cristallo",
      wallAIn: 180,
      notes: "Retain me",
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("contains gallery focus when filtering removes every stone and restores the trigger on Escape", async () => {
    await render({
      ...createEmptySteelHomeProjectDraft().countertops,
      measurementsReviewed: true,
      stoneId: "arizona-gold",
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-surface-open"]'
    )!;
    await act(async () => {
      trigger.focus();
      trigger.click();
    });
    const dialog = document.querySelector<HTMLElement>(
      '[data-testid="steel-home-countertop-surface-gallery"]'
    )!;
    const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
    const close = dialog.querySelector<HTMLButtonElement>(
      'button[aria-label="Close stone gallery"]'
    )!;
    expect(document.activeElement).toBe(search);

    setInputValue(search, "no-matching-stone-928174");
    expect(dialog.querySelectorAll("button")).toHaveLength(1);
    const backwards = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      close.focus();
      close.dispatchEvent(backwards);
    });
    expect(backwards.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(search);

    const backgroundRequest = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-find-fabricator"]'
    )!;
    act(() => backgroundRequest.focus());
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(onRequest).not.toHaveBeenCalled();

    await act(async () => {
      search.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      document.querySelector('[data-testid="steel-home-countertop-surface-gallery"]')
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onChange).not.toHaveBeenCalled();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("keeps legacy numeric starter values out of measured outputs until reviewed", async () => {
    await render(createEmptySteelHomeProjectDraft().countertops);
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-view-plan"]')!
        .click()
    );

    expect(container.textContent).toContain("Footprint unresolved");
    expect(container.textContent).toContain("counter · surface unselected");
    expect(container.textContent).not.toContain("counter · stone");
    expect(container.textContent).toContain(
      "Starter run values are unreviewed; measured plan and countertop geometry stay hidden."
    );
    expect(
      container.querySelector('[data-testid="steel-home-countertop-plan-unreviewed"]')
    ).toBeTruthy();
    for (const testId of [
      "steel-home-countertop-room-width",
      "steel-home-countertop-room-depth",
      "steel-home-countertop-room-wall-height",
      "steel-home-countertop-finished-top-height",
      "steel-home-countertop-top-thickness",
    ]) {
      expect(container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)?.value).toBe(
        ""
      );
    }
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="steel-home-countertop-request-stone"]'
      )?.disabled
    ).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="steel-home-countertop-find-fabricator"]'
      )?.disabled
    ).toBe(true);
  });

  it("unlocks the measured plan after review and resets review when a surface value changes", async () => {
    await render(createEmptySteelHomeProjectDraft().countertops);
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-view-plan"]')!
        .click()
    );
    const reviewed = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-measurements-reviewed"]'
    );
    if (!reviewed) throw new Error("Missing measurement review control");

    act(() => reviewed.click());
    expect(reviewed.checked).toBe(true);
    expect(container.querySelector('[data-testid="steel-home-countertop-preview"]')).toBeTruthy();
    expect(container.textContent).toContain("About 33.7 sq. ft.");
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="steel-home-countertop-find-fabricator"]'
      )?.disabled
    ).toBe(false);

    const mainRun = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-countertop-run-a"]'
    );
    if (!mainRun) throw new Error("Missing main-run field");
    setInputValue(mainRun, "132");
    expect(reviewed.checked).toBe(false);
    expect(
      container.querySelector('[data-testid="steel-home-countertop-plan-unreviewed"]')
    ).toBeTruthy();
  });

  it("allows a reviewed generic fixture point in a fabricator brief without inventing a cutout", async () => {
    const design = resolveCountertopPlannerDesign({
      ...createEmptySteelHomeProjectDraft().countertops,
      measurementsReviewed: true,
      sink: "Single-bowl undermount",
      sinkRun: "main",
      sinkPositionIn: 48,
      sinkFrontPositionIn: 12,
    });
    await render(design);

    const sinkItem = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-countertop-cutout-item-sink"]'
    );
    expect(sinkItem?.dataset.representation).toBe("coordination-point");
    expect(container.textContent).toContain("Template sizes unresolved · coordination points only");
    expect(container.textContent).toContain(
      "the scene shows only a coordination point and does not guess a cutout"
    );
    const fabricator = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-find-fabricator"]'
    );
    expect(fabricator?.disabled).toBe(false);
    act(() => fabricator?.click());
    expect(onRequest).not.toHaveBeenCalled();
    act(() => fabricator?.click());
    expect(onRequest).toHaveBeenCalledWith("fabricator");
  });

  it("keeps a stone request independent from unreviewed fabrication geometry", async () => {
    await render({
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "cristallo",
    });
    const stone = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-request-stone"]'
    );
    const fabricator = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-find-fabricator"]'
    );
    expect(stone?.disabled).toBe(false);
    expect(fabricator?.disabled).toBe(true);

    act(() => stone?.click());
    expect(onRequest).not.toHaveBeenCalled();
    act(() => stone?.click());
    expect(onRequest).toHaveBeenCalledWith("stone");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ included: true }));
  });

  it("keeps showroom room and floor exploration out of the saved project and reviews before requesting", async () => {
    await render({
      ...createEmptySteelHomeProjectDraft().countertops,
      measurementsReviewed: true,
      room: "Kitchen",
      wallAIn: 180,
      stoneId: "cristallo",
    });
    const bathroom = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Bathroom"
    )!;
    act(() => bathroom.click());
    const floor = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    act(() => floor.click());
    expect(onChange).not.toHaveBeenCalled();
    const request = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-countertop-find-fabricator"]'
    )!;
    expect(request.textContent).toContain("Review fabrication plan");
    act(() => request.click());
    expect(onRequest).not.toHaveBeenCalled();
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="steel-home-countertop-room"]')
        ?.value
    ).toBe("Kitchen");
    expect(
      container.querySelector<HTMLInputElement>('[data-testid="steel-home-countertop-run-a"]')
        ?.value
    ).toBe("180");
    act(() => request.click());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        room: "Kitchen",
        wallAIn: 180,
        floorStone: false,
        measurementsReviewed: true,
      })
    );
  });

  it("shares the selected measured design with a usable link when clipboard access fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard unavailable"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    try {
      await render({
        ...createEmptySteelHomeProjectDraft().countertops,
        stoneId: "cristallo",
        measurementsReviewed: true,
        roomWidthIn: 240,
        notes: "private gate code 1234",
      });
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-share"]')!
          .click();
      });
      const link = container.querySelector<HTMLInputElement>('input[aria-label="Plan link"]')!;
      expect(link.value).toContain("/u/steel-home-packages/builders/countertops?");
      expect(writeText).toHaveBeenCalledWith(link.value);
      expect(container.textContent).toContain("Select and copy the link below.");
      expect(parseCountertopStudioShareUrl(link.value)).toMatchObject({
        stoneId: "cristallo",
        roomWidthIn: 240,
        measurementsReviewed: true,
        notes: "",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("waits for the recipient to open a shared plan before replacing their current draft", async () => {
    const shared = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "taj-mahal",
      measurementsReviewed: true,
      wallAIn: 144,
      roomWidthIn: 240,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 48,
      sinkFrontPositionIn: 12,
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
    };
    const sharedUrl = new URL(buildCountertopStudioShareUrl(shared, window.location.href)!);
    const catalogStone = getCatalogItemById("arizona-gold")!;
    sharedUrl.searchParams.set("stone", catalogStone.shareSlug!);
    sharedUrl.searchParams.set("photo", buildStoneDesignerPhotoKey(catalogStone.images[0]!)!);
    window.history.replaceState(null, "", sharedUrl);
    await render({ ...createEmptySteelHomeProjectDraft().countertops, stoneId: "cristallo" });
    expect(onChange).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="steel-home-countertop-shared-plan"]')
    ).toBeTruthy();
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-countertop-open-shared"]')!
        .click()
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stoneId: "taj-mahal",
        wallAIn: 144,
        roomWidthIn: 240,
        sinkTemplateWidthIn: 30,
        sinkTemplateDepthIn: 18,
      })
    );
    expect(container.querySelector('[data-testid="steel-home-countertop-shared-plan"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-preview"]')).toBeTruthy();
  });
});
