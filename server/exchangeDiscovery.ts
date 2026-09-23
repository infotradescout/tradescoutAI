import { currentPublicStone, currentStoneFeedItems, isStoneDiscoveryRow, stoneDiscoveryContext } from "./services/exchangeStoneDiscovery";
import { stoneSlabMaterialPriceRange } from "../shared/exchangeStoneBuyerFlow";

type DiscoveryItem = {
  id: string;
  sellerId?: string;
  sourceType?: string;
  publicProfilePath?: string;
  price?: number | null;
  specifications?: Record<string, unknown>;
  createdAt?: string | Date | null;
};

export function exchangePageWindow(query: { offset?: unknown; limit?: unknown }) {
  const offset = Number(query.offset);
  const limit = Number(query.limit);
  return {
    offset: Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0,
    limit:
      query.limit == null || query.limit === "" || !Number.isFinite(limit)
        ? 48
        : Math.min(100, Math.max(1, Math.floor(limit))),
  };
}

/** Read before final pagination; an offset must never be applied to each source. */
export async function readExchangeSourcePages<T>(
  load: (offset: number, limit: number) => Promise<{ items: T[]; sourceCount: number }>,
  wanted?: number
): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await load(offset, 100);
    // The separately approved national source owns retail rows. Hidden rows must not fill a page.
    items.push(...page.items.filter(item => !isStoneDiscoveryRow(item)));
    if (page.sourceCount < 100 || (wanted != null && items.length >= wanted)) return items;
  }
}

/** One stable order and page across native sale rows, offers and catalog items. */
export function mergeExchangeDiscoveryItems<T extends DiscoveryItem>(
  sources: T[][],
  query: { sort?: unknown; offset?: unknown; limit?: unknown } = {}
): T[] {
  const byId = new Map<string, T>();
  const profilePaths = new Set<string>();
  const retail = currentStoneFeedItems();
  const approved = new Set(retail.map(item => item.id));
  for (const raw of [...sources.flat(), ...retail]) {
    const item = (isStoneDiscoveryRow(raw)
      ? (!stoneDiscoveryContext()?.feed || approved.has(raw.id)) && currentPublicStone(raw.id)
      : raw) as T | null;
    if (!item) continue;
    if (byId.has(item.id)) continue;
    const profileKey =
      item.sourceType === "profile_catalog" && item.publicProfilePath
        ? `${item.sellerId}:${item.publicProfilePath}`
        : "";
    if (profileKey && profilePaths.has(profileKey)) continue;
    if (profileKey) profilePaths.add(profileKey);
    byId.set(item.id, item);
  }
  const timestamp = (item: T) => {
    const time = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  };
  const sortPrices = new Map<string, number | null>();
  const priceForSort = (item: T): number | null => {
    if (sortPrices.has(item.id)) return sortPrices.get(item.id)!;
    // A range sorts by its highest displayed slab material estimate. A slab
    // with no dimensions has no total and stays after priced items either way.
    const retailStone = isStoneDiscoveryRow(item);
    const range = retailStone
      ? stoneSlabMaterialPriceRange(item.price, item.specifications?.priceUnit,
        item.specifications?.referenceSizesInches, item.specifications?.exactSlab)
      : null;
    const value = retailStone ? (range ? range.maximumCents / 100 : null) : item.price ?? null;
    sortPrices.set(item.id, value);
    return value;
  };
  const items = [...byId.values()].sort((a, b) => {
    // Undated and unpriced catalog content makes no publication/price claim.
    if (query.sort === "price_asc" || query.sort === "price_desc") {
      const aPrice = priceForSort(a), bPrice = priceForSort(b);
      if (aPrice == null && bPrice != null) return 1;
      if (bPrice == null && aPrice != null) return -1;
      const diff = aPrice == null || bPrice == null ? 0 : Number(aPrice) - Number(bPrice);
      if (diff) return query.sort === "price_desc" ? -diff : diff;
    } else {
      if (!a.createdAt && b.createdAt) return 1;
      if (!b.createdAt && a.createdAt) return -1;
      const diff = timestamp(a) - timestamp(b);
      if (diff) return query.sort === "date_asc" ? diff : -diff;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const { offset, limit } = exchangePageWindow(query);
  return items.slice(offset, offset + limit);
}
