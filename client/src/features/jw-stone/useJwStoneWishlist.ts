import { useEffect, useMemo, useSyncExternalStore } from "react";
import { JW_STONE_NAMED_CATALOG, getCatalogItemById } from "./catalog";
import {
  JW_STONE_LEGACY_WISHLIST_STORAGE_KEY,
  JW_STONE_WISHLIST_STORAGE_KEY,
  getBrowserWishlistStorage,
} from "./wishlist";
import { createJwStoneWishlistStore } from "./jwStoneWishlistStore";
import { useJwStoneSavedLots } from "./useJwStoneSavedLots";
let browserStore: ReturnType<typeof createJwStoneWishlistStore> | null = null;
export function useJwStoneWishlist() {
  const savedLots = useJwStoneSavedLots();
  const store = useMemo(() => {
    if (typeof window === "undefined") return createJwStoneWishlistStore(null);
    return (browserStore ??= createJwStoneWishlistStore(getBrowserWishlistStorage()));
  }, []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.refresh();
    const changed = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === JW_STONE_WISHLIST_STORAGE_KEY ||
        event.key === JW_STONE_LEGACY_WISHLIST_STORAGE_KEY
      )
        store.refresh();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [store]);
  const items = useMemo(
    () =>
      snapshot.ids
        .map(getCatalogItemById)
        .filter((item): item is (typeof JW_STONE_NAMED_CATALOG)[number] =>
          Boolean(item?.wishlistEligible && !item.anonymous)
        ),
    [snapshot.ids]
  );
  return {
    ...snapshot,
    items,
    savedLots: savedLots.lots,
    count: items.length + savedLots.lots.length,
    restored: snapshot.restored && savedLots.restored,
    persisted: snapshot.persisted && savedLots.persisted,
    notice: [snapshot.notice, savedLots.notice].filter(Boolean).join(" "),
    isSaved: (id: string) => snapshot.ids.includes(id) || savedLots.isSaved(id),
    toggle: store.toggle,
    remove: (id: string) => {
      if (/^stone_[a-f0-9]{32}$/.test(id)) savedLots.remove(id);
      else store.remove(id);
    },
    clear: () => {
      store.clear();
      savedLots.clear();
    },
  };
}
