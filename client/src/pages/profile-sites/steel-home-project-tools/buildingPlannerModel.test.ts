import { describe, expect, it } from "vitest";
import {
  buildBuildingMeasuredScene,
  buildBuildingPlannerRequest,
  createBuildingPlannerExtensionFromLegacy,
  createBuildingPlannerPersistenceEnvelope,
  createEmptyBuildingPlannerExtension,
  getSceneRoofHeightAtPoint,
  getBuildingPlannerRequestReadiness,
  projectBuildingExtensionToLegacy,
  restoreBuildingPlannerPersistenceEnvelope,
  sanitizeBuildingPlannerExtension,
  type BuildingPlannerExtensionV1,
} from "./buildingPlannerModel";
import { createEmptySteelHomeProjectDraft } from "./projectModel";

function completeGable(): BuildingPlannerExtensionV1 {
  return {
    ...createEmptyBuildingPlannerExtension(),
    useId: "home-with-shop",
    systemId: "open-web-truss",
    widthFt: 50,
    lengthFt: 60,
    eaveHeightFt: 14,
    roofId: "gable",
    roofPitchRise12: 4,
  };
}

describe("buildingPlannerModel", () => {
  it("starts blank and does not silently migrate historical defaults", () => {
    const empty = createEmptyBuildingPlannerExtension();
    expect(empty).toMatchObject({
      useId: null,
      systemId: null,
      widthFt: null,
      roofId: null,
      colors: { wall: null, roof: null, trim: null },
      openings: [],
      attachments: [],
    });
    expect(
      createBuildingPlannerExtensionFromLegacy(createEmptySteelHomeProjectDraft().building)
    ).toEqual(empty);
  });

  it("builds one canonical measured scene with a stable fingerprint", () => {
    const state: BuildingPlannerExtensionV1 = {
      ...completeGable(),
      openings: [
        {
          id: "door-1",
          typeId: "overhead-door",
          surface: "front",
          widthFt: 12,
          heightFt: 12,
          offsetFt: 5,
          sillHeightFt: 0,
          roofXFt: null,
          roofZFt: null,
        },
      ],
      attachments: [
        {
          id: "porch-1",
          typeId: "porch",
          wall: "front",
          offsetFt: 20,
          widthFt: 20,
          projectionFt: 8,
          eaveHeightFt: null,
          roofPitchRise12: null,
        },
      ],
      accessories: [
        {
          id: "cupola-1",
          typeId: "cupola",
          surface: "roof",
          offsetFt: 25,
          secondaryOffsetFt: 30,
          elevationFt: null,
        },
      ],
    };
    const first = buildBuildingMeasuredScene(state);
    const second = buildBuildingMeasuredScene(state);
    expect(first.ready).toBe(true);
    expect(first.requestReady).toBe(true);
    expect(getBuildingPlannerRequestReadiness(state)).toMatchObject({
      requestReady: true,
      sceneFingerprint: first.fingerprint,
      blockers: [],
    });
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.shell?.roofProfile).toEqual([
      { xFt: 0, heightFt: 14 },
      { xFt: 25, heightFt: 22.333333333333336 },
      { xFt: 50, heightFt: 14 },
    ]);
    expect(first.openings[0]).toMatchObject({ id: "door-1", offsetFt: 5, widthFt: 12 });
    expect(first.attachments[0]).toMatchObject({ id: "porch-1", verticalResolved: false });
    expect(first.accessories[0]).toMatchObject({
      id: "cupola-1",
      offsetFt: 25,
      secondaryOffsetFt: 30,
    });
    expect(getSceneRoofHeightAtPoint(first, 25, 30)).toBeCloseTo(22.3333, 3);
    expect(first.diagnostics).toContainEqual(
      expect.objectContaining({ code: "attachment-vertical-unresolved", severity: "review" })
    );

    const resolvedAttachment = buildBuildingMeasuredScene({
      ...state,
      attachments: [
        {
          ...state.attachments[0],
          eaveHeightFt: 9,
          roofPitchRise12: 3,
        },
      ],
    });
    expect(resolvedAttachment.attachments[0]).toMatchObject({
      verticalResolved: true,
      roofSurface: [{ yFt: 11 }, { yFt: 11 }, { yFt: 9 }, { yFt: 9 }],
    });
  });

  it("fails closed for impossible placements and disconnected specialty geometry", () => {
    const overlap = buildBuildingMeasuredScene({
      ...completeGable(),
      openings: [
        {
          id: "a",
          typeId: "window",
          surface: "front",
          widthFt: 5,
          heightFt: 4,
          offsetFt: 4,
          sillHeightFt: 3,
          roofXFt: null,
          roofZFt: null,
        },
        {
          id: "b",
          typeId: "walk-door",
          surface: "front",
          widthFt: 4,
          heightFt: 7,
          offsetFt: 7,
          sillHeightFt: 0,
          roofXFt: null,
          roofZFt: null,
        },
      ],
    });
    expect(overlap.requestReady).toBe(false);
    expect(overlap.diagnostics).toContainEqual(
      expect.objectContaining({ code: "wall-openings-overlap", objectId: "b" })
    );

    const disconnected = buildBuildingMeasuredScene({
      ...completeGable(),
      roofId: "asymmetrical",
      roofDetails: {
        ...completeGable().roofDetails,
        asymmetricalRidgeOffsetFt: 20,
        secondaryPitchRise12: 4,
      },
    });
    expect(disconnected.ready).toBe(false);
    expect(disconnected.diagnostics).toContainEqual(
      expect.objectContaining({ code: "asymmetrical-planes-disconnected", severity: "blocker" })
    );
  });

  it("round-trips the extension envelope and projects explicit choices to legacy only on demand", () => {
    const legacy = createEmptySteelHomeProjectDraft().building;
    const state = completeGable();
    expect(
      restoreBuildingPlannerPersistenceEnvelope(createBuildingPlannerPersistenceEnvelope(state))
    ).toEqual(state);
    expect(projectBuildingExtensionToLegacy(state, legacy)).toMatchObject({
      included: true,
      use: "home-and-shop",
      widthFt: 50,
      lengthFt: 60,
      eaveHeightFt: 14,
      roofStyle: "gable",
      roofPitch: "4:12",
      garageDoors: 0,
      windows: 0,
    });
  });

  it("preserves retired saved catalog identifiers and blocks until they are resolved", () => {
    const restored = sanitizeBuildingPlannerExtension({
      ...completeGable(),
      systemId: "retired-mega-frame",
      openings: [
        {
          id: "old-opening",
          typeId: "retired-fold-door",
          surface: "front",
          widthFt: 10,
          heightFt: 10,
          offsetFt: 4,
          sillHeightFt: 0,
        },
      ],
    });
    expect(restored.systemId).toBeNull();
    expect(restored.openings).toHaveLength(1);
    expect(restored.unresolvedCatalogItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "systemId", savedId: "retired-mega-frame" }),
        expect.objectContaining({
          path: "openings.old-opening.typeId",
          savedId: "retired-fold-door",
        }),
      ])
    );
    const scene = buildBuildingMeasuredScene(restored);
    expect(scene.requestReady).toBe(false);
    expect(scene.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "catalog-reference-unresolved",
        severity: "blocker",
        objectId: "systemId",
      })
    );
  });

  it("produces quote-required, price-free handoff copy", () => {
    const request = buildBuildingPlannerRequest(completeGable());
    expect(request).toMatchObject({
      visibility: "private-project-handoff",
      quoteRequired: true,
      use: "Home with shop",
      structuralSystem: "Open-web clearspan truss",
      shell: "50 × 60 × 14 ft eave",
    });
    expect(JSON.stringify(request)).not.toMatch(/\$|price estimate|early price/i);
    expect(request?.qualifications.join(" ")).toMatch(
      /field verification.*engineering.*local code/i
    );
  });
});
