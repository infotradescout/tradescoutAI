import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { isHandScaleCoverImage } from "@/features/jw-stone/coverImages";
import { resolveSlabDimensionForInventoryImage } from "@/features/jw-stone/slabDimensions";
import {
  getCountertopActiveRoomDesign,
  getCountertopOpeningSchedule,
  isCountertopBathroomRoom,
  type CountertopCutoutRun,
  type SteelHomeCountertopDesign,
} from "./projectModel";
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerImageHref,
} from "./stoneDesignerImages";

export type StoneSurfaceTarget = "counter" | "island" | "backsplash" | "floor";

type Props = {
  design: SteelHomeCountertopDesign;
  selectedTarget: StoneSurfaceTarget;
  onSelectTarget: (target: StoneSurfaceTarget) => void;
};

type StoneMaterialRecord = {
  material: THREE.MeshStandardMaterial;
  widthFt: number;
  heightFt: number;
  target: StoneSurfaceTarget;
  slabRun?: CountertopCutoutRun;
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

type SurfaceRect = {
  left: number;
  right: number;
  back: number;
  front: number;
};

type LayoutMetrics = {
  roomWidth: number;
  roomDepth: number;
  backWallZ: number;
  mainWidth: number;
  counterDepth: number;
  mainZ: number;
  leftLength: number;
  rightLength: number;
  islandWidth: number;
  islandDepth: number;
  islandZ: number;
};

const ROOM_BACKGROUND = new THREE.Color("#d8d0c2");
const CABINET_COLOR = "#7b624a";
const METAL = "#3c4444";
const SURFACE_TOP_Y = 3.03;
const BATHROOM_SURFACE_TOP_Y = 2.92;
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

function addCylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  position: [number, number, number],
  color: THREE.ColorRepresentation,
  options: { rotationZ?: number; metalness?: number; roughness?: number } = {}
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.65,
    roughness: options.roughness ?? 0.24,
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 18), material);
  mesh.position.set(...position);
  mesh.rotation.z = options.rotationZ ?? 0;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addRoundedBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: THREE.ColorRepresentation,
  options: {
    radius?: number;
    smoothness?: number;
    roughness?: number;
    metalness?: number;
    castShadow?: boolean;
  } = {}
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0,
  });
  const geometry = new RoundedBoxGeometry(
    size[0],
    size[1],
    size[2],
    options.smoothness ?? 4,
    Math.min(options.radius ?? 0.08, Math.min(...size) / 2)
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addContactShadow(
  parent: THREE.Object3D,
  size: [number, number],
  position: [number, number, number],
  opacity = 0.14
) {
  const material = new THREE.MeshBasicMaterial({
    color: "#382d25",
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(...position);
  shadow.name = "bathroom-contact-shadow";
  parent.add(shadow);
  return shadow;
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
  slabRun?: CountertopCutoutRun;
}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#c8b7a6",
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.2,
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
    slabRun: args.slabRun,
  });
  return mesh;
}

function createStoneMaterial(target: StoneSurfaceTarget): THREE.MeshStandardMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#c8b7a6",
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.2,
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
  centerZ: number;
  surfaceWidth: number;
  surfaceDepth: number;
  surfaceTopY?: number;
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
  mesh.position.set(args.centerX, args.surfaceTopY ?? SURFACE_TOP_Y, args.centerZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.surfaceTarget = args.target;
  args.parent.add(mesh);
  return mesh;
}

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter(
    (value, index) => index === 0 || Math.abs(value - sorted[index - 1]) > 0.001
  );
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
  design: SteelHomeCountertopDesign,
  run: CountertopCutoutRun,
  width: number,
  depth: number,
  reverseStart = false,
  startOffsetFt = 0
): RunCut[] {
  return getCountertopOpeningSchedule(design).flatMap((item) => {
    if (item.run !== run || item.positionIn === null) return [];
    if (item.requiresFrontPosition && (item.frontPositionIn === null || !item.depthIn)) return [];
    if (item.id !== "sink" && item.id !== "cooktop" && (!item.widthIn || !item.depthIn)) return [];

    const requestedWidth = Math.max(0.08, (item.widthIn ?? item.planningWidthIn) / 12);
    const fullDepth = item.placementKind === "full-depth-gap";
    const frontEdge = item.placementKind === "front-edge-opening";
    const requestedDepth = fullDepth
      ? depth
      : frontEdge
        ? Math.max(0.8, depth * 0.68)
        : Math.max(0.08, item.depthIn! / 12);
    const positionAlongVisibleRun = item.positionIn / 12 - startOffsetFt;
    const requestedCenterX = reverseStart
      ? width / 2 - positionAlongVisibleRun
      : -width / 2 + positionAlongVisibleRun;
    const requestedCenterZ = fullDepth
      ? 0
      : frontEdge
        ? depth / 2 - requestedDepth / 2
        : depth / 2 - item.frontPositionIn! / 12;

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
  edge: SteelHomeCountertopDesign["edge"]
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
  design: SteelHomeCountertopDesign;
  target: "counter" | "island";
  run: CountertopCutoutRun;
  width: number;
  depth: number;
  x: number;
  z: number;
  rotationY?: number;
  reverseStart?: boolean;
  startOffsetFt?: number;
  cabinetry?: "kitchen" | "bathroom";
  surfaceTopY?: number;
}) {
  const cabinetry = args.cabinetry ?? "kitchen";
  const surfaceTopY = args.surfaceTopY ?? SURFACE_TOP_Y;
  const group = new THREE.Group();
  group.name = cabinetry === "bathroom" ? "bathroom-wall-vanity" : "kitchen-counter-run";
  group.position.set(args.x, 0, args.z);
  group.rotation.y = args.rotationY ?? 0;
  group.userData.surfaceTarget = args.target;
  args.parent.add(group);

  const thickness = args.design.edge === "Mitered" ? 0.25 : 0.14;
  const cuts = getRunCuts(
    args.design,
    args.run,
    args.width,
    args.depth,
    args.reverseStart,
    args.startOffsetFt
  );
  const runMaterial = createStoneMaterial(args.target);
  args.records.push({
    material: runMaterial,
    widthFt: args.width,
    heightFt: args.depth,
    target: args.target,
    slabRun: args.run,
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
      centerZ: (piece.back + piece.front) / 2,
      surfaceWidth: args.width,
      surfaceDepth: args.depth,
      surfaceTopY,
    });
  }

  for (const cut of cuts) {
    if (cut.fullDepth) continue;
    const wellDepth = cut.kind === "sink" ? 0.48 : cut.kind === "cooktop" ? 0.11 : 0.08;
    const well = addBox(
      group,
      [Math.max(0.05, cut.widthFt * 0.92), wellDepth, Math.max(0.05, cut.depthFt * 0.9)],
      [cut.centerXFt, surfaceTopY - thickness / 2 - wellDepth / 2 - 0.015, cut.centerZFt],
      cut.kind === "sink" ? "#303a3b" : cut.kind === "cooktop" ? "#151919" : "#343735",
      { roughness: 0.22, metalness: cut.kind === "sink" ? 0.65 : 0.25 }
    );
    well.userData.surfaceTarget = args.target;
    well.name =
      cabinetry === "bathroom" && cut.kind === "sink"
        ? "bathroom-basin-recess"
        : `${cut.kind}-opening-well`;
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
    if (start > edgeCursor) {
      addCounterEdgeSegment(
        group,
        start - edgeCursor,
        args.depth,
        (start + edgeCursor) / 2,
        surfaceTopY - thickness / 2,
        args.design.edge
      );
    }
    edgeCursor = Math.max(edgeCursor, end);
  }
  if (edgeCursor < args.width / 2) {
    addCounterEdgeSegment(
      group,
      args.width / 2 - edgeCursor,
      args.depth,
      (args.width / 2 + edgeCursor) / 2,
      surfaceTopY - thickness / 2,
      args.design.edge
    );
  }

  const fullDepthCuts = cuts.filter((cut) => cut.fullDepth);
  const cabinetBounds = uniqueSorted([
    -args.width / 2,
    args.width / 2,
    ...fullDepthCuts.flatMap((cut) => [
      cut.centerXFt - cut.widthFt / 2,
      cut.centerXFt + cut.widthFt / 2,
    ]),
  ]);
  for (let index = 0; index < cabinetBounds.length - 1; index += 1) {
    const left = cabinetBounds[index];
    const right = cabinetBounds[index + 1];
    const center = (left + right) / 2;
    const excluded = fullDepthCuts.some(
      (cut) => Math.abs(center - cut.centerXFt) < cut.widthFt / 2 - 0.001
    );
    if (!excluded && right - left > 0.04) {
      if (cabinetry === "bathroom") {
        const cabinetWidth = (right - left) * 0.94;
        const cabinetHeight = Math.max(1.7, surfaceTopY - 0.76);
        const frontZ = args.depth * 0.38;
        const moduleCount = Math.max(1, Math.ceil(cabinetWidth / 2.5));
        const moduleWidth = cabinetWidth / moduleCount;
        for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex += 1) {
          const moduleX = center - cabinetWidth / 2 + moduleWidth * (moduleIndex + 0.5);
          addRoundedBox(
            group,
            [moduleWidth - 0.06, cabinetHeight, args.depth * 0.74],
            [moduleX, 0.6 + cabinetHeight / 2, -args.depth * 0.07],
            "#9a7657",
            { radius: 0.045, smoothness: 3, roughness: 0.48 }
          ).name = "bathroom-vanity-cabinet";
          addRoundedBox(
            group,
            [moduleWidth * 0.88, 0.48, 0.055],
            [moduleX, surfaceTopY - 0.61, frontZ],
            "#ad8968",
            { radius: 0.035, smoothness: 3, roughness: 0.45 }
          ).name = "bathroom-vanity-drawer-front";
          const doorCount = moduleWidth > 1.55 ? 2 : 1;
          for (let doorIndex = 0; doorIndex < doorCount; doorIndex += 1) {
            const doorWidth = (moduleWidth * 0.86) / doorCount;
            const doorX = moduleX - (moduleWidth * 0.86) / 2 + doorWidth * (doorIndex + 0.5);
            addRoundedBox(
              group,
              [doorWidth - 0.045, cabinetHeight - 0.72, 0.055],
              [doorX, 0.76 + (cabinetHeight - 0.72) / 2, frontZ],
              "#a37e5e",
              { radius: 0.03, smoothness: 3, roughness: 0.5 }
            ).name = "bathroom-vanity-door-front";
            addCylinder(group, 0.025, 0.22, [doorX, 1.54, frontZ + 0.06], "#b99b6b", {
              rotationZ: Math.PI / 2,
              metalness: 0.7,
              roughness: 0.2,
            }).name = "bathroom-vanity-door-pull";
          }
          addCylinder(
            group,
            0.025,
            Math.min(0.48, moduleWidth * 0.32),
            [moduleX, surfaceTopY - 0.61, frontZ + 0.06],
            "#b99b6b",
            { rotationZ: Math.PI / 2, metalness: 0.7, roughness: 0.2 }
          ).name = "bathroom-vanity-drawer-pull";
        }
        addContactShadow(
          group,
          [cabinetWidth * 0.9, args.depth * 0.6],
          [center, 0.008, -args.depth * 0.05],
          0.16
        );
      } else {
        const cabinet = addBox(
          group,
          [(right - left) * 0.96, 2.75, args.depth * 0.9],
          [center, 1.58, -0.02],
          CABINET_COLOR
        );
        cabinet.name = "kitchen-base-cabinet";
      }
    }
  }

  if (args.design.showSeams) {
    const seamX = cuts.some((cut) => Math.abs(cut.centerXFt) < cut.widthFt / 2 + 0.02)
      ? args.width * 0.24
      : 0;
    addBox(
      group,
      [0.025, 0.012, args.depth],
      [seamX, surfaceTopY + thickness / 2 + 0.008, 0],
      "#403a36",
      { roughness: 0.9 }
    );
  }
  if (cabinetry === "bathroom") {
    for (const cut of cuts.filter((item) => item.kind === "sink" && !item.fullDepth)) {
      const bowlCount = args.design.sink === "Double-bowl undermount" ? 2 : 1;
      const bowlWidth = Math.min(cut.widthFt * 0.78, bowlCount === 2 ? 1.05 : 2.2);
      for (let bowlIndex = 0; bowlIndex < bowlCount; bowlIndex += 1) {
        const bowlX =
          cut.centerXFt + (bowlCount === 2 ? (bowlIndex === 0 ? -1 : 1) * cut.widthFt * 0.22 : 0);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(1, 0.065, 10, 36),
          new THREE.MeshStandardMaterial({ color: "#f4f1e9", roughness: 0.2 })
        );
        rim.rotation.x = Math.PI / 2;
        rim.scale.set(bowlWidth / 2, Math.min(cut.depthFt * 0.38, 0.68), 1);
        rim.position.set(bowlX, surfaceTopY + 0.075, cut.centerZFt);
        rim.castShadow = true;
        rim.name = "bathroom-rounded-basin-rim";
        group.add(rim);
        const basin = new THREE.Mesh(
          new THREE.SphereGeometry(1, 28, 16),
          new THREE.MeshStandardMaterial({ color: "#e8ece9", roughness: 0.16 })
        );
        basin.scale.set(bowlWidth * 0.42, 0.12, Math.min(cut.depthFt * 0.34, 0.58));
        basin.position.set(bowlX, surfaceTopY - 0.11, cut.centerZFt);
        basin.name = "bathroom-soft-basin";
        group.add(basin);
      }
      const faucetZ = Math.max(-args.depth / 2 + 0.1, cut.centerZFt - cut.depthFt / 2 - 0.16);
      addCylinder(
        group,
        0.055,
        0.62,
        [cut.centerXFt, surfaceTopY + 0.31, faucetZ],
        "#b9b7b0"
      ).name = "bathroom-faucet-riser";
      addCylinder(
        group,
        0.045,
        0.44,
        [cut.centerXFt, surfaceTopY + 0.59, faucetZ + 0.18],
        "#b9b7b0",
        { rotationZ: Math.PI / 2 }
      ).name = "bathroom-faucet-spout";
    }
  }
  return group;
}

function getLayoutMetrics(design: SteelHomeCountertopDesign): LayoutMetrics {
  const mainWidth = design.wallAIn / 12;
  const counterDepth = design.wallDepthIn / 12;
  const leftLength = design.layout === "straight" ? 0 : design.wallBIn / 12;
  const rightLength = design.layout === "u-shape" ? design.wallCIn / 12 : 0;
  const islandWidth = design.island ? design.islandLengthIn / 12 : 0;
  const islandDepth = design.island ? design.islandWidthIn / 12 : 0;
  const runReach = Math.max(counterDepth, leftLength, rightLength);
  const islandCenterFromWall = design.island ? runReach + 4 + islandDepth / 2 : 0;
  const forwardReach = design.island ? islandCenterFromWall + islandDepth / 2 : runReach;
  const roomWidth = Math.max(12, mainWidth + 4, islandWidth + 6);
  const roomDepth = Math.max(12, forwardReach + 4);
  const backWallZ = -roomDepth / 2 + 0.18;
  return {
    roomWidth,
    roomDepth,
    backWallZ,
    mainWidth,
    counterDepth,
    mainZ: backWallZ + counterDepth / 2 + 0.08,
    leftLength,
    rightLength,
    islandWidth,
    islandDepth,
    islandZ: backWallZ + islandCenterFromWall,
  };
}

function getBathroomLayoutMetrics(design: SteelHomeCountertopDesign): LayoutMetrics {
  const mainWidth = design.wallAIn / 12;
  const counterDepth = design.wallDepthIn / 12;
  const leftLength = design.layout === "straight" ? 0 : design.wallBIn / 12;
  const rightLength = design.layout === "u-shape" ? design.wallCIn / 12 : 0;
  const vanityReach = Math.max(counterDepth, leftLength, rightLength);
  const roomWidth = Math.max(10, mainWidth + 3.25);
  const roomDepth = Math.max(11, vanityReach + 5.25);
  const backWallZ = -roomDepth / 2 + 0.18;
  return {
    roomWidth,
    roomDepth,
    backWallZ,
    mainWidth,
    counterDepth,
    mainZ: backWallZ + counterDepth / 2 + 0.08,
    leftLength,
    rightLength,
    islandWidth: 0,
    islandDepth: 0,
    islandZ: 0,
  };
}

/** Pure geometry seam used by focused tests; it does not create WebGL state. */
export const stoneVisualizerGeometryForTests = Object.freeze({
  getRunCuts,
  getLayoutMetrics,
  getBathroomLayoutMetrics,
  getVisibleSurfacePieces,
});

function addRoomShell(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  floorStone: boolean,
  metrics: LayoutMetrics
) {
  if (floorStone) {
    addStoneBox({
      parent,
      records,
      target: "floor",
      size: [metrics.roomWidth, 0.12, metrics.roomDepth],
      position: [0, -0.08, 0],
      mappingWidthFt: metrics.roomWidth,
      mappingHeightFt: metrics.roomDepth,
    });
  } else {
    addBox(parent, [metrics.roomWidth, 0.12, metrics.roomDepth], [0, -0.08, 0], "#cbb99f", {
      roughness: 0.88,
    });
  }
  addBox(parent, [metrics.roomWidth, 9, 0.14], [0, 4.45, metrics.backWallZ], "#ece6dc", {
    castShadow: false,
  });
  addBox(parent, [0.14, 9, metrics.roomDepth], [-metrics.roomWidth / 2, 4.45, 0], "#e2dbd0", {
    castShadow: false,
  });
}

function addBacksplash(args: {
  parent: THREE.Group;
  records: StoneMaterialRecord[];
  design: SteelHomeCountertopDesign;
  width: number;
  depth: number;
  x: number;
  z: number;
  rotationY?: number;
  surfaceTopY?: number;
  run?: CountertopCutoutRun;
}) {
  if (args.design.backsplash === "None") return;
  const height = args.design.backsplash === "Full-height" ? 2.8 : 0.34;
  const rotationY = args.rotationY ?? 0;
  const [x, z] = localToWorld(0, -args.depth / 2 - 0.05, args.x, args.z, rotationY);
  addStoneBox({
    parent: args.parent,
    records: args.records,
    target: "backsplash",
    size: [args.width, height, 0.08],
    position: [x, (args.surfaceTopY ?? SURFACE_TOP_Y) + 0.08 + height / 2, z],
    mappingWidthFt: args.width,
    mappingHeightFt: height,
    rotationY,
    slabRun: args.run,
  });
}

function addWaterfalls(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  design: SteelHomeCountertopDesign,
  metrics: LayoutMetrics
) {
  if (!design.island || design.waterfall === "None") return;
  for (const side of ["Left", "Right"] as const) {
    if (design.waterfall !== side && design.waterfall !== "Both") continue;
    const x = (side === "Left" ? -1 : 1) * (metrics.islandWidth / 2 - 0.08);
    addStoneBox({
      parent,
      records,
      target: "island",
      size: [0.16, SURFACE_TOP_Y, metrics.islandDepth],
      position: [x, SURFACE_TOP_Y / 2, metrics.islandZ],
      mappingWidthFt: metrics.islandDepth,
      mappingHeightFt: SURFACE_TOP_Y,
    });
  }
}

function addConfiguredSurfaces(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  design: SteelHomeCountertopDesign,
  metrics: LayoutMetrics,
  options: { cabinetry?: "kitchen" | "bathroom"; surfaceTopY?: number } = {}
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
    cabinetry: options.cabinetry,
    surfaceTopY: options.surfaceTopY,
  });
  addBacksplash({
    parent,
    records,
    design,
    width: metrics.mainWidth,
    depth: metrics.counterDepth,
    x: 0,
    z: metrics.mainZ,
    surfaceTopY: options.surfaceTopY,
    run: "main",
  });

  const leftVisibleLength = Math.max(0, metrics.leftLength - metrics.counterDepth);
  if (leftVisibleLength > 0.01) {
    const rotationY = Math.PI / 2;
    const x = -metrics.mainWidth / 2 + metrics.counterDepth / 2;
    const z = metrics.backWallZ + metrics.counterDepth + leftVisibleLength / 2 + 0.08;
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
      cabinetry: options.cabinetry,
      surfaceTopY: options.surfaceTopY,
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
      surfaceTopY: options.surfaceTopY,
      run: "left-return",
    });
  }

  const rightVisibleLength = Math.max(0, metrics.rightLength - metrics.counterDepth);
  if (rightVisibleLength > 0.01) {
    const rotationY = -Math.PI / 2;
    const x = metrics.mainWidth / 2 - metrics.counterDepth / 2;
    const z = metrics.backWallZ + metrics.counterDepth + rightVisibleLength / 2 + 0.08;
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
      cabinetry: options.cabinetry,
      surfaceTopY: options.surfaceTopY,
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
      surfaceTopY: options.surfaceTopY,
      run: "right-return",
    });
  }

  if (options.cabinetry !== "bathroom" && design.island) {
    addCounterRun({
      parent,
      records,
      design,
      target: "island",
      run: "island",
      width: metrics.islandWidth,
      depth: metrics.islandDepth,
      x: 0,
      z: metrics.islandZ,
    });
    addWaterfalls(parent, records, design, metrics);
  }
}

function addKitchenDecor(parent: THREE.Group, metrics: LayoutMetrics) {
  const kitchenDecor = new THREE.Group();
  kitchenDecor.name = "kitchen-decor";
  parent.add(kitchenDecor);
  const pictureX = Math.min(metrics.mainWidth * 0.28, metrics.roomWidth * 0.28);
  addBox(
    kitchenDecor,
    [Math.min(3.3, metrics.mainWidth * 0.28), 0.08, 1.3],
    [pictureX, 6.45, metrics.backWallZ + 0.08],
    "#91a6a0",
    { metalness: 0.55, roughness: 0.22, castShadow: false }
  );
  addBox(kitchenDecor, [1.25, 0.12, 0.12], [-pictureX, 5.7, metrics.backWallZ + 0.16], "#46392f");
}

function addBathroomRoomShell(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  design: SteelHomeCountertopDesign,
  metrics: LayoutMetrics
) {
  const shell = new THREE.Group();
  shell.name = "bathroom-room-shell";
  parent.add(shell);
  if (design.floorStone) {
    addStoneBox({
      parent: shell,
      records,
      target: "floor",
      size: [metrics.roomWidth, 0.12, metrics.roomDepth],
      position: [0, -0.08, 0],
      mappingWidthFt: metrics.roomWidth,
      mappingHeightFt: metrics.roomDepth,
    });
  } else {
    addBox(shell, [metrics.roomWidth, 0.12, metrics.roomDepth], [0, -0.08, 0], "#d7d2c8", {
      roughness: 0.94,
    }).name = "bathroom-tile-floor";
    for (let x = -metrics.roomWidth / 2 + 2; x < metrics.roomWidth / 2; x += 2) {
      addBox(shell, [0.018, 0.008, metrics.roomDepth], [x, -0.012, 0], "#aaa49b", {
        roughness: 1,
        castShadow: false,
      }).name = "bathroom-floor-grout";
    }
    for (let z = -metrics.roomDepth / 2 + 2; z < metrics.roomDepth / 2; z += 2) {
      addBox(shell, [metrics.roomWidth, 0.008, 0.018], [0, -0.012, z], "#aaa49b", {
        roughness: 1,
        castShadow: false,
      }).name = "bathroom-floor-grout";
    }
  }
  addBox(shell, [metrics.roomWidth, 9, 0.14], [0, 4.45, metrics.backWallZ], "#f1eee8", {
    castShadow: false,
  }).name = "bathroom-back-wall";
  addBox(shell, [0.14, 9, metrics.roomDepth], [-metrics.roomWidth / 2, 4.45, 0], "#e8e3db", {
    castShadow: false,
  }).name = "bathroom-side-wall";
  addBox(shell, [metrics.roomWidth, 3.55, 0.045], [0, 1.83, metrics.backWallZ + 0.085], "#ddd5c8", {
    roughness: 0.88,
    castShadow: false,
  }).name = "bathroom-wall-finish";
  for (const trimY of [0.22, 3.63, 8.58]) {
    addBox(
      shell,
      [metrics.roomWidth, trimY === 3.63 ? 0.08 : 0.16, 0.16],
      [0, trimY, metrics.backWallZ + 0.13],
      "#b8aa98",
      { castShadow: false, roughness: 0.72 }
    ).name = "bathroom-wall-trim";
  }
  addBox(
    shell,
    [0.18, 0.16, metrics.roomDepth],
    [-metrics.roomWidth / 2 + 0.1, 0.22, 0],
    "#b8aa98",
    { castShadow: false, roughness: 0.72 }
  ).name = "bathroom-baseboard";
  const ceilingLight = addCylinder(shell, 0.72, 0.16, [0.8, 8.55, 0.8], "#f1dfbd", {
    roughness: 0.3,
    metalness: 0.05,
  });
  ceilingLight.name = "bathroom-ceiling-light-fixture";
  const practicalLight = new THREE.PointLight("#ffd8a8", 1.15, 16, 1.7);
  practicalLight.position.set(0.8, 7.7, 0.8);
  practicalLight.name = "bathroom-warm-practical-light";
  practicalLight.castShadow = true;
  shell.add(practicalLight);
}

function addBathroomDecor(
  parent: THREE.Group,
  metrics: LayoutMetrics,
  design: SteelHomeCountertopDesign
) {
  const bathroomDecor = new THREE.Group();
  bathroomDecor.name = "bathroom-fixtures-and-decor";
  parent.add(bathroomDecor);

  const mainSinkCuts = getRunCuts(design, "main", metrics.mainWidth, metrics.counterDepth).filter(
    (cut) => cut.kind === "sink"
  );
  const mirrorCenters = mainSinkCuts.length
    ? mainSinkCuts.map((cut) => cut.centerXFt)
    : metrics.mainWidth >= 7
      ? [-metrics.mainWidth * 0.23, metrics.mainWidth * 0.23]
      : [0];
  for (const centerX of mirrorCenters) {
    const mirrorWidth = Math.min(
      2.7,
      Math.max(1.8, metrics.mainWidth / mirrorCenters.length - 0.8)
    );
    addBox(
      bathroomDecor,
      [mirrorWidth + 0.16, 3.31, 0.055],
      [centerX, 5.45, metrics.backWallZ + 0.145],
      "#b28a54",
      { metalness: 0.58, roughness: 0.22, castShadow: false }
    ).name = "bathroom-vanity-mirror-frame";
    const mirror = addBox(
      bathroomDecor,
      [mirrorWidth, 3.15, 0.075],
      [centerX, 5.45, metrics.backWallZ + 0.16],
      "#c8dcdd",
      { metalness: 0.18, roughness: 0.16, castShadow: false }
    );
    mirror.name = "bathroom-vanity-mirror";
    for (const side of [-1, 1]) {
      const sconce = addCylinder(
        bathroomDecor,
        0.12,
        0.62,
        [centerX + side * 1.65, 5.65, metrics.backWallZ + 0.32],
        "#f3d7a4",
        { roughness: 0.34, metalness: 0.08 }
      );
      sconce.name = "bathroom-sconce";
    }
    const vanityLight = new THREE.PointLight("#ffd7a3", 0.46, 7);
    vanityLight.position.set(centerX, 5.5, metrics.backWallZ + 1.2);
    vanityLight.name = "bathroom-vanity-light";
    bathroomDecor.add(vanityLight);
  }

  const vanityReach = Math.max(metrics.leftLength, metrics.rightLength, metrics.counterDepth);
  const tubZ = Math.min(metrics.roomDepth / 2 - 2.65, metrics.backWallZ + vanityReach + 2.75);
  const tubX = -metrics.roomWidth / 2 + 1.52;
  addRoundedBox(bathroomDecor, [2.82, 1.72, 5.05], [tubX, 0.86, tubZ], "#f7f5ef", {
    radius: 0.2,
    smoothness: 5,
    roughness: 0.17,
  }).name = "bathroom-tub";
  addRoundedBox(bathroomDecor, [2.24, 0.08, 4.32], [tubX, 1.7, tubZ], "#a9c8c8", {
    radius: 0.18,
    smoothness: 5,
    roughness: 0.1,
    metalness: 0.08,
  }).name = "bathroom-tub-water";
  addContactShadow(bathroomDecor, [2.65, 4.82], [tubX, 0.008, tubZ], 0.18);

  addBox(bathroomDecor, [0.04, 6.9, 5.3], [-metrics.roomWidth / 2 + 0.16, 3.58, tubZ], "#c8c1b5", {
    roughness: 0.78,
    castShadow: false,
  }).name = "bathroom-shower-tile-surround";
  for (let groutZ = tubZ - 2; groutZ <= tubZ + 2; groutZ += 1) {
    addBox(
      bathroomDecor,
      [0.025, 6.7, 0.018],
      [-metrics.roomWidth / 2 + 0.185, 3.55, groutZ],
      "#9e978d",
      { castShadow: false, roughness: 1 }
    ).name = "bathroom-shower-grout";
  }
  const glass = addBox(bathroomDecor, [0.065, 4.85, 4.95], [tubX + 1.43, 4.15, tubZ], "#b5d0cf", {
    roughness: 0.08,
    metalness: 0.06,
    castShadow: false,
  });
  glass.name = "bathroom-framed-shower-glass";
  glass.material.transparent = true;
  glass.material.opacity = 0.2;
  for (const frameZ of [tubZ - 2.42, tubZ, tubZ + 2.42]) {
    addBox(bathroomDecor, [0.1, 4.95, 0.075], [tubX + 1.44, 4.16, frameZ], "#4f5351", {
      metalness: 0.78,
      roughness: 0.2,
    }).name = "bathroom-shower-frame";
  }
  addBox(bathroomDecor, [0.1, 0.09, 4.95], [tubX + 1.44, 6.62, tubZ], "#4f5351", {
    metalness: 0.78,
    roughness: 0.2,
  }).name = "bathroom-shower-frame";
  const showerPipeX = -metrics.roomWidth / 2 + 0.34;
  const showerPipeZ = tubZ - 1.72;
  addCylinder(bathroomDecor, 0.04, 3.7, [showerPipeX, 4.35, showerPipeZ], "#9ea3a0", {
    metalness: 0.82,
    roughness: 0.16,
  }).name = "bathroom-shower-riser";
  addCylinder(bathroomDecor, 0.05, 0.72, [showerPipeX + 0.3, 6.18, showerPipeZ], "#9ea3a0", {
    rotationZ: Math.PI / 2,
    metalness: 0.82,
    roughness: 0.16,
  }).name = "bathroom-shower-head";

  const toiletX = metrics.roomWidth / 2 - 1.25;
  const toiletZ = Math.min(
    metrics.roomDepth / 2 - 1.3,
    metrics.backWallZ + metrics.counterDepth + 3.25
  );
  addRoundedBox(bathroomDecor, [1.32, 1.42, 0.56], [toiletX, 1.24, toiletZ - 0.6], "#f8f7f3", {
    radius: 0.14,
    smoothness: 5,
    roughness: 0.16,
  }).name = "bathroom-toilet-tank";
  const toiletBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 30, 20),
    new THREE.MeshStandardMaterial({ color: "#f8f7f3", roughness: 0.16 })
  );
  toiletBowl.scale.set(0.8, 0.48, 1.12);
  toiletBowl.position.set(toiletX, 0.68, toiletZ);
  toiletBowl.castShadow = true;
  toiletBowl.name = "bathroom-grounded-toilet-bowl";
  bathroomDecor.add(toiletBowl);
  const toiletSeat = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.075, 10, 32),
    new THREE.MeshStandardMaterial({ color: "#eeeae2", roughness: 0.2 })
  );
  toiletSeat.rotation.x = Math.PI / 2;
  toiletSeat.scale.z = 1.24;
  toiletSeat.position.set(toiletX, 1.03, toiletZ + 0.04);
  toiletSeat.name = "bathroom-toilet-seat";
  bathroomDecor.add(toiletSeat);
  addContactShadow(bathroomDecor, [1.35, 1.85], [toiletX, 0.009, toiletZ], 0.17);

  addRoundedBox(
    bathroomDecor,
    [Math.min(4.4, metrics.mainWidth * 0.46), 0.045, 2.05],
    [Math.max(0.3, metrics.roomWidth * 0.12), 0.02, metrics.mainZ + 3.25],
    "#b68b65",
    { radius: 0.18, smoothness: 5, roughness: 0.95, castShadow: false }
  ).name = "bathroom-bath-mat";
  addBox(
    bathroomDecor,
    [1.35, 0.08, 0.12],
    [-metrics.roomWidth / 2 + 0.16, 4.25, tubZ + 1.7],
    "#575b59",
    { metalness: 0.7, roughness: 0.2 }
  ).name = "bathroom-towel-bar";
  addRoundedBox(
    bathroomDecor,
    [0.16, 1.25, 1.15],
    [-metrics.roomWidth / 2 + 0.28, 3.78, tubZ + 1.7],
    "#c58f72",
    { radius: 0.06, smoothness: 4, roughness: 0.92, castShadow: false }
  ).name = "bathroom-folded-towel";
}

function addLivingDecor(parent: THREE.Group, metrics: LayoutMetrics) {
  const fireWidth = Math.min(3.2, metrics.mainWidth * 0.45);
  addBox(parent, [fireWidth, 2.25, 0.38], [0, 1.95, metrics.backWallZ + 0.3], "#1c211f", {
    roughness: 0.95,
    castShadow: false,
  });
  addBox(
    parent,
    [Math.min(6.3, metrics.mainWidth * 0.7), 0.2, 0.35],
    [0, 5.6, metrics.backWallZ + 0.36],
    METAL,
    { metalness: 0.5 }
  );
  const sofaZ = metrics.backWallZ + Math.max(metrics.leftLength, metrics.counterDepth) + 3;
  const sofaX = Math.max(3.2, metrics.roomWidth * 0.28);
  addBox(parent, [5.8, 1.1, 2.8], [-sofaX, 0.5, sofaZ], "#8b745e", { roughness: 0.95 });
  addBox(parent, [5.8, 1.1, 2.8], [sofaX, 0.5, sofaZ], "#8b745e", { roughness: 0.95 });
}

function buildScene(
  parent: THREE.Group,
  records: StoneMaterialRecord[],
  design: SteelHomeCountertopDesign
) {
  if (isCountertopBathroomRoom(design.room)) {
    const bathroomDesign = getCountertopActiveRoomDesign(design);
    const metrics = getBathroomLayoutMetrics(bathroomDesign);
    parent.name = "bathroom-residential-scene";
    addBathroomRoomShell(parent, records, bathroomDesign, metrics);
    addConfiguredSurfaces(parent, records, bathroomDesign, metrics, {
      cabinetry: "bathroom",
      surfaceTopY: BATHROOM_SURFACE_TOP_Y,
    });
    addBathroomDecor(parent, metrics, bathroomDesign);
    return;
  }
  const metrics = getLayoutMetrics(design);
  parent.name = design.room === "Living room" ? "living-room-scene" : "kitchen-countertop-scene";
  addRoomShell(parent, records, design.floorStone, metrics);
  addConfiguredSurfaces(parent, records, design, metrics);
  if (design.room === "Living room") addLivingDecor(parent, metrics);
  else addKitchenDecor(parent, metrics);
}

/** Builds the same object graph as the live renderer without requiring a WebGL context. */
export function buildStoneVisualizerSceneForTests(design: SteelHomeCountertopDesign): {
  rootName: string;
  objectNames: string[];
  surfaceTargets: StoneSurfaceTarget[];
} {
  const content = new THREE.Group();
  const records: StoneMaterialRecord[] = [];
  buildScene(content, records, design);
  const objectNames: string[] = [];
  content.traverse((object) => {
    if (object.name) objectNames.push(object.name);
  });
  const result = {
    rootName: content.name,
    objectNames,
    surfaceTargets: records.map((record) => record.target),
  };
  disposeObject(content);
  return result;
}

function getBathroomFurnishingBounds(content: THREE.Group): THREE.Box3 {
  const bounds = new THREE.Box3();
  content.updateMatrixWorld(true);
  content.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (
      [
        "bathroom-back-wall",
        "bathroom-side-wall",
        "bathroom-tile-floor",
        "bathroom-wall-trim",
      ].includes(object.name)
    ) {
      return;
    }
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

function applyCamera(runtime: Runtime, design: SteelHomeCountertopDesign, force = false) {
  const key = `${runtime.revision}:${design.cameraPreset}`;
  if (!force && runtime.cameraKey === key) return;
  runtime.cameraKey = key;

  const isBathroom = isCountertopBathroomRoom(design.room);
  const furnishingBounds = isBathroom ? getBathroomFurnishingBounds(runtime.content) : null;
  const bounds =
    furnishingBounds && !furnishingBounds.isEmpty()
      ? furnishingBounds
      : new THREE.Box3().setFromObject(runtime.content);
  const center = bounds.isEmpty()
    ? new THREE.Vector3(0, 2.2, 0)
    : bounds.getCenter(new THREE.Vector3());
  const size = bounds.isEmpty()
    ? new THREE.Vector3(12, 9, 12)
    : bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, size.y * (isBathroom ? 1.08 : 1.25), 8);
  const distance = getStoneVisualizerCameraFitDistance({
    span,
    verticalFovDegrees: runtime.camera.fov,
    aspect: runtime.camera.aspect,
  });
  const offset = getStoneVisualizerCameraOffset({
    distance,
    aspect: runtime.camera.aspect,
    preset: design.cameraPreset,
    isBathroom,
  });
  const target = center.clone();
  target.y = isBathroom
    ? Math.min(2.35, Math.max(1.45, center.y))
    : Math.min(2.6, Math.max(1.4, center.y));
  runtime.controls.target.copy(target);
  runtime.camera.position.copy(target).add(offset);
  runtime.camera.near = Math.max(0.05, distance / 200);
  runtime.camera.far = Math.max(100, distance * 8);
  runtime.camera.updateProjectionMatrix();
  runtime.controls.minDistance = Math.max(1.5, span * 0.16);
  runtime.controls.maxDistance = Math.max(30, distance * 3);
  runtime.controls.update();
  runtime.cameraDirty = false;
  runtime.renderOnce();
}

export function getStoneVisualizerCameraOffset(args: {
  distance: number;
  aspect: number;
  preset: SteelHomeCountertopDesign["cameraPreset"];
  isBathroom: boolean;
}): THREE.Vector3 {
  const detailDistance = args.distance * 0.72;
  if (!args.isBathroom) {
    const offsets: Record<SteelHomeCountertopDesign["cameraPreset"], THREE.Vector3> = {
      Perspective: new THREE.Vector3(
        args.distance * 0.68,
        args.distance * 0.46,
        args.distance * 0.78
      ),
      Front: new THREE.Vector3(0, args.distance * 0.28, args.distance),
      Top: new THREE.Vector3(0.01, args.distance * 1.18, 0.01),
      Detail: new THREE.Vector3(
        detailDistance * 0.68,
        detailDistance * 0.34,
        detailDistance * 0.72
      ),
    };
    return offsets[args.preset];
  }
  const narrow = args.aspect < 0.82;
  const offsets: Record<SteelHomeCountertopDesign["cameraPreset"], THREE.Vector3> = {
    Perspective: new THREE.Vector3(
      args.distance * (narrow ? 0.32 : 0.54),
      2.65,
      args.distance * (narrow ? 0.86 : 0.68)
    ),
    Front: new THREE.Vector3(0, 2.5, args.distance * (narrow ? 1.04 : 0.94)),
    Top: new THREE.Vector3(0.01, args.distance * 1.18, 0.01),
    Detail: new THREE.Vector3(detailDistance * 0.62, 2.1, detailDistance * 0.76),
  };
  return offsets[args.preset];
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

export type StoneSlabFaceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StonePhotoSafeRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Photo-specific slab interiors for catalog images whose edges contain a yard, rack, or clamp. */
export function getStonePhotoSafeRegion(sourceKey: string): StonePhotoSafeRegion | null {
  const normalized = sourceKey.replace(/\\/g, "/").toLowerCase().split(/[?#]/)[0];
  if (
    normalized.endsWith("/quartzite/cristallo/1.webp") ||
    normalized.endsWith("/inventory-source/1d8bvwastftks4ri4kk553drhwwxeazxq.webp")
  ) {
    return { x: 0.14, y: 0.2, width: 0.72, height: 0.66 };
  }
  if (
    normalized.endsWith("/quartzite/rhino-white/1.webp") ||
    normalized.endsWith("/inventory-source/1efzz0n8sljawetlrtthtxfqtuylinqrt.webp")
  ) {
    return { x: 0.14, y: 0.2, width: 0.72, height: 0.66 };
  }
  return null;
}

/**
 * Center the recorded physical slab aspect inside the real catalog photo, then inset slightly so
 * yard, rack, and photo borders cannot become part of the repeating material map.
 */
export function getStoneSlabFaceCrop(args: {
  imageWidth: number;
  imageHeight: number;
  dimensions: { widthIn: number; heightIn: number } | null;
  safetyInset?: number;
  safeRegion?: StonePhotoSafeRegion | null;
}): StoneSlabFaceCrop {
  const imageWidth = Math.max(1, args.imageWidth);
  const imageHeight = Math.max(1, args.imageHeight);
  const safetyInset = Math.min(0.12, Math.max(0, args.safetyInset ?? 0.055));
  const safeRegion = args.safeRegion;
  const regionX = safeRegion ? imageWidth * safeRegion.x : 0;
  const regionY = safeRegion ? imageHeight * safeRegion.y : 0;
  const regionWidth = safeRegion ? imageWidth * safeRegion.width : imageWidth;
  const regionHeight = safeRegion ? imageHeight * safeRegion.height : imageHeight;
  const insetWidth = regionWidth * (1 - safetyInset * 2);
  const insetHeight = regionHeight * (1 - safetyInset * 2);
  const targetAspect = args.dimensions
    ? args.dimensions.widthIn / args.dimensions.heightIn
    : insetWidth / insetHeight;
  let width = insetWidth;
  let height = insetHeight;
  if (width / height > targetAspect) width = height * targetAspect;
  else height = width / targetAspect;
  return {
    x: regionX + (regionWidth - width) / 2,
    y: regionY + (regionHeight - height) / 2,
    width,
    height,
  };
}

function createSlabFaceTexture(
  source: THREE.Texture,
  dimensions: { widthIn: number; heightIn: number } | null
): THREE.Texture {
  const image = source.image as CanvasImageSource & {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const imageWidth = image.naturalWidth || image.videoWidth || Number(image.width) || 1;
  const imageHeight = image.naturalHeight || image.videoHeight || Number(image.height) || 1;
  const sourceKey = String(
    source.userData.inventoryAssetPath || source.userData.sourceAssetIdentity || source.name || ""
  );
  const safeRegion = getStonePhotoSafeRegion(sourceKey);
  const crop = getStoneSlabFaceCrop({
    imageWidth,
    imageHeight,
    dimensions,
    safeRegion,
    safetyInset: safeRegion ? 0.01 : undefined,
  });
  const maximumTextureEdge = 2048;
  const scale = Math.min(1, maximumTextureEdge / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "cropped-real-inventory-slab-face";
  texture.userData.sourceAssetIdentity = source.userData.sourceAssetIdentity || source.name;
  return texture;
}

function configureTexture(
  texture: THREE.Texture,
  record: StoneMaterialRecord,
  design: SteelHomeCountertopDesign,
  dimensions: { widthIn: number; heightIn: number } | null,
  anisotropy: number,
  initialize: boolean,
  slabAllocation?: BathroomSlabRunAllocation
) {
  if (initialize) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
  }
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(design.veinRotation);
  const physicalRepeat = getStoneVisualizerTextureRepeat(record, design, dimensions);
  texture.repeat.set(
    slabAllocation?.width ?? physicalRepeat.x,
    slabAllocation?.height ?? physicalRepeat.y
  );
  texture.offset.set(
    slabAllocation
      ? slabAllocation.x + slabAllocation.width / 2 - 0.5
      : design.textureOffsetX * 0.35,
    slabAllocation
      ? slabAllocation.y + slabAllocation.height / 2 - 0.5
      : design.textureOffsetY * 0.35
  );
  texture.updateMatrix();
  if (initialize) texture.needsUpdate = true;
}

export function getStoneVisualizerTextureRepeat(
  record: Pick<StoneMaterialRecord, "widthFt" | "heightFt">,
  design: Pick<SteelHomeCountertopDesign, "textureScale" | "veinRotation">,
  dimensions: { widthIn: number; heightIn: number } | null
): { x: number; y: number } {
  if (!dimensions) {
    const repeat = Math.min(0.985, Math.max(0.08, 1 / design.textureScale));
    return { x: repeat, y: repeat };
  }
  const quarterTurn = design.veinRotation === 90 || design.veinRotation === 270;
  const surfaceWidthFt = quarterTurn ? record.heightFt : record.widthFt;
  const surfaceHeightFt = quarterTurn ? record.widthFt : record.heightFt;
  return {
    x: Math.min(
      0.985,
      Math.max(0.08, surfaceWidthFt / (dimensions.widthIn / 12) / design.textureScale)
    ),
    y: Math.min(
      0.985,
      Math.max(0.08, surfaceHeightFt / (dimensions.heightIn / 12) / design.textureScale)
    ),
  };
}

export type BathroomSlabRunAllocation = {
  run: CountertopCutoutRun;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Packs the measured bathroom runs into one finite slab photo. Main and return runs receive
 * disjoint regions, so an L/U design cannot restart from the same photographed origin.
 */
export function getBathroomStoneSlabRunAllocations(args: {
  runs: Array<{ run: CountertopCutoutRun; widthFt: number; heightFt: number }>;
  design: Pick<
    SteelHomeCountertopDesign,
    "textureScale" | "veinRotation" | "textureOffsetX" | "textureOffsetY"
  >;
  dimensions: { widthIn: number; heightIn: number } | null;
}): BathroomSlabRunAllocation[] {
  const orderedRuns = (["main", "left-return", "right-return"] as CountertopCutoutRun[])
    .map((run) => args.runs.find((item) => item.run === run))
    .filter((item): item is (typeof args.runs)[number] => Boolean(item));
  const returnCount = orderedRuns.filter((item) => item.run !== "main").length;
  const slots: Record<
    CountertopCutoutRun,
    { x: number; y: number; width: number; height: number }
  > = {
    main: { x: 0.025, y: 0.025, width: 0.95, height: 0.44 },
    "left-return": {
      x: 0.025,
      y: 0.525,
      width: returnCount > 1 ? 0.45 : 0.95,
      height: 0.45,
    },
    "right-return": { x: 0.525, y: 0.525, width: 0.45, height: 0.45 },
    island: { x: 0.025, y: 0.525, width: 0.95, height: 0.45 },
  };
  const horizontalBias = (Math.max(-1, Math.min(1, args.design.textureOffsetX)) + 1) / 2;
  const verticalBias = (Math.max(-1, Math.min(1, args.design.textureOffsetY)) + 1) / 2;
  return orderedRuns.map((item) => {
    const slot = slots[item.run];
    const physical = getStoneVisualizerTextureRepeat(item, args.design, args.dimensions);
    const width = Math.min(slot.width, physical.x);
    const height = Math.min(slot.height, physical.y);
    return {
      run: item.run,
      x: slot.x + (slot.width - width) * horizontalBias,
      y: slot.y + (slot.height - height) * verticalBias,
      width,
      height,
    };
  });
}

function applyTextureToRecord(
  record: StoneMaterialRecord,
  source: THREE.Texture,
  sourceKey: string,
  design: SteelHomeCountertopDesign,
  dimensions: { widthIn: number; heightIn: number } | null,
  anisotropy: number,
  slabAllocation?: BathroomSlabRunAllocation
): THREE.Texture {
  const existing = record.material.map;
  const canReuse = existing?.userData.stoneSourceKey === sourceKey;
  const texture = canReuse ? existing : source.clone();
  configureTexture(texture, record, design, dimensions, anisotropy, !canReuse, slabAllocation);
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
  design: SteelHomeCountertopDesign,
  dimensions: { widthIn: number; heightIn: number } | null
) {
  const anisotropy = Math.min(8, runtime.renderer.capabilities.getMaxAnisotropy());
  const bathroomAllocations = isCountertopBathroomRoom(design.room)
    ? new Map(
        getBathroomStoneSlabRunAllocations({
          runs: runtime.records.flatMap((record) =>
            record.target === "counter" && record.slabRun
              ? [
                  {
                    run: record.slabRun,
                    widthFt: record.widthFt,
                    heightFt: record.heightFt,
                  },
                ]
              : []
          ),
          design,
          dimensions,
        }).map((allocation) => [allocation.run, allocation] as const)
      )
    : null;
  for (const record of runtime.records) {
    applyTextureToRecord(
      record,
      source,
      runtime.sourceTextureKey,
      design,
      dimensions,
      anisotropy,
      record.slabRun ? bathroomAllocations?.get(record.slabRun) : undefined
    );
  }
  runtime.renderOnce();
}

/** Texture seam for proving transform-only updates preserve GPU-facing texture identity. */
export function applyStoneVisualizerTextureForTests(args: {
  source: THREE.Texture;
  sourceKey: string;
  record: StoneMaterialRecord;
  design: SteelHomeCountertopDesign;
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
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const designRef = useRef(design);
  const onSelectRef = useRef(onSelectTarget);
  const rendererRetryRef = useRef<HTMLButtonElement>(null);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [textureAttempt, setTextureAttempt] = useState(0);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [sourceTextureRevision, setSourceTextureRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textureFailed, setTextureFailed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [textureStatus, setTextureStatus] = useState("Loading the selected inventory photo…");
  const isBathroom = isCountertopBathroomRoom(design.room);
  const stone = getCatalogItemById(design.stoneId);
  const selectedImage = stone?.images[design.textureImageIndex] ?? null;
  const textureImageHref = stone
    ? buildNamedStoneDesignerImageHref(stone.shareSlug || "", selectedImage || "") ||
      buildStoneDesignerImageHref(stone.id, design.textureImageIndex)
    : "";
  const unplacedOpeningCount = getCountertopOpeningSchedule(design).filter(
    (item) =>
      !item.run ||
      item.positionIn === null ||
      (item.requiresFrontPosition && (item.frontPositionIn === null || !item.depthIn)) ||
      (item.id !== "sink" && item.id !== "cooktop" && (!item.widthIn || !item.depthIn))
  ).length;

  const geometryDesign = useMemo(
    () => design,
    [
      design.room,
      design.layout,
      design.wallAIn,
      design.wallBIn,
      design.wallCIn,
      design.wallDepthIn,
      design.island,
      design.islandLengthIn,
      design.islandWidthIn,
      design.floorStone,
      design.showSeams,
      design.waterfall,
      design.edge,
      design.backsplash,
      design.sink,
      design.sinkRun,
      design.sinkPositionIn,
      design.sinkFrontPositionIn,
      design.cooktop,
      design.cooktopRun,
      design.cooktopPositionIn,
      design.cooktopFrontPositionIn,
      design.otherCutouts,
    ]
  );
  const textureSourceKey = textureImageHref;
  const textureMappingKey = `${design.textureOffsetX}:${design.textureOffsetY}:${design.textureScale}:${design.veinRotation}`;

  designRef.current = design;

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
        "Automated DOM checks do not provide WebGL. This is a catalog-photo recovery view, not a rendered room."
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

      let pendingLayoutFrame = 0;
      const resize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (width < 2 || height < 2) {
          if (!pendingLayoutFrame) {
            pendingLayoutFrame = requestAnimationFrame(() => {
              pendingLayoutFrame = 0;
              resize();
            });
          }
          return;
        }
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (runtime?.content.children.length) {
          runtime.cameraDirty = false;
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
        if (pendingLayoutFrame) cancelAnimationFrame(pendingLayoutFrame);
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
        "This browser could not start the 3D room. The image below is a catalog photo, not a 3D preview."
      );
      return undefined;
    }
  }, [rendererAttempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    setSceneReady(false);
    runtime.revision += 1;
    clearGroup(runtime.content);
    runtime.records = [];
    buildScene(runtime.content, runtime.records, geometryDesign);
    applyCamera(runtime, geometryDesign, true);
    requestAnimationFrame(() => {
      if (runtimeRef.current !== runtime) return;
      runtime.renderOnce();
      const bufferSize = runtime.renderer.getDrawingBufferSize(new THREE.Vector2());
      setSceneReady(
        bufferSize.x > 1 && bufferSize.y > 1 && runtime.renderer.info.render.triangles > 0
      );
    });
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
    applyCamera(runtime, design);
  }, [design.cameraPreset, sceneRevision]);

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
    const usesStoneOnlyRegion = Boolean(getStonePhotoSafeRegion(selectedImage));
    const successStatus = dimensions
      ? `Using ${usesStoneOnlyRegion ? "a photo-specific stone-only interior" : "a safety-inset slab-face crop"} from this exact photo with its recorded ${dimensions.widthIn}×${dimensions.heightIn}-inch source dimensions as a planning scale.`
      : "Using a safety-inset crop from this exact photo. Scale remains unverified until slab dimensions are confirmed.";
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
        source.name = textureSourceKey;
        source.userData.sourceAssetIdentity = textureSourceKey;
        source.userData.inventoryAssetPath = selectedImage;
        const slabFaceSource = createSlabFaceTexture(source, dimensions);
        if (slabFaceSource !== source) source.dispose();
        runtime.sourceTexture = slabFaceSource;
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
    applyTextureToRecords(runtime, runtime.sourceTexture, design, dimensions);
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
    applyCamera(runtime, design, true);
  };

  return (
    <div
      className="flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[1.4rem] bg-[#d8d0c2] sm:min-h-[26rem]"
      data-testid="steel-home-countertop-3d-visualizer"
      data-scene-ready={sceneReady ? "true" : "false"}
    >
      <div
        ref={hostRef}
        className="relative min-h-[20rem] flex-1 overflow-hidden"
        data-testid="steel-home-countertop-3d-scene"
      >
        <span className="sr-only" aria-live="polite">
          {sceneReady ? "3D scene ready" : "Preparing 3D scene"}
        </span>
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
              <p className="mt-4 text-sm font-black">3D room unavailable</p>
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
                Retry 3D room
              </button>
            </div>
          </div>
        ) : null}
        <canvas
          key={rendererAttempt}
          ref={canvasRef}
          className="block h-full w-full touch-pan-y"
          aria-hidden={error ? true : undefined}
          aria-label={`Interactive 3D ${design.room.toLowerCase()} using ${stone?.publicLabel || "the selected surface"}. Drag sideways to orbit, use two fingers or the wheel to zoom, and tap a modeled surface to edit it. One-finger vertical swipes scroll the page.`}
        />
        {!error ? (
          <>
            <div className="pointer-events-none absolute inset-x-3 top-3 hidden items-start justify-between gap-3 sm:flex">
              <div className="rounded-xl bg-[#101817]/88 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                  Live 3D room · {design.room}
                </p>
                <p className="mt-1 hidden text-xs font-semibold text-white/72 sm:block">
                  Drag to orbit · wheel or pinch to zoom · tap a surface
                </p>
              </div>
              <div className="rounded-full bg-[#f7f2e9]/94 px-3 py-2 text-[0.65rem] font-black capitalize text-[#18312f] shadow-lg">
                Selected {selectedTarget}
              </div>
            </div>
            <div
              className="absolute bottom-[4.25rem] left-3 z-10 hidden flex-wrap gap-1.5 sm:flex"
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
            <div className="absolute bottom-3 left-3 right-3 hidden items-center gap-2 rounded-xl bg-[#101817]/88 px-3 py-2 text-white backdrop-blur-sm sm:flex">
              <p
                className="min-w-0 flex-1 text-[0.66rem] font-semibold leading-5 text-white/78"
                role="status"
              >
                {textureStatus}
                {unplacedOpeningCount
                  ? ` ${unplacedOpeningCount} incomplete opening${unplacedOpeningCount === 1 ? " is" : "s are"} not shown in 3D.`
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
      </div>
      {!error ? (
        <div
          className="grid shrink-0 gap-2 border-t border-[#18312f]/12 bg-[#f7f2e9] p-3 text-[#18312f] sm:hidden"
          data-testid="steel-home-countertop-mobile-scene-tools"
          data-overlay-placement="outside-scene"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8f3f25]">
              Live 3D · {design.room}
            </p>
            <p className="text-[0.62rem] font-black capitalize">Selected {selectedTarget}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Mobile 3D view controls">
            <button
              type="button"
              onClick={() => orbit(-1)}
              className="min-h-9 rounded-full border border-[#18312f]/15 bg-white px-3 text-xs font-black"
              aria-label="Orbit view left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => orbit(1)}
              className="min-h-9 rounded-full border border-[#18312f]/15 bg-white px-3 text-xs font-black"
              aria-label="Orbit view right"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => zoom(0.82)}
              className="min-h-9 rounded-full border border-[#18312f]/15 bg-white px-3 text-xs font-black"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoom(1.22)}
              className="min-h-9 rounded-full border border-[#18312f]/15 bg-white px-3 text-xs font-black"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetView}
              className="min-h-9 rounded-full bg-[#18312f] px-3 text-[0.68rem] font-black text-white"
            >
              Reset view
            </button>
          </div>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[0.66rem] font-semibold leading-4" role="status">
              {textureStatus}
              {unplacedOpeningCount
                ? ` ${unplacedOpeningCount} incomplete opening${unplacedOpeningCount === 1 ? " is" : "s are"} not shown in 3D.`
                : ""}
            </p>
            {textureFailed ? (
              <button
                type="button"
                onClick={() => setTextureAttempt((value) => value + 1)}
                className="shrink-0 rounded-full bg-[#f0b392] px-3 py-1.5 text-[0.64rem] font-black"
              >
                Retry photo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="sr-only">
        <p>The room includes semantic controls outside the canvas for every modeled option.</p>
        <ul>
          <li>Countertop surface: {stone?.publicLabel || "not selected"}</li>
          {!isBathroom ? <li>Island: {design.island ? "included" : "not included"}</li> : null}
          <li>Backsplash: {design.backsplash}</li>
          <li>Floor stone: {design.floorStone ? "included" : "not included"}</li>
          <li>Sink: {design.sink}</li>
          {!isBathroom ? <li>Cooktop: {design.cooktop}</li> : null}
          <li>Other openings: {design.otherCutouts.length}</li>
          <li>Planning seams: {design.showSeams ? "shown" : "not shown"}</li>
        </ul>
      </div>
    </div>
  );
}
