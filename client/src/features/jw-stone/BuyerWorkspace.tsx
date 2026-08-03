import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  JW_STONE_CATALOG,
  filterJwStoneCatalog,
  getFinishFilterOptions,
  getMaterialFilterOptions,
  getOriginFilterOptions,
} from "./catalog";
import { COLOR_DIRECTIONS } from "./colorDirections";
import { StoneCard } from "./StoneCard";
import { TrendingSelectionRail } from "./TrendingSelectionRail";
import type { BuyerType, JwStoneCatalogItem, MarketplaceUrlState } from "./types";
import { buyerLabel } from "./BuyerJourney";

type BuyerWorkspaceProps = {
  state: MarketplaceUrlState & {
    buyer: BuyerType;
    color: NonNullable<MarketplaceUrlState["color"]>;
  };
  savedCount: number;
  isSaved: (id: string) => boolean;
  onChangeBuyer: () => void;
  onChangeColor: () => void;
  onUpdateFilters: (filters: Pick<MarketplaceUrlState, "material" | "finish" | "origin">) => void;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  catalog?: readonly JwStoneCatalogItem[];
};

const WORKSPACE_COPY: Record<BuyerType, { eyebrow: string; title: string; description: string }> = {
  fabricator: {
    eyebrow: "Fabricators",
    title: "Current Inventory",
    description:
      "Review named stone, confirmed finishes where listed, and source bundle counts, then ask JW Stone about current bundle matching and production timing.",
  },
  builder: {
    eyebrow: "Builders & Developers",
    title: "Current Inventory",
    description:
      "Share project volume, location, and timing so JW Stone can review material consistency, current supply, and delivery needs.",
  },
  designer: {
    eyebrow: "Architects & Designers",
    title: "JW Stone Picks",
    description:
      "Compare stone imagery, category, and confirmed finish details, then request current availability and specification support for a selected project.",
  },
  homeowner: {
    eyebrow: "Homeowners",
    title: "Current Inventory",
    description:
      "Start with a room, inspiration, or selected stone, then ask JW Stone to review current availability, order requirements, and the next selection step.",
  },
};

export function BuyerWorkspace({
  state,
  savedCount,
  isSaved,
  onChangeBuyer,
  onChangeColor,
  onUpdateFilters,
  onToggleSaved,
  onOpen,
  onAsk,
  catalog = JW_STONE_CATALOG,
}: BuyerWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const copy = WORKSPACE_COPY[state.buyer];
  const color = COLOR_DIRECTIONS.find((direction) => direction.id === state.color)!;

  const colorCatalog = useMemo(
    () => catalog.filter((stone) => stone.colorDirection === state.color),
    [catalog, state.color]
  );
  const materialOptions = useMemo(() => getMaterialFilterOptions(colorCatalog), [colorCatalog]);
  const finishOptions = useMemo(() => getFinishFilterOptions(colorCatalog), [colorCatalog]);
  const originOptions = useMemo(() => getOriginFilterOptions(colorCatalog), [colorCatalog]);

  const filtered = useMemo(() => {
    const matches = filterJwStoneCatalog(
      {
        color: state.color,
        material: state.material,
        finish: state.finish,
        origin: state.origin,
      },
      catalog
    );
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return matches;
    return matches.filter(
      (stone) =>
        !stone.anonymous &&
        Boolean(
          stone.displayName?.toLocaleLowerCase().includes(normalizedQuery) ||
          stone.materialLabel?.toLocaleLowerCase().includes(normalizedQuery) ||
          stone.finishes.some((finish) => finish.toLocaleLowerCase().includes(normalizedQuery))
        )
    );
  }, [catalog, query, state.color, state.finish, state.material, state.origin]);

  const namedFiltered = filtered.filter((stone) => !stone.anonymous);
  const anonymousFiltered = filtered.filter((stone) => stone.anonymous);

  useEffect(() => {
    setVisibleCount(12);
  }, [query, state.buyer, state.color, state.finish, state.material, state.origin]);

  const visible = namedFiltered.slice(0, visibleCount);
  const gridClass =
    state.buyer === "fabricator"
      ? "sm:grid-cols-2 xl:grid-cols-3"
      : state.buyer === "builder"
        ? "md:grid-cols-2"
        : state.buyer === "designer"
          ? "md:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <main
      data-testid={`${state.buyer}-workspace`}
      className="min-h-screen bg-stone-100 text-stone-950"
    >
      <section className="bg-stone-950 px-5 py-14 text-stone-50 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">
            <button type="button" onClick={onChangeBuyer} className="hover:text-white">
              {buyerLabel(state.buyer)}
            </button>
            <span aria-hidden="true">/</span>
            <button type="button" onClick={onChangeColor} className="hover:text-white">
              {color.label}
            </button>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-200">
                {copy.eyebrow}
              </p>
              <h1 className="mt-4 max-w-4xl font-editorial text-5xl leading-none sm:text-6xl lg:text-7xl">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
                {copy.description}
              </p>
            </div>
            <div className="grid grid-cols-2 border border-white/15 text-center">
              <div className="min-w-28 border-r border-white/15 p-4">
                <strong className="block font-editorial text-3xl font-normal">
                  {filtered.length}
                </strong>
                <span className="text-xs uppercase tracking-wider text-stone-400">Matches</span>
              </div>
              <div className="min-w-28 p-4">
                <strong className="block font-editorial text-3xl font-normal">{savedCount}</strong>
                <span className="text-xs uppercase tracking-wider text-stone-400">Saved</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Stone filters"
        className="border-b border-stone-300 bg-white px-5 py-5 sm:px-8 lg:px-12"
      >
        <div
          className={`mx-auto grid max-w-7xl gap-3 md:grid-cols-2 ${
            finishOptions.length && originOptions.length
              ? "xl:grid-cols-4"
              : finishOptions.length || originOptions.length
                ? "xl:grid-cols-3"
                : "xl:grid-cols-2"
          }`}
        >
          <label className="relative block">
            <span className="sr-only">Search named stones</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search named stones"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search named stones"
              className="min-h-12 w-full border border-stone-300 bg-stone-50 pl-10 pr-3 text-sm outline-none focus:border-stone-800"
            />
          </label>

          <label className="relative block">
            <span className="sr-only">Filter by material</span>
            <select
              aria-label="Filter by material"
              value={state.material || ""}
              onChange={(event) =>
                onUpdateFilters({
                  material: event.target.value || null,
                  finish: state.finish,
                  origin: state.origin,
                })
              }
              className="min-h-12 w-full appearance-none border border-stone-300 bg-stone-50 px-3 pr-9 text-sm text-stone-950 [color-scheme:light] outline-none focus:border-stone-800"
            >
              <option value="">All materials</option>
              {materialOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
            <SlidersHorizontal
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
              aria-hidden="true"
            />
          </label>

          {finishOptions.length ? (
            <label className="relative block">
              <span className="sr-only">Filter by finish</span>
              <select
                aria-label="Filter by finish"
                value={state.finish || ""}
                onChange={(event) =>
                  onUpdateFilters({
                    material: state.material,
                    finish: event.target.value || null,
                    origin: state.origin,
                  })
                }
                className="min-h-12 w-full appearance-none border border-stone-300 bg-stone-50 px-3 pr-9 text-sm text-stone-950 [color-scheme:light] outline-none focus:border-stone-800"
              >
                <option value="">All finishes</option>
                {finishOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              <SlidersHorizontal
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
                aria-hidden="true"
              />
            </label>
          ) : null}

          {originOptions.length ? (
            <label className="relative block">
              <span className="sr-only">Filter by verified country of origin</span>
              <select
                aria-label="Filter by verified country of origin"
                value={state.origin || ""}
                onChange={(event) =>
                  onUpdateFilters({
                    material: state.material,
                    finish: state.finish,
                    origin: event.target.value || null,
                  })
                }
                className="min-h-12 w-full appearance-none border border-stone-300 bg-stone-50 px-3 pr-9 text-sm text-stone-950 [color-scheme:light] outline-none focus:border-stone-800"
              >
                <option value="">All verified origins</option>
                {originOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              <SlidersHorizontal
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
                aria-hidden="true"
              />
            </label>
          ) : null}
        </div>
      </section>

      <section
        aria-label={`${copy.eyebrow} results`}
        className="px-5 py-12 sm:px-8 lg:px-12 lg:py-16"
      >
        <div className="mx-auto max-w-7xl">
          {state.buyer === "fabricator" ? (
            <div className="mb-8 grid gap-4 border-y border-stone-300 py-5 text-sm text-stone-600 sm:grid-cols-3">
              <p>Finish appears only where the supplied image titles state it.</p>
              <p>Source bundle counts are shown as recorded evidence.</p>
              <p>Open every card for the complete supplied gallery.</p>
            </div>
          ) : null}
          {state.buyer === "builder" ? (
            <div className="mb-8 flex flex-col gap-2 border-l-4 border-stone-950 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-editorial text-3xl">Project selection</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Save named stones to keep this project review together in your browser.
                </p>
              </div>
              <span className="text-sm font-bold">{savedCount} saved</span>
            </div>
          ) : null}
          {state.buyer === "designer" ? (
            <div className="mb-10 flex items-end justify-between border-b border-stone-300 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                  Visual edit
                </p>
                <h2 className="mt-2 font-editorial text-4xl">{color.label}</h2>
              </div>
              <span className="hidden text-sm text-stone-500 sm:block">
                {filtered.length} supplied selections
              </span>
            </div>
          ) : null}
          {state.buyer === "homeowner" ? (
            <div className="mb-8 max-w-2xl">
              <h2 className="font-editorial text-4xl">
                Your {color.label.toLowerCase()} shortlist
              </h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Open the photographs, notice what you return to, and save named stones as you go.
              </p>
            </div>
          ) : null}

          {visible.length ? (
            <ul className={`grid gap-6 lg:gap-8 ${gridClass}`}>
              {visible.map((stone, index) => (
                <li
                  key={stone.id}
                  className={
                    state.buyer === "designer" && index % 7 === 0 ? "lg:col-span-2" : undefined
                  }
                >
                  <StoneCard
                    stone={stone}
                    buyer={state.buyer}
                    saved={isSaved(stone.id)}
                    onToggleSaved={onToggleSaved}
                    onOpen={onOpen}
                    onAsk={onAsk}
                  />
                </li>
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <div className="border border-stone-300 bg-white px-6 py-16 text-center">
              <h2 className="font-editorial text-3xl">No matching supplied selections</h2>
              <p className="mt-3 text-sm text-stone-600">
                Clear the search or filters, or choose another color direction.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  onUpdateFilters({ material: null, finish: null, origin: null });
                }}
                className="mt-6 min-h-11 border border-stone-500 px-5 text-sm font-semibold hover:bg-stone-100"
              >
                Reset filters
              </button>
            </div>
          ) : null}

          {visibleCount < namedFiltered.length ? (
            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 12)}
                className="min-h-12 border border-stone-500 bg-white px-8 font-bold hover:bg-stone-950 hover:text-white"
              >
                Show more stones
              </button>
            </div>
          ) : null}

          <TrendingSelectionRail items={anonymousFiltered} onOpen={onOpen} />
        </div>
      </section>
    </main>
  );
}
