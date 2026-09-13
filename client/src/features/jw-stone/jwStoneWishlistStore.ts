import {
  clearWishlist,
  loadWishlist,
  saveWishlist,
  toggleWishlistId,
  removeWishlistId,
  JW_STONE_WISHLIST_MAX_ITEMS,
} from "./wishlist";
import type { WishlistStorage } from "./types";
type Snapshot = Readonly<{
  ids: readonly string[];
  persisted: boolean;
  restored: boolean;
  notice: string;
}>;
export function createJwStoneWishlistStore(storage: WishlistStorage | null) {
  let snapshot: Snapshot = { ids: [], persisted: true, restored: false, notice: "" };
  let ephemeral = false;
  const listeners = new Set<() => void>();
  function publish(next: Snapshot) {
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    }
  }
  function latest() {
    if (ephemeral) return snapshot;
    const read = loadWishlist(storage);
    return {
      ids: read.persisted ? read.ids : snapshot.ids,
      persisted: read.persisted,
      restored: true,
      notice:
        read.status === "malformed" || read.status === "unsupported"
          ? "Some saved stones could not be restored from this browser."
          : "",
    };
  }
  function refresh() {
    if (!ephemeral) publish(latest());
  }
  function write(ids: readonly string[], notice = "") {
    const result = saveWishlist(storage, ids);
    ephemeral = !result.persisted;
    publish({ ...result, restored: true, notice });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    toggle(id: string) {
      const current = latest();
      if (!current.ids.includes(id) && current.ids.length >= JW_STONE_WISHLIST_MAX_ITEMS) {
        publish({
          ...current,
          notice: "You can save up to 50 stones. Remove one before adding another.",
        });
        return;
      }
      write(toggleWishlistId(current.ids, id));
    },
    remove(id: string) {
      write(removeWishlistId(latest().ids, id));
    },
    clear() {
      const result = clearWishlist(storage);
      ephemeral = !result.persisted;
      publish({ ...result, restored: true, notice: "" });
    },
  };
}
