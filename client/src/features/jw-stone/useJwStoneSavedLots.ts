import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createJwStoneSavedLotsStore, JW_STONE_SAVED_LOTS_KEY } from "./jwStoneSavedLotsStore";
let browserStore: ReturnType<typeof createJwStoneSavedLotsStore> | null = null;
export function useJwStoneSavedLots() {
  const store = useMemo(() => {
    if (typeof window === "undefined") return createJwStoneSavedLotsStore(null);
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Private/restricted browser. */ }
    return browserStore ??= createJwStoneSavedLotsStore(storage);
  }, []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.refresh();
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === JW_STONE_SAVED_LOTS_KEY) store.refresh(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [store]);
  return { ...snapshot, isSaved: (id: string) => snapshot.lots.some(lot => lot.id === id), toggle: store.toggle, remove: store.remove, clear: store.clear };
}
