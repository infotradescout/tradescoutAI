import { describe, expect, it } from "vitest";
import { CABINET_PLAN_FRAME, cabinetOnPlanLayer, cabinetPlanProjection, frameCabinetInPlan, zoomCabinetPlan } from "./cabinetPlanCamera";
import { createBlankCabinetPlannerExtension, createCabinetPlannerModule, reconcileCabinetPlannerExtension } from "./cabinetPlannerModel";

const fixture = () => reconcileCabinetPlannerExtension({
  ...createBlankCabinetPlannerExtension(), starter: "kitchen", shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
  modules: [{ ...createCabinetPlannerModule("base-cabinet", "base"), offsetIn: 30 }],
});
describe("Cabinet plan camera does not alter measured geometry", () => {
  it("retains the exact projection used by drag measurements", () => {
    const planner = fixture(), projection = cabinetPlanProjection(planner);
    expect(projection.scale).toBe(Math.min(620 / 180, 360 / 156));
    expect(projection.originX + planner.shell.widthIn! * projection.scale / 2).toBe(380);
    expect(projection.originY + planner.shell.depthIn! * projection.scale / 2).toBe(250);
  });
  it("limits zoom to 100–600 percent, preserves aspect ratio and stays inside the room frame", () => {
    for (const factor of [0.001, .5, 1, 1.35, 6, 1000000]) {
      const next = zoomCabinetPlan({ ...CABINET_PLAN_FRAME }, factor);
      expect(next.width).toBeGreaterThanOrEqual(760 / 6);
      expect(next.width).toBeLessThanOrEqual(760);
      expect(next.width / next.height).toBeCloseTo(760 / 500);
      expect(next.x).toBeGreaterThanOrEqual(0); expect(next.y).toBeGreaterThanOrEqual(0);
      expect(next.x + next.width).toBeLessThanOrEqual(760);
      expect(next.y + next.height).toBeLessThanOrEqual(500);
    }
  });
  it.each([NaN, Infinity, 0, -1])("ignores invalid zoom factor %s", factor => {
    expect(zoomCabinetPlan({ ...CABINET_PLAN_FRAME }, factor)).toEqual(CABINET_PLAN_FRAME);
  });
  it.each(["north", "east", "south", "west", "floor"] as const)("frames a selected module on %s without changing saved fields", surface => {
    const planner = fixture(); planner.modules[0].surface = surface;
    const before = JSON.stringify(planner), frame = frameCabinetInPlan(planner, "base")!;
    expect(frame.width).toBeLessThan(760); expect(frame.width).toBeGreaterThanOrEqual(760 / 6);
    expect(frame.x).toBeGreaterThanOrEqual(0); expect(frame.y).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(760); expect(frame.y + frame.height).toBeLessThanOrEqual(500);
    expect(JSON.stringify(planner)).toBe(before);
  });
  it("does not invent geometry for absent selections or incomplete rooms", () => {
    expect(frameCabinetInPlan(fixture(), "missing")).toBeNull();
    const planner = fixture(); planner.shell.widthIn = null;
    expect(frameCabinetInPlan(planner, "base")).toBeNull();
  });
});
describe("Cabinet plan layers", () => {
  it.each(["base-cabinet", "tall-cabinet", "island", "appliance"] as const)("keeps %s in the lower layout", kind => {
    const module = createCabinetPlannerModule(kind, "a");
    expect(cabinetOnPlanLayer(module, "lower")).toBe(true);
    expect(cabinetOnPlanLayer(module, "upper")).toBe(false);
    expect(cabinetOnPlanLayer(module, "all")).toBe(true);
  });
  it("separates wall cabinets and accessory panels instead of covering the base selection", () => {
    const upper = createCabinetPlannerModule("wall-cabinet", "upper");
    const panel = { ...createCabinetPlannerModule("base-cabinet", "panel"), kind: "end-panel" as const };
    expect(cabinetOnPlanLayer(upper, "upper")).toBe(true); expect(cabinetOnPlanLayer(upper, "lower")).toBe(false);
    expect(cabinetOnPlanLayer(panel, "panels")).toBe(true); expect(cabinetOnPlanLayer(panel, "lower")).toBe(false);
  });
});
