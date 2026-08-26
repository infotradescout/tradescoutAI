import { useMemo } from "react";
import { filterJwStoneCatalog, JW_STONE_CATALOG } from "./catalog";
import { jw } from "./brand";
import { ColorCollageBackground } from "./ColorCollageBackground";
import { isHandOnlyStone } from "./coverImages";
import { JwCollapsibleSection } from "./JwCollapsibleSection";
import { MaterialStonePager } from "./MaterialStonePager";
import { JW_STORY_BACKGROUNDS } from "./storyBackgrounds";
import type { ColorDirectionId, JwStoneCatalogItem, MarketplaceUrlState } from "./types";
import type { StoneColorId } from "./stoneColors";

const COLOR_FACE_VERSION = "face-5";

/**
 * Literal shopper colors → the matching catalog color URL filter.
 * The label, photographed face, count, and result set must all describe the
 * same color family. Editorial aesthetics live in a separate mood picker and
 * must never masquerade as colors in this picker.
 * The available named-inventory set always renders (no "All" chip).
 * Face cues are real stone photography (color-collage/), not flat paint chips.
 */
export const COLOR_SWATCH_OPTIONS = [
  {
    id: "white",
    label: "White",
    aesthetic: null,
    color: "white" as const,
    representativeStoneId: "alabama-white",
    faceSrc: "/images/businesses/jw-stone/color-collage/01-white.webp",
    faces: null,
  },
  {
    id: "beige",
    label: "Beige",
    aesthetic: null,
    color: "beige" as const,
    representativeStoneId: "calacatta-amala",
    faceSrc: "/images/businesses/jw-stone/color-collage/02-warm.webp",
    faces: null,
  },
  {
    id: "gray",
    label: "Gray",
    aesthetic: null,
    color: "gray" as const,
    representativeStoneId: "blue-dunes",
    faceSrc: "/images/businesses/jw-stone/color-collage/03-gray.webp",
    faces: null,
  },
  {
    id: "black",
    label: "Black",
    aesthetic: null,
    color: "black" as const,
    representativeStoneId: "preto-sao-gabriel",
    faceSrc: "/images/businesses/jw-stone/color-collage/04-black.webp",
    faces: null,
  },
  {
    id: "brown",
    label: "Brown",
    aesthetic: null,
    color: "brown" as const,
    representativeStoneId: "emperor-brown",
    faceSrc: "/images/businesses/jw-stone/color-collage/05-brown.webp",
    faces: null,
  },
  {
    id: "gold",
    label: "Gold",
    aesthetic: null,
    color: "gold" as const,
    representativeStoneId: "gold-macaubas",
    faceSrc: "/images/businesses/jw-stone/color-collage/09-gold.webp",
    faces: null,
  },
  {
    id: "green",
    label: "Green",
    aesthetic: null,
    color: "green" as const,
    representativeStoneId: "marbella-green",
    faceSrc: "/images/businesses/jw-stone/color-collage/06-green.webp",
    faces: null,
  },
  {
    id: "blue",
    label: "Blue",
    aesthetic: null,
    color: "blue" as const,
    representativeStoneId: "blue-dream",
    faceSrc: "/images/businesses/jw-stone/color-collage/07-blue.webp",
    faces: null,
  },
] as const satisfies readonly ColorSwatchOptionDef[];

/**
 * Editorial browse paths preserved separately from literal shopper colors.
 * These are moods, not color claims, so they intentionally use ?aesthetic=
 * and never appear inside COLOR_SWATCH_OPTIONS.
 */
export const MOOD_SWATCH_OPTIONS = [
  {
    id: "soft-light",
    label: "Soft & Light",
    aesthetic: "soft-light" as const,
    color: null,
    representativeStoneId: "alabama-white",
    faceSrc: "/images/businesses/jw-stone/color-collage/01-white.webp",
    faces: null,
  },
  {
    id: "warm-earthy",
    label: "Warm & Earthy",
    aesthetic: "warm-earthy" as const,
    color: null,
    representativeStoneId: "cristallo",
    faceSrc: "/images/businesses/jw-stone/color-collage/02-warm.webp",
    faces: null,
  },
  {
    id: "deep-dramatic",
    label: "Deep & Dramatic",
    aesthetic: "deep-dramatic" as const,
    color: null,
    representativeStoneId: "preto-sao-gabriel",
    faceSrc: "/images/businesses/jw-stone/color-collage/04-black.webp",
    faces: null,
  },
  {
    id: "bold-expressive",
    label: "Bold & Expressive",
    aesthetic: "bold-expressive" as const,
    color: null,
    representativeStoneId: "blue-goias",
    faceSrc: null,
    faces: [
      "/images/businesses/jw-stone/color-collage/07-blue.webp",
      "/images/businesses/jw-stone/color-collage/06-green.webp",
      "/images/businesses/jw-stone/color-collage/09-gold.webp",
      "/images/businesses/jw-stone/color-collage/02-warm.webp",
    ] as const,
  },
] as const satisfies readonly ColorSwatchOptionDef[];

type ColorSwatchOptionDef = {
  id: string;
  label: string;
  aesthetic: ColorDirectionId | null;
  color: StoneColorId | null;
  representativeStoneId: string;
  faceSrc: string | null;
  faces: readonly string[] | null;
};

export type ColorSwatchSelection = {
  aesthetic: ColorDirectionId | null;
  color: string | null;
};

/** @deprecated Prefer MOOD_SWATCH_OPTIONS — kept for residual imports. */
export const PALETTE_RAIL_DIRECTIONS = MOOD_SWATCH_OPTIONS.map((option) => ({
  id: option.aesthetic!,
  label: option.label,
  coverStoneId: option.representativeStoneId,
}));

export function countForColorSwatch(
  option: Pick<ColorSwatchOptionDef, "aesthetic" | "color">,
  catalog: readonly JwStoneCatalogItem[],
  baseFilters: Pick<MarketplaceUrlState, "material" | "origin"> = {
    material: null,
    origin: null,
  }
): number {
  return filterJwStoneCatalog(
    {
      aesthetic: option.aesthetic,
      color: option.color,
      material: baseFilters.material,
      origin: baseFilters.origin,
    },
    catalog.filter((stone) => !stone.anonymous)
  ).length;
}

export function isColorSwatchActive(
  option: Pick<ColorSwatchOptionDef, "aesthetic" | "color">,
  state: ColorSwatchSelection
): boolean {
  if (option.aesthetic) return state.aesthetic === option.aesthetic && !state.color;
  if (option.color) return state.color === option.color && !state.aesthetic;
  return false;
}

/** Re-clicking the active chip clears the color filter (no "All" chip). */
export function selectionForColorSwatch(
  option: Pick<ColorSwatchOptionDef, "aesthetic" | "color">,
  currentlyActive: boolean
): ColorSwatchSelection {
  if (currentlyActive) {
    return { aesthetic: null, color: null };
  }
  return { aesthetic: option.aesthetic, color: option.color };
}

function ColorFaceCue({
  faceSrc,
  faces,
  active,
}: {
  faceSrc: string | null;
  faces: readonly string[] | null;
  active: boolean;
}) {
  const stripFaces = faces?.length ? faces : faceSrc ? [faceSrc] : null;

  return (
    <span
      aria-hidden="true"
      className={`relative block aspect-[3/4] w-full overflow-hidden bg-[var(--jw-dark)] ${
        active ? "ring-1 ring-[var(--jw-ink)] ring-offset-2 ring-offset-[var(--jw-bg)]" : ""
      }`}
    >
      {stripFaces ? (
        <span className="absolute inset-0 flex">
          {stripFaces.map((src) => (
            <span key={src} className="relative min-w-0 flex-1 overflow-hidden">
              <img
                src={`${src}?v=${COLOR_FACE_VERSION}`}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
            </span>
          ))}
        </span>
      ) : (
        <span className="absolute inset-0 bg-[var(--jw-surface)]" />
      )}
    </span>
  );
}

type ColorSwatchChipRowProps = {
  aesthetic: ColorDirectionId | null;
  color: string | null;
  /** When set, chip counts are scoped to this material (material ∩ color). */
  material?: string | null;
  origin?: string | null;
  onSelect: (next: ColorSwatchSelection) => void;
  catalog?: readonly JwStoneCatalogItem[];
  /** Prefix for data-testid values (default: jw-palette). */
  testIdPrefix?: string;
  ariaLabel?: string;
};

/** Full color-direction chip grid for Browse by color. */
export function ColorSwatchChipRow({
  aesthetic,
  color,
  material = null,
  origin = null,
  onSelect,
  catalog = JW_STONE_CATALOG,
  testIdPrefix = "jw-palette",
  ariaLabel = "Color palettes",
}: ColorSwatchChipRowProps) {
  const base = { material, origin };
  const options = COLOR_SWATCH_OPTIONS.map((option) => ({
    ...option,
    count: countForColorSwatch(option, catalog, base),
  }));
  const activeState = { aesthetic, color };

  return (
    <div
      className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8"
      role="list"
      aria-label={ariaLabel}
      data-testid={`${testIdPrefix}-chip-row`}
    >
      {options.map((option) => {
        const isActive = isColorSwatchActive(option, activeState);
        return (
          <button
            key={option.id}
            type="button"
            role="listitem"
            data-testid={`${testIdPrefix}-${option.id}`}
            aria-pressed={isActive}
            onClick={() => onSelect(selectionForColorSwatch(option, isActive))}
            className="group min-w-0 text-left"
          >
            <ColorFaceCue faceSrc={option.faceSrc} faces={option.faces} active={isActive} />
            <span className="mt-2.5 block min-w-0 sm:mt-3">
              <span className="block font-editorial text-base leading-tight tracking-tight text-[var(--jw-ink)] sm:text-lg lg:text-xl">
                {option.label}
              </span>
              <span className={`mt-0.5 block text-xs leading-none ${jw.muted}`}>
                {option.count} {option.count === 1 ? "selection" : "selections"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type MoodSwatchChipRowProps = Omit<ColorSwatchChipRowProps, "color">;

/** Editorial mood chips kept distinct from the literal color grid. */
export function MoodSwatchChipRow({
  aesthetic,
  material = null,
  origin = null,
  onSelect,
  catalog = JW_STONE_CATALOG,
  testIdPrefix = "jw-mood",
  ariaLabel = "Stone moods",
}: MoodSwatchChipRowProps) {
  const base = { material, origin };
  const options = MOOD_SWATCH_OPTIONS.map((option) => ({
    ...option,
    count: countForColorSwatch(option, catalog, base),
  }));
  const activeState = { aesthetic, color: null };

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      role="list"
      aria-label={ariaLabel}
      data-testid={`${testIdPrefix}-chip-row`}
    >
      {options.map((option) => {
        const isActive = isColorSwatchActive(option, activeState);
        return (
          <button
            key={option.id}
            type="button"
            role="listitem"
            data-testid={`${testIdPrefix}-${option.id}`}
            aria-pressed={isActive}
            onClick={() => onSelect(selectionForColorSwatch(option, isActive))}
            className="group min-w-0 text-left"
          >
            <ColorFaceCue faceSrc={option.faceSrc} faces={option.faces} active={isActive} />
            <span className="mt-2.5 block min-w-0 sm:mt-3">
              <span className="block font-editorial text-base leading-tight tracking-tight text-[var(--jw-ink)] sm:text-lg lg:text-xl">
                {option.label}
              </span>
              <span className={`mt-0.5 block text-xs leading-none ${jw.muted}`}>
                {option.count} {option.count === 1 ? "selection" : "selections"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type ColorPaletteRailProps = {
  aesthetic: ColorDirectionId | null;
  color: string | null;
  material?: string | null;
  origin?: string | null;
  onSelect: (next: ColorSwatchSelection) => void;
  isSaved: (id: string) => boolean;
  onToggleSaved: (stone: JwStoneCatalogItem) => void;
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
  catalog?: readonly JwStoneCatalogItem[];
};

function activeColorSwatchLabel(color: string | null): string {
  const match = COLOR_SWATCH_OPTIONS.find((option) =>
    isColorSwatchActive(option, { aesthetic: null, color })
  );
  return match?.label ?? "Color";
}

/**
 * Always collapsed on mount — shopper must open the band.
 * Shared URL ?color= must not auto-expand this section. Legacy ?aesthetic=
 * remains parseable elsewhere, but is intentionally ignored by this literal
 * color rail. Material browse never opens this band.
 */
export function ColorPaletteRail({
  color,
  material = null,
  origin = null,
  onSelect,
  isSaved,
  onToggleSaved,
  onOpen,
  onAsk,
  catalog = JW_STONE_CATALOG,
}: ColorPaletteRailProps) {
  const hasSelection = Boolean(color);
  const selectionLabel = activeColorSwatchLabel(color);
  const matches = useMemo(() => {
    if (!hasSelection) return [];
    return filterJwStoneCatalog(
      {
        aesthetic: null,
        color,
        material,
        origin,
      },
      catalog
    )
      .filter((stone) => !stone.anonymous)
      .slice()
      .sort((a, b) => Number(isHandOnlyStone(a.images)) - Number(isHandOnlyStone(b.images)));
  }, [catalog, color, hasSelection, material, origin]);

  return (
    <JwCollapsibleSection
      id="jw-palette-rail"
      testId="jw-palette-rail"
      headingId="jw-palette-heading"
      title="Browse by color"
      defaultExpanded={false}
      background={<ColorCollageBackground />}
    >
      {!hasSelection ? (
        <p className={`mb-4 text-sm leading-relaxed ${jw.muted}`} data-testid="jw-palette-prompt">
          Choose a color — matching stones appear right here.
        </p>
      ) : null}
      <ColorSwatchChipRow
        aesthetic={null}
        color={color}
        material={material}
        origin={origin}
        onSelect={onSelect}
        catalog={catalog}
      />
      {hasSelection ? (
        <div className="mt-6 sm:mt-8" data-testid="jw-palette-results">
          {matches.length ? (
            <MaterialStonePager
              materialLabel={selectionLabel}
              stones={matches}
              isSaved={isSaved}
              onToggleSaved={onToggleSaved}
              onOpen={onOpen}
              onAsk={onAsk}
            />
          ) : (
            <p
              className={`text-sm leading-relaxed ${jw.muted}`}
              data-testid="jw-palette-results-empty"
            >
              No named selections in this color. Choose another color, or clear the color filter.
            </p>
          )}
        </div>
      ) : null}
    </JwCollapsibleSection>
  );
}

type MoodPaletteRailProps = Omit<ColorPaletteRailProps, "color">;

function activeMoodSwatchLabel(aesthetic: ColorDirectionId | null): string {
  const match = MOOD_SWATCH_OPTIONS.find((option) =>
    isColorSwatchActive(option, { aesthetic, color: null })
  );
  return match?.label ?? "Mood";
}

/**
 * Separate editorial mood browse. Legacy ?aesthetic= links remain functional,
 * while literal colors keep their own truthful picker and ?color= contract.
 */
export function MoodPaletteRail({
  aesthetic,
  material = null,
  origin = null,
  onSelect,
  isSaved,
  onToggleSaved,
  onOpen,
  onAsk,
  catalog = JW_STONE_CATALOG,
}: MoodPaletteRailProps) {
  const hasSelection = Boolean(aesthetic);
  const selectionLabel = activeMoodSwatchLabel(aesthetic);
  const matches = useMemo(() => {
    if (!hasSelection) return [];
    return filterJwStoneCatalog(
      {
        aesthetic,
        color: null,
        material,
        origin,
      },
      catalog
    )
      .filter((stone) => !stone.anonymous)
      .slice()
      .sort((a, b) => Number(isHandOnlyStone(a.images)) - Number(isHandOnlyStone(b.images)));
  }, [aesthetic, catalog, hasSelection, material, origin]);

  return (
    <JwCollapsibleSection
      id="jw-mood-rail"
      testId="jw-mood-rail"
      headingId="jw-mood-heading"
      title="Browse by mood"
      defaultExpanded={false}
      backgroundSrc={JW_STORY_BACKGROUNDS.livingRoom.src}
    >
      {!hasSelection ? (
        <p className={`mb-4 text-sm leading-relaxed ${jw.muted}`} data-testid="jw-mood-prompt">
          Choose a mood — matching stones appear right here.
        </p>
      ) : null}
      <MoodSwatchChipRow
        aesthetic={aesthetic}
        material={material}
        origin={origin}
        onSelect={onSelect}
        catalog={catalog}
      />
      {hasSelection ? (
        <div className="mt-6 sm:mt-8" data-testid="jw-mood-results">
          {matches.length ? (
            <MaterialStonePager
              materialLabel={selectionLabel}
              stones={matches}
              isSaved={isSaved}
              onToggleSaved={onToggleSaved}
              onOpen={onOpen}
              onAsk={onAsk}
            />
          ) : (
            <p
              className={`text-sm leading-relaxed ${jw.muted}`}
              data-testid="jw-mood-results-empty"
            >
              No named selections in this mood. Choose another mood, or clear the mood filter.
            </p>
          )}
        </div>
      ) : null}
    </JwCollapsibleSection>
  );
}
