/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import SteelHomePackagesProfile from "../SteelHomePackagesProfile";
import { createCabinetTransferTestDraft } from "./cabinetCountertopTransfer.fixture";
import { STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY } from "./projectModel";
import { COUNTERTOP_TRANSFER_BACKUP_KEY } from "./countertopTransferBackup";

vi.mock("./MeasuredCountertopDesigner", () => ({ default: () => <div data-testid="measured-countertop-preserved">Measured editor remains available</div> }));
vi.mock("./CountertopDrawingReview", () => ({ default: () => <div>Scaled drawing</div> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Cabinet handoff through the real planner parent", () => {
  let root: Root;
  let host: HTMLDivElement;
  const read = () => JSON.parse(localStorage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)!);
  const button = (name: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(element => element.textContent === name)!;
  async function click(name: string) { await act(async () => { button(name).click(); }); }
  async function set(label: string, value: string) {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function approve() { await act(async () => host.querySelector<HTMLInputElement>('[aria-label="Approve countertop replacement"]')!.click()); }
  async function openAndMeasure() {
    await click("Use cabinet layout");
    await vi.waitFor(() => expect(host.querySelector('[data-testid="cabinet-countertop-import"]')).not.toBeNull());
    for (const [label, value] of [["Wall-run front overhang (in)", "1.5"], ["Countertop thickness (in)", "1.5"], ["Island west overhang (in)", "1.5"], ["Island east overhang (in)", "4.5"], ["Island north overhang (in)", "1.5"], ["Island south overhang (in)", "10.5"]]) await set(label, value);
  }
  async function mount() {
    await act(async () => root.render(<SteelHomePackagesProfile initialBuilder="countertops" requestHref="/direct-connect" laborRequestHref="/direct-connect" />));
    await vi.waitFor(() => expect(button("Use cabinet layout")).toBeDefined());
  }
  beforeEach(async () => {
    await Promise.all([import("./CountertopDesigner"), import("./CabinetCountertopImport")]);
    localStorage.clear(); localStorage.setItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(createCabinetTransferTestDraft()));
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/countertops");
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await mount();
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });
  it("does not change either design while opening, measuring or cancelling a preview", async () => {
    const before = read(); await openAndMeasure();
    expect(read()).toEqual(before); expect(button("Apply cabinet layout").disabled).toBe(true);
    await click("Cancel import"); expect(read()).toEqual(before); expect(localStorage.getItem(COUNTERTOP_TRANSFER_BACKUP_KEY)).toBeNull();
  });
  it("applies once, preserves cabinets and private selections, and undoes/redoes the entire import", async () => {
    const before = read(); await openAndMeasure(); await approve(); await click("Apply cabinet layout");
    const after = read(); expect(after.cabinets).toEqual(before.cabinets);
    expect(after.countertops).toMatchObject({ wallAIn: 144, layout: "l-shape", islandLengthIn: 66, islandWidthIn: 48, sinkRun: "", measurementsReviewed: false, notes: before.countertops.notes });
    expect(after.countertops.texturePhotoKey).toBe(before.countertops.texturePhotoKey);
    expect(after.building).toEqual(before.building); expect(after.countyFips).toBe(before.countyFips);
    await click("Undo"); expect(read()).toEqual(before);
    await click("Redo"); expect(read()).toEqual(after);
  });
  it("restores the original countertop after a full parent remount without touching the cabinets", async () => {
    const before = read(); await openAndMeasure(); await approve(); await click("Apply cabinet layout");
    await act(async () => root.unmount()); root = createRoot(host); await mount();
    await click("Use cabinet layout"); await click("Preview previous countertop");
    expect(button("Restore previous countertop design").disabled).toBe(true);
    await approve(); await click("Restore previous countertop design"); expect(read()).toEqual(before);
  });
  it("invalidates replacement approval when measurements change", async () => {
    await openAndMeasure(); await approve(); expect(button("Apply cabinet layout").disabled).toBe(false);
    await set("Wall-run front overhang (in)", "2");
    expect(button("Apply cabinet layout").disabled).toBe(true);
  });
  it("blocks lossy measurements even when replacement is approved", async () => {
    const before = read(); await openAndMeasure(); await set("Wall-run front overhang (in)", "1.125"); await approve();
    expect(button("Apply cabinet layout").disabled).toBe(true);
    expect(host.textContent).toContain("rounded or clamped"); expect(read()).toEqual(before);
  });
  it("keeps the active draft untouched when the restore backup cannot be written", async () => {
    const before = read(); await openAndMeasure(); await approve();
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key: string, value: string) { if (key === COUNTERTOP_TRANSFER_BACKUP_KEY) throw Error("Quota exceeded"); return write.call(this, key, value); });
    await click("Apply cabinet layout");
    expect(read()).toEqual(before); expect(host.textContent).toContain("Import not applied");
  });
  it("blocks a stale preview after another tab replaces the project", async () => {
    const before = read(); await openAndMeasure(); await approve();
    await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, newValue: "{}" })));
    expect(button("Apply cabinet layout").disabled).toBe(true); expect(read()).toEqual(before);
    expect(host.textContent).toContain("changed in another tab");
  });
});
