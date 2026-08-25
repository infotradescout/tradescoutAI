import type { JwStoneCatalogItem } from "./types";

/**
 * Owner-confirmed JW Stone sales ranking.
 *
 * Rank 1 is intentionally called out in public UI. The remaining ranked stones
 * carry the shared Top Seller mark and follow the owner-supplied order.
 */
export const JW_STONE_TOP_SELLER_RANK_BY_SLUG: Readonly<Record<string, number>> =
  Object.freeze({
    "rhino-white": 1,
    "taj-mahal": 2,
    "bianco-carrara": 3,
  });

type TopSellerStone = Pick<JwStoneCatalogItem, "id" | "shareSlug">;

function topSellerSlug(stone: TopSellerStone | string): string {
  return typeof stone === "string" ? stone : stone.shareSlug || stone.id;
}

export function getJwStoneTopSellerRank(stone: TopSellerStone | string): number | null {
  return JW_STONE_TOP_SELLER_RANK_BY_SLUG[topSellerSlug(stone)] ?? null;
}

export function getJwStoneTopSellerLabel(stone: TopSellerStone | string): string | null {
  const rank = getJwStoneTopSellerRank(stone);
  if (rank === null) return null;
  return rank === 1 ? "#1 Top Seller" : "Top Seller";
}

/** Sort ranked stones first while preserving the existing order for all others. */
export function compareJwStoneTopSellerPriority(
  left: TopSellerStone,
  right: TopSellerStone
): number {
  const leftRank = getJwStoneTopSellerRank(left);
  const rightRank = getJwStoneTopSellerRank(right);

  if (leftRank === null && rightRank === null) return 0;
  if (leftRank === null) return 1;
  if (rightRank === null) return -1;
  return leftRank - rightRank;
}
