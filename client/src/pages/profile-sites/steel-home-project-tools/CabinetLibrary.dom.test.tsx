/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SteelHomePackagesProfile from "../SteelHomePackagesProfile";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import { createBlankCabinetPlannerExtension } from "./cabinetPlannerModel";

vi.mock("./CabinetThreePreview", () => ({ default: () => <div>3D preview stub</div> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const storageKey = "tradescout:steel-home-project-tools:draft:v9";

describe("Cabinet library through the actual planner parent", () => {
  let container: HTMLDivElement;
  let root: Root;
  const read = () => JSON.parse(localStorage.getItem(storageKey)!);
  const button = (name: string) => {
    const node = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(item => item.textContent === name);
    if (!node) throw new Error(`Missing button ${name}`);
    return node;
  };
  async function click(name: string) { await act(async () => { button(name).click(); }); }
  async function preset(id: string) {
    await act(async () => { container.querySelector<HTMLButtonElement>(`[data-testid="cabinet-library-${id}"]`)!.click(); });
  }
  async function open() {
    await click("Cabinet library");
    await vi.waitFor(() => expect(container.querySelector('[data-testid="cabinet-library-panel"]')).not.toBeNull());
  }
  beforeEach(async () => {
    localStorage.clear();
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets = { ...draft.cabinets, notes: "Earlier outer notes", planner: {
      ...createBlankCabinetPlannerExtension(), starter: "kitchen",
      shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
      notes: "Private measured notes", presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: {} },
    } };
    localStorage.setItem(storageKey, JSON.stringify(reconcileSteelHomeProjectDraft(draft)));
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/cabinets");
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    await act(async () => { root.render(<SteelHomePackagesProfile initialBuilder="cabinets" requestHref="/direct-connect" laborRequestHref="/direct-connect" />); });
    await vi.waitFor(() => expect(container.querySelector('[aria-label="Cabinet editing actions"]')).not.toBeNull());
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  it("previews without saving, then adds exactly one undoable configured cabinet", async () => {
    const before = read(); await open(); await preset("sink-base");
    expect(read()).toEqual(before);
    expect(button("Add to plan").disabled).toBe(false);
    await click("Add to plan");
    const after = read(); const module = after.cabinets.planner.modules[0];
    expect(module).toMatchObject({ label: "Sink base", widthIn: 36, depthIn: 24, heightIn: 34.5 });
    expect(after.cabinets.planner.presentation.fronts[module.id]).toBe("sink");
    expect(after.countertops).toEqual(before.countertops);
    expect(after.cabinets.planner.notes).toBe(before.cabinets.planner.notes);
    expect(after.cabinets.planner.shell.measurementsReviewed).toBe(false);
    await click("Undo"); expect(read()).toEqual(before);
    await click("Redo"); expect(read()).toEqual(after);
  });
  it("rejects overlapping additions, suggests a measured gap without saving, and counts two cabinets", async () => {
    await open(); await preset("sink-base"); await click("Add to plan");
    expect(button("Add to plan").disabled).toBe(true);
    const beforeGap = read(); await click("Find wall space");
    expect(read()).toEqual(beforeGap); expect(button("Add to plan").disabled).toBe(false);
    expect(container.querySelector<HTMLInputElement>('[aria-label="Library Offset from wall start in"]')!.value).toBe("36");
    await click("Add to plan"); expect(read().cabinets.planner.modules).toHaveLength(2);
    await click("Cabinet schedule");
    expect(container.querySelector('[data-testid="cabinet-schedule-count"]')!.textContent).toContain("2 cabinets · 0 appliance spaces");
    const rows = container.querySelectorAll('[data-testid="cabinet-schedule-row"]'); expect(rows).toHaveLength(1);
    expect(rows[0].querySelector("td")!.textContent).toBe("2");
    expect(container.querySelectorAll('[data-elevation-module] [data-front-arrangement="sink"]')).toHaveLength(2);
  });
  it("shows shared drawer geometry and retains the selected finish", async () => {
    await open(); await preset("drawer-bank");
    expect(container.querySelectorAll('[aria-label="Proposed cabinet front"] [data-casework-role="drawer"]')).toHaveLength(3);
    await click("Add to plan");
    const planner = read().cabinets.planner;
    expect(planner.presentation.finish).toBe("sage");
    expect(planner.presentation.fronts[planner.modules[0].id]).toBe("drawers");
  });
  it("closing a proposal leaves the project untouched and restores keyboard focus", async () => {
    const before = read(); await open(); await preset("pantry");
    await click("Close library and schedule"); expect(read()).toEqual(before);
    expect(document.activeElement).toBe(button("Cabinet library"));
  });
  it("does not invent a missing floor position", async () => {
    await open(); await preset("island-drawers");
    expect(button("Add to plan").disabled).toBe(true);
    expect(read().cabinets.planner.modules).toHaveLength(0);
  });
  it("retains a visible schedule when downloads are unavailable", async () => {
    await open(); await preset("door-base"); await click("Add to plan");
    await click("Cabinet schedule");
    const original = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const denied = vi.fn(() => { throw new Error("Synthetic download denial"); });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: denied });
    try {
      await click("Export cabinet schedule");
      expect(denied).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("Download unavailable");
      expect(container.querySelector('[aria-label="Dimensioned cabinet schedule"]')).not.toBeNull();
    } finally {
      if (original) Object.defineProperty(URL, "createObjectURL", original);
      else Reflect.deleteProperty(URL, "createObjectURL");
    }
  });
});
