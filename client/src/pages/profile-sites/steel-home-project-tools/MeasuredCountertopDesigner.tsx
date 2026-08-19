import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Hammer,
  ImageOff,
  Plus,
  Ruler,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { JW_STONE_NAMED_CATALOG, getCatalogItemById } from "@/features/jw-stone/catalog";
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
  type CountertopCutoutRun,
  type SteelHomeCountertopCutout,
} from "./projectModel";
import {
  getCountertopPlannerDiagnostics,
  getCountertopPlannerOpeningFrontBounds,
  getCountertopPlannerOpeningSchedule,
  getCountertopPlannerPlacementProblems,
  getCountertopPlannerRequestReadiness,
  resolveCountertopPlannerDesign,
  type CountertopPlannerDesign,
  type CountertopPlannerDesignInput,
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
import { buildStoneDesignerImageHref, buildStoneDesignerPhotoKey } from "./stoneDesignerImages";
import { getStoneProjectionDecision } from "./stoneProjectionSafety";

const StoneVisualizer3D = lazy(() => import("./StoneVisualizer3D"));

type Props = {
  design: CountertopPlannerDesignInput;
  onChange: (design: CountertopPlannerDesignInput) => void;
  onRequest: (intent: "stone" | "fabricator") => void;
};

type ViewMode = "plan" | "3d";

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

const allNamedStones = [...JW_STONE_NAMED_CATALOG].sort((first, second) =>
  first.publicLabel.localeCompare(second.publicLabel)
);

const snapToEighth = (value: number) => Number((Math.round(value * 8) / 8).toFixed(3));

function layoutLabel(design: CountertopPlannerDesign): string {
  return (
    COUNTERTOP_LAYOUT_OPTIONS.find((option) => option.value === design.layout)?.label ||
    "Selected layout"
  );
}

function buildDiagramGeometry(design: CountertopPlannerDesign): DiagramGeometry {
  const depth = Math.min(90, Math.max(34, design.wallDepthIn * 2));
  const rawTopRunWidth = Math.min(520, Math.max(190, design.wallAIn * 1.72));
  const topRunWidth =
    design.layout === "u-shape" ? Math.max(depth * 2 + 110, rawTopRunWidth) : rawTopRunWidth;
  const topX = (760 - topRunWidth) / 2;
  const topY = design.layout === "straight" ? 125 : 72;
  const leftRunHeight = Math.min(190, Math.max(90, design.wallBIn * 0.9));
  const rightRunHeight = Math.min(190, Math.max(90, design.wallCIn * 0.9));
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
  const islandWidth = Math.min(275, Math.max(110, design.islandLengthIn * 1.62));
  const islandHeight = Math.min(82, Math.max(40, design.islandWidthIn * 0.96));
  const islandX = (760 - islandWidth) / 2;
  const islandY = design.layout === "straight" ? 250 : 270;
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

function openingKind(item: CountertopPlannerOpeningScheduleItem) {
  if (item.id === "sink") return "sink";
  if (item.id === "cooktop") return /range gap/i.test(item.label) ? "range" : "cooktop";
  return "other";
}

function CountertopMeasuredPlan({
  design,
  selectedOpeningId,
  onSelectOpening,
}: {
  design: CountertopPlannerDesign;
  selectedOpeningId: string | null;
  onSelectOpening: (id: string) => void;
}) {
  const geometry = buildDiagramGeometry(design);
  const openings = getCountertopPlannerOpeningSchedule(design);
  const problems = getCountertopPlannerPlacementProblems(design);
  const squareFeet = calculateCountertopSquareFeet(design);
  const stone = getCatalogItemById(design.stoneId);

  return (
    <svg
      viewBox="0 0 760 470"
      className="h-full min-h-[25rem] w-full"
      role="group"
      aria-label={`${design.room} ${layoutLabel(design)} measured countertop plan. Use the controls beside the plan to place openings.`}
      data-testid="steel-home-countertop-preview"
      data-layout={design.layout}
      data-opening-count={openings.length}
      data-floor-stone="false"
    >
      <defs>
        <linearGradient id="countertop-plan-surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ddd6cb" />
          <stop offset="1" stopColor="#c6beb2" />
        </linearGradient>
        <pattern id="countertop-plan-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#18312f" strokeOpacity=".07" />
        </pattern>
        <filter id="countertop-plan-shadow" x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="9" stdDeviation="9" floodOpacity=".18" />
        </filter>
      </defs>
      <rect width="760" height="470" fill="#eee9df" />
      <rect width="760" height="470" fill="url(#countertop-plan-grid)" />

      <g fill="#18312f" fontFamily="system-ui, sans-serif">
        <text x="28" y="34" fontSize="13" fontWeight="900" letterSpacing="1.5">
          {design.room.toUpperCase()} · {layoutLabel(design).toUpperCase()}
        </text>
        <text x="732" y="34" textAnchor="end" fontSize="18" fontWeight="900">
          {squareFeet} SQ. FT. GROSS FOOTPRINT
        </text>
      </g>

      <g filter="url(#countertop-plan-shadow)">
        <path
          d={geometry.layoutPath}
          fill="url(#countertop-plan-surface)"
          stroke="#18312f"
          strokeWidth="5"
          strokeLinejoin="round"
          data-testid="steel-home-countertop-layout-preview"
        />
        {design.island ? (
          <rect
            x={geometry.islandX}
            y={geometry.islandY}
            width={geometry.islandWidth}
            height={geometry.islandHeight}
            rx="6"
            fill="url(#countertop-plan-surface)"
            stroke="#18312f"
            strokeWidth="5"
            data-testid="steel-home-countertop-island-preview"
          />
        ) : null}
      </g>

      <g fill="#713d2b" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="900">
        <text
          x={geometry.topX + geometry.topRunWidth / 2}
          y={geometry.topY + geometry.depth - 7}
          textAnchor="middle"
        >
          FINISHED ROOM-FACING EDGE
        </text>
        {design.island ? (
          <text
            x={geometry.islandX + geometry.islandWidth / 2}
            y={geometry.islandY + geometry.islandHeight - 7}
            textAnchor="middle"
          >
            FINISHED ROOM-FACING EDGE
          </text>
        ) : null}
      </g>

      <g fill="#596965" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="800">
        <text
          x={geometry.topX + geometry.topRunWidth / 2}
          y={geometry.topY - 13}
          textAnchor="middle"
        >
          Main run {design.wallAIn}&quot; × {design.wallDepthIn}&quot;
        </text>
        {design.layout !== "straight" ? (
          <text x={geometry.topX - 12} y={geometry.topY + geometry.leftRunHeight / 2} textAnchor="end">
            Left {design.wallBIn}&quot;
          </text>
        ) : null}
        {design.layout === "u-shape" ? (
          <text x={geometry.topX + geometry.topRunWidth + 12} y={geometry.topY + geometry.rightRunHeight / 2}>
            Right {design.wallCIn}&quot;
          </text>
        ) : null}
        {design.island ? (
          <text x="380" y={geometry.islandY + geometry.islandHeight + 22} textAnchor="middle">
            Island {design.islandLengthIn}&quot; × {design.islandWidthIn}&quot;
          </text>
        ) : null}
      </g>

      {openings.map((item) => {
        if (!item.run || item.positionIn === null) return null;
        const runGeometry = geometry.runs[item.run];
        if (!runGeometry) return null;
        const runLength = getCountertopCutoutRunLength(design, item.run);
        const fraction = Math.min(1, Math.max(0, item.positionIn / runLength));
        const surfaceDepth = getCountertopCutoutRunDepth(design, item.run);
        const visualDepth = item.run === "island" ? geometry.islandHeight : geometry.depth;
        const frontPosition = item.frontPositionIn ?? surfaceDepth / 2;
        const frontFraction = Math.min(1, Math.max(0, frontPosition / surfaceDepth));
        let x = runGeometry.x + (runGeometry.angle === 0 ? runGeometry.length * fraction : 0);
        let y = runGeometry.y + (runGeometry.angle === 90 ? runGeometry.length * fraction : 0);
        if (item.placementKind === "front-edge-opening") {
          if (item.run === "main" || item.run === "island") y += visualDepth / 2;
          else if (item.run === "left-return") x += visualDepth / 2;
          else x -= visualDepth / 2;
        } else if (item.requiresFrontPosition) {
          if (item.run === "main" || item.run === "island") {
            y += visualDepth / 2 - visualDepth * frontFraction;
          } else if (item.run === "left-return") {
            x += visualDepth / 2 - visualDepth * frontFraction;
          } else {
            x += -visualDepth / 2 + visualDepth * frontFraction;
          }
        }
        const selected = selectedOpeningId === item.id;
        const invalid = problems.some((problem) => problem.includes(item.label));
        const markerWidth = Math.min(
          90,
          Math.max(8, item.planningWidthIn * (runGeometry.length / runLength))
        );
        const markerDepth = Math.min(
          visualDepth * 0.8,
          Math.max(8, item.depthIn ? visualDepth * (item.depthIn / surfaceDepth) : 12)
        );
        const kind = openingKind(item);
        return (
          <g
            key={item.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-invalid={invalid}
            aria-label={`${item.label}, ${getCountertopCutoutRunLabel(item.run)}, ${item.positionIn} inches from ${getCountertopCutoutStartLabel(item.run)}`}
            onClick={() => onSelectOpening(item.id)}
            onFocus={() => onSelectOpening(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectOpening(item.id);
              }
            }}
            transform={`translate(${x} ${y}) rotate(${runGeometry.angle})`}
            className="cursor-pointer outline-none"
            data-testid={`steel-home-countertop-cutout-handle-${item.id}`}
            data-representation={item.representation}
          >
            <rect
              x={-Math.max(28, markerWidth / 2 + 8)}
              y="-25"
              width={Math.max(56, markerWidth + 16)}
              height="50"
              rx="12"
              fill="transparent"
              stroke={invalid ? "#a1392e" : selected ? "#a94f2e" : "transparent"}
              strokeWidth="4"
              strokeDasharray="5 4"
            />
            {item.representation === "coordination-point" ? (
              <g>
                <circle r="10" fill="#fff5ee" stroke="#a94f2e" strokeWidth="3" />
                <path d="M-5 0H5M0-5V5" stroke="#713d2b" strokeWidth="2" />
              </g>
            ) : kind === "range" ? (
              <rect
                x={-markerWidth / 2}
                y={-visualDepth / 2}
                width={markerWidth}
                height={visualDepth}
                fill="#eee9df"
                stroke="#a94f2e"
                strokeWidth="4"
                strokeDasharray="7 5"
              />
            ) : (
              <rect
                x={-markerWidth / 2}
                y={-markerDepth / 2}
                width={markerWidth}
                height={markerDepth}
                rx={kind === "sink" ? 9 : 4}
                fill={kind === "sink" ? "#8fa7a6" : kind === "cooktop" ? "#2c302f" : "#f0b392"}
                stroke="#f8f4ed"
                strokeWidth="4"
              />
            )}
          </g>
        );
      })}

      {openings.some((item) => !item.run || item.positionIn === null) ? (
        <g data-testid="steel-home-countertop-unplaced-openings">
          <text x="28" y="410" fill="#8f3329" fontFamily="system-ui" fontSize="12" fontWeight="900">
            OPENINGS NEEDING A LOCATION
          </text>
          {openings
            .filter((item) => !item.run || item.positionIn === null)
            .map((item, index) => (
              <g
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectOpening(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectOpening(item.id);
                  }
                }}
              >
                <rect
                  x={28 + (index % 4) * 176}
                  y={420 + Math.floor(index / 4) * 34}
                  width="164"
                  height="28"
                  rx="9"
                  fill="#fff5ee"
                  stroke="#a1392e"
                  strokeWidth="2"
                />
                <text
                  x={38 + (index % 4) * 176}
                  y={438 + Math.floor(index / 4) * 34}
                  fill="#7f2b24"
                  fontFamily="system-ui"
                  fontSize="10"
                  fontWeight="800"
                >
                  {item.label.slice(0, 22)}
                </text>
              </g>
            ))}
        </g>
      ) : null}

      <text x="28" y="462" fill="#68736f" fontFamily="system-ui" fontSize="10" fontWeight="700">
        {stone ? `${stone.publicLabel} selected as a reference` : "No stone selected"} · openings and backsplash do not change the gross footprint shown here
      </text>
    </svg>
  );
}

function OptionalMeasurementField({
  label,
  value,
  min,
  max,
  onChange,
  testId,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
  testId: string;
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
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, snapToEighth(parsed))));
          }}
          className={`${PROJECT_FIELD_CLASS} pr-12`}
          data-testid={testId}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#72807b]">
          in
        </span>
      </span>
    </label>
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
  const [query, setQuery] = useState("");
  const matching = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allNamedStones;
    return allNamedStones.filter(
      (stone) =>
        stone.publicLabel.toLowerCase().includes(normalized) ||
        stone.materialLabel?.toLowerCase().includes(normalized)
    );
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-[#f5f1e8] text-[#18312f]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="measured-countertop-gallery-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      data-testid="steel-home-countertop-surface-gallery"
    >
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#18312f]/12 bg-[#faf7f1] px-4 sm:px-6">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#a94f2e]">
            JW Stone catalog
          </p>
          <h3 id="measured-countertop-gallery-title" className="text-lg font-black">
            Choose a stone reference
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close stone gallery"
          className="grid h-11 w-11 place-items-center rounded-full border border-[#18312f]/15 bg-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <div className="border-b border-[#18312f]/10 bg-[#eee8dd] p-4 sm:px-6">
        <label className="relative block">
          <span className="sr-only">Search stone</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736f]"
            aria-hidden="true"
          />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by stone or material"
            className={`${PROJECT_FIELD_CLASS} pl-11`}
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {matching.map((stone) => {
            const selected = stone.id === selectedId;
            return (
              <button
                key={stone.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(stone.id)}
                className={`overflow-hidden rounded-2xl border bg-white text-left ${
                  selected ? "border-[#a94f2e] ring-2 ring-[#a94f2e]/20" : "border-[#18312f]/10"
                }`}
                data-testid={`steel-home-countertop-stone-${stone.id}`}
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-[#d5d1c8]">
                  <img
                    src={buildStoneDesignerImageHref(stone.id)}
                    alt={`${stone.publicLabel} inventory reference`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {selected ? (
                    <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[#18312f] text-white">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span className="block p-3">
                  <span className="block text-sm font-black">{stone.publicLabel}</span>
                  <span className="mt-1 block text-[0.66rem] font-bold uppercase tracking-[0.1em] text-[#77817d]">
                    {stone.materialLabel || "Material to confirm"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function clampAlongRun(
  design: CountertopPlannerDesign,
  run: CountertopCutoutRun,
  value: number,
  widthIn: number
) {
  const length = getCountertopCutoutRunLength(design, run);
  const minimum = widthIn / 2 + 2;
  const maximum = length - widthIn / 2 - 2;
  if (maximum <= minimum) return snapToEighth(length / 2);
  return snapToEighth(Math.min(maximum, Math.max(minimum, value)));
}

function normalizePlacements(design: CountertopPlannerDesign): CountertopPlannerDesign {
  const availableRuns = new Set(getAvailableCountertopCutoutRuns(design).map((item) => item.value));
  const clean = (
    run: CountertopCutoutRun | "",
    positionIn: number | null,
    frontPositionIn: number | null
  ) =>
    run && availableRuns.has(run)
      ? { run, positionIn, frontPositionIn }
      : { run: "" as const, positionIn: null, frontPositionIn: null };
  const sink = clean(design.sinkRun, design.sinkPositionIn, design.sinkFrontPositionIn);
  const cooktop = clean(
    design.cooktopRun,
    design.cooktopPositionIn,
    design.cooktopFrontPositionIn
  );
  return {
    ...design,
    ...{
      sinkRun: sink.run,
      sinkPositionIn: sink.positionIn,
      sinkFrontPositionIn: sink.frontPositionIn,
      cooktopRun: cooktop.run,
      cooktopPositionIn: cooktop.positionIn,
      cooktopFrontPositionIn: cooktop.frontPositionIn,
    },
    otherCutouts: design.otherCutouts.map((cutout) => ({
      ...cutout,
      ...clean(cutout.run, cutout.positionIn, cutout.frontPositionIn),
    })),
  };
}

function OpeningEditor({
  design,
  item,
  otherCutout,
  onChange,
  onOtherChange,
  onTemplateChange,
  onRemove,
}: {
  design: CountertopPlannerDesign;
  item: CountertopPlannerOpeningScheduleItem;
  otherCutout?: SteelHomeCountertopCutout;
  onChange: (values: {
    run?: CountertopCutoutRun | "";
    positionIn?: number | null;
    frontPositionIn?: number | null;
  }) => void;
  onOtherChange: (values: Partial<SteelHomeCountertopCutout>) => void;
  onTemplateChange: (values: { widthIn?: number | null; depthIn?: number | null }) => void;
  onRemove: () => void;
}) {
  const availableRuns = getAvailableCountertopCutoutRuns(design);
  const runLength = item.run ? getCountertopCutoutRunLength(design, item.run) : null;
  const width = Math.max(2, item.planningWidthIn);
  const minimum = width / 2 + 2;
  const maximum = runLength ? Math.max(minimum, runLength - width / 2 - 2) : minimum;
  const frontBounds = getCountertopPlannerOpeningFrontBounds(design, item);

  return (
    <div
      className="rounded-2xl border border-[#18312f]/12 bg-[#f8f5ef] p-4"
      data-testid="steel-home-countertop-cutout-editor"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{item.label}</p>
          <p className="mt-1 text-xs leading-5 text-[#68736f]">
            {item.representation === "coordination-point"
              ? "Template sizes unresolved · coordination point only"
              : item.representation === "full-depth-gap"
                ? "Full-depth range gap"
                : "Manufacturer template dimensions entered"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-xs font-black text-[#8f3329] hover:bg-[#f8dfd8]"
          data-testid="steel-home-countertop-cutout-remove"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
        </button>
      </div>

      {otherCutout ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-xs font-bold">
            <span>Opening type</span>
            <select
              value={otherCutout.type}
              onChange={(event) =>
                onOtherChange({ type: event.target.value as SteelHomeCountertopCutout["type"] })
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
                value={otherCutout.label}
                maxLength={40}
                onChange={(event) => onOtherChange({ label: event.target.value })}
                className={PROJECT_FIELD_CLASS}
                data-testid="steel-home-countertop-cutout-label"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {item.placementKind !== "full-depth-gap" ? (
        <div className="mt-4 rounded-xl border border-[#18312f]/10 bg-white p-3">
          <p className="text-xs font-black">Manufacturer template size</p>
          <p className="mt-1 text-[0.7rem] leading-5 text-[#68736f]">
            Leave blank to keep a non-dimensional coordination point. Enter both values only from
            the exact fixture or appliance template; the scene shows only a coordination point and
            does not guess a cutout.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <OptionalMeasurementField
              label="Opening width"
              value={item.widthIn}
              min={0.125}
              max={96}
              onChange={(widthIn) =>
                otherCutout ? onOtherChange({ widthIn }) : onTemplateChange({ widthIn })
              }
              testId={`steel-home-countertop-${item.id}-template-width`}
            />
            <OptionalMeasurementField
              label="Opening depth"
              value={item.depthIn}
              min={0.125}
              max={72}
              onChange={(depthIn) =>
                otherCutout ? onOtherChange({ depthIn }) : onTemplateChange({ depthIn })
              }
              testId={`steel-home-countertop-${item.id}-template-depth`}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
        <label className="space-y-2 text-xs font-bold">
          <span>Place on</span>
          <select
            value={item.run}
            onChange={(event) => {
              const run = event.target.value as CountertopCutoutRun | "";
              if (!run) {
                onChange({ run: "", positionIn: null, frontPositionIn: null });
                return;
              }
              const length = getCountertopCutoutRunLength(design, run);
              const depth = getCountertopCutoutRunDepth(design, run);
              onChange({
                run,
                positionIn: clampAlongRun(design, run, item.positionIn ?? length / 2, width),
                frontPositionIn: item.requiresFrontPosition
                  ? snapToEighth(item.frontPositionIn ?? depth / 2)
                  : null,
              });
            }}
            className={PROJECT_FIELD_CLASS}
            data-testid="steel-home-countertop-cutout-surface"
          >
            <option value="">Choose a run</option>
            {availableRuns.map((run) => (
              <option key={run.value} value={run.value}>
                {run.label} · {getCountertopCutoutRunLength(design, run.value)}&quot;
              </option>
            ))}
          </select>
        </label>
        <OptionalMeasurementField
          label={`Center from ${item.run ? getCountertopCutoutStartLabel(item.run) : "run start"}`}
          value={item.positionIn}
          min={minimum}
          max={maximum}
          onChange={(positionIn) =>
            onChange({
              positionIn:
                item.run && positionIn !== null
                  ? clampAlongRun(design, item.run, positionIn, width)
                  : positionIn,
            })
          }
          testId="steel-home-countertop-cutout-position"
        />
        {item.requiresFrontPosition ? (
          <OptionalMeasurementField
            label="Center from front edge"
            value={item.frontPositionIn}
            min={frontBounds?.minimum ?? 1}
            max={frontBounds?.maximum ?? Math.max(1, getCountertopCutoutRunDepth(design, item.run || "main") - 1)}
            onChange={(frontPositionIn) => onChange({ frontPositionIn })}
            testId="steel-home-countertop-cutout-front-position"
          />
        ) : (
          <p className="rounded-xl bg-[#eee9df] px-3 py-3 text-xs font-bold leading-5 text-[#5f6c68]">
            {item.placementKind === "front-edge-opening"
              ? "Apron opening meets the finished front edge."
              : "The range gap spans the full surface depth."}
          </p>
        )}
      </div>

      {item.run && item.positionIn !== null ? (
        <label className="mt-4 block space-y-2 text-xs font-bold">
          <span className="flex justify-between gap-3">
            Move along {getCountertopCutoutRunLabel(item.run).toLowerCase()}
            <span className="text-[#68736f]">{item.positionIn}&quot;</span>
          </span>
          <input
            type="range"
            min={minimum}
            max={maximum}
            step="0.125"
            value={item.positionIn}
            onChange={(event) =>
              onChange({ positionIn: clampAlongRun(design, item.run, Number(event.target.value), width) })
            }
            className="h-11 w-full accent-[#a94f2e]"
            data-testid="steel-home-countertop-cutout-position-range"
          />
        </label>
      ) : null}
      {item.run && item.requiresFrontPosition && item.frontPositionIn !== null && frontBounds ? (
        <label className="mt-3 block space-y-2 text-xs font-bold">
          <span className="flex justify-between gap-3">
            Move front to back
            <span className="text-[#68736f]">{item.frontPositionIn}&quot; from front</span>
          </span>
          <input
            type="range"
            min={frontBounds.minimum}
            max={frontBounds.maximum}
            step="0.125"
            value={item.frontPositionIn}
            onChange={(event) => onChange({ frontPositionIn: Number(event.target.value) })}
            className="h-11 w-full accent-[#a94f2e]"
            data-testid="steel-home-countertop-cutout-front-position-range"
          />
        </label>
      ) : null}
    </div>
  );
}

export default function MeasuredCountertopDesigner({ design: designInput, onChange, onRequest }: Props) {
  const design = useMemo(() => resolveCountertopPlannerDesign(designInput), [designInput]);
  const [view, setView] = useState<ViewMode>("plan");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedSurfaceTarget, setSelectedSurfaceTarget] = useState<StoneSurfaceTarget>("counter");
  const selectedStone = getCatalogItemById(design.stoneId);
  const selectedImage = selectedStone?.images[design.textureImageIndex] || null;
  const projection = getStoneProjectionDecision(selectedImage);
  const openings = getCountertopPlannerOpeningSchedule(design);
  const placementProblems = getCountertopPlannerPlacementProblems(design);
  const diagnostics = getCountertopPlannerDiagnostics(design);
  const stoneReadiness = getCountertopPlannerRequestReadiness(design, "stone");
  const fabricatorReadiness = getCountertopPlannerRequestReadiness(design, "fabricator");
  const squareFeet = calculateCountertopSquareFeet(design);
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId) || null;
  const selectedOtherCutout = selectedOpening
    ? design.otherCutouts.find((cutout) => cutout.id === selectedOpening.id)
    : undefined;

  const update = (values: Partial<CountertopPlannerDesign>) =>
    onChange(resolveCountertopPlannerDesign({ ...design, ...values, floorStone: false }));

  const updateGeometry = (values: Partial<CountertopPlannerDesign>) => {
    const next = resolveCountertopPlannerDesign({
      ...design,
      ...values,
      floorStone: false,
      measurementsReviewed: false,
    });
    onChange(normalizePlacements(next));
  };

  useEffect(() => {
    if (design.floorStone) update({ floorStone: false });
  }, [design.floorStone]);

  useEffect(() => {
    if (!openings.length) {
      setSelectedOpeningId(null);
      return;
    }
    if (!selectedOpeningId || !openings.some((opening) => opening.id === selectedOpeningId)) {
      setSelectedOpeningId(openings[0].id);
    }
  }, [openings, selectedOpeningId]);

  const changeOpening = (
    id: string,
    values: {
      run?: CountertopCutoutRun | "";
      positionIn?: number | null;
      frontPositionIn?: number | null;
    }
  ) => {
    if (id === "sink") {
      update({
        ...(values.run !== undefined ? { sinkRun: values.run } : {}),
        ...(values.positionIn !== undefined ? { sinkPositionIn: values.positionIn } : {}),
        ...(values.frontPositionIn !== undefined
          ? { sinkFrontPositionIn: values.frontPositionIn }
          : {}),
      });
      return;
    }
    if (id === "cooktop") {
      update({
        ...(values.run !== undefined ? { cooktopRun: values.run } : {}),
        ...(values.positionIn !== undefined ? { cooktopPositionIn: values.positionIn } : {}),
        ...(values.frontPositionIn !== undefined
          ? { cooktopFrontPositionIn: values.frontPositionIn }
          : {}),
      });
      return;
    }
    update({
      otherCutouts: design.otherCutouts.map((cutout) =>
        cutout.id === id ? { ...cutout, ...values } : cutout
      ),
    });
  };

  const removeOpening = (id: string) => {
    if (id === "sink") {
      update({
        sink: "None",
        sinkRun: "",
        sinkPositionIn: null,
        sinkFrontPositionIn: null,
        sinkTemplateWidthIn: null,
        sinkTemplateDepthIn: null,
      });
    } else if (id === "cooktop") {
      update({
        cooktop: "None",
        cooktopRun: "",
        cooktopPositionIn: null,
        cooktopFrontPositionIn: null,
        cooktopTemplateWidthIn: null,
        cooktopTemplateDepthIn: null,
      });
    } else {
      update({ otherCutouts: design.otherCutouts.filter((cutout) => cutout.id !== id) });
    }
  };

  const addOtherOpening = () => {
    if (design.otherCutouts.length >= 6) return;
    let index = 1;
    const used = new Set(design.otherCutouts.map((cutout) => cutout.id));
    while (used.has(`other-${index}`)) index += 1;
    const opening: SteelHomeCountertopCutout = {
      id: `other-${index}`,
      type: "Other opening",
      label: "",
      run: "",
      positionIn: null,
      frontPositionIn: null,
      widthIn: null,
      depthIn: null,
    };
    update({ otherCutouts: [...design.otherCutouts, opening] });
    setSelectedOpeningId(opening.id);
  };

  const request = (intent: "stone" | "fabricator") => {
    const readiness = intent === "stone" ? stoneReadiness : fabricatorReadiness;
    if (!readiness.ready) return;
    onChange({ ...design, included: true, floorStone: false });
    onRequest(intent);
  };

  const visualizerDesign = resolveCountertopPlannerDesign({
    ...design,
    floorStone: false,
    stoneId: projection.allowed ? design.stoneId : "",
  });

  return (
    <section
      id="countertop-designer"
      className="min-w-0 overflow-x-hidden bg-[#17201f] text-white"
      data-testid="steel-home-countertop-designer"
    >
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(22rem,.82fr)]">
        <div className="min-w-0 border-b border-white/10 p-3 sm:p-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-2">
            <div className="flex gap-1" aria-label="Countertop planner views">
              <button
                type="button"
                aria-pressed={view === "plan"}
                onClick={() => setView("plan")}
                className={`min-h-10 rounded-xl px-4 text-xs font-black ${
                  view === "plan" ? "bg-white text-[#18312f]" : "text-white/70 hover:bg-white/10"
                }`}
                data-testid="steel-home-countertop-view-plan"
              >
                Measured plan
              </button>
              <button
                type="button"
                aria-pressed={view === "3d"}
                onClick={() => setView("3d")}
                className={`min-h-10 rounded-xl px-4 text-xs font-black ${
                  view === "3d" ? "bg-white text-[#18312f]" : "text-white/70 hover:bg-white/10"
                }`}
                data-testid="steel-home-countertop-view-3d"
              >
                3D Preview
              </button>
            </div>
            <p className="px-2 text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
              Plan first · 3D second
            </p>
          </div>

          <div className="relative mt-3 min-h-[30rem] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#eee9df] sm:min-h-[34rem]">
            {view === "plan" ? (
              design.measurementsReviewed ? (
                <CountertopMeasuredPlan
                  design={design}
                  selectedOpeningId={selectedOpeningId}
                  onSelectOpening={setSelectedOpeningId}
                />
              ) : (
                <div
                  className="grid min-h-[34rem] place-items-center bg-[#eee9df] px-6 text-center text-[#18312f]"
                  data-testid="steel-home-countertop-plan-unreviewed"
                >
                  <div className="max-w-md">
                    <Ruler className="mx-auto h-9 w-9 text-[#a94f2e]" aria-hidden="true" />
                    <p className="mt-4 text-xl font-black">Measured plan not available yet</p>
                    <p className="mt-2 text-sm leading-6 text-[#68736f]">
                      Enter the actual run, depth, and enabled-island measurements, then confirm that
                      you reviewed them. Starter values are never presented as project measurements.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="relative min-h-[34rem]">
                <Suspense
                  fallback={
                    <div className="grid min-h-[34rem] place-items-center bg-[#29302e] text-sm font-semibold text-white/70">
                      Preparing the measured 3D preview…
                    </div>
                  }
                >
                  <StoneVisualizer3D
                    design={visualizerDesign}
                    selectedTarget={selectedSurfaceTarget}
                    onSelectTarget={setSelectedSurfaceTarget}
                  />
                </Suspense>
                {!projection.allowed && selectedStone && selectedImage ? (
                  <div className="absolute right-3 top-20 z-20 w-44 overflow-hidden rounded-2xl border border-white/15 bg-[#101817]/92 p-2 shadow-xl backdrop-blur-sm sm:w-56">
                    <img
                      src={buildStoneDesignerImageHref(selectedStone.id, design.textureImageIndex)}
                      alt={`${selectedStone.publicLabel} reference photo`}
                      className="aspect-[4/3] w-full rounded-xl object-contain bg-black/20"
                    />
                    <p className="mt-2 text-[0.68rem] font-black text-white">Reference photo only</p>
                    <p className="mt-1 text-[0.62rem] leading-4 text-white/65">
                      Raw inventory photography is not stretched across the room.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {view === "3d" ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 sm:grid-cols-4">
              {COUNTERTOP_CAMERA_PRESET_OPTIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={design.cameraPreset === preset}
                  onClick={() => update({ cameraPreset: preset })}
                  className={`min-h-10 rounded-xl px-3 text-xs font-black ${
                    design.cameraPreset === preset
                      ? "bg-[#f0b392] text-[#18312f]"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          ) : null}

          <div
            className="mt-3 grid gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.07] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            data-testid="steel-home-countertop-live-summary"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                {design.measurementsReviewed
                  ? `${design.room} · ${layoutLabel(design)} · ${design.edge} edge`
                  : "Countertop starter · measurements unreviewed"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {openings.length
                  ? `${openings.length} planned ${openings.length === 1 ? "opening" : "openings"}`
                  : "No cutouts or openings"}
                {placementProblems.length ? ` · ${placementProblems.length} need attention` : ""}
              </p>
              <p className="mt-2 text-xs font-semibold text-white/60">
                counter · {selectedStone ? "reference selected" : "surface unselected"} · floor stone disabled
              </p>
              {!design.measurementsReviewed ? (
                <p className="mt-2 text-xs font-bold leading-5 text-[#f5c3aa]">
                  Starter run values are unreviewed; measured plan and countertop geometry stay hidden.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3 sm:text-right">
              <Ruler className="h-5 w-5 text-[#f0b392]" aria-hidden="true" />
              <div>
                <p className="text-xl font-black">
                  {design.measurementsReviewed ? `About ${squareFeet} sq. ft.` : "Footprint unresolved"}
                </p>
                <p className="text-xs font-semibold text-white/55">
                  Gross top footprint · backsplash excluded
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 bg-[#f6f1e8] text-[#18312f]">
          <div className="space-y-5 px-4 py-5 sm:px-6">
            <section className="rounded-[1.35rem] border border-[#18312f]/12 bg-white p-4 shadow-[0_12px_35px_rgba(24,49,47,.07)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#a94f2e]">
                    Stone reference
                  </p>
                  <h2 className="mt-1 font-editorial text-2xl font-semibold">
                    {selectedStone?.publicLabel || "No stone selected"}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#68736f]">
                    {selectedStone?.materialLabel || "Choose a JW Stone catalog reference"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGalleryOpen(true)}
                  className="min-h-11 shrink-0 rounded-full bg-[#18312f] px-4 text-xs font-black text-white"
                  data-testid="steel-home-countertop-surface-open"
                >
                  Change stone
                </button>
              </div>

              {selectedStone && selectedImage ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-[7rem_1fr] sm:items-start">
                  <img
                    src={buildStoneDesignerImageHref(selectedStone.id, design.textureImageIndex)}
                    alt={`${selectedStone.publicLabel} selected inventory reference`}
                    className="aspect-[4/3] w-28 rounded-xl object-contain bg-[#e2ddd4]"
                    data-testid="steel-home-countertop-selected-surface-image"
                  />
                  <div className="rounded-xl border border-[#a94f2e]/18 bg-[#fff6f1] p-3">
                    <p className="text-xs font-black text-[#713d2b]">
                      {projection.allowed ? "Projection-ready stone-only crop" : "Reference photo only"}
                    </p>
                    <p className="mt-1 text-[0.7rem] leading-5 text-[#7d665b]">{projection.reason}</p>
                    <p className="mt-1 text-[0.7rem] leading-5 text-[#7d665b]">
                      This does not confirm stock, hold status, price, fabrication, or reservation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f4f0e8] p-3 text-xs text-[#68736f]">
                  <ImageOff className="h-5 w-5" aria-hidden="true" />
                  Select a catalog photo. The measured plan still works without one.
                </div>
              )}

              {selectedStone?.images.length ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {selectedStone.images.map((imageHref, index) => (
                    <button
                      key={buildStoneDesignerPhotoKey(imageHref) || index}
                      type="button"
                      aria-pressed={design.textureImageIndex === index}
                      onClick={() =>
                        update({
                          textureImageIndex: index,
                          texturePhotoKey: buildStoneDesignerPhotoKey(imageHref) || "",
                        })
                      }
                      className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                        design.textureImageIndex === index
                          ? "border-[#a94f2e]"
                          : "border-transparent"
                      }`}
                      data-testid={`steel-home-countertop-texture-image-${index}`}
                    >
                      <img
                        src={buildStoneDesignerImageHref(selectedStone.id, index)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <fieldset className="mt-4">
                <legend className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#68736f]">
                  Planned vein direction
                </legend>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {COUNTERTOP_VEIN_ROTATION_OPTIONS.map((rotation) => (
                    <button
                      key={rotation}
                      type="button"
                      aria-pressed={design.veinRotation === rotation}
                      onClick={() => update({ veinRotation: rotation })}
                      className={`min-h-10 rounded-lg border text-xs font-black ${
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
            </section>

            <section className="rounded-2xl border border-[#18312f]/12 bg-white p-4">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
                1 · Layout and measurements
              </p>
              <p className="mt-2 text-xs leading-5 text-[#68736f]">
                Enter the finished countertop runs. Changing these values resets the measurement review.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                  onChange={(layout) => updateGeometry({ layout })}
                  testId="steel-home-countertop-layout"
                />
                <ProjectNumberField
                  label="Main run"
                  value={design.wallAIn}
                  min={24}
                  max={360}
                  suffix="in"
                  onChange={(wallAIn) => updateGeometry({ wallAIn })}
                  testId="steel-home-countertop-run-a"
                />
                <ProjectNumberField
                  label="Finished depth"
                  value={design.wallDepthIn}
                  min={12}
                  max={72}
                  step={0.5}
                  suffix="in"
                  onChange={(wallDepthIn) => updateGeometry({ wallDepthIn })}
                  testId="steel-home-countertop-wall-depth"
                />
                {design.layout !== "straight" ? (
                  <ProjectNumberField
                    label="Left return"
                    value={design.wallBIn}
                    min={24}
                    max={360}
                    suffix="in"
                    onChange={(wallBIn) => updateGeometry({ wallBIn })}
                    testId="steel-home-countertop-run-b"
                  />
                ) : null}
                {design.layout === "u-shape" ? (
                  <ProjectNumberField
                    label="Right return"
                    value={design.wallCIn}
                    min={24}
                    max={360}
                    suffix="in"
                    onChange={(wallCIn) => updateGeometry({ wallCIn })}
                    testId="steel-home-countertop-run-c"
                  />
                ) : null}
              </div>
              <div className="mt-4">
                <ProjectToggle
                  checked={design.island}
                  onChange={(island) => updateGeometry({ island })}
                  label="Include an island"
                  description="No island is added by default."
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
                    onChange={(islandLengthIn) => updateGeometry({ islandLengthIn })}
                    testId="steel-home-countertop-island-length"
                  />
                  <ProjectNumberField
                    label="Island width"
                    value={design.islandWidthIn}
                    min={20}
                    max={72}
                    suffix="in"
                    onChange={(islandWidthIn) => updateGeometry({ islandWidthIn })}
                    testId="steel-home-countertop-island-width"
                  />
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-[#a94f2e]/25 bg-[#fff0e8] p-3">
                <ProjectToggle
                  checked={design.measurementsReviewed}
                  onChange={(measurementsReviewed) => update({ measurementsReviewed })}
                  label="I entered or reviewed the surface measurements"
                  description="This unlocks the measured plan and fabricator handoff."
                  testId="steel-home-countertop-measurements-reviewed"
                />
              </div>
            </section>

            <details className="group rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black [&::-webkit-details-marker]:hidden">
                2 · Edge, backsplash, and seams
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
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
                  description="Final seam placement requires slab layout and fabricator review."
                  testId="steel-home-countertop-seams"
                />
              </div>
            </details>

            <details
              open={openings.length > 0}
              className="group rounded-2xl border border-[#18312f]/12 bg-white"
              data-testid="steel-home-countertop-cutouts"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-sm font-black">3 · Openings and coordination points</p>
                  <p className="mt-1 text-xs leading-5 text-[#68736f]">
                    Nothing is added by default. Openings support the independent fabricator handoff and do not price the stone.
                  </p>
                </div>
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="space-y-4 border-t border-[#18312f]/10 p-4">
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
                      if (sink !== "None") setSelectedOpeningId("sink");
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
                      if (cooktop !== "None") setSelectedOpeningId("cooktop");
                    }}
                    testId="steel-home-countertop-cooktop"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#68736f]">
                    {openings.length} added · {placementProblems.length} placement issues
                  </p>
                  <button
                    type="button"
                    onClick={addOtherOpening}
                    disabled={design.otherCutouts.length >= 6}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#18312f]/15 px-4 text-xs font-black disabled:opacity-40"
                    data-testid="steel-home-countertop-add-other-cutout"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add other opening
                  </button>
                </div>

                {openings.some((opening) => opening.templateStatus === "unresolved") ? (
                  <div className="rounded-xl border border-[#b26a34]/25 bg-[#fff8e8] p-3 text-[#74451f]">
                    <p className="text-xs font-black">
                      Template sizes unresolved · coordination points only
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      A coordination point can start a conversation. No cut-sized opening is shown until both manufacturer dimensions are entered.
                    </p>
                  </div>
                ) : null}

                {openings.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {openings.map((opening) => (
                      <button
                        key={opening.id}
                        type="button"
                        aria-pressed={selectedOpeningId === opening.id}
                        onClick={() => setSelectedOpeningId(opening.id)}
                        className={`min-h-14 rounded-xl border px-3 py-2 text-left ${
                          selectedOpeningId === opening.id
                            ? "border-[#a94f2e] bg-[#fff4ee]"
                            : "border-[#18312f]/10 bg-[#f8f5ef]"
                        }`}
                        data-testid={`steel-home-countertop-cutout-item-${opening.id}`}
                        data-representation={opening.representation}
                      >
                        <span className="block text-xs font-black">{opening.label}</span>
                        <span className="mt-1 block text-[0.68rem] text-[#68736f]">
                          {opening.run && opening.positionIn !== null
                            ? `${getCountertopCutoutRunLabel(opening.run)} · ${opening.positionIn}" from start`
                            : "Needs a location"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-[#f4f0e8] p-3 text-xs leading-5 text-[#68736f]">
                    No openings added.
                  </p>
                )}

                {selectedOpening ? (
                  <OpeningEditor
                    design={design}
                    item={selectedOpening}
                    otherCutout={selectedOtherCutout}
                    onChange={(values) => changeOpening(selectedOpening.id, values)}
                    onOtherChange={(values) =>
                      update({
                        otherCutouts: design.otherCutouts.map((cutout) =>
                          cutout.id === selectedOpening.id ? { ...cutout, ...values } : cutout
                        ),
                      })
                    }
                    onTemplateChange={(values) => {
                      if (selectedOpening.id === "sink") {
                        update({
                          ...(values.widthIn !== undefined
                            ? { sinkTemplateWidthIn: values.widthIn }
                            : {}),
                          ...(values.depthIn !== undefined
                            ? { sinkTemplateDepthIn: values.depthIn }
                            : {}),
                        });
                      } else if (selectedOpening.id === "cooktop") {
                        update({
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

                {placementProblems.length ? (
                  <div
                    className="rounded-xl border border-[#a1392e]/25 bg-[#fff0ea] p-3 text-[#7f2b24]"
                    role="status"
                    data-testid="steel-home-countertop-cutout-validation"
                  >
                    <p className="flex items-center gap-2 text-xs font-black">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Resolve before fabricator handoff
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                      {placementProblems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>

            <details className="group rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black [&::-webkit-details-marker]:hidden">
                4 · Optional 3D scene measurements
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-[#18312f]/10 p-4">
                <p className="text-xs leading-5 text-[#68736f]">
                  Blank stays unresolved. The 3D preview does not invent room walls, top height, thickness, or island position.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <OptionalMeasurementField
                    label="Room inside width"
                    value={design.roomWidthIn}
                    min={24}
                    max={1200}
                    onChange={(roomWidthIn) => update({ roomWidthIn })}
                    testId="steel-home-countertop-room-width"
                  />
                  <OptionalMeasurementField
                    label="Room inside depth"
                    value={design.roomDepthIn}
                    min={24}
                    max={1200}
                    onChange={(roomDepthIn) => update({ roomDepthIn })}
                    testId="steel-home-countertop-room-depth"
                  />
                  <OptionalMeasurementField
                    label="Room wall height"
                    value={design.roomWallHeightIn}
                    min={48}
                    max={240}
                    onChange={(roomWallHeightIn) => update({ roomWallHeightIn })}
                    testId="steel-home-countertop-room-wall-height"
                  />
                  <OptionalMeasurementField
                    label="Finished top height"
                    value={design.finishedTopHeightIn}
                    min={12}
                    max={72}
                    onChange={(finishedTopHeightIn) => update({ finishedTopHeightIn })}
                    testId="steel-home-countertop-finished-top-height"
                  />
                  <OptionalMeasurementField
                    label="Finished top thickness"
                    value={design.topThicknessIn}
                    min={0.25}
                    max={6}
                    onChange={(topThicknessIn) => update({ topThicknessIn })}
                    testId="steel-home-countertop-top-thickness"
                  />
                  {design.island ? (
                    <>
                      <OptionalMeasurementField
                        label="Island left edge from main-run left"
                        value={design.islandLeftOffsetIn}
                        min={-600}
                        max={1200}
                        onChange={(islandLeftOffsetIn) => update({ islandLeftOffsetIn })}
                        testId="steel-home-countertop-island-left-offset"
                      />
                      <OptionalMeasurementField
                        label="Island back edge from main wall"
                        value={design.islandBackOffsetIn}
                        min={-120}
                        max={1200}
                        onChange={(islandBackOffsetIn) => update({ islandBackOffsetIn })}
                        testId="steel-home-countertop-island-back-offset"
                      />
                    </>
                  ) : null}
                </div>
                {diagnostics.filter((item) => item.scope === "scene").length ? (
                  <ul className="mt-4 list-disc space-y-1 rounded-xl bg-[#fff0ea] p-4 pl-8 text-xs leading-5 text-[#7f2b24]">
                    {diagnostics
                      .filter((item) => item.scope === "scene")
                      .map((diagnostic) => (
                        <li key={diagnostic.id}>{diagnostic.label}</li>
                      ))}
                  </ul>
                ) : null}
              </div>
            </details>

            <label className="block space-y-2 text-sm font-bold">
              <span>Fabricator notes (optional)</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Overhangs, seams, waterfall direction, or special coordination notes"
                className={PROJECT_TEXTAREA_CLASS}
                data-testid="steel-home-countertop-notes"
              />
              <span className="block text-xs font-normal leading-5 text-[#68736f]">
                Stone ordering and fabrication remain separate. A qualified fabricator must field-verify every measurement and template before cutting.
              </span>
            </label>
          </div>

          <div className="sticky bottom-0 z-20 grid gap-3 border-t border-[#18312f]/12 bg-white px-4 py-3 shadow-[0_-12px_35px_rgba(24,49,47,.09)] sm:grid-cols-2 sm:px-6">
            <div>
              <button
                type="button"
                onClick={() => request("stone")}
                disabled={!stoneReadiness.ready}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#a94f2e] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8aaa2]"
                data-testid="steel-home-countertop-request-stone"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Request this stone
              </button>
              {!stoneReadiness.ready ? (
                <p className="mt-1 text-[0.68rem] font-bold text-[#8f3329]">
                  {stoneReadiness.problems.join(" ")}
                </p>
              ) : null}
            </div>
            <div>
              <button
                type="button"
                onClick={() => request("fabricator")}
                disabled={!fabricatorReadiness.ready}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#18312f]/20 bg-white px-5 text-sm font-black text-[#18312f] disabled:cursor-not-allowed disabled:bg-[#ecebe6] disabled:text-[#7d8581]"
                data-testid="steel-home-countertop-find-fabricator"
              >
                <Hammer className="h-4 w-4" aria-hidden="true" /> Find a fabricator
              </button>
              {!fabricatorReadiness.ready ? (
                <p className="mt-1 text-[0.68rem] font-bold text-[#8f3329]">
                  {fabricatorReadiness.problems.join(" ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {galleryOpen ? (
        <SurfaceGallery
          selectedId={design.stoneId}
          onSelect={(stoneId) => {
            const stone = getCatalogItemById(stoneId);
            update({
              stoneId,
              textureImageIndex: 0,
              texturePhotoKey: buildStoneDesignerPhotoKey(stone?.images[0] || "") || "",
            });
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </section>
  );
}
