import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import {
  applyStoneVisualizerTextureForTests,
  buildStoneVisualizerSceneForTests,
  getBathroomStoneSlabRunAllocations,
  getStoneVisualizerCameraOffset,
  getStoneVisualizerCameraFitDistance,
  getStonePhotoSafeRegion,
  getStoneSlabFaceCrop,
  getStoneVisualizerTextureRepeat,
  stoneVisualizerGeometryForTests,
} from "./StoneVisualizer3D";

describe("countertop spatial studio geometry", () => {
  it("builds a residential bathroom composition without kitchen or island semantics", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      room: "Primary bathroom" as const,
      wallAIn: 120,
      wallDepthIn: 22,
      island: true,
      waterfall: "Both" as const,
      cooktop: "36-inch range gap" as const,
      cooktopRun: "island" as const,
      cooktopPositionIn: 42,
      sink: "Single-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 60,
      sinkFrontPositionIn: 11,
    };

    const scene = buildStoneVisualizerSceneForTests(design);

    expect(scene.rootName).toBe("bathroom-residential-scene");
    expect(scene.objectNames).toEqual(
      expect.arrayContaining([
        "bathroom-room-shell",
        "bathroom-wall-vanity",
        "bathroom-vanity-cabinet",
        "bathroom-vanity-drawer-front",
        "bathroom-vanity-door-front",
        "bathroom-rounded-basin-rim",
        "bathroom-soft-basin",
        "bathroom-faucet-riser",
        "bathroom-vanity-mirror",
        "bathroom-sconce",
        "bathroom-warm-practical-light",
        "bathroom-wall-finish",
        "bathroom-floor-grout",
        "bathroom-tub",
        "bathroom-framed-shower-glass",
        "bathroom-grounded-toilet-bowl",
        "bathroom-contact-shadow",
      ])
    );
    expect(scene.objectNames.join(" ")).not.toMatch(/kitchen|island|cooktop|range/i);
    expect(scene.surfaceTargets).not.toContain("island");
  });

  it("keeps the residential bathroom camera at human-eye height on a narrow viewport", () => {
    const narrow = getStoneVisualizerCameraOffset({
      distance: 18,
      aspect: 390 / 844,
      preset: "Perspective",
      isBathroom: true,
    });
    const desktop = getStoneVisualizerCameraOffset({
      distance: 12,
      aspect: 16 / 9,
      preset: "Perspective",
      isBathroom: true,
    });

    expect(narrow.y).toBeCloseTo(2.65);
    expect(desktop.y).toBeCloseTo(2.65);
    expect(narrow.z / 18).toBeCloseTo(0.86);
    expect(narrow.x / 18).toBeCloseTo(0.32);
  });

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
    };
    const metrics = stoneVisualizerGeometryForTests.getLayoutMetrics(design);
    expect(metrics).toMatchObject({ roomWidth: 34, roomDepth: 44 });
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

  it("swaps physical surface axes for quarter-turn vein mapping", () => {
    const dimensions = { widthIn: 120, heightIn: 60 };
    expect(
      getStoneVisualizerTextureRepeat(
        { widthFt: 10, heightFt: 2 },
        { textureScale: 1, veinRotation: 0 },
        dimensions
      )
    ).toEqual({ x: 0.985, y: 0.4 });
    expect(
      getStoneVisualizerTextureRepeat(
        { widthFt: 10, heightFt: 2 },
        { textureScale: 1, veinRotation: 90 },
        dimensions
      )
    ).toEqual({ x: 0.2, y: 0.985 });
  });

  it("allocates main and return runs to non-overlapping regions of one finite slab photo", () => {
    const allocations = getBathroomStoneSlabRunAllocations({
      runs: [
        { run: "main", widthFt: 10, heightFt: 22 / 12 },
        { run: "left-return", widthFt: 6, heightFt: 22 / 12 },
        { run: "right-return", widthFt: 5, heightFt: 22 / 12 },
      ],
      design: createEmptySteelHomeProjectDraft().countertops,
      dimensions: { widthIn: 130, heightIn: 77.5 },
    });

    expect(allocations.map((allocation) => allocation.run)).toEqual([
      "main",
      "left-return",
      "right-return",
    ]);
    for (const allocation of allocations) {
      expect(allocation.x).toBeGreaterThanOrEqual(0);
      expect(allocation.y).toBeGreaterThanOrEqual(0);
      expect(allocation.x + allocation.width).toBeLessThanOrEqual(1);
      expect(allocation.y + allocation.height).toBeLessThanOrEqual(1);
    }
    for (let firstIndex = 0; firstIndex < allocations.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < allocations.length; secondIndex += 1) {
        const first = allocations[firstIndex];
        const second = allocations[secondIndex];
        const overlaps =
          first.x < second.x + second.width &&
          first.x + first.width > second.x &&
          first.y < second.y + second.height &&
          first.y + first.height > second.y;
        expect(overlaps).toBe(false);
      }
    }
    expect(new Set(allocations.map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
  });

  it("center-crops the real inventory photo to the recorded slab face with a safety inset", () => {
    const crop = getStoneSlabFaceCrop({
      imageWidth: 1600,
      imageHeight: 1200,
      dimensions: { widthIn: 120, heightIn: 60 },
      safetyInset: 0.05,
    });

    expect(crop).toEqual({ x: 80, y: 240, width: 1440, height: 720 });
    expect(crop.width / crop.height).toBe(2);
    expect(crop.x).toBeGreaterThan(0);
    expect(crop.y).toBeGreaterThan(0);
  });

  it("uses photo-specific stone-only interiors for yard photos with clamps", () => {
    const cristallo = getStonePhotoSafeRegion(
      "/images/businesses/jw-stone/inventory-source/1D8bvWASTFtKs4ri4KK553drHwWXeAzxQ.webp"
    );
    const whiteRhino = getStonePhotoSafeRegion(
      "/images/businesses/jw-stone/inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp?build=1"
    );
    expect(cristallo).toEqual({ x: 0.14, y: 0.2, width: 0.72, height: 0.66 });
    expect(whiteRhino).toEqual(cristallo);
    expect(
      getStoneSlabFaceCrop({
        imageWidth: 1000,
        imageHeight: 650,
        dimensions: { widthIn: 130, heightIn: 77.5 },
        safeRegion: cristallo,
        safetyInset: 0.01,
      })
    ).toMatchObject({ x: expect.any(Number), y: expect.any(Number), width: expect.any(Number) });
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
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });
});
