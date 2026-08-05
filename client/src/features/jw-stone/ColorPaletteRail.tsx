import { getCatalogItemById } from "./catalog";
import { jw } from "./brand";
import type { ColorDirectionId } from "./types";

/**
 * Owner luxury layout palette labels — same underlying colorDirection ids,
 * display names only (no inventory recategorization).
 */
export const PALETTE_RAIL_DIRECTIONS = [
  {
    id: "warm-earthy" as const,
    label: "Warm neutrals",
    coverStoneId: "arizona-gold",
  },
  {
    id: "soft-light" as const,
    label: "White & light",
    coverStoneId: "avalanche",
  },
  {
    id: "bold-expressive" as const,
    label: "Green",
    coverStoneId: "amazonic-green",
  },
  {
    id: "cool-serene" as const,
    label: "Blue",
    coverStoneId: "blue-dunes",
  },
  {
    id: "deep-dramatic" as const,
    label: "Dramatic darks",
    coverStoneId: "black-pearl",
  },
] as const;

function coverFor(stoneId: string): string | null {
  return getCatalogItemById(stoneId)?.images[0] ?? null;
}

type ColorPaletteRailProps = {
  active: ColorDirectionId | null;
  onSelect: (id: ColorDirectionId | null) => void;
};

export function ColorPaletteRail({ active, onSelect }: ColorPaletteRailProps) {
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
          className="mt-5 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-6 sm:gap-4 [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Color palettes"
        >
          {PALETTE_RAIL_DIRECTIONS.map((direction) => {
            const isActive = active === direction.id;
            const cover = coverFor(direction.coverStoneId);
            return (
              <button
                key={direction.id}
                type="button"
                role="listitem"
                data-testid={`jw-palette-${direction.id}`}
                aria-pressed={isActive}
                onClick={() => onSelect(isActive ? null : direction.id)}
                className="group relative h-36 w-[9.5rem] shrink-0 overflow-hidden text-left sm:h-44 sm:w-44"
              >
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="absolute inset-0 bg-[var(--jw-surface)]" aria-hidden="true" />
                )}
                <span
                  className={`absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent ${
                    isActive ? "ring-2 ring-inset ring-[var(--jw-accent)]" : ""
                  }`}
                  aria-hidden="true"
                />
                <span className="absolute inset-x-0 bottom-0 px-3 pb-3 font-editorial text-lg leading-tight text-white sm:text-xl">
                  {direction.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
