// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BuildingDesigner from "./BuildingDesigner";
import {
  sanitizeBuildingPlannerExtension,
  type BuildingPlannerExtensionV1,
  type BuildingPlannerRequest,
} from "./buildingPlannerModel";
import { createEmptySteelHomeProjectDraft, type SteelHomeBuildingDesign } from "./projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function Harness({
  onRequest,
  onLegacyChange,
  onPlannerRequest,
  onExtensionChange,
}: {
  onRequest: () => void;
  onLegacyChange: (design: SteelHomeBuildingDesign) => void;
  onPlannerRequest: (request: BuildingPlannerRequest) => void;
  onExtensionChange: (extension: BuildingPlannerExtensionV1) => void;
}) {
  const [design, setDesign] = useState(() => createEmptySteelHomeProjectDraft().building);
  return (
    <BuildingDesigner
      design={design}
      onChange={(next) => {
        setDesign(next);
        onLegacyChange(next);
      }}
      onRequest={onRequest}
      onPlannerRequest={onPlannerRequest}
      onExtensionChange={onExtensionChange}
    />
  );
}

function RetiredCatalogHarness({ extension }: { extension: BuildingPlannerExtensionV1 }) {
  const [planner, setPlanner] = useState(extension);
  return (
    <BuildingDesigner
      design={createEmptySteelHomeProjectDraft().building}
      onChange={() => undefined}
      onRequest={() => undefined}
      extension={planner}
      onExtensionChange={setPlanner}
    />
  );
}

function setSelect(container: HTMLElement, testId: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`);
  if (!select) throw new Error(`Missing select ${testId}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  act(() => {
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setNumber(container: HTMLElement, testId: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
  if (!input) throw new Error(`Missing number ${testId}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("BuildingDesigner", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onRequest: ReturnType<typeof vi.fn<() => void>>;
  let onLegacyChange: ReturnType<typeof vi.fn<(design: SteelHomeBuildingDesign) => void>>;
  let onPlannerRequest: ReturnType<typeof vi.fn<(request: BuildingPlannerRequest) => void>>;
  let onExtensionChange: ReturnType<typeof vi.fn<(extension: BuildingPlannerExtensionV1) => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onRequest = vi.fn();
    onLegacyChange = vi.fn();
    onPlannerRequest = vi.fn();
    onExtensionChange = vi.fn();
    act(() =>
      root.render(
        <Harness
          onRequest={onRequest}
          onLegacyChange={onLegacyChange}
          onPlannerRequest={onPlannerRequest}
          onExtensionChange={onExtensionChange}
        />
      )
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("starts blank even when the compatibility design contains historical defaults", () => {
    expect(container.querySelector('[data-testid="building-view-blank"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('[data-testid="building-width"]')?.value).toBe(
      ""
    );
    expect(container.querySelector<HTMLSelectElement>('[data-testid="building-roof"]')?.value).toBe(
      ""
    );
    expect(
      container.querySelectorAll('[aria-label^="wall color:"][aria-pressed="true"]')
    ).toHaveLength(0);
    expect(container.textContent).toContain("Quote required");
    expect(container.textContent).not.toMatch(/early price|\$\d|estimate range/i);
  });

  it("uses the chosen use without inventing dimensions, frame, roof, or finish", () => {
    const use = container.querySelector<HTMLButtonElement>(
      '[data-testid="building-use-home-with-shop"]'
    );
    act(() => use?.click());
    expect(use?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector<HTMLInputElement>('[data-testid="building-width"]')?.value).toBe(
      ""
    );
    expect(
      container.querySelector<HTMLSelectElement>('[data-testid="building-system"]')?.value
    ).toBe("");
    expect(container.querySelector<HTMLSelectElement>('[data-testid="building-roof"]')?.value).toBe(
      ""
    );
    expect(
      container.querySelectorAll('[aria-label^="roof color:"][aria-pressed="true"]')
    ).toHaveLength(0);
    expect(onExtensionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        useId: "home-with-shop",
        widthFt: null,
        systemId: null,
        roofId: null,
      })
    );
  });

  it("adds a placed opening and an explicit attachment instead of count-only decoration", () => {
    setSelect(container, "building-opening-type-to-add", "overhead-door");
    act(() =>
      container.querySelector<HTMLButtonElement>('[data-testid="building-add-opening"]')?.click()
    );
    expect(container.querySelector('[data-testid="building-opening-row-0"]')?.textContent).toMatch(
      /overhead sectional door.*surface.*width.*height.*offset.*sill/is
    );
    expect(container.querySelector('[data-testid="building-blockers"]')?.textContent).toMatch(
      /choose the opening surface/i
    );

    setSelect(container, "building-attachment-type-to-add", "porch");
    act(() =>
      container.querySelector<HTMLButtonElement>('[data-testid="building-add-attachment"]')?.click()
    );
    expect(
      container.querySelector('[data-testid="building-attachment-row-0"]')?.textContent
    ).toMatch(/footprint only — height and roof connection unresolved/i);
  });

  it("shows a retired saved identifier and provides an explicit resolution action", () => {
    const retired = sanitizeBuildingPlannerExtension({
      useId: "garage-workshop",
      systemId: "retired-mega-frame",
    });
    act(() => root.render(<RetiredCatalogHarness extension={retired} />));
    const unresolved = container.querySelector<HTMLElement>(
      '[data-testid="building-unresolved-catalog"]'
    );
    expect(unresolved?.textContent).toMatch(/structural system:.*retired-mega-frame/i);
    expect(
      container.querySelector<HTMLButtonElement>('[data-testid="steel-home-building-include"]')
        ?.disabled
    ).toBe(true);
    const remove = Array.from(unresolved?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
      (button) => button.textContent?.includes("Remove saved reference")
    );
    act(() => remove?.click());
    expect(container.querySelector('[data-testid="building-unresolved-catalog"]')).toBeNull();
    expect(container.textContent).not.toContain("retired-mega-frame");
  });

  it("submits only a valid measured request and projects to legacy at that boundary", () => {
    const requestButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-building-include"]'
    );
    expect(requestButton?.disabled).toBe(true);
    act(() => requestButton?.click());
    expect(onRequest).not.toHaveBeenCalled();

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-testid="building-use-home-with-shop"]')
        ?.click()
    );
    setSelect(container, "building-system", "open-web-truss");
    setSelect(container, "building-roof", "gable");
    setNumber(container, "building-width", "50");
    setNumber(container, "building-length", "60");
    setNumber(container, "building-eave-height", "14");
    setNumber(container, "building-roof-pitch", "4");

    expect(container.querySelector('[data-testid="building-no-blockers"]')).not.toBeNull();
    expect(requestButton?.disabled).toBe(false);
    expect(
      container.querySelector('[data-testid="building-request-schedule"]')?.textContent
    ).toMatch(/50 × 60 × 14 ft eave.*gable, 4:12/i);
    act(() => requestButton?.click());

    expect(onPlannerRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteRequired: true,
        use: "Home with shop",
        structuralSystem: "Open-web clearspan truss",
        shell: "50 × 60 × 14 ft eave",
      })
    );
    expect(onLegacyChange).toHaveBeenCalledWith(
      expect.objectContaining({ included: true, widthFt: 50, lengthFt: 60, eaveHeightFt: 14 })
    );
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});
