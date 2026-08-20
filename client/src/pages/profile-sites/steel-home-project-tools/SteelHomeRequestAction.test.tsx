/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SteelHomeRequestAction from "./SteelHomeRequestAction";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("SteelHomeRequestAction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.sessionStorage.clear();
  });

  function render(destinationHref: string) {
    act(() => {
      root.render(
        <SteelHomeRequestAction
          ready
          context={{ title: "Measured metal plan", description: "50 × 60 measured shell" }}
          destinationHref={destinationHref}
          testId="request-action"
        />
      );
    });
  }

  it("stages a same-origin summary before navigation", () => {
    render("/direct-connect?source=planner");
    const anchor = container.querySelector<HTMLAnchorElement>('[data-testid="request-action"]');
    if (!anchor) throw new Error("Missing request action");

    act(() => anchor.focus());

    expect(anchor.href).toMatch(/\/direct-connect\?source=planner&staged=[a-f0-9]{64}$/);
    expect(window.sessionStorage.length).toBe(1);
    expect(container.querySelector('[data-testid="request-action-stage-failure"]')).toBeNull();
  });

  it("fails closed and exposes only a deliberate unstaged fallback", () => {
    render("https://www.thetradescout.com/direct-connect?source=planner");
    const anchor = container.querySelector<HTMLAnchorElement>('[data-testid="request-action"]');
    if (!anchor) throw new Error("Missing request action");

    let dispatched = true;
    act(() => {
      dispatched = anchor.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 })
      );
    });

    expect(dispatched).toBe(false);
    expect(window.sessionStorage.length).toBe(0);
    expect(container.textContent).toContain(
      "The planner summary was not attached. Nothing was sent."
    );
    expect(
      container.querySelector<HTMLAnchorElement>('[data-testid="request-action-unstaged-fallback"]')
        ?.href
    ).toBe("https://www.thetradescout.com/direct-connect?source=planner");
    expect(
      container.querySelector<HTMLTextAreaElement>(
        '[aria-label="Planner summary to copy manually"]'
      )?.value
    ).toContain("50 × 60 measured shell");
  });
});
