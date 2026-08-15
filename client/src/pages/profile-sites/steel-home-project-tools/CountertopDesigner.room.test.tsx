/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import CountertopDesigner from "./CountertopDesigner";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("countertop bathroom controls", () => {
  it("keeps kitchen-only controls and summary language out of an initial bathroom view", async () => {
    const design = reconcileSteelHomeProjectDraft({
      countertops: {
        ...createEmptySteelHomeProjectDraft().countertops,
        room: "Guest bathroom",
        island: true,
        waterfall: "Both",
        cooktop: "36-inch range gap",
        cooktopRun: "island",
        cooktopPositionIn: 42,
      },
    }).countertops;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountertopDesigner design={design} onChange={vi.fn()} onRequest={vi.fn()} />);
    });

    expect(container.querySelector('[data-testid="steel-home-countertop-island"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-cooktop"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-waterfall"]')).toBeNull();
    expect(container.textContent).toContain("Sink and other bathroom openings");
    expect(container.textContent).toContain("Gross vanity-top footprint");
    expect(container.textContent).not.toMatch(
      /cooktop|range gap|include an island|waterfall ends/i
    );

    act(() => root.unmount());
    container.remove();
  });

  it("keeps raw island openings unplaced in bathroom and restores dormant kitchen fields", async () => {
    const design = reconcileSteelHomeProjectDraft({
      countertops: {
        ...createEmptySteelHomeProjectDraft().countertops,
        room: "Guest bathroom",
        layout: "straight",
        wallAIn: 120,
        wallDepthIn: 22,
        island: true,
        islandLengthIn: 150,
        islandWidthIn: 66,
        waterfall: "Both",
        sink: "Single-bowl undermount",
        sinkRun: "island",
        sinkPositionIn: 55,
        sinkFrontPositionIn: 30,
        cooktop: "30-inch cooktop cutout",
        cooktopRun: "island",
        cooktopPositionIn: 96,
        cooktopFrontPositionIn: 31,
        otherCutouts: [
          {
            id: "other-1",
            type: "Pop-up outlet",
            label: "",
            run: "island",
            positionIn: 42,
            frontPositionIn: 21,
            widthIn: 4,
            depthIn: 4,
          },
        ],
      },
    }).countertops;
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountertopDesigner design={design} onChange={onChange} onRequest={vi.fn()} />);
    });

    const sinkItem = container.querySelector(
      '[data-testid="steel-home-countertop-cutout-item-sink"]'
    );
    const otherItem = container.querySelector(
      '[data-testid="steel-home-countertop-cutout-item-other-1"]'
    );
    expect(sinkItem?.getAttribute("aria-invalid")).toBe("true");
    expect(otherItem?.getAttribute("aria-invalid")).toBe("true");
    expect(sinkItem?.textContent).toContain("Needs a location");
    expect(otherItem?.textContent).toContain("Needs a location");
    expect(container.querySelector('[data-testid="steel-home-countertop-cooktop"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\bIsland\b/i);

    const surface = container.querySelector(
      '[data-testid="steel-home-countertop-cutout-surface"]'
    ) as HTMLSelectElement;
    expect(Array.from(surface.options).map((option) => option.value)).toEqual(["", "main"]);
    expect(surface.options.item(1)?.textContent).toContain('120" × 22"');
    expect(surface.textContent).not.toMatch(/Island/i);

    const injectedIslandOption = document.createElement("option");
    injectedIslandOption.value = "island";
    injectedIslandOption.textContent = "Island";
    surface.append(injectedIslandOption);
    await act(async () => {
      surface.value = "island";
      surface.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="steel-home-countertop-cutout-status"]')?.textContent
    ).toContain("cannot be placed on that run in this room");

    const activeSurface = container.querySelector(
      '[data-testid="steel-home-countertop-cutout-surface"]'
    ) as HTMLSelectElement;
    await act(async () => {
      activeSurface.value = "main";
      activeSurface.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const remappedBathroom = onChange.mock.calls[0][0];
    expect(remappedBathroom).toMatchObject({
      room: "Guest bathroom",
      island: true,
      islandLengthIn: 150,
      islandWidthIn: 66,
      waterfall: "Both",
      sinkRun: "main",
      sinkPositionIn: 60,
      sinkFrontPositionIn: 11,
      cooktop: "30-inch cooktop cutout",
      cooktopRun: "island",
      cooktopPositionIn: 96,
      cooktopFrontPositionIn: 31,
      otherCutouts: [{ id: "other-1", run: "island", positionIn: 42 }],
    });

    await act(async () => {
      root.render(
        <CountertopDesigner design={remappedBathroom} onChange={onChange} onRequest={vi.fn()} />
      );
    });
    const room = container.querySelector(
      '[data-testid="steel-home-countertop-room"]'
    ) as HTMLSelectElement;
    await act(async () => {
      room.value = "Kitchen";
      room.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    const restoredKitchen = onChange.mock.calls[1][0];
    expect(restoredKitchen).toMatchObject({
      room: "Kitchen",
      island: true,
      islandLengthIn: 150,
      islandWidthIn: 66,
      waterfall: "Both",
      cooktop: "30-inch cooktop cutout",
      cooktopRun: "island",
      cooktopPositionIn: 96,
      cooktopFrontPositionIn: 31,
    });
    await act(async () => {
      root.render(
        <CountertopDesigner design={restoredKitchen} onChange={onChange} onRequest={vi.fn()} />
      );
    });
    expect(container.querySelector('[data-testid="steel-home-countertop-island"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="steel-home-countertop-cooktop"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
