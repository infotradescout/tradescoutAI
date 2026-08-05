import { filterJwStoneCatalog, JW_STONE_CATALOG } from "./catalog";
import { jw } from "./brand";
import type { ColorDirectionId, JwStoneCatalogItem, MarketplaceUrlState } from "./types";
import type { StoneColorId } from "./stoneColors";

/**
 * Compact shopper color families → existing aesthetic / color URL filters.
 * Labels are shopper-facing; filter keys must match catalog classifications.
 * Families with zero matching inventory are omitted at render time.
 */
export const COLOR_SWATCH_OPTIONS = [
  {
    id: "all",
    label: "All",
    aesthetic: null,
    color: null,
    swatch: "linear-gradient(135deg, #f4f1ea 0%, #d9d2c5 48%, #b8ae9c 100%)",
  },
  {
    id: "white-light",
    label: "White & light",
    aesthetic: "soft-light" as const,
    color: null,
    swatch: "linear-gradient(135deg, #ffffff 0%, #f3efe6 55%, #e4ddd0 100%)",
  },
  {
    id: "warm-neutrals",
    label: "Warm neutrals",
    aesthetic: "warm-earthy" as const,
    color: null,
    swatch: "linear-gradient(135deg, #e8d3b0 0%, #c9a66b 52%, #9c7a45 100%)",
  },
  {
    id: "gray-silver",
    label: "Gray & silver",
    aesthetic: null,
    color: "gray" as const,
    swatch: "linear-gradient(135deg, #eceff2 0%, #a8b0b8 50%, #6d757e 100%)",
  },
  {
    id: "black-dramatic",
    label: "Black & dramatic",
    aesthetic: "deep-dramatic" as const,
    color: null,
    swatch: "linear-gradient(135deg, #3a3532 0%, #1c1a18 55%, #0d0c0b 100%)",
  },
  {
    id: "brown-earth",
    label: "Brown & earth",
    aesthetic: null,
    color: "brown" as const,
    swatch: "linear-gradient(135deg, #c4a484 0%, #8b5e3c 52%, #5c3a22 100%)",
  },
  {
    id: "green",
    label: "Green",
    aesthetic: null,
    color: "green" as const,
    swatch: "linear-gradient(135deg, #c5d4a8 0%, #6f8f4e 52%, #3f5a2c 100%)",
  },
  {
    id: "blue",
    label: "Blue",
    aesthetic: null,
    color: "blue" as const,
    swatch: "linear-gradient(135deg, #c9d7e8 0%, #6f8fad 52%, #3a5570 100%)",
  },
  {
    id: "red-burgundy",
    label: "Red & burgundy",
    aesthetic: null,
    color: "rose" as const,
    swatch: "linear-gradient(135deg, #d7a8a8 0%, #8f4a55 52%, #5a2430 100%)",
  },
  {
    id: "multicolor",
    label: "Multicolor",
    aesthetic: "bold-expressive" as const,
    color: null,
    swatch:
      "linear-gradient(135deg, #f0e6d8 0%, #c9a66b 28%, #6f8fad 55%, #6f8f4e 78%, #5a2430 100%)",
  },
] as const satisfies readonly ColorSwatchOptionDef[];

type ColorSwatchOptionDef = {
  id: string;
  label: string;
  aesthetic: ColorDirectionId | null;
  color: StoneColorId | null;
  swatch: string;
};

export type ColorSwatchSelection = {
  aesthetic: ColorDirectionId | null;
  color: string | null;
};

/** @deprecated Prefer COLOR_SWATCH_OPTIONS — kept for any residual imports. */
export const PALETTE_RAIL_DIRECTIONS = COLOR_SWATCH_OPTIONS.filter(
  (option) => option.aesthetic
).map((option) => ({
  id: option.aesthetic!,
  label: option.label,
  coverStoneId: "",
}));

export function countForColorSwatch(
  option: Pick<ColorSwatchOptionDef, "aesthetic" | "color" | "id">,
  catalog: readonly JwStoneCatalogItem[],
  baseFilters: Pick<MarketplaceUrlState, "material" | "origin"> = {
    material: null,
    origin: null,
  }
): number {
  if (option.id === "all") {
    return filterJwStoneCatalog(
      { material: baseFilters.material, origin: baseFilters.origin },
      catalog
    ).length;
  }
  return filterJwStoneCatalog(
    {
      aesthetic: option.aesthetic,
      color: option.color,
      material: baseFilters.material,
      origin: baseFilters.origin,
    },
    catalog
  ).length;
}

export function isColorSwatchActive(
  option: Pick<ColorSwatchOptionDef, "id" | "aesthetic" | "color">,
  state: ColorSwatchSelection
): boolean {
  if (option.id === "all") return !state.aesthetic && !state.color;
  if (option.aesthetic) return state.aesthetic === option.aesthetic && !state.color;
  if (option.color) return state.color === option.color && !state.aesthetic;
  return false;
}

export function selectionForColorSwatch(
  option: Pick<ColorSwatchOptionDef, "id" | "aesthetic" | "color">,
  currentlyActive: boolean
): ColorSwatchSelection {
  if (currentlyActive || option.id === "all") {
    return { aesthetic: null, color: null };
  }
  return { aesthetic: option.aesthetic, color: option.color };
}

type ColorPaletteRailProps = {
  aesthetic: ColorDirectionId | null;
  color: string | null;
  material?: string | null;
  origin?: string | null;
  onSelect: (next: ColorSwatchSelection) => void;
  catalog?: readonly JwStoneCatalogItem[];
};

export function ColorPaletteRail({
  aesthetic,
  color,
  material = null,
  origin = null,
  onSelect,
  catalog = JW_STONE_CATALOG,
}: ColorPaletteRailProps) {
  const base = { material, origin };
  const options = COLOR_SWATCH_OPTIONS.map((option) => ({
    ...option,
    count: countForColorSwatch(option, catalog, base),
  })).filter((option) => option.id === "all" || option.count > 0);

  const activeState = { aesthetic, color };

  return (
    <section
      id="jw-palette-rail"
      data-testid="jw-palette-rail"
      aria-labelledby="jw-palette-heading"
      className={`bg-[var(--jw-bg)] px-5 py-9 sm:px-9 sm:py-11 lg:px-12 ${jw.scrollTarget}`}
    >
      <div className="mx-auto max-w-[1600px]">
        <h2
          id="jw-palette-heading"
          className="font-editorial text-2xl leading-tight text-[var(--jw-ink)] sm:text-3xl"
        >
          Browse by color
        </h2>
        <p className={`mt-2 max-w-xl text-sm leading-6 ${jw.muted}`}>
          Start with a palette — or browse by material below.
        </p>

        <div
          className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3"
          role="list"
          aria-label="Color palettes"
        >
          {options.map((option) => {
            const isActive = isColorSwatchActive(option, activeState);
            return (
              <button
                key={option.id}
                type="button"
                role="listitem"
                data-testid={`jw-palette-${option.id}`}
                aria-pressed={isActive}
                onClick={() => onSelect(selectionForColorSwatch(option, isActive))}
                className={`flex min-h-[3.25rem] items-center gap-3 px-3 py-2.5 text-left transition-colors sm:min-h-[3.5rem] ${
                  isActive
                    ? "bg-[var(--jw-accent)] text-[var(--jw-on-accent)]"
                    : "bg-[var(--jw-surface)] text-[var(--jw-ink)] hover:bg-[var(--jw-surface)]/80"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-9 w-9 shrink-0 border sm:h-10 sm:w-10 ${
                    isActive ? "border-[var(--jw-on-accent)]/35" : "border-[var(--jw-border)]"
                  }`}
                  style={{ background: option.swatch }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight sm:text-[0.95rem]">
                    {option.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs leading-none ${
                      isActive ? "text-[var(--jw-on-accent)]/80" : jw.muted
                    }`}
                  >
                    {option.count} {option.count === 1 ? "selection" : "selections"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
