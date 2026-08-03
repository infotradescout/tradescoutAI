import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import type { JwStoneInventoryStone } from "@/data/jwStoneInventory";
import type {
  JwStone2ColorDirection,
  JwStone2ColorDirectionOption,
  JwStone2DiscoveryFilters,
  JwStone2FilterOption,
  JwStone2FilterOptions,
  JwStone2InventoryCategory,
  JwStone2InventoryItem,
  JwStone2RouteFactsBySlug,
  JwStone2SafePublicSelection,
  JwStone2SourceInventory,
  JwStone2SuppliedFact,
} from "./types";

export const JW_STONE_2_COLOR_DIRECTION_OPTIONS: readonly JwStone2ColorDirectionOption[] = [
  { id: "warm-neutrals", label: "Warm neutrals" },
  { id: "cool-lights", label: "Cool & light" },
  { id: "deep-dramatic", label: "Deep & dramatic" },
  { id: "green-earth", label: "Green & earth" },
  { id: "mixed-palette", label: "Mixed palette" },
] as const;

/**
 * Curated presentation-only navigation. Every current source slug is assigned
 * explicitly so a product name is never reinterpreted at runtime. This does
 * not assert geological color, material, finish, suitability, or origin.
 */
export const JW_STONE_2_COLOR_DIRECTION_BY_SLUG: Readonly<Record<string, JwStone2ColorDirection>> =
  Object.freeze({
    "matrix-basalt": "deep-dramatic",
    "arizona-gold": "warm-neutrals",
    avalanche: "cool-lights",
    "black-pearl": "deep-dramatic",
    "blue-bahia": "cool-lights",
    "blue-dunes": "cool-lights",
    "blue-fantasy": "cool-lights",
    "blue-flower": "cool-lights",
    "blue-goias": "cool-lights",
    "dallas-white": "cool-lights",
    "fantasy-black": "deep-dramatic",
    "galaxy-white": "cool-lights",
    "giallo-ornamental": "warm-neutrals",
    "jaguar-leather": "warm-neutrals",
    "juparana-blue": "cool-lights",
    "nilo-river": "mixed-palette",
    picasso: "mixed-palette",
    "preto-sao-gabriel": "deep-dramatic",
    titanium: "deep-dramatic",
    tyfoon: "mixed-palette",
    "viscount-white": "cool-lights",
    "white-ice": "cool-lights",
    "white-persa": "warm-neutrals",
    "white-springs": "warm-neutrals",
    "alabama-rose": "warm-neutrals",
    "alabama-white": "cool-lights",
    "aspen-white": "cool-lights",
    "carrara-white-brazil": "cool-lights",
    "cherokee-marble": "mixed-palette",
    "cristalita-blue": "cool-lights",
    "emperor-brown": "warm-neutrals",
    "fantasy-brown": "warm-neutrals",
    "grigio-fantasy": "cool-lights",
    itaoca: "warm-neutrals",
    matarazzo: "cool-lights",
    "mexican-brown": "warm-neutrals",
    mugla: "cool-lights",
    "namib-carrera": "cool-lights",
    "oyster-white": "warm-neutrals",
    palassandro: "warm-neutrals",
    panda: "deep-dramatic",
    "pinta-verde": "green-earth",
    "shadow-storm": "deep-dramatic",
    "silver-shadow": "cool-lights",
    "venta-black": "deep-dramatic",
    "white-fantasy": "cool-lights",
    "zucci-marble": "mixed-palette",
    "honey-onyx": "warm-neutrals",
    "aj-quartz": "mixed-palette",
    "calacatta-andromeda": "cool-lights",
    "calacatta-dor": "warm-neutrals",
    "calacatta-fumo": "cool-lights",
    "calacatta-gold": "warm-neutrals",
    "sparkling-white": "cool-lights",
    atlantic: "cool-lights",
    "beverly-blue": "cool-lights",
    "bianco-superiory": "cool-lights",
    "blue-deep": "deep-dramatic",
    "blue-dream": "cool-lights",
    "blue-mare": "cool-lights",
    bronzonite: "warm-neutrals",
    "calacatta-amala": "warm-neutrals",
    "casa-blanca": "warm-neutrals",
    "cristal-2cm-united": "cool-lights",
    cristallo: "cool-lights",
    dueto: "mixed-palette",
    frost: "cool-lights",
    "fusion-brown": "warm-neutrals",
    "fusion-yellow": "warm-neutrals",
    gabanna: "mixed-palette",
    "macaubas-fantasy": "mixed-palette",
    "marbella-green": "green-earth",
    "mont-blanc": "cool-lights",
    "taj-mahal": "warm-neutrals",
    "white-santorini": "cool-lights",
    soapstone: "deep-dramatic",
    "amazonic-green": "green-earth",
    apollonis: "mixed-palette",
    artemis: "mixed-palette",
    "beverly-blue-antigo": "cool-lights",
    "bianco-palomino": "warm-neutrals",
    "black-dunes": "deep-dramatic",
    calacatta: "cool-lights",
    "calacatta-corchia": "warm-neutrals",
    "calacatta-cremo": "warm-neutrals",
    "calacatta-macchia-vecchia": "mixed-palette",
    "calacatta-vaguili": "warm-neutrals",
    "ceara-white": "cool-lights",
    "chocolate-brown": "warm-neutrals",
    "emerald-pearl": "green-earth",
    "gold-macaubas": "warm-neutrals",
    "grand-constantine": "deep-dramatic",
    "kolkata-vegi-marble": "green-earth",
    "montana-bianco": "cool-lights",
    "mystic-spring": "cool-lights",
    "namib-bianco-select": "cool-lights",
    "namib-fantasy": "mixed-palette",
    "new-caledonia": "cool-lights",
    perlatus: "warm-neutrals",
    "porto-fino": "warm-neutrals",
    "rhino-white": "cool-lights",
    "river-white": "cool-lights",
    "steel-gray": "cool-lights",
    "super-white": "cool-lights",
    "titanium-black-leathered": "deep-dramatic",
    "toulon-white": "cool-lights",
    "trending-selection-01": "mixed-palette",
    "trending-selection-02": "mixed-palette",
    "trending-selection-03": "mixed-palette",
    "trending-selection-04": "mixed-palette",
    "trending-selection-05": "mixed-palette",
    "trending-selection-06": "mixed-palette",
    "trending-selection-07": "mixed-palette",
    "trending-selection-08": "mixed-palette",
    "trending-selection-09": "mixed-palette",
    "trending-selection-10": "mixed-palette",
    "valle-nevada-luna-pearl": "warm-neutrals",
    versace: "mixed-palette",
    "white-silk": "cool-lights",
  });

export const JW_STONE_2_ROUTE_LOCAL_FACTS: JwStone2RouteFactsBySlug = Object.freeze({});

const STABLE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanSuppliedFact(fact: JwStone2SuppliedFact | null | undefined) {
  if (fact?.verification !== "supplied_verified") return undefined;
  const value = fact.value.trim();
  return value ? { value, verification: "supplied_verified" as const } : undefined;
}

function cleanOrigin(
  origin: JwStone2RouteFactsBySlug[string]["origin"]
): JwStone2InventoryItem["origin"] {
  if (origin?.verification !== "supplied_verified") return null;
  const country = origin.country.trim();
  return country ? { country, verification: "supplied_verified" } : null;
}

function adaptStone(
  category: JwStone2SourceInventory[number],
  stone: JwStoneInventoryStone,
  routeFacts: JwStone2RouteFactsBySlug
): JwStone2InventoryItem {
  const publicName = stone.nameStatus === "source" ? stone.displayName?.trim() || null : null;
  const hasStableSlug = STABLE_SLUG.test(stone.slug);
  const isNamed = Boolean(publicName && hasStableSlug);
  const sourceSlabCounts = stone.slabCounts?.slice();
  const verifiedFinishes =
    stone.finishStatus === "explicit"
      ? (stone.finishes || []).filter(
          (finish) => finish.trim() && finish.trim().toLowerCase() !== "dual finish"
        )
      : [];
  const facts = routeFacts[stone.slug] || {};
  const dimensions = cleanSuppliedFact(facts.dimensions);
  const availability = cleanSuppliedFact(facts.availability);
  const translucency = cleanSuppliedFact(facts.translucency);

  return {
    id: stone.slug,
    publicName,
    publicSlug: isNamed ? stone.slug : null,
    nameStatus: stone.nameStatus,
    isNamed,
    isEligibleForPublicActions: isNamed,
    categorySlug: category.categorySlug,
    categoryLabel: category.category,
    materialStatus: stone.materialStatus,
    images: stone.images.slice(),
    shareImageOrder: stone.shareImageOrder?.slice(),
    imageFinishes: stone.imageFinishes?.map((finishes) => finishes?.slice()),
    sourceSlabCounts,
    sourceSlabCountTotal: sourceSlabCounts?.reduce((total, count) => total + count, 0),
    material:
      stone.materialStatus === "unconfirmed" || category.categorySlug === "unconfirmed"
        ? null
        : { name: category.category, sourceStatus: stone.materialStatus },
    verifiedFinishes,
    verifiedFinishLabel: verifiedFinishes.length ? verifiedFinishes.join(" / ") : null,
    ...(dimensions ? { dimensions } : {}),
    ...(availability ? { availability } : {}),
    ...(translucency ? { translucency } : {}),
    origin: cleanOrigin(facts.origin),
    colorDirection: JW_STONE_2_COLOR_DIRECTION_BY_SLUG[stone.slug] || "mixed-palette",
  };
}

export function adaptJwStoneInventory(
  source: JwStone2SourceInventory = JW_STONE_INVENTORY_CATEGORIES,
  routeFacts: JwStone2RouteFactsBySlug = JW_STONE_2_ROUTE_LOCAL_FACTS
): JwStone2InventoryCategory[] {
  return source.map((category) => ({
    categorySlug: category.categorySlug,
    categoryLabel: category.category,
    items: category.stones.map((stone) => adaptStone(category, stone, routeFacts)),
  }));
}

export const JW_STONE_2_INVENTORY_CATEGORIES = adaptJwStoneInventory();

export const JW_STONE_2_INVENTORY: readonly JwStone2InventoryItem[] =
  JW_STONE_2_INVENTORY_CATEGORIES.flatMap((category) => category.items);

export const JW_STONE_2_NAMED_STONES: readonly JwStone2InventoryItem[] =
  JW_STONE_2_INVENTORY.filter((item) => item.isEligibleForPublicActions);

export const JW_STONE_2_ANONYMOUS_STONES: readonly JwStone2InventoryItem[] =
  JW_STONE_2_INVENTORY.filter((item) => !item.isEligibleForPublicActions);

export const JW_STONE_2_INVENTORY_COUNTS = Object.freeze({
  total: JW_STONE_2_INVENTORY.length,
  named: JW_STONE_2_NAMED_STONES.length,
  anonymous: JW_STONE_2_ANONYMOUS_STONES.length,
});

export function getJwStone2ItemById(
  id: string,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  return inventory.find((item) => item.id === id);
}

export function getJwStone2NamedItemBySlug(
  slug: string,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  return inventory.find((item) => item.isEligibleForPublicActions && item.publicSlug === slug);
}

export function searchNamedJwStone2Inventory(
  query: string,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return inventory.filter((item) => item.isEligibleForPublicActions);
  return inventory.filter(
    (item) =>
      item.isEligibleForPublicActions &&
      Boolean(item.publicName?.toLocaleLowerCase().includes(normalized))
  );
}

function sameValue(left: string | undefined, right: string | null) {
  return !right || left?.toLocaleLowerCase() === right.toLocaleLowerCase();
}

export function filterJwStone2Inventory(
  filters: JwStone2DiscoveryFilters,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  if (!filters.buyer || !filters.color) return [];

  return inventory.filter((item) => {
    if (item.colorDirection !== filters.color) return false;
    if (filters.stone && item.publicSlug !== filters.stone) return false;
    if (!sameValue(item.material?.name, filters.material)) return false;
    if (
      filters.finish &&
      !item.verifiedFinishes.some(
        (finish) => finish.toLocaleLowerCase() === filters.finish?.toLocaleLowerCase()
      )
    ) {
      return false;
    }
    if (!sameValue(item.dimensions?.value, filters.size)) return false;
    if (!sameValue(item.availability?.value, filters.availability)) return false;
    if (!sameValue(item.translucency?.value, filters.translucency)) return false;
    if (!sameValue(item.origin?.country, filters.origin)) return false;
    return true;
  });
}

function optionCounts(values: Array<string | undefined>): JwStone2FilterOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    const current = counts.get(key);
    counts.set(key, { label: current?.label || value, count: (current?.count || 0) + 1 });
  }
  return [...counts.entries()]
    .map(([value, option]) => ({ value, label: option.label, count: option.count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getJwStone2FilterOptions(
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
): JwStone2FilterOptions {
  const origins = optionCounts(inventory.map((item) => item.origin?.country));
  return {
    colors: JW_STONE_2_COLOR_DIRECTION_OPTIONS.map((option) => ({
      ...option,
      count: inventory.filter((item) => item.colorDirection === option.id).length,
    })),
    materials: optionCounts(inventory.map((item) => item.material?.name)),
    finishes: optionCounts(inventory.flatMap((item) => item.verifiedFinishes)),
    sizes: optionCounts(inventory.map((item) => item.dimensions?.value)),
    availability: optionCounts(inventory.map((item) => item.availability?.value)),
    translucency: optionCounts(inventory.map((item) => item.translucency?.value)),
    origins,
    showOrigin: origins.length > 0,
  };
}

export function toJwStone2SafePublicSelection(
  item: JwStone2InventoryItem | undefined
): JwStone2SafePublicSelection | null {
  if (!item?.isEligibleForPublicActions || !item.publicName || !item.publicSlug) return null;
  return { id: item.publicSlug, label: item.publicName };
}

export function getJwStone2ContactSelections(
  ids: readonly string[],
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
): JwStone2SafePublicSelection[] {
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.flatMap((id) => {
    const selection = toJwStone2SafePublicSelection(getJwStone2ItemById(id, inventory));
    return selection ? [selection] : [];
  });
}
