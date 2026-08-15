import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Hammer,
  Plus,
  Ruler,
  Search,
  Share2,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { JW_STONE_NAMED_CATALOG, getCatalogItemById } from "@/features/jw-stone/catalog";
import { isHandScaleCoverImage } from "@/features/jw-stone/coverImages";
import {
  formatSlabDimension,
  resolveSlabDimensionForInventoryImage,
} from "@/features/jw-stone/slabDimensions";
import { share } from "@/utils/share";
import {
  COUNTERTOP_BACKSPLASH_OPTIONS,
  COUNTERTOP_CAMERA_PRESET_OPTIONS,
  COUNTERTOP_COOKTOP_OPTIONS,
  COUNTERTOP_EDGE_OPTIONS,
  COUNTERTOP_LAYOUT_OPTIONS,
  COUNTERTOP_OTHER_CUTOUT_OPTIONS,
  COUNTERTOP_ROOM_OPTIONS,
  COUNTERTOP_SINK_OPTIONS,
  COUNTERTOP_VEIN_ROTATION_OPTIONS,
  COUNTERTOP_WATERFALL_OPTIONS,
  calculateCountertopSquareFeet,
  getAvailableCountertopCutoutRuns,
  getCountertopCutoutRunDepth,
  getCountertopCutoutRunLabel,
  getCountertopCutoutRunLength,
  getCountertopCutoutStartLabel,
  reconcileSteelHomeProjectDraft,
  type CountertopCutoutRun,
  type SteelHomeCountertopDesign,
  type SteelHomeCountertopCutout,
} from "./projectModel";
import {
  COUNTERTOP_PLANNER_MEASUREMENTS_SHARE_PARAM,
  addCountertopPlannerExtensionToShareUrl,
  getCountertopPlannerExtensionSnapshot,
  getCountertopPlannerDiagnostics,
  getCountertopPlannerOpeningFrontBounds,
  getCountertopPlannerOpeningSchedule,
  getCountertopPlannerPlacementProblems,
  getCountertopPlannerRequestReadiness,
  parseCountertopPlannerExtensionFromShareUrl,
  resolveCountertopPlannerDesign,
  withCountertopPlannerExtension,
  type CountertopPlannerDesign,
  type CountertopPlannerDesignInput,
  type CountertopPlannerExtension,
  type CountertopPlannerOpeningScheduleItem,
} from "./countertopPlannerModel";
import {
  PROJECT_FIELD_CLASS,
  PROJECT_TEXTAREA_CLASS,
  ProjectNumberField,
  ProjectSelect,
  ProjectTextSelect,
  ProjectToggle,
} from "./ProjectToolControls";
import type { StoneSurfaceTarget } from "./StoneVisualizer3D";
import {
  COUNTERTOP_STUDIO_SHARE_PARAM,
  buildCountertopStudioShareUrl,
  parseCountertopStudioShareUrl,
} from "./countertopStudioShare";
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerImageHref,
  buildStoneDesignerPhotoKey,
} from "./stoneDesignerImages";

const StoneVisualizer3D = lazy(() => import("./StoneVisualizer3D"));

type Props = {
  design: CountertopPlannerDesignInput;
  onChange: (design: CountertopPlannerDesignInput) => void;
  onRequest: (intent: "stone" | "fabricator") => void;
};

const allNamedStones = [...JW_STONE_NAMED_CATALOG].sort((a, b) =>
  a.publicLabel.localeCompare(b.publicLabel)
);

const stoneMaterialOptions = Array.from(
  new Set(allNamedStones.flatMap((stone) => (stone.materialLabel ? [stone.materialLabel] : [])))
).sort((a, b) => a.localeCompare(b));

function layoutLabel(design: SteelHomeCountertopDesign): string {
  return (
    COUNTERTOP_LAYOUT_OPTIONS.find((option) => option.value === design.layout)?.label ||
    "Selected layout"
  );
}

type RunGeometry = {
  x: number;
  y: number;
  length: number;
  angle: 0 | 90;
};

type DiagramGeometry = {
  depth: number;
  topX: number;
  topY: number;
  topRunWidth: number;
  leftRunHeight: number;
  rightRunHeight: number;
  islandX: number;
  islandY: number;
  islandWidth: number;
  islandHeight: number;
  layoutPath: string;
  runs: Partial<Record<CountertopCutoutRun, RunGeometry>>;
};

function buildDiagramGeometry(design: SteelHomeCountertopDesign): DiagramGeometry {
  const depth = Math.min(96, Math.max(32, design.wallDepthIn * 2.2));
  const rawTopRunWidth = Math.min(500, Math.max(170, design.wallAIn * 1.65));
  const topRunWidth =
    design.layout === "u-shape" ? Math.max(depth * 2 + 100, rawTopRunWidth) : rawTopRunWidth;
  const topX = (760 - topRunWidth) / 2;
  const topY = design.layout === "straight" ? 116 : 72;
  const leftRunHeight = Math.min(176, Math.max(88, design.wallBIn * 0.82));
  const rightRunHeight = Math.min(176, Math.max(88, design.wallCIn * 0.82));
  const layoutPath =
    design.layout === "straight"
      ? `M${topX} ${topY} H${topX + topRunWidth} V${topY + depth} H${topX} Z`
      : design.layout === "l-shape"
        ? `M${topX} ${topY} H${topX + topRunWidth} V${topY + depth} H${
            topX + depth
          } V${topY + leftRunHeight} H${topX} Z`
        : `M${topX} ${topY} H${topX + topRunWidth} V${
            topY + rightRunHeight
          } H${topX + topRunWidth - depth} V${topY + depth} H${
            topX + depth
          } V${topY + leftRunHeight} H${topX} Z`;
  const islandWidth = Math.min(260, Math.max(100, design.islandLengthIn * 1.55));
  const islandHeight = Math.min(76, Math.max(38, design.islandWidthIn * 0.95));
  const islandX = (760 - islandWidth) / 2;
  const islandY = design.layout === "straight" ? 224 : 232;
  const runs: DiagramGeometry["runs"] = {
    main: { x: topX, y: topY + depth / 2, length: topRunWidth, angle: 0 },
  };
  if (design.layout !== "straight") {
    runs["left-return"] = {
      x: topX + depth / 2,
      y: topY,
      length: leftRunHeight,
      angle: 90,
    };
  }
  if (design.layout === "u-shape") {
    runs["right-return"] = {
      x: topX + topRunWidth - depth / 2,
      y: topY,
      length: rightRunHeight,
      angle: 90,
    };
  }
  if (design.island) {
    runs.island = {
      x: islandX,
      y: islandY + islandHeight / 2,
      length: islandWidth,
      angle: 0,
    };
  }
  return {
    depth,
    topX,
    topY,
    topRunWidth,
    leftRunHeight,
    rightRunHeight,
    islandX,
    islandY,
    islandWidth,
    islandHeight,
    layoutPath,
    runs,
  };
}

function openingKind(
  item: CountertopPlannerOpeningScheduleItem
): "sink" | "range" | "cooktop" | "other" {
  if (item.id === "sink") return "sink";
  if (item.id === "cooktop") return /range gap/i.test(item.label) ? "range" : "cooktop";
  return "other";
}

function OpeningShape({
  item,
  width,
  depth,
}: {
  item: CountertopPlannerOpeningScheduleItem;
  width: number;
  depth: number;
}) {
  const kind = openingKind(item);
  if (item.representation === "coordination-point") {
    return (
      <g data-testid={`steel-home-countertop-${kind}-coordination-point`}>
        <circle r="10" fill="#fff5ee" stroke="#a94f2e" strokeWidth="3" />
        <path d="M-5 0H5M0-5V5" stroke="#713d2b" strokeWidth="2" />
      </g>
    );
  }
  if (kind === "sink") {
    if (item.placementKind === "front-edge-opening") {
      return (
        <g data-testid="steel-home-countertop-sink-preview">
          <path
            d={`M${-width / 2} ${-depth / 2} V${depth / 2} H${width / 2} V${-depth / 2}`}
            fill="none"
            stroke="#f8f4ed"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d={`M${-width / 2} ${-depth / 2} V${depth / 2} H${width / 2} V${-depth / 2}`}
            fill="none"
            stroke="#8f3329"
            strokeWidth="3"
            strokeDasharray="5 4"
          />
        </g>
      );
    }
    return (
      <rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        rx="9"
        fill="#8fa7a6"
        stroke="#f8f4ed"
        strokeWidth="4"
        data-testid="steel-home-countertop-sink-preview"
      />
    );
  }
  if (kind === "range") {
    return (
      <g data-testid="steel-home-countertop-cooktop-preview">
        <rect
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          rx="3"
          fill="#eee9df"
          fillOpacity=".76"
          stroke="#a94f2e"
          strokeWidth="4"
          strokeDasharray="7 5"
        />
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fill="#75351f"
          fontFamily="system-ui, sans-serif"
          fontSize="10"
          fontWeight="900"
        >
          RANGE
        </text>
      </g>
    );
  }
  if (kind === "cooktop") {
    return (
      <g data-testid="steel-home-countertop-cooktop-preview">
        <rect
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          rx="4"
          fill="#2c302f"
          stroke="#f8f4ed"
          strokeWidth="3"
        />
        {[-width * 0.24, width * 0.24].map((x) =>
          [-10, 10].map((y) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="5"
              fill="none"
              stroke="#a7aaa8"
              strokeWidth="2"
            />
          ))
        )}
      </g>
    );
  }
  return (
    <g data-testid={`steel-home-countertop-other-preview-${item.id}`}>
      <rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        rx="8"
        fill="#f0b392"
        stroke="#75351f"
        strokeWidth="3"
      />
      <circle cx="0" cy="0" r="4" fill="#75351f" />
    </g>
  );
}

function CountertopLayoutDiagram({
  design,
  selectedOpeningId,
  onSelectOpening,
  onMoveOpening,
}: {
  design: CountertopPlannerDesign;
  selectedOpeningId: string | null;
  onSelectOpening: (id: string) => void;
  onMoveOpening: (id: string, values: { positionIn?: number; frontPositionIn?: number }) => void;
}) {
  const patternId = `stone-${useId().replace(/:/g, "")}`;
  const stone = getCatalogItemById(design.stoneId);
  const selectedImage = stone?.images[design.textureImageIndex] || "";
  const image = stone
    ? buildNamedStoneDesignerImageHref(stone.shareSlug || "", selectedImage) ||
      buildStoneDesignerImageHref(stone.id, design.textureImageIndex)
    : "";
  const squareFeet = calculateCountertopSquareFeet(design);
  const geometry = buildDiagramGeometry(design);
  const openings = getCountertopPlannerOpeningSchedule(design);
  const placementProblems = getCountertopPlannerPlacementProblems(design);
  const placedOpenings = openings.filter(
    (
      item
    ): item is CountertopPlannerOpeningScheduleItem & {
      run: CountertopCutoutRun;
      positionIn: number;
    } =>
      Boolean(
        item.run &&
        item.positionIn !== null &&
        (!item.requiresFrontPosition || item.frontPositionIn !== null) &&
        geometry.runs[item.run]
      )
  );
  const unplacedOpenings = openings.filter(
    (item) =>
      !item.run ||
      item.positionIn === null ||
      (item.requiresFrontPosition && item.frontPositionIn === null) ||
      !geometry.runs[item.run]
  );

  return (
    <svg
      viewBox="0 0 760 420"
      role="group"
      aria-label={`${design.room} ${layoutLabel(design)} countertop layout using ${stone?.publicLabel || "no selected surface"}. Use Tab to reach placed openings and arrow keys to move them.`}
      className="h-full min-h-[17rem] w-full"
      data-testid="steel-home-countertop-preview"
      data-room={design.room}
      data-layout={design.layout}
      data-edge={design.edge}
      data-backsplash={design.backsplash}
      data-wall-depth-in={design.wallDepthIn}
      data-wall-depth-visual={geometry.depth}
      data-sink={design.sink}
      data-cooktop={design.cooktop}
      data-opening-count={openings.length}
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="420" height="280">
          <rect width="420" height="280" fill="#d4d0c7" />
          {image ? (
            <image
              href={image}
              data-testid="steel-home-countertop-pattern-image"
              x="0"
              y="0"
              width="420"
              height="280"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null}
        </pattern>
        <pattern id={`${patternId}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#18312f" strokeOpacity=".08" />
        </pattern>
        <filter id={`${patternId}-shadow`} x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect width="760" height="420" fill="#eee9df" />
      <rect width="760" height="420" fill={`url(#${patternId}-grid)`} />

      <g fill="#18312f" fontFamily="system-ui, sans-serif">
        <text x="28" y="32" fontSize="13" fontWeight="800" letterSpacing="1.5">
          {design.room.toUpperCase()} · {layoutLabel(design).toUpperCase()}
        </text>
        <text x="732" y="32" textAnchor="end" fontSize="18" fontWeight="800">
          {squareFeet} SQ. FT. GROSS FOOTPRINT
        </text>
      </g>

      <g filter={`url(#${patternId}-shadow)`}>
        <path
          d={geometry.layoutPath}
          data-testid="steel-home-countertop-layout-preview"
          fill={`url(#${patternId})`}
          stroke="#18312f"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {design.island ? (
          <rect
            x={geometry.islandX}
            y={geometry.islandY}
            width={geometry.islandWidth}
            height={geometry.islandHeight}
            rx="6"
            data-testid="steel-home-countertop-island-preview"
            fill={`url(#${patternId})`}
            stroke="#18312f"
            strokeWidth="5"
          />
        ) : null}
      </g>

      <g
        fill="#713d2b"
        fontFamily="system-ui, sans-serif"
        fontSize="8"
        fontWeight="900"
        letterSpacing="1"
        aria-hidden="true"
      >
        <text
          x={geometry.topX + geometry.topRunWidth / 2}
          y={geometry.topY + geometry.depth - 6}
          textAnchor="middle"
        >
          ROOM-FACING FRONT EDGE
        </text>
        {design.layout !== "straight" ? (
          <text
            transform={`translate(${geometry.topX + geometry.depth - 7} ${geometry.topY + geometry.leftRunHeight / 2}) rotate(90)`}
            textAnchor="middle"
          >
            FRONT EDGE
          </text>
        ) : null}
        {design.layout === "u-shape" ? (
          <text
            transform={`translate(${geometry.topX + geometry.topRunWidth - geometry.depth + 7} ${geometry.topY + geometry.rightRunHeight / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            FRONT EDGE
          </text>
        ) : null}
        {design.island ? (
          <text
            x={geometry.islandX + geometry.islandWidth / 2}
            y={geometry.islandY + geometry.islandHeight - 6}
            textAnchor="middle"
          >
            FRONT EDGE
          </text>
        ) : null}
      </g>

      {placedOpenings.map((item) => {
        const runGeometry = geometry.runs[item.run];
        if (!runGeometry) return null;
        const runLength = getCountertopCutoutRunLength(design, item.run);
        const fraction = Math.min(1, Math.max(0, item.positionIn / runLength));
        const surfaceDepth = getCountertopCutoutRunDepth(design, item.run);
        const frontPosition = item.frontPositionIn ?? surfaceDepth / 2;
        const frontFraction = Math.min(1, Math.max(0, frontPosition / surfaceDepth));
        const visualDepth = item.run === "island" ? geometry.islandHeight : geometry.depth;
        let x = runGeometry.x + (runGeometry.angle === 0 ? runGeometry.length * fraction : 0);
        let y = runGeometry.y + (runGeometry.angle === 90 ? runGeometry.length * fraction : 0);
        if (item.placementKind === "front-edge-opening") {
          if (item.run === "main" || item.run === "island") {
            y += visualDepth / 2;
          } else if (item.run === "left-return") {
            x += visualDepth / 2;
          } else {
            x -= visualDepth / 2;
          }
        } else if (item.requiresFrontPosition) {
          if (item.run === "main" || item.run === "island") {
            y += visualDepth / 2 - visualDepth * frontFraction;
          } else if (item.run === "left-return") {
            x += visualDepth / 2 - visualDepth * frontFraction;
          } else {
            x += -visualDepth / 2 + visualDepth * frontFraction;
          }
        }
        const physicalWidth = item.planningWidthIn;
        const visualWidth = Math.min(
          88,
          Math.max(6, physicalWidth * (runGeometry.length / runLength))
        );
        const physicalDepth = item.placementKind === "full-depth-gap" ? surfaceDepth : item.depthIn;
        const visualOpeningDepth =
          item.placementKind === "front-edge-opening"
            ? Math.max(22, visualDepth * 0.48)
            : physicalDepth
              ? Math.max(6, visualDepth * (physicalDepth / surfaceDepth))
              : Math.max(6, visualDepth * 0.12);
        const selected = item.id === selectedOpeningId;
        const invalid = placementProblems.some((problem) => problem.includes(item.label));
        const moveAlongBy = (delta: number) =>
          onMoveOpening(item.id, {
            positionIn: Math.min(runLength - 2, Math.max(2, item.positionIn + delta)),
          });
        const moveFrontBy = (delta: number) => {
          if (!item.requiresFrontPosition || item.frontPositionIn === null) return;
          onMoveOpening(item.id, { frontPositionIn: item.frontPositionIn + delta });
        };
        return (
          <g
            key={item.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-invalid={invalid}
            aria-label={`${item.label}, ${item.representation === "coordination-point" ? "non-dimensional coordination point, " : ""}${getCountertopCutoutRunLabel(item.run)}, center ${item.positionIn} inches from the start${item.placementKind === "front-edge-opening" ? ", apron opening at the room-facing edge" : item.requiresFrontPosition ? ` and ${item.frontPositionIn} inches from the front edge` : ", full-depth range gap"}. Left and right arrows move along the run.${item.requiresFrontPosition ? " Up and down arrows move front to back." : ""}`}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End"
            transform={`translate(${x} ${y}) rotate(${runGeometry.angle})`}
            onClick={() => onSelectOpening(item.id)}
            onFocus={() => onSelectOpening(item.id)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 6 : 1;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                onSelectOpening(item.id);
                moveAlongBy(-step);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                onSelectOpening(item.id);
                moveAlongBy(step);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                onSelectOpening(item.id);
                moveFrontBy(step);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                onSelectOpening(item.id);
                moveFrontBy(-step);
              } else if (event.key === "Home") {
                event.preventDefault();
                onSelectOpening(item.id);
                onMoveOpening(item.id, { positionIn: 2 });
              } else if (event.key === "End") {
                event.preventDefault();
                onSelectOpening(item.id);
                onMoveOpening(item.id, { positionIn: runLength - 2 });
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectOpening(item.id);
              }
            }}
            className="cursor-pointer outline-none"
            data-testid={`steel-home-countertop-cutout-handle-${item.id}`}
            data-cutout-id={item.id}
            data-kind={openingKind(item)}
            data-representation={item.representation}
            data-surface-id={item.run}
            data-position-in={item.positionIn}
            data-front-position-in={item.frontPositionIn ?? ""}
            data-visual-width={visualWidth}
            data-visual-depth={visualOpeningDepth}
          >
            <title>{item.label}</title>
            <rect
              x={-Math.max(28, visualWidth / 2 + 8)}
              y="-26"
              width={Math.max(56, visualWidth + 16)}
              height="52"
              rx="12"
              fill="transparent"
              stroke={invalid ? "#a1392e" : selected ? "#a94f2e" : "transparent"}
              strokeWidth="4"
              strokeDasharray="5 4"
            />
            <OpeningShape item={item} width={visualWidth} depth={visualOpeningDepth} />
          </g>
        );
      })}

      <g fill="#596965" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700">
        <text
          x={geometry.topX + geometry.topRunWidth / 2}
          y={geometry.topY - 12}
          textAnchor="middle"
        >
          {design.wallAIn}&quot; main run × {design.wallDepthIn}&quot; deep
        </text>
        {design.layout !== "straight" ? (
          <text
            x={geometry.topX - 12}
            y={geometry.topY + geometry.leftRunHeight / 2}
            textAnchor="end"
          >
            {design.wallBIn}&quot; × {design.wallDepthIn}&quot; deep
          </text>
        ) : null}
        {design.layout === "u-shape" ? (
          <text
            x={geometry.topX + geometry.topRunWidth + 12}
            y={geometry.topY + geometry.rightRunHeight / 2}
          >
            {design.wallCIn}&quot; × {design.wallDepthIn}&quot; deep
          </text>
        ) : null}
        {design.island ? (
          <text x="380" y={geometry.islandY + geometry.islandHeight + 20} textAnchor="middle">
            Island {design.islandLengthIn}&quot; × {design.islandWidthIn}&quot;
          </text>
        ) : null}
      </g>

      {unplacedOpenings.length ? (
        <g data-testid="steel-home-countertop-unplaced-openings">
          <text
            x="28"
            y="344"
            fill="#8f3329"
            fontFamily="system-ui, sans-serif"
            fontSize="12"
            fontWeight="900"
          >
            NEEDS A LOCATION
          </text>
          {unplacedOpenings.map((item, index) => {
            const x = 28 + (index % 4) * 180;
            const y = 356 + Math.floor(index / 4) * 34;
            return (
              <g
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`${item.label} needs a run and ${item.requiresFrontPosition ? "along-run and front-edge center positions" : "an along-run center position"}. Select to place it.`}
                aria-invalid="true"
                onClick={() => onSelectOpening(item.id)}
                onFocus={() => onSelectOpening(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectOpening(item.id);
                  }
                }}
                data-testid={`steel-home-countertop-cutout-handle-${item.id}`}
                data-cutout-id={item.id}
                data-kind={openingKind(item)}
                data-representation={item.representation}
                data-surface-id=""
                data-position-in={item.positionIn ?? ""}
                data-front-position-in={item.frontPositionIn ?? ""}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={x}
                  y={y}
                  width="166"
                  height="28"
                  rx="10"
                  fill={item.id === selectedOpeningId ? "#f7d4c8" : "#fff7f3"}
                  stroke="#a1392e"
                  strokeWidth={item.id === selectedOpeningId ? 3 : 2}
                />
                <text
                  x={x + 10}
                  y={y + 18}
                  fill="#7f2b24"
                  fontFamily="system-ui, sans-serif"
                  fontSize="10"
                  fontWeight="800"
                >
                  {item.label.slice(0, 23)}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}

function SurfaceGallery({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string;
  onSelect: (stoneId: string) => void;
  onClose: () => void;
}) {
  const [stoneSearch, setStoneSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const matchingStones = useMemo(() => {
    const query = stoneSearch.trim().toLocaleLowerCase();
    return allNamedStones.filter((stone) => {
      const matchesSearch =
        !query ||
        stone.publicLabel.toLocaleLowerCase().includes(query) ||
        stone.materialLabel?.toLocaleLowerCase().includes(query);
      const matchesMaterial = !materialFilter || stone.materialLabel === materialFilter;
      return Boolean(matchesSearch && matchesMaterial);
    });
  }, [materialFilter, stoneSearch]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    return () => previousFocusRef.current?.focus?.();
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[90] flex flex-col bg-[#f5f1e8] text-[#18312f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="steel-home-surface-gallery-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) || []
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      data-testid="steel-home-countertop-surface-gallery"
    >
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#18312f]/12 bg-[#faf7f1] px-4 sm:px-6">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#a94f2e]">
            Real JW Stone catalog photos
          </p>
          <h3 id="steel-home-surface-gallery-title" className="text-lg font-black">
            Choose a surface
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close surface gallery"
          className="grid h-11 w-11 place-items-center rounded-full border border-[#18312f]/15 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
          data-testid="steel-home-countertop-surface-close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="grid shrink-0 gap-3 border-b border-[#18312f]/10 bg-[#eee8dd] p-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:px-6">
        <label className="relative block">
          <span className="sr-only">Search surfaces</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736f]"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={stoneSearch}
            onChange={(event) => setStoneSearch(event.target.value)}
            placeholder="Search by surface or material"
            className={`${PROJECT_FIELD_CLASS} pl-11`}
            data-testid="steel-home-countertop-stone-search"
          />
        </label>
        <label>
          <span className="sr-only">Filter by material</span>
          <select
            value={materialFilter}
            onChange={(event) => setMaterialFilter(event.target.value)}
            className={PROJECT_FIELD_CLASS}
            data-testid="steel-home-countertop-material-filter"
          >
            <option value="">All materials</option>
            {stoneMaterialOptions.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <p className="mb-4 text-sm font-semibold text-[#68736f]" aria-live="polite">
          {matchingStones.length} {matchingStones.length === 1 ? "surface" : "surfaces"}
        </p>
        {matchingStones.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {matchingStones.map((stone) => {
              const selected = stone.id === selectedId;
              return (
                <button
                  key={stone.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(stone.id)}
                  data-testid={`steel-home-countertop-stone-${stone.id}`}
                  className={`group overflow-hidden rounded-2xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                    selected
                      ? "border-[#a94f2e] ring-2 ring-[#a94f2e]/20"
                      : "border-[#18312f]/10 hover:border-[#a94f2e]/60"
                  }`}
                >
                  <span className="relative block aspect-[4/3] overflow-hidden bg-[#d5d1c8]">
                    <img
                      src={buildStoneDesignerImageHref(stone.id)}
                      alt={`${stone.publicLabel} surface`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                      loading="lazy"
                      decoding="async"
                    />
                    {selected ? (
                      <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[#18312f] text-white">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>
                  <span className="block p-3">
                    <span className="block text-sm font-black leading-5">{stone.publicLabel}</span>
                    <span className="mt-1 block text-[0.66rem] font-bold uppercase tracking-[0.1em] text-[#77817d]">
                      {stone.materialLabel || "Material details with quote"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[#18312f]/20 text-sm font-semibold text-[#68736f]">
            No surfaces match those filters.
          </div>
        )}
      </div>
    </div>
  );
}

const snapToEighthInch = (value: number) => Number((Math.round(value * 8) / 8).toFixed(3));
const ceilToEighthInch = (value: number) => Number((Math.ceil(value * 8) / 8).toFixed(3));
const floorToEighthInch = (value: number) => Number((Math.floor(value * 8) / 8).toFixed(3));

function OptionalMeasurementField({
  label,
  value,
  min,
  max,
  onChange,
  testId,
  help,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
  testId: string;
  help?: string;
}) {
  return (
    <label className="space-y-2 text-xs font-bold text-[#18312f]">
      <span>{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step="0.125"
          value={value ?? ""}
          placeholder="Not measured"
          onChange={(event) => {
            if (!event.target.value) {
              onChange(null);
              return;
            }
            const nextValue = Number(event.target.value);
            if (Number.isFinite(nextValue)) onChange(snapToEighthInch(nextValue));
          }}
          className={`${PROJECT_FIELD_CLASS} pr-10`}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#72807b]">
          in
        </span>
      </span>
      {help ? (
        <span className="block text-[0.68rem] font-normal leading-5 text-[#68736f]">{help}</span>
      ) : null}
    </label>
  );
}

function clampOpeningPosition(
  design: SteelHomeCountertopDesign,
  run: CountertopCutoutRun,
  value: number,
  widthIn = 2
): number {
  const length = getCountertopCutoutRunLength(design, run);
  const minimum = ceilToEighthInch(widthIn / 2 + 2);
  const maximum = floorToEighthInch(length - widthIn / 2 - 2);
  if (maximum < minimum) return snapToEighthInch(length / 2);
  return Math.min(maximum, Math.max(minimum, snapToEighthInch(value)));
}

function clampOpeningFrontPosition(
  design: SteelHomeCountertopDesign,
  run: CountertopCutoutRun,
  value: number,
  depthIn = 2
): number {
  const surfaceDepth = getCountertopCutoutRunDepth(design, run);
  const minimum = ceilToEighthInch(depthIn / 2 + 1);
  const maximum = floorToEighthInch(surfaceDepth - depthIn / 2 - 1);
  if (maximum < minimum) return snapToEighthInch(surfaceDepth / 2);
  return Math.min(maximum, Math.max(minimum, snapToEighthInch(value)));
}

function normalizeOpeningPlacements(design: CountertopPlannerDesign): CountertopPlannerDesign {
  const availableRuns = new Set(getAvailableCountertopCutoutRuns(design).map((item) => item.value));
  const openingSizes = new Map(
    getCountertopPlannerOpeningSchedule(design).map((item) => [
      item.id,
      { widthIn: item.planningWidthIn, depthIn: item.depthIn || 2 },
    ])
  );
  const normalize = (
    id: string,
    run: CountertopCutoutRun | "",
    positionIn: number | null,
    frontPositionIn: number | null
  ): {
    run: CountertopCutoutRun | "";
    positionIn: number | null;
    frontPositionIn: number | null;
  } => {
    if (!run || !availableRuns.has(run)) {
      return { run: "", positionIn: null, frontPositionIn: null };
    }
    return {
      run,
      positionIn:
        positionIn === null
          ? null
          : clampOpeningPosition(design, run, positionIn, openingSizes.get(id)?.widthIn || 2),
      frontPositionIn:
        frontPositionIn === null
          ? null
          : clampOpeningFrontPosition(
              design,
              run,
              frontPositionIn,
              openingSizes.get(id)?.depthIn || 2
            ),
    };
  };
  const sink = normalize("sink", design.sinkRun, design.sinkPositionIn, design.sinkFrontPositionIn);
  const cooktop = normalize(
    "cooktop",
    design.cooktopRun,
    design.cooktopPositionIn,
    design.cooktopFrontPositionIn
  );
  return {
    ...design,
    sinkRun: sink.run,
    sinkPositionIn: sink.positionIn,
    sinkFrontPositionIn: sink.frontPositionIn,
    cooktopRun: cooktop.run,
    cooktopPositionIn: cooktop.positionIn,
    cooktopFrontPositionIn: cooktop.frontPositionIn,
    otherCutouts: design.otherCutouts.map((cutout) => {
      const placement = normalize(cutout.id, cutout.run, cutout.positionIn, cutout.frontPositionIn);
      return { ...cutout, ...placement };
    }),
  };
}

function OpeningPlacementEditor({
  design,
  item,
  otherCutout,
  onRunChange,
  onPositionChange,
  onFrontPositionChange,
  onOtherChange,
  templateWidthIn,
  templateDepthIn,
  onTemplateChange,
  onRemove,
}: {
  design: CountertopPlannerDesign;
  item: CountertopPlannerOpeningScheduleItem;
  otherCutout?: SteelHomeCountertopCutout;
  onRunChange: (run: CountertopCutoutRun | "") => void;
  onPositionChange: (positionIn: number | null) => void;
  onFrontPositionChange: (frontPositionIn: number | null) => void;
  onOtherChange: (values: Partial<SteelHomeCountertopCutout>) => void;
  templateWidthIn?: number | null;
  templateDepthIn?: number | null;
  onTemplateChange?: (values: { widthIn?: number | null; depthIn?: number | null }) => void;
  onRemove: () => void;
}) {
  const availableRuns = getAvailableCountertopCutoutRuns(design);
  const runLength = item.run ? getCountertopCutoutRunLength(design, item.run) : null;
  const minimumPosition = ceilToEighthInch(item.planningWidthIn / 2 + 2);
  const maximumPosition = runLength
    ? floorToEighthInch(runLength - item.planningWidthIn / 2 - 2)
    : null;
  const fitsSelectedRun = maximumPosition !== null && maximumPosition >= minimumPosition;
  const positionIn = item.positionIn ?? (runLength ? snapToEighthInch(runLength / 2) : 2);
  const surfaceDepth = item.run ? getCountertopCutoutRunDepth(design, item.run) : null;
  const frontBounds = getCountertopPlannerOpeningFrontBounds(design, item);
  const minimumFrontPosition = frontBounds ? ceilToEighthInch(frontBounds.minimum) : null;
  const maximumFrontPosition = frontBounds ? floorToEighthInch(frontBounds.maximum) : null;
  const fitsFrontToBack =
    !item.requiresFrontPosition ||
    (minimumFrontPosition !== null &&
      maximumFrontPosition !== null &&
      maximumFrontPosition >= minimumFrontPosition);
  const frontPositionIn =
    item.frontPositionIn ?? (surfaceDepth ? snapToEighthInch(surfaceDepth / 2) : 1);
  const placed = Boolean(
    item.run &&
    item.positionIn !== null &&
    (!item.requiresFrontPosition || item.frontPositionIn !== null)
  );
  const maximumOpeningDepth = surfaceDepth ? Math.max(1, floorToEighthInch(surfaceDepth - 2)) : 72;

  return (
    <div
      className={`mt-3 rounded-2xl border p-4 ${
        placed ? "border-[#18312f]/12 bg-[#f8f5ef]" : "border-[#a1392e]/35 bg-[#fff1eb]"
      }`}
      data-testid="steel-home-countertop-cutout-editor"
      data-cutout-id={item.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{item.label}</p>
          <p className={`mt-1 text-xs leading-5 ${placed ? "text-[#68736f]" : "text-[#8f3329]"}`}>
            {placed
              ? `${getCountertopCutoutRunLabel(item.run)} · ${item.positionIn}" from the ${getCountertopCutoutStartLabel(item.run)}${item.placementKind === "front-edge-opening" ? " · apron opening at front edge" : item.requiresFrontPosition ? ` · ${item.frontPositionIn}" from the front edge` : " · full-depth range gap"}${item.representation === "coordination-point" ? " · non-dimensional point" : ""}`
              : item.run && item.positionIn !== null && item.requiresFrontPosition
                ? "Set the center distance from the front edge."
                : "Choose a run. Safe midpoint values will be filled in for you."}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-black text-[#8f3329] transition hover:bg-[#f8dfd8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
          data-testid="steel-home-countertop-cutout-remove"
          aria-label={`Remove ${item.label}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </button>
      </div>

      {otherCutout ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-xs font-bold">
            <span>Opening type</span>
            <select
              value={otherCutout.type}
              onChange={(event) =>
                onOtherChange({
                  type: event.target.value as SteelHomeCountertopCutout["type"],
                })
              }
              className={PROJECT_FIELD_CLASS}
              data-testid="steel-home-countertop-cutout-type"
            >
              {COUNTERTOP_OTHER_CUTOUT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {otherCutout.type === "Other opening" ? (
            <label className="space-y-2 text-xs font-bold">
              <span>Opening label</span>
              <input
                type="text"
                value={otherCutout.label}
                maxLength={40}
                onChange={(event) => onOtherChange({ label: event.target.value })}
                placeholder="For example: trash chute"
                className={PROJECT_FIELD_CLASS}
                data-testid="steel-home-countertop-cutout-label"
              />
            </label>
          ) : null}
          <label className="space-y-2 text-xs font-bold">
            <span>Opening width</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max="96"
              step="0.125"
              required
              value={otherCutout.widthIn ?? ""}
              onChange={(event) =>
                onOtherChange({
                  widthIn: event.target.value ? Number(event.target.value) : null,
                })
              }
              className={PROJECT_FIELD_CLASS}
              data-testid="steel-home-countertop-cutout-width"
            />
          </label>
          <label className="space-y-2 text-xs font-bold">
            <span>Opening depth</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max={maximumOpeningDepth}
              step="0.125"
              required
              value={otherCutout.depthIn ?? ""}
              onChange={(event) =>
                onOtherChange({
                  depthIn: event.target.value ? Number(event.target.value) : null,
                })
              }
              className={PROJECT_FIELD_CLASS}
              data-testid="steel-home-countertop-cutout-depth"
            />
          </label>
          <p className="text-[0.7rem] leading-5 text-[#68736f] sm:col-span-2">
            Use the fixture or appliance manufacturer&apos;s cutout size. The fabricator will verify
            it before cutting. On the selected surface, opening depth cannot exceed{" "}
            {maximumOpeningDepth}".
          </p>
        </div>
      ) : null}

      {!otherCutout && item.placementKind !== "full-depth-gap" ? (
        <div className="mt-4 rounded-xl border border-[#18312f]/10 bg-white p-3">
          <p className="text-xs font-black">Manufacturer template size (optional)</p>
          <p className="mt-1 text-[0.7rem] leading-5 text-[#68736f]">
            Leave both fields blank to keep this as a non-dimensional coordination point. Enter both
            values only from the exact sink or appliance template.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <OptionalMeasurementField
              label="Template opening width"
              value={templateWidthIn ?? null}
              min={0.125}
              max={96}
              onChange={(widthIn) => onTemplateChange?.({ widthIn })}
              testId={`steel-home-countertop-${item.id}-template-width`}
            />
            <OptionalMeasurementField
              label="Template opening depth"
              value={templateDepthIn ?? null}
              min={0.125}
              max={72}
              onChange={(depthIn) => onTemplateChange?.({ depthIn })}
              testId={`steel-home-countertop-${item.id}-template-depth`}
            />
          </div>
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-[0.7rem] font-bold ${
              item.templateStatus === "entered"
                ? "bg-[#eaf2ed] text-[#36544f]"
                : "bg-[#fff0ea] text-[#7f2b24]"
            }`}
            data-testid={`steel-home-countertop-${item.id}-template-status`}
          >
            {item.templateStatus === "entered"
              ? "Template dimensions entered; the measured opening is shown."
              : "Template unresolved; the scene shows only a coordination point and does not guess a cutout."}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem] sm:items-end">
        <label className="space-y-2 text-xs font-bold">
          <span>Place on</span>
          <select
            value={item.run}
            onChange={(event) => onRunChange(event.target.value as CountertopCutoutRun | "")}
            className={PROJECT_FIELD_CLASS}
            data-testid="steel-home-countertop-cutout-surface"
          >
            <option value="">Choose a run</option>
            {availableRuns.map((run) => (
              <option key={run.value} value={run.value}>
                {run.label} · {getCountertopCutoutRunLength(design, run.value)}" ×{" "}
                {getCountertopCutoutRunDepth(design, run.value)}" · start at the{" "}
                {getCountertopCutoutStartLabel(run.value)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-xs font-bold">
          <span>Center from {item.run ? getCountertopCutoutStartLabel(item.run) : "start"}</span>
          <span className="relative block">
            <input
              type="number"
              inputMode="decimal"
              min={minimumPosition}
              max={maximumPosition ?? undefined}
              step="0.125"
              value={item.positionIn ?? ""}
              disabled={!item.run || !fitsSelectedRun}
              onChange={(event) =>
                onPositionChange(event.target.value ? Number(event.target.value) : null)
              }
              className={`${PROJECT_FIELD_CLASS} pr-10 disabled:cursor-not-allowed disabled:bg-[#ece7de]`}
              data-testid="steel-home-countertop-cutout-position"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#72807b]">
              in
            </span>
          </span>
        </label>
        {item.requiresFrontPosition ? (
          <label className="space-y-2 text-xs font-bold">
            <span>Center from front edge</span>
            <span className="relative block">
              <input
                type="number"
                inputMode="decimal"
                min={minimumFrontPosition ?? undefined}
                max={maximumFrontPosition ?? undefined}
                step="0.125"
                value={item.frontPositionIn ?? ""}
                disabled={!item.run || !fitsFrontToBack}
                onChange={(event) =>
                  onFrontPositionChange(event.target.value ? Number(event.target.value) : null)
                }
                className={`${PROJECT_FIELD_CLASS} pr-10 disabled:cursor-not-allowed disabled:bg-[#ece7de]`}
                data-testid="steel-home-countertop-cutout-front-position"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#72807b]">
                in
              </span>
            </span>
          </label>
        ) : item.placementKind === "front-edge-opening" ? (
          <p className="rounded-xl bg-[#fff0ea] px-3 py-3 text-xs font-bold leading-5 text-[#7f2b24]">
            Apron-front opening: set its position along the run. The fabricator must use the exact
            sink manufacturer&apos;s template for the front-edge notch and cutout.
          </p>
        ) : (
          <p className="rounded-xl bg-[#eee9df] px-3 py-3 text-xs font-bold leading-5 text-[#5f6c68]">
            Range gap spans the full countertop depth; only its run position is needed.
          </p>
        )}
      </div>

      {item.requiresFrontPosition ? (
        <p className="mt-2 text-[0.7rem] leading-5 text-[#68736f]">
          Front edge means the finished, room-facing edge marked on the drawing—not the wall edge.
        </p>
      ) : null}

      {item.run && runLength && fitsSelectedRun ? (
        <label className="mt-4 block space-y-2 text-xs font-bold">
          <span className="flex items-center justify-between gap-3">
            <span>Move along {getCountertopCutoutRunLabel(item.run).toLowerCase()}</span>
            <span className="text-[#68736f]">
              {minimumPosition}" – {maximumPosition}"
            </span>
          </span>
          <input
            type="range"
            min={minimumPosition}
            max={maximumPosition ?? minimumPosition}
            step="0.125"
            value={positionIn}
            onChange={(event) => onPositionChange(Number(event.target.value))}
            className="h-11 w-full cursor-pointer accent-[#a94f2e]"
            aria-label={`${item.label} center position in inches`}
            data-testid="steel-home-countertop-cutout-position-range"
          />
        </label>
      ) : item.run && runLength ? (
        <p className="mt-4 rounded-xl bg-[#fff0ea] p-3 text-xs font-bold text-[#8f3329]">
          This opening is wider than the selected run. Choose a longer run or a smaller opening.
        </p>
      ) : null}

      {item.run && item.requiresFrontPosition && fitsFrontToBack ? (
        <label className="mt-4 block space-y-2 text-xs font-bold">
          <span className="flex items-center justify-between gap-3">
            <span>Move front to back</span>
            <span className="text-[#68736f]">
              {minimumFrontPosition}" – {maximumFrontPosition}" from front edge
            </span>
          </span>
          <input
            type="range"
            min={minimumFrontPosition ?? 1}
            max={maximumFrontPosition ?? 1}
            step="0.125"
            value={frontPositionIn}
            onChange={(event) => onFrontPositionChange(Number(event.target.value))}
            className="h-11 w-full cursor-pointer accent-[#a94f2e]"
            aria-label={`${item.label} center distance from the front edge in inches`}
            data-testid="steel-home-countertop-cutout-front-position-range"
          />
        </label>
      ) : item.run && item.requiresFrontPosition ? (
        <p className="mt-4 rounded-xl bg-[#fff0ea] p-3 text-xs font-bold text-[#8f3329]">
          This opening is too deep for the selected surface. Enter the manufacturer&apos;s smaller
          cutout depth or choose a deeper island.
        </p>
      ) : null}

      <p className="mt-3 text-[0.7rem] leading-5 text-[#68736f]">
        Use the sliders with mouse or touch. On the drawing, left/right moves along the run
        {item.requiresFrontPosition ? " and up/down moves front to back" : ""}. Hold Shift for
        6-inch moves.
      </p>
    </div>
  );
}

export default function CountertopDesigner({ design: designInput, onChange, onRequest }: Props) {
  const design = useMemo(() => resolveCountertopPlannerDesign(designInput), [designInput]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedSurfaceTarget, setSelectedSurfaceTarget] = useState<StoneSurfaceTarget>("counter");
  const [openingStatus, setOpeningStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [pendingSharedDesign, setPendingSharedDesign] = useState<CountertopPlannerDesign | null>(
    () => {
      if (typeof window === "undefined") return null;
      const sharedDesign = parseCountertopStudioShareUrl(window.location.href);
      if (!sharedDesign) return null;
      const sharedMeasurements = parseCountertopPlannerExtensionFromShareUrl(window.location.href);
      return resolveCountertopPlannerDesign({
        ...sharedDesign,
        ...(sharedMeasurements || {}),
      });
    }
  );
  const update = (values: Partial<CountertopPlannerDesign>) =>
    onChange(resolveCountertopPlannerDesign({ ...design, ...values }));
  const updateSpatial = (values: Partial<CountertopPlannerExtension>) =>
    onChange(withCountertopPlannerExtension(design, values));
  const updateAndNormalize = (values: Partial<SteelHomeCountertopDesign>) => {
    const nextDesign = { ...design, ...values };
    const extension = {
      ...getCountertopPlannerExtensionSnapshot(nextDesign),
      measurementsReviewed: false,
    };
    const reconciledDesign = reconcileSteelHomeProjectDraft({
      countertops: nextDesign,
    }).countertops;
    onChange(
      normalizeOpeningPlacements(
        resolveCountertopPlannerDesign({ ...reconciledDesign, ...extension })
      )
    );
  };
  const selectedStone = getCatalogItemById(design.stoneId);
  const selectedTextureImage = selectedStone?.images[design.textureImageIndex] || null;
  const selectedPhotoDimensions = selectedTextureImage
    ? resolveSlabDimensionForInventoryImage(selectedTextureImage)
    : null;
  const selectedPhotoScaleVerified = Boolean(
    selectedTextureImage && selectedPhotoDimensions && !isHandScaleCoverImage(selectedTextureImage)
  );
  const squareFeet = calculateCountertopSquareFeet(design);
  const openings = getCountertopPlannerOpeningSchedule(design);
  const placementProblems = getCountertopPlannerPlacementProblems(design);
  const plannerDiagnostics = getCountertopPlannerDiagnostics(design);
  const sceneDiagnostics = plannerDiagnostics.filter((item) => item.scope === "scene");
  const openingDiagnostics = plannerDiagnostics.filter((item) => item.scope === "opening");
  const stoneReadiness = getCountertopPlannerRequestReadiness(design, "stone");
  const fabricatorReadiness = getCountertopPlannerRequestReadiness(design, "fabricator");
  const placedOpeningCount = openings.filter(
    (opening) =>
      opening.run &&
      opening.positionIn !== null &&
      (!opening.requiresFrontPosition || opening.frontPositionIn !== null)
  ).length;
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId) || null;
  const selectedOtherCutout = selectedOpening
    ? design.otherCutouts.find((cutout) => cutout.id === selectedOpening.id)
    : undefined;
  const openingIds = openings.map((opening) => opening.id).join("|");

  useEffect(() => {
    if (!openings.length) {
      if (selectedOpeningId !== null) setSelectedOpeningId(null);
      return;
    }
    if (!selectedOpeningId || !openings.some((opening) => opening.id === selectedOpeningId)) {
      setSelectedOpeningId(openings[0].id);
    }
  }, [openingIds, openings, selectedOpeningId]);

  const request = (intent: "stone" | "fabricator") => {
    const readiness = intent === "stone" ? stoneReadiness : fabricatorReadiness;
    if (!readiness.ready) return;
    onChange({ ...design, included: true });
    onRequest(intent);
  };

  const shareStudio = async () => {
    if (typeof window === "undefined") return;
    const baseUrl = buildCountertopStudioShareUrl(design, window.location.href);
    if (!baseUrl) {
      setShareStatus("Choose a named JW Stone surface before sharing this design.");
      return;
    }
    const url = addCountertopPlannerExtensionToShareUrl(baseUrl, design);
    await share({
      url,
      title: `${selectedStone?.publicLabel || "JW Stone"} spatial design`,
      text: `Explore this ${design.room.toLowerCase()} design with ${selectedStone?.publicLabel || "the selected JW Stone surface"}.`,
      contextLabel: "JW Stone design",
      kind: "profile",
      imageUrl: selectedStone
        ? buildNamedStoneDesignerImageHref(
            selectedStone.shareSlug || "",
            selectedTextureImage || ""
          ) || buildStoneDesignerImageHref(selectedStone.id, design.textureImageIndex)
        : undefined,
      suppressRef: true,
    });
    setShareStatus("Private notes and location were excluded from the share link.");
  };

  const clearSharedDesignParam = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete(COUNTERTOP_STUDIO_SHARE_PARAM);
    url.searchParams.delete(COUNTERTOP_PLANNER_MEASUREMENTS_SHARE_PARAM);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  const loadPendingSharedDesign = () => {
    if (!pendingSharedDesign) return;
    onChange(
      resolveCountertopPlannerDesign({
        ...pendingSharedDesign,
        included: design.included,
        measurementsReviewed: false,
      })
    );
    setPendingSharedDesign(null);
    clearSharedDesignParam();
    setShareStatus("Shared design loaded. Review measurements before requesting work.");
  };

  const keepSavedDesign = () => {
    setPendingSharedDesign(null);
    clearSharedDesignParam();
    setShareStatus("Your saved design was kept. The shared design was not imported.");
  };

  const changeOpening = (
    id: string,
    values: {
      run?: CountertopCutoutRun | "";
      positionIn?: number | null;
      frontPositionIn?: number | null;
    }
  ) => {
    if (id === "sink") {
      const next = {
        ...design,
        ...(values.run !== undefined ? { sinkRun: values.run } : {}),
        ...(values.positionIn !== undefined ? { sinkPositionIn: values.positionIn } : {}),
        ...(values.frontPositionIn !== undefined
          ? { sinkFrontPositionIn: values.frontPositionIn }
          : {}),
      };
      onChange(normalizeOpeningPlacements(next));
      return;
    }
    if (id === "cooktop") {
      const next = {
        ...design,
        ...(values.run !== undefined ? { cooktopRun: values.run } : {}),
        ...(values.positionIn !== undefined ? { cooktopPositionIn: values.positionIn } : {}),
        ...(values.frontPositionIn !== undefined
          ? { cooktopFrontPositionIn: values.frontPositionIn }
          : {}),
      };
      onChange(normalizeOpeningPlacements(next));
      return;
    }
    onChange(
      normalizeOpeningPlacements({
        ...design,
        otherCutouts: design.otherCutouts.map((cutout) =>
          cutout.id === id ? { ...cutout, ...values } : cutout
        ),
      })
    );
  };

  const changeOpeningRun = (id: string, run: CountertopCutoutRun | "") => {
    const current = openings.find((opening) => opening.id === id);
    if (!run) {
      changeOpening(id, { run: "", positionIn: null, frontPositionIn: null });
      setOpeningStatus(`${current?.label || "Opening"} needs a location.`);
      return;
    }
    const runLength = getCountertopCutoutRunLength(design, run);
    const nextPosition =
      current?.positionIn === null || current?.positionIn === undefined
        ? snapToEighthInch(runLength / 2)
        : clampOpeningPosition(design, run, current.positionIn, current.planningWidthIn);
    const surfaceDepth = getCountertopCutoutRunDepth(design, run);
    const nextFrontPosition = !current?.requiresFrontPosition
      ? null
      : current.frontPositionIn === null || current.frontPositionIn === undefined
        ? snapToEighthInch(surfaceDepth / 2)
        : clampOpeningFrontPosition(design, run, current.frontPositionIn, current.depthIn || 2);
    changeOpening(id, {
      run,
      positionIn: nextPosition,
      frontPositionIn: nextFrontPosition,
    });
    setOpeningStatus(
      `${current?.label || "Opening"} placed on ${getCountertopCutoutRunLabel(run)} at ${nextPosition} inches from the start${nextFrontPosition === null ? "" : ` and ${nextFrontPosition} inches from the front edge`}.`
    );
  };

  const changeOpeningFrontPosition = (id: string, frontPositionIn: number | null) => {
    const current = openings.find((opening) => opening.id === id);
    if (
      !current?.run ||
      !current.requiresFrontPosition ||
      frontPositionIn === null ||
      !Number.isFinite(frontPositionIn)
    ) {
      changeOpening(id, { frontPositionIn: null });
      setOpeningStatus(`${current?.label || "Opening"} needs a front-to-back position.`);
      return;
    }
    const nextFrontPosition = clampOpeningFrontPosition(
      design,
      current.run,
      frontPositionIn,
      current.depthIn || 2
    );
    changeOpening(id, { frontPositionIn: nextFrontPosition });
    setOpeningStatus(
      `${current.label} moved to ${nextFrontPosition} inches from the front edge of ${getCountertopCutoutRunLabel(current.run)}.`
    );
  };

  const changeOpeningPosition = (id: string, positionIn: number | null) => {
    const current = openings.find((opening) => opening.id === id);
    if (!current?.run || positionIn === null || !Number.isFinite(positionIn)) {
      changeOpening(id, { positionIn: null });
      setOpeningStatus(`${current?.label || "Opening"} needs a position.`);
      return;
    }
    const nextPosition = clampOpeningPosition(
      design,
      current.run,
      positionIn,
      current.planningWidthIn
    );
    changeOpening(id, { positionIn: nextPosition });
    setOpeningStatus(
      `${current.label} moved to ${nextPosition} inches on ${getCountertopCutoutRunLabel(current.run)}.`
    );
  };

  const updateOtherCutout = (id: string, values: Partial<SteelHomeCountertopCutout>) => {
    const safeValues = { ...values };
    if (typeof safeValues.label === "string") safeValues.label = safeValues.label.slice(0, 40);
    if (typeof safeValues.widthIn === "number") {
      safeValues.widthIn = Math.min(96, Math.max(1, snapToEighthInch(safeValues.widthIn)));
    }
    if (typeof safeValues.depthIn === "number") {
      safeValues.depthIn = Math.min(96, Math.max(1, snapToEighthInch(safeValues.depthIn)));
    }
    update({
      otherCutouts: design.otherCutouts.map((cutout) =>
        cutout.id === id ? { ...cutout, ...safeValues } : cutout
      ),
    });
  };

  const removeOpening = (id: string) => {
    const current = openings.find((opening) => opening.id === id);
    if (id === "sink")
      update({
        sink: "None",
        sinkRun: "",
        sinkPositionIn: null,
        sinkFrontPositionIn: null,
        sinkTemplateWidthIn: null,
        sinkTemplateDepthIn: null,
      });
    else if (id === "cooktop")
      update({
        cooktop: "None",
        cooktopRun: "",
        cooktopPositionIn: null,
        cooktopFrontPositionIn: null,
        cooktopTemplateWidthIn: null,
        cooktopTemplateDepthIn: null,
      });
    else update({ otherCutouts: design.otherCutouts.filter((cutout) => cutout.id !== id) });
    setOpeningStatus(`${current?.label || "Opening"} removed.`);
  };

  const addOtherCutout = () => {
    if (design.otherCutouts.length >= 6) return;
    const usedIds = new Set(design.otherCutouts.map((cutout) => cutout.id));
    let index = 1;
    while (usedIds.has(`other-${index}`)) index += 1;
    const id = `other-${index}`;
    update({
      otherCutouts: [
        ...design.otherCutouts,
        {
          id,
          type: "Other opening",
          label: "",
          run: "",
          positionIn: null,
          frontPositionIn: null,
          widthIn: null,
          depthIn: null,
        },
      ],
    });
    setSelectedOpeningId(id);
    setOpeningStatus("Other opening added. Choose its type and location.");
  };

  return (
    <section
      id="countertop-designer"
      className="h-full overflow-y-auto bg-[#17201f] text-white lg:overflow-hidden"
      data-testid="steel-home-countertop-designer"
    >
      <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(0,1.18fr)_minmax(25rem,.82fr)]">
        <div className="flex min-h-[28rem] flex-col gap-3 p-3 sm:min-h-[34rem] sm:p-4 lg:min-h-0 lg:p-5">
          <div className="relative min-h-[24rem] flex-1 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#29302e] sm:min-h-[31rem]">
            <Suspense
              fallback={
                <div className="grid h-full min-h-[24rem] place-items-center bg-[#29302e] px-6 text-center text-sm font-semibold text-white/70 sm:min-h-[31rem]">
                  Preparing the 3D planner…
                </div>
              }
            >
              <StoneVisualizer3D
                design={design}
                selectedTarget={selectedSurfaceTarget}
                onSelectTarget={setSelectedSurfaceTarget}
              />
            </Suspense>
            <img
              src={
                selectedStone
                  ? buildStoneDesignerImageHref(selectedStone.id, design.textureImageIndex)
                  : ""
              }
              alt=""
              className="sr-only"
              data-testid="steel-home-countertop-selected-surface-image"
            />
          </div>

          <div
            className="grid gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.07] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            data-testid="steel-home-countertop-live-summary"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                {design.measurementsReviewed
                  ? `${design.room} · ${layoutLabel(design)} · ${design.edge} edge`
                  : "Countertop starter · surface measurements unresolved"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {design.backsplash} backsplash ·{" "}
                {openings.length
                  ? `${openings.length} planned ${openings.length === 1 ? "opening" : "openings"}`
                  : "No cutouts or openings"}
                {placementProblems.length ? ` · ${placementProblems.length} need placement` : ""}
              </p>
              {sceneDiagnostics.length ? (
                <p
                  className="mt-2 text-xs font-bold leading-5 text-[#f5c3aa]"
                  data-testid="steel-home-countertop-scene-unresolved-summary"
                >
                  {design.measurementsReviewed
                    ? `${sceneDiagnostics.length} scene measurement${sceneDiagnostics.length === 1 ? " is" : "s are"} unresolved; missing geometry stays hidden or schematic.`
                    : "Starter run values are unreviewed; measured plan and countertop geometry stay hidden."}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3 sm:text-right">
              <Ruler className="h-5 w-5 text-[#f0b392]" aria-hidden="true" />
              <div>
                <p className="text-xl font-black">
                  {design.measurementsReviewed
                    ? `About ${squareFeet} sq. ft.`
                    : "Footprint unresolved"}
                </p>
                <p className="text-xs font-semibold text-white/55">
                  {design.measurementsReviewed
                    ? "Gross layout footprint · backsplash excluded · range gaps not deducted"
                    : "Review run, depth, and island values before this is treated as measured"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col border-t border-white/10 bg-[#f6f1e8] text-[#18312f] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {pendingSharedDesign ? (
              <aside
                className="mb-4 rounded-[1.25rem] border border-[#a94f2e]/25 bg-[#fff0e8] p-4"
                aria-labelledby="countertop-shared-design-heading"
                data-testid="steel-home-countertop-shared-design-prompt"
              >
                <p
                  id="countertop-shared-design-heading"
                  className="text-sm font-black text-[#713d2b]"
                >
                  A shared countertop design is ready to review
                </p>
                <p className="mt-1 text-xs leading-5 text-[#7d665b]">
                  Loading it will replace only your current countertop design. Your saved version
                  stays unchanged until you choose.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={loadPendingSharedDesign}
                    className="min-h-11 rounded-full bg-[#a94f2e] px-4 text-xs font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2"
                  >
                    Load shared design
                  </button>
                  <button
                    type="button"
                    onClick={keepSavedDesign}
                    className="min-h-11 rounded-full border border-[#18312f]/18 bg-white px-4 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f] focus-visible:ring-offset-2"
                  >
                    Keep my saved design
                  </button>
                </div>
              </aside>
            ) : null}

            <section
              className="rounded-[1.35rem] border border-[#18312f]/12 bg-white p-4 shadow-[0_12px_35px_rgba(24,49,47,.07)]"
              aria-labelledby="countertop-studio-surface-heading"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#a94f2e]">
                    JW Stone spatial studio
                  </p>
                  <h2
                    id="countertop-studio-surface-heading"
                    className="mt-1 truncate font-editorial text-2xl font-semibold tracking-[-0.025em]"
                  >
                    {selectedStone?.publicLabel || "Choose a surface"}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#68736f]">
                    {selectedStone?.materialLabel || "Material not confirmed"} ·{" "}
                    {selectedPhotoScaleVerified && selectedPhotoDimensions
                      ? `${formatSlabDimension(selectedPhotoDimensions).replace(/\"/g, " in")} source dimensions for this photo`
                      : "Scale unverified for this photo"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="min-h-11 shrink-0 rounded-full bg-[#18312f] px-4 text-xs font-black text-white transition hover:bg-[#a94f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2"
                  data-testid="steel-home-countertop-surface-open"
                >
                  Change stone
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-[#a94f2e]/18 bg-[#fff6f1] p-3">
                <p className="text-xs font-black text-[#713d2b]">
                  Confirm current availability with JW Stone
                </p>
                <p className="mt-1 text-[0.7rem] leading-5 text-[#7d665b]">
                  Catalog photos, source counts, and source dimensions are not live stock, holds,
                  pricing, or a cutting reservation.
                </p>
              </div>

              {selectedStone?.images.length ? (
                <div className="mt-4">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#68736f]">
                    Inventory photo used for mapping
                  </p>
                  <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {selectedStone.images.map((imageHref, imageIndex) => (
                      <li key={imageIndex} className="shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            update({
                              textureImageIndex: imageIndex,
                              texturePhotoKey: buildStoneDesignerPhotoKey(imageHref) || "",
                            })
                          }
                          aria-label={`Use inventory photo ${imageIndex + 1} of ${selectedStone.images.length}`}
                          aria-pressed={design.textureImageIndex === imageIndex}
                          className={`relative h-14 w-20 overflow-hidden rounded-lg border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                            design.textureImageIndex === imageIndex
                              ? "border-[#a94f2e]"
                              : "border-transparent"
                          }`}
                          data-testid={`steel-home-countertop-texture-image-${imageIndex}`}
                        >
                          <img
                            src={buildStoneDesignerImageHref(selectedStone.id, imageIndex)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 rounded bg-[#0b1615]/80 px-1.5 py-0.5 text-[0.6rem] font-black text-white">
                            {imageIndex + 1}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <details className="group mt-4 rounded-xl border border-[#18312f]/12 bg-[#fbf9f5]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                  Scene applications
                  <ChevronDown
                    className="h-4 w-4 transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-[#18312f]/10 p-3">
                  <fieldset>
                    <legend className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#68736f]">
                      Stone applications in this room
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["counter", "island", "backsplash", "floor"] as StoneSurfaceTarget[]).map(
                        (target) => {
                          const disabled = target === "island" && !design.island;
                          const applicationEnabled =
                            target === "counter" ||
                            (target === "island" && design.island) ||
                            (target === "backsplash" && design.backsplash !== "None") ||
                            (target === "floor" && design.floorStone);
                          const active = Boolean(selectedStone && applicationEnabled);
                          return (
                            <button
                              key={target}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedSurfaceTarget(target);
                                if (target === "backsplash" && design.backsplash === "None") {
                                  update({ backsplash: "Full-height" });
                                }
                                if (target === "floor" && !design.floorStone)
                                  update({ floorStone: true });
                              }}
                              aria-pressed={selectedSurfaceTarget === target}
                              className={`min-h-11 rounded-xl border px-3 text-xs font-black capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] disabled:cursor-not-allowed disabled:opacity-40 ${
                                selectedSurfaceTarget === target
                                  ? "border-[#a94f2e] bg-[#fff0e8] text-[#8f3f25]"
                                  : "border-[#18312f]/12 bg-[#f8f5ef]"
                              }`}
                            >
                              {target}{" "}
                              {active
                                ? "· selected stone"
                                : applicationEnabled
                                  ? "· surface unselected"
                                  : "· off"}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </fieldset>

                  <p className="mt-3 text-[0.7rem] leading-5 text-[#68736f]">
                    One JW Stone selection and mapping is shared across the active applications.
                    Select an application to highlight it in the room; turning on backsplash or
                    floor adds the stone there.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <ProjectTextSelect
                      label="Camera view"
                      value={design.cameraPreset}
                      options={COUNTERTOP_CAMERA_PRESET_OPTIONS}
                      onChange={(cameraPreset) => update({ cameraPreset })}
                      testId="steel-home-countertop-camera-preset"
                    />
                    <ProjectToggle
                      checked={design.floorStone}
                      onChange={(floorStone) => update({ floorStone })}
                      label="Apply selected stone to floor"
                      description="A visual application only; final material quantity still requires field measurement."
                      testId="steel-home-countertop-floor-stone"
                    />
                  </div>
                </div>
              </details>

              <details className="group mt-3 rounded-xl border border-[#18312f]/12 bg-[#fbf9f5]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                  Texture mapping
                  <ChevronDown
                    className="h-4 w-4 transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-[#18312f]/10 p-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-black">
                      <span className="flex justify-between gap-3">
                        Horizontal crop <span>{design.textureOffsetX.toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.05}
                        value={design.textureOffsetX}
                        onChange={(event) => update({ textureOffsetX: Number(event.target.value) })}
                        className="mt-2 w-full accent-[#a94f2e]"
                        data-testid="steel-home-countertop-texture-offset-x"
                      />
                    </label>
                    <label className="block text-xs font-black">
                      <span className="flex justify-between gap-3">
                        Vertical crop <span>{design.textureOffsetY.toFixed(2)}</span>
                      </span>
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.05}
                        value={design.textureOffsetY}
                        onChange={(event) => update({ textureOffsetY: Number(event.target.value) })}
                        className="mt-2 w-full accent-[#a94f2e]"
                        data-testid="steel-home-countertop-texture-offset-y"
                      />
                    </label>
                    <label className="block text-xs font-black sm:col-span-2">
                      <span className="flex justify-between gap-3">
                        Slab mapping scale <span>{design.textureScale.toFixed(1)}×</span>
                      </span>
                      <input
                        type="range"
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={design.textureScale}
                        onChange={(event) => update({ textureScale: Number(event.target.value) })}
                        className="mt-2 w-full accent-[#a94f2e]"
                        data-testid="steel-home-countertop-texture-scale"
                      />
                    </label>
                  </div>

                  <fieldset className="mt-4">
                    <legend className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#68736f]">
                      Vein direction
                    </legend>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {COUNTERTOP_VEIN_ROTATION_OPTIONS.map((rotation) => (
                        <button
                          key={rotation}
                          type="button"
                          onClick={() => update({ veinRotation: rotation })}
                          aria-pressed={design.veinRotation === rotation}
                          className={`min-h-10 rounded-lg border text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                            design.veinRotation === rotation
                              ? "border-[#a94f2e] bg-[#fff0e8] text-[#8f3f25]"
                              : "border-[#18312f]/12"
                          }`}
                        >
                          {rotation}°
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </details>

              <details className="group mt-3 rounded-xl border border-[#18312f]/12 bg-[#fbf9f5]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                  Fabrication options
                  <ChevronDown
                    className="h-4 w-4 transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="grid gap-3 border-t border-[#18312f]/10 p-3">
                  <ProjectTextSelect
                    label="Waterfall ends"
                    value={design.waterfall}
                    options={design.island ? COUNTERTOP_WATERFALL_OPTIONS : (["None"] as const)}
                    onChange={(waterfall) => update({ waterfall })}
                    testId="steel-home-countertop-waterfall"
                  />
                  <ProjectToggle
                    checked={design.showSeams}
                    onChange={(showSeams) => update({ showSeams })}
                    label="Show planning seams"
                    description="Visible in the room and included in the fabricator brief. Final seam placement requires slab layout."
                    testId="steel-home-countertop-seams"
                  />
                </div>
              </details>

              <button
                type="button"
                onClick={() => void shareStudio()}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#18312f]/18 bg-[#f8f5ef] px-4 text-xs font-black transition hover:border-[#a94f2e] hover:text-[#a94f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
                data-testid="steel-home-countertop-share-studio"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Share this design
              </button>
              {shareStatus ? (
                <p
                  className="mt-3 rounded-xl bg-[#eef3ef] p-3 text-xs font-semibold leading-5 text-[#36544f]"
                  aria-live="polite"
                >
                  {shareStatus}
                </p>
              ) : null}
            </section>

            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
                Layout and measurements
              </p>
              <p className="mt-2 text-sm leading-6 text-[#68736f]">
                The room, layout, and numeric run fields are editable starter choices, not measured
                project geometry. Enter the actual surface dimensions, then confirm your review to
                unlock the measured plan, 3D countertop geometry, footprint, and fabricator handoff.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProjectTextSelect
                label="Room"
                value={design.room}
                options={COUNTERTOP_ROOM_OPTIONS}
                onChange={(room) => update({ room })}
                testId="steel-home-countertop-room"
              />
              <ProjectSelect
                label="Layout"
                value={design.layout}
                options={COUNTERTOP_LAYOUT_OPTIONS}
                onChange={(layout) => updateAndNormalize({ layout })}
                testId="steel-home-countertop-layout"
              />
              <ProjectNumberField
                label="Main run"
                value={design.wallAIn}
                min={
                  design.layout === "u-shape"
                    ? Math.ceil(design.wallDepthIn * 2 + 1)
                    : design.layout === "l-shape"
                      ? Math.ceil(design.wallDepthIn + 0.5)
                      : 24
                }
                max={360}
                suffix="in"
                onChange={(wallAIn) => updateAndNormalize({ wallAIn })}
                testId="steel-home-countertop-run-a"
              />
              <ProjectNumberField
                label="Wall-top depth"
                value={design.wallDepthIn}
                min={12}
                max={72}
                step={0.5}
                suffix="in"
                onChange={(wallDepthIn) => updateAndNormalize({ wallDepthIn })}
                testId="steel-home-countertop-wall-depth"
              />
              {design.layout !== "straight" ? (
                <ProjectNumberField
                  label="Left return"
                  value={design.wallBIn}
                  min={Math.ceil(design.wallDepthIn + 0.5)}
                  max={360}
                  suffix="in"
                  onChange={(wallBIn) => updateAndNormalize({ wallBIn })}
                  testId="steel-home-countertop-run-b"
                />
              ) : null}
              {design.layout === "u-shape" ? (
                <ProjectNumberField
                  label="Right return"
                  value={design.wallCIn}
                  min={Math.ceil(design.wallDepthIn + 0.5)}
                  max={360}
                  suffix="in"
                  onChange={(wallCIn) => updateAndNormalize({ wallCIn })}
                  testId="steel-home-countertop-run-c"
                />
              ) : null}
            </div>

            <p className="mt-3 rounded-xl bg-[#eee9df] p-3 text-xs leading-5 text-[#5f6c68]">
              Measure from the wall or back edge to the finished room-facing edge. Enter the real
              top depth for this room—bathroom vanities are often shallower than kitchen tops.
            </p>

            <div className="mt-5">
              <ProjectToggle
                checked={design.island}
                onChange={(island) => updateAndNormalize({ island })}
                label="Include an island"
                description="Adds a separate countertop top to the square footage."
                testId="steel-home-countertop-island"
              />
            </div>
            {design.island ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ProjectNumberField
                  label="Island length"
                  value={design.islandLengthIn}
                  min={24}
                  max={180}
                  suffix="in"
                  onChange={(islandLengthIn) => updateAndNormalize({ islandLengthIn })}
                  testId="steel-home-countertop-island-length"
                />
                <ProjectNumberField
                  label="Island width"
                  value={design.islandWidthIn}
                  min={20}
                  max={72}
                  suffix="in"
                  onChange={(islandWidthIn) => updateAndNormalize({ islandWidthIn })}
                  testId="steel-home-countertop-island-width"
                />
              </div>
            ) : null}

            <div
              className={`mt-4 rounded-2xl border p-4 ${
                design.measurementsReviewed
                  ? "border-[#527064]/25 bg-[#edf4ef]"
                  : "border-[#a94f2e]/30 bg-[#fff0e8]"
              }`}
              data-testid="steel-home-countertop-measurement-review"
            >
              <ProjectToggle
                checked={design.measurementsReviewed}
                onChange={(measurementsReviewed) => updateSpatial({ measurementsReviewed })}
                label="I entered or reviewed the surface measurements"
                description="Confirms the main run, each active return, wall-top depth, and island length and width when an island is included. Changing any of those values resets this review."
                testId="steel-home-countertop-measurements-reviewed"
              />
              {!design.measurementsReviewed ? (
                <p className="mt-3 text-xs font-bold leading-5 text-[#7f2b24]">
                  Unreviewed starter values are excluded from the measured plan and fabricator
                  request.
                </p>
              ) : null}
            </div>

            <details
              className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white"
              data-testid="steel-home-countertop-scene-measurements"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                <span>
                  3D room, top, and island position
                  {sceneDiagnostics.length
                    ? ` · ${sceneDiagnostics.length} unresolved`
                    : " · entered"}
                </span>
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="border-t border-[#18312f]/10 p-4">
                <p className="text-xs leading-5 text-[#68736f]">
                  Blank stays unresolved. Room walls, vertical top geometry, and the island location
                  are hidden until the measurements that define them are entered; the planner does
                  not substitute typical dimensions.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <OptionalMeasurementField
                    label="Room inside width"
                    value={design.roomWidthIn}
                    min={24}
                    max={1_200}
                    onChange={(roomWidthIn) => updateSpatial({ roomWidthIn })}
                    testId="steel-home-countertop-room-width"
                  />
                  <OptionalMeasurementField
                    label="Room inside depth"
                    value={design.roomDepthIn}
                    min={24}
                    max={1_200}
                    onChange={(roomDepthIn) => updateSpatial({ roomDepthIn })}
                    testId="steel-home-countertop-room-depth"
                  />
                  <OptionalMeasurementField
                    label="Room wall height"
                    value={design.roomWallHeightIn}
                    min={48}
                    max={240}
                    onChange={(roomWallHeightIn) => updateSpatial({ roomWallHeightIn })}
                    testId="steel-home-countertop-room-wall-height"
                  />
                  <OptionalMeasurementField
                    label="Finished top height"
                    value={design.finishedTopHeightIn}
                    min={12}
                    max={72}
                    onChange={(finishedTopHeightIn) => updateSpatial({ finishedTopHeightIn })}
                    testId="steel-home-countertop-finished-top-height"
                  />
                  <OptionalMeasurementField
                    label="Finished top thickness"
                    value={design.topThicknessIn}
                    min={0.25}
                    max={6}
                    onChange={(topThicknessIn) => updateSpatial({ topThicknessIn })}
                    testId="steel-home-countertop-top-thickness"
                  />
                </div>
                {design.island ? (
                  <div className="mt-4 grid gap-4 border-t border-[#18312f]/10 pt-4 sm:grid-cols-2">
                    <OptionalMeasurementField
                      label="Island left edge from main-run left"
                      value={design.islandLeftOffsetIn}
                      min={-600}
                      max={1_200}
                      onChange={(islandLeftOffsetIn) => updateSpatial({ islandLeftOffsetIn })}
                      testId="steel-home-countertop-island-left-offset"
                      help="Negative values place the island edge left of the main run."
                    />
                    <OptionalMeasurementField
                      label="Island back edge from main wall"
                      value={design.islandBackOffsetIn}
                      min={-120}
                      max={1_200}
                      onChange={(islandBackOffsetIn) => updateSpatial({ islandBackOffsetIn })}
                      testId="steel-home-countertop-island-back-offset"
                      help="Measure perpendicular from the main wall/back edge."
                    />
                  </div>
                ) : null}
                {sceneDiagnostics.length ? (
                  <div
                    className="mt-4 rounded-xl border border-[#a94f2e]/25 bg-[#fff0ea] p-3 text-[#7f2b24]"
                    role="status"
                    data-testid="steel-home-countertop-scene-diagnostics"
                  >
                    <p className="text-xs font-black">Still unresolved</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                      {sceneDiagnostics.map((diagnostic) => (
                        <li key={diagnostic.id}>{diagnostic.label}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                Measured plan and opening placement
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="min-h-[17rem] overflow-hidden border-t border-[#18312f]/10 bg-[#eee9df] p-2">
                {design.measurementsReviewed ? (
                  <CountertopLayoutDiagram
                    design={design}
                    selectedOpeningId={selectedOpeningId}
                    onSelectOpening={setSelectedOpeningId}
                    onMoveOpening={(id, values) => {
                      if (values.positionIn !== undefined) {
                        changeOpeningPosition(id, values.positionIn);
                      } else if (values.frontPositionIn !== undefined) {
                        changeOpeningFrontPosition(id, values.frontPositionIn);
                      }
                    }}
                  />
                ) : (
                  <div
                    className="grid min-h-[17rem] place-items-center px-6 text-center"
                    data-testid="steel-home-countertop-plan-unreviewed"
                  >
                    <div className="max-w-sm">
                      <Ruler className="mx-auto h-7 w-7 text-[#a94f2e]" aria-hidden="true" />
                      <p className="mt-3 text-sm font-black">Measured plan not available yet</p>
                      <p className="mt-2 text-xs leading-5 text-[#68736f]">
                        Enter and review the run, depth, and enabled-island values above. Starter
                        values are not drawn as project measurements.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <p className="border-t border-[#18312f]/10 px-4 py-3 text-xs leading-5 text-[#68736f]">
                {design.measurementsReviewed
                  ? "This measured plan supports placement and the fabricator brief. Room-shell and vertical geometry remain separately unresolved until entered."
                  : "This stays a starter state until you confirm the surface measurements above."}
              </p>
            </details>

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                Edge and backsplash
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-4 border-t border-[#18312f]/10 p-4 sm:grid-cols-2">
                <ProjectTextSelect
                  label="Edge"
                  value={design.edge}
                  options={COUNTERTOP_EDGE_OPTIONS}
                  onChange={(edge) => update({ edge })}
                  testId="steel-home-countertop-edge"
                />
                <ProjectTextSelect
                  label="Backsplash"
                  value={design.backsplash}
                  options={COUNTERTOP_BACKSPLASH_OPTIONS}
                  onChange={(backsplash) => update({ backsplash })}
                  testId="steel-home-countertop-backsplash"
                />
                <p className="text-xs leading-5 text-[#68736f] sm:col-span-2">
                  Backsplash is recorded for the fabricator, but it is not included in this gross
                  layout footprint. Range gaps are shown for planning but are not deducted. Final
                  stone quantity requires field measurement and slab layout.
                </p>
              </div>
            </details>

            <details
              className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white"
              data-testid="steel-home-countertop-cutouts"
              aria-labelledby="steel-home-countertop-cutouts-title"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                <div>
                  <h3 id="steel-home-countertop-cutouts-title" className="text-sm font-black">
                    Sink, cooktop, range, and other openings
                    {openings.length ? ` · ${openings.length} added` : ""}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#68736f]">
                    Add each opening, choose its run, then set both center positions in inches.
                    Range gaps and apron-front sinks only need a distance along the run.
                  </p>
                </div>
                <ChevronDown
                  className="mt-1 h-4 w-4 shrink-0 text-[#a94f2e] transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>

              <div className="border-t border-[#18312f]/10 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ProjectTextSelect
                    label="Sink opening"
                    value={design.sink}
                    options={COUNTERTOP_SINK_OPTIONS}
                    onChange={(sink) => {
                      update({
                        sink,
                        sinkRun: sink === "None" ? "" : design.sinkRun,
                        sinkPositionIn: sink === "None" ? null : design.sinkPositionIn,
                        sinkFrontPositionIn: sink === "None" ? null : design.sinkFrontPositionIn,
                        sinkTemplateWidthIn: null,
                        sinkTemplateDepthIn: null,
                      });
                      if (sink !== "None") {
                        setSelectedOpeningId("sink");
                        setOpeningStatus("Sink added. Choose its run and position.");
                      }
                    }}
                    testId="steel-home-countertop-sink"
                  />
                  <ProjectTextSelect
                    label="Cooktop or range opening"
                    value={design.cooktop}
                    options={COUNTERTOP_COOKTOP_OPTIONS}
                    onChange={(cooktop) => {
                      update({
                        cooktop,
                        cooktopRun: cooktop === "None" ? "" : design.cooktopRun,
                        cooktopPositionIn: cooktop === "None" ? null : design.cooktopPositionIn,
                        cooktopFrontPositionIn:
                          cooktop === "None" ? null : design.cooktopFrontPositionIn,
                        cooktopTemplateWidthIn: null,
                        cooktopTemplateDepthIn: null,
                      });
                      if (cooktop !== "None") {
                        setSelectedOpeningId("cooktop");
                        setOpeningStatus("Cooktop or range opening added. Choose its location.");
                      }
                    }}
                    testId="steel-home-countertop-cooktop"
                  />
                </div>

                {design.sink === "Farmhouse" ? (
                  <p className="mt-3 rounded-xl border border-[#a94f2e]/20 bg-[#fff0ea] p-3 text-xs font-semibold leading-5 text-[#713d2b]">
                    Farmhouse means an apron-front edge opening—not a rectangular countertop cutout.
                    We record where it goes; the independent fabricator must use your exact sink
                    manufacturer&apos;s template before cutting.
                  </p>
                ) : null}

                {openingDiagnostics.length ? (
                  <div
                    className="mt-3 rounded-xl border border-[#b26a34]/25 bg-[#fff8e8] p-3 text-[#74451f]"
                    role="status"
                    data-testid="steel-home-countertop-opening-diagnostics"
                  >
                    <p className="text-xs font-black">
                      Template sizes unresolved · coordination points only
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                      {openingDiagnostics.map((diagnostic) => (
                        <li key={diagnostic.id}>{diagnostic.label}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs leading-5">
                      A point can be placed and included in an early fabricator brief. No opening is
                      drawn or cut-sized until both manufacturer template dimensions are entered.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#18312f]/10 pt-4">
                  <p className="text-xs font-semibold text-[#68736f]">
                    {placedOpeningCount} placed · {openings.length - placedOpeningCount} unplaced
                  </p>
                  <button
                    type="button"
                    onClick={addOtherCutout}
                    disabled={design.otherCutouts.length >= 6}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#18312f]/15 px-4 text-xs font-black transition hover:border-[#a94f2e] hover:text-[#a94f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] disabled:cursor-not-allowed disabled:opacity-45"
                    data-testid="steel-home-countertop-add-other-cutout"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add other opening
                  </button>
                </div>

                {openings.length ? (
                  <div
                    className="mt-3 grid gap-2 sm:grid-cols-2"
                    data-testid="steel-home-countertop-cutout-list"
                  >
                    {openings.map((opening) => {
                      const placed = Boolean(
                        opening.run &&
                        opening.positionIn !== null &&
                        (!opening.requiresFrontPosition || opening.frontPositionIn !== null)
                      );
                      const selected = opening.id === selectedOpeningId;
                      return (
                        <button
                          key={opening.id}
                          type="button"
                          onClick={() => setSelectedOpeningId(opening.id)}
                          aria-pressed={selected}
                          aria-invalid={!placed}
                          className={`min-h-14 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                            selected
                              ? "border-[#a94f2e] bg-[#fff4ee]"
                              : placed
                                ? "border-[#18312f]/10 bg-[#f8f5ef] hover:border-[#18312f]/30"
                                : "border-[#a1392e]/35 bg-[#fff1eb]"
                          }`}
                          data-testid={`steel-home-countertop-cutout-item-${opening.id}`}
                          data-representation={opening.representation}
                        >
                          <span className="block truncate text-xs font-black">{opening.label}</span>
                          <span
                            className={`mt-1 block text-[0.68rem] ${placed ? "text-[#68736f]" : "font-bold text-[#8f3329]"}`}
                          >
                            {placed
                              ? `${getCountertopCutoutRunLabel(opening.run)} · ${opening.positionIn}" from start${opening.placementKind === "front-edge-opening" ? " · apron/front-edge opening" : opening.requiresFrontPosition ? ` · ${opening.frontPositionIn}" from front` : " · full-depth gap"}${opening.representation === "coordination-point" ? " · coordination point" : ""}`
                              : "Needs a location"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-[#f4f0e8] p-3 text-xs leading-5 text-[#68736f]">
                    No openings added. Choose a sink, cooktop, range gap, or other opening above.
                  </p>
                )}

                {selectedOpening ? (
                  <OpeningPlacementEditor
                    design={design}
                    item={selectedOpening}
                    otherCutout={selectedOtherCutout}
                    onRunChange={(run) => changeOpeningRun(selectedOpening.id, run)}
                    onPositionChange={(positionIn) =>
                      changeOpeningPosition(selectedOpening.id, positionIn)
                    }
                    onFrontPositionChange={(frontPositionIn) =>
                      changeOpeningFrontPosition(selectedOpening.id, frontPositionIn)
                    }
                    onOtherChange={(values) => updateOtherCutout(selectedOpening.id, values)}
                    templateWidthIn={
                      selectedOpening.id === "sink"
                        ? design.sinkTemplateWidthIn
                        : selectedOpening.id === "cooktop"
                          ? design.cooktopTemplateWidthIn
                          : undefined
                    }
                    templateDepthIn={
                      selectedOpening.id === "sink"
                        ? design.sinkTemplateDepthIn
                        : selectedOpening.id === "cooktop"
                          ? design.cooktopTemplateDepthIn
                          : undefined
                    }
                    onTemplateChange={(values) => {
                      if (selectedOpening.id === "sink") {
                        updateSpatial({
                          ...(values.widthIn !== undefined
                            ? { sinkTemplateWidthIn: values.widthIn }
                            : {}),
                          ...(values.depthIn !== undefined
                            ? { sinkTemplateDepthIn: values.depthIn }
                            : {}),
                        });
                      } else if (selectedOpening.id === "cooktop") {
                        updateSpatial({
                          ...(values.widthIn !== undefined
                            ? { cooktopTemplateWidthIn: values.widthIn }
                            : {}),
                          ...(values.depthIn !== undefined
                            ? { cooktopTemplateDepthIn: values.depthIn }
                            : {}),
                        });
                      }
                    }}
                    onRemove={() => removeOpening(selectedOpening.id)}
                  />
                ) : null}

                <p
                  className="sr-only"
                  aria-live="polite"
                  data-testid="steel-home-countertop-cutout-status"
                >
                  {openingStatus}
                </p>

                {placementProblems.length ? (
                  <div
                    id="steel-home-countertop-placement-problems"
                    className="mt-4 rounded-xl border border-[#a1392e]/25 bg-[#fff0ea] p-3 text-[#7f2b24]"
                    role="status"
                    data-testid="steel-home-countertop-cutout-validation"
                  >
                    <p className="flex items-center gap-2 text-xs font-black">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      Place every opening before finding a fabricator.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                      {placementProblems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs leading-5">
                      You can still request the selected stone. Openings do not price the stone or
                      change this gross layout footprint.
                    </p>
                  </div>
                ) : null}
              </div>
            </details>

            <label className="mt-5 block space-y-2 text-sm font-bold">
              <span>Fabricator notes (optional)</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Waterfall ends, seams, overhangs, or special openings"
                className={PROJECT_TEXTAREA_CLASS}
                data-testid="steel-home-countertop-notes"
              />
              <span className="block text-xs font-normal leading-5 text-[#68736f]">
                These notes go only into the fabricator brief. They are never included in the
                stone-material request. Do not enter an exact address, phone number, or email.
              </span>
            </label>
          </div>

          <div className="sticky bottom-0 z-20 grid shrink-0 gap-3 border-t border-[#18312f]/12 bg-white px-4 py-3 shadow-[0_-12px_35px_rgba(24,49,47,.09)] sm:grid-cols-[minmax(8rem,1fr)_auto] sm:items-center sm:px-6">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#a94f2e]">
                {design.measurementsReviewed
                  ? "Gross countertop layout footprint · Stone quote needed"
                  : "Countertop footprint unresolved · Stone and fabrication stay separate"}
              </p>
              <p className="truncate text-lg font-black">
                {design.measurementsReviewed
                  ? `About ${squareFeet} sq. ft.`
                  : "Review surface measurements"}
              </p>
              <p className="text-[0.68rem] font-semibold text-[#68736f]">
                {design.measurementsReviewed
                  ? "Backsplash excluded · range gaps not deducted · final slab quantity requires measurement"
                  : "Starter run values are not sent as measured geometry"}
              </p>
              {!stoneReadiness.ready ? (
                <p
                  id="steel-home-countertop-stone-readiness"
                  className="mt-1 text-[0.68rem] font-bold text-[#8f3329]"
                >
                  {stoneReadiness.problems.join(" ")}
                </p>
              ) : null}
              {!fabricatorReadiness.ready ? (
                <p
                  id="steel-home-countertop-fabricator-readiness"
                  className="mt-1 text-[0.68rem] font-bold text-[#8f3329]"
                >
                  Fabricator request: {fabricatorReadiness.problems.join(" ")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => request("stone")}
                disabled={!stoneReadiness.ready}
                aria-describedby={
                  stoneReadiness.ready ? undefined : "steel-home-countertop-stone-readiness"
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#a94f2e] px-5 text-sm font-black text-white transition hover:bg-[#8f3f25] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#b8aaa2]"
                data-testid="steel-home-countertop-request-stone"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Request this stone
              </button>
              <button
                type="button"
                onClick={() => request("fabricator")}
                disabled={!fabricatorReadiness.ready}
                aria-describedby={
                  fabricatorReadiness.ready
                    ? undefined
                    : "steel-home-countertop-fabricator-readiness"
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#18312f]/20 bg-white px-5 text-sm font-black text-[#18312f] transition hover:border-[#18312f]/45 hover:bg-[#f4f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-[#18312f]/8 disabled:bg-[#ecebe6] disabled:text-[#7d8581]"
                data-testid="steel-home-countertop-find-fabricator"
              >
                <Hammer className="h-4 w-4" aria-hidden="true" />
                Find a fabricator
              </button>
            </div>
          </div>
        </div>
      </div>

      {galleryOpen ? (
        <SurfaceGallery
          selectedId={design.stoneId}
          onSelect={(stoneId) => {
            const nextStone = getCatalogItemById(stoneId);
            update({
              stoneId,
              textureImageIndex: 0,
              texturePhotoKey: buildStoneDesignerPhotoKey(nextStone?.images[0] || "") || "",
            });
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </section>
  );
}
