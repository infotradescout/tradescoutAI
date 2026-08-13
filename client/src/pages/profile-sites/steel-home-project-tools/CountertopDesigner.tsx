import { useId, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Ruler, Scissors, Sparkles } from "lucide-react";
import { JW_STONE_NAMED_CATALOG, getCatalogItemById } from "@/features/jw-stone/catalog";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import {
  COUNTERTOP_BACKSPLASH_OPTIONS,
  COUNTERTOP_COOKTOP_OPTIONS,
  COUNTERTOP_EDGE_OPTIONS,
  COUNTERTOP_LAYOUT_OPTIONS,
  COUNTERTOP_ROOM_OPTIONS,
  COUNTERTOP_SINK_OPTIONS,
  calculateCountertopSquareFeet,
  type SteelHomeCountertopDesign,
} from "./projectModel";
import {
  IncludeDesignButton,
  PROJECT_FIELD_CLASS,
  PROJECT_TEXTAREA_CLASS,
  ProjectNumberField,
  ProjectSelect,
  ProjectTextSelect,
  ProjectToggle,
} from "./ProjectToolControls";
import { buildStoneDesignerImageHref } from "./stoneDesignerImages";

type Props = {
  design: SteelHomeCountertopDesign;
  onChange: (design: SteelHomeCountertopDesign) => void;
};

const QUICK_STONE_IDS = [
  "cristallo",
  "taj-mahal",
  "amazonic-green",
  "blue-goias",
  "rhino-white",
  "gold-macaubas",
] as const;

const quickStones = QUICK_STONE_IDS.map((id) => getCatalogItemById(id)).filter(
  (stone): stone is NonNullable<ReturnType<typeof getCatalogItemById>> => Boolean(stone)
);

const allNamedStones = [...JW_STONE_NAMED_CATALOG].sort((a, b) =>
  a.publicLabel.localeCompare(b.publicLabel)
);
const stoneMaterialOptions = Array.from(
  new Set(allNamedStones.flatMap((stone) => (stone.materialLabel ? [stone.materialLabel] : [])))
).sort((a, b) => a.localeCompare(b));

function CountertopPreview({ design }: { design: SteelHomeCountertopDesign }) {
  const patternId = `stone-${useId().replace(/:/g, "")}`;
  const stone = getCatalogItemById(design.stoneId);
  const image = stone ? buildStoneDesignerImageHref(stone.id) : "";
  const squareFeet = calculateCountertopSquareFeet(design);
  const counterDepth = 68;
  const rawTopRunWidth = Math.min(540, Math.max(120, design.wallAIn * 1.7));
  const topRunWidth =
    design.layout === "u-shape" ? Math.max(counterDepth * 2 + 80, rawTopRunWidth) : rawTopRunWidth;
  const topX = (760 - topRunWidth) / 2;
  const topY = design.layout === "straight" ? 205 : 102;
  const leftRunHeight = Math.min(274, Math.max(96, design.wallBIn * 1.25));
  const rightRunHeight = Math.min(274, Math.max(96, design.wallCIn * 1.25));
  const layoutPath =
    design.layout === "straight"
      ? `M${topX} ${topY} H${topX + topRunWidth} V${topY + counterDepth} H${topX} Z`
      : design.layout === "l-shape"
        ? `M${topX} ${topY} H${topX + topRunWidth} V${
            topY + counterDepth
          } H${topX + counterDepth} V${topY + leftRunHeight} H${topX} Z`
        : `M${topX} ${topY} H${topX + topRunWidth} V${
            topY + rightRunHeight
          } H${topX + topRunWidth - counterDepth} V${
            topY + counterDepth
          } H${topX + counterDepth} V${topY + leftRunHeight} H${topX} Z`;
  const islandWidth = Math.min(300, Math.max(100, design.islandLengthIn * 1.65));
  const islandHeight = Math.min(100, Math.max(44, design.islandWidthIn * 1.15));
  const islandX = (760 - islandWidth) / 2;
  const islandY = design.layout === "straight" ? 330 : 315;
  const sinkWidth = Math.min(92, Math.max(58, topRunWidth * 0.18));
  const sinkX = topX + topRunWidth * 0.32 - sinkWidth / 2;
  const sinkY = topY + 10;
  const cooktopWidth = Math.min(90, Math.max(58, topRunWidth * 0.18));
  const cooktopX = topX + topRunWidth * 0.72 - cooktopWidth / 2;
  const cooktopY = topY + 8;

  return (
    <svg
      viewBox="0 0 760 500"
      role="img"
      aria-label={`${design.room} ${design.layout} countertop concept using ${stone?.publicLabel || "the selected surface"}`}
      className="h-auto w-full"
      data-testid="steel-home-countertop-preview"
    >
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="420" height="280">
          <rect width="420" height="280" fill="#d4d0c7" />
          {image ? (
            <image
              href={image}
              x="0"
              y="0"
              width="420"
              height="280"
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null}
        </pattern>
        <filter id={`${patternId}-shadow`} x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodOpacity="0.2" />
        </filter>
      </defs>
      <rect width="760" height="500" rx="30" fill="#ded8cb" />
      <path d="M0 0H760V78H0Z" fill="#18312f" />
      <text
        x="34"
        y="34"
        fill="#f0b392"
        fontFamily="system-ui, sans-serif"
        fontSize="13"
        fontWeight="800"
        letterSpacing="2"
      >
        SURFACE PREVIEW
      </text>
      <text
        x="34"
        y="61"
        fill="white"
        fontFamily="system-ui, sans-serif"
        fontSize="21"
        fontWeight="700"
      >
        {stone?.publicLabel || "Select a named stone"}
      </text>

      <g filter={`url(#${patternId}-shadow)`}>
        <path
          d={layoutPath}
          data-testid="steel-home-countertop-layout-preview"
          fill={`url(#${patternId})`}
          stroke="#18312f"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {design.island ? (
          <rect
            x={islandX}
            y={islandY}
            width={islandWidth}
            height={islandHeight}
            rx="7"
            data-testid="steel-home-countertop-island-preview"
            fill={`url(#${patternId})`}
            stroke="#18312f"
            strokeWidth="6"
          />
        ) : null}
        {design.sink !== "None" ? (
          <g>
            <rect
              x={sinkX}
              y={sinkY}
              width={sinkWidth}
              height="48"
              rx="12"
              fill="#8fa7a6"
              stroke="#f7f2e9"
              strokeWidth="5"
            />
            <circle cx={sinkX + sinkWidth * 0.78} cy={sinkY + 24} r="5" fill="#18312f" />
          </g>
        ) : null}
        {design.cooktop !== "None" ? (
          <g transform={`translate(${cooktopX} ${cooktopY})`}>
            <rect
              width={cooktopWidth}
              height="52"
              rx="4"
              fill="#2c302f"
              stroke="#f7f2e9"
              strokeWidth="4"
            />
            {[cooktopWidth * 0.25, cooktopWidth * 0.75].map((x) =>
              [17, 37].map((y) => (
                <circle
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  r="8"
                  fill="none"
                  stroke="#a7aaa8"
                  strokeWidth="2"
                />
              ))
            )}
          </g>
        ) : null}
      </g>

      <g fill="#18312f" fontFamily="system-ui, sans-serif">
        <text x="34" y="452" fontSize="14" fontWeight="800" letterSpacing="1.5">
          PLANNING AREA
        </text>
        <text x="34" y="480" fontSize="24" fontWeight="800">
          {squareFeet} sq. ft. approximate
        </text>
        <text x="725" y="476" textAnchor="end" fontSize="13" fontWeight="600" fill="#63706c">
          Field measure required
        </text>
      </g>
    </svg>
  );
}

export default function CountertopDesigner({ design, onChange }: Props) {
  const [stoneSearch, setStoneSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const update = (values: Partial<SteelHomeCountertopDesign>) => onChange({ ...design, ...values });
  const selectedStone = getCatalogItemById(design.stoneId);
  const squareFeet = calculateCountertopSquareFeet(design);
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
  const selectableStones =
    selectedStone && !matchingStones.some((stone) => stone.id === selectedStone.id)
      ? [selectedStone, ...matchingStones]
      : matchingStones;

  return (
    <section
      id="countertop-designer"
      className="scroll-mt-24 bg-[#17201f] text-white"
      data-testid="steel-home-countertop-designer"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,.95fr)_minmax(520px,1.05fr)] xl:items-start xl:gap-14">
          <div className="xl:sticky xl:top-24">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f0b392]">
              {content.tools.countertops.eyebrow}
            </p>
            <h2 className="mt-4 max-w-3xl font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-white sm:text-7xl">
              {content.tools.countertops.title}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/[0.68] sm:text-lg">
              {content.tools.countertops.body}
            </p>

            <div className="mt-9 overflow-hidden rounded-[2rem] border border-white/10 bg-[#ded8cb] shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
              <CountertopPreview design={design} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Sparkles className="h-5 w-5 text-[#f0b392]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">
                  Selected surface
                </p>
                <p className="mt-1 text-sm text-white/[0.65]">{selectedStone?.publicLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Ruler className="h-5 w-5 text-[#f0b392]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Planning area</p>
                <p className="mt-1 text-sm text-white/[0.65]">{squareFeet} sq. ft.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Scissors className="h-5 w-5 text-[#f0b392]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Cutouts</p>
                <p className="mt-1 text-sm text-white/[0.65]">
                  {[
                    design.sink !== "None" ? "Sink" : "",
                    design.cooktop !== "None" ? "Cooktop" : "",
                  ]
                    .filter(Boolean)
                    .join(" + ") || "None"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <CircleDollarSign className="h-5 w-5 text-[#f0b392]" aria-hidden="true" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">Stone pricing</p>
                <p className="mt-1 text-sm text-white/[0.65]">Price after review</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#f4efe6] p-5 text-[#18312f] shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
                Choose a photographed surface
              </p>
              <h3 className="mt-3 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                See the actual inventory photograph on your layout.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#68736f]">
                Every option below is a photographed stone or quartz selection. Quantity, finish,
                dimensions, availability, fabrication, and price are confirmed after review.
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickStones.map((stone) => {
                const selected = stone.id === design.stoneId;
                return (
                  <button
                    key={stone.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ stoneId: stone.id })}
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
                        alt={`${stone.publicLabel} surface inventory photograph`}
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
                      <span className="block text-sm font-bold leading-5">{stone.publicLabel}</span>
                      <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[#77817d]">
                        {stone.materialLabel || "Details confirmed with review"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-bold">
                <span>Search the collection</span>
                <input
                  type="search"
                  value={stoneSearch}
                  onChange={(event) => setStoneSearch(event.target.value)}
                  placeholder="Name or material"
                  className={PROJECT_FIELD_CLASS}
                  data-testid="steel-home-countertop-stone-search"
                />
              </label>
              <label className="block space-y-2 text-sm font-bold">
                <span>Material</span>
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

            <label className="mt-4 block space-y-2 text-sm font-bold">
              <span>All named stones</span>
              <select
                value={design.stoneId}
                onChange={(event) => update({ stoneId: event.target.value })}
                className={PROJECT_FIELD_CLASS}
                data-testid="steel-home-countertop-all-stones"
              >
                {selectableStones.map((stone) => (
                  <option key={stone.id} value={stone.id}>
                    {stone.publicLabel}
                    {stone.materialLabel ? ` — ${stone.materialLabel}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-[#68736f]" aria-live="polite">
              {matchingStones.length} matching{" "}
              {matchingStones.length === 1 ? "selection" : "selections"}
              {selectedStone && selectableStones.length > matchingStones.length
                ? "; your current stone remains available"
                : ""}
              .
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <ProjectTextSelect
                label="Room"
                value={design.room}
                options={COUNTERTOP_ROOM_OPTIONS}
                onChange={(room) => update({ room })}
              />
              <ProjectSelect
                label="Countertop layout"
                value={design.layout}
                options={COUNTERTOP_LAYOUT_OPTIONS}
                onChange={(layout) => update({ layout })}
                testId="steel-home-countertop-layout"
              />
              <ProjectNumberField
                label="Wall run A"
                value={design.wallAIn}
                min={24}
                max={360}
                suffix="in"
                onChange={(wallAIn) => update({ wallAIn })}
                testId="steel-home-countertop-run-a"
              />
              {design.layout !== "straight" ? (
                <ProjectNumberField
                  label="Wall run B"
                  value={design.wallBIn}
                  min={24}
                  max={360}
                  suffix="in"
                  onChange={(wallBIn) => update({ wallBIn })}
                  testId="steel-home-countertop-run-b"
                />
              ) : null}
              {design.layout === "u-shape" ? (
                <ProjectNumberField
                  label="Wall run C"
                  value={design.wallCIn}
                  min={24}
                  max={360}
                  suffix="in"
                  onChange={(wallCIn) => update({ wallCIn })}
                  testId="steel-home-countertop-run-c"
                />
              ) : null}
            </div>

            <div className="mt-7">
              <ProjectToggle
                checked={design.island}
                onChange={(island) => update({ island })}
                label="Include an island"
                description="Add the island as a separate stone surface."
                testId="steel-home-countertop-island"
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
                  testId="steel-home-countertop-island-length"
                />
                <ProjectNumberField
                  label="Island width"
                  value={design.islandWidthIn}
                  min={20}
                  max={72}
                  suffix="in"
                  onChange={(islandWidthIn) => update({ islandWidthIn })}
                  testId="steel-home-countertop-island-width"
                />
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <ProjectTextSelect
                label="Edge profile"
                value={design.edge}
                options={COUNTERTOP_EDGE_OPTIONS}
                onChange={(edge) => update({ edge })}
              />
              <ProjectTextSelect
                label="Backsplash"
                value={design.backsplash}
                options={COUNTERTOP_BACKSPLASH_OPTIONS}
                onChange={(backsplash) => update({ backsplash })}
              />
              <ProjectTextSelect
                label="Sink cutout"
                value={design.sink}
                options={COUNTERTOP_SINK_OPTIONS}
                onChange={(sink) => update({ sink })}
              />
              <ProjectTextSelect
                label="Cooktop cutout"
                value={design.cooktop}
                options={COUNTERTOP_COOKTOP_OPTIONS}
                onChange={(cooktop) => update({ cooktop })}
              />
            </div>

            <label className="mt-7 block space-y-2 text-sm font-bold">
              <span>Countertop notes</span>
              <textarea
                value={design.notes}
                maxLength={240}
                onChange={(event) => update({ notes: event.target.value })}
                placeholder="Waterfall ends, seams, overhangs, special cutouts, or room details."
                className={PROJECT_TEXTAREA_CLASS}
              />
            </label>

            <div className="mt-8 flex flex-col items-start gap-3 border-t border-[#18312f]/10 pt-7">
              <IncludeDesignButton
                included={design.included}
                onClick={() => update({ included: !design.included })}
                label="Add this surface to my plan"
                testId="steel-home-countertop-include"
              />
              <p className="text-xs leading-5 text-[#68736f]">
                Your selected surface, measurements, and cutouts stay with this project.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
