import { describe, expect, it } from "vitest";
import {
  applyCabinetPlannerStart,
  buildCabinetPlannerRequestBrief,
  cabinetPlannerExtensionFromLegacy,
  createBlankCabinetPlannerExtension,
  createCabinetPlannerModule,
  createCabinetShellItem,
  getCabinetModuleBounds,
  getCabinetPlannerDiagnostics,
  isCabinetPlannerRequestReady,
  reconcileCabinetPlannerExtension,
  snapCabinetInches,
} from "./cabinetPlannerModel";
import { createEmptySteelHomeProjectDraft } from "./projectModel";

function measuredPlanner() {
  return {
    ...applyCabinetPlannerStart(createBlankCabinetPlannerExtension(), "kitchen"),
    shell: {
      widthIn: 120,
      depthIn: 108,
      heightIn: 96,
      measurementsReviewed: true,
    },
  };
}

describe("cabinetPlannerModel", () => {
  it("begins with no use, geometry, modules, objects, appearance, or price", () => {
    const planner = createBlankCabinetPlannerExtension();

    expect(planner.starter).toBeNull();
    expect(planner.shell).toEqual({
      widthIn: null,
      depthIn: null,
      heightIn: null,
      measurementsReviewed: false,
    });
    expect(planner.modules).toEqual([]);
    expect(planner.shellItems).toEqual([]);
    expect(planner).not.toHaveProperty("finish");
    expect(planner).not.toHaveProperty("hardware");
    expect(JSON.stringify(planner)).not.toMatch(/price|estimate|\$/i);
  });

  it("keeps every starter empty and snaps canonical values to an eighth inch", () => {
    const started = applyCabinetPlannerStart(createBlankCabinetPlannerExtension(), "pantry");

    expect(started.starter).toBe("pantry");
    expect(started.shell.widthIn).toBeNull();
    expect(started.modules).toEqual([]);
    expect(snapCabinetInches(31.19)).toBe(31.25);

    const reconciled = reconcileCabinetPlannerExtension({
      ...started,
      shell: { widthIn: 121.19, depthIn: 97.06, heightIn: 95.94 },
    });
    expect(reconciled.shell).toMatchObject({ widthIn: 121.25, depthIn: 97, heightIn: 96 });
  });

  it("uses one canonical placement for wall, floor-plan, elevation, and 3D consumers", () => {
    const planner = measuredPlanner();
    const north = { ...createCabinetPlannerModule("base-cabinet", "north"), offsetIn: 12 };
    const east = {
      ...createCabinetPlannerModule("tall-cabinet", "east"),
      surface: "east" as const,
      offsetIn: 18,
    };
    const island = {
      ...createCabinetPlannerModule("island", "island"),
      offsetIn: 42,
      roomDepthOffsetIn: 48,
    };

    expect(getCabinetModuleBounds(planner, north)).toEqual({
      x1: 12,
      x2: 42,
      z1: 0,
      z2: 24,
      y1: 0,
      y2: 34.5,
    });
    expect(getCabinetModuleBounds(planner, east)).toEqual({
      x1: 96,
      x2: 120,
      z1: 18,
      z2: 42,
      y1: 0,
      y2: 84,
    });
    expect(getCabinetModuleBounds(planner, island)).toEqual({
      x1: 42,
      x2: 78,
      z1: 48,
      z2: 72,
      y1: 0,
      y2: 34.5,
    });
  });

  it("fails closed for missing review, outside geometry, collisions, and blocked openings", () => {
    const door = { ...createCabinetShellItem("door", "door"), offsetIn: 12 };
    const first = { ...createCabinetPlannerModule("base-cabinet", "first"), offsetIn: 12 };
    const second = { ...createCabinetPlannerModule("base-cabinet", "second"), offsetIn: 24 };
    const outside = { ...createCabinetPlannerModule("tall-cabinet", "outside"), offsetIn: 112 };
    const planner = {
      ...measuredPlanner(),
      shell: { ...measuredPlanner().shell, measurementsReviewed: false },
      shellItems: [door],
      modules: [first, second, outside],
    };
    const diagnostics = getCabinetPlannerDiagnostics(planner);

    expect(diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "unreviewed-measurements",
        "module-outside-room",
        "module-collision",
        "blocked-opening",
      ])
    );
    expect(isCabinetPlannerRequestReady(planner)).toBe(false);
  });

  it("allows a reviewed, non-colliding measured plan and creates a partner-neutral quote brief", () => {
    const module = { ...createCabinetPlannerModule("base-cabinet", "base"), offsetIn: 54 };
    const planner = { ...measuredPlanner(), modules: [module] };
    const brief = buildCabinetPlannerRequestBrief(planner);

    expect(getCabinetPlannerDiagnostics(planner)).toEqual([]);
    expect(isCabinetPlannerRequestReady(planner)).toBe(true);
    expect(brief).toContain("Quote: Required");
    expect(brief).toContain('Base cabinet: 30" W × 24" D × 34.5" H');
    expect(brief).not.toMatch(/\$|early price|JW Stone/i);
  });

  it("imports explicit legacy geometry without carrying hidden appearance into the extension", () => {
    const legacy = createEmptySteelHomeProjectDraft().cabinets;
    const imported = cabinetPlannerExtensionFromLegacy({
      ...legacy,
      room: "Laundry",
      primaryWallIn: 156,
      returnWallIn: 114,
      ceilingHeightIn: 102,
      pantryCount: 0,
      drawerBaseCount: 1,
      island: false,
    });

    expect(imported.starter).toBe("laundry");
    expect(imported.shell).toEqual({
      widthIn: 156,
      depthIn: 114,
      heightIn: 102,
      measurementsReviewed: false,
    });
    expect(imported.modules.map((module) => module.label)).toEqual([
      "Refrigerator space",
      "Drawer base 1",
      "Sink base",
      "Range space",
    ]);
    expect(imported).not.toHaveProperty("finish");
    expect(imported).not.toHaveProperty("doorStyle");
    expect(imported).not.toHaveProperty("hardware");
  });
});
