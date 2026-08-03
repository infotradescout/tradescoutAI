import type { JwStoneInventoryStone } from "@/data/jwStoneInventory";
import { getColorDirectionForStone } from "./colorDirections";
import { JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES } from "./reconciledInventory";
import type {
  CatalogFilterOption,
  CatalogFilters,
  JwStoneCatalogItem,
  VerifiedOrigin,
} from "./types";
import { JW_STONE_VERIFIED_ORIGIN_BY_SLUG } from "./verifiedOrigins";

export const JW_STONE_ANONYMOUS_PUBLIC_LABEL = "Call for availability";

const PUBLIC_LABEL_BY_CATEGORY: Readonly<Record<string, string>> = {
  basalt: "Basalt",
  granite: "Granite",
  marble: "Marble",
  onyx: "Onyx",
  quartz: "Engineered Quartz",
  quartzite: "Quartzite",
  soapstone: "Soapstone",
};

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

  return Object.freeze({
    id: stone.slug,
    displayName: anonymous ? null : stone.displayName,
    publicLabel: anonymous ? JW_STONE_ANONYMOUS_PUBLIC_LABEL : stone.displayName!,
    nameStatus: stone.nameStatus,
    anonymous,
    shareSlug: anonymous ? null : stone.slug,
    wishlistEligible: !anonymous,
    colorDirection,
    images: Object.freeze([...stone.images]),
    shareImageOrder: stone.shareImageOrder ? Object.freeze([...stone.shareImageOrder]) : undefined,
    imageFinishes: stone.imageFinishes
      ? Object.freeze(
          stone.imageFinishes.map((finishes) =>
            finishes ? Object.freeze([...finishes]) : undefined
          )
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
    origin: resolveVerifiedOrigin(args.verifiedOrigin),
  });
}

function buildCatalog(): readonly JwStoneCatalogItem[] {
  return Object.freeze(
    JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap((category) =>
      category.stones.map((stone) =>
        projectJwStoneCatalogItem({
          stone,
          categorySlug: category.categorySlug,
          verifiedOrigin: JW_STONE_VERIFIED_ORIGIN_BY_SLUG[stone.slug],
        })
      )
    )
  );
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
  return CATALOG_BY_ID.get(id) ?? null;
}

export function getNamedCatalogItemByShareSlug(slug: string): JwStoneCatalogItem | null {
  return NAMED_CATALOG_BY_SHARE_SLUG.get(slug) ?? null;
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

export function getFinishFilterOptions(
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): CatalogFilterOption[] {
  return countOptions(catalog, (stone) =>
    stone.finishes.map((finish) => [toCatalogFilterValue(finish), finish] as const)
  );
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

export function filterJwStoneCatalog(
  filters: CatalogFilters,
  catalog: readonly JwStoneCatalogItem[] = JW_STONE_CATALOG
): JwStoneCatalogItem[] {
  return catalog.filter((stone) => {
    if (filters.color && stone.colorDirection !== filters.color) return false;
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
