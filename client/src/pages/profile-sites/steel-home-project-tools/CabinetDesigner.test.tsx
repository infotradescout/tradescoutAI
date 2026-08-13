// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CabinetDesigner from "./CabinetDesigner";
import { createEmptySteelHomeProjectDraft } from "./projectModel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function CabinetHarness({ onRequest }: { onRequest: () => void }) {
  const [design, setDesign] = useState(() => createEmptySteelHomeProjectDraft().cabinets);
  return <CabinetDesigner design={design} onChange={setDesign} onRequest={onRequest} />;
}

function setNumberValue(control: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("CabinetDesigner request fit gate", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onRequest: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onRequest = vi.fn<() => void>();
    act(() => root.render(<CabinetHarness onRequest={onRequest} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("blocks an overfilled primary wall and gives the exact correction", () => {
    const primaryWall = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-cabinet-primary-wall"]'
    );
    const requestButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-cabinet-include"]'
    );
    if (!primaryWall || !requestButton) throw new Error("Cabinet fit controls missing");

    expect(requestButton.disabled).toBe(false);
    setNumberValue(primaryWall, "180");

    const warning = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-cabinet-fit-warning"]'
    );
    expect(warning?.textContent).toContain("Fix the primary-wall fit before starting.");
    expect(warning?.textContent).toContain("Increase Primary wall to at least 198 inches");
    expect(warning?.textContent).toContain(
      "remove at least 18 inches of appliance or storage modules"
    );
    expect(requestButton.disabled).toBe(true);
    expect(requestButton.getAttribute("aria-disabled")).toBe("true");
    expect(requestButton.getAttribute("aria-describedby")).toBe("steel-home-cabinet-fit-warning");

    act(() => requestButton.click());
    expect(onRequest).not.toHaveBeenCalled();

    setNumberValue(primaryWall, "198");
    expect(container.querySelector('[data-testid="steel-home-cabinet-fit-warning"]')).toBeNull();
    expect(requestButton.disabled).toBe(false);
    expect(requestButton.getAttribute("aria-disabled")).toBe("false");

    act(() => requestButton.click());
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});
