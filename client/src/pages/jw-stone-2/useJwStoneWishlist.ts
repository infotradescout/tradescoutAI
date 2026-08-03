import { useCallback, useEffect, useMemo, useState } from "react";
import {
  JW_STONE_2_WISHLIST_STORAGE_KEY,
  clearJwStone2Wishlist,
  loadJwStone2Wishlist,
  saveJwStone2Wishlist,
  toggleJwStone2Wishlist,
} from "@/features/jw-stone-2/wishlistStorage";
import { JW_STONE_2_NAMED_STONES, getJwStone2ItemById } from "@/features/jw-stone-2/inventory";

function loadInitialWishlist() {
  const loaded = loadJwStone2Wishlist();
  if (loaded.status === "ok" && loaded.removedIds.length) {
    saveJwStone2Wishlist(loaded.ids);
  }
  return loaded;
}

export function useJwStoneWishlist() {
  const [initial] = useState(loadInitialWishlist);
  const [ids, setIds] = useState<string[]>(initial.ids);
  const [notice, setNotice] = useState<string | null>(
    initial.status === "corrupt" || initial.status === "unsupported-version"
      ? "Saved stones were safely reset because the stored list could not be read."
      : null
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== JW_STONE_2_WISHLIST_STORAGE_KEY) return;
      setIds(loadJwStone2Wishlist().ids);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const persist = useCallback((nextIds: string[]) => {
    setIds(nextIds);
    const result = saveJwStone2Wishlist(nextIds);
    if (!result.ok) {
      setNotice(
        result.reason === "full"
          ? "This browser is out of storage space. Your changes will last only for this visit."
          : "Browser storage is unavailable. Your changes will last only for this visit."
      );
    }
  }, []);

  const toggle = useCallback(
    (itemId: string) => {
      persist(toggleJwStone2Wishlist(ids, itemId));
    },
    [ids, persist]
  );

  const remove = useCallback(
    (itemId: string) => {
      if (!ids.includes(itemId)) return;
      persist(ids.filter((id) => id !== itemId));
    },
    [ids, persist]
  );

  const clear = useCallback(() => {
    setIds([]);
    if (!clearJwStone2Wishlist()) {
      setNotice("Browser storage is unavailable. The visible list has still been cleared.");
    }
  }, []);

  const items = useMemo(
    () =>
      ids.flatMap((id) => {
        const item = getJwStone2ItemById(id, JW_STONE_2_NAMED_STONES);
        return item ? [item] : [];
      }),
    [ids]
  );

  return {
    ids,
    savedIds: useMemo(() => new Set(ids), [ids]),
    items,
    notice,
    dismissNotice: () => setNotice(null),
    toggle,
    remove,
    clear,
  };
}
