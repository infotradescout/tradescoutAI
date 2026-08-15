// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CabinetDesigner from "./CabinetDesigner";
import { createEmptySteelHomeProjectDraft, type SteelHomeCabinetDesign } from "./projectModel";
import type { CabinetPlannerExtensionV1 } from "./cabinetPlannerModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function setNumberValue(control: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(container: HTMLElement, testId: string) {
  const control = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!control) throw new Error(`Missing ${testId}`);
  act(() => control.click());
  return control;
}

function enterShell(container: HTMLElement) {
  const values: Array<[string, string]> = [
    ["steel-home-cabinet-primary-wall", "144"],
    ["steel-home-cabinet-return-wall", "120"],
    ["steel-home-cabinet-ceiling-height", "96"],
  ];
  values.forEach(([testId, value]) => {
    const input = container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
    if (!input) throw new Error(`Missing ${testId}`);
    setNumberValue(input, value);
  });
}

function CabinetHarness({
  onChange,
  onRequest,
}: {
  onChange: (design: SteelHomeCabinetDesign) => void;
  onRequest: (planner?: CabinetPlannerExtensionV1) => void;
}) {
  const [design, setDesign] = useState(() => createEmptySteelHomeProjectDraft().cabinets);
  return (
    <CabinetDesigner
      design={design}
      onChange={(next) => {
        onChange(next);
        setDesign(next);
      }}
      onRequest={onRequest}
    />
  );
}

describe("CabinetDesigner measured workbench", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn<(design: SteelHomeCabinetDesign) => void>>;
  let onRequest: ReturnType<typeof vi.fn<(planner?: CabinetPlannerExtensionV1) => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn<(design: SteelHomeCabinetDesign) => void>();
    onRequest = vi.fn<(planner?: CabinetPlannerExtensionV1) => void>();
    act(() => {
      root.render(<CabinetHarness onChange={onChange} onRequest={onRequest} />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows six explicit empty starts with no hidden geometry, appearance, or price", () => {
    expect(container.querySelectorAll('[data-testid^="steel-home-cabinet-start-"]')).toHaveLength(
      6
    );
    expect(container.textContent).toContain("Kitchen");
    expect(container.textContent).toContain("Bathroom Vanity");
    expect(container.textContent).toContain("Laundry");
    expect(container.textContent).toContain("Pantry");
    expect(container.textContent).toContain("Built-in");
    expect(container.textContent).toContain("Blank");
    expect(container.textContent).toContain(
      "No dimensions, modules, island, style, finish, hardware, or price is assumed."
    );
    expect(container.querySelector('[data-testid="steel-home-cabinet-primary-wall"]')).toBeNull();
    expect(container.textContent).not.toMatch(/early price|\$\d/);
  });

  it("gates the request until shell, module placement, and measurement review are complete", () => {
    click(container, "steel-home-cabinet-start-kitchen");
    const request = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-cabinet-include"]'
    );
    if (!request) throw new Error("Missing request button");
    expect(request.disabled).toBe(true);
    expect(container.textContent).toContain(
      "Enter the measured room width, depth, and ceiling height."
    );

    enterShell(container);
    click(container, "steel-home-cabinet-add-base-cabinet");
    expect(request.disabled).toBe(true);
    expect(container.textContent).toContain("Review the room and object measurements");

    click(container, "steel-home-cabinet-review-measurements");
    expect(request.disabled).toBe(false);
    expect(container.textContent).toContain("Ready for review");
    expect(container.querySelector('[data-testid="steel-home-cabinet-plan"]')).not.toBeNull();

    act(() => request.click());
    expect(onRequest).toHaveBeenCalledTimes(1);
    const submitted = onRequest.mock.calls[0]?.[0] as CabinetPlannerExtensionV1;
    expect(submitted.starter).toBe("kitchen");
    expect(submitted.shell).toEqual({
      widthIn: 144,
      depthIn: 120,
      heightIn: 96,
      measurementsReviewed: true,
    });
    expect(submitted.modules).toHaveLength(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ included: true }));
  });

  it("draws all four elevations and blocks a cabinet placed across a door", () => {
    click(container, "steel-home-cabinet-start-blank");
    enterShell(container);
    click(container, "steel-home-cabinet-add-base-cabinet");
    click(container, "steel-home-cabinet-add-door");
    click(container, "steel-home-cabinet-review-measurements");

    const request = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-cabinet-include"]'
    );
    expect(request?.disabled).toBe(true);
    expect(container.textContent).toContain("Base cabinet blocks Door on the north wall.");

    click(container, "steel-home-cabinet-view-elevations");
    ["north", "east", "south", "west"].forEach((wall) => {
      expect(
        container.querySelector(`[data-testid="steel-home-cabinet-elevation-${wall}"]`)
      ).not.toBeNull();
    });
  });

  it("lets a selected module move and resize on the eighth-inch grid", () => {
    click(container, "steel-home-cabinet-start-built-in");
    enterShell(container);
    click(container, "steel-home-cabinet-add-wall-cabinet");
    const width = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-module-width"]'
    );
    const offset = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-module-offset"]'
    );
    if (!width || !offset) throw new Error("Missing module geometry fields");

    setNumberValue(width, "31.19");
    setNumberValue(offset, "12.06");
    expect(width.value).toBe("31.25");
    expect(offset.value).toBe("12");
    expect(container.querySelector('[data-module^="cabinet-module-"]')).not.toBeNull();
  });
});
