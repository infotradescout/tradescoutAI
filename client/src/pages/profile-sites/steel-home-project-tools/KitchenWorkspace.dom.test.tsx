/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SteelHomePackagesProfile from "../SteelHomePackagesProfile";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import { createBlankCabinetPlannerExtension } from "./cabinetPlannerModel";

vi.mock("./CabinetThreePreview", () => ({ default: () => <div>3D stub</div> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const key = "tradescout:steel-home-project-tools:draft:v9";

describe("Kitchen workspace panels with the production parent", () => {
  let root: Root;
  let container: HTMLDivElement;
  const saved = () => JSON.parse(localStorage.getItem(key)!);
  const button = (name: string) => {
    const node = [...container.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent === name);
    if (!node) throw new Error(`Missing ${name}`);
    return node;
  };
  const click = async (name: string) => { await act(async () => { button(name).click(); }); };
  beforeEach(async () => {
    localStorage.clear();
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets = { ...draft.cabinets, notes: "Outer notes", planner: {
      ...createBlankCabinetPlannerExtension(), starter: "kitchen", notes: "Measured notes",
      shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
    } };
    localStorage.setItem(key, JSON.stringify(reconcileSteelHomeProjectDraft(draft)));
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/cabinets");
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    await act(async () => { root.render(<SteelHomePackagesProfile initialBuilder="cabinets" requestHref="/direct-connect" laborRequestHref="/direct-connect" />); });
    await vi.waitFor(() => expect(container.querySelector('[aria-label="Cabinet editing actions"]')).not.toBeNull());
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  it("keeps the same editor mounted and does not save when switching library, schedule or review", async () => {
    const editor = container.querySelector('[data-testid="steel-home-cabinet-designer"]');
    const before = saved();
    for (const name of ["Cabinet library", "Cabinet schedule", "Dimensioned review"]) {
      await click(name);
      await vi.waitFor(() => expect(container.querySelector('dialog[open]')).not.toBeNull());
      expect(container.querySelector('[data-testid="steel-home-cabinet-designer"]')).toBe(editor);
      expect(container.querySelectorAll('dialog[open]')).toHaveLength(1);
      expect(container.querySelector('dialog')!.getAttribute("aria-modal")).not.toBe("true");
      expect(saved()).toEqual(before);
    }
  });
  it("closes the library from an input with Escape and returns focus without changing the draft", async () => {
    const before = saved(); await click("Cabinet library");
    await vi.waitFor(() => expect(container.querySelector('[data-testid="cabinet-library-sink-base"]')).not.toBeNull());
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cabinet-library-sink-base"]')!.click(); });
    const input = container.querySelector<HTMLInputElement>('[aria-label="Library Width in"]')!;
    input.focus();
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    expect(container.querySelector('dialog[open]')).toBeNull();
    expect(document.activeElement).toBe(button("Cabinet library"));
    expect(saved()).toEqual(before);
  });
  it("preserves one-step Add/Undo/Redo while the non-modal panel stays open", async () => {
    const before = saved(); await click("Cabinet library");
    await vi.waitFor(() => expect(container.querySelector('[data-testid="cabinet-library-sink-base"]')).not.toBeNull());
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="cabinet-library-sink-base"]')!.click(); });
    await click("Add to plan"); const after = saved();
    expect(after.cabinets.planner.modules).toHaveLength(1);
    await click("Undo"); expect(saved()).toEqual(before);
    expect(container.querySelector('dialog[open]')).not.toBeNull();
    await click("Redo"); expect(saved()).toEqual(after);
  });
});
