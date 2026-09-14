import { describe, expect, it } from "vitest";
import { createBlankCabinetPlannerExtension, createCabinetPlannerModule, createCabinetShellItem, reconcileCabinetPlannerExtension, type CabinetPlannerModule } from "./cabinetPlannerModel";
import { proposeCabinetMove, cabinetMovePosition } from "./cabinetPlacement";

const module = (id: string, patch: Partial<CabinetPlannerModule> = {}): CabinetPlannerModule => ({ ...createCabinetPlannerModule("base-cabinet", id), offsetIn: 40, ...patch });
const plan = (...modules: CabinetPlannerModule[]) => reconcileCabinetPlannerExtension({
  ...createBlankCabinetPlannerExtension(), starter: "kitchen",
  shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true }, modules,
  notes: "Keep these field notes", presentation: { style: "Shaker", finish: "sage", hardware: "Brushed brass", fronts: Object.fromEntries(modules.map(item => [item.id, "drawers"])) },
});

describe("Direct cabinet movement", () => {
  it.each([['north', 10, 0, 50], ['south', 10, 0, 30], ['east', 0, 10, 50], ['west', 0, 10, 30]] as const)("maps screen-right/down to the %s wall's canonical offset", (surface, dx, dz, offset) => {
    const result = proposeCabinetMove(plan(module('a', { surface })), 'a', dx, dz, 0)!;
    expect(result.module.offsetIn).toBe(offset); expect(result.module.surface).toBe(surface); expect(result.problems).toEqual([]);
  });
  it("constrains attached cabinets to their selected wall", () => {
    const state = plan(module('a'));
    const result = proposeCabinetMove(state, 'a', 0, 100, 0)!;
    expect(result.changed).toBe(false); expect(result.planner).toBe(state);
  });
  it("moves floor modules on both room axes and retains their dimensions", () => {
    const state = plan(module('a', { kind: 'island', surface: 'floor', roomDepthOffsetIn: 60 }));
    const result = proposeCabinetMove(state, 'a', 12.0626, -10, 0)!;
    expect(result.module).toMatchObject({ offsetIn: 52.125, roomDepthOffsetIn: 50, widthIn: 30, depthIn: 24, heightIn: 34.5, elevationIn: 0 });
  });
  it.each(['north', 'east', 'south', 'west'] as const)("snaps to adjacent cabinet ends on %s", surface => {
    const state = plan(module('a', { surface, offsetIn: 0 }), module('b', { surface, offsetIn: 60 }));
    const reversed = surface === 'south' || surface === 'west';
    const horizontal = surface === 'north' || surface === 'south';
    const delta = 29.5 * (reversed ? -1 : 1);
    const result = proposeCabinetMove(state, 'a', horizontal ? delta : 0, horizontal ? 0 : delta)!;
    expect(result.module.offsetIn).toBe(30); expect(result.guides).toHaveLength(1); expect(result.problems).toEqual([]);
  });
  it("disables magnetic snapping without disabling the eighth-inch grid", () => {
    const state = plan(module('a', { offsetIn: 0 }), module('b', { offsetIn: 60 }));
    expect(proposeCabinetMove(state, 'a', 29.49, 0, 0)!.module.offsetIn).toBe(29.5);
  });
  it("does not attract a base cabinet to an upper cabinet at another elevation", () => {
    const state = plan(module('a', { offsetIn: 0 }), module('b', { offsetIn: 60, kind: 'wall-cabinet', elevationIn: 54, heightIn: 30 }));
    expect(proposeCabinetMove(state, 'a', 29.5, 0)!.module.offsetIn).toBe(29.5);
  });
  it("clamps attached and floor modules inside the measured room", () => {
    const state = plan(module('a'));
    expect(proposeCabinetMove(state, 'a', -10000, 0)!.module.offsetIn).toBe(0);
    expect(proposeCabinetMove(state, 'a', 10000, 0)!.module.offsetIn).toBe(150);
    const floor = plan(module('a', { surface: 'floor', roomDepthOffsetIn: 60 }));
    expect(proposeCabinetMove(floor, 'a', 10000, 10000)!.module).toMatchObject({ offsetIn: 150, roomDepthOffsetIn: 132 });
  });
  it("snaps islands to room boundaries without reattaching or rotating them", () => {
    const state = plan(module('a', { surface: 'floor', kind: 'island', roomDepthOffsetIn: 60 }));
    const result = proposeCabinetMove(state, 'a', -39.5, 71.5)!;
    expect(result.module).toMatchObject({ surface: 'floor', offsetIn: 0, roomDepthOffsetIn: 132 });
    expect(result.guides).toHaveLength(2);
  });
  it("snaps a floor module to a nearby cabinet edge, not a distant row", () => {
    const state = plan(module('a', { surface: 'floor', roomDepthOffsetIn: 60, offsetIn: 0 }), module('b', { surface: 'floor', roomDepthOffsetIn: 60, offsetIn: 60 }));
    expect(proposeCabinetMove(state, 'a', 29.5, 0)!.module.offsetIn).toBe(30);
    const far = plan(module('a', { surface: 'floor', roomDepthOffsetIn: 60, offsetIn: 0 }), module('b', { offsetIn: 60 }));
    expect(proposeCabinetMove(far, 'a', 29.5, 0)!.module.offsetIn).toBe(29.5);
  });
  it("reports a collision during movement instead of treating overlap as a valid drop", () => {
    const state = plan(module('a', { offsetIn: 0 }), module('b', { offsetIn: 60 }));
    expect(proposeCabinetMove(state, 'a', 45, 0, 0)!.problems.join(' ')).toContain('collides');
    expect(state.modules[0].offsetIn).toBe(0);
  });
  it("lets a module escape an existing overlap", () => {
    const state = plan(module('a', { offsetIn: 0 }), module('b', { offsetIn: 0 }));
    expect(proposeCabinetMove(state, 'a', 30, 0, 0)!.problems).toEqual([]);
  });
  it("does not block repairing one module because unrelated modules collide", () => {
    const state = plan(module('a', { offsetIn: 0 }), module('b', { offsetIn: 120 }), module('c', { offsetIn: 120 }));
    expect(proposeCabinetMove(state, 'a', 30, 0, 0)!.problems).toEqual([]);
  });
  it.each(['door', 'window', 'obstacle'] as const)("rejects moving a wall cabinet into a recorded %s", kind => {
    const state = plan(module('a', { offsetIn: 0 }));
    state.shellItems = [{ ...createCabinetShellItem(kind, 'feature'), offsetIn: 60, elevationIn: 0 }];
    expect(proposeCabinetMove(state, 'a', 60, 0, 0)!.problems.join(' ')).toContain('blocks');
  });
  it("rejects a floor module entering an obstacle's recorded depth envelope", () => {
    const state = plan(module('a', { surface: 'floor', roomDepthOffsetIn: 60, offsetIn: 60 }));
    state.shellItems = [{ ...createCabinetShellItem('obstacle', 'feature'), offsetIn: 60, widthIn: 30, depthIn: 24 }];
    expect(proposeCabinetMove(state, 'a', 0, -40, 0)!.problems.join(' ')).toContain('envelope');
  });
  it("preserves identity, measurements, notes and appearance and invalidates review only on an actual move", () => {
    const state = plan(module('a'));
    const snapshot = structuredClone(state);
    const moved = proposeCabinetMove(state, 'a', .125, 0, 0)!;
    expect(state).toEqual(snapshot);
    expect(moved.planner.presentation).toEqual(state.presentation);
    expect(moved.planner.notes).toBe(state.notes);
    expect(moved.planner.shell).toEqual({ ...state.shell, measurementsReviewed: false });
    expect(moved.planner.selectedModuleId).toBe('a');
    expect(proposeCabinetMove(state, 'a', 0, 0, 0)!.planner.shell.measurementsReviewed).toBe(true);
  });
  it("fails closed for incomplete measurements, nonfinite input and ambiguous identities", () => {
    const state = plan(module('a'));
    expect(proposeCabinetMove(state, 'missing', 1, 0)).toBeNull();
    expect(proposeCabinetMove(state, 'a', NaN, 0)).toBeNull();
    expect(proposeCabinetMove(state, 'a', 0, Infinity)).toBeNull();
    expect(proposeCabinetMove({ ...state, modules: [module('a'), module('a')] }, 'a', 1, 0)).toBeNull();
    expect(proposeCabinetMove({ ...state, shell: { ...state.shell, heightIn: null } }, 'a', 1, 0)).toBeNull();
  });
  it("describes measured positions without turning room axes into screen pixels", () => {
    expect(cabinetMovePosition(module('a'))).toContain('40 in from north');
    expect(cabinetMovePosition(module('a', { surface: 'floor', roomDepthOffsetIn: 60 }))).toContain('Y 60 in from north');
  });
});
