import type { JwStoneMaterialStatus } from "@/data/jwStoneInventory";
import type { JwStoneInventoryNameStatus } from "@shared/jwStonePresentation";

export const COLOR_DIRECTION_IDS = [
  "soft-light",
  "warm-earthy",
  "cool-serene",
  "deep-dramatic",
  "bold-expressive",
] as const;

export type ColorDirectionId = (typeof COLOR_DIRECTION_IDS)[number];

export type ColorDirection = Readonly<{
  id: ColorDirectionId;
  label: string;
  description: string;
}>;

export type VerifiedOrigin = Readonly<{
  country: string;
  verified: true;
  source: string;
}>;

export type JwStoneSourceEvidence = Readonly<{
  /** Source-file counts are evidence from the supplied inventory, not live availability. */
  counts: readonly number[];
}>;

export type JwStoneCatalogItem = Readonly<{
  /** Canonical internal inventory key. Never place an anonymous value in public state. */
  id: string;
  /** Safe public identity. Anonymous inventory intentionally uses null. */
  displayName: string | null;
  publicLabel: string;
  nameStatus: JwStoneInventoryNameStatus;
  anonymous: boolean;
  /** Named inventory may be shared and saved by this slug; anonymous inventory may not. */
  shareSlug: string | null;
  wishlistEligible: boolean;
  /** Editorial aesthetic/mood bucket (Soft & Light, Warm & Earthy, …). */
  colorDirection: ColorDirectionId;
  /**
   * Literal Color filter buckets derived from photographed dominant colors
   * (White, Blue, …). Never from stone display names.
   */
  colors: readonly string[];
  /** Top visual swatches (hex) from the cover photograph (adaptive 3–5). */
  colorSwatches: readonly string[];
  /**
   * Soft "Pairs with" colors derived from stone hues (complementary / split).
   * Not photographed — color-theory suggestions only.
   */
  pairingSwatches: readonly string[];
  images: readonly string[];
  shareImageOrder?: readonly number[];
  imageFinishes?: ReadonlyArray<readonly string[] | undefined>;
  materialId: string | null;
  materialLabel: string | null;
  materialStatus: JwStoneMaterialStatus;
  finishes: readonly string[];
  finishStatus: "explicit" | "unconfirmed";
  sourceEvidence: JwStoneSourceEvidence | null;
  /**
   * Slab size inches from Drive source filenames / reconciliation evidence.
   * Source evidence only — not a live availability claim.
   */
  slabDimensions: string | null;
  origin: VerifiedOrigin | null;
  thicknessCm?: number;
  /**
   * Best available arrival/added signal (ISO). Null when no evidence exists.
   * NEW ARRIVAL badge + New Arrivals rail use a 14-day window from this date.
   */
  arrivedAt: string | null;
}>;

export type CatalogFilters = Readonly<{
  /** Aesthetic / mood (Soft & Light, …). */
  aesthetic?: ColorDirectionId | null;
  /** Literal color bucket from photographed palette (White, Black, …). */
  color?: string | null;
  material?: string | null;
  /** Finish slug (local filter; not serialized to URL). */
  finish?: string | null;
  origin?: string | null;
}>;

export type CatalogFilterOption = Readonly<{
  value: string;
  label: string;
  count: number;
}>;

export type MarketplaceUrlState = Readonly<{
  aesthetic: ColorDirectionId | null;
  color: string | null;
  material: string | null;
  origin: string | null;
  /** Safe public share slug. Anonymous internal ids are never accepted here. */
  stone: string | null;
}>;

export type WishlistEnvelope = Readonly<{
  version: 1;
  ids: readonly string[];
}>;

export type WishlistStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type WishlistLoadStatus =
  | "empty"
  | "restored"
  | "reconciled"
  | "malformed"
  | "unsupported"
  | "unavailable";

export type WishlistSnapshot = Readonly<{
  ids: readonly string[];
  status: WishlistLoadStatus;
  persisted: boolean;
}>;

export type WishlistWriteResult = Readonly<{
  ids: readonly string[];
  persisted: boolean;
}>;
