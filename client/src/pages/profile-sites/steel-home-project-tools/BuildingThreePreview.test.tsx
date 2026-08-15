// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import BuildingThreePreview from "./BuildingThreePreview";
import {
  buildBuildingMeasuredScene,
  createEmptyBuildingPlannerExtension,
  type BuildingPlannerExtensionV1,
} from "./buildingPlannerModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function measuredState(): BuildingPlannerExtensionV1 {
  return {
    ...createEmptyBuildingPlannerExtension(),
    useId: "garage-workshop",
    systemId: "open-web-truss",
    widthFt: 40,
    lengthFt: 60,
    eaveHeightFt: 16,
    roofId: "gable",
    roofPitchRise12: 4,
    openings: [
      {
        id: "door-1",
        typeId: "overhead-door",
        surface: "front",
        widthFt: 12,
        heightFt: 12,
        offsetFt: 6,
        sillHeightFt: 0,
        roofXFt: null,
        roofZFt: null,
      },
    ],
    attachments: [
      {
        id: "porch-1",
        typeId: "porch",
        wall: "front",
        offsetFt: 20,
        widthFt: 16,
        projectionFt: 8,
        eaveHeightFt: null,
        roofPitchRise12: null,
      },
    ],
  };
}

describe("BuildingThreePreview", () => {
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

  it("shows an honest blank state before measured geometry exists", () => {
    const scene = buildBuildingMeasuredScene(createEmptyBuildingPlannerExtension());
    act(() => root.render(<BuildingThreePreview scene={scene} />));
    expect(container.querySelector('[data-testid="building-view-blank"]')?.textContent).toMatch(
      /will not invent/i
    );
  });

  it("offers plan, four elevations, and 3D from one scene fingerprint", () => {
    const scene = buildBuildingMeasuredScene(measuredState());
    act(() => root.render(<BuildingThreePreview scene={scene} />));
    expect(
      Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent)
    ).toEqual([
      "3D",
      "Plan",
      "Front elevation",
      "Right elevation",
      "Rear elevation",
      "Left elevation",
    ]);
    expect(container.querySelector('[data-testid="building-view-3d"]')?.textContent).toMatch(
      /does not pretend to be a 3D render/i
    );

    const planTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent === "Plan"
    );
    act(() => planTab?.click());
    const plan = container.querySelector('[data-testid="building-view-plan"]');
    expect(plan?.getAttribute("data-scene-fingerprint")).toBe(scene.fingerprint);
    expect(
      plan?.querySelector('[data-testid="building-opening-door-1"]')?.getAttribute("data-offset-ft")
    ).toBe("6");

    for (const label of [
      "Front elevation",
      "Right elevation",
      "Rear elevation",
      "Left elevation",
    ]) {
      const tab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
        (button) => button.textContent === label
      );
      act(() => tab?.click());
      const wall = label.split(" ")[0].toLowerCase();
      expect(
        container
          .querySelector(`[data-testid="building-view-${wall}"]`)
          ?.getAttribute("data-scene-fingerprint")
      ).toBe(scene.fingerprint);
    }
  });

  it("labels incomplete attachment geometry as footprint-only", () => {
    const scene = buildBuildingMeasuredScene(measuredState());
    act(() => root.render(<BuildingThreePreview scene={scene} />));
    expect(container.textContent).toMatch(
      /footprint only — height and roof connection unresolved/i
    );
  });
});
