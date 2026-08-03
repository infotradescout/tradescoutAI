import type { JwStoneMaterialStatus } from "@/data/jwStoneInventory";
import type { JwStoneInventoryNameStatus } from "@shared/jwStonePresentation";

export const BUYER_TYPES = ["fabricator", "builder", "designer", "homeowner"] as const;

export type BuyerType = (typeof BUYER_TYPES)[number];

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
  colorDirection: ColorDirectionId;
  images: readonly string[];
  shareImageOrder?: readonly number[];
  imageFinishes?: ReadonlyArray<readonly string[] | undefined>;
  materialId: string | null;
  materialLabel: string | null;
  materialStatus: JwStoneMaterialStatus;
  finishes: readonly string[];
  finishStatus: "explicit" | "unconfirmed";
  sourceEvidence: JwStoneSourceEvidence | null;
  origin: VerifiedOrigin | null;
}>;

export type CatalogFilters = Readonly<{
  color: ColorDirectionId;
  material?: string | null;
  finish?: string | null;
  origin?: string | null;
}>;

export type CatalogFilterOption = Readonly<{
  value: string;
  label: string;
  count: number;
}>;

export type MarketplaceUrlState = Readonly<{
  buyer: BuyerType | null;
  color: ColorDirectionId | null;
  material: string | null;
  finish: string | null;
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
