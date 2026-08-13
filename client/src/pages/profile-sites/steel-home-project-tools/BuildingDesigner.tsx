import { useId } from "react";
import { AlertTriangle, ChevronDown, Send } from "lucide-react";
import {
  BUILDING_COLOR_OPTIONS,
  BUILDING_PORCH_OPTIONS,
  BUILDING_ROOF_OPTIONS,
  BUILDING_ROOF_PITCH_OPTIONS,
  BUILDING_USE_OPTIONS,
  calculateBuildingPlanningEstimate,
  formatPlanningRange,
  getBuildingOpeningFit,
  type SteelHomeBuildingDesign,
} from "./projectModel";
import PlanningEstimateCard from "./PlanningEstimateCard";
import {
  PROJECT_TEXTAREA_CLASS,
  ProjectColorField,
  ProjectNumberField,
  ProjectSelect,
  ProjectTextSelect,
} from "./ProjectToolControls";

type Props = {
  design: SteelHomeBuildingDesign;
  onChange: (design: SteelHomeBuildingDesign) => void;
  onRequest: () => void;
};

function colorHex(value: string): string {
  return BUILDING_COLOR_OPTIONS.find((option) => option.value === value)?.hex || "#777777";
}

function BuildingPreview({ design }: { design: SteelHomeBuildingDesign }) {
  const gradientId = `building-${useId().replace(/:/g, "")}`;
  const roofLabel =
    BUILDING_ROOF_OPTIONS.find((option) => option.value === design.roofStyle)?.label || "Selected";
  const useLabel = BUILDING_USE_OPTIONS.find((option) => option.value === design.use)?.label;
  const frontWidth = Math.min(390, Math.max(230, 230 + (design.widthFt - 24) * 2.4));
  const wallHeight = Math.min(195, Math.max(105, 94 + (design.eaveHeightFt - 8) * 6.2));
  const sideDepth = Math.min(215, Math.max(100, 90 + (design.lengthFt - 24) * 1.08));
  const roofRise = Number(design.roofPitch.split(":")[0] || 4) * 13;
  const frontX = 112;
  const wallBottom = 398;
  const wallTop = wallBottom - wallHeight;
  const sideX = frontX + frontWidth;
  const sideTopOffset = -sideDepth * 0.34;
  const wallColor = colorHex(design.wallColor);
  const roofColor = colorHex(design.roofColor);
  const trimColor = colorHex(design.trimColor);
  const garageDoors = Array.from({ length: Math.min(design.garageDoors, 5) });
  const windows = Array.from({ length: design.windows });
  const windowColumns = Math.min(8, Math.max(1, Math.ceil(windows.length / 2)));
  const windowRows = Math.max(1, Math.ceil(windows.length / windowColumns));
  const windowColumnSpacing = (sideDepth - 30) / (windowColumns + 1);
  const windowWidth = Math.min(23, Math.max(6, windowColumnSpacing * 0.72));
  const windowHeight = Math.min(33, Math.max(17, wallHeight * 0.2));
  const garageWidth = Math.min(76, (frontWidth - 48) / Math.max(1, garageDoors.length));
  const frontPorch = design.porch === "front" || design.porch === "wrap";
  const sidePorch = design.porch === "side" || design.porch === "wrap";
  const frontPorchProjection = 16 + design.porchDepthFt * 2.4;
  const sidePorchProjection = Math.min(58, 14 + design.porchDepthFt * 2.1);

  return (
    <svg
      viewBox="0 0 760 500"
      role="img"
      aria-label={`${design.widthFt} by ${design.lengthFt} foot metal building with a ${roofLabel} roof`}
      className="h-full min-h-[22rem] w-full"
      data-testid="steel-home-building-preview"
      data-use={design.use}
      data-roof={design.roofStyle}
      data-roof-pitch={design.roofPitch}
      data-wall-color={design.wallColor}
      data-roof-color={design.roofColor}
      data-trim-color={design.trimColor}
      data-garage-doors={design.garageDoors}
      data-walk-doors={design.walkDoors}
      data-windows={design.windows}
      data-porch={design.porch}
    >
      <defs>
        <linearGradient id={`${gradientId}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dce6e3" />
          <stop offset="1" stopColor="#f5eee3" />
        </linearGradient>
        <linearGradient id={`${gradientId}-ground`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6e806e" />
          <stop offset="1" stopColor="#a49b7b" />
        </linearGradient>
        <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="13" stdDeviation="11" floodOpacity="0.22" />
        </filter>
      </defs>

      <rect width="760" height="500" fill={`url(#${gradientId}-sky)`} />
      <path d="M0 376 Q190 336 385 378 T760 356 V500 H0Z" fill={`url(#${gradientId}-ground)`} />
      <g filter={`url(#${gradientId}-shadow)`}>
        <polygon
          points={`${sideX},${wallTop} ${sideX + sideDepth},${wallTop + sideTopOffset} ${
            sideX + sideDepth
          },${wallBottom + sideTopOffset} ${sideX},${wallBottom}`}
          fill={wallColor}
          opacity="0.8"
          stroke={trimColor}
          strokeWidth="5"
          data-testid="steel-home-building-wall-preview"
        />
        <rect
          x={frontX}
          y={wallTop}
          width={frontWidth}
          height={wallHeight}
          fill={wallColor}
          stroke={trimColor}
          strokeWidth="5"
        />

        {design.roofStyle === "single-slope" ? (
          <g data-testid="steel-home-building-roof-preview">
            <polygon
              points={`${frontX - 10},${wallTop - roofRise} ${sideX + 10},${wallTop} ${
                sideX + sideDepth + 18
              },${wallTop + sideTopOffset} ${frontX + sideDepth - 18},${
                wallTop + sideTopOffset - roofRise
              }`}
              fill={roofColor}
              stroke={trimColor}
              strokeWidth="5"
            />
            <polygon
              points={`${frontX},${wallTop - roofRise} ${sideX},${wallTop} ${frontX},${wallTop}`}
              fill={wallColor}
              stroke={trimColor}
              strokeWidth="5"
            />
          </g>
        ) : (
          <g data-testid="steel-home-building-roof-preview">
            <polygon
              points={`${frontX - 12},${wallTop} ${frontX + frontWidth / 2},${
                wallTop - roofRise
              } ${sideX + 12},${wallTop} ${sideX + sideDepth + 18},${
                wallTop + sideTopOffset
              } ${frontX + frontWidth / 2 + sideDepth},${
                wallTop + sideTopOffset - roofRise
              } ${frontX - 12 + sideDepth},${wallTop + sideTopOffset}`}
              fill={roofColor}
              stroke={trimColor}
              strokeWidth="5"
            />
            <polygon
              points={`${frontX},${wallTop} ${frontX + frontWidth / 2},${
                wallTop - roofRise
              } ${sideX},${wallTop}`}
              fill={wallColor}
              stroke={trimColor}
              strokeWidth="5"
            />
            {design.roofStyle === "monitor" ? (
              <g>
                <rect
                  x={frontX + frontWidth * 0.36}
                  y={wallTop - roofRise - 34}
                  width={frontWidth * 0.28}
                  height="34"
                  fill={wallColor}
                  stroke={trimColor}
                  strokeWidth="4"
                />
                <polygon
                  points={`${frontX + frontWidth * 0.33},${wallTop - roofRise - 34} ${
                    frontX + frontWidth / 2
                  },${wallTop - roofRise - 58} ${frontX + frontWidth * 0.67},${
                    wallTop - roofRise - 34
                  }`}
                  fill={roofColor}
                  stroke={trimColor}
                  strokeWidth="4"
                />
              </g>
            ) : null}
          </g>
        )}

        {garageDoors.map((_, index) => {
          const x = frontX + 20 + index * (garageWidth + 9);
          return (
            <rect
              key={`garage-${index}`}
              x={x}
              y={wallBottom - wallHeight * 0.62}
              width={garageWidth}
              height={wallHeight * 0.62}
              rx="3"
              fill="#d9d8d0"
              stroke={trimColor}
              strokeWidth="4"
              data-testid="steel-home-building-garage-preview"
            />
          );
        })}

        {Array.from({ length: design.walkDoors }).map((_, index) => (
          <rect
            key={`walk-${index}`}
            x={sideX - 52 - index * 42}
            y={wallBottom - 76}
            width="34"
            height="76"
            fill="#b8ad98"
            stroke={trimColor}
            strokeWidth="4"
            data-testid="steel-home-building-walk-door-preview"
          />
        ))}

        {windows.map((_, index) => {
          const column = index % windowColumns;
          const row = Math.floor(index / windowColumns);
          const horizontalFraction = (column + 1) / (windowColumns + 1);
          const verticalFraction = windowRows === 1 ? 0.42 : row === 0 ? 0.3 : 0.59;
          const x = sideX + 10 + horizontalFraction * (sideDepth - 30);
          const y =
            wallTop + sideTopOffset * ((x - sideX) / sideDepth) + wallHeight * verticalFraction;
          return (
            <rect
              key={`window-${index}`}
              x={x}
              y={y}
              width={windowWidth}
              height={windowHeight}
              fill="#9fc0c4"
              stroke={trimColor}
              strokeWidth="3"
              data-testid="steel-home-building-window-preview"
            />
          );
        })}

        {frontPorch ? (
          <g
            data-testid="steel-home-building-front-porch-preview"
            data-porch-depth={design.porchDepthFt}
          >
            <polygon
              points={`${frontX - frontPorchProjection},${wallBottom - 84} ${
                sideX + frontPorchProjection * 0.5
              },${wallBottom - 84} ${sideX + frontPorchProjection},${
                wallBottom - 84 + frontPorchProjection * 0.42
              } ${frontX - frontPorchProjection * 1.25},${
                wallBottom - 84 + frontPorchProjection * 0.42
              }`}
              fill={roofColor}
              stroke={trimColor}
              strokeWidth="4"
            />
          </g>
        ) : null}
        {sidePorch ? (
          <g
            data-testid="steel-home-building-side-porch-preview"
            data-porch-depth={design.porchDepthFt}
          >
            <polygon
              points={`${sideX},${wallBottom - 88} ${sideX + sideDepth},${
                wallBottom - 88 + sideTopOffset
              } ${sideX + sideDepth + sidePorchProjection},${
                wallBottom - 70 + sideTopOffset
              } ${sideX + sidePorchProjection},${wallBottom - 70}`}
              fill={roofColor}
              stroke={trimColor}
              strokeWidth="4"
            />
          </g>
        ) : null}
      </g>

      <g fill="#18312f" fontFamily="system-ui, sans-serif">
        <text x="30" y="38" fontSize="13" fontWeight="800" letterSpacing="1.5">
          {(useLabel || "METAL BUILDING").toUpperCase()}
        </text>
        <text x="30" y="68" fontSize="22" fontWeight="800">
          {design.widthFt}&apos; × {design.lengthFt}&apos; × {design.eaveHeightFt}&apos;
        </text>
        <text x="30" y="92" fontSize="13" fontWeight="600">
          {roofLabel} roof · {design.roofPitch} pitch ·{" "}
          {design.garageDoors + design.walkDoors + design.windows} openings
        </text>
      </g>
    </svg>
  );
}

export default function BuildingDesigner({ design, onChange, onRequest }: Props) {
  const update = (values: Partial<SteelHomeBuildingDesign>) => onChange({ ...design, ...values });
  const estimate = calculateBuildingPlanningEstimate(design);
  const openingFit = getBuildingOpeningFit(design);
  const useLabel = BUILDING_USE_OPTIONS.find((item) => item.value === design.use)?.label;
  const roofLabel = BUILDING_ROOF_OPTIONS.find((item) => item.value === design.roofStyle)?.label;
  const porchLabel = BUILDING_PORCH_OPTIONS.find((item) => item.value === design.porch)?.label;
  const startRequest = () => {
    if (!openingFit.fits) return;
    onChange({ ...design, included: true });
    onRequest();
  };

  return (
    <section
      id="building-designer"
      className="h-full overflow-y-auto bg-[#e7ece8] text-[#18312f] lg:overflow-hidden"
      data-testid="steel-home-building-designer"
    >
      <div className="grid min-h-full lg:h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(25rem,.85fr)]">
        <div className="flex min-h-[34rem] flex-col gap-3 p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto lg:p-5">
          <div className="min-h-[22rem] flex-1 overflow-hidden rounded-[1.4rem] border border-[#18312f]/10 bg-[#edf0eb] shadow-[0_18px_55px_rgba(24,49,47,.12)]">
            <BuildingPreview design={design} />
          </div>

          <div
            className="grid gap-3 rounded-[1.25rem] border border-[#18312f]/10 bg-white/80 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            data-testid="steel-home-building-live-summary"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#a94f2e]">
                {useLabel} · {roofLabel} · {design.roofPitch}
              </p>
              <p className="mt-1 text-sm text-[#68736f]">
                {(design.widthFt * design.lengthFt).toLocaleString()} sq. ft. · {porchLabel} · Roof
                included
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
            testId="steel-home-building-planning-estimate"
            roofIncluded
            theme="light"
          />
        </div>

        <div className="flex min-h-0 flex-col border-t border-[#18312f]/10 bg-[#f7f3eb] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#a94f2e]">
                Size and roof
              </p>
              <p className="mt-2 text-sm leading-6 text-[#68736f]">
                Change a choice and watch the building and estimate update.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProjectSelect
                label="Intended use"
                value={design.use}
                options={BUILDING_USE_OPTIONS}
                onChange={(use) => update({ use })}
                testId="steel-home-building-use"
              />
              <ProjectSelect
                label="Roof style"
                value={design.roofStyle}
                options={BUILDING_ROOF_OPTIONS}
                onChange={(roofStyle) => update({ roofStyle })}
                testId="steel-home-building-roof"
              />
              <ProjectNumberField
                label="Width"
                value={design.widthFt}
                min={12}
                max={200}
                suffix="ft"
                onChange={(widthFt) => update({ widthFt })}
                testId="steel-home-building-width"
              />
              <ProjectNumberField
                label="Length"
                value={design.lengthFt}
                min={20}
                max={400}
                suffix="ft"
                onChange={(lengthFt) => update({ lengthFt })}
                testId="steel-home-building-length"
              />
              <ProjectNumberField
                label="Eave height"
                value={design.eaveHeightFt}
                min={8}
                max={40}
                suffix="ft"
                onChange={(eaveHeightFt) => update({ eaveHeightFt })}
                testId="steel-home-building-height"
              />
              <ProjectTextSelect
                label="Roof pitch"
                value={design.roofPitch}
                options={BUILDING_ROOF_PITCH_OPTIONS}
                onChange={(roofPitch) => update({ roofPitch })}
                testId="steel-home-building-roof-pitch"
              />
            </div>

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                Doors, windows, and porch
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-4 border-t border-[#18312f]/10 p-4 sm:grid-cols-2">
                <ProjectNumberField
                  label="Garage openings"
                  value={design.garageDoors}
                  min={0}
                  max={5}
                  suffix="doors"
                  onChange={(garageDoors) => update({ garageDoors })}
                  testId="steel-home-building-garage-doors"
                />
                <ProjectNumberField
                  label="Entry doors"
                  value={design.walkDoors}
                  min={0}
                  max={5}
                  suffix="doors"
                  onChange={(walkDoors) => update({ walkDoors })}
                  testId="steel-home-building-walk-doors"
                />
                <ProjectNumberField
                  label="Windows"
                  value={design.windows}
                  min={0}
                  max={16}
                  suffix="windows"
                  onChange={(windows) => update({ windows })}
                  testId="steel-home-building-windows"
                />
                <ProjectSelect
                  label="Porch"
                  value={design.porch}
                  options={BUILDING_PORCH_OPTIONS}
                  onChange={(porch) => update({ porch })}
                  testId="steel-home-building-porch"
                />
                {design.porch !== "none" ? (
                  <ProjectNumberField
                    label="Porch depth"
                    value={design.porchDepthFt}
                    min={4}
                    max={20}
                    suffix="ft"
                    onChange={(porchDepthFt) => update({ porchDepthFt })}
                    testId="steel-home-building-porch-depth"
                  />
                ) : null}
              </div>
            </details>

            <div
              id="steel-home-building-opening-disclosure"
              className="mt-4 rounded-2xl border border-[#18312f]/10 bg-[#e7ede5] p-4 text-sm leading-6 text-[#4f625e]"
              data-testid="steel-home-building-opening-disclosure"
            >
              <p>
                <strong className="text-[#18312f]">
                  Opening counts are planning requirements only.
                </strong>{" "}
                Final sizes, placement, framing, clearances, and engineering must be confirmed for
                the actual building.
              </p>
            </div>

            {!openingFit.fits ? (
              <div
                id="steel-home-building-opening-fit-warning"
                className="mt-4 flex gap-3 rounded-2xl border border-[#a1392e]/25 bg-[#f8e5df] p-4 text-[#7f2b24]"
                role="status"
                data-testid="steel-home-building-opening-fit-warning"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="text-sm leading-6">
                  <p className="font-black">The opening counts do not fit this rough plan.</p>
                  <p>
                    This {design.widthFt}- by {design.lengthFt}-foot building is about{" "}
                    {openingFit.shortfallFt} feet short of the planner&apos;s rough wall fit. Reduce
                    Garage openings, Entry doors, or Windows until this warning clears, or increase
                    either Width or Length by at least {openingFit.recommendedDimensionIncreaseFt}{" "}
                    feet before starting a request.
                  </p>
                </div>
              </div>
            ) : null}

            <details className="group mt-5 rounded-2xl border border-[#18312f]/12 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] [&::-webkit-details-marker]:hidden">
                Exterior colors
                <ChevronDown
                  className="h-4 w-4 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-5 border-t border-[#18312f]/10 p-4 sm:grid-cols-3">
                <ProjectColorField
                  label="Walls"
                  value={design.wallColor}
                  options={BUILDING_COLOR_OPTIONS}
                  onChange={(wallColor) => update({ wallColor })}
                  testIdPrefix="steel-home-building-wall-color"
                />
                <ProjectColorField
                  label="Roof"
                  value={design.roofColor}
                  options={BUILDING_COLOR_OPTIONS}
                  onChange={(roofColor) => update({ roofColor })}
                  testIdPrefix="steel-home-building-roof-color"
                />
                <ProjectColorField
                  label="Trim"
                  value={design.trimColor}
                  options={BUILDING_COLOR_OPTIONS}
                  onChange={(trimColor) => update({ trimColor })}
                  testIdPrefix="steel-home-building-trim-color"
                />
              </div>
            </details>

            <label className="mt-5 block space-y-2 text-sm font-bold">
              <span>Notes</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Overhangs, special bays, expansion, or site concerns"
                className={PROJECT_TEXTAREA_CLASS}
                data-testid="steel-home-building-notes"
              />
            </label>
          </div>

          <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-3 border-t border-[#18312f]/12 bg-white px-4 py-3 shadow-[0_-12px_35px_rgba(24,49,47,.1)] sm:px-6">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#a94f2e]">
                Early price estimate
              </p>
              <p className="truncate text-lg font-black">{formatPlanningRange(estimate.range)}</p>
            </div>
            <button
              type="button"
              onClick={startRequest}
              disabled={!openingFit.fits}
              aria-disabled={!openingFit.fits}
              aria-describedby={`steel-home-building-opening-disclosure${
                openingFit.fits ? "" : " steel-home-building-opening-fit-warning"
              }`}
              className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                openingFit.fits
                  ? "bg-[#a94f2e] text-white hover:bg-[#8f3f25] focus-visible:ring-[#a94f2e]"
                  : "cursor-not-allowed bg-[#d9ddd5] text-[#596762] focus-visible:ring-[#596762]"
              }`}
              data-testid="steel-home-building-include"
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
