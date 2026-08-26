import { useEffect, useMemo } from "react";
import { jw } from "./brand";
import {
  JW_STONE_CATALOG,
  JW_STONE_MATERIAL_SECTION_ORDER,
  filterJwStoneCatalog,
  getCatalogItemById,
  groupNamedCatalogByMaterial,
} from "./catalog";
import { JwCollapsibleSection } from "./JwCollapsibleSection";
import { isHandOnlyStone } from "./coverImages";
import { MaterialCollageBackground } from "./MaterialCollageBackground";
import { MaterialStonePager } from "./MaterialStonePager";
import type { ColorDirectionId, JwStoneCatalogItem } from "./types";

/**
 * Preferred cover stones for material tiles — real catalog ids only.
 * Used only as a fallback when a dedicated face-cover asset is missing.
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

/**
 * Face-only material rail covers (no hands, clamps, yard chrome).
 * Built by tmp/build-material-covers.mjs into material-covers/.
 */
export const MATERIAL_RAIL_COVER_IMAGES: Readonly<Record<string, string>> = Object.freeze({
  granite: "/images/businesses/jw-stone/material-covers/granite.webp",
  marble: "/images/businesses/jw-stone/material-covers/marble.webp",
  quartzite: "/images/businesses/jw-stone/material-covers/quartzite.webp",
  quartz: "/images/businesses/jw-stone/material-covers/quartz.webp",
  onyx: "/images/businesses/jw-stone/material-covers/onyx.webp",
  soapstone: "/images/businesses/jw-stone/material-covers/soapstone.webp",
  basalt: "/images/businesses/jw-stone/material-covers/basalt.webp",
});

export type MaterialRailItem = Readonly<{
  materialId: string;
  materialLabel: string;
  count: number;
  coverSrc: string | null;
  stones: readonly JwStoneCatalogItem[];
}>;

export function getMaterialRailItems(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG,
  refinements: { aesthetic?: ColorDirectionId | null; color?: string | null } = {}
): MaterialRailItem[] {
  // Always list every filterable material from the full catalog. Optional color /
  // aesthetic refinements scope stones inside a material — they must never hide
  // categories (e.g. Onyx) from Browse by material.
  const sections = groupNamedCatalogByMaterial(catalog).filter((section) => section.filterable);
  const order = JW_STONE_MATERIAL_SECTION_ORDER as readonly string[];
  const aesthetic = refinements.aesthetic ?? null;
  const color = refinements.color ?? null;

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
      const stones = filterJwStoneCatalog(
        {
          material: section.materialId,
          aesthetic,
          color,
        },
        catalog
      )
        .slice()
        .sort((a, b) => Number(isHandOnlyStone(a.images)) - Number(isHandOnlyStone(b.images)));
      const coverPool = section.stones
        .slice()
        .sort((a, b) => Number(isHandOnlyStone(a.images)) - Number(isHandOnlyStone(b.images)));
      const coverStone =
        preferred &&
        preferred.materialId === section.materialId &&
        coverPool.some((stone) => stone.id === preferred.id)
          ? preferred
          : (coverPool.find((stone) => stone.images[0] && !isHandOnlyStone(stone.images)) ??
            coverPool.find((stone) => stone.images[0]) ??
            coverPool[0] ??
            null);
      const dedicatedCover = MATERIAL_RAIL_COVER_IMAGES[section.materialId] ?? null;
      return {
        materialId: section.materialId,
        materialLabel: section.materialLabel,
        // Tile stature always reflects full material inventory — never a color-empty 0.
        count: section.stones.length,
        coverSrc: dedicatedCover ?? coverStone?.images[0] ?? null,
        stones: Object.freeze(stones),
      };
    });
}

type MaterialCategoryRailProps = {
  /** Expanded material id inside this section — null means all material rows collapsed. */
  active: string | null;
  aesthetic?: ColorDirectionId | null;
  color?: string | null;
  onSelect: (materialId: string | null) => void;
  isSaved: (id: string) => boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  catalog?: readonly JwStoneCatalogItem[];
};

/**
 * Always collapsed on mount — shopper must open the band.
 * `/materials/:slug` or `?material=` may still select a category in URL state,
 * but must not auto-expand this section (same contract as Browse by color).
 * Selecting a material shows that material's stones immediately — no color pick gate.
 */
export function MaterialCategoryRail({
  active,
  aesthetic = null,
  color = null,
  onSelect,
  isSaved,
  onToggleSaved,
  onOpen,
  onAsk,
  catalog = JW_STONE_CATALOG,
}: MaterialCategoryRailProps) {
  const items = useMemo(
    () => getMaterialRailItems(catalog, { aesthetic, color }),
    [aesthetic, catalog, color]
  );
  const activeItem = active ? (items.find((item) => item.materialId === active) ?? null) : null;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      onSelect(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onSelect]);

  if (!items.length) return null;

  return (
    <JwCollapsibleSection
      id="jw-material-rail"
      testId="jw-material-rail"
      headingId="jw-material-heading"
      title="Browse by Material"
      defaultExpanded={false}
      background={<MaterialCollageBackground />}
    >
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7"
        role="list"
        aria-label="Material categories"
        data-testid="jw-material-stack"
      >
        {items.map((item) => {
          const expanded = active === item.materialId;
          const panelId = `jw-material-panel-${item.materialId}`;
          return (
            <li
              key={item.materialId}
              className="min-w-0"
              data-testid={`jw-material-section-${item.materialId}`}
              data-expanded={expanded ? "true" : "false"}
            >
              <button
                type="button"
                data-testid={`jw-material-${item.materialId}`}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => onSelect(expanded ? null : item.materialId)}
                className={`group relative block w-full overflow-hidden bg-[var(--jw-dark)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jw-accent)] ${
                  expanded
                    ? "ring-2 ring-[var(--jw-accent)] ring-offset-2 ring-offset-[var(--jw-bg)]"
                    : ""
                }`}
              >
                <span className="relative flex aspect-[4/3] min-h-[7rem] items-stretch sm:aspect-[5/4] lg:aspect-[4/3]">
                  {item.coverSrc ? (
                    <img
                      src={item.coverSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-[var(--jw-surface)]" aria-hidden="true" />
                  )}
                </span>
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-3 pt-12 sm:px-4 sm:pb-4"
                  aria-hidden="true"
                />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
                  <span>
                    <span className="block font-editorial text-xl leading-tight text-white sm:text-2xl">
                      {item.materialLabel}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/85 sm:text-sm">
                      {item.count} {item.count === 1 ? "selection" : "selections"}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {activeItem ? (
        <div
          id={`jw-material-panel-${activeItem.materialId}`}
          data-testid={`jw-material-stone-rail-${activeItem.materialId}`}
          className="mt-6 border-t border-[var(--jw-border)] pt-5 sm:mt-8 sm:pt-6"
        >
          {activeItem.stones.length ? (
            <MaterialStonePager
              materialLabel={activeItem.materialLabel}
              stones={activeItem.stones}
              isSaved={isSaved}
              onToggleSaved={onToggleSaved}
              onOpen={onOpen}
              onAsk={onAsk}
            />
          ) : (
            <p
              className={`text-sm leading-relaxed ${jw.muted}`}
              data-testid="jw-material-color-empty"
            >
              No {activeItem.materialLabel.toLowerCase()} selections match the active color filter.
              Clear color in Browse by Color, or pick another material.
            </p>
          )}
        </div>
      ) : null}
    </JwCollapsibleSection>
  );
}
