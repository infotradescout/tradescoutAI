import {
  JW_STONE_CART_MAX_LINES,
  JW_STONE_CART_REVIEW_MAX_LINES,
  JW_STONE_CART_STORAGE_PREFIX,
  JW_STONE_LEGACY_CART_STORAGE_PREFIX,
  jwStoneInventoryPublicIdSchema,
  restoreJwStoneCart,
  type JwStoneCartDraft,
  type JwStoneCartSelection,
} from "../../../../shared/jwStoneCart";
import { jwStonePriceKey } from "../../../../shared/jwStoneMemberPricing";

export { JW_STONE_CART_STORAGE_PREFIX, JW_STONE_LEGACY_CART_STORAGE_PREFIX };
export type CartStorage = Pick<Storage, "getItem" | "setItem">;
export type CartSnapshot = Readonly<{ lines: readonly JwStoneCartSelection[]; persisted: boolean }>;

/** Canonical arrays and the earlier account-bound envelope share the same intent. */
function restoreStoredCart(value: unknown, viewerId: string): readonly JwStoneCartSelection[] {
  let raw = value;
  let branchEnvelope = false;
  if (!Array.isArray(raw)) {
    const envelope = raw as { version?: unknown; viewerId?: unknown; lines?: unknown } | null;
    if (
      !envelope ||
      envelope.version !== 2 ||
      envelope.viewerId !== viewerId ||
      !Array.isArray(envelope.lines)
    )
      throw new Error("Unreadable saved cart");
    raw = envelope.lines;
    branchEnvelope = true;
  }
  const input = (raw as unknown[]).map((value) => {
    if (!branchEnvelope || !value || typeof value !== "object" || Array.isArray(value))
      return value;
    const line = value as Record<string, unknown>;
    return {
      ...line,
      stoneKey: line.stoneKey ?? jwStonePriceKey(String(line.stoneName || "")),
      ...(line.kind === "lot" && jwStoneInventoryPublicIdSchema.safeParse(line.id).success
        ? { inventoryPublicId: line.id }
        : {}),
    };
  });
  const restored = restoreJwStoneCart(input);
  if (restored.length !== input.length) throw new Error("Unreadable saved cart");
  return restored;
}

export function jwStoneCartBatch(lines: readonly JwStoneCartSelection[], requestedPage: number) {
  const pages = Math.max(1, Math.ceil(lines.length / JW_STONE_CART_REVIEW_MAX_LINES));
  const page =
    Number.isInteger(requestedPage) && requestedPage >= 0 ? Math.min(requestedPage, pages - 1) : 0;
  const start = page * JW_STONE_CART_REVIEW_MAX_LINES;
  return { page, pages, start, lines: lines.slice(start, start + JW_STONE_CART_REVIEW_MAX_LINES) };
}

/** No automatic writes: mounting, switching accounts and signing out preserve saved data. */
export function createJwStoneCartStore(storage: CartStorage | null, viewerId: string) {
  if (!viewerId.trim() || viewerId.length > 200)
    throw new Error("A signed-in account is required for a cart.");
  const key = `${JW_STONE_CART_STORAGE_PREFIX}${viewerId}`;
  const legacyKey = `${JW_STONE_LEGACY_CART_STORAGE_PREFIX}${viewerId}`;
  let snapshot: CartSnapshot = { lines: [], persisted: true };
  let ephemeral = false;
  const listeners = new Set<() => void>();
  function publish(next: CartSnapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  function read(): CartSnapshot {
    if (!storage) return { lines: snapshot.lines, persisted: false };
    try {
      const raw = storage.getItem(key) ?? storage.getItem(legacyKey);
      if (raw !== null && raw.length > 256_000) throw new Error("Unreadable saved cart");
      return {
        lines: raw === null ? [] : restoreStoredCart(JSON.parse(raw), viewerId),
        persisted: true,
      };
    } catch {
      return { lines: snapshot.lines, persisted: false };
    }
  }
  function refresh() {
    if (!ephemeral) publish(read());
  }
  function change(
    operation: (lines: readonly JwStoneCartSelection[]) => readonly JwStoneCartSelection[]
  ) {
    const latest = ephemeral ? snapshot : read();
    const lines = operation(latest.lines);
    let persisted = false;
    try {
      // Once durability fails, preserve this visit's edits in memory. A later
      // successful read may contain another tab's changes and must not be replaced.
      if (!ephemeral && storage && latest.persisted && read().persisted) {
        storage.setItem(key, JSON.stringify(lines));
        persisted = true;
      }
    } catch {
      /* Keep visible edits and explicitly report their lack of durability. */
    }
    ephemeral = !persisted;
    publish({ lines, persisted });
  }
  snapshot = read();
  return {
    key,
    legacyKey,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    add(draft: JwStoneCartDraft) {
      change((lines) => {
        const item = restoreJwStoneCart([{ ...draft, quantity: 1 }])[0];
        if (!item) throw new Error("This selection cannot be added to the cart.");
        const existing = lines.find((line) => line.id === item.id);
        if (existing)
          return lines.map((line) =>
            line.id === item.id ? { ...line, quantity: Math.min(999, line.quantity + 1) } : line
          );
        if (lines.length >= JW_STONE_CART_MAX_LINES)
          throw new Error(
            "All 100 saved selections are preserved. Remove a selection before adding another."
          );
        return [...lines, item];
      });
    },
    setQuantity(id: string, quantity: number) {
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999)
        throw new Error("Choose a whole slab quantity from 0 to 999.");
      change((lines) =>
        quantity === 0
          ? lines.filter((line) => line.id !== id)
          : lines.map((line) => (line.id === id ? { ...line, quantity } : line))
      );
    },
    setStock(id: string, inventoryPublicId: string | undefined) {
      if (
        inventoryPublicId !== undefined &&
        !jwStoneInventoryPublicIdSchema.safeParse(inventoryPublicId).success
      )
        throw new Error("Choose a valid inventory lot.");
      change((lines) =>
        lines.map((line) => (line.id === id ? { ...line, inventoryPublicId } : line))
      );
    },
    clear() {
      change(() => []);
    },
  };
}
