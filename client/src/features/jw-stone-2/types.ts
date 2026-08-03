import type { JwStoneInventoryCategory, JwStoneInventoryStone } from "@/data/jwStoneInventory";
import type { JwStoneInventoryNameStatus } from "@shared/jwStonePresentation";

export const JW_STONE_2_BUYER_TYPES = ["fabricator", "builder", "designer", "homeowner"] as const;

export type JwStone2BuyerType = (typeof JW_STONE_2_BUYER_TYPES)[number];

export const JW_STONE_2_COLOR_DIRECTIONS = [
  "all",
  "warm-neutrals",
  "cool-lights",
  "deep-dramatic",
  "green-earth",
  "mixed-palette",
] as const;

export type JwStone2ColorDirection = (typeof JW_STONE_2_COLOR_DIRECTIONS)[number];

export type JwStone2ColorDirectionOption = {
  id: JwStone2ColorDirection;
  label: string;
};

/**
 * Route-local fact contract. The new experience may show an origin only when
 * JW supplies it as verified data. The canonical inventory intentionally does
 * not receive inferred origin values.
 */
export type JwStone2OriginFact = {
  country: string;
  verification: "supplied_verified";
};

export type JwStone2SuppliedFact = {
  value: string;
  verification: "supplied_verified";
};

/**
 * Optional verified facts owned by `/jw-stone`. Empty fields stay absent; the
 * adapter never manufactures them from a stone name, image, or material.
 */
export type JwStone2RouteLocalFacts = {
  dimensions?: JwStone2SuppliedFact | null;
  availability?: JwStone2SuppliedFact | null;
  translucency?: JwStone2SuppliedFact | null;
  origin?: JwStone2OriginFact | null;
};

export type JwStone2RouteFactsBySlug = Readonly<Record<string, JwStone2RouteLocalFacts>>;

export type JwStone2MaterialFact = {
  name: string;
  sourceStatus: Exclude<JwStoneInventoryStone["materialStatus"], "unconfirmed">;
};

export type JwStone2InventoryItem = {
  /** Stable internal inventory key. Anonymous keys must never become public labels. */
  id: string;
  publicName: string | null;
  publicSlug: string | null;
  nameStatus: JwStoneInventoryNameStatus;
  isNamed: boolean;
  isEligibleForPublicActions: boolean;
  categorySlug: string;
  categoryLabel: string;
  materialStatus: JwStoneInventoryStone["materialStatus"];
  images: readonly string[];
  shareImageOrder?: readonly number[];
  imageFinishes?: ReadonlyArray<readonly string[] | undefined>;
  /** Source counts are evidence from source inventory, never an availability claim. */
  sourceSlabCounts?: readonly number[];
  sourceSlabCountTotal?: number;
  material: JwStone2MaterialFact | null;
  verifiedFinishes: readonly string[];
  verifiedFinishLabel: string | null;
  dimensions?: JwStone2SuppliedFact;
  availability?: JwStone2SuppliedFact;
  translucency?: JwStone2SuppliedFact;
  origin: JwStone2OriginFact | null;
  /** Presentation navigation only; not a geological or inventory fact. */
  colorDirection: JwStone2ColorDirection;
};

export type JwStone2InventoryCategory = {
  categorySlug: string;
  categoryLabel: string;
  items: readonly JwStone2InventoryItem[];
};

export type JwStone2DiscoveryFilters = {
  buyer: JwStone2BuyerType | null;
  color: JwStone2ColorDirection | null;
  material: string | null;
  finish: string | null;
  size: string | null;
  availability: string | null;
  translucency: string | null;
  origin: string | null;
  stone: string | null;
};

export type JwStone2DiscoveryState = JwStone2DiscoveryFilters;

export type JwStone2DiscoveryStage = "buyer" | "color" | "results";

export type JwStone2FilterOption = {
  value: string;
  label: string;
  count: number;
};

export type JwStone2FilterOptions = {
  colors: readonly (JwStone2ColorDirectionOption & { count: number })[];
  materials: readonly JwStone2FilterOption[];
  finishes: readonly JwStone2FilterOption[];
  sizes: readonly JwStone2FilterOption[];
  availability: readonly JwStone2FilterOption[];
  translucency: readonly JwStone2FilterOption[];
  origins: readonly JwStone2FilterOption[];
  showOrigin: boolean;
};

export type JwStone2SafePublicSelection = {
  id: string;
  label: string;
};

export type JwStone2WishlistState = {
  version: 1;
  ids: readonly string[];
};

export type JwStone2WishlistLoadStatus =
  | "ok"
  | "empty"
  | "corrupt"
  | "unsupported-version"
  | "unavailable";

export type JwStone2WishlistLoadResult = {
  ids: string[];
  removedIds: string[];
  status: JwStone2WishlistLoadStatus;
};

export type JwStone2WishlistSaveResult =
  | { ok: true; ids: string[] }
  | { ok: false; ids: string[]; reason: "unavailable" | "full" };

export type JwStone2Storage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type JwStone2FirstCutAssignment = {
  stoneId: string;
};

export type JwStone2FirstCutAssignedSlot = {
  kind: "assigned";
  stone: JwStone2InventoryItem;
};

export type JwStone2FirstCutPlaceholder = {
  kind: "placeholder";
  slotKey: string;
  eyebrow: "First Cut Exclusive";
  title: "Upcoming reveal";
};

export type JwStone2FirstCutSlot = JwStone2FirstCutAssignedSlot | JwStone2FirstCutPlaceholder;

export type JwStone2SourceInventory = readonly JwStoneInventoryCategory[];
