import { useCallback, useEffect, useMemo, useState } from "react";
import { JW_STONE_NAMED_CATALOG, getCatalogItemById } from "./catalog";
import {
  JW_STONE_LEGACY_WISHLIST_STORAGE_KEY,
  JW_STONE_WISHLIST_STORAGE_KEY,
  clearWishlist,
  getBrowserWishlistStorage,
  loadWishlist,
  removeWishlistId,
  saveWishlist,
  toggleWishlistId,
} from "./wishlist";

export function useJwStoneWishlist() {
  const [ids, setIds] = useState<readonly string[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [restored, setRestored] = useState(false);

  const restore = useCallback(() => {
    const snapshot = loadWishlist(getBrowserWishlistStorage());
    setIds(snapshot.ids);
    setPersisted(snapshot.persisted);
    setRestored(true);
  }, []);

  useEffect(() => {
    restore();
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === JW_STONE_WISHLIST_STORAGE_KEY ||
        event.key === JW_STONE_LEGACY_WISHLIST_STORAGE_KEY
      ) {
        restore();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [restore]);

  const persist = useCallback((nextIds: readonly string[]) => {
    const result = saveWishlist(getBrowserWishlistStorage(), nextIds);
    setPersisted(result.persisted);
    return result.ids;
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => persist(toggleWishlistId(current, id)));
    },
    [persist]
  );

  const remove = useCallback(
    (id: string) => {
      setIds((current) => persist(removeWishlistId(current, id)));
    },
    [persist]
  );

  const clear = useCallback(() => {
    const result = clearWishlist(getBrowserWishlistStorage());
    setIds([]);
    setPersisted(result.persisted);
  }, []);

  const items = useMemo(
    () =>
      ids
        .map((id) => getCatalogItemById(id))
        .filter((item): item is (typeof JW_STONE_NAMED_CATALOG)[number] =>
          Boolean(item?.wishlistEligible && !item.anonymous)
        ),
    [ids]
  );

  return {
    ids,
    items,
    count: items.length,
    persisted,
    restored,
    isSaved: (id: string) => ids.includes(id),
    toggle,
    remove,
    clear,
  };
}
