import { JW_STONE_2_INVENTORY, getJwStone2NamedItemBySlug } from "./inventory";
import type {
  JwStone2InventoryItem,
  JwStone2Storage,
  JwStone2WishlistLoadResult,
  JwStone2WishlistSaveResult,
  JwStone2WishlistState,
} from "./types";

export const JW_STONE_2_WISHLIST_STORAGE_KEY = "tradescout:jw-stone-2:wishlist";
export const JW_STONE_2_WISHLIST_VERSION = 1 as const;

function browserStorage(): JwStone2Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storage: JwStone2Storage | null | undefined) {
  return storage === undefined ? browserStorage() : storage;
}

export function reconcileJwStone2Wishlist(
  candidateIds: readonly unknown[],
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  const ids: string[] = [];
  const removedIds: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidateIds) {
    if (typeof candidate !== "string") {
      removedIds.push(String(candidate));
      continue;
    }
    const id = candidate.trim();
    if (!id || seen.has(id) || !getJwStone2NamedItemBySlug(id, inventory)) {
      removedIds.push(id);
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return { ids, removedIds };
}

export function loadJwStone2Wishlist(
  storage?: JwStone2Storage | null,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
): JwStone2WishlistLoadResult {
  const target = resolveStorage(storage);
  if (!target) return { ids: [], removedIds: [], status: "unavailable" };

  let serialized: string | null;
  try {
    serialized = target.getItem(JW_STONE_2_WISHLIST_STORAGE_KEY);
  } catch {
    return { ids: [], removedIds: [], status: "unavailable" };
  }
  if (!serialized) return { ids: [], removedIds: [], status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return { ids: [], removedIds: [], status: "corrupt" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ids: [], removedIds: [], status: "corrupt" };
  }
  const payload = parsed as Partial<JwStone2WishlistState>;
  if (payload.version !== JW_STONE_2_WISHLIST_VERSION) {
    return { ids: [], removedIds: [], status: "unsupported-version" };
  }
  if (!Array.isArray(payload.ids)) {
    return { ids: [], removedIds: [], status: "corrupt" };
  }

  const reconciled = reconcileJwStone2Wishlist(payload.ids, inventory);
  return { ...reconciled, status: "ok" };
}

function isStorageFull(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return (
    candidate.name === "QuotaExceededError" ||
    candidate.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    candidate.code === 22 ||
    candidate.code === 1014
  );
}

export function saveJwStone2Wishlist(
  candidateIds: readonly unknown[],
  storage?: JwStone2Storage | null,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
): JwStone2WishlistSaveResult {
  const { ids } = reconcileJwStone2Wishlist(candidateIds, inventory);
  const target = resolveStorage(storage);
  if (!target) return { ok: false, ids, reason: "unavailable" };

  const payload: JwStone2WishlistState = {
    version: JW_STONE_2_WISHLIST_VERSION,
    ids,
  };
  try {
    target.setItem(JW_STONE_2_WISHLIST_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, ids };
  } catch (error) {
    return { ok: false, ids, reason: isStorageFull(error) ? "full" : "unavailable" };
  }
}

export function toggleJwStone2Wishlist(
  currentIds: readonly string[],
  itemId: string,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  const { ids } = reconcileJwStone2Wishlist(currentIds, inventory);
  if (!getJwStone2NamedItemBySlug(itemId, inventory)) return ids;
  return ids.includes(itemId) ? ids.filter((id) => id !== itemId) : [...ids, itemId];
}

export function clearJwStone2Wishlist(storage?: JwStone2Storage | null) {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    target.removeItem(JW_STONE_2_WISHLIST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
