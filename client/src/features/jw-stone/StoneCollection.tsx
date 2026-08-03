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
import type { JwStoneCatalogItem, MarketplaceUrlState } from "./types";

type CollectionFilters = Pick<MarketplaceUrlState, "color" | "material" | "finish" | "origin">;

type StoneCollectionProps = {
  state: MarketplaceUrlState;
  savedCount: number;
  isSaved: (id: string) => boolean;
  onUpdateFilters: (filters: CollectionFilters) => void;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  catalog?: readonly JwStoneCatalogItem[];
};

const PAGE_SIZE = 24;

export function StoneCollection({
  state,
  savedCount,
  isSaved,
  onUpdateFilters,
  onToggleSaved,
  onOpen,
  onAsk,
  catalog = JW_STONE_CATALOG,
}: StoneCollectionProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const materialOptions = useMemo(() => getMaterialFilterOptions(catalog), [catalog]);
  const finishOptions = useMemo(() => getFinishFilterOptions(catalog), [catalog]);
  const originOptions = useMemo(() => getOriginFilterOptions(catalog), [catalog]);

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
  const visible = namedFiltered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, state.color, state.finish, state.material, state.origin]);

  const update = (next: Partial<CollectionFilters>) =>
    onUpdateFilters({
      color: next.color === undefined ? state.color : next.color,
      material: next.material === undefined ? state.material : next.material,
      finish: next.finish === undefined ? state.finish : next.finish,
      origin: next.origin === undefined ? state.origin : next.origin,
    });

  return (
    <main id="current-inventory" className="bg-stone-100 text-stone-950">
      <section className="border-t border-stone-300 px-5 pb-8 pt-12 sm:px-8 lg:px-12 lg:pb-10 lg:pt-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">JW Stone</p>
            <h2 className="mt-3 font-editorial text-5xl leading-none sm:text-6xl">
              Current Inventory
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Recorded source counts are source-file evidence, not live quantity or availability.
            </p>
          </div>
          <dl className="flex border border-stone-300 bg-white text-center">
            <div className="min-w-28 border-r border-stone-300 px-4 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Selections
              </dt>
              <dd className="mt-1 font-editorial text-3xl">{filtered.length}</dd>
            </div>
            <div className="min-w-24 px-4 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Saved
              </dt>
              <dd className="mt-1 font-editorial text-3xl">{savedCount}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        aria-label="Stone filters"
        className="border-y border-stone-300 bg-white px-5 py-4 sm:px-8 lg:px-12"
      >
        <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative block sm:col-span-2 lg:col-span-1">
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

          <FilterSelect
            label="Filter by color direction"
            value={state.color || ""}
            onChange={(value) => update({ color: (value || null) as MarketplaceUrlState["color"] })}
          >
            <option value="">All color directions</option>
            {COLOR_DIRECTIONS.map((direction) => {
              const count = catalog.filter((stone) => stone.colorDirection === direction.id).length;
              return (
                <option key={direction.id} value={direction.id}>
                  {direction.label} ({count})
                </option>
              );
            })}
          </FilterSelect>

          <FilterSelect
            label="Filter by material"
            value={state.material || ""}
            onChange={(value) => update({ material: value || null })}
          >
            <option value="">All materials</option>
            {materialOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Filter by finish"
            value={state.finish || ""}
            onChange={(value) => update({ finish: value || null })}
          >
            <option value="">All finishes</option>
            {finishOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </FilterSelect>

          {originOptions.length ? (
            <FilterSelect
              label="Filter by verified country of origin"
              value={state.origin || ""}
              onChange={(value) => update({ origin: value || null })}
            >
              <option value="">All verified origins</option>
              {originOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </FilterSelect>
          ) : null}
        </div>
      </section>

      <section aria-label="Current Inventory" className="px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto max-w-7xl">
          {visible.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 lg:gap-8">
              {visible.map((stone) => (
                <li key={stone.id}>
                  <StoneCard
                    stone={stone}
                    saved={isSaved(stone.id)}
                    onToggleSaved={onToggleSaved}
                    onOpen={onOpen}
                    onAsk={onAsk}
                  />
                </li>
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <div className="border border-stone-300 bg-white px-6 py-14 text-center">
              <h3 className="font-editorial text-3xl">No matching supplied selections</h3>
              <p className="mt-3 text-sm text-stone-600">Clear the search or refinements.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  onUpdateFilters({ color: null, material: null, finish: null, origin: null });
                }}
                className="mt-6 min-h-11 border border-stone-500 px-5 text-sm font-semibold hover:bg-stone-100"
              >
                Reset filters
              </button>
            </div>
          ) : null}

          {visibleCount < namedFiltered.length ? (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
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

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full appearance-none border border-stone-300 bg-stone-50 px-3 pr-9 text-sm text-stone-950 [color-scheme:light] outline-none focus:border-stone-800"
      >
        {children}
      </select>
      <SlidersHorizontal
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
        aria-hidden="true"
      />
    </label>
  );
}
