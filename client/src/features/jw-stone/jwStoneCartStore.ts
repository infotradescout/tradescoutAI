import { addJwStoneCartLine, migrateJwStoneLegacyCart, normalizeJwStoneCart, setJwStoneCartQuantity, type JwStoneCartLine } from "../../../../shared/jwStoneCart";

export const JW_STONE_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v2:";
export const JW_STONE_LEGACY_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v1:";
export type CartStorage = Pick<Storage, "getItem" | "setItem">;
export type CartSnapshot = Readonly<{ lines: readonly JwStoneCartLine[]; persisted: boolean }>;
/** No automatic write effect: mounting, signing out, or restoring never empties a cart. */
export function createJwStoneCartStore(storage: CartStorage | null, viewerId: string) {
  if (!viewerId.trim() || viewerId.length > 200) throw new Error("A signed-in account is required for a cart.");
  const key = `${JW_STONE_CART_STORAGE_PREFIX}${viewerId}`;
  const legacyKey = `${JW_STONE_LEGACY_CART_STORAGE_PREFIX}${viewerId}`;
  let snapshot: CartSnapshot = { lines: [], persisted: true };
  let ephemeral = false;
  const listeners = new Set<() => void>();
  function publish(next: CartSnapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  }
  function read(): CartSnapshot {
    if (!storage) return { lines: snapshot.lines, persisted: false };
    try {
      const raw = storage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 2 || parsed?.viewerId !== viewerId || !Array.isArray(parsed.lines)) throw new Error("Invalid cart storage");
        return { lines: normalizeJwStoneCart(parsed.lines), persisted: true };
      }
      const legacy = storage.getItem(legacyKey);
      return { lines: legacy === null ? [] : migrateJwStoneLegacyCart(JSON.parse(legacy)), persisted: true };
    } catch { return { lines: snapshot.lines, persisted: false }; }
  }
  function refresh() {
    if (!ephemeral) publish(read());
  }
  function change(operation: (lines: readonly JwStoneCartLine[]) => readonly JwStoneCartLine[]) {
    const latest = ephemeral ? snapshot : read();
    const lines = operation(latest.lines);
    let persisted = false;
    try {
      if (storage) { storage.setItem(key, JSON.stringify({ version: 2, viewerId, lines })); persisted = true; }
    } catch { /* Preserve usable in-memory edits and expose the persistence failure. */ }
    ephemeral = !persisted;
    publish({ lines, persisted });
  }
  snapshot = read();
  return {
    key, legacyKey,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    add(line: Omit<JwStoneCartLine, "quantity">) { change(lines => addJwStoneCartLine(lines, line)); },
    setQuantity(id: string, value: number) { change(lines => setJwStoneCartQuantity(lines, id, value)); },
    clear() { change(() => []); },
  };
}
