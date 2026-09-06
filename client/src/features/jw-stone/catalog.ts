import type { JwStoneInventoryStone } from "@/data/jwStoneInventory";
import { resolveJwStoneLegacyItemSlug } from "@shared/jwStoneLegacyAliases";
import { getColorDirectionForStone } from "./colorDirections";
import { rankImagePathsForCover, reorderParallelByPermutation } from "./coverImages";
import { JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES } from "./reconciledInventory";
import { getColorsForStone, getStoneColorLabel, getSwatchesForStone } from "./stoneColors";
import type {
  CatalogFilterOption,
  CatalogFilters,
  JwStoneCatalogItem,
  VerifiedOrigin,
} from "./types";
import { resolveJwStoneArrivedAt } from "./arrivalDates";
import { resolveSlabDimensionsLabel } from "./slabDimensions";
import { JW_STONE_VERIFIED_ORIGIN_BY_SLUG } from "./verifiedOrigins";
import { IRANIAN_ONYX_STOCK, JW_STONE_ONYX_ORIGINS } from "@shared/onyxOrigins";

/** Public label for unnamed inventory photographs. Never invent availability claims. */
export const JW_STONE_ANONYMOUS_PUBLIC_LABEL = "New arrival";

const PUBLIC_LABEL_BY_CATEGORY: Readonly<Record<string, string>> = {
  basalt: "Basalt",
  granite: "Granite",
  marble: "Marble",
  onyx: "Onyx",
  quartz: "Engineered Quartz",
  quartzite: "Quartzite",
  soapstone: "Soapstone",
};

/**
 * Quiet merchandising order for ordinary browse, filter, and search results.
 * This changes ranking only: no badge, label, special section, or public reason.
 */
const JW_STONE_BROWSE_PRIORITY_ALIASES = [
  ["honey-onyx"],
  ["black-dunes"],
  ["avalanche"],
  ["cristalita-blue", "cristallita-blue"],
  ["rhino-white"],
  ["blue-bahia"],
  ["calacatta-vaguili", "calacatta-vagli"],
  ["matarazzo", "matarazzo-dolomite"],
  ["calacatta-cremo"],
  ["casa-blanca", "casablanca"],
  ["white-santorini", "santorini-white"],
] as const;

const JW_STONE_BROWSE_PRIORITY_RANK: ReadonlyMap<string, number> = new Map(
  JW_STONE_BROWSE_PRIORITY_ALIASES.flatMap((aliases, rank) =>
    aliases.map((alias) => [alias, rank] as const)
  )
);

function normalizeBrowsePriorityKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBrowsePriorityRank(stone: JwStoneCatalogItem): number {
  const candidates = [stone.id, stone.shareSlug, stone.displayName, stone.publicLabel];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const rank = JW_STONE_BROWSE_PRIORITY_RANK.get(normalizeBrowsePriorityKey(candidate));
    if (rank != null) return rank;
  }

  return Number.POSITIVE_INFINITY;
}

export function rankJwStoneCatalogForBrowse(
  catalog: readonly JwStoneCatalogItem[]
): JwStoneCatalogItem[] {
  return catalog
    .map((stone, sourceIndex) => ({
      stone,
      sourceIndex,
      priorityRank: getBrowsePriorityRank(stone),
    }))
    .sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank < b.priorityRank ? -1 : 1;
      }
      return a.sourceIndex - b.sourceIndex;
    })
    .map(({ stone }) => stone);
}

export function resolveVerifiedOrigin(value: unknown): VerifiedOrigin | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<VerifiedOrigin>;
  const country = typeof candidate.country === "string" ? candidate.country.trim() : "";
  const source = typeof candidate.source === "string" ? candidate.source.trim() : "";

  if (candidate.verified !== true || !country || !source) return null;

  return Object.freeze({ country, verified: true, source });
}

export function projectJwStoneCatalogItem(args: {
  stone: JwStoneInventoryStone;
  categorySlug: string;
  verifiedOrigin?: unknown;
}): JwStoneCatalogItem {
  const { stone, categorySlug } = args;
  const colorDirection = getColorDirectionForStone(stone.slug);
  if (!colorDirection) {
    throw new Error(`JW Stone inventory is missing a color direction: ${stone.slug}`);
  }

  const anonymous = stone.nameStatus === "placeholder" || !stone.displayName;
  const counts = stone.slabCounts ? [...stone.slabCounts] : [];
  const materialLabel =
    stone.materialStatus === "unconfirmed"
      ? null
      : (PUBLIC_LABEL_BY_CATEGORY[categorySlug] ?? null);
  const displayName = anonymous ? null : stone.displayName;
  const colors = getColorsForStone(stone.slug);
  const colorSwatches = getSwatchesForStone(stone.slug).map((swatch) => swatch.hex);

  // Lead with the best showroom face, but keep every mapped photo in the gallery.
  // Hand/close siblings stay available as extras — they must not win index 0 when a
  // cleaner face exists (cover ranking already enforces that).
  const coverPermutation = rankImagePathsForCover(stone.images, { stoneSlug: stone.slug });
  const images = coverPermutation.map((oldIndex) => stone.images[oldIndex]!);
  const shareImageOrder = images.map((_, index) => index);
  const imageFinishes = reorderParallelByPermutation(stone.imageFinishes, coverPermutation);

  return Object.freeze({
    id: stone.slug,
    displayName,
    publicLabel: anonymous ? JW_STONE_ANONYMOUS_PUBLIC_LABEL : stone.displayName!,
    nameStatus: stone.nameStatus,
    anonymous,
    shareSlug: anonymous ? null : stone.slug,
    wishlistEligible: !anonymous,
    colorDirection,
    colors,
    colorSwatches: Object.freeze(colorSwatches),
    // Design-pairing suggestions are intentionally hidden from public catalog
    // data so they cannot be mistaken for slab colors or enter filters/counts.
    pairingSwatches: Object.freeze([]),
    images: Object.freeze(images),
    shareImageOrder: shareImageOrder ? Object.freeze(shareImageOrder) : undefined,
    imageFinishes: imageFinishes
      ? Object.freeze(
          imageFinishes.map((finishes) => (finishes ? Object.freeze([...finishes]) : undefined))
        )
      : undefined,
    materialId: materialLabel ? categorySlug : null,
    materialLabel,
    materialStatus: stone.materialStatus,
    finishes: Object.freeze(stone.finishes ? [...stone.finishes] : []),
    finishStatus: stone.finishStatus,
    sourceEvidence: counts.length
      ? Object.freeze({
          counts: Object.freeze(counts),
        })
      : null,
    slabDimensions: resolveSlabDimensionsLabel({ slug: stone.slug, images }),
    origin: resolveVerifiedOrigin(args.verifiedOrigin),
    ...(stone.slug in JW_STONE_ONYX_ORIGINS ? { thicknessCm: IRANIAN_ONYX_STOCK.thicknessCm } : {}),
    arrivedAt: resolveJwStoneArrivedAt(stone.slug),
  });
}

function buildCatalog(): readonly JwStoneCatalogItem[] {
  const projected = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap((category) =>
    category.stones.map((stone) =>
      projectJwStoneCatalogItem({
        stone,
        categorySlug: category.categorySlug,
        verifiedOrigin: JW_STONE_VERIFIED_ORIGIN_BY_SLUG[stone.slug],
      })
    )
  );

  return Object.freeze(rankJwStoneCatalogForBrowse(projected));
}

export const JW_STONE_CATALOG = buildCatalog();
export const JW_STONE_NAMED_CATALOG = Object.freeze(
  JW_STONE_CATALOG.filter((stone) => !stone.anonymous)
);
export const JW_STONE_ANONYMOUS_CATALOG = Object.freeze(
  JW_STONE_CATALOG.filter((stone) => stone.anonymous)
);
export const JW_STONE_NAMED_IDS: ReadonlySet<string> = new Set(
  JW_STONE_NAMED_CATALOG.map((stone) => stone.id)
);

const CATALOG_BY_ID: ReadonlyMap<string, JwStoneCatalogItem> = new Map(
  JW_STONE_CATALOG.map((stone) => [stone.id, stone])
);
const NAMED_CATALOG_BY_SHARE_SLUG: ReadonlyMap<string, JwStoneCatalogItem> = new Map(
  JW_STONE_NAMED_CATALOG.map((stone) => [stone.shareSlug!, stone])
);

export function getCatalogItemById(id: string): JwStoneCatalogItem | null {
  return CATALOG_BY_ID.get(resolveJwStoneLegacyItemSlug(id)) ?? null;
}

export function getNamedCatalogItemByShareSlug(slug: string): JwStoneCatalogItem | null {
  return NAMED_CATALOG_BY_SHARE_SLUG.get(resolveJwStoneLegacyItemSlug(slug)) ?? null;
}

export function toCatalogFilterValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countOptions(
  catalog: readonly JwStoneCatalogItem[],
  valuesForStone: (stone: JwStoneCatalogItem) => ReadonlyArray<readonly [string, string]>
): CatalogFilterOption[] {
  const labels = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const stone of catalog) {
    const seenForStone = new Set<string>();
    for (const [value, label] of valuesForStone(stone)) {
      if (!value || seenForStone.has(value)) continue;
      seenForStone.add(value);
      labels.set(value, label);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labels.get(value) ?? value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getMaterialFilterOptions(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): CatalogFilterOption[] {
  return countOptions(catalog, (stone) =>
    stone.materialId && stone.materialLabel
      ? [[stone.materialId, stone.materialLabel] as const]
      : []
  );
}

/** Display / scroll order for named inventory sections (confirmed materials first). */
export const JW_STONE_MATERIAL_SECTION_ORDER = [
  "granite",
  "marble",
  "quartzite",
  "quartz",
  "onyx",
  "soapstone",
  "basalt",
  "unconfirmed",
] as const;

export const JW_STONE_UNCONFIRMED_MATERIAL_SECTION_ID = "unconfirmed";
export const JW_STONE_UNCONFIRMED_MATERIAL_LABEL = "Material to Confirm";

export type NamedMaterialSection = Readonly<{
  /** Confirmed material slug, or `unconfirmed` when materialLabel is absent. */
  materialId: string;
  materialLabel: string;
  /** True when stones lack a confirmed materialId (not a URL filter value). */
  filterable: boolean;
  stones: readonly JwStoneCatalogItem[];
}>;

/**
 * Group named stones by real catalog material for category-separated inventory UI.
 * Anonymous stones are excluded — they belong in New Arrivals, not named sections.
 */
export function groupNamedCatalogByMaterial(
  stones: readonly JwStoneCatalogItem[]
): NamedMaterialSection[] {
  const buckets = new Map<string, JwStoneCatalogItem[]>();
  const labels = new Map<string, string>();

  for (const stone of stones) {
    if (stone.anonymous) continue;
    const materialId =
      stone.materialId && stone.materialLabel
        ? stone.materialId
        : JW_STONE_UNCONFIRMED_MATERIAL_SECTION_ID;
    const materialLabel =
      stone.materialId && stone.materialLabel
        ? stone.materialLabel
        : JW_STONE_UNCONFIRMED_MATERIAL_LABEL;
    labels.set(materialId, materialLabel);
    const list = buckets.get(materialId);
    if (list) list.push(stone);
    else buckets.set(materialId, [stone]);
  }

  const orderedIds = [
    ...JW_STONE_MATERIAL_SECTION_ORDER.filter((id) => buckets.has(id)),
    ...[...buckets.keys()]
      .filter((id) => !(JW_STONE_MATERIAL_SECTION_ORDER as readonly string[]).includes(id))
      .sort((a, b) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b)),
  ];

  return orderedIds.map((materialId) =>
    Object.freeze({
      materialId,
      materialLabel: labels.get(materialId) ?? materialId,
      filterable: materialId !== JW_STONE_UNCONFIRMED_MATERIAL_SECTION_ID,
      stones: Object.freeze(buckets.get(materialId) ?? []),
    })
  );
}

export function materialSectionAnchorId(materialId: string): string {
  return `inventory-${materialId}`;
}

export function getOriginFilterOptions(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): CatalogFilterOption[] {
  return countOptions(catalog, (stone) =>
    stone.origin
      ? [[toCatalogFilterValue(stone.origin.country), stone.origin.country] as const]
      : []
  );
}

export function getColorFilterOptions(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): CatalogFilterOption[] {
  return countOptions(catalog, (stone) =>
    stone.colors.flatMap((colorId) => {
      const label = getStoneColorLabel(colorId);
      return label ? ([[colorId, label]] as const) : [];
    })
  );
}

export function getFinishFilterOptions(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): CatalogFilterOption[] {
  return countOptions(catalog, (stone) =>
    stone.finishes.map((finish) => [toCatalogFilterValue(finish), finish] as const)
  );
}

export function filterJwStoneCatalog(
  filters: CatalogFilters,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): JwStoneCatalogItem[] {
  return catalog.filter((stone) => {
    if (filters.aesthetic && stone.colorDirection !== filters.aesthetic) return false;
    if (filters.color && !stone.colors.includes(filters.color)) return false;
    if (filters.material && stone.materialId !== filters.material) return false;
    if (
      filters.finish &&
      !stone.finishes.some((finish) => toCatalogFilterValue(finish) === filters.finish)
    ) {
      return false;
    }
    if (
      filters.origin &&
      (!stone.origin || toCatalogFilterValue(stone.origin.country) !== filters.origin)
    ) {
      return false;
    }
    return true;
  });
}
