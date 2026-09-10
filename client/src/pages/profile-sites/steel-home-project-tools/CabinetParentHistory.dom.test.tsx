/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SteelHomePackagesProfile from "../SteelHomePackagesProfile";
import { createEmptySteelHomeProjectDraft, loadSteelHomeProjectDraft, saveSteelHomeProjectDraft } from "./projectModel";
import { createCabinetPlannerModule, reconcileCabinetPlannerExtension } from "./cabinetPlannerModel";

// Keep the real parent, cabinet wrapper, measured editor, placement model and history.
// Only the unavailable jsdom graphics context is replaced; no request is submitted.
vi.mock("./CabinetThreePreview", () => ({ default: () => <div data-testid="mock-cabinet-webgl" /> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Cabinet history through the production parent", () => {
  let root: Root;
  let container: HTMLDivElement;
  const saved = () => loadSteelHomeProjectDraft(window.localStorage);
  const button = (name: string) => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent === name)!;
  const input = (id: string) => container.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
  async function changeInput(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
    await act(async () => {
      setter.call(control, value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function click(control: HTMLElement) { await act(async () => control.click()); }
  beforeEach(async () => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/cabinets");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets.notes = "Earlier outer summary";
    draft.cabinets.planner = reconcileCabinetPlannerExtension({
      starter: "kitchen", shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
      modules: [createCabinetPlannerModule("base-cabinet", "a"), { ...createCabinetPlannerModule("base-cabinet", "b"), offsetIn: 60 }],
      selectedModuleId: "a", notes: "Measured field notes remain authoritative",
      presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: { a: "drawers", b: "doors" } },
    });
    draft.countertops.notes = "Separate countertop draft";
    expect(saveSteelHomeProjectDraft(window.localStorage, draft)).toBe(true);
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    await act(async () => {
      await Promise.all([import("./CabinetDesigner"), import("./CabinetInteractivePlan")]);
      root.render(<SteelHomePackagesProfile requestHref="/direct-connect" laborRequestHref="/direct-connect" initialBuilder="cabinets" />);
    });
    await vi.waitFor(() => expect(container.querySelector('[data-module="a"]')).not.toBeNull());
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove(); vi.restoreAllMocks(); window.localStorage.clear();
  });
  it("preserves one-step undo through the actual parent with differing note fields", async () => {
    const baseline = saved();
    expect(baseline.cabinets.notes).not.toBe(baseline.cabinets.planner.notes);
    await changeInput(input("steel-home-cabinet-module-offset"), "30");
    expect(saved().cabinets.planner.modules[0].offsetIn).toBe(30);
    expect(button("Undo").disabled).toBe(false);
    expect(saved().cabinets.notes).toBe(baseline.cabinets.planner.notes);
    expect(saved().cabinets.planner.shell.measurementsReviewed).toBe(false);
    await click(button("Undo"));
    expect(saved()).toEqual(baseline);
    expect(button("Redo").disabled).toBe(false);
    await click(button("Redo"));
    expect(saved().cabinets.planner.modules[0].offsetIn).toBe(30);
    expect(saved().countertops).toEqual(baseline.countertops);
    expect(saved().cabinets.planner.presentation).toEqual(baseline.cabinets.planner.presentation);
  });
  it("preserves sequential placement and note edits with separate undo steps", async () => {
    const baseline = saved();
    await act(async () => container.querySelector('[data-module="a"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true })));
    expect(saved().cabinets.planner.modules[0].offsetIn).toBe(1);
    const moved = saved();
    await changeInput(container.querySelector<HTMLTextAreaElement>('[data-testid="steel-home-cabinet-notes"]')!, "Updated measured note");
    expect(saved().cabinets.notes).toBe("Updated measured note");
    await click(button("Undo")); expect(saved()).toEqual(moved);
    await click(button("Undo")); expect(saved()).toEqual(baseline);
  });
  it("keeps explicit parent reset isolated from the previous draft's undo history", async () => {
    await changeInput(input("steel-home-cabinet-module-offset"), "30");
    expect(button("Undo").disabled).toBe(false);
    const countertop = saved().countertops;
    await click(container.querySelector<HTMLElement>('[data-testid="steel-home-builder-reset"]')!);
    expect(saved().cabinets.planner.modules).toEqual([]);
    expect(saved().countertops).toEqual(countertop);
    await click(container.querySelector<HTMLElement>('[data-testid="steel-home-cabinet-start-kitchen"]')!);
    await click(button("Undo"));
    expect(saved().cabinets.planner.modules).toEqual([]);
    expect(saved().cabinets.planner.starter).toBeNull();
  });
});
