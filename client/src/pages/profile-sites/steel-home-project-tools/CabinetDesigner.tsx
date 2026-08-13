/* eslint-disable no-restricted-syntax -- Live SVG fills must reflect the selected cabinet finish. */
import { AlertTriangle, Boxes, ChefHat, Ruler } from "lucide-react";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import {
  CABINET_DOOR_STYLE_OPTIONS,
  CABINET_FINISH_OPTIONS,
  CABINET_HARDWARE_OPTIONS,
  CABINET_LAYOUT_OPTIONS,
  CABINET_ROOM_OPTIONS,
  calculateCabinetPlanningEstimate,
  calculateCabinetPlannedWidth,
  type SteelHomeCabinetDesign,
} from "./projectModel";
import PlanningEstimateCard from "./PlanningEstimateCard";
import {
  IncludeDesignButton,
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
};

type CabinetModule = {
  key: string;
  label: string;
  width: number;
  kind: "cabinet" | "tall" | "appliance" | "sink";
};

function buildCabinetModules(design: SteelHomeCabinetDesign): CabinetModule[] {
  const modules: CabinetModule[] = [
    {
      key: "fridge",
      label: "Fridge",
      width: design.refrigeratorWidthIn,
      kind: "appliance",
    },
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

function CabinetDoorFace({
  x,
  y,
  width,
  height,
  style,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  style: string;
}) {
  if (style === "Slab") return null;
  const glass = style === "Glass accent";
  return (
    <rect
      x={x + 5}
      y={y + 5}
      width={Math.max(4, width - 10)}
      height={Math.max(4, height - 10)}
      rx={style === "Raised panel" ? 5 : 1}
      fill={glass ? "rgba(120,164,168,.5)" : "none"}
      stroke="rgba(24,49,47,.45)"
      strokeWidth={style === "Raised panel" ? 3 : 2}
    />
  );
}

function CabinetPreview({ design }: { design: SteelHomeCabinetDesign }) {
  const modules = buildCabinetModules(design);
  const plannedWidth = calculateCabinetPlannedWidth(design);
  const visualWidth = Math.max(plannedWidth, design.primaryWallIn);
  const scale = 570 / visualWidth;
  const finish = CABINET_FINISH_OPTIONS.find((item) => item.value === design.finish);
  const layoutLabel =
    CABINET_LAYOUT_OPTIONS.find((item) => item.value === design.layout)?.label || design.layout;
  const returnExtent = Math.min(
    54,
    Math.max(22, (design.returnWallIn / Math.max(36, design.primaryWallIn)) * 42)
  );
  const layoutPath = {
    "one-wall": "M625 42 H720",
    "l-shape": `M625 30 H710 V${30 + returnExtent}`,
    "u-shape": `M625 ${30 + returnExtent} V30 H710 V${30 + returnExtent}`,
    galley: `M625 34 H710 M625 ${34 + returnExtent * 0.58} H710`,
  }[design.layout];
  const cabinetColor = finish?.hex || "#b58d62";
  const baseY = 332;
  const baseHeight = 98;
  const upperBottom = baseY - 66;
  const upperHeight = Math.min(138, design.upperHeightIn * 3.1);
  const ceilingLineY = 88 + (144 - design.ceilingHeightIn) * 1.05;
  const tallTop = ceilingLineY + 14;
  const upperTop = Math.max(ceilingLineY + 14, upperBottom - upperHeight);
  const visibleUpperHeight = Math.max(24, upperBottom - upperTop);
  const islandWidth = Math.min(300, Math.max(120, design.islandLengthIn * 1.7));
  const islandHeight = Math.min(62, Math.max(36, design.islandWidthIn * 0.78));
  const islandX = (760 - islandWidth) / 2;
  let cursor = 95;

  return (
    <svg
      viewBox="0 0 760 500"
      role="img"
      aria-label={`${design.room} cabinet wall preview with ${design.doorStyle} doors and ${finish?.label || "selected"} finish`}
      className="h-auto w-full"
      data-testid="steel-home-cabinet-preview"
    >
      <defs>
        <linearGradient id="cabinet-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eee8dd" />
          <stop offset="1" stopColor="#d8d0c1" />
        </linearGradient>
        <linearGradient id="cabinet-floor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a78d70" />
          <stop offset="1" stopColor="#c2ad91" />
        </linearGradient>
        <filter id="cabinet-shadow" x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity="0.2" />
        </filter>
      </defs>
      <rect width="760" height="500" rx="30" fill="url(#cabinet-wall)" />
      <path d="M0 430H760V500H0Z" fill="url(#cabinet-floor)" />
      <line x1="0" x2="760" y1="430" y2="430" stroke="#6e604f" strokeWidth="4" />
      <line
        x1="78"
        x2="682"
        y1={ceilingLineY}
        y2={ceilingLineY}
        stroke="#9d9385"
        strokeWidth="2"
        strokeDasharray="8 8"
        data-testid="steel-home-cabinet-ceiling-preview"
      />

      <g fill="#18312f" fontFamily="system-ui, sans-serif">
        <text x="34" y="42" fontSize="13" fontWeight="800" letterSpacing="2">
          CABINET PREVIEW
        </text>
        <text x="34" y="70" fontSize="22" fontWeight="800">
          {design.primaryWallIn}\" wall • {design.ceilingHeightIn}\" ceiling
        </text>
        <text x="725" y="22" textAnchor="end" fontSize="10" fontWeight="800" letterSpacing="1.5">
          {layoutLabel.toUpperCase()}
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

      <g filter="url(#cabinet-shadow)">
        {modules.map((module) => {
          const x = cursor;
          const width = Math.max(24, module.width * scale);
          cursor += width;
          const isTall = module.kind === "tall" || module.key === "fridge";
          const y = isTall ? tallTop : baseY;
          const height = isTall ? baseY + baseHeight - y : baseHeight;
          const isAppliance = module.kind === "appliance";
          const fill = isAppliance ? "#555b5a" : cabinetColor;
          const textColor = isAppliance ? "#ffffff" : "#18312f";

          return (
            <g key={module.key}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fill}
                stroke="#18312f"
                strokeWidth="3"
              />
              {!isAppliance ? (
                <CabinetDoorFace
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  style={design.doorStyle}
                />
              ) : null}
              {module.kind === "sink" ? (
                <>
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
                  <path
                    d={`M${x + width * 0.5} ${baseY - 9} q0 -23 17 -23`}
                    fill="none"
                    stroke="#18312f"
                    strokeWidth="4"
                  />
                </>
              ) : null}
              <text
                x={x + width / 2}
                y={y + height / 2 + 4}
                textAnchor="middle"
                fill={textColor}
                fontFamily="system-ui, sans-serif"
                fontSize={Math.min(12, Math.max(8, width / 5))}
                fontWeight="800"
              >
                {module.label}
              </text>
            </g>
          );
        })}

        <rect
          x="90"
          y={baseY - 8}
          width={Math.min(580, plannedWidth * scale + 10)}
          height="12"
          rx="3"
          fill="#ded7cc"
          stroke="#18312f"
          strokeWidth="3"
        />

        {modules
          .filter((module) => module.kind === "cabinet" || module.kind === "sink")
          .map((module, index) => {
            const precedingWidth = modules
              .slice(0, modules.indexOf(module))
              .reduce((sum, item) => sum + item.width, 0);
            const x = 95 + precedingWidth * scale;
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
                <CabinetDoorFace
                  x={x}
                  y={upperTop}
                  width={width}
                  height={visibleUpperHeight}
                  style={design.doorStyle}
                />
              </g>
            );
          })}

        {design.island ? (
          <g>
            <rect
              x={islandX - 10}
              y="397"
              width={islandWidth + 20}
              height="18"
              rx="4"
              fill="#ded7cc"
              stroke="#18312f"
              strokeWidth="3"
            />
            <rect
              x={islandX}
              y="415"
              width={islandWidth}
              height={islandHeight}
              fill={cabinetColor}
              stroke="#18312f"
              strokeWidth="3"
            />
            {Array.from({ length: 3 }).map((_, index) => (
              <CabinetDoorFace
                key={index}
                x={islandX + index * (islandWidth / 3)}
                y={415}
                width={islandWidth / 3}
                height={islandHeight}
                style={design.doorStyle}
              />
            ))}
          </g>
        ) : null}
      </g>

      <g fontFamily="system-ui, sans-serif" fontWeight="700">
        <text x="34" y="478" fill="#18312f" fontSize="13">
          Primary wall used: {plannedWidth}\" of {design.primaryWallIn}\"
        </text>
        <text x="725" y="478" textAnchor="end" fill="#63706c" fontSize="12">
          Final measurements required
        </text>
      </g>
    </svg>
  );
}

export default function CabinetDesigner({ design, onChange }: Props) {
  const update = (values: Partial<SteelHomeCabinetDesign>) => onChange({ ...design, ...values });
  const plannedWidth = calculateCabinetPlannedWidth(design);
  const remainingWidth = design.primaryWallIn - plannedWidth;
  const planningEstimate = calculateCabinetPlanningEstimate(design);

  return (
    <section
      id="cabinet-designer"
      className="bg-[#e8dfd1]"
      data-testid="steel-home-cabinet-designer"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(480px,1.1fr)] lg:items-start">
          <div className="lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.tools.cabinets.eyebrow}
            </p>
            <h2 className="mt-3 max-w-3xl font-editorial text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-[#18312f] sm:text-5xl">
              {content.tools.cabinets.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5e6965] sm:text-base">
              {content.tools.cabinets.body}
            </p>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#18312f]/10 bg-[#eee8dd] shadow-[0_18px_55px_rgba(77,57,38,0.14)]">
              <CabinetPreview design={design} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#18312f]/10 bg-white/[0.65] p-4">
                <Ruler className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Wall fit</p>
                <p
                  className={`mt-1 text-sm ${remainingWidth < 0 ? "font-bold text-[#a1392e]" : "text-[#68736f]"}`}
                >
                  {remainingWidth >= 0
                    ? `${remainingWidth}\" remaining`
                    : `${Math.abs(remainingWidth)}\" too wide`}
                </p>
              </div>
              <div className="rounded-2xl border border-[#18312f]/10 bg-white/[0.65] p-4">
                <Boxes className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Storage</p>
                <p className="mt-1 text-sm text-[#68736f]">
                  {design.pantryCount} pantry • {design.drawerBaseCount} drawer
                </p>
              </div>
              <div className="rounded-2xl border border-[#18312f]/10 bg-white/[0.65] p-4">
                <ChefHat className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Island</p>
                <p className="mt-1 text-sm text-[#68736f]">
                  {design.island
                    ? `${design.islandLengthIn}\" × ${design.islandWidthIn}\"`
                    : "None"}
                </p>
              </div>
            </div>

            <PlanningEstimateCard
              estimate={planningEstimate}
              testId="steel-home-cabinet-planning-estimate"
              theme="light"
            />
          </div>

          <div className="rounded-[2rem] border border-[#18312f]/10 bg-[#f7f2e9] p-5 shadow-[0_24px_80px_rgba(77,57,38,0.1)] sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
                Room measurements
              </p>
              <h3 className="mt-3 font-editorial text-4xl font-semibold tracking-[-0.035em] text-[#18312f]">
                Enter the room measurements and cabinet sizes.
              </h3>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <ProjectTextSelect
                label="Room"
                value={design.room}
                options={CABINET_ROOM_OPTIONS}
                onChange={(room) => update({ room })}
              />
              <ProjectSelect
                label="Room layout"
                value={design.layout}
                options={CABINET_LAYOUT_OPTIONS}
                onChange={(layout) => update({ layout })}
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
              <ProjectNumberField
                label="Return wall"
                value={design.returnWallIn}
                min={36}
                max={360}
                suffix="in"
                onChange={(returnWallIn) => update({ returnWallIn })}
                testId="steel-home-cabinet-return-wall"
              />
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

            <div className="mt-8 grid gap-6 sm:grid-cols-[1.1fr_.9fr]">
              <ProjectColorField
                label="Cabinet finish"
                value={design.finish}
                options={CABINET_FINISH_OPTIONS}
                onChange={(finish) => update({ finish })}
                testIdPrefix="steel-home-cabinet-finish"
              />
              <ProjectTextSelect
                label="Hardware finish"
                value={design.hardware}
                options={CABINET_HARDWARE_OPTIONS}
                onChange={(hardware) => update({ hardware })}
              />
            </div>

            <div className="mt-8 border-t border-[#18312f]/10 pt-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
                Appliances and storage
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <ProjectTextSelect
                  label="Refrigerator width"
                  value={String(design.refrigeratorWidthIn) as "30" | "36" | "42" | "48"}
                  options={["30", "36", "42", "48"] as const}
                  onChange={(value) =>
                    update({ refrigeratorWidthIn: Number(value) as 30 | 36 | 42 | 48 })
                  }
                />
                <ProjectTextSelect
                  label="Range width"
                  value={String(design.rangeWidthIn) as "30" | "36" | "48"}
                  options={["30", "36", "48"] as const}
                  onChange={(value) => update({ rangeWidthIn: Number(value) as 30 | 36 | 48 })}
                />
                <ProjectTextSelect
                  label="Sink base width"
                  value={String(design.sinkBaseWidthIn) as "30" | "33" | "36"}
                  options={["30", "33", "36"] as const}
                  onChange={(value) => update({ sinkBaseWidthIn: Number(value) as 30 | 33 | 36 })}
                />
                <ProjectTextSelect
                  label="Upper cabinet height"
                  value={String(design.upperHeightIn) as "30" | "36" | "42"}
                  options={["30", "36", "42"] as const}
                  onChange={(value) => update({ upperHeightIn: Number(value) as 30 | 36 | 42 })}
                />
                <ProjectNumberField
                  label="Pantry cabinets"
                  value={design.pantryCount}
                  min={0}
                  max={4}
                  suffix="units"
                  onChange={(pantryCount) => update({ pantryCount })}
                />
                <ProjectNumberField
                  label="Drawer bases"
                  value={design.drawerBaseCount}
                  min={0}
                  max={6}
                  suffix="units"
                  onChange={(drawerBaseCount) => update({ drawerBaseCount })}
                />
              </div>
            </div>

            {remainingWidth < 0 ? (
              <div
                className="mt-6 flex gap-3 rounded-2xl border border-[#a1392e]/25 bg-[#f8e5df] p-4 text-[#7f2b24]"
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="text-sm leading-6">
                  The selected cabinets and appliance spaces are {Math.abs(remainingWidth)} inches
                  wider than the primary wall. Reduce a cabinet, move items to the return wall, or
                  correct the wall measurement.
                </p>
              </div>
            ) : null}

            <div className="mt-7">
              <ProjectToggle
                checked={design.island}
                onChange={(island) => update({ island })}
                label="Include an island"
                description="Add a separate cabinet run and work surface."
                testId="steel-home-cabinet-island"
              />
            </div>
            {design.island ? (
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <ProjectNumberField
                  label="Island length"
                  value={design.islandLengthIn}
                  min={24}
                  max={180}
                  suffix="in"
                  onChange={(islandLengthIn) => update({ islandLengthIn })}
                />
                <ProjectNumberField
                  label="Island width"
                  value={design.islandWidthIn}
                  min={20}
                  max={72}
                  suffix="in"
                  onChange={(islandWidthIn) => update({ islandWidthIn })}
                />
              </div>
            ) : null}

            <label className="mt-7 block space-y-2 text-sm font-bold text-[#18312f]">
              <span>Cabinet notes</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Corner storage, seating, appliance panels, open shelves, special heights, or other priorities."
                className={PROJECT_TEXTAREA_CLASS}
              />
            </label>

            <div className="mt-8 flex flex-col items-start gap-3 border-t border-[#18312f]/10 pt-7">
              <IncludeDesignButton
                included={design.included}
                onClick={() => update({ included: !design.included })}
                label="Include cabinets"
                testId="steel-home-cabinet-include"
              />
              <p className="text-xs leading-5 text-[#68736f]">
                This is an early cabinet estimate. Final price requires exact measurements, cabinet
                specifications, fillers, panels, clearances, delivery, taxes, and installation
                choices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
