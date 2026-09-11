type DiscoveryItem = {
  id: string;
  sellerId?: string;
  sourceType?: string;
  publicProfilePath?: string;
  price?: number | null;
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
    items.push(...page.items);
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
  for (const item of sources.flat()) {
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
  const items = [...byId.values()].sort((a, b) => {
    // Undated and unpriced catalog content makes no publication/price claim.
    if (query.sort === "price_asc" || query.sort === "price_desc") {
      if (a.price == null && b.price != null) return 1;
      if (b.price == null && a.price != null) return -1;
      const diff = a.price == null || b.price == null ? 0 : Number(a.price) - Number(b.price);
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
