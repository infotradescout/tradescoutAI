/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SteelHomePackagesProfile from "../SteelHomePackagesProfile";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import { createBlankCabinetPlannerExtension, createCabinetPlannerModule } from "./cabinetPlannerModel";

vi.mock("./CabinetThreePreview", () => ({ default: () => <div>3D renderer stub</div> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const key = "tradescout:steel-home-project-tools:draft:v9";

describe("Cabinet canvas workflow through the production parent", () => {
  let container: HTMLDivElement, root: Root;
  const read = () => JSON.parse(localStorage.getItem(key)!);
  const button = (label: string) => {
    const node = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.getAttribute("aria-label") === label || item.textContent === label);
    if (!node) throw new Error(`Missing button ${label}`); return node;
  };
  const click = async (label: string) => { await act(async () => button(label).click()); };
  const select = async (label: string, value: string) => {
    await act(async () => { const input = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!; input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); });
  };
  beforeEach(async () => {
    localStorage.clear();
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets = { ...draft.cabinets, notes: "Previous outer note", planner: {
      ...createBlankCabinetPlannerExtension(), starter: "kitchen", selectedModuleId: "base",
      shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
      modules: [createCabinetPlannerModule("base-cabinet", "base"), createCabinetPlannerModule("wall-cabinet", "upper")],
      notes: "Private measured notes", presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: { base: "drawers", upper: "doors" } },
    } };
    localStorage.setItem(key, JSON.stringify(reconcileSteelHomeProjectDraft(draft)));
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/cabinets");
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    await act(async () => {
      await Promise.all([import("./CabinetInteractivePlan"), import("./CabinetLibraryPanel")]);
      root.render(<SteelHomePackagesProfile initialBuilder="cabinets" requestHref="/direct-connect" laborRequestHref="/direct-connect" />);
    });
    await vi.waitFor(() => expect(container.querySelector('[data-testid="steel-home-cabinet-plan"]')).not.toBeNull());
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("zooms and fits selected objects without creating saved edits or enabling Undo", async () => {
    const before = read(), drawing = container.querySelector('[data-testid="steel-home-cabinet-plan"]')!;
    const originalView = drawing.getAttribute("viewBox");
    await click("Zoom cabinet plan in");
    expect(drawing.getAttribute("viewBox")).not.toBe(originalView); expect(read()).toEqual(before);
    expect(button("Undo").disabled).toBe(true);
    await click("Fit selected"); expect(read()).toEqual(before);
    await click("Fit room"); expect(drawing.getAttribute("viewBox")).toBe(originalView);
    expect(read()).toEqual(before);
  });
  it("makes a base beneath an upper separately selectable while retaining both saved objects", async () => {
    const before = read();
    await select("Cabinet plan layer", "lower");
    expect(container.querySelector('[data-module="base"]')).not.toBeNull();
    expect(container.querySelector('[data-module="upper"]')).toBeNull();
    expect(container.querySelector('[data-layer-ghost="upper"]')).not.toBeNull();
    expect(read()).toEqual(before);
    await select("Cabinet plan layer", "upper");
    expect(container.querySelector('[data-module="upper"]')).not.toBeNull();
    expect(container.querySelector('[data-module="base"]')).toBeNull();
    expect(read()).toEqual(before);
  });
  it("uses the object picker to expose a selected object hidden by the current layer", async () => {
    await select("Cabinet plan layer", "lower");
    await select("Select object in plan", "upper");
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Cabinet plan layer"]')!.value).toBe("all");
    expect(container.querySelector('[data-module="upper"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(read().cabinets.planner.modules).toHaveLength(2);
  });
  it("keeps the original measured editor mounted while focusing the drawing", async () => {
    const before = read(), editor = container.querySelector('[data-testid="steel-home-cabinet-designer"]');
    await click("Focus drawing");
    expect(container.querySelector('[data-canvas-focus="true"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="steel-home-cabinet-designer"]')).toBe(editor);
    expect(read()).toEqual(before);
    await click("Show inspector"); expect(read()).toEqual(before);
  });
  it("opens the real selected cabinet dimension inputs directly without saving or replacing them", async () => {
    const before = read();
    await click("Cabinet library");
    await click("Edit selected dimensions");
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("data-testid")).toBe("steel-home-cabinet-module-width"));
    expect(container.querySelector('[data-testid="cabinet-library-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="steel-home-cabinet-module-width"]')?.closest("details")?.open).toBe(true);
    expect(read()).toEqual(before);
  });
  it("offers visual configurations and group filtering without applying presets", async () => {
    const before = read(); await click("Cabinet library");
    await vi.waitFor(() => expect(container.querySelector('[data-testid="cabinet-visual-catalog"]')).not.toBeNull());
    expect(container.querySelectorAll(".cabinet-catalog-card")).toHaveLength(11);
    expect(container.querySelector('[data-testid="cabinet-library-drawer-bank"]')!.querySelectorAll('[data-catalog-role="drawer"]')).toHaveLength(3);
    await select("Cabinet catalog group", "panels");
    expect(container.querySelectorAll(".cabinet-catalog-card")).toHaveLength(2);
    expect(container.querySelector('[data-testid="cabinet-accessory-filler"]')).not.toBeNull();
    expect(read()).toEqual(before);
  });
  it("keeps private notes and appearance unchanged when browsing a different front", async () => {
    const before = read(); await click("Cabinet library");
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="cabinet-library-sink-base"]')!.click());
    expect(container.querySelector('[data-testid="cabinet-visual-catalog"]')?.getAttribute("data-compact")).toBe("true");
    expect(container.querySelector('[aria-label="Proposed cabinet front"] [data-front-arrangement="sink"]')).not.toBeNull();
    expect(read()).toEqual(before);
  });
});
