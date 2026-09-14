import { describe, expect, it } from "vitest";
import {
  createBlankCabinetPlannerExtension, createCabinetPlannerModule, reconcileCabinetPlannerExtension,
  getCabinetModuleBounds, getCabinetPlannerDiagnostics, isCabinetAccessory, isCountedCabinet,
  duplicateCabinetModule, buildCabinetPlannerRequestBrief, type CabinetPlannerExtensionV1,
} from "./cabinetPlannerModel";
import { CABINET_ACCESSORY_PRESETS, CABINET_LIBRARY_PRESETS, cabinetLibrarySelection, proposeLibraryCabinet, findCabinetLibraryWallGap, cabinetSchedule, cabinetScheduleCsv } from "./cabinetLibrary";
import { buildCabinetCaseworkParts } from "./cabinetCasework";
import { proposeCabinetMove } from "./cabinetPlacement";
import { proposeAccessorySetback } from "./CabinetAccessorySettings";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import { proposeCabinetCountertopTransfer, EMPTY_TRANSFER_OPTIONS } from "./cabinetCountertopTransfer";

function room(modules: CabinetPlannerExtensionV1["modules"] = []): CabinetPlannerExtensionV1 {
  return reconcileCabinetPlannerExtension({ ...createBlankCabinetPlannerExtension(), starter: "kitchen",
    shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
    modules, notes: "PRIVATE accessory notes",
    presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: {} },
  });
}
const base = (id: string, offsetIn: number) => ({ ...createCabinetPlannerModule("base-cabinet", id), offsetIn });
const filler = (id = "f", offsetIn = 30) => ({ ...createCabinetPlannerModule("filler", id), offsetIn });
const panel = (id = "p", offsetIn = 63) => ({ ...createCabinetPlannerModule("end-panel", id), offsetIn });
const options = { ...EMPTY_TRANSFER_OPTIONS, frontOverhangIn: 1.5, thicknessIn: 1.25 };

 describe("Measured cabinet accessories", () => {
  it("preserves the nine cabinet choices and adds two separate accessory choices", () => {
    expect(CABINET_LIBRARY_PRESETS).toHaveLength(9);
    expect(CABINET_ACCESSORY_PRESETS.map(item => item.kind)).toEqual(["filler", "end-panel"]);
    expect(CABINET_ACCESSORY_PRESETS.every(item => item.front === null)).toBe(true);
  });
  it.each(CABINET_ACCESSORY_PRESETS)("round-trips $id through actual saved project reconciliation", preset => {
    const p = proposeLibraryCabinet(room(), cabinetLibrarySelection(preset.id)!, "a");
    expect(p.problems).toEqual([]);
    const original = createEmptySteelHomeProjectDraft(); original.cabinets.planner = p.planner!;
    const saved = reconcileSteelHomeProjectDraft(JSON.parse(JSON.stringify(original)));
    expect(saved.cabinets.planner.modules[0]).toEqual(p.module);
    expect(saved.cabinets.planner.modules[0].kind).toBe(preset.kind);
    expect(saved.cabinets.planner.presentation?.fronts.a).toBeUndefined();
    expect(saved.cabinets.planner.presentation?.finish).toBe("sage");
  });
  it("does not add accessory fields to ordinary legacy modules", () => {
    const legacy = room([base("a", 0)]);
    expect(reconcileCabinetPlannerExtension(JSON.parse(JSON.stringify(legacy)))).toEqual(legacy);
    expect(legacy.modules[0]).not.toHaveProperty("wallInsetIn");
    const normalized = reconcileCabinetPlannerExtension({ ...legacy, modules: [{ ...legacy.modules[0], wallInsetIn: 200 }] });
    expect(normalized).toEqual(legacy);
  });
  it.each([
    ["north", { x1: 30, x2: 33, z1: 23.25, z2: 24 }],
    ["east", { x1: 156, x2: 156.75, z1: 30, z2: 33 }],
    ["south", { x1: 147, x2: 150, z1: 132, z2: 132.75 }],
    ["west", { x1: 23.25, x2: 24, z1: 123, z2: 126 }],
  ] as const)("uses actual panel thickness and explicit setback on %s", (surface, expected) => {
    const module = { ...filler(), surface };
    expect(getCabinetModuleBounds(room(), module)).toEqual({ ...expected, y1: 4, y2: 34.5 });
  });
  it("uses explicit floor X/Y instead of a hidden wall setback", () => {
    const module = { ...panel(), surface: "floor" as const, offsetIn: 90, roomDepthOffsetIn: 60, wallInsetIn: 100 };
    expect(getCabinetModuleBounds(room(), module)).toEqual({ x1: 90, x2: 90.75, z1: 60, z2: 84, y1: 0, y2: 34.5 });
  });
  it.each([null, -1, 0.1, 721, Infinity, NaN])("rejects invalid accessory setback %s without saving", wallInsetIn => {
    const p = room(); const before = structuredClone(p);
    expect(proposeLibraryCabinet(p, { ...cabinetLibrarySelection("filler")!, wallInsetIn }, "f").problems.length).toBeGreaterThan(0);
    expect(p).toEqual(before);
  });
  it("places a thin front filler in a real three-inch gap, without filling its depth", () => {
    const source = room([base("a", 0), base("b", 33)]);
    const selection = { ...cabinetLibrarySelection("filler")!, offsetIn: 30 };
    const proposal = proposeLibraryCabinet(source, selection, "f");
    expect(proposal.problems).toEqual([]);
    expect(proposal.module?.depthIn).toBe(.75);
    expect(findCabinetLibraryWallGap(source, selection, "f")).toBe(30);
    expect(source.modules).toHaveLength(2);
  });
  it("rejects accessories inside a cabinet or outside the measured room", () => {
    expect(proposeLibraryCabinet(room([base("a", 0)]), { ...cabinetLibrarySelection("filler")!, offsetIn: 10 }, "f").problems.join(" ")).toContain("collides");
    expect(proposeLibraryCabinet(room(), { ...cabinetLibrarySelection("filler")!, wallInsetIn: 156 }, "f").problems.join(" ")).toContain("outside");
  });
  it("does not apply a filler's setback to a recorded obstacle during fit checks", () => {
    const source = room();
    source.shellItems = [{ id: "o", kind: "obstacle", label: "Wall obstruction", wall: "west", offsetIn: 130, widthIn: 3, heightIn: 40, elevationIn: 0, depthIn: 3 }];
    const proposal = proposeLibraryCabinet(source, cabinetLibrarySelection("filler")!, "f");
    expect(proposal.problems.join(" ")).toContain("Wall obstruction");
  });
  it.each(CABINET_ACCESSORY_PRESETS)("renders $id as one measured panel with no cabinet fronts or hardware", preset => {
    const m = createCabinetPlannerModule(preset.kind, "a");
    const parts = buildCabinetCaseworkParts(m, { style: "Raised panel", finish: "sage", hardware: "Brushed brass", fronts: { a: "drawers" } });
    expect(parts).toEqual([{ role: "panel", centerIn: [0, m.heightIn / 2, 0], sizeIn: [m.widthIn, m.heightIn, m.depthIn] }]);
  });
  it("drops stale door front assignments from accessories", () => {
    const p = room([filler()]);
    const normalized = reconcileCabinetPlannerExtension({ ...p, presentation: { ...p.presentation, fronts: { f: "drawers" } } });
    expect(normalized.presentation?.fronts).toEqual({});
  });
  it("retains accessory type and setback through duplication and measured movement", () => {
    const p = room([filler("f", 70)]);
    const duplicate = duplicateCabinetModule(p, "f", "copy");
    expect(duplicate.modules[1]).toMatchObject({ kind: "filler", wallInsetIn: 23.25, offsetIn: 73 });
    const move = proposeCabinetMove(duplicate, "copy", 2, 0, 0)!;
    expect(move.problems).toEqual([]);
    expect(move.module).toMatchObject({ kind: "filler", wallInsetIn: 23.25, offsetIn: 75, depthIn: .75 });
    expect(move.planner.shell.measurementsReviewed).toBe(false);
  });
  it("edits setback without changing labels, order, counts or the source plan", () => {
    const p = room([{ ...base("a", 0), depthIn: 20 }, { ...filler("f", 0), label: "Client filler" }]);
    const original = structuredClone(p);
    const result = proposeAccessorySetback(p, "f", 21);
    expect(result.problems).toEqual([]);
    expect(result.next?.modules.map(m => m.id)).toEqual(["a", "f"]);
    expect(result.next?.modules[1]).toMatchObject({ wallInsetIn: 21, label: "Client filler" });
    expect(result.next?.shell.measurementsReviewed).toBe(false);
    expect(p).toEqual(original);
    expect(proposeAccessorySetback(p, "f", 10).problems.join(" ")).toContain("collides");
    expect(proposeAccessorySetback(p, "f", 21.1).next).toBeNull();
  });
  it("separates counted cabinets, accessories and appliance spaces and exports exact panel sizes", () => {
    const p = room([base("a", 0), filler(), panel(), { ...panel("p2", 63.75) }, { ...createCabinetPlannerModule("appliance", "x"), offsetIn: 100 }]);
    expect(p.modules.filter(isCountedCabinet)).toHaveLength(1);
    expect(p.modules.filter(isCabinetAccessory)).toHaveLength(3);
    const rows = cabinetSchedule(p);
    expect(rows.find(row => row.kind === "end-panel")).toMatchObject({ quantity: 2, widthIn: .75, depthIn: 24, front: "Accessory panel, not a cabinet" });
    expect(rows.find(row => row.kind === "filler")?.placements[0]).toContain("wall setback 23.25");
    const csv = cabinetScheduleCsv(p);
    expect(csv).toContain('"2","Finished end panel","end-panel","0.75","24","34.5"');
    expect(csv).not.toContain("PRIVATE");
    expect(buildCabinetPlannerRequestBrief(p)).toContain("filler accessory, not a cabinet or assumed countertop support");
  });
});

describe("Countertop support stays independent of accessory trim", () => {
  it("excludes both panel types without extending the countertop footprint", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets.planner = room([base("a", 0), base("b", 30), filler("f", 60), panel("p", 63)]);
    const before = structuredClone(draft);
    const result = proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, options);
    expect(result.next).not.toBeNull();
    expect(result.next).toMatchObject({ wallAIn: 60, wallDepthIn: 25.5 });
    expect(result.supports.map(m => m.id)).toEqual(["a", "b"]);
    expect(result.excluded.map(m => m.id)).toEqual(["f", "p"]);
    expect(draft).toEqual(before);
  });
  it("does not turn a face filler into structural support across a cabinet gap", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets.planner = room([base("a", 0), base("b", 33), filler("f", 30)]);
    const result = proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, options);
    expect(result.next).toBeNull();
    expect(result.problems.join(" ")).toContain("gap");
    expect(result.supports.map(m => m.id)).not.toContain("f");
  });
  it("rejects a panel that intersects the finished countertop layer", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.cabinets.planner = room([base("a", 0), base("b", 30), { ...filler("f", 30), wallInsetIn: 24, elevationIn: 0, heightIn: 40 }]);
    expect(getCabinetPlannerDiagnostics(draft.cabinets.planner).filter(p => p.code !== "unreviewed-measurements")).toEqual([]);
    const result = proposeCabinetCountertopTransfer(draft.cabinets, draft.countertops, options);
    expect(result.next).toBeNull();
    expect(result.problems.join(" ")).toContain("intersects Filler strip");
  });
});
