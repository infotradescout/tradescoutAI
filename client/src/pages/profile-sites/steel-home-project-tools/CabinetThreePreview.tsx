import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  getCabinetModuleBounds,
  reconcileCabinetPlannerExtension,
  type CabinetPlannerExtensionV1,
  type CabinetPlannerModule,
  type CabinetShellItem,
} from "./cabinetPlannerModel";

type Props = {
  planner: CabinetPlannerExtensionV1;
  onSelectModule: (moduleId: string) => void;
};

type Runtime = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  render: () => void;
};

export type CabinetPreviewBox = {
  id: string;
  category: "module" | "shell-item";
  kind: string;
  centerIn: [number, number, number];
  sizeIn: [number, number, number];
};

const MODULE_COLORS: Record<CabinetPlannerModule["kind"], string> = {
  "base-cabinet": "#a56f42",
  "wall-cabinet": "#c08b59",
  "tall-cabinet": "#805437",
  appliance: "#596461",
  island: "#a94f2e",
};

const SHELL_ITEM_COLORS: Record<CabinetShellItem["kind"], string> = {
  door: "#254f4a",
  window: "#78a9af",
  obstacle: "#8c342a",
  water: "#2d78a5",
  drain: "#273f50",
  electric: "#d29229",
  vent: "#78817e",
};

function shellItemBox(
  planner: CabinetPlannerExtensionV1,
  item: CabinetShellItem
): CabinetPreviewBox | null {
  const roomWidth = planner.shell.widthIn;
  const roomDepth = planner.shell.depthIn;
  if (roomWidth === null || roomDepth === null) return null;
  const centerY = item.elevationIn + item.heightIn / 2;
  if (item.wall === "north") {
    return {
      id: item.id,
      category: "shell-item",
      kind: item.kind,
      centerIn: [item.offsetIn + item.widthIn / 2, centerY, 0],
      sizeIn: [item.widthIn, item.heightIn, Math.max(1, item.depthIn)],
    };
  }
  if (item.wall === "south") {
    return {
      id: item.id,
      category: "shell-item",
      kind: item.kind,
      centerIn: [roomWidth - item.offsetIn - item.widthIn / 2, centerY, roomDepth],
      sizeIn: [item.widthIn, item.heightIn, Math.max(1, item.depthIn)],
    };
  }
  if (item.wall === "east") {
    return {
      id: item.id,
      category: "shell-item",
      kind: item.kind,
      centerIn: [roomWidth, centerY, item.offsetIn + item.widthIn / 2],
      sizeIn: [Math.max(1, item.depthIn), item.heightIn, item.widthIn],
    };
  }
  return {
    id: item.id,
    category: "shell-item",
    kind: item.kind,
    centerIn: [0, centerY, roomDepth - item.offsetIn - item.widthIn / 2],
    sizeIn: [Math.max(1, item.depthIn), item.heightIn, item.widthIn],
  };
}

export function buildCabinetPreviewSnapshot(
  plannerInput: CabinetPlannerExtensionV1
): CabinetPreviewBox[] {
  const planner = reconcileCabinetPlannerExtension(plannerInput);
  const moduleBoxes = planner.modules.flatMap((module) => {
    const bounds = getCabinetModuleBounds(planner, module);
    if (!bounds) return [];
    return [
      {
        id: module.id,
        category: "module" as const,
        kind: module.kind,
        centerIn: [
          (bounds.x1 + bounds.x2) / 2,
          (bounds.y1 + bounds.y2) / 2,
          (bounds.z1 + bounds.z2) / 2,
        ] as [number, number, number],
        sizeIn: [bounds.x2 - bounds.x1, bounds.y2 - bounds.y1, bounds.z2 - bounds.z1] as [
          number,
          number,
          number,
        ],
      },
    ];
  });
  return [
    ...moduleBoxes,
    ...planner.shellItems.flatMap((item) => {
      const box = shellItemBox(planner, item);
      return box ? [box] : [];
    }),
  ];
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function toFeet(valueIn: number) {
  return valueIn / 12;
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  options: { opacity?: number; moduleId?: string; outline?: boolean } = {}
) {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.03,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.userData.moduleId = options.moduleId;
  parent.add(mesh);
  if (options.outline) {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: "#17201f", transparent: true, opacity: 0.48 })
    );
    outline.position.copy(mesh.position);
    parent.add(outline);
  }
  return mesh;
}

function buildScene(content: THREE.Group, planner: CabinetPlannerExtensionV1) {
  const widthIn = planner.shell.widthIn;
  const depthIn = planner.shell.depthIn;
  const heightIn = planner.shell.heightIn;
  if (widthIn === null || depthIn === null || heightIn === null) return;
  const width = toFeet(widthIn);
  const depth = toFeet(depthIn);
  const height = toFeet(heightIn);
  const wallThickness = 0.08;

  addBox(content, [width, 0.08, depth], [0, -0.04, 0], "#cbbca6");
  addBox(content, [width, height, wallThickness], [0, height / 2, -depth / 2], "#ece6dc", {
    opacity: 0.72,
  });
  addBox(content, [wallThickness, height, depth], [-width / 2, height / 2, 0], "#e2dbd0", {
    opacity: 0.62,
  });
  addBox(content, [width, height, wallThickness], [0, height / 2, depth / 2], "#ece6dc", {
    opacity: 0.2,
  });
  addBox(content, [wallThickness, height, depth], [width / 2, height / 2, 0], "#e2dbd0", {
    opacity: 0.2,
  });

  for (const box of buildCabinetPreviewSnapshot(planner)) {
    const center: [number, number, number] = [
      toFeet(box.centerIn[0]) - width / 2,
      toFeet(box.centerIn[1]),
      toFeet(box.centerIn[2]) - depth / 2,
    ];
    const size = box.sizeIn.map(toFeet) as [number, number, number];
    if (box.category === "module") {
      addBox(content, size, center, MODULE_COLORS[box.kind as CabinetPlannerModule["kind"]], {
        moduleId: box.id,
        outline: true,
      });
    } else {
      addBox(content, size, center, SHELL_ITEM_COLORS[box.kind as CabinetShellItem["kind"]], {
        opacity: box.kind === "window" ? 0.5 : 0.82,
        outline: true,
      });
    }
  }
}

export default function CabinetThreePreview({ planner, onSelectModule }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const canonicalPlanner = useMemo(() => reconcileCabinetPlannerExtension(planner), [planner]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let content: THREE.Group | null = null;
    let resizeObserver: ResizeObserver | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor("#d8d0c2");
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#d8d0c2");
      const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
      content = new THREE.Group();
      scene.add(content);
      buildScene(content, canonicalPlanner);
      scene.add(new THREE.HemisphereLight("#fff7ea", "#57625e", 2.2));
      const keyLight = new THREE.DirectionalLight("#fff5df", 2.8);
      keyLight.position.set(8, 14, 10);
      scene.add(keyLight);

      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = false;
      controls.screenSpacePanning = false;
      canvas.style.touchAction = "pan-y";
      const render = () => renderer?.render(scene, camera);
      controls.addEventListener("change", render);

      const bounds = new THREE.Box3().setFromObject(content);
      const center = bounds.isEmpty()
        ? new THREE.Vector3(0, 3, 0)
        : bounds.getCenter(new THREE.Vector3());
      const size = bounds.isEmpty()
        ? new THREE.Vector3(12, 8, 12)
        : bounds.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.y, size.z, 8);
      controls.target.copy(center);
      camera.position.set(center.x + span * 0.82, center.y + span * 0.62, center.z + span * 0.92);
      camera.near = Math.max(0.05, span / 200);
      camera.far = Math.max(100, span * 10);
      controls.minDistance = Math.max(2, span * 0.2);
      controls.maxDistance = Math.max(30, span * 4);

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth || canvas.parentElement?.clientWidth || 1);
        const height = Math.max(1, canvas.clientHeight || canvas.parentElement?.clientHeight || 1);
        renderer?.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
      };
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
      } else {
        window.addEventListener("resize", resize);
      }
      resize();
      runtimeRef.current = { renderer, camera, controls, content, render };
      setError(null);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const select = (event: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster
          .intersectObjects(content?.children || [], true)
          .find((intersection) => typeof intersection.object.userData.moduleId === "string");
        if (hit) onSelectModule(hit.object.userData.moduleId as string);
      };
      canvas.addEventListener("pointerup", select);

      return () => {
        canvas.removeEventListener("pointerup", select);
        window.removeEventListener("resize", resize);
        resizeObserver?.disconnect();
        controls?.removeEventListener("change", render);
        controls?.dispose();
        if (content) disposeObject(content);
        renderer?.dispose();
        canvas.style.touchAction = "";
        runtimeRef.current = null;
      };
    } catch {
      controls?.dispose();
      if (content) disposeObject(content);
      renderer?.dispose();
      runtimeRef.current = null;
      setError(
        "This browser could not start the orbitable room. Use the measured plan and elevations instead."
      );
      return undefined;
    }
  }, [attempt, canonicalPlanner, onSelectModule]);

  const orbit = useCallback((direction: -1 | 1) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const offset = runtime.camera.position.clone().sub(runtime.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI * 0.12);
    runtime.camera.position.copy(runtime.controls.target).add(offset);
    runtime.camera.lookAt(runtime.controls.target);
    runtime.controls.update();
    runtime.render();
  }, []);

  const zoom = useCallback((factor: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const offset = runtime.camera.position
      .clone()
      .sub(runtime.controls.target)
      .multiplyScalar(factor);
    runtime.camera.position.copy(runtime.controls.target).add(offset);
    runtime.controls.update();
    runtime.render();
  }, []);

  return (
    <div
      className="relative h-full min-h-[24rem] overflow-hidden bg-[#d8d0c2]"
      data-testid="steel-home-cabinet-three-preview"
    >
      <canvas
        key={attempt}
        ref={canvasRef}
        className="block h-full w-full touch-pan-y"
        aria-label="Orbitable cabinet room. Drag sideways to orbit, use two fingers or the wheel to zoom, and select a modeled module."
        aria-hidden={error ? true : undefined}
      />
      {error ? (
        <div
          className="absolute inset-0 grid place-items-center bg-[#17201f] p-6 text-center text-white"
          role="alert"
        >
          <div className="max-w-sm">
            <p className="text-sm font-black">3D room unavailable</p>
            <p className="mt-2 text-xs leading-5 text-white/70">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-4 rounded-full bg-[#f0b392] px-4 py-2 text-xs font-black text-[#18312f]"
            >
              Retry 3D
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-[#101817]/88 px-3 py-2 text-white shadow-lg">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
              Canonical 3D room
            </p>
            <p className="mt-1 text-xs font-semibold text-white/70">Drag to orbit · tap a module</p>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1.5" aria-label="3D view controls">
            <button
              type="button"
              onClick={() => orbit(-1)}
              aria-label="Orbit left"
              className="rounded-full bg-white px-3 py-2 text-xs font-black shadow"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => orbit(1)}
              aria-label="Orbit right"
              className="rounded-full bg-white px-3 py-2 text-xs font-black shadow"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => zoom(0.82)}
              aria-label="Zoom in"
              className="rounded-full bg-white px-3 py-2 text-xs font-black shadow"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoom(1.22)}
              aria-label="Zoom out"
              className="rounded-full bg-white px-3 py-2 text-xs font-black shadow"
            >
              −
            </button>
          </div>
        </>
      )}
    </div>
  );
}
