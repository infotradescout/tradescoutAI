import { isHandOnlyStone } from "./coverImages";
import type { JwStoneCatalogItem } from "./types";

/** Cap the Trending rail when many homeless stones qualify. */
export const TRENDING_SECTION_CAP = 48;

export type SelectTrendingOptions = {
  /** Stone ids already shown in New Arrivals — keep Trending distinct. */
  excludeIds?: ReadonlySet<string>;
  limit?: number;
  /** When true, omit hand-only photo sets. Default keeps the full homeless set. */
  excludeHandOnly?: boolean;
};

/**
 * Homeless inventory for the Trending rail: anonymous / not wishlist-eligible
 * named homes. No CFA copy, no invented product names — cards stay photo +
 * palette + Ask.
 */
export function selectTrendingItems(
  catalog: readonly JwStoneCatalogItem[],
  options: SelectTrendingOptions = {}
): JwStoneCatalogItem[] {
  const limit = options.limit ?? TRENDING_SECTION_CAP;
  const excludeHandOnly = options.excludeHandOnly === true;
  const excludeIds = options.excludeIds;

  return catalog
    .filter((stone) => {
      if (!stone.anonymous && stone.wishlistEligible) return false;
      if (excludeIds?.has(stone.id)) return false;
      if (excludeHandOnly && isHandOnlyStone(stone.images)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, limit);
}
