import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { isHandScaleCoverImage } from "@/features/jw-stone/coverImages";
import { resolveSlabDimensionForInventoryImage } from "@/features/jw-stone/slabDimensions";
import { type CountertopCutoutRun } from "./projectModel";
import {
  getCountertopPlannerDiagnostics,
  getCountertopPlannerOpeningSchedule,
  hasResolvedCountertopIslandPosition,
  hasResolvedCountertopRoomShell,
  resolveCountertopPlannerDesign,
  type CountertopPlannerDesign,
  type CountertopPlannerDesignInput,
} from "./countertopPlannerModel";
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerImageHref,
} from "./stoneDesignerImages";

export type StoneSurfaceTarget = "counter" | "island" | "backsplash" | "floor";

type Props = {
  design: CountertopPlannerDesignInput;
  selectedTarget: StoneSurfaceTarget;
  onSelectTarget: (target: StoneSurfaceTarget) => void;
};

type StoneMaterialRecord = {
  material: THREE.MeshStandardMaterial;
  widthFt: number;
  heightFt: number;
  target: StoneSurfaceTarget;
};

type Runtime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  content: THREE.Group;
  resizeObserver: ResizeObserver;
  intersectionObserver: IntersectionObserver | null;
  revision: number;
  cameraKey: string;
  cameraDirty: boolean;
  records: StoneMaterialRecord[];
  sourceTexture: THREE.Texture | null;
  sourceTextureKey: string;
  renderOnce: () => void;
  visible: boolean;
};

type RunCut = {
  id: string;
  centerXFt: number;
  centerZFt: number;
  widthFt: number;
  depthFt: number;
  kind: "sink" | "cooktop" | "other";
  fullDepth: boolean;
  frontEdge: boolean;
};

type RunMarker = {
  id: string;
  centerXFt: number;
  centerZFt: number;
  kind: "sink" | "cooktop" | "other";
};

type SurfaceRect = {
  left: number;
  right: number;
  back: number;
  front: number;
};

type LayoutMetrics = {
  roomWidth: number | null;
  roomDepth: number | null;
  roomWallHeight: number | null;
  backWallZ: number;
  mainWidth: number;
  counterDepth: number;
  mainZ: number;
  leftLength: number;
  rightLength: number;
  islandWidth: number;
  islandDepth: number;
  islandX: number | null;
  islandZ: number | null;
  surfaceTopY: number;
  topThickness: number | null;
};

const ROOM_BACKGROUND = new THREE.Color("#d8d0c2");
const UNRESOLVED_SURFACE_Y = 0.16;
const SCHEMATIC_THICKNESS_FT = 0.015;
const STONE_TEXTURE_LOAD_TIMEOUT_MS = 15_000;

function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of childMaterials) {
      materials.add(material);
      if (material instanceof THREE.MeshStandardMaterial && material.map) {
        textures.add(material.map);
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: THREE.ColorRepresentation,
  options: {
    rotationY?: number;
    roughness?: number;
    metalness?: number;
    castShadow?: boolean;
  } = {}
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = options.rotationY ?? 0;
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addStoneBox(args: {
  parent: THREE.Object3D;
  records: StoneMaterialRecord[];
  target: StoneSurfaceTarget;
  size: [number, number, number];
  position: [number, number, number];
  mappingWidthFt: number;
  mappingHeightFt: number;
  rotationY?: number;
}) {
  const material = new THREE.MeshStandardMaterial({
    color: "#c8b7a6",
    roughness: 0.4,
    metalness: 0.02,
    emissive: new THREE.Color("#000000"),
    emissiveIntensity: 0,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...args.size), material);
  mesh.position.set(...args.position);
  mesh.rotation.y = args.rotationY ?? 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.surfaceTarget = args.target;
  args.parent.add(mesh);
  args.records.push({
    material,
    widthFt: Math.max(0.08, args.mappingWidthFt),
    heightFt: Math.max(0.08, args.mappingHeightFt),
    target: args.target,
  });
  return mesh;
}

function createStoneMaterial(target: StoneSurfaceTarget): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: "#c8b7a6",
    roughness: 0.4,
    metalness: 0.02,
    emissive: new THREE.Color("#000000"),
    emissiveIntensity: 0,
  });
  material.userData.surfaceTarget = target;
  return material;
}

function addMappedStonePiece(args: {
  parent: THREE.Object3D;
  material: THREE.MeshStandardMaterial;
  target: StoneSurfaceTarget;
  width: number;
  depth: number;
  thickness: number;
  centerX: number;
  centerY: number;
  centerZ: number;
  surfaceWidth: number;
  surfaceDepth: number;
}) {
  const geometry = new THREE.BoxGeometry(args.width, args.thickness, args.depth);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    const normalX = Math.abs(normals.getX(index));
    const normalY = Math.abs(normals.getY(index));
    const globalX = args.centerX + positions.getX(index);
    const globalZ = args.centerZ + positions.getZ(index);
    if (normalY > 0.5) {
      uvs.setXY(
        index,
        (globalX + args.surfaceWidth / 2) / args.surfaceWidth,
        (globalZ + args.surfaceDepth / 2) / args.surfaceDepth
      );
    } else if (normalX > 0.5) {
      uvs.setXY(
        index,
        (globalZ + args.surfaceDepth / 2) / args.surfaceDepth,
        (positions.getY(index) + args.thickness / 2) / args.thickness
      );
    } else {
      uvs.setXY(
        index,
        (globalX + args.surfaceWidth / 2) / args.surfaceWidth,
        (positions.getY(index) + args.thickness / 2) / args.thickness
      );
    }
  }
  uvs.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, args.material);
  mesh.position.set(args.centerX, args.centerY, args.centerZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.surfaceTarget = args.target;
  args.parent.add(mesh);
  return mesh;
}

function localToWorld(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  rotationY: number
): [number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [centerX + cosine * x + sine * z, centerZ - sine * x + cosine * z];
}

function getRunCuts(
  design: CountertopPlannerDesignInput,
  run: CountertopCutoutRun,
  width: number,
  depth: number,
  reverseStart = false,
  startOffsetFt = 0
): RunCut[] {
  return getCountertopPlannerOpeningSchedule(design).flatMap((item) => {
    if (item.representation === "coordination-point") return [];
    if (item.run !== run || item.positionIn === null) return [];
    if (item.requiresFrontPosition && (item.frontPositionIn === null || !item.depthIn)) return [];
    if (item.id !== "sink" && item.id !== "cooktop" && (!item.widthIn || !item.depthIn)) return [];

    const requestedWidth = Math.max(0.08, (item.widthIn ?? item.planningWidthIn) / 12);
    const fullDepth = item.placementKind === "full-depth-gap";
    const frontEdge = item.placementKind === "front-edge-opening";
    const requestedDepth = fullDepth
      ? depth
      : frontEdge
        ? Math.max(0.08, Math.min(depth, (item.depthIn ?? 2) / 12))
        : Math.max(0.08, (item.depthIn ?? 0) / 12);
    const positionAlongVisibleRun = item.positionIn / 12 - startOffsetFt;
    const requestedCenterX = reverseStart
      ? width / 2 - positionAlongVisibleRun
      : -width / 2 + positionAlongVisibleRun;
    const requestedCenterZ = fullDepth
      ? 0
      : frontEdge
        ? depth / 2 - requestedDepth / 2
        : depth / 2 - (item.frontPositionIn ?? 0) / 12;

    const left = Math.max(-width / 2, requestedCenterX - requestedWidth / 2);
    const right = Math.min(width / 2, requestedCenterX + requestedWidth / 2);
    const back = Math.max(-depth / 2, requestedCenterZ - requestedDepth / 2);
    const front = Math.min(depth / 2, requestedCenterZ + requestedDepth / 2);
    if (right - left <= 0.01 || front - back <= 0.01) return [];

    return [
      {
        id: item.id,
        centerXFt: (left + right) / 2,
        centerZFt: (back + front) / 2,
        widthFt: right - left,
        depthFt: front - back,
        kind: item.id === "sink" ? "sink" : item.id === "cooktop" ? "cooktop" : "other",
        fullDepth,
        frontEdge,
      },
    ];
  });
}

function getRunMarkers(
  design: CountertopPlannerDesignInput,
  run: CountertopCutoutRun,
  width: number,
  depth: number,
  reverseStart = false,
  startOffsetFt = 0
): RunMarker[] {
  return getCountertopPlannerOpeningSchedule(design).flatMap((item) => {
    if (
      item.representation !== "coordination-point" ||
      item.run !== run ||
      item.positionIn === null ||
      (item.requiresFrontPosition && item.frontPositionIn === null)
    ) {
      return [];
    }
    const positionAlongVisibleRun = item.positionIn / 12 - startOffsetFt;
    const centerXFt = reverseStart
      ? width / 2 - positionAlongVisibleRun
      : -width / 2 + positionAlongVisibleRun;
    const centerZFt =
      item.placementKind === "front-edge-opening"
        ? depth / 2
        : depth / 2 - (item.frontPositionIn ?? depth * 6) / 12;
    if (
      centerXFt < -width / 2 ||
      centerXFt > width / 2 ||
      centerZFt < -depth / 2 ||
      centerZFt > depth / 2
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        centerXFt,
        centerZFt,
        kind: item.id === "sink" ? "sink" : item.id === "cooktop" ? "cooktop" : "other",
      },
    ];
  });
}

function subtractOpening(rect: SurfaceRect, cut: RunCut): SurfaceRect[] {
  const left = Math.max(rect.left, cut.centerXFt - cut.widthFt / 2);
  const right = Math.min(rect.right, cut.centerXFt + cut.widthFt / 2);
  const back = Math.max(rect.back, cut.centerZFt - cut.depthFt / 2);
  const front = Math.min(rect.front, cut.centerZFt + cut.depthFt / 2);
  if (right <= left || front <= back) return [rect];

  const pieces: SurfaceRect[] = [];
  if (left > rect.left) {
    pieces.push({ left: rect.left, right: left, back: rect.back, front: rect.front });
  }
  if (right < rect.right) {
    pieces.push({ left: right, right: rect.right, back: rect.back, front: rect.front });
  }
  if (back > rect.back) pieces.push({ left, right, back: rect.back, front: back });
  if (front < rect.front) pieces.push({ left, right, back: front, front: rect.front });
  return pieces.filter(
    (piece) => piece.right - piece.left > 0.015 && piece.front - piece.back > 0.015
  );
}

function getVisibleSurfacePieces(width: number, depth: number, cuts: RunCut[]): SurfaceRect[] {
  return cuts.reduce<SurfaceRect[]>(
    (pieces, cut) => pieces.flatMap((piece) => subtractOpening(piece, cut)),
    [
      {
        left: -width / 2,
        right: width / 2,
        back: -depth / 2,
        front: depth / 2,
      },
    ]
  );
}

function addCounterEdgeSegment(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  centerX: number,
  y: number,
  edge: CountertopPlannerDesign["edge"]
) {
  if (edge === "None" || edge === "Eased" || width <= 0.02) return;
  if (edge.includes("bullnose")) {
    const radius = edge === "Full bullnose" ? 0.105 : 0.075;
    const material = new THREE.MeshStandardMaterial({ color: "#d2c2b2", roughness: 0.38 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), material);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(centerX, y, depth / 2);
    roll.castShadow = true;
    parent.add(roll);
    return;
  }
  const strip = addBox(
    parent,
    [width, edge === "Mitered" ? 0.24 : 0.12, 0.1],
    [centerX, y + (edge === "Mitered" ? -0.07 : 0), depth / 2],
    "#cbb8a6"
  );
  if (edge === "Beveled") strip.rotation.x = Math.PI / 5;
}

function addCounterRun(args: {
  parent: THREE.Object3D;
  records: StoneMaterialRecord[];
  design: CountertopPlannerDesign;
  target: "counter" | "island";
  run: CountertopCutoutRun;
  width: number;
  depth: number;
  x: number;
  z: number;
  rotationY?: number;
  reverseStart?: boolean;
  startOffsetFt?: number;
  surfaceTopY: number;
  topThickness: number | null;
}) {
  const group = new THREE.Group();
  group.position.set(args.x, 0, args.z);
  group.rotation.y = args.rotationY ?? 0;
  group.userData.surfaceTarget = args.target;
  args.parent.add(group);

  const thickness = args.topThickness ?? SCHEMATIC_THICKNESS_FT;
  const cuts = getRunCuts(
    args.design,
    args.run,
    args.width,
    args.depth,
    args.reverseStart,
    args.startOffsetFt
  );
  const markers = getRunMarkers(
    args.design,
    args.run,
    args.width,
    args.depth,
    args.reverseStart,
    args.startOffsetFt
  );
  const runMaterial = createStoneMaterial(args.target);
  if (args.topThickness === null) {
    runMaterial.transparent = true;
    runMaterial.opacity = 0.78;
  }
  args.records.push({
    material: runMaterial,
    widthFt: args.width,
    heightFt: args.depth,
    target: args.target,
  });
  const visiblePieces = getVisibleSurfacePieces(args.width, args.depth, cuts);
  for (const piece of visiblePieces) {
    addMappedStonePiece({
      parent: group,
      material: runMaterial,
      target: args.target,
      width: piece.right - piece.left,
      depth: piece.front - piece.back,
      thickness,
      centerX: (piece.left + piece.right) / 2,
      centerY: args.surfaceTopY - thickness / 2,
      centerZ: (piece.back + piece.front) / 2,
      surfaceWidth: args.width,
      surfaceDepth: args.depth,
    });
  }

  for (const cut of cuts) {
    if (cut.fullDepth) continue;
    const openingBottom = addBox(
      group,
      [Math.max(0.05, cut.widthFt * 0.94), 0.015, Math.max(0.05, cut.depthFt * 0.92)],
      [cut.centerXFt, args.surfaceTopY - thickness - 0.01, cut.centerZFt],
      "#252c2b",
      { roughness: 0.9, castShadow: false }
    );
    openingBottom.userData.surfaceTarget = args.target;
  }

  for (const marker of markers) {
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: marker.kind === "sink" ? "#4d8584" : marker.kind === "cooktop" ? "#b46339" : "#d49a58",
      emissive: "#6a2f19",
      emissiveIntensity: 0.18,
      roughness: 0.45,
    });
    const point = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.035, 24), markerMaterial);
    point.position.set(marker.centerXFt, args.surfaceTopY + 0.025, marker.centerZFt);
    point.userData.surfaceTarget = args.target;
    point.userData.openingId = marker.id;
    point.userData.openingRepresentation = "coordination-point";
    group.add(point);
  }

  const frontInterruptions = cuts
    .filter(
      (cut) =>
        cut.fullDepth || cut.frontEdge || cut.centerZFt + cut.depthFt / 2 >= args.depth / 2 - 0.01
    )
    .map(
      (cut) =>
        [
          Math.max(-args.width / 2, cut.centerXFt - cut.widthFt / 2),
          Math.min(args.width / 2, cut.centerXFt + cut.widthFt / 2),
        ] as const
    )
    .sort((a, b) => a[0] - b[0]);
  let edgeCursor = -args.width / 2;
  for (const [start, end] of frontInterruptions) {
    if (args.topThickness !== null && start > edgeCursor) {
      addCounterEdgeSegment(
        group,
        start - edgeCursor,
        args.depth,
        (start + edgeCursor) / 2,
        args.surfaceTopY - thickness / 2,
        args.design.edge
      );
    }
    edgeCursor = Math.max(edgeCursor, end);
  }
  if (args.topThickness !== null && edgeCursor < args.width / 2) {
    addCounterEdgeSegment(
      group,
      args.width / 2 - edgeCursor,
      args.depth,
      (args.width / 2 + edgeCursor) / 2,
      args.surfaceTopY - thickness / 2,
      args.design.edge
    );
  }

  if (args.design.showSeams) {
    const seamX = cuts.some((cut) => Math.abs(cut.centerXFt) < cut.widthFt / 2 + 0.02)
      ? args.width * 0.24
      : 0;
    addBox(group, [0.025, 0.012, args.depth], [seamX, args.surfaceTopY + 0.008, 0], "#403a36", {
      roughness: 0.9,
    });
  }
  return group;
}

function getLayoutMetrics(designInput: CountertopPlannerDesignInput): LayoutMetrics {
  const design = resolveCountertopPlannerDesign(designInput);
  const mainWidth = design.wallAIn / 12;
  const counterDepth = design.wallDepthIn / 12;
  const leftLength = design.layout === "straight" ? 0 : design.wallBIn / 12;
  const rightLength = design.layout === "u-shape" ? design.wallCIn / 12 : 0;
  const islandWidth = design.island ? design.islandLengthIn / 12 : 0;
  const islandDepth = design.island ? design.islandWidthIn / 12 : 0;
  const roomWidth = design.roomWidthIn === null ? null : design.roomWidthIn / 12;
  const roomDepth = design.roomDepthIn === null ? null : design.roomDepthIn / 12;
  const roomWallHeight = design.roomWallHeightIn === null ? null : design.roomWallHeightIn / 12;
  const backWallZ = 0;
  const islandPositionResolved = hasResolvedCountertopIslandPosition(design);
  const islandLeftOffsetFt = (design.islandLeftOffsetIn ?? 0) / 12;
  const islandBackOffsetFt = (design.islandBackOffsetIn ?? 0) / 12;
  const islandX =
    design.island && islandPositionResolved
      ? -mainWidth / 2 + islandLeftOffsetFt + islandWidth / 2
      : null;
  const islandZ =
    design.island && islandPositionResolved ? islandBackOffsetFt + islandDepth / 2 : null;
  return {
    roomWidth,
    roomDepth,
    roomWallHeight,
    backWallZ,
    mainWidth,
    counterDepth,
    mainZ: counterDepth / 2,
    leftLength,
    rightLength,
    islandWidth,
    islandDepth,
    islandX,
    islandZ,
    surfaceTopY:
      design.finishedTopHeightIn === null ? UNRESOLVED_SURFACE_Y : design.finishedTopHeightIn / 12,
    topThickness: design.topThicknessIn === null ? null : design.topThicknessIn / 12,
  };
}

/** Pure geometry seam used by focused tests; it does not create WebGL state. */
export const stoneVisualizerGeometryForTests = Object.freeze({
  getRunCuts,
  getRunMarkers,
  getLayoutMetrics,
  getVisibleSurfacePieces,
});

function addRoomShell(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  floorStone: boolean,
  metrics: LayoutMetrics
) {
  if (metrics.roomWidth === null || metrics.roomDepth === null || metrics.roomWallHeight === null) {
    return;
  }
  if (floorStone) {
    addStoneBox({
      parent,
      records,
      target: "floor",
      size: [metrics.roomWidth, 0.12, metrics.roomDepth],
      position: [0, -0.08, metrics.roomDepth / 2],
      mappingWidthFt: metrics.roomWidth,
      mappingHeightFt: metrics.roomDepth,
    });
  } else {
    addBox(
      parent,
      [metrics.roomWidth, 0.12, metrics.roomDepth],
      [0, -0.08, metrics.roomDepth / 2],
      "#cbb99f",
      { roughness: 0.88 }
    );
  }
  addBox(
    parent,
    [metrics.roomWidth, metrics.roomWallHeight, 0.14],
    [0, metrics.roomWallHeight / 2, metrics.backWallZ],
    "#ece6dc",
    { castShadow: false }
  );
  addBox(
    parent,
    [0.14, metrics.roomWallHeight, metrics.roomDepth],
    [-metrics.roomWidth / 2, metrics.roomWallHeight / 2, metrics.roomDepth / 2],
    "#e2dbd0",
    { castShadow: false }
  );
}

function addSchematicGrid(parent: THREE.Group, metrics: LayoutMetrics) {
  const surfaceDepth = Math.max(metrics.counterDepth, metrics.leftLength, metrics.rightLength, 8);
  const surfaceWidth = Math.max(metrics.mainWidth, metrics.islandWidth, 8);
  const size = Math.ceil(Math.max(surfaceDepth, surfaceWidth) / 2) * 2;
  const grid = new THREE.GridHelper(size, size, "#7d8c87", "#aeb8b3");
  grid.position.set(0, 0, Math.max(metrics.counterDepth, surfaceDepth / 2));
  grid.userData.geometryStatus = "measurement-grid-only";
  parent.add(grid);
}

function addStarterGrid(parent: THREE.Group) {
  const grid = new THREE.GridHelper(12, 12, "#7d8c87", "#aeb8b3");
  grid.position.set(0, 0, 4);
  grid.userData.geometryStatus = "starter-grid-only";
  parent.add(grid);
}

function addBacksplash(args: {
  parent: THREE.Group;
  records: StoneMaterialRecord[];
  design: CountertopPlannerDesign;
  metrics: LayoutMetrics;
  width: number;
  depth: number;
  x: number;
  z: number;
  rotationY?: number;
}) {
  if (args.design.backsplash === "None") return;
  const height =
    args.design.backsplash === "Full-height"
      ? args.metrics.roomWallHeight === null
        ? null
        : Math.max(0, args.metrics.roomWallHeight - args.metrics.surfaceTopY)
      : 4 / 12;
  if (height === null || height <= 0) return;
  const rotationY = args.rotationY ?? 0;
  const [x, z] = localToWorld(0, -args.depth / 2 - 0.05, args.x, args.z, rotationY);
  addStoneBox({
    parent: args.parent,
    records: args.records,
    target: "backsplash",
    size: [args.width, height, 0.08],
    position: [x, args.metrics.surfaceTopY + height / 2, z],
    mappingWidthFt: args.width,
    mappingHeightFt: height,
    rotationY,
  });
}

function addWaterfalls(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  design: CountertopPlannerDesign,
  metrics: LayoutMetrics
) {
  const topThickness = metrics.topThickness;
  if (
    !design.island ||
    design.waterfall === "None" ||
    metrics.islandX === null ||
    metrics.islandZ === null ||
    design.finishedTopHeightIn === null ||
    design.topThicknessIn === null ||
    topThickness === null
  ) {
    return;
  }
  for (const side of ["Left", "Right"] as const) {
    if (design.waterfall !== side && design.waterfall !== "Both") continue;
    const x =
      metrics.islandX + (side === "Left" ? -1 : 1) * (metrics.islandWidth / 2 - topThickness / 2);
    addStoneBox({
      parent,
      records,
      target: "island",
      size: [topThickness, metrics.surfaceTopY, metrics.islandDepth],
      position: [x, metrics.surfaceTopY / 2, metrics.islandZ],
      mappingWidthFt: metrics.islandDepth,
      mappingHeightFt: metrics.surfaceTopY,
    });
  }
}

function addConfiguredSurfaces(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  design: CountertopPlannerDesign,
  metrics: LayoutMetrics
) {
  addCounterRun({
    parent,
    records,
    design,
    target: "counter",
    run: "main",
    width: metrics.mainWidth,
    depth: metrics.counterDepth,
    x: 0,
    z: metrics.mainZ,
    surfaceTopY: metrics.surfaceTopY,
    topThickness: metrics.topThickness,
  });
  addBacksplash({
    parent,
    records,
    design,
    width: metrics.mainWidth,
    depth: metrics.counterDepth,
    x: 0,
    z: metrics.mainZ,
    metrics,
  });

  const leftVisibleLength = Math.max(0, metrics.leftLength - metrics.counterDepth);
  if (leftVisibleLength > 0.01) {
    const rotationY = Math.PI / 2;
    const x = -metrics.mainWidth / 2 + metrics.counterDepth / 2;
    const z = metrics.backWallZ + metrics.counterDepth + leftVisibleLength / 2;
    addCounterRun({
      parent,
      records,
      design,
      target: "counter",
      run: "left-return",
      width: leftVisibleLength,
      depth: metrics.counterDepth,
      x,
      z,
      rotationY,
      reverseStart: true,
      startOffsetFt: metrics.counterDepth,
      surfaceTopY: metrics.surfaceTopY,
      topThickness: metrics.topThickness,
    });
    addBacksplash({
      parent,
      records,
      design,
      width: leftVisibleLength,
      depth: metrics.counterDepth,
      x,
      z,
      rotationY,
      metrics,
    });
  }

  const rightVisibleLength = Math.max(0, metrics.rightLength - metrics.counterDepth);
  if (rightVisibleLength > 0.01) {
    const rotationY = -Math.PI / 2;
    const x = metrics.mainWidth / 2 - metrics.counterDepth / 2;
    const z = metrics.backWallZ + metrics.counterDepth + rightVisibleLength / 2;
    addCounterRun({
      parent,
      records,
      design,
      target: "counter",
      run: "right-return",
      width: rightVisibleLength,
      depth: metrics.counterDepth,
      x,
      z,
      rotationY,
      startOffsetFt: metrics.counterDepth,
      surfaceTopY: metrics.surfaceTopY,
      topThickness: metrics.topThickness,
    });
    addBacksplash({
      parent,
      records,
      design,
      width: rightVisibleLength,
      depth: metrics.counterDepth,
      x,
      z,
      rotationY,
      metrics,
    });
  }

  if (design.island && metrics.islandX !== null && metrics.islandZ !== null) {
    addCounterRun({
      parent,
      records,
      design,
      target: "island",
      run: "island",
      width: metrics.islandWidth,
      depth: metrics.islandDepth,
      x: metrics.islandX,
      z: metrics.islandZ,
      surfaceTopY: metrics.surfaceTopY,
      topThickness: metrics.topThickness,
    });
    addWaterfalls(parent, records, design, metrics);
  }
}

function buildScene(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  designInput: CountertopPlannerDesignInput
) {
  const design = resolveCountertopPlannerDesign(designInput);
  const metrics = getLayoutMetrics(design);
  if (!design.measurementsReviewed) {
    addStarterGrid(parent);
    return;
  }
  if (hasResolvedCountertopRoomShell(design)) {
    addRoomShell(parent, records, design.floorStone, metrics);
  } else {
    addSchematicGrid(parent, metrics);
  }
  addConfiguredSurfaces(parent, records, design, metrics);
}

function applyCamera(runtime: Runtime, design: CountertopPlannerDesignInput, force = false) {
  const key = `${runtime.revision}:${design.cameraPreset}`;
  if (!force && runtime.cameraKey === key) return;
  runtime.cameraKey = key;

  const bounds = new THREE.Box3().setFromObject(runtime.content);
  const center = bounds.isEmpty()
    ? new THREE.Vector3(0, 2.2, 0)
    : bounds.getCenter(new THREE.Vector3());
  const size = bounds.isEmpty()
    ? new THREE.Vector3(12, 9, 12)
    : bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, size.y * 1.25, 8);
  const distance = getStoneVisualizerCameraFitDistance({
    span,
    verticalFovDegrees: runtime.camera.fov,
    aspect: runtime.camera.aspect,
  });
  const detailDistance = distance * 0.72;
  const offsets: Record<CountertopPlannerDesign["cameraPreset"], THREE.Vector3> = {
    Perspective: new THREE.Vector3(distance * 0.68, distance * 0.46, distance * 0.78),
    Front: new THREE.Vector3(0, distance * 0.28, distance),
    Top: new THREE.Vector3(0.01, distance * 1.18, 0.01),
    Detail: new THREE.Vector3(detailDistance * 0.68, detailDistance * 0.34, detailDistance * 0.72),
  };
  const target = center.clone();
  target.y = Math.min(2.6, Math.max(1.4, center.y));
  runtime.controls.target.copy(target);
  runtime.camera.position.copy(target).add(offsets[design.cameraPreset]);
  runtime.camera.near = Math.max(0.05, distance / 200);
  runtime.camera.far = Math.max(100, distance * 8);
  runtime.camera.updateProjectionMatrix();
  runtime.controls.minDistance = Math.max(1.5, span * 0.16);
  runtime.controls.maxDistance = Math.max(30, distance * 3);
  runtime.controls.update();
  runtime.cameraDirty = false;
  runtime.renderOnce();
}

export function getStoneVisualizerCameraFitDistance(args: {
  span: number;
  verticalFovDegrees: number;
  aspect: number;
}): number {
  const verticalFieldOfView = THREE.MathUtils.degToRad(args.verticalFovDegrees);
  const horizontalFieldOfView =
    2 * Math.atan(Math.tan(verticalFieldOfView / 2) * Math.max(0.1, args.aspect));
  const limitingFieldOfView = Math.min(verticalFieldOfView, horizontalFieldOfView);
  return (Math.max(0.1, args.span) / (2 * Math.tan(limitingFieldOfView / 2))) * 1.18;
}

function configureTexture(
  texture: THREE.Texture,
  record: StoneMaterialRecord,
  design: CountertopPlannerDesignInput,
  dimensions: { widthIn: number; heightIn: number } | null,
  anisotropy: number,
  initialize: boolean
) {
  if (initialize) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
  }
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(design.veinRotation);
  const repeat = getStoneVisualizerTextureRepeat(record, design, dimensions);
  texture.repeat.set(repeat.x, repeat.y);
  texture.offset.set(design.textureOffsetX * 0.35, design.textureOffsetY * 0.35);
  texture.updateMatrix();
  if (initialize) texture.needsUpdate = true;
}

export function getStoneVisualizerTextureRepeat(
  record: Pick<StoneMaterialRecord, "widthFt" | "heightFt">,
  design: Pick<CountertopPlannerDesign, "textureScale" | "veinRotation">,
  dimensions: { widthIn: number; heightIn: number } | null
): { x: number; y: number } {
  if (!dimensions) {
    const repeat = Math.max(0.08, 1 / design.textureScale);
    return { x: repeat, y: repeat };
  }
  const quarterTurn = design.veinRotation === 90 || design.veinRotation === 270;
  const surfaceWidthFt = quarterTurn ? record.heightFt : record.widthFt;
  const surfaceHeightFt = quarterTurn ? record.widthFt : record.heightFt;
  return {
    x: Math.max(0.08, surfaceWidthFt / (dimensions.widthIn / 12) / design.textureScale),
    y: Math.max(0.08, surfaceHeightFt / (dimensions.heightIn / 12) / design.textureScale),
  };
}

function applyTextureToRecord(
  record: StoneMaterialRecord,
  source: THREE.Texture,
  sourceKey: string,
  design: CountertopPlannerDesignInput,
  dimensions: { widthIn: number; heightIn: number } | null,
  anisotropy: number
): THREE.Texture {
  const existing = record.material.map;
  const canReuse = existing?.userData.stoneSourceKey === sourceKey;
  const texture = canReuse ? existing : source.clone();
  configureTexture(texture, record, design, dimensions, anisotropy, !canReuse);
  if (!canReuse) {
    existing?.dispose();
    texture.userData.stoneSourceKey = sourceKey;
    record.material.map = texture;
    record.material.needsUpdate = true;
  }
  record.material.color.set("#ffffff");
  return texture;
}

function applyTextureToRecords(
  runtime: Runtime,
  source: THREE.Texture,
  design: CountertopPlannerDesignInput,
  dimensions: { widthIn: number; heightIn: number } | null
) {
  const anisotropy = Math.min(8, runtime.renderer.capabilities.getMaxAnisotropy());
  for (const record of runtime.records) {
    applyTextureToRecord(record, source, runtime.sourceTextureKey, design, dimensions, anisotropy);
  }
  runtime.renderOnce();
}

/** Texture seam for proving transform-only updates preserve GPU-facing texture identity. */
export function applyStoneVisualizerTextureForTests(args: {
  source: THREE.Texture;
  sourceKey: string;
  record: StoneMaterialRecord;
  design: CountertopPlannerDesignInput;
  dimensions: { widthIn: number; heightIn: number } | null;
  anisotropy: number;
}) {
  return applyTextureToRecord(
    args.record,
    args.source,
    args.sourceKey,
    args.design,
    args.dimensions,
    args.anisotropy
  );
}

function clearTextureFromRecords(runtime: Runtime) {
  for (const record of runtime.records) {
    record.material.map?.dispose();
    record.material.map = null;
    record.material.color.set("#c8b7a6");
    record.material.needsUpdate = true;
  }
  runtime.renderOnce();
}

export default function StoneVisualizer3D({ design, selectedTarget, onSelectTarget }: Props) {
  const plannerDesign = useMemo(() => resolveCountertopPlannerDesign(design), [design]);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const designRef = useRef(plannerDesign);
  const onSelectRef = useRef(onSelectTarget);
  const rendererRetryRef = useRef<HTMLButtonElement>(null);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [textureAttempt, setTextureAttempt] = useState(0);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [sourceTextureRevision, setSourceTextureRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textureFailed, setTextureFailed] = useState(false);
  const [textureStatus, setTextureStatus] = useState("Loading the selected inventory photo…");
  const stone = getCatalogItemById(plannerDesign.stoneId);
  const selectedImage = stone?.images[plannerDesign.textureImageIndex] ?? null;
  const textureImageHref = stone
    ? buildNamedStoneDesignerImageHref(stone.shareSlug || "", selectedImage || "") ||
      buildStoneDesignerImageHref(stone.id, plannerDesign.textureImageIndex)
    : "";
  const openingSchedule = getCountertopPlannerOpeningSchedule(plannerDesign);
  const unplacedOpeningCount = openingSchedule.filter(
    (item) =>
      !item.run ||
      item.positionIn === null ||
      (item.requiresFrontPosition && item.frontPositionIn === null)
  ).length;
  const coordinationPointCount = openingSchedule.filter(
    (item) => item.representation === "coordination-point"
  ).length;
  const sceneDiagnostics = getCountertopPlannerDiagnostics(plannerDesign).filter(
    (item) => item.scope === "scene"
  );
  const measuredScene = sceneDiagnostics.length === 0;
  const starterScene = !plannerDesign.measurementsReviewed;

  const geometryDesign = useMemo(
    () => plannerDesign,
    [
      plannerDesign.room,
      plannerDesign.layout,
      plannerDesign.wallAIn,
      plannerDesign.wallBIn,
      plannerDesign.wallCIn,
      plannerDesign.wallDepthIn,
      plannerDesign.island,
      plannerDesign.islandLengthIn,
      plannerDesign.islandWidthIn,
      plannerDesign.floorStone,
      plannerDesign.showSeams,
      plannerDesign.waterfall,
      plannerDesign.edge,
      plannerDesign.backsplash,
      plannerDesign.sink,
      plannerDesign.sinkRun,
      plannerDesign.sinkPositionIn,
      plannerDesign.sinkFrontPositionIn,
      plannerDesign.cooktop,
      plannerDesign.cooktopRun,
      plannerDesign.cooktopPositionIn,
      plannerDesign.cooktopFrontPositionIn,
      plannerDesign.otherCutouts,
      plannerDesign.measurementsReviewed,
      plannerDesign.roomWidthIn,
      plannerDesign.roomDepthIn,
      plannerDesign.roomWallHeightIn,
      plannerDesign.finishedTopHeightIn,
      plannerDesign.topThicknessIn,
      plannerDesign.islandLeftOffsetIn,
      plannerDesign.islandBackOffsetIn,
      plannerDesign.sinkTemplateWidthIn,
      plannerDesign.sinkTemplateDepthIn,
      plannerDesign.cooktopTemplateWidthIn,
      plannerDesign.cooktopTemplateDepthIn,
    ]
  );
  const textureSourceKey = textureImageHref;
  const textureMappingKey = `${plannerDesign.textureOffsetX}:${plannerDesign.textureOffsetY}:${plannerDesign.textureScale}:${plannerDesign.veinRotation}`;

  designRef.current = plannerDesign;

  useEffect(() => {
    onSelectRef.current = onSelectTarget;
  }, [onSelectTarget]);

  useEffect(() => {
    if (error) rendererRetryRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    setError(null);
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
      setError(
        "Automated DOM checks do not provide WebGL. This is a catalog-photo recovery view, not a rendered measured scene."
      );
      return;
    }

    let runtime: Runtime | null = null;
    let animationFrame = 0;
    let controlsActive = false;
    let settleFrames = 0;
    let provisionalRenderer: THREE.WebGLRenderer | null = null;
    let provisionalControls: OrbitControls | null = null;
    let provisionalResizeObserver: ResizeObserver | null = null;
    let cleanupRuntime: (() => void) | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      provisionalRenderer = renderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;

      const scene = new THREE.Scene();
      scene.background = ROOM_BACKGROUND;
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
      const controls = new OrbitControls(camera, canvas);
      provisionalControls = controls;
      // OrbitControls defaults to `touch-action: none`; preserve vertical page scrolling on mobile.
      canvas.style.touchAction = "pan-y";
      controls.enableDamping = !reducedMotion.matches;
      controls.dampingFactor = 0.065;
      controls.maxPolarAngle = Math.PI / 2.02;
      controls.screenSpacePanning = true;

      const content = new THREE.Group();
      scene.add(content);
      scene.add(new THREE.HemisphereLight("#fff5e7", "#5f665f", 2.1));
      const sun = new THREE.DirectionalLight("#fff1d4", 3.5);
      sun.position.set(12, 22, 15);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -45;
      sun.shadow.camera.right = 45;
      sun.shadow.camera.top = 45;
      sun.shadow.camera.bottom = -45;
      scene.add(sun);
      const fill = new THREE.PointLight("#d8edff", 1.4, 70);
      fill.position.set(-12, 10, 10);
      scene.add(fill);

      const renderOnce = () => {
        if (!runtime?.visible || document.visibilityState === "hidden") return;
        renderer.render(scene, camera);
      };
      const stopAnimation = () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      };
      const animate = () => {
        animationFrame = 0;
        if (!runtime?.visible || document.visibilityState === "hidden" || reducedMotion.matches) {
          renderOnce();
          return;
        }
        controls.update();
        renderOnce();
        if (controlsActive || settleFrames > 0) {
          settleFrames = Math.max(0, settleFrames - 1);
          animationFrame = requestAnimationFrame(animate);
        }
      };
      const startAnimation = () => {
        if (runtime) runtime.cameraDirty = true;
        controlsActive = true;
        if (reducedMotion.matches) {
          renderOnce();
          return;
        }
        if (!animationFrame) animationFrame = requestAnimationFrame(animate);
      };
      const finishAnimation = () => {
        controlsActive = false;
        settleFrames = reducedMotion.matches ? 0 : 10;
        if (reducedMotion.matches) renderOnce();
        else if (!animationFrame) animationFrame = requestAnimationFrame(animate);
      };

      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (runtime && !runtime.cameraDirty && runtime.content.children.length) {
          applyCamera(runtime, designRef.current, true);
        } else {
          renderOnce();
        }
      };
      const resizeObserver = new ResizeObserver(resize);
      provisionalResizeObserver = resizeObserver;
      resizeObserver.observe(host);

      runtime = {
        scene,
        camera,
        renderer,
        controls,
        content,
        resizeObserver,
        intersectionObserver: null,
        revision: 0,
        cameraKey: "",
        cameraDirty: false,
        records: [],
        sourceTexture: null,
        sourceTextureKey: "",
        renderOnce,
        visible: true,
      };
      runtimeRef.current = runtime;
      resize();

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerStart: [number, number] | null = null;
      const onPointerDown = (event: PointerEvent) => {
        pointerStart = [event.clientX, event.clientY];
      };
      const onPointerUp = (event: PointerEvent) => {
        if (
          !pointerStart ||
          Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 7
        ) {
          pointerStart = null;
          return;
        }
        pointerStart = null;
        const bounds = canvas.getBoundingClientRect();
        pointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1
        );
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(content.children, true).find((intersection) => {
          let current: THREE.Object3D | null = intersection.object;
          while (current) {
            if (current.userData.surfaceTarget) return true;
            current = current.parent;
          }
          return false;
        });
        if (!hit) return;
        let current: THREE.Object3D | null = hit.object;
        while (current && !current.userData.surfaceTarget) current = current.parent;
        const target = current?.userData.surfaceTarget as StoneSurfaceTarget | undefined;
        if (target) onSelectRef.current(target);
      };
      const onContextLost = (event: Event) => {
        event.preventDefault();
        stopAnimation();
        setError("The 3D context was lost. Retry the room to create a fresh rendering context.");
      };
      const onControlsChange = () => {
        if (reducedMotion.matches) renderOnce();
      };
      const onMotionChange = () => {
        controls.enableDamping = !reducedMotion.matches;
        if (reducedMotion.matches) {
          settleFrames = 0;
          stopAnimation();
        }
        renderOnce();
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") stopAnimation();
        else renderOnce();
      };

      let cleaned = false;
      cleanupRuntime = () => {
        if (cleaned) return;
        cleaned = true;
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        controls.removeEventListener("start", startAnimation);
        controls.removeEventListener("end", finishAnimation);
        controls.removeEventListener("change", onControlsChange);
        if (typeof reducedMotion.removeEventListener === "function") {
          reducedMotion.removeEventListener("change", onMotionChange);
        } else if (typeof reducedMotion.removeListener === "function") {
          reducedMotion.removeListener(onMotionChange);
        }
        document.removeEventListener("visibilitychange", onVisibilityChange);
        stopAnimation();
        provisionalResizeObserver?.disconnect();
        runtime?.intersectionObserver?.disconnect();
        provisionalControls?.dispose();
        if (runtime) {
          clearGroup(runtime.content);
          runtime.sourceTexture?.dispose();
        }
        provisionalRenderer?.dispose();
        provisionalRenderer?.forceContextLoss();
        canvas.style.touchAction = "";
        if (runtimeRef.current === runtime) runtimeRef.current = null;
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("webglcontextlost", onContextLost);
      controls.addEventListener("start", startAnimation);
      controls.addEventListener("end", finishAnimation);
      controls.addEventListener("change", onControlsChange);
      if (typeof reducedMotion.addEventListener === "function") {
        reducedMotion.addEventListener("change", onMotionChange);
      } else if (typeof reducedMotion.addListener === "function") {
        reducedMotion.addListener(onMotionChange);
      }
      document.addEventListener("visibilitychange", onVisibilityChange);

      if ("IntersectionObserver" in window) {
        runtime.intersectionObserver = new IntersectionObserver(
          ([entry]) => {
            if (!runtime) return;
            runtime.visible = Boolean(entry?.isIntersecting);
            if (!runtime.visible) stopAnimation();
            else renderOnce();
          },
          { rootMargin: "120px" }
        );
        runtime.intersectionObserver.observe(host);
      }

      return cleanupRuntime;
    } catch {
      if (cleanupRuntime) cleanupRuntime();
      else {
        provisionalResizeObserver?.disconnect();
        provisionalControls?.dispose();
        provisionalRenderer?.dispose();
        provisionalRenderer?.forceContextLoss();
        canvas.style.touchAction = "";
        runtimeRef.current = null;
      }
      setError(
        "This browser could not start the 3D scene. The image below is a catalog photo, not a 3D preview."
      );
      return undefined;
    }
  }, [rendererAttempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.revision += 1;
    clearGroup(runtime.content);
    runtime.records = [];
    buildScene(runtime.content, runtime.records, geometryDesign);
    applyCamera(runtime, geometryDesign, true);
    setSceneRevision((value) => value + 1);
  }, [geometryDesign, rendererAttempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    for (const record of runtime.records) {
      const selected = record.target === selectedTarget;
      record.material.emissive.set(selected ? "#7f2f18" : "#000000");
      record.material.emissiveIntensity = selected ? 0.13 : 0;
    }
    runtime.renderOnce();
  }, [sceneRevision, selectedTarget]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    applyCamera(runtime, plannerDesign);
  }, [plannerDesign.cameraPreset, sceneRevision]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    let cancelled = false;
    setTextureFailed(false);
    if (!stone || !selectedImage || !textureImageHref) {
      runtime.sourceTexture?.dispose();
      runtime.sourceTexture = null;
      runtime.sourceTextureKey = "";
      clearTextureFromRecords(runtime);
      setTextureStatus(
        "The selected catalog photo is unavailable. Choose another JW Stone surface or photo."
      );
      return;
    }

    const dimensions = isHandScaleCoverImage(selectedImage)
      ? null
      : resolveSlabDimensionForInventoryImage(selectedImage);
    const successStatus = dimensions
      ? `Using this photo's recorded ${dimensions.widthIn}×${dimensions.heightIn}-inch source dimensions as a planning scale.`
      : "Scale unverified for this photo — crop and direction are visual only until slab dimensions are confirmed.";
    if (runtime.sourceTexture && runtime.sourceTextureKey === textureSourceKey) {
      setTextureStatus(successStatus);
      return;
    }

    runtime.sourceTexture?.dispose();
    runtime.sourceTexture = null;
    runtime.sourceTextureKey = textureSourceKey;
    clearTextureFromRecords(runtime);
    setTextureStatus("Loading the exact selected inventory photo…");
    const loadTimeout = window.setTimeout(() => {
      if (
        cancelled ||
        runtimeRef.current !== runtime ||
        runtime.sourceTextureKey !== textureSourceKey
      ) {
        return;
      }
      setTextureFailed(true);
      setTextureStatus(
        "The selected inventory photo is taking too long to load. Solid surfaces are shown; retry the photo."
      );
    }, STONE_TEXTURE_LOAD_TIMEOUT_MS);
    new THREE.TextureLoader().load(
      textureImageHref,
      (source) => {
        window.clearTimeout(loadTimeout);
        if (
          cancelled ||
          runtimeRef.current !== runtime ||
          runtime.sourceTextureKey !== textureSourceKey
        ) {
          source.dispose();
          return;
        }
        runtime.sourceTexture = source;
        setTextureFailed(false);
        setTextureStatus(successStatus);
        setSourceTextureRevision((value) => value + 1);
      },
      undefined,
      () => {
        window.clearTimeout(loadTimeout);
        if (cancelled || runtimeRef.current !== runtime) return;
        setTextureFailed(true);
        setTextureStatus(
          "The selected inventory photo could not load. Solid surfaces are shown as a recovery view."
        );
      }
    );
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
    };
  }, [rendererAttempt, selectedImage, stone, textureAttempt, textureImageHref, textureSourceKey]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (
      !runtime?.sourceTexture ||
      runtime.sourceTextureKey !== textureSourceKey ||
      !selectedImage
    ) {
      return;
    }
    const dimensions = isHandScaleCoverImage(selectedImage)
      ? null
      : resolveSlabDimensionForInventoryImage(selectedImage);
    applyTextureToRecords(runtime, runtime.sourceTexture, plannerDesign, dimensions);
  }, [sceneRevision, selectedImage, sourceTextureRevision, textureMappingKey, textureSourceKey]);

  const orbit = (direction: -1 | 1) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.cameraDirty = true;
    const offset = runtime.camera.position.clone().sub(runtime.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += direction * 0.24;
    runtime.camera.position
      .copy(runtime.controls.target)
      .add(new THREE.Vector3().setFromSpherical(spherical));
    runtime.controls.update();
    runtime.renderOnce();
  };

  const zoom = (factor: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.cameraDirty = true;
    const offset = runtime.camera.position.clone().sub(runtime.controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * factor,
      runtime.controls.minDistance,
      runtime.controls.maxDistance
    );
    offset.setLength(distance);
    runtime.camera.position.copy(runtime.controls.target).add(offset);
    runtime.controls.update();
    runtime.renderOnce();
  };

  const resetView = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    applyCamera(runtime, plannerDesign, true);
  };

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-[24rem] overflow-hidden rounded-[1.4rem] bg-[#d8d0c2] sm:min-h-[26rem]"
      data-testid="steel-home-countertop-3d-visualizer"
    >
      {error ? (
        <div
          className="absolute inset-0 z-20 grid place-items-center bg-[#1b2423] p-5 text-center text-white"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md">
            {stone && textureImageHref ? (
              <img
                src={textureImageHref}
                alt={`${stone.publicLabel} catalog photo`}
                className="mx-auto aspect-[4/3] w-full rounded-2xl object-contain"
              />
            ) : null}
            <p className="mt-4 text-sm font-black">3D scene unavailable</p>
            <p className="mt-2 text-xs leading-5 text-white/70">{error}</p>
            <button
              ref={rendererRetryRef}
              type="button"
              onClick={() => {
                setError(null);
                setRendererAttempt((value) => value + 1);
              }}
              className="mt-4 rounded-full bg-[#f0b392] px-4 py-2 text-xs font-black text-[#18312f]"
            >
              Retry 3D scene
            </button>
          </div>
        </div>
      ) : null}
      <canvas
        key={rendererAttempt}
        ref={canvasRef}
        className="block h-full w-full touch-pan-y"
        aria-hidden={error ? true : undefined}
        aria-label={`Interactive 3D ${starterScene ? "countertop starter" : `${plannerDesign.room.toLowerCase()} countertop scene`} using ${stone?.publicLabel || "no selected stone"}. ${starterScene ? "Starter grid only; legacy run values are not shown until they are reviewed." : measuredScene ? "Room and vertical geometry use entered measurements." : `${sceneDiagnostics.length} scene measurements remain unresolved; unresolved geometry is schematic or hidden.`} Drag sideways to orbit, use two fingers or the wheel to zoom, and tap a modeled surface to edit it. One-finger vertical swipes scroll the page.`}
      />
      {!error ? (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
            <div className="rounded-xl bg-[#101817]/88 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                {starterScene
                  ? "Starter grid · measurements unreviewed"
                  : `${measuredScene ? "Measured 3D scene" : "Schematic 3D plan"} · ${plannerDesign.room}`}
              </p>
              <p className="mt-1 hidden text-xs font-semibold text-white/72 sm:block">
                {starterScene
                  ? "Review the surface run values to show countertop geometry"
                  : measuredScene
                    ? "Drag to orbit · wheel or pinch to zoom · tap a surface"
                    : `${sceneDiagnostics.length} measurements unresolved · no room or island is invented`}
              </p>
            </div>
            <div className="rounded-full bg-[#f7f2e9]/94 px-3 py-2 text-[0.65rem] font-black capitalize text-[#18312f] shadow-lg">
              Selected {selectedTarget}
            </div>
          </div>
          <div
            className="absolute bottom-[4.25rem] left-3 z-10 flex flex-wrap gap-1.5"
            aria-label="3D view controls"
          >
            <button
              type="button"
              onClick={() => orbit(-1)}
              className="rounded-full bg-[#f7f2e9]/95 px-3 py-2 text-xs font-black text-[#18312f] shadow"
              aria-label="Orbit view left"
              title="Orbit left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => orbit(1)}
              className="rounded-full bg-[#f7f2e9]/95 px-3 py-2 text-xs font-black text-[#18312f] shadow"
              aria-label="Orbit view right"
              title="Orbit right"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => zoom(0.82)}
              className="rounded-full bg-[#f7f2e9]/95 px-3 py-2 text-xs font-black text-[#18312f] shadow"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoom(1.22)}
              className="rounded-full bg-[#f7f2e9]/95 px-3 py-2 text-xs font-black text-[#18312f] shadow"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-full bg-[#18312f]/95 px-3 py-2 text-[0.68rem] font-black text-white shadow"
            >
              Reset view
            </button>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-[#101817]/88 px-3 py-2 text-white backdrop-blur-sm">
            <p
              className="min-w-0 flex-1 text-[0.66rem] font-semibold leading-5 text-white/78"
              role="status"
            >
              {textureStatus}
              {unplacedOpeningCount
                ? ` ${unplacedOpeningCount} incomplete opening${unplacedOpeningCount === 1 ? " is" : "s are"} not shown in 3D.`
                : ""}
              {coordinationPointCount
                ? ` ${coordinationPointCount} ${coordinationPointCount === 1 ? "fixture is a non-dimensional coordination point" : "fixtures are non-dimensional coordination points"} until template sizes are entered.`
                : ""}
            </p>
            {textureFailed ? (
              <button
                type="button"
                onClick={() => setTextureAttempt((value) => value + 1)}
                className="shrink-0 rounded-full bg-[#f0b392] px-3 py-1.5 text-[0.64rem] font-black text-[#18312f]"
              >
                Retry photo
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      <div className="sr-only">
        <p>
          {starterScene
            ? "The canvas is a starter grid only because the saved numeric run values have not been reviewed."
            : "The canvas contains only entered countertop, room-shell, and opening geometry."}{" "}
          It does not invent cabinets, fixtures, furniture, fireplaces, doors, or windows.
        </p>
        <ul>
          <li>Countertop surface: {stone?.publicLabel || "not selected"}</li>
          <li>Island: {plannerDesign.island ? "included" : "not included"}</li>
          <li>Backsplash: {plannerDesign.backsplash}</li>
          <li>Floor stone: {plannerDesign.floorStone ? "included" : "not included"}</li>
          <li>Sink: {plannerDesign.sink}</li>
          <li>Cooktop: {plannerDesign.cooktop}</li>
          <li>Other openings: {plannerDesign.otherCutouts.length}</li>
          <li>Planning seams: {plannerDesign.showSeams ? "shown" : "not shown"}</li>
          {sceneDiagnostics.map((diagnostic) => (
            <li key={diagnostic.id}>Unresolved: {diagnostic.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
