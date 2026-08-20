/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import StoneVisualizer3D from "./StoneVisualizer3D";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("countertop spatial studio recovery and controls", () => {
  it("keeps a truthful, announced photo fallback without dead camera controls", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "cristallo",
    };
    await act(async () => {
      root.render(
        <StoneVisualizer3D design={design} selectedTarget="counter" onSelectTarget={vi.fn()} />
      );
    });

    expect(container.textContent).toContain("3D scene unavailable");
    expect(container.textContent).toContain("Retry 3D scene");
    expect(container.textContent).toContain(
      "catalog-photo recovery view, not a rendered measured scene"
    );
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(
      /^\/images\/stone-designer\/named\/cristallo\/ph_[0-9a-f]{16}\.webp$/
    );
    for (const label of ["Orbit view left", "Orbit view right", "Zoom in", "Zoom out"]) {
      expect(container.querySelector(`button[aria-label="${label}"]`)).toBeNull();
    }
    expect(container.textContent).not.toContain("Reset view");
    const alert = container.querySelector('[role="alert"]');
    const retry = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Retry 3D scene")
    );
    expect(alert).toBeTruthy();
    expect(document.activeElement).toBe(retry);
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(canvas?.className).toContain("touch-pan-y");
    expect(canvas?.getAttribute("aria-label")).toContain(
      "One-finger vertical swipes scroll the page"
    );

    await act(async () => {
      retry?.click();
    });
    expect(container.querySelector("canvas")).not.toBe(canvas);
    expect(container.textContent).toContain("3D scene unavailable");

    act(() => root.unmount());
    container.remove();
  });
});
