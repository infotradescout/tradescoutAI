/* eslint-disable no-restricted-syntax -- Live SVG fills must reflect selected finishes. */
import { useId } from "react";
import { AlertTriangle, ChevronDown, Send } from "lucide-react";
import {
  CABINET_DOOR_STYLE_OPTIONS,
  CABINET_FINISH_OPTIONS,
  CABINET_HARDWARE_OPTIONS,
  CABINET_LAYOUT_OPTIONS,
  CABINET_ROOM_OPTIONS,
  calculateCabinetPlanningEstimate,
  calculateCabinetPlannedWidth,
  formatPlanningRange,
  getCabinetPrimaryWallFit,
  type SteelHomeCabinetDesign,
} from "./projectModel";
import PlanningEstimateCard from "./PlanningEstimateCard";
import {
  PROJECT_TEXTAREA_CLASS,
  ProjectColorField,
  ProjectNumberField,
  ProjectSelect,
  ProjectTextSelect,
  ProjectToggle,
} from "./ProjectToolControls";

type Props = {
  design: SteelHomeCabinetDesign;
  onChange: (design: SteelHomeCabinetDesign) => void;
  onRequest: () => void;
};

type CabinetModule = {
  key: string;
  label: string;
  width: number;
  kind: "cabinet" | "tall" | "appliance" | "sink";
};

function buildCabinetModules(design: SteelHomeCabinetDesign): CabinetModule[] {
  const modules: CabinetModule[] = [
    { key: "fridge", label: "Fridge", width: design.refrigeratorWidthIn, kind: "appliance" },
  ];
  for (let index = 0; index < design.pantryCount; index += 1) {
    modules.push({ key: `pantry-${index}`, label: "Pantry", width: 24, kind: "tall" });
  }
  for (let index = 0; index < design.drawerBaseCount; index += 1) {
    modules.push({ key: `drawers-${index}`, label: "Drawers", width: 24, kind: "cabinet" });
  }
  modules.push(
    { key: "sink", label: "Sink", width: design.sinkBaseWidthIn, kind: "sink" },
    { key: "dishwasher", label: "DW", width: 24, kind: "appliance" },
    { key: "range", label: "Range", width: design.rangeWidthIn, kind: "appliance" }
  );
  return modules;
}

function hardwareColor(hardware: string): string {
  return (
    {
      "Matte black": "#222524",
      "Brushed brass": "#b08d43",
      "Brushed nickel": "#a9aaa5",
      "Polished chrome": "#dce1e3",
      "No preference": "#6b716e",
    }[hardware] || "#222524"
  );
}

function DoorFace({
  x,
  y,
  width,
  height,
  style,
  pull,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  style: string;
  pull: string;
}) {
  return (
    <g>
      {style !== "Slab" ? (
        <rect
          x={x + 5}
          y={y + 5}
          width={Math.max(4, width - 10)}
          height={Math.max(4, height - 10)}
          rx={style === "Raised panel" ? 5 : 1}
          fill={style === "Glass accent" ? "rgba(120,164,168,.5)" : "none"}
          stroke="rgba(24,49,47,.45)"
          strokeWidth={style === "Raised panel" ? 3 : 2}
        />
      ) : null}
      <line
        x1={x + width - Math.min(12, width * 0.2)}
        x2={x + width - Math.min(12, width * 0.2)}
        y1={y + height * 0.42}
        y2={y + height * 0.58}
        stroke={pull}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

function CabinetPreview({ design }: { design: SteelHomeCabinetDesign }) {
  const gradientId = `cabinet-wall-${useId().replace(/:/g, "")}`;
  const modules = buildCabinetModules(design);
  const plannedWidth = calculateCabinetPlannedWidth(design);
  const visualWidth = Math.max(plannedWidth, design.primaryWallIn);
  const scale = 560 / visualWidth;
  const finish = CABINET_FINISH_OPTIONS.find((item) => item.value === design.finish);
  const layout =
    CABINET_LAYOUT_OPTIONS.find((item) => item.value === design.layout)?.label || design.layout;
  const returnExtent = Math.min(
    68,
    Math.max(24, (design.returnWallIn / Math.max(36, design.primaryWallIn)) * 52)
  );
  const layoutPath = {
    "one-wall": "M624 48 H718",
    "l-shape": `M624 35 H710 V${35 + returnExtent}`,
    "u-shape": `M624 ${35 + returnExtent} V35 H710 V${35 + returnExtent}`,
    galley: `M624 42 H710 M624 ${42 + returnExtent * 0.58} H710`,
  }[design.layout];
  const cabinetColor = finish?.hex || "#b58d62";
  const pullColor = hardwareColor(design.hardware);
  const baseY = 342;
  const baseHeight = 94;
  const ceilingY = 92 + (144 - design.ceilingHeightIn) * 1.02;
  const upperBottom = baseY - 64;
  const upperTop = Math.max(ceilingY + 15, upperBottom - design.upperHeightIn * 3);
  const visibleUpperHeight = Math.max(25, upperBottom - upperTop);
  const tallTop = ceilingY + 15;
  const islandWidth = Math.min(310, Math.max(118, design.islandLengthIn * 1.7));
  const islandHeight = Math.min(58, Math.max(34, design.islandWidthIn * 0.75));
  const islandX = (760 - islandWidth) / 2;
  let cursor = 96;

  return (
    <svg
      viewBox="0 0 760 500"
      role="img"
      aria-label={`${design.room} cabinets with ${design.doorStyle} doors, ${finish?.label || "selected"} finish, and ${design.hardware} hardware`}
      className="h-full min-h-[22rem] w-full"
      data-testid="steel-home-cabinet-preview"
      data-room={design.room}
      data-layout={design.layout}
      data-door-style={design.doorStyle}
      data-finish={design.finish}
      data-hardware={design.hardware}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0ebe2" />
          <stop offset="1" stopColor="#d9d0c2" />
        </linearGradient>
        <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="9" stdDeviation="8" floodOpacity="0.18" />
        </filter>
      </defs>
      <rect width="760" height="500" fill={`url(#${gradientId})`} />
      <path d="M0 432H760V500H0Z" fill="#b9a58b" />
      <line x1="0" x2="760" y1="432" y2="432" stroke="#6e604f" strokeWidth="4" />
      <line
        x1="76"
        x2="684"
        y1={ceilingY}
        y2={ceilingY}
        stroke="#988f83"
        strokeWidth="2"
        strokeDasharray="8 8"
        data-testid="steel-home-cabinet-ceiling-preview"
      />

      <g fill="#18312f" fontFamily="system-ui, sans-serif">
        <text x="30" y="38" fontSize="13" fontWeight="800" letterSpacing="1.5">
          {design.room.toUpperCase()} · {layout.toUpperCase()}
        </text>
        <text x="30" y="67" fontSize="19" fontWeight="800">
          {design.doorStyle} · {finish?.label || "Selected finish"} · {design.hardware}
        </text>
        <path
          d={layoutPath}
          fill="none"
          stroke="#a94f2e"
          strokeWidth="7"
          strokeLinecap="round"
          data-testid="steel-home-cabinet-layout-preview"
        />
      </g>

      <g filter={`url(#${gradientId}-shadow)`}>
        {modules.map((module) => {
          const x = cursor;
          const width = Math.max(24, module.width * scale);
          cursor += width;
          const tall = module.kind === "tall" || module.key === "fridge";
          const y = tall ? tallTop : baseY;
          const height = tall ? baseY + baseHeight - y : baseHeight;
          const appliance = module.kind === "appliance";
          return (
            <g key={module.key} data-module={module.key} data-width={module.width}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={appliance ? "#565c5b" : cabinetColor}
                stroke="#18312f"
                strokeWidth="3"
              />
              {!appliance ? (
                <DoorFace
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  style={design.doorStyle}
                  pull={pullColor}
                />
              ) : null}
              {module.kind === "sink" ? (
                <rect
                  x={x + width * 0.16}
                  y={baseY - 9}
                  width={width * 0.68}
                  height="18"
                  rx="7"
                  fill="#8fa7a6"
                  stroke="#18312f"
                  strokeWidth="3"
                />
              ) : null}
              <text
                x={x + width / 2}
                y={y + height / 2 + 4}
                textAnchor="middle"
                fill={appliance ? "white" : "#18312f"}
                fontFamily="system-ui, sans-serif"
                fontSize={Math.min(11, Math.max(8, width / 5))}
                fontWeight="800"
              >
                {module.label}
              </text>
            </g>
          );
        })}

        {modules
          .filter((module) => module.kind === "cabinet" || module.kind === "sink")
          .map((module, index) => {
            const precedingWidth = modules
              .slice(0, modules.indexOf(module))
              .reduce((sum, item) => sum + item.width, 0);
            const x = 96 + precedingWidth * scale;
            const width = Math.max(24, module.width * scale);
            return (
              <g key={`upper-${module.key}-${index}`}>
                <rect
                  x={x}
                  y={upperTop}
                  width={width}
                  height={visibleUpperHeight}
                  fill={cabinetColor}
                  stroke="#18312f"
                  strokeWidth="3"
                />
                <DoorFace
                  x={x}
                  y={upperTop}
                  width={width}
                  height={visibleUpperHeight}
                  style={design.doorStyle}
                  pull={pullColor}
                />
              </g>
            );
          })}

        {design.island ? (
          <g data-testid="steel-home-cabinet-island-preview">
            <rect
              x={islandX - 10}
              y="400"
              width={islandWidth + 20}
              height="16"
              rx="4"
              fill="#ded7cc"
              stroke="#18312f"
              strokeWidth="3"
            />
            <rect
              x={islandX}
              y="416"
              width={islandWidth}
              height={islandHeight}
              fill={cabinetColor}
              stroke="#18312f"
              strokeWidth="3"
            />
            {Array.from({ length: 3 }).map((_, index) => (
              <DoorFace
                key={index}
                x={islandX + index * (islandWidth / 3)}
                y={416}
                width={islandWidth / 3}
                height={islandHeight}
                style={design.doorStyle}
                pull={pullColor}
              />
            ))}
          </g>
        ) : null}
      </g>

      <g fill="#596965" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700">
        <text x="30" y="486">
          Wall used: {plannedWidth}&quot; of {design.primaryWallIn}&quot;
        </text>
        <text x="730" y="486" textAnchor="end">
          {design.ceilingHeightIn}&quot; ceiling · {design.upperHeightIn}&quot; uppers
        </text>
      </g>
    </svg>
  );
}

export default function CabinetDesigner({ design, onChange, onRequest }: Props) {
  const update = (values: Partial<SteelHomeCabinetDesign>) => onChange({ ...design, ...values });
  const cabinetFit = getCabinetPrimaryWallFit(design);
  const estimate = calculateCabinetPlanningEstimate(design);
  const finish = CABINET_FINISH_OPTIONS.find((item) => item.value === design.finish)?.label;
  const layout = CABINET_LAYOUT_OPTIONS.find((item) => item.value === design.layout)?.label;
  const startRequest = () => {
    if (!cabinetFit.fits) return;
    onChange({ ...design, included: true });
    onRequest();
  };

  return (
    <section
      id="cabinet-designer"
      className="h-full overflow-y-auto bg-[#e7dfd2] text-[#18312f] lg:overflow-hidden"
      data-testid="steel-home-cabinet-designer"
    >
      <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(25rem,.85fr)]">
        <div className="flex min-h-[34rem] flex-col gap-3 p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto lg:p-5">
          <div className="min-h-[22rem] flex-1 overflow-hidden rounded-[1.4rem] border border-[#18312f]/10 bg-[#eee8dd] shadow-[0_18px_55px_rgba(77,57,38,.12)]">
            <CabinetPreview design={design} />
          </div>

          <div
            className="grid gap-3 rounded-[1.25rem] border border-[#18312f]/10 bg-white/75 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            data-testid="steel-home-cabinet-live-summary"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#a94f2e]">
                {design.room} · {layout} · {design.doorStyle}
              </p>
              <p className="mt-1 text-sm text-[#68736f]">
                {finish} · {design.hardware} · {design.pantryCount} pantry ·{" "}
                {design.drawerBaseCount} drawer bases
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#a94f2e]">
                Early price estimate
              </p>
              <p className="text-xl font-black">{formatPlanningRange(estimate.range)}</p>
            </div>
          </div>

          <PlanningEstimateCard
            estimate={estimate}
            testId="steel-home-cabinet-planning-estimate"
            theme="light"
          />
        </div>

        <div className="flex min-h-0 flex-col border-t border-[#18312f]/10 bg-[#f7f2e9] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
                Room and fit
              </p>
              <p className="mt-2 text-sm leading-6 text-[#68736f]">
                Change a choice and watch the cabinet wall and estimate update.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProjectTextSelect
                label="Room"
                value={design.room}
                options={CABINET_ROOM_OPTIONS}
                onChange={(room) => update({ room })}
                testId="steel-home-cabinet-room"
              />
              <ProjectSelect
                label="Layout"
                value={design.layout}
                options={CABINET_LAYOUT_OPTIONS}
                onChange={(layoutValue) => update({ layout: layoutValue })}
                testId="steel-home-cabinet-layout"
              />
              <ProjectNumberField
                label="Primary wall"
                value={design.primaryWallIn}
                min={36}
                max={360}
                suffix="in"
                onChange={(primaryWallIn) => update({ primaryWallIn })}
                testId="steel-home-cabinet-primary-wall"
              />
              {design.layout !== "one-wall" ? (
                <ProjectNumberField
                  label={design.layout === "galley" ? "Opposite wall" : "Return wall"}
                  value={design.returnWallIn}
                  min={36}
                  max={360}
                  suffix="in"
                  onChange={(returnWallIn) => update({ returnWallIn })}
                  testId="steel-home-cabinet-return-wall"
                />
              ) : null}
              <ProjectNumberField
                label="Ceiling height"
                value={design.ceilingHeightIn}
                min={72}
                max={144}
                suffix="in"
                onChange={(ceilingHeightIn) => update({ ceilingHeightIn })}
                testId="steel-home-cabinet-ceiling-height"
              />
              <ProjectTextSelect
                label="Door style"
                value={design.doorStyle}
                options={CABINET_DOOR_STYLE_OPTIONS}
                onChange={(doorStyle) => update({ doorStyle })}
                testId="steel-home-cabinet-door-style"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-[1.05fr_.95fr]">
              <ProjectColorField
                label="Cabinet finish"
                value={design.finish}
                options={CABINET_FINISH_OPTIONS}
                onChange={(finishValue) => update({ finish: finishValue })}
                testIdPrefix="steel-home-cabinet-finish"
              />
              <ProjectTextSelect
                label="Hardware"
                value={design.hardware}
                options={CABINET_HARDWARE_OPTIONS}
                onChange={(hardware) => update({ hardware })}
                testId="steel-home-cabinet-hardware"
              />
            </div>

            {!cabinetFit.fits ? (
              <div
                className="mt-5 flex gap-3 rounded-2xl border border-[#a1392e]/25 bg-[#f8e5df] p-4 text-[#7f2b24]"
                role="status"
                id="steel-home-cabinet-fit-warning"
                data-testid="steel-home-cabinet-fit-warning"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="text-sm leading-6">
                  <p className="font-black">Fix the primary-wall fit before starting.</p>
                  <p>
                    Increase Primary wall to at least {cabinetFit.plannedWidthIn} inches, or remove
                    at least {cabinetFit.overageIn} inches of appliance or storage modules under
                    Appliances and storage.
                  </p>
                </div>
              </div>
            ) : null}

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                Appliances and storage
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-4 border-t border-[#18312f]/10 p-4 sm:grid-cols-2">
                <ProjectTextSelect
                  label="Refrigerator width"
                  value={String(design.refrigeratorWidthIn) as "30" | "36" | "42" | "48"}
                  options={["30", "36", "42", "48"] as const}
                  onChange={(value) =>
                    update({ refrigeratorWidthIn: Number(value) as 30 | 36 | 42 | 48 })
                  }
                  testId="steel-home-cabinet-refrigerator"
                />
                <ProjectTextSelect
                  label="Range width"
                  value={String(design.rangeWidthIn) as "30" | "36" | "48"}
                  options={["30", "36", "48"] as const}
                  onChange={(value) => update({ rangeWidthIn: Number(value) as 30 | 36 | 48 })}
                  testId="steel-home-cabinet-range"
                />
                <ProjectTextSelect
                  label="Sink base width"
                  value={String(design.sinkBaseWidthIn) as "30" | "33" | "36"}
                  options={["30", "33", "36"] as const}
                  onChange={(value) => update({ sinkBaseWidthIn: Number(value) as 30 | 33 | 36 })}
                  testId="steel-home-cabinet-sink-base"
                />
                <ProjectTextSelect
                  label="Upper cabinet height"
                  value={String(design.upperHeightIn) as "30" | "36" | "42"}
                  options={["30", "36", "42"] as const}
                  onChange={(value) => update({ upperHeightIn: Number(value) as 30 | 36 | 42 })}
                  testId="steel-home-cabinet-upper-height"
                />
                <ProjectNumberField
                  label="Pantry cabinets"
                  value={design.pantryCount}
                  min={0}
                  max={4}
                  suffix="units"
                  onChange={(pantryCount) => update({ pantryCount })}
                  testId="steel-home-cabinet-pantry-count"
                />
                <ProjectNumberField
                  label="Drawer bases"
                  value={design.drawerBaseCount}
                  min={0}
                  max={6}
                  suffix="units"
                  onChange={(drawerBaseCount) => update({ drawerBaseCount })}
                  testId="steel-home-cabinet-drawer-count"
                />
              </div>
            </details>

            <div className="mt-5">
              <ProjectToggle
                checked={design.island}
                onChange={(island) => update({ island })}
                label="Include an island"
                description="Adds a separate cabinet run to the drawing and estimate."
                testId="steel-home-cabinet-island"
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
                  onChange={(islandLengthIn) => update({ islandLengthIn })}
                  testId="steel-home-cabinet-island-length"
                />
                <ProjectNumberField
                  label="Island width"
                  value={design.islandWidthIn}
                  min={20}
                  max={72}
                  suffix="in"
                  onChange={(islandWidthIn) => update({ islandWidthIn })}
                  testId="steel-home-cabinet-island-width"
                />
              </div>
            ) : null}

            <label className="mt-5 block space-y-2 text-sm font-bold">
              <span>Notes</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Corner storage, seating, appliance panels, or open shelves"
                className={PROJECT_TEXTAREA_CLASS}
                data-testid="steel-home-cabinet-notes"
              />
            </label>
          </div>

          <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 border-t border-[#18312f]/12 bg-white px-4 py-3 shadow-[0_-12px_35px_rgba(77,57,38,.1)] sm:px-6">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#a94f2e]">
                Early price estimate
              </p>
              <p className="truncate text-lg font-black">{formatPlanningRange(estimate.range)}</p>
            </div>
            <button
              type="button"
              onClick={startRequest}
              disabled={!cabinetFit.fits}
              aria-disabled={!cabinetFit.fits}
              aria-describedby={!cabinetFit.fits ? "steel-home-cabinet-fit-warning" : undefined}
              className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                cabinetFit.fits
                  ? "bg-[#a94f2e] text-white hover:bg-[#8f3f25] focus-visible:ring-[#a94f2e]"
                  : "cursor-not-allowed bg-[#d9ddd5] text-[#596762] focus-visible:ring-[#596762]"
              }`}
              data-testid="steel-home-cabinet-include"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Start a Request
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
