/* eslint-disable @typescript-eslint/no-non-null-assertion -- Rendering follows a scene.shell/type guard and canonical validation. */
import { useEffect, useMemo, useRef, useState } from "react";
import type * as ThreeTypes from "three";
import {
  getSceneRoofHeightAtPoint,
  type BuildingMeasuredScene,
  type MeasuredBuildingOpening,
  type MeasuredPoint2,
  type MeasuredPoint3,
} from "./buildingPlannerModel";
import { getBuildingAccessory, getBuildingOpening, type BuildingWall } from "./buildingCatalog";

type PreviewView = "3d" | "plan" | "front" | "right" | "rear" | "left";

const VIEW_OPTIONS: readonly { id: PreviewView; label: string }[] = [
  { id: "3d", label: "3D" },
  { id: "plan", label: "Plan" },
  { id: "front", label: "Front elevation" },
  { id: "right", label: "Right elevation" },
  { id: "rear", label: "Rear elevation" },
  { id: "left", label: "Left elevation" },
];

const FALLBACK_WALL = "#7c8986";
const FALLBACK_ROOF = "#4f5d60";
const FALLBACK_TRIM = "#273735";

function disposeObject(root: ThreeTypes.Object3D) {
  root.traverse((object) => {
    const mesh = object as ThreeTypes.Mesh;
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else mesh.material?.dispose();
  });
}

function polygonGeometry(THREE: typeof import("three"), vertices: MeasuredPoint3[]) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let index = 1; index < vertices.length - 1; index += 1) {
    for (const point of [vertices[0], vertices[index], vertices[index + 1]]) {
      positions.push(point.xFt, point.yFt, point.zFt);
    }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function physicalWallOpening(opening: MeasuredBuildingOpening, widthFt: number, lengthFt: number) {
  const openingWidth = opening.widthFt!;
  const elevationOffset = opening.offsetFt!;
  if (opening.surface === "front") {
    return { xFt: elevationOffset + openingWidth / 2, zFt: -0.03, rotationY: 0 };
  }
  if (opening.surface === "rear") {
    return {
      xFt: widthFt - elevationOffset - openingWidth / 2,
      zFt: lengthFt + 0.03,
      rotationY: Math.PI,
    };
  }
  if (opening.surface === "left") {
    return { xFt: -0.03, zFt: elevationOffset + openingWidth / 2, rotationY: Math.PI / 2 };
  }
  return {
    xFt: widthFt + 0.03,
    zFt: lengthFt - elevationOffset - openingWidth / 2,
    rotationY: -Math.PI / 2,
  };
}

function buildThreeContent(THREE: typeof import("three"), scene: BuildingMeasuredScene) {
  const content = new THREE.Group();
  const shell = scene.shell;
  if (!shell) return content;
  const { widthFt, lengthFt, eaveHeightFt } = shell;
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: shell.wallColorHex ?? FALLBACK_WALL,
    roughness: 0.72,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: shell.trimColorHex ?? FALLBACK_TRIM,
    roughness: 0.45,
    metalness: 0.55,
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: shell.roofColorHex ?? FALLBACK_ROOF,
    roughness: 0.42,
    metalness: 0.68,
    side: THREE.DoubleSide,
  });
  const wallThickness = Math.max(0.08, Math.min(widthFt, lengthFt) / 500);
  const walls = [
    { width: widthFt, depth: wallThickness, x: widthFt / 2, z: 0 },
    { width: widthFt, depth: wallThickness, x: widthFt / 2, z: lengthFt },
  ];
  for (const wall of walls) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wall.width, eaveHeightFt, wall.depth),
      wallMaterial
    );
    mesh.position.set(wall.x, eaveHeightFt / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    content.add(mesh);
  }
  for (const x of [0, widthFt]) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, eaveHeightFt, lengthFt),
      wallMaterial
    );
    mesh.position.set(x, eaveHeightFt / 2, lengthFt / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    content.add(mesh);
  }
  if (shell.roofId !== "hip") {
    const endShape = new THREE.Shape();
    endShape.moveTo(0, eaveHeightFt);
    for (const point of shell.roofProfile) endShape.lineTo(point.xFt, point.heightFt);
    endShape.lineTo(widthFt, eaveHeightFt);
    endShape.closePath();
    for (const z of [0, lengthFt]) {
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(endShape), wallMaterial);
      cap.position.z = z;
      cap.castShadow = true;
      content.add(cap);
    }
  }
  for (const surface of shell.roofSurfaces) {
    const roof = new THREE.Mesh(polygonGeometry(THREE, surface.vertices), roofMaterial);
    roof.castShadow = true;
    content.add(roof);
  }

  const edgePoints: ThreeTypes.Vector3[] = [];
  for (const surface of shell.roofSurfaces) {
    for (let index = 0; index < surface.vertices.length; index += 1) {
      const start = surface.vertices[index];
      const end = surface.vertices[(index + 1) % surface.vertices.length];
      edgePoints.push(
        new THREE.Vector3(start.xFt, start.yFt, start.zFt),
        new THREE.Vector3(end.xFt, end.yFt, end.zFt)
      );
    }
  }
  const roofEdges = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(edgePoints),
    new THREE.LineBasicMaterial({ color: shell.trimColorHex ?? FALLBACK_TRIM })
  );
  content.add(roofEdges);

  for (const opening of scene.openings) {
    const openingColor =
      opening.typeId === "window" || opening.typeId === "skylight" ? "#8fc1cb" : "#d7d4c7";
    const material = new THREE.MeshStandardMaterial({ color: openingColor, roughness: 0.38 });
    if (opening.surface === "roof") {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(opening.widthFt!, 0.08, opening.heightFt!),
        material
      );
      marker.position.set(
        opening.roofXFt! + opening.widthFt! / 2,
        Math.max(...shell.roofProfile.map((point) => point.heightFt)) + 0.1,
        opening.roofZFt! + opening.heightFt! / 2
      );
      content.add(marker);
      continue;
    }
    const physical = physicalWallOpening(opening, widthFt, lengthFt);
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(opening.widthFt!, opening.heightFt!, wallThickness * 1.6),
      material
    );
    marker.position.set(physical.xFt, opening.sillHeightFt! + opening.heightFt! / 2, physical.zFt);
    marker.rotation.y = physical.rotationY;
    content.add(marker);
  }

  for (const attachment of scene.attachments) {
    const points = attachment.footprint.map(
      (point) => new THREE.Vector3(point.xFt, 0.08, point.zFt)
    );
    points.push(points[0].clone());
    content.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: "#b25732" })
      )
    );
    if (attachment.verticalResolved && attachment.roofSurface) {
      const roof = new THREE.Mesh(polygonGeometry(THREE, attachment.roofSurface), roofMaterial);
      roof.castShadow = true;
      content.add(roof);
      const outerHeight = Math.min(...attachment.roofSurface.map((point) => point.yFt));
      attachment.roofSurface.forEach((point) => {
        if (Math.abs(point.yFt - outerHeight) > 0.01 || point.yFt <= 0) return;
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(wallThickness * 2, point.yFt, wallThickness * 2),
          trimMaterial
        );
        post.position.set(point.xFt, point.yFt / 2, point.zFt);
        content.add(post);
      });
    }
  }

  const accessoryMaterial = new THREE.MeshStandardMaterial({ color: "#b25732" });
  scene.accessories.forEach((accessory) => {
    if (accessory.surface === "whole-building") return;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.18, Math.min(widthFt, lengthFt) / 80), 12, 8),
      accessoryMaterial
    );
    if (accessory.surface === "roof") {
      marker.position.set(
        accessory.offsetFt!,
        (getSceneRoofHeightAtPoint(scene, accessory.offsetFt!, accessory.secondaryOffsetFt!) ??
          eaveHeightFt) + 0.3,
        accessory.secondaryOffsetFt!
      );
    } else if (accessory.surface === "front") {
      marker.position.set(accessory.offsetFt!, accessory.elevationFt!, -0.08);
    } else if (accessory.surface === "rear") {
      marker.position.set(widthFt - accessory.offsetFt!, accessory.elevationFt!, lengthFt + 0.08);
    } else if (accessory.surface === "left") {
      marker.position.set(-0.08, accessory.elevationFt!, accessory.offsetFt!);
    } else {
      marker.position.set(widthFt + 0.08, accessory.elevationFt!, lengthFt - accessory.offsetFt!);
    }
    content.add(marker);
  });

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(widthFt + 0.8, 0.12, lengthFt + 0.8),
    new THREE.MeshStandardMaterial({ color: "#b9b8af", roughness: 0.95 })
  );
  slab.position.set(widthFt / 2, -0.08, lengthFt / 2);
  slab.receiveShadow = true;
  content.add(slab);

  const columnGeometry = new THREE.BoxGeometry(0.16, eaveHeightFt, 0.16);
  for (const [x, z] of [
    [0, 0],
    [widthFt, 0],
    [widthFt, lengthFt],
    [0, lengthFt],
  ]) {
    const column = new THREE.Mesh(columnGeometry, trimMaterial);
    column.position.set(x, eaveHeightFt / 2, z);
    content.add(column);
  }
  return content;
}

function ThreeCanvas({ scene }: { scene: BuildingMeasuredScene }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || !scene.shell) return;
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus("loading");
    void Promise.all([import("three"), import("three/examples/jsm/controls/OrbitControls.js")])
      .then(([THREE, { OrbitControls }]) => {
        if (cancelled) return;
        try {
          const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.shadowMap.enabled = true;
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          const threeScene = new THREE.Scene();
          threeScene.background = new THREE.Color("#e6ece9");
          const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 4000);
          const controls = new OrbitControls(camera, canvas);
          canvas.style.touchAction = "pan-y";
          controls.enableDamping = false;
          controls.screenSpacePanning = true;
          controls.maxPolarAngle = Math.PI / 2.02;
          const content = buildThreeContent(THREE, scene);
          threeScene.add(content);
          threeScene.add(new THREE.HemisphereLight("#fff8ec", "#64736a", 2.1));
          const sun = new THREE.DirectionalLight("#fff2d7", 3.2);
          const maxDimension = Math.max(scene.shell!.widthFt, scene.shell!.lengthFt);
          sun.position.set(maxDimension, maxDimension * 1.4, -maxDimension * 0.6);
          sun.castShadow = true;
          threeScene.add(sun);
          const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(maxDimension * 5, maxDimension * 5),
            new THREE.MeshStandardMaterial({ color: "#82907c", roughness: 1 })
          );
          ground.rotation.x = -Math.PI / 2;
          ground.position.y = -0.16;
          ground.receiveShadow = true;
          threeScene.add(ground);
          camera.position.set(
            scene.shell!.widthFt * 1.15,
            Math.max(scene.shell!.eaveHeightFt * 2.4, maxDimension * 0.7),
            -scene.shell!.lengthFt * 1.05
          );
          controls.target.set(
            scene.shell!.widthFt / 2,
            scene.shell!.eaveHeightFt * 0.45,
            scene.shell!.lengthFt / 2
          );
          controls.update();
          const render = () => renderer.render(threeScene, camera);
          const resize = () => {
            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            render();
          };
          controls.addEventListener("change", render);
          const resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(host);
          resize();
          setStatus("ready");
          cleanup = () => {
            resizeObserver.disconnect();
            controls.removeEventListener("change", render);
            controls.dispose();
            disposeObject(content);
            ground.geometry.dispose();
            (ground.material as ThreeTypes.Material).dispose();
            renderer.dispose();
          };
        } catch {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [scene]);

  return (
    <div
      ref={hostRef}
      className="relative min-h-[28rem] overflow-hidden rounded-2xl bg-[#e6ece9]"
      data-testid="building-view-3d"
      data-scene-fingerprint={scene.fingerprint}
    >
      <canvas
        ref={canvasRef}
        className={status === "unavailable" ? "hidden" : "h-[28rem] w-full"}
        aria-label="Orbitable measured metal-building model"
      />
      {status === "loading" ? (
        <p className="absolute inset-0 grid place-items-center text-sm font-semibold text-[#53635f]">
          Loading measured 3D model…
        </p>
      ) : null}
      {status === "unavailable" ? (
        <div className="absolute inset-0 grid place-items-center p-8 text-center" role="status">
          <div className="max-w-md rounded-2xl border border-[#18312f]/15 bg-white/90 p-6">
            <p className="font-bold text-[#18312f]">Interactive 3D unavailable in this browser.</p>
            <p className="mt-2 text-sm leading-6 text-[#5f6e69]">
              The measured plan and four elevations remain available. This fallback does not pretend
              to be a 3D render.
            </p>
            <p className="mt-3 text-xs font-semibold text-[#18312f]">
              {scene.shell?.widthFt} × {scene.shell?.lengthFt} × {scene.shell?.eaveHeightFt} ft eave
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function planBounds(scene: BuildingMeasuredScene) {
  const shell = scene.shell!;
  const points = scene.attachments.flatMap((attachment) => attachment.footprint);
  const xs = [0, shell.widthFt, ...points.map((point) => point.xFt)];
  const zs = [0, shell.lengthFt, ...points.map((point) => point.zFt)];
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function planOpeningLine(
  opening: MeasuredBuildingOpening,
  shell: NonNullable<BuildingMeasuredScene["shell"]>
) {
  const width = opening.widthFt!;
  const offset = opening.offsetFt!;
  if (opening.surface === "front") return { x1: offset, z1: 0, x2: offset + width, z2: 0 };
  if (opening.surface === "rear") {
    return {
      x1: shell.widthFt - offset,
      z1: shell.lengthFt,
      x2: shell.widthFt - offset - width,
      z2: shell.lengthFt,
    };
  }
  if (opening.surface === "left") return { x1: 0, z1: offset, x2: 0, z2: offset + width };
  if (opening.surface === "right") {
    return {
      x1: shell.widthFt,
      z1: shell.lengthFt - offset,
      x2: shell.widthFt,
      z2: shell.lengthFt - offset - width,
    };
  }
  return null;
}

function PlanView({ scene }: { scene: BuildingMeasuredScene }) {
  const shell = scene.shell!;
  const bounds = planBounds(scene);
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanZ = Math.max(1, bounds.maxZ - bounds.minZ);
  const scale = Math.min(580 / spanX, 330 / spanZ);
  const x = (feet: number) => 90 + (feet - bounds.minX) * scale;
  const z = (feet: number) => 75 + (feet - bounds.minZ) * scale;
  return (
    <svg
      viewBox="0 0 760 480"
      role="img"
      aria-label="Measured metal-building floor plan"
      className="min-h-[28rem] w-full rounded-2xl bg-[#f6f3ec]"
      data-testid="building-view-plan"
      data-scene-fingerprint={scene.fingerprint}
    >
      <rect
        x={x(0)}
        y={z(0)}
        width={shell.widthFt * scale}
        height={shell.lengthFt * scale}
        fill={shell.wallColorHex ?? "#d3d8d4"}
        fillOpacity="0.28"
        stroke={shell.trimColorHex ?? FALLBACK_TRIM}
        strokeWidth="4"
      />
      {scene.attachments.map((attachment) => {
        const xs = attachment.footprint.map((point) => point.xFt);
        const zs = attachment.footprint.map((point) => point.zFt);
        return (
          <g key={attachment.id} data-testid={`building-attachment-${attachment.id}`}>
            <rect
              x={x(Math.min(...xs))}
              y={z(Math.min(...zs))}
              width={(Math.max(...xs) - Math.min(...xs)) * scale}
              height={(Math.max(...zs) - Math.min(...zs)) * scale}
              fill={attachment.verticalResolved ? "#b2573226" : "transparent"}
              stroke="#b25732"
              strokeWidth="3"
              strokeDasharray={attachment.verticalResolved ? undefined : "8 6"}
            />
            {!attachment.verticalResolved ? (
              <title>Footprint only — height and roof connection unresolved</title>
            ) : null}
          </g>
        );
      })}
      {scene.openings.map((opening) => {
        if (opening.surface === "roof") {
          return (
            <rect
              key={opening.id}
              x={x(opening.roofXFt!)}
              y={z(opening.roofZFt!)}
              width={opening.widthFt! * scale}
              height={opening.heightFt! * scale}
              fill="#8fc1cb88"
              stroke="#275967"
              strokeWidth="2"
              data-testid={`building-opening-${opening.id}`}
              data-offset-ft={`${opening.roofXFt},${opening.roofZFt}`}
            />
          );
        }
        const line = planOpeningLine(opening, shell)!;
        return (
          <line
            key={opening.id}
            x1={x(line.x1)}
            y1={z(line.z1)}
            x2={x(line.x2)}
            y2={z(line.z2)}
            stroke="#b25732"
            strokeWidth="8"
            data-testid={`building-opening-${opening.id}`}
            data-offset-ft={opening.offsetFt ?? undefined}
          />
        );
      })}
      {scene.accessories.map((accessory) => {
        if (accessory.surface === "whole-building") return null;
        let point: { xFt: number; zFt: number };
        if (accessory.surface === "roof") {
          point = { xFt: accessory.offsetFt!, zFt: accessory.secondaryOffsetFt! };
        } else if (accessory.surface === "front") {
          point = { xFt: accessory.offsetFt!, zFt: 0 };
        } else if (accessory.surface === "rear") {
          point = { xFt: shell.widthFt - accessory.offsetFt!, zFt: shell.lengthFt };
        } else if (accessory.surface === "left") {
          point = { xFt: 0, zFt: accessory.offsetFt! };
        } else {
          point = { xFt: shell.widthFt, zFt: shell.lengthFt - accessory.offsetFt! };
        }
        return (
          <circle
            key={accessory.id}
            cx={x(point.xFt)}
            cy={z(point.zFt)}
            r="6"
            fill="#b25732"
            stroke="white"
            strokeWidth="2"
            data-testid={`building-accessory-${accessory.id}`}
          />
        );
      })}
      <g fill="#18312f" fontFamily="ui-sans-serif, system-ui" fontSize="14" fontWeight="700">
        <text x={x(0) + (shell.widthFt * scale) / 2} y={z(0) - 22} textAnchor="middle">
          {shell.widthFt} ft
        </text>
        <text
          x={x(0) - 28}
          y={z(0) + (shell.lengthFt * scale) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${x(0) - 28} ${z(0) + (shell.lengthFt * scale) / 2})`}
        >
          {shell.lengthFt} ft
        </text>
        <text x={x(0) + 10} y={z(0) + 22}>
          FRONT
        </text>
      </g>
    </svg>
  );
}

function elevationProfile(scene: BuildingMeasuredScene, wall: BuildingWall): MeasuredPoint2[] {
  const shell = scene.shell!;
  if (wall === "front") return shell.roofProfile;
  if (wall === "rear") {
    return shell.roofProfile
      .map((point) => ({ xFt: shell.widthFt - point.xFt, heightFt: point.heightFt }))
      .reverse();
  }
  const span = shell.lengthFt;
  if (shell.roofId === "hip") {
    const ridgeInset = Math.min(shell.lengthFt / 2, shell.widthFt / 2);
    const ridgeHeight = shell.eaveHeightFt + (shell.widthFt / 2) * (shell.roofPitchRise12 / 12);
    return [
      { xFt: 0, heightFt: shell.eaveHeightFt },
      { xFt: ridgeInset, heightFt: ridgeHeight },
      { xFt: span - ridgeInset, heightFt: ridgeHeight },
      { xFt: span, heightFt: shell.eaveHeightFt },
    ];
  }
  const physicalX = wall === "left" ? 0 : shell.widthFt;
  const height = shell.roofProfile.reduce((result, point, index, profile) => {
    if (index === 0) return result;
    const left = profile[index - 1];
    const right = point;
    if (physicalX < left.xFt || physicalX > right.xFt || left.xFt === right.xFt) return result;
    const fraction = (physicalX - left.xFt) / (right.xFt - left.xFt);
    return left.heightFt + (right.heightFt - left.heightFt) * fraction;
  }, shell.eaveHeightFt);
  return [
    { xFt: 0, heightFt: height },
    { xFt: span, heightFt: height },
  ];
}

function ElevationView({ scene, wall }: { scene: BuildingMeasuredScene; wall: BuildingWall }) {
  const shell = scene.shell!;
  const span = wall === "front" || wall === "rear" ? shell.widthFt : shell.lengthFt;
  const profile = elevationProfile(scene, wall);
  const maxHeight = Math.max(shell.eaveHeightFt, ...profile.map((point) => point.heightFt));
  const scale = Math.min(580 / Math.max(1, span), 320 / Math.max(1, maxHeight));
  const x = (feet: number) => 90 + feet * scale;
  const y = (feet: number) => 410 - feet * scale;
  const roofPath = profile.map((point) => `${x(point.xFt)},${y(point.heightFt)}`).join(" ");
  const wallOpenings = scene.openings.filter((opening) => opening.surface === wall);
  const attachments = scene.attachments.filter((attachment) => attachment.wall === wall);
  const wallAccessories = scene.accessories.filter((accessory) => accessory.surface === wall);
  return (
    <svg
      viewBox="0 0 760 480"
      role="img"
      aria-label={`${wall} measured building elevation`}
      className="min-h-[28rem] w-full rounded-2xl bg-[#f6f3ec]"
      data-testid={`building-view-${wall}`}
      data-scene-fingerprint={scene.fingerprint}
    >
      <rect
        x={x(0)}
        y={y(shell.eaveHeightFt)}
        width={span * scale}
        height={shell.eaveHeightFt * scale}
        fill={shell.wallColorHex ?? "#cbd2ce"}
        stroke={shell.trimColorHex ?? FALLBACK_TRIM}
        strokeWidth="3"
      />
      <polyline
        points={roofPath}
        fill="none"
        stroke={shell.roofColorHex ?? FALLBACK_ROOF}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      {wallOpenings.map((opening) => (
        <g
          key={opening.id}
          data-testid={`building-opening-${opening.id}`}
          data-offset-ft={opening.offsetFt ?? undefined}
        >
          <rect
            x={x(opening.offsetFt!)}
            y={y(opening.sillHeightFt! + opening.heightFt!)}
            width={opening.widthFt! * scale}
            height={opening.heightFt! * scale}
            fill={opening.typeId === "window" ? "#8fc1cb" : "#d7d4c7"}
            stroke={shell.trimColorHex ?? FALLBACK_TRIM}
            strokeWidth="2"
          />
          <title>{getBuildingOpening(opening.typeId)?.label}</title>
        </g>
      ))}
      {attachments.map((attachment) => {
        const connectionHeight = attachment.verticalResolved
          ? attachment.eaveHeightFt! + (attachment.projectionFt! * attachment.roofPitchRise12!) / 12
          : Math.min(2, shell.eaveHeightFt);
        return (
          <g key={attachment.id} data-testid={`building-attachment-${attachment.id}`}>
            <rect
              x={x(attachment.offsetFt!)}
              y={y(connectionHeight)}
              width={attachment.widthFt! * scale}
              height={connectionHeight * scale}
              fill={attachment.verticalResolved ? "#b2573222" : "transparent"}
              stroke="#b25732"
              strokeWidth="3"
              strokeDasharray={attachment.verticalResolved ? undefined : "8 6"}
            />
            {!attachment.verticalResolved ? (
              <text
                x={x(attachment.offsetFt!)}
                y={y(0) + 30}
                fill="#8b4128"
                fontSize="12"
                fontWeight="700"
              >
                Footprint only — height and roof connection unresolved
              </text>
            ) : null}
          </g>
        );
      })}
      {wallAccessories.map((accessory) => (
        <g key={accessory.id} data-testid={`building-accessory-${accessory.id}`}>
          <circle
            cx={x(accessory.offsetFt!)}
            cy={y(accessory.elevationFt!)}
            r="7"
            fill="#b25732"
            stroke="white"
            strokeWidth="2"
          />
          <title>{getBuildingAccessory(accessory.typeId)?.label}</title>
        </g>
      ))}
      <g fill="#18312f" fontFamily="ui-sans-serif, system-ui" fontSize="14" fontWeight="700">
        <text x={x(span / 2)} y="446" textAnchor="middle">
          {span} ft
        </text>
        <text
          x="36"
          y={y(shell.eaveHeightFt / 2)}
          textAnchor="middle"
          transform={`rotate(-90 36 ${y(shell.eaveHeightFt / 2)})`}
        >
          {shell.eaveHeightFt} ft eave
        </text>
        <text x="90" y="38">
          {wall.toUpperCase()} ELEVATION
        </text>
      </g>
    </svg>
  );
}

export default function BuildingThreePreview({ scene }: { scene: BuildingMeasuredScene }) {
  const [view, setView] = useState<PreviewView>("3d");
  const unresolvedAttachments = useMemo(
    () => scene.attachments.filter((attachment) => !attachment.verticalResolved),
    [scene.attachments]
  );
  return (
    <section aria-label="Measured building views" data-scene-fingerprint={scene.fingerprint}>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Building view">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={view === option.id}
            onClick={() => setView(option.id)}
            className={`min-h-10 rounded-full px-4 text-xs font-bold transition ${
              view === option.id
                ? "bg-[#18312f] text-white"
                : "border border-[#18312f]/15 bg-white text-[#18312f] hover:border-[#18312f]/35"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!scene.shell ? (
        <div
          className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-[#18312f]/25 bg-[#edf1ee] p-8 text-center"
          data-testid="building-view-blank"
          data-scene-fingerprint={scene.fingerprint}
        >
          <div className="max-w-md">
            <p className="font-bold text-[#18312f]">No measured building geometry yet</p>
            <p className="mt-2 text-sm leading-6 text-[#5f6e69]">
              Choose a use, structural system, shell dimensions, roof family, and roof pitch. The
              planner will not invent them.
            </p>
          </div>
        </div>
      ) : view === "3d" ? (
        <ThreeCanvas scene={scene} />
      ) : view === "plan" ? (
        <PlanView scene={scene} />
      ) : (
        <ElevationView scene={scene} wall={view} />
      )}
      {unresolvedAttachments.length > 0 ? (
        <p className="mt-3 rounded-xl border border-[#b25732]/25 bg-[#fff5ef] px-4 py-3 text-xs font-semibold text-[#7a3c27]">
          {unresolvedAttachments.length} attachment
          {unresolvedAttachments.length === 1 ? " is" : "s are"} footprint only — height and roof
          connection unresolved.
        </p>
      ) : null}
      {scene.shell ? (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#5f6e69]">
          <span>
            {scene.shell.widthFt} × {scene.shell.lengthFt} × {scene.shell.eaveHeightFt} ft eave
          </span>
          <span>
            {scene.openings.length} placed opening{scene.openings.length === 1 ? "" : "s"}
          </span>
          <span>
            {scene.attachments.length} attachment{scene.attachments.length === 1 ? "" : "s"}
          </span>
          <span>
            {scene.accessories.length} accessor{scene.accessories.length === 1 ? "y" : "ies"}
          </span>
        </div>
      ) : null}
    </section>
  );
}
