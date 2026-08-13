import { useId, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Ruler,
  Scissors,
  Send,
  Sparkles,
} from "lucide-react";
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
  onRequest: () => void;
};

const QUICK_STONE_IDS = [
  "cristallo",
  "taj-mahal",
  "aj-quartz",
  "amazonic-green",
  "blue-goias",
  "rhino-white",
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
  const layoutLabel =
    COUNTERTOP_LAYOUT_OPTIONS.find((option) => option.value === design.layout)?.label ||
    "selected layout";
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
      aria-label={`${design.room} ${layoutLabel} countertop preview using ${stone?.publicLabel || "the selected surface"}`}
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
          ESTIMATED AREA
        </text>
        <text x="34" y="480" fontSize="24" fontWeight="800">
          About {squareFeet} sq. ft.
        </text>
        <text x="725" y="476" textAnchor="end" fontSize="13" fontWeight="600" fill="#63706c">
          Final measurements required
        </text>
      </g>
    </svg>
  );
}

export default function CountertopDesigner({ design, onChange, onRequest }: Props) {
  const [stoneSearch, setStoneSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const startRequest = () => {
    onChange({ ...design, included: true });
    onRequest();
  };

  return (
    <section
      id="countertop-designer"
      className="bg-[#17201f] text-white"
      data-testid="steel-home-countertop-designer"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-8">
        <div className="mb-5 lg:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f0b392]">
            Countertop Planner
          </p>
          <h2 className="mt-2 font-editorial text-3xl font-semibold leading-none tracking-[-0.04em] text-white">
            Choose a surface and estimate the countertop area.
          </h2>
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(480px,1.1fr)] lg:items-start">
          <div className="order-1 lg:sticky lg:top-[9.5rem]">
            <div className="hidden lg:block">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f0b392]">
                {content.tools.countertops.eyebrow}
              </p>
              <h2 className="mt-3 max-w-3xl font-editorial text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl">
                {content.tools.countertops.title}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/[0.68] sm:text-base">
                Choose Quartzite, Engineered Quartz, or another available surface from real photos,
                then enter the layout and cutouts to see the approximate area.
              </p>
            </div>

            <button
              type="button"
              aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((open) => !open)}
              className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/15 bg-white/[0.08] px-4 text-sm font-black text-white lg:hidden"
              data-testid="steel-home-countertop-preview-toggle"
            >
              View live preview and area
              <ChevronDown
                className={`h-4 w-4 transition ${previewOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            <div className={`${previewOpen ? "block" : "hidden"} lg:block`}>
              <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#ded8cb] shadow-[0_18px_55px_rgba(0,0,0,0.26)]">
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
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">
                    Estimated area
                  </p>
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
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em]">
                    Countertop price
                  </p>
                  <p className="mt-1 text-sm text-white/[0.65]">Quote needed</p>
                </div>
              </div>
            </div>
          </div>

          <div className="order-3 rounded-[2rem] border border-white/10 bg-[#f4efe6] p-5 text-[#18312f] shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-8 lg:order-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a94f2e]">
                Choose a surface
              </p>
              <h3 className="mt-3 font-editorial text-4xl font-semibold tracking-[-0.035em]">
                Choose a surface and see it on the layout.
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#68736f]">
                Choose Quartzite, Engineered Quartz, or another available surface from the photos.
                We confirm availability, finish, dimensions, fabrication, delivery, and price before
                ordering.
              </p>
            </div>

            <div
              className="mt-7 flex snap-x gap-3 overflow-x-auto pb-2"
              aria-label="Quick surface choices"
              data-testid="steel-home-countertop-quick-rail"
            >
              {quickStones.map((stone) => {
                const selected = stone.id === design.stoneId;
                return (
                  <button
                    key={stone.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ stoneId: stone.id })}
                    data-testid={`steel-home-countertop-stone-${stone.id}`}
                    className={`group w-40 shrink-0 snap-start overflow-hidden rounded-2xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] sm:w-44 ${
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
                      <span className="block text-sm font-bold leading-5">{stone.publicLabel}</span>
                      <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[#77817d]">
                        {stone.materialLabel || "Material details available with quote"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <a
              href="#steel-home-countertop-browse-all"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-black text-[#8b4b33] underline decoration-[#a94f2e]/40 underline-offset-4"
            >
              Browse all surfaces
            </a>

            <div id="steel-home-countertop-browse-all" className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-bold">
                <span>Search surfaces</span>
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
              <span>All surfaces</span>
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
              {matchingStones.length} {matchingStones.length === 1 ? "result" : "results"}
              {selectedStone && selectableStones.length > matchingStones.length
                ? "; your selected surface is still shown"
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
                label="Room layout"
                value={design.layout}
                options={COUNTERTOP_LAYOUT_OPTIONS}
                onChange={(layout) => update({ layout })}
                testId="steel-home-countertop-layout"
              />
              <ProjectNumberField
                label="Main countertop run"
                value={design.wallAIn}
                min={24}
                max={360}
                suffix="in"
                onChange={(wallAIn) => update({ wallAIn })}
                testId="steel-home-countertop-run-a"
              />
              {design.layout !== "straight" ? (
                <ProjectNumberField
                  label="Left return"
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
                  label="Right return"
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

            <div className="mt-8 hidden flex-col items-start gap-3 border-t border-[#18312f]/10 pt-7 lg:flex">
              <button
                type="button"
                onClick={startRequest}
                data-testid="steel-home-countertop-include"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#a94f2e] px-6 text-sm font-black text-white shadow-[0_16px_45px_rgba(84,35,18,0.2)] transition hover:bg-[#8f3f25] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] focus-visible:ring-offset-2"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Start a Request
              </button>
              <p className="text-xs leading-5 text-[#68736f]">
                These choices are saved on this device.
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 z-30 order-2 -mx-4 flex items-center justify-between gap-3 border-y border-white/10 bg-[#17201f]/95 px-4 py-3 shadow-[0_-14px_35px_rgba(0,0,0,.25)] backdrop-blur lg:hidden">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#f0b392]">
                Approximate area · Quote needed
              </p>
              <p className="truncate text-sm font-black text-white">About {squareFeet} sq. ft.</p>
            </div>
            <button
              type="button"
              onClick={startRequest}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#d66d42] px-5 text-sm font-black text-white"
              data-testid="steel-home-countertop-mobile-request"
            >
              Start a Request
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
