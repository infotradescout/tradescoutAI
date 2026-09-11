import { describe, expect, it } from "vitest";
import {
  createBlankCabinetPlannerExtension, createCabinetPlannerModule,
  reconcileCabinetPlannerExtension, type CabinetPlannerExtensionV1,
} from "./cabinetPlannerModel";
import { createEmptySteelHomeProjectDraft, reconcileSteelHomeProjectDraft } from "./projectModel";
import { buildCabinetCaseworkParts } from "./cabinetCasework";
import {
  CABINET_LIBRARY_PRESETS, cabinetLibrarySelection, proposeLibraryCabinet,
  findCabinetLibraryWallGap, cabinetSchedule, cabinetScheduleCsv,
} from "./cabinetLibrary";

const room = (): CabinetPlannerExtensionV1 => ({
  ...createBlankCabinetPlannerExtension(), starter: "kitchen",
  shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
  notes: "PRIVATE planning notes", presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: {} },
});
const choose = (id = "sink-base") => cabinetLibrarySelection(id)!;

describe("Explicit cabinet configurations", () => {
  it.each(CABINET_LIBRARY_PRESETS.map(preset => [preset.id]))("builds and saves %s without changing the source", id => {
    const source = room(); const before = structuredClone(source);
    const selection = { ...choose(id), roomDepthOffsetIn: 60, offsetIn: 60 };
    const result = proposeLibraryCabinet(source, selection, "new-cabinet");
    expect(result.problems).toEqual([]);
    expect(source).toEqual(before);
    const preset = CABINET_LIBRARY_PRESETS.find(item => item.id === id)!;
    expect(result.module).toMatchObject({ kind: preset.kind, widthIn: preset.widthIn, depthIn: preset.depthIn, heightIn: preset.heightIn });
    expect(result.planner!.presentation).toMatchObject({ style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: { "new-cabinet": preset.front } });
    expect(result.planner!.shell.measurementsReviewed).toBe(false);
    const project = createEmptySteelHomeProjectDraft();
    const saved = reconcileSteelHomeProjectDraft({ ...project, cabinets: { ...project.cabinets, planner: result.planner } });
    expect(saved.cabinets.planner).toEqual(result.planner);
    expect(saved.countertops).toEqual(reconcileSteelHomeProjectDraft(project).countertops);
  });
  it("does not invent style, finish or hardware for an unstyled draft", () => {
    const source = room(); delete source.presentation;
    const result = proposeLibraryCabinet(source, choose(), "sink");
    expect(result.planner!.presentation).toEqual({ style: null, finish: null, hardware: null, fronts: { sink: "sink" } });
  });
  it("requires explicit floor depth placement for an island", () => {
    const selection = choose("island-drawers"); expect(selection.roomDepthOffsetIn).toBeNull();
    expect(proposeLibraryCabinet(room(), selection, "island").planner).toBeNull();
  });
  it("keeps exact eighth-inch dimensions, rejecting rather than rounding off-grid inputs", () => {
    const selection = { ...choose(), widthIn: 36.125 };
    expect(proposeLibraryCabinet(room(), selection, "sink").module?.widthIn).toBe(36.125);
    expect(proposeLibraryCabinet(room(), { ...selection, widthIn: 36.1 }, "sink").planner).toBeNull();
  });
  it.each([null, NaN, Infinity, -1, 1000])("rejects invalid width %s", widthIn => {
    expect(proposeLibraryCabinet(room(), { ...choose(), widthIn }, "sink").planner).toBeNull();
  });
  it("requires complete room dimensions and a deliberate planner start", () => {
    expect(proposeLibraryCabinet({ ...room(), shell: { ...room().shell, heightIn: null } }, choose(), "sink").planner).toBeNull();
    expect(proposeLibraryCabinet({ ...room(), starter: null }, choose(), "sink").planner).toBeNull();
  });
  it("rejects unknown presets and colliding identities", () => {
    expect(cabinetLibrarySelection("unknown")).toBeNull();
    const source = room(); source.modules = [createCabinetPlannerModule("base-cabinet", "exists")];
    expect(proposeLibraryCabinet(source, choose(), "exists").planner).toBeNull();
    expect(proposeLibraryCabinet(room(), { ...choose(), presetId: "unknown" }, "new").planner).toBeNull();
  });
  it("retains the existing module limit", () => {
    const source = room(); source.modules = Array.from({ length: 120 }, (_, index) => createCabinetPlannerModule("base-cabinet", `m-${index}`));
    expect(proposeLibraryCabinet(source, choose(), "new").problems.join(" ")).toContain("120 modules");
  });
});

describe("Measured library placement", () => {
  it("does not clamp a proposed cabinet into the room", () => {
    const result = proposeLibraryCabinet(room(), { ...choose(), offsetIn: 170 }, "sink");
    expect(result.module!.offsetIn).toBe(170);
    expect(result.problems.join(" ")).toContain("outside");
  });
  it("rejects collisions while permitting wall cabinets above base cabinets", () => {
    const source = room(); source.modules = [createCabinetPlannerModule("base-cabinet", "base")];
    expect(proposeLibraryCabinet(source, choose(), "sink").problems.join(" ")).toContain("collides");
    expect(proposeLibraryCabinet(source, choose("wall-doors"), "upper").problems).toEqual([]);
  });
  it.each(["north", "east", "south", "west"] as const)("finds an adjacent gap on the %s wall without writing", surface => {
    const source = room(); source.modules = [{ ...createCabinetPlannerModule("base-cabinet", "base"), surface }];
    const before = structuredClone(source);
    expect(findCabinetLibraryWallGap(source, { ...choose(), surface }, "sink")).toBe(30);
    expect(source).toEqual(before);
  });
  it("checks door and corner obstacle envelopes", () => {
    const source = room(); source.shellItems = [{ id: "door", label: "Door", kind: "door", wall: "north", offsetIn: 0, widthIn: 36, heightIn: 80, elevationIn: 0, depthIn: 4 }];
    expect(proposeLibraryCabinet(source, choose(), "sink").problems.length).toBeGreaterThan(0);
    expect(findCabinetLibraryWallGap(source, choose(), "sink")).toBe(36);
    expect(proposeLibraryCabinet(source, { ...choose(), surface: "west" }, "sink").problems).toEqual([]);
    expect(proposeLibraryCabinet(source, { ...choose(), surface: "west", offsetIn: 120 }, "sink").problems.join(" ")).toContain("Door");
    expect(proposeLibraryCabinet(source, { ...choose("island-drawers"), roomDepthOffsetIn: 0 }, "island").problems.join(" ")).toContain("Door");
  });
  it("reports no fitting wall gap rather than moving existing modules", () => {
    const source = room(); source.modules = [{ ...createCabinetPlannerModule("base-cabinet", "full"), widthIn: 180 }];
    expect(findCabinetLibraryWallGap(source, choose(), "sink")).toBeNull();
    expect(source.modules[0].widthIn).toBe(180);
  });
  it("shares actual front definitions with 3D", () => {
    const result = proposeLibraryCabinet(room(), choose("drawer-bank"), "drawers");
    const parts = buildCabinetCaseworkParts(result.module!, result.planner!.presentation);
    expect(parts.filter(part => part.role === "drawer")).toHaveLength(3);
    expect(parts.some(part => part.role === "rail")).toBe(true);
    expect(parts.some(part => part.role === "handle")).toBe(true);
  });
});

describe("Cabinet schedule is a counted measured output", () => {
  it("groups identical configurations while preserving every placement and identity", () => {
    let state = proposeLibraryCabinet(room(), choose(), "sink-a").planner!;
    state = proposeLibraryCabinet(state, { ...choose(), offsetIn: 36 }, "sink-b").planner!;
    state.modules.push(createCabinetPlannerModule("appliance", "appliance"));
    const rows = cabinetSchedule(state);
    expect(rows).toHaveLength(2); expect(rows[0].quantity).toBe(2);
    expect(rows[0].ids).toEqual(["sink-a", "sink-b"]);
    expect(rows[0].placements[1]).toContain("offset 36");
    expect(rows[1].front).toContain("not a cabinet");
  });
  it("keeps different front arrangements and changed dimensions in different rows", () => {
    const state = room();
    state.modules = ["a", "b", "c"].map(id => ({ ...createCabinetPlannerModule("base-cabinet", id), label: "Base" }));
    state.presentation!.fronts = { a: "doors", b: "drawers", c: "doors" };
    state.modules[2].widthIn = 30.125;
    expect(cabinetSchedule(state)).toHaveLength(3);
  });
  it("does not infer front choices for legacy drafts", () => {
    const state = room(); state.modules = [createCabinetPlannerModule("base-cabinet", "a")];
    expect(cabinetSchedule(state)[0].front).toBe("Not selected");
  });
  it("exports dimensions and unresolved status without private notes", () => {
    const state = proposeLibraryCabinet(room(), choose(), "sink").planner!;
    const csv = cabinetScheduleCsv(state);
    expect(csv).toContain('"36","24","34.5","sink"');
    expect(csv).toContain("Unresolved planning checks");
    expect(csv).toContain("Sage"); expect(csv).not.toContain("PRIVATE");
  });
  it("escapes labels and prevents spreadsheet formula execution", () => {
    const state = room(); state.modules = [
      { ...createCabinetPlannerModule("base-cabinet", "=malicious-id"), label: '=HYPERLINK("x")' },
      { ...createCabinetPlannerModule("base-cabinet", "second"), label: 'Quoted "cabinet", with comma' },
    ];
    const csv = cabinetScheduleCsv(state);
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"\'=malicious-id"');
    expect(csv).toContain('"Quoted ""cabinet"", with comma"');
  });
  it("does not mutate drafts or assign hidden products during schedule creation", () => {
    const state = reconcileCabinetPlannerExtension(room()); const before = structuredClone(state);
    expect(cabinetSchedule(state)).toEqual([]); cabinetScheduleCsv(state);
    expect(state).toEqual(before);
  });
});
