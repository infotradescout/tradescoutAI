import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import {
  applyStoneVisualizerTextureForTests,
  getStoneVisualizerCameraFitDistance,
  getStoneVisualizerTextureRepeat,
  stoneVisualizerGeometryForTests,
} from "./StoneVisualizer3D";

describe("countertop spatial studio geometry", () => {
  it("keeps the full entered run and island dimensions instead of visually capping them", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "u-shape" as const,
      wallAIn: 360,
      wallBIn: 240,
      wallCIn: 180,
      wallDepthIn: 30,
      island: true,
      islandLengthIn: 144,
      islandWidthIn: 60,
      roomWidthIn: 408,
      roomDepthIn: 396,
      roomWallHeightIn: 108,
      finishedTopHeightIn: 36,
      topThicknessIn: 1.25,
      islandLeftOffsetIn: 108,
      islandBackOffsetIn: 132,
    };

    expect(stoneVisualizerGeometryForTests.getLayoutMetrics(design)).toMatchObject({
      mainWidth: 30,
      counterDepth: 2.5,
      leftLength: 20,
      rightLength: 15,
      islandWidth: 12,
      islandDepth: 5,
      roomWidth: 34,
      roomDepth: 33,
      roomWallHeight: 9,
      islandX: 0,
      islandZ: 13.5,
      surfaceTopY: 3,
      topThickness: 1.25 / 12,
    });
  });

  it("fits the maximum supported U-shaped room more conservatively on a portrait viewport", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "u-shape" as const,
      wallAIn: 360,
      wallBIn: 360,
      wallCIn: 360,
      wallDepthIn: 30,
      island: true,
      islandLengthIn: 180,
      islandWidthIn: 72,
      roomWidthIn: 408,
      roomDepthIn: 528,
      roomWallHeightIn: 108,
    };
    const metrics = stoneVisualizerGeometryForTests.getLayoutMetrics(design);
    expect(metrics).toMatchObject({ roomWidth: 34, roomDepth: 44 });
    if (metrics.roomWidth === null || metrics.roomDepth === null) {
      throw new Error("Expected entered room dimensions to resolve");
    }
    const span = Math.max(metrics.roomWidth, metrics.roomDepth, 8 * 1.25);
    const portraitDistance = getStoneVisualizerCameraFitDistance({
      span,
      verticalFovDegrees: 42,
      aspect: 0.75,
    });
    const desktopDistance = getStoneVisualizerCameraFitDistance({
      span,
      verticalFovDegrees: 42,
      aspect: 16 / 9,
    });
    expect(portraitDistance).toBeGreaterThan(desktopDistance);
    expect(portraitDistance).toBeGreaterThan(metrics.roomDepth);
  });

  it("models every placed opening on a run with its longitudinal and front offsets", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "straight" as const,
      wallAIn: 360,
      wallDepthIn: 30,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 60,
      sinkFrontPositionIn: 14,
      cooktop: "36-inch cooktop cutout" as const,
      cooktopRun: "main" as const,
      cooktopPositionIn: 180,
      cooktopFrontPositionIn: 13,
      otherCutouts: [
        {
          id: "outlet",
          type: "Pop-up outlet" as const,
          label: "",
          run: "main" as const,
          positionIn: 300,
          frontPositionIn: 24,
          widthIn: 2,
          depthIn: 2,
        },
      ],
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
      cooktopTemplateWidthIn: 36,
      cooktopTemplateDepthIn: 22,
    };

    const cuts = stoneVisualizerGeometryForTests.getRunCuts(design, "main", 30, 2.5);
    expect(cuts).toHaveLength(3);
    expect(cuts.map((cut) => cut.kind)).toEqual(["sink", "cooktop", "other"]);
    expect(cuts.map((cut) => cut.centerXFt)).toEqual([-10, 0, 10]);
    expect(cuts[0].centerZFt).toBeCloseTo(2.5 / 2 - 14 / 12);
    expect(cuts[1].centerZFt).toBeCloseTo(2.5 / 2 - 13 / 12);
    expect(cuts[2].centerZFt).toBeCloseTo(2.5 / 2 - 24 / 12);

    const pieces = stoneVisualizerGeometryForTests.getVisibleSurfacePieces(30, 2.5, cuts);
    expect(pieces.length).toBeLessThanOrEqual(10);
    const visibleArea = pieces.reduce(
      (total, piece) => total + (piece.right - piece.left) * (piece.front - piece.back),
      0
    );
    const openingArea = cuts.reduce((total, cut) => total + cut.widthFt * cut.depthFt, 0);
    expect(visibleArea).toBeCloseTo(30 * 2.5 - openingArea);
  });

  it("distinguishes full-depth range gaps from apron-front sink notches", () => {
    const rangeDesign = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "straight" as const,
      wallAIn: 144,
      wallDepthIn: 30,
      cooktop: "36-inch range gap" as const,
      cooktopRun: "main" as const,
      cooktopPositionIn: 72,
    };
    const range = stoneVisualizerGeometryForTests.getRunCuts(rangeDesign, "main", 12, 2.5)[0];
    expect(range).toMatchObject({ fullDepth: true, frontEdge: false, depthFt: 2.5 });

    const apronDesign = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "straight" as const,
      wallAIn: 144,
      wallDepthIn: 30,
      sink: "Farmhouse" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 72,
      sinkTemplateWidthIn: 33,
      sinkTemplateDepthIn: 20,
    };
    const apron = stoneVisualizerGeometryForTests.getRunCuts(apronDesign, "main", 12, 2.5)[0];
    expect(apron.fullDepth).toBe(false);
    expect(apron.frontEdge).toBe(true);
    expect(apron.centerZFt + apron.depthFt / 2).toBeCloseTo(1.25);
  });

  it("omits openings whose required placement or custom dimensions are incomplete", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "straight" as const,
      wallAIn: 144,
      wallDepthIn: 30,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 48,
      sinkFrontPositionIn: null,
      cooktop: "36-inch range gap" as const,
      cooktopRun: "main" as const,
      cooktopPositionIn: 72,
      otherCutouts: [
        {
          id: "unfinished",
          type: "Custom" as const,
          label: "Future opening",
          run: "main" as const,
          positionIn: 96,
          frontPositionIn: 12,
          widthIn: null,
          depthIn: null,
        },
      ],
    };

    const cuts = stoneVisualizerGeometryForTests.getRunCuts(design, "main", 12, 2.5);
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({ kind: "cooktop", fullDepth: true });
  });

  it("shows generic fixtures as coordination points without subtracting guessed cutouts", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      layout: "straight" as const,
      wallAIn: 144,
      wallDepthIn: 30,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 48,
      sinkFrontPositionIn: 14,
      cooktop: "36-inch cooktop cutout" as const,
      cooktopRun: "main" as const,
      cooktopPositionIn: 96,
      cooktopFrontPositionIn: 14,
    };

    expect(stoneVisualizerGeometryForTests.getRunCuts(design, "main", 12, 2.5)).toEqual([]);
    expect(stoneVisualizerGeometryForTests.getRunMarkers(design, "main", 12, 2.5)).toMatchObject([
      { id: "sink", kind: "sink", centerXFt: -2 },
      { id: "cooktop", kind: "cooktop", centerXFt: 2 },
    ]);
    expect(stoneVisualizerGeometryForTests.getVisibleSurfacePieces(12, 2.5, [])).toEqual([
      { left: -6, right: 6, back: -1.25, front: 1.25 },
    ]);
  });

  it("swaps physical surface axes for quarter-turn vein mapping", () => {
    const dimensions = { widthIn: 120, heightIn: 60 };
    expect(
      getStoneVisualizerTextureRepeat(
        { widthFt: 10, heightFt: 2 },
        { textureScale: 1, veinRotation: 0 },
        dimensions
      )
    ).toEqual({ x: 1, y: 0.4 });
    expect(
      getStoneVisualizerTextureRepeat(
        { widthFt: 10, heightFt: 2 },
        { textureScale: 1, veinRotation: 90 },
        dimensions
      )
    ).toEqual({ x: 0.2, y: 2 });
  });

  it("updates crop and vein transforms without invalidating the shared image source", () => {
    const source = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial();
    const design = createEmptySteelHomeProjectDraft().countertops;
    const record = { material, widthFt: 10, heightFt: 2, target: "counter" as const };
    const texture = applyStoneVisualizerTextureForTests({
      source,
      sourceKey: "photo-1",
      record,
      design,
      dimensions: { widthIn: 120, heightIn: 60 },
      anisotropy: 4,
    });
    const textureId = texture.id;
    const textureVersion = texture.version;
    const sourceVersion = texture.source.version;

    const updatedTexture = applyStoneVisualizerTextureForTests({
      source,
      sourceKey: "photo-1",
      record,
      design: {
        ...design,
        textureOffsetX: 0.35,
        textureScale: 1.4,
        veinRotation: 90,
      },
      dimensions: { widthIn: 120, heightIn: 60 },
      anisotropy: 4,
    });

    expect(updatedTexture).toBe(texture);
    expect(texture.id).toBe(textureId);
    expect(texture.version).toBe(textureVersion);
    expect(texture.source.version).toBe(sourceVersion);
    expect(texture.offset.x).toBeCloseTo(0.1225);
    expect(texture.rotation).toBeCloseTo(Math.PI / 2);
  });
});
