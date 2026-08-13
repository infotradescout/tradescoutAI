// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BuildingDesigner from "./BuildingDesigner";
import { createEmptySteelHomeProjectDraft } from "./projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function BuildingHarness({ onRequest }: { onRequest: () => void }) {
  const [design, setDesign] = useState(() => createEmptySteelHomeProjectDraft().building);
  return <BuildingDesigner design={design} onChange={setDesign} onRequest={onRequest} />;
}

function setNumberValue(control: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("BuildingDesigner", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onRequest: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onRequest = vi.fn<() => void>();
    act(() => root.render(<BuildingHarness onRequest={onRequest} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("draws every selected window from zero through sixteen", () => {
    const windowCount = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-windows"]'
    );
    if (!windowCount) throw new Error("Building window-count control missing");

    setNumberValue(windowCount, "16");
    const preview = container.querySelector<SVGSVGElement>(
      '[data-testid="steel-home-building-preview"]'
    );
    if (!preview) throw new Error("Building preview missing");

    const windows = Array.from(
      preview.querySelectorAll<SVGRectElement>('[data-testid="steel-home-building-window-preview"]')
    );
    expect(preview.dataset.windows).toBe("16");
    expect(windows).toHaveLength(16);
    expect(
      new Set(windows.map((window) => `${window.getAttribute("x")}:${window.getAttribute("y")}`))
        .size
    ).toBe(16);

    setNumberValue(windowCount, "0");
    expect(preview.dataset.windows).toBe("0");
    expect(
      preview.querySelectorAll('[data-testid="steel-home-building-window-preview"]')
    ).toHaveLength(0);
  });

  it("blocks counts outside the rough wall fit and explains how to correct them", () => {
    const disclosure = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-building-opening-disclosure"]'
    );
    const requestButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-building-include"]'
    );
    const width = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-width"]'
    );
    const length = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-length"]'
    );
    const garages = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-garage-doors"]'
    );
    const entries = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-walk-doors"]'
    );
    const windows = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-building-windows"]'
    );
    if (!requestButton || !width || !length || !garages || !entries || !windows) {
      throw new Error("Building opening-fit controls missing");
    }

    expect(disclosure?.textContent).toContain("Opening counts are planning requirements only.");
    expect(disclosure?.textContent).toContain(
      "Final sizes, placement, framing, clearances, and engineering must be confirmed"
    );
    expect(requestButton.disabled).toBe(false);

    setNumberValue(width, "12");
    setNumberValue(length, "20");
    setNumberValue(garages, "5");
    setNumberValue(entries, "5");
    setNumberValue(windows, "16");

    const warning = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-building-opening-fit-warning"]'
    );
    expect(warning?.textContent).toContain("The opening counts do not fit this rough plan.");
    expect(warning?.textContent).toContain("about 101 feet short");
    expect(warning?.textContent).toContain("increase either Width or Length by at least 51 feet");
    expect(requestButton.disabled).toBe(true);
    expect(requestButton.getAttribute("aria-disabled")).toBe("true");
    expect(requestButton.getAttribute("aria-describedby")).toContain(
      "steel-home-building-opening-fit-warning"
    );

    act(() => requestButton.click());
    expect(onRequest).not.toHaveBeenCalled();

    setNumberValue(length, "71");
    expect(
      container.querySelector('[data-testid="steel-home-building-opening-fit-warning"]')
    ).toBeNull();
    expect(requestButton.disabled).toBe(false);
    expect(requestButton.getAttribute("aria-disabled")).toBe("false");

    act(() => requestButton.click());
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});
