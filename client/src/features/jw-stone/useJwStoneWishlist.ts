import { useEffect, useMemo, useSyncExternalStore } from "react";
import { JW_STONE_NAMED_CATALOG, getCatalogItemById } from "./catalog";
import { JW_STONE_LEGACY_WISHLIST_STORAGE_KEY, JW_STONE_WISHLIST_STORAGE_KEY, getBrowserWishlistStorage } from "./wishlist";
import { createJwStoneWishlistStore } from "./jwStoneWishlistStore";
let browserStore: ReturnType<typeof createJwStoneWishlistStore> | null = null;
export function useJwStoneWishlist() {
  const store = useMemo(() => {
    if (typeof window === "undefined") return createJwStoneWishlistStore(null);
    return browserStore ??= createJwStoneWishlistStore(getBrowserWishlistStorage());
  }, []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.refresh();
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === JW_STONE_WISHLIST_STORAGE_KEY || event.key === JW_STONE_LEGACY_WISHLIST_STORAGE_KEY) store.refresh();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [store]);
  const items = useMemo(() => snapshot.ids.map(getCatalogItemById).filter((item): item is (typeof JW_STONE_NAMED_CATALOG)[number] => Boolean(item?.wishlistEligible && !item.anonymous)), [snapshot.ids]);
  return { ...snapshot, items, count: items.length, isSaved: (id: string) => snapshot.ids.includes(id), toggle: store.toggle, remove: store.remove, clear: store.clear };
}
