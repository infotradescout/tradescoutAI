import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  JW_STONE_CATALOG,
  filterJwStoneCatalog,
  getColorFilterOptions,
  getFinishFilterOptions,
  getMaterialFilterOptions,
} from "./catalog";
import { jw } from "./brand";
import { isHandOnlyStone } from "./coverImages";
import { InventoryCollageBackground } from "./InventoryCollageBackground";
import { JwCollapsibleSection } from "./JwCollapsibleSection";
import { confirmedSlabCount } from "./stoneFacts";
import { StoneCard } from "./StoneCard";
import type { JwStoneCatalogItem, MarketplaceUrlState } from "./types";

type CollectionFilters = Pick<MarketplaceUrlState, "aesthetic" | "color" | "material" | "origin">;

type AvailabilityFilter = "any" | "with-count";

type StoneCollectionProps = {
  state: MarketplaceUrlState;
  isSaved: (id: string) => boolean;
  onUpdateFilters: (filters: CollectionFilters) => void;
  /** Called when the Material Library opens — parent clears browse-rail URL tags. */
  onEnterFullInventory?: () => void;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  /** Empty-search source request — opens Express without inventing a stone name. */
  onSourceRequest?: () => void;
  catalog?: readonly JwStoneCatalogItem[];
};

type ActiveChip = Readonly<{
  key: string;
  label: string;
  onClear: () => void;
}>;

export function StoneCollection({
  state,
  isSaved,
  onUpdateFilters,
  onEnterFullInventory,
  onToggleSaved,
  onOpen,
  onAsk,
  onSourceRequest,
  catalog = JW_STONE_CATALOG,
}: StoneCollectionProps) {
  const [query, setQuery] = useState("");
  /** Finish stays local — never serialized to ?finish= (legacy param ignored). */
  const [finish, setFinish] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityFilter>("any");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const [draftMaterial, setDraftMaterial] = useState<string | null>(null);
  const [draftFinish, setDraftFinish] = useState<string | null>(null);
  const [draftAvailability, setDraftAvailability] = useState<AvailabilityFilter>("any");

  const colorOptions = useMemo(() => getColorFilterOptions(catalog), [catalog]);
  const materialOptions = useMemo(() => getMaterialFilterOptions(catalog), [catalog]);
  const finishOptions = useMemo(() => getFinishFilterOptions(catalog), [catalog]);

  const namedCatalog = useMemo(() => {
    return catalog
      .filter((stone) => !stone.anonymous)
      .slice()
      .sort((a, b) => Number(isHandOnlyStone(a.images)) - Number(isHandOnlyStone(b.images)));
  }, [catalog]);

  const filtered = useMemo(() => {
    const base = filterJwStoneCatalog(
      {
        aesthetic: state.aesthetic,
        color: state.color,
        material: state.material,
        finish,
        origin: state.origin,
      },
      namedCatalog
    ).filter((stone) => (availability === "with-count" ? confirmedSlabCount(stone) != null : true));

    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return base;
    return base.filter((stone) =>
      Boolean(
        stone.displayName?.toLocaleLowerCase().includes(normalizedQuery) ||
        stone.materialLabel?.toLocaleLowerCase().includes(normalizedQuery) ||
        stone.finishes.some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
      )
    );
  }, [
    availability,
    finish,
    namedCatalog,
    query,
    state.aesthetic,
    state.color,
    state.material,
    state.origin,
  ]);

  const update = (next: Partial<CollectionFilters>) =>
    onUpdateFilters({
      aesthetic: next.aesthetic === undefined ? state.aesthetic : next.aesthetic,
      color: next.color === undefined ? state.color : next.color,
      material: next.material === undefined ? state.material : next.material,
      origin: next.origin === undefined ? state.origin : next.origin,
    });

  const openFilters = () => {
    setDraftColor(state.color);
    setDraftMaterial(state.material);
    setDraftFinish(finish);
    setDraftAvailability(availability);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setFinish(draftFinish);
    setAvailability(draftAvailability);
    update({
      color: draftColor,
      material: draftMaterial,
    });
    setFiltersOpen(false);
  };

  const clearAll = () => {
    setQuery("");
    setFinish(null);
    setAvailability("any");
    setDraftColor(null);
    setDraftMaterial(null);
    setDraftFinish(null);
    setDraftAvailability("any");
    update({
      aesthetic: null,
      color: null,
      material: null,
      origin: null,
    });
    setFiltersOpen(false);
  };

  const clearSheetDraft = () => {
    setDraftColor(null);
    setDraftMaterial(null);
    setDraftFinish(null);
    setDraftAvailability("any");
  };

  const chips = useMemo<ActiveChip[]>(() => {
    const next: ActiveChip[] = [];
    if (state.aesthetic) {
      next.push({
        key: "aesthetic",
        label: aestheticChipLabel(state.aesthetic),
        onClear: () => update({ aesthetic: null }),
      });
    }
    if (state.color) {
      const label =
        colorOptions.find((option) => option.value === state.color)?.label || state.color;
      next.push({
        key: "color",
        label,
        onClear: () => update({ color: null }),
      });
    }
    if (state.material) {
      const label =
        materialOptions.find((option) => option.value === state.material)?.label || state.material;
      next.push({
        key: "material",
        label,
        onClear: () => update({ material: null }),
      });
    }
    if (finish) {
      const label = finishOptions.find((option) => option.value === finish)?.label || finish;
      next.push({
        key: "finish",
        label,
        onClear: () => setFinish(null),
      });
    }
    if (availability === "with-count") {
      next.push({
        key: "availability",
        label: "Source count recorded",
        onClear: () => setAvailability("any"),
      });
    }
    return next;
  }, [
    availability,
    colorOptions,
    finish,
    finishOptions,
    materialOptions,
    state.aesthetic,
    state.color,
    state.material,
  ]);

  const hasRefinements = Boolean(query.trim() || chips.length);
  const draftResultCount = useMemo(() => {
    return filterJwStoneCatalog(
      {
        aesthetic: state.aesthetic,
        color: draftColor,
        material: draftMaterial,
        finish: draftFinish,
        origin: state.origin,
      },
      namedCatalog
    ).filter((stone) =>
      draftAvailability === "with-count" ? confirmedSlabCount(stone) != null : true
    ).length;
  }, [
    draftAvailability,
    draftColor,
    draftFinish,
    draftMaterial,
    namedCatalog,
    state.aesthetic,
    state.origin,
  ]);

  return (
    <>
      <JwCollapsibleSection
        id="material-library"
        testId="jw-inventory"
        headingId="jw-inventory-heading"
        title="Material Library"
        onExpandedChange={(expanded) => {
          if (!expanded) return;
          // Local sheet-only refinements reset with URL tags so inventory starts clean.
          setQuery("");
          setFinish(null);
          setAvailability("any");
          setDraftColor(null);
          setDraftMaterial(null);
          setDraftFinish(null);
          setDraftAvailability("any");
          setFiltersOpen(false);
          onEnterFullInventory?.();
        }}
        background={<InventoryCollageBackground />}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className={`text-sm ${jw.muted}`}>
            {`${filtered.length} ${filtered.length === 1 ? "selection" : "selections"}${
              hasRefinements ? " matching refinements" : " in the collection"
            }`}
          </p>
          <button
            type="button"
            data-testid="jw-filters-sheet-open"
            aria-expanded={filtersOpen}
            onClick={openFilters}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 px-3.5 text-sm font-semibold ${
              chips.length
                ? "bg-[var(--jw-accent)] text-[var(--jw-on-accent)]"
                : `text-[var(--jw-ink)] ${jw.ghostOnLight}`
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filter
          </button>
        </div>

        <label className="relative mt-4 block w-full min-w-0">
          <span className="sr-only">Search the collection</span>
          <Search
            className={`pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 ${jw.muted}`}
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search the collection"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the collection"
            className="min-h-12 w-full border-0 border-b border-[var(--jw-border)] bg-transparent pl-7 pr-3 text-sm text-[var(--jw-ink)] outline-none [color-scheme:light] placeholder:text-[var(--jw-muted)] focus:border-[var(--jw-accent)]"
          />
        </label>

        {chips.length ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex min-h-9 items-center gap-1.5 bg-[var(--jw-accent)]/20 px-2.5 text-xs font-medium text-[var(--jw-ink)]"
                >
                  {chip.label}
                  <X className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">Clear {chip.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div
          aria-label="Stone inventory"
          data-testid="jw-inventory-grid"
          className="mt-6 pb-8 sm:pb-12 lg:pb-16"
        >
          {filtered.length ? (
            <ul className="flex flex-col gap-8 sm:gap-10">
              {filtered.map((stone) => (
                <li key={stone.id} className="min-w-0">
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
          ) : (
            <div className="py-14 text-center">
              <h3 className="font-editorial text-3xl text-[var(--jw-ink)]">No matching stones</h3>
              <p className={`mt-3 text-sm ${jw.muted}`}>
                Clear the search or refinements
                {onSourceRequest && query.trim()
                  ? ", or ask JW Stone to source what you need."
                  : "."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={clearAll}
                  className={`min-h-12 px-5 text-sm ${jw.ghostOnLight}`}
                >
                  Reset refinements
                </button>
                {onSourceRequest && query.trim() ? (
                  <button
                    type="button"
                    data-testid="jw-source-request"
                    onClick={onSourceRequest}
                    className={`min-h-12 px-5 text-sm ${jw.accentCta}`}
                  >
                    Request this stone
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </JwCollapsibleSection>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center"
          role="presentation"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="jw-filters-sheet-title"
            data-testid="jw-filters-sheet"
            className="w-full max-w-md bg-[var(--jw-surface)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:pb-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3
                id="jw-filters-sheet-title"
                className="font-editorial text-xl text-[var(--jw-ink)]"
              >
                Filter
              </h3>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--jw-ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3">
              <FilterSelect
                label="Color"
                value={draftColor || ""}
                onChange={(value) => setDraftColor(value || null)}
              >
                <option value="">Color</option>
                {colorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Material"
                value={draftMaterial || ""}
                onChange={(value) => setDraftMaterial(value || null)}
              >
                <option value="">Material</option>
                {materialOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Finish"
                value={draftFinish || ""}
                onChange={(value) => setDraftFinish(value || null)}
              >
                <option value="">Finish</option>
                {finishOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Source evidence"
                value={draftAvailability}
                onChange={(value) =>
                  setDraftAvailability(value === "with-count" ? "with-count" : "any")
                }
              >
                <option value="any">Source evidence</option>
                <option value="with-count">Source count recorded</option>
              </FilterSelect>

              <button
                type="button"
                onClick={clearSheetDraft}
                className={`min-h-12 w-full px-4 text-sm ${jw.ghostOnLight}`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className={`min-h-12 w-full px-4 text-sm ${jw.accentCta}`}
              >
                Show {draftResultCount} results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function aestheticChipLabel(id: string): string {
  switch (id) {
    case "warm-earthy":
      return "Warm neutrals";
    case "soft-light":
      return "White & light";
    case "bold-expressive":
      return "Multicolor";
    case "cool-serene":
      return "Cool & serene";
    case "deep-dramatic":
      return "Black";
    default:
      return id;
  }
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
    <label className="relative block w-full">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-12 w-full appearance-none px-3 pr-8 text-sm [color-scheme:light] ${jw.field}`}
      >
        {children}
      </select>
    </label>
  );
}
