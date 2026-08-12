import { Building2, DoorOpen, Warehouse, Wind } from "lucide-react";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import {
  BUILDING_COLOR_OPTIONS,
  BUILDING_PORCH_OPTIONS,
  BUILDING_ROOF_OPTIONS,
  BUILDING_ROOF_PITCH_OPTIONS,
  BUILDING_USE_OPTIONS,
  type SteelHomeBuildingDesign,
} from "./projectModel";
import {
  IncludeDesignButton,
  PROJECT_TEXTAREA_CLASS,
  ProjectColorField,
  ProjectNumberField,
  ProjectSelect,
  ProjectTextSelect,
} from "./ProjectToolControls";

type Props = {
  design: SteelHomeBuildingDesign;
  onChange: (design: SteelHomeBuildingDesign) => void;
};

function colorHex(value: string): string {
  return BUILDING_COLOR_OPTIONS.find((option) => option.value === value)?.hex || "#777777";
}

function BuildingPreview({ design }: { design: SteelHomeBuildingDesign }) {
  const frontWidth = Math.min(390, Math.max(250, 250 + (design.widthFt - 30) * 2.2));
  const wallHeight = Math.min(190, Math.max(110, 100 + (design.eaveHeightFt - 8) * 6));
  const sideDepth = Math.min(210, Math.max(105, 95 + (design.lengthFt - 30) * 1.1));
  const roofRise = Number(design.roofPitch.split(":")[0] || 4) * 13;
  const frontX = 120;
  const wallBottom = 390;
  const wallTop = wallBottom - wallHeight;
  const sideX = frontX + frontWidth;
  const sideTopOffset = -sideDepth * 0.36;
  const wallColor = colorHex(design.wallColor);
  const roofColor = colorHex(design.roofColor);
  const trimColor = colorHex(design.trimColor);
  const visibleGarageDoors = Array.from({ length: Math.min(design.garageDoors, 5) });
  const visibleWindows = Array.from({ length: Math.min(design.windows, 6) });
  const hiddenWindowCount = Math.max(0, design.windows - visibleWindows.length);
  const garageWidth = Math.min(76, (frontWidth - 54) / Math.max(1, visibleGarageDoors.length));
  const hasFrontPorch = design.porch === "front" || design.porch === "wrap";
  const hasSidePorch = design.porch === "side" || design.porch === "wrap";
  const frontPorchProjection = 16 + design.porchDepthFt * 2.4;
  const sidePorchProjection = Math.min(56, 14 + design.porchDepthFt * 2.1);

  return (
    <svg
      viewBox="0 0 760 500"
      role="img"
      aria-label={`${design.widthFt} by ${design.lengthFt} foot steel building concept with a ${design.roofStyle} roof`}
      className="h-auto w-full"
      data-testid="steel-home-building-preview"
    >
      <defs>
        <linearGradient id="building-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dce5e1" />
          <stop offset="1" stopColor="#f5eee2" />
        </linearGradient>
        <linearGradient id="building-ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#70806f" />
          <stop offset="1" stopColor="#9b9a7d" />
        </linearGradient>
        <filter id="building-shadow" x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodOpacity="0.22" />
        </filter>
      </defs>

      <rect width="760" height="500" rx="30" fill="url(#building-sky)" />
      <path d="M0 370 Q190 330 385 372 T760 352 V500 H0Z" fill="url(#building-ground)" />
      <g filter="url(#building-shadow)">
        <polygon
          points={`${sideX},${wallTop} ${sideX + sideDepth},${wallTop + sideTopOffset} ${
            sideX + sideDepth
          },${wallBottom + sideTopOffset} ${sideX},${wallBottom}`}
          fill={wallColor}
          opacity="0.78"
          stroke={trimColor}
          strokeWidth="5"
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
          <>
            <polygon
              points={`${frontX - 10},${wallTop - roofRise} ${sideX + 10},${wallTop} ${
                sideX + sideDepth + 18
              },${wallTop + sideTopOffset} ${frontX + sideDepth - 18},${wallTop + sideTopOffset - roofRise}`}
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
          </>
        ) : (
          <>
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
          </>
        )}

        {visibleGarageDoors.map((_, index) => {
          const x = frontX + 22 + index * (garageWidth + 10);
          return (
            <g key={`garage-${index}`}>
              <rect
                x={x}
                y={wallBottom - wallHeight * 0.64}
                width={garageWidth}
                height={wallHeight * 0.64}
                rx="3"
                fill="#d8d6cc"
                stroke={trimColor}
                strokeWidth="4"
              />
              {Array.from({ length: 4 }).map((__, row) => (
                <line
                  key={row}
                  x1={x + 4}
                  x2={x + garageWidth - 4}
                  y1={wallBottom - wallHeight * 0.64 + (row + 1) * ((wallHeight * 0.64) / 5)}
                  y2={wallBottom - wallHeight * 0.64 + (row + 1) * ((wallHeight * 0.64) / 5)}
                  stroke="#969a94"
                  strokeWidth="2"
                />
              ))}
            </g>
          );
        })}

        {design.walkDoors > 0 ? (
          <rect
            x={sideX - 54}
            y={wallBottom - 78}
            width="36"
            height="78"
            fill="#b8ad98"
            stroke={trimColor}
            strokeWidth="4"
          />
        ) : null}

        {visibleWindows.map((_, index) => {
          const x = sideX + 18 + index * Math.max(18, (sideDepth - 58) / 6);
          const y = wallTop + sideTopOffset * ((x - sideX) / sideDepth) + wallHeight * 0.34;
          return (
            <rect
              key={`window-${index}`}
              x={x}
              y={y}
              width="24"
              height="34"
              fill="#9fc0c4"
              stroke={trimColor}
              strokeWidth="3"
            />
          );
        })}

        {hiddenWindowCount > 0 ? (
          <text
            x={sideX + sideDepth - 12}
            y={wallBottom + sideTopOffset - 16}
            textAnchor="end"
            fill="#18312f"
            fontFamily="system-ui, sans-serif"
            fontSize="12"
            fontWeight="800"
          >
            +{hiddenWindowCount} WINDOWS
          </text>
        ) : null}

        {hasFrontPorch ? (
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
            {[
              frontX - frontPorchProjection * 0.75,
              frontX + frontWidth * 0.34,
              frontX + frontWidth * 0.68,
              sideX + frontPorchProjection * 0.7,
            ].map((x) => (
              <line
                key={x}
                x1={x}
                x2={x}
                y1={wallBottom - 84 + frontPorchProjection * 0.42}
                y2={wallBottom + 8}
                stroke={trimColor}
                strokeWidth="5"
              />
            ))}
          </g>
        ) : null}

        {hasSidePorch ? (
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
            {[0.18, 0.62, 1].map((position) => {
              const x = sideX + sideDepth * position + sidePorchProjection;
              const topY = wallBottom - 70 + sideTopOffset * position;
              return (
                <line
                  key={position}
                  x1={x}
                  x2={x}
                  y1={topY}
                  y2={wallBottom + 8 + sideTopOffset * position}
                  stroke={trimColor}
                  strokeWidth="5"
                />
              );
            })}
          </g>
        ) : null}
      </g>

      <g fill="#18312f" fontFamily="system-ui, sans-serif" fontWeight="700">
        <text x="34" y="52" fontSize="15" letterSpacing="2">
          LIVE CONCEPT
        </text>
        <text x="34" y="80" fontSize="24">
          {design.widthFt}' × {design.lengthFt}' × {design.eaveHeightFt}'
        </text>
        <text x="34" y="106" fontSize="14" fontWeight="500">
          {BUILDING_ROOF_OPTIONS.find((item) => item.value === design.roofStyle)?.label} roof •{" "}
          {design.roofPitch}
        </text>
      </g>
    </svg>
  );
}

export default function BuildingDesigner({ design, onChange }: Props) {
  const update = (values: Partial<SteelHomeBuildingDesign>) => onChange({ ...design, ...values });

  return (
    <section
      id="building-designer"
      className="scroll-mt-24 bg-[#fbf8f1]"
      data-testid="steel-home-building-designer"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,.95fr)_minmax(520px,1.05fr)] xl:items-start xl:gap-14">
          <div className="xl:sticky xl:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.tools.building.eyebrow}
            </p>
            <h2 className="mt-4 max-w-3xl font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-[#18312f] sm:text-7xl">
              {content.tools.building.title}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#5e6965] sm:text-lg">
              {content.tools.building.body}
            </p>

            <div className="mt-9 overflow-hidden rounded-[2rem] border border-[#18312f]/10 bg-[#edf0eb] shadow-[0_24px_80px_rgba(24,49,47,0.12)]">
              <BuildingPreview design={design} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#18312f]/10 bg-white p-4">
                <Building2 className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Footprint</p>
                <p className="mt-1 text-sm text-[#68736f]">
                  {(design.widthFt * design.lengthFt).toLocaleString()} sq. ft.
                </p>
              </div>
              <div className="rounded-2xl border border-[#18312f]/10 bg-white p-4">
                <DoorOpen className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Openings</p>
                <p className="mt-1 text-sm text-[#68736f]">
                  {design.garageDoors + design.walkDoors + design.windows} planned
                </p>
              </div>
              <div className="rounded-2xl border border-[#18312f]/10 bg-white p-4">
                <Warehouse className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Porch</p>
                <p className="mt-1 text-sm text-[#68736f]">
                  {BUILDING_PORCH_OPTIONS.find((item) => item.value === design.porch)?.label}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#18312f]/10 bg-[#efe9de] p-5 shadow-[0_24px_80px_rgba(24,49,47,0.08)] sm:p-8">
            <div className="flex items-center gap-3 border-b border-[#18312f]/10 pb-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#18312f] text-white">
                <Wind className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-[#18312f]">Building controls</p>
                <p className="mt-1 text-xs text-[#6d7874]">Change any starting value below.</p>
              </div>
            </div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
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
              />
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <ProjectColorField
                label="Wall color"
                value={design.wallColor}
                options={BUILDING_COLOR_OPTIONS}
                onChange={(wallColor) => update({ wallColor })}
                testIdPrefix="steel-home-building-wall-color"
              />
              <ProjectColorField
                label="Roof color"
                value={design.roofColor}
                options={BUILDING_COLOR_OPTIONS}
                onChange={(roofColor) => update({ roofColor })}
                testIdPrefix="steel-home-building-roof-color"
              />
              <ProjectColorField
                label="Trim color"
                value={design.trimColor}
                options={BUILDING_COLOR_OPTIONS}
                onChange={(trimColor) => update({ trimColor })}
                testIdPrefix="steel-home-building-trim-color"
              />
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <ProjectNumberField
                label="Garage doors"
                value={design.garageDoors}
                min={0}
                max={5}
                suffix="doors"
                onChange={(garageDoors) => update({ garageDoors })}
              />
              <ProjectNumberField
                label="Walk doors"
                value={design.walkDoors}
                min={0}
                max={5}
                suffix="doors"
                onChange={(walkDoors) => update({ walkDoors })}
              />
              <ProjectNumberField
                label="Windows"
                value={design.windows}
                min={0}
                max={16}
                suffix="windows"
                onChange={(windows) => update({ windows })}
              />
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <ProjectSelect
                label="Porch"
                value={design.porch}
                options={BUILDING_PORCH_OPTIONS}
                onChange={(porch) => update({ porch })}
                testId="steel-home-building-porch"
              />
              <ProjectNumberField
                label="Porch depth"
                value={design.porchDepthFt}
                min={0}
                max={20}
                suffix="ft"
                onChange={(porchDepthFt) => update({ porchDepthFt })}
                testId="steel-home-building-porch-depth"
              />
            </div>

            <label className="mt-7 block space-y-2 text-sm font-bold text-[#18312f]">
              <span>Building notes</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Overhangs, special bays, future expansion, site concerns, or other priorities."
                className={PROJECT_TEXTAREA_CLASS}
              />
            </label>

            <div className="mt-8 flex flex-col items-start gap-3 border-t border-[#18312f]/10 pt-7">
              <IncludeDesignButton
                included={design.included}
                onClick={() => update({ included: !design.included })}
                label="Add building design to project"
                testId="steel-home-building-include"
              />
              <p className="text-xs leading-5 text-[#68736f]">
                This saves the concept in this browser. It does not submit a request.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
