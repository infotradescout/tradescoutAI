import {
  JW_STONE_CATALOG,
  JW_STONE_MATERIAL_SECTION_ORDER,
  getCatalogItemById,
  groupNamedCatalogByMaterial,
} from "./catalog";
import { jw } from "./brand";
import type { JwStoneCatalogItem } from "./types";

/**
 * Preferred cover stones for material tiles — real catalog ids only.
 * Falls back to the first named stone in that material when missing.
 */
export const MATERIAL_RAIL_COVER_STONE_IDS: Readonly<Record<string, string>> = {
  granite: "blue-dunes",
  marble: "aspen-white",
  quartzite: "beverly-blue",
  quartz: "aj-quartz",
  onyx: "honey-onyx",
  soapstone: "soapstone",
  basalt: "matrix-basalt",
};

export type MaterialRailItem = Readonly<{
  materialId: string;
  materialLabel: string;
  count: number;
  coverSrc: string | null;
}>;

export function getMaterialRailItems(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): MaterialRailItem[] {
  const sections = groupNamedCatalogByMaterial(catalog).filter((section) => section.filterable);
  const order = JW_STONE_MATERIAL_SECTION_ORDER as readonly string[];

  return [...sections]
    .sort((a, b) => {
      const ai = order.indexOf(a.materialId);
      const bi = order.indexOf(b.materialId);
      const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a.materialLabel.localeCompare(b.materialLabel);
    })
    .map((section) => {
      const preferredId = MATERIAL_RAIL_COVER_STONE_IDS[section.materialId];
      const preferred = preferredId ? getCatalogItemById(preferredId) : null;
      const coverStone =
        preferred && preferred.materialId === section.materialId
          ? preferred
          : (section.stones.find((stone) => stone.images[0]) ?? section.stones[0] ?? null);
      return {
        materialId: section.materialId,
        materialLabel: section.materialLabel,
        count: section.stones.length,
        coverSrc: coverStone?.images[0] ?? null,
      };
    });
}

type MaterialCategoryRailProps = {
  active: string | null;
  onSelect: (materialId: string | null) => void;
  catalog?: readonly JwStoneCatalogItem[];
};

export function MaterialCategoryRail({
  active,
  onSelect,
  catalog = JW_STONE_CATALOG,
}: MaterialCategoryRailProps) {
  const items = getMaterialRailItems(catalog);
  if (!items.length) return null;

  return (
    <section
      id="jw-material-rail"
      data-testid="jw-material-rail"
      aria-labelledby="jw-material-heading"
      className={`bg-[var(--jw-bg)] px-5 py-9 sm:px-9 sm:py-11 lg:px-12 ${jw.scrollTarget}`}
    >
      <div className="mx-auto max-w-[1600px]">
        <h2
          id="jw-material-heading"
          className="font-editorial text-2xl leading-tight text-[var(--jw-ink)] sm:text-3xl"
        >
          Browse by material
        </h2>
        <p className={`mt-2 max-w-xl text-sm leading-6 ${jw.muted}`}>
          Granite, marble, quartzite, and more — tap a material to open that part of the collection.
        </p>

        <div
          className="mt-5 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-6 sm:gap-4 [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Material categories"
        >
          {items.map((item) => {
            const isActive = active === item.materialId;
            return (
              <button
                key={item.materialId}
                type="button"
                role="listitem"
                data-testid={`jw-material-${item.materialId}`}
                aria-pressed={isActive}
                onClick={() => onSelect(isActive ? null : item.materialId)}
                className="group relative h-36 w-[9.5rem] shrink-0 overflow-hidden bg-[var(--jw-dark)] text-left sm:h-44 sm:w-44"
              >
                {item.coverSrc ? (
                  <img
                    src={item.coverSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
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
                <span className="absolute inset-x-0 bottom-0 px-3 pb-3">
                  <span className="block font-editorial text-lg leading-tight text-white sm:text-xl">
                    {item.materialLabel}
                  </span>
                  <span className="mt-0.5 block text-xs text-white/80">
                    {item.count} {item.count === 1 ? "selection" : "selections"}
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
