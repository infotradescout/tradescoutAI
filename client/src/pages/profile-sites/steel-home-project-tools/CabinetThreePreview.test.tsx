// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CabinetThreePreview, { buildCabinetPreviewSnapshot } from "./CabinetThreePreview";
import {
  applyCabinetPlannerStart,
  createBlankCabinetPlannerExtension,
  createCabinetPlannerModule,
  createCabinetShellItem,
} from "./cabinetPlannerModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function plannerFixture() {
  const base = applyCabinetPlannerStart(createBlankCabinetPlannerExtension(), "kitchen");
  return {
    ...base,
    shell: { widthIn: 144, depthIn: 120, heightIn: 96, measurementsReviewed: true },
    modules: [
      { ...createCabinetPlannerModule("base-cabinet", "base"), offsetIn: 18 },
      {
        ...createCabinetPlannerModule("island", "island"),
        offsetIn: 54,
        roomDepthOffsetIn: 54,
      },
    ],
    shellItems: [{ ...createCabinetShellItem("window", "window"), offsetIn: 72, elevationIn: 42 }],
  };
}

describe("CabinetThreePreview", () => {
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
    vi.restoreAllMocks();
  });

  it("projects the same canonical module and shell-item boxes used by the other views", () => {
    const snapshot = buildCabinetPreviewSnapshot(plannerFixture());

    expect(snapshot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "base",
          category: "module",
          centerIn: [33, 17.25, 12],
          sizeIn: [30, 34.5, 24],
        }),
        expect.objectContaining({
          id: "island",
          category: "module",
          centerIn: [72, 17.25, 66],
          sizeIn: [36, 34.5, 24],
        }),
        expect.objectContaining({
          id: "window",
          category: "shell-item",
          centerIn: [90, 66, 0],
          sizeIn: [36, 48, 4],
        }),
      ])
    );
  });

  it("fails visibly to the measured views when WebGL cannot start", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      root.render(<CabinetThreePreview planner={plannerFixture()} onSelectModule={vi.fn()} />);
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("3D room unavailable");
    expect(container.textContent).toContain("Use the measured plan and elevations instead.");
    expect(container.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("button")?.textContent).toContain("Retry 3D");
  });
});
