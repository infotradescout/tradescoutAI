import { describe, expect, it, vi } from "vitest";
import type { JwStone2Storage } from "./types";
import {
  JW_STONE_2_WISHLIST_STORAGE_KEY,
  clearJwStone2Wishlist,
  loadJwStone2Wishlist,
  reconcileJwStone2Wishlist,
  saveJwStone2Wishlist,
  toggleJwStone2Wishlist,
} from "./wishlistStorage";

function memoryStorage(): JwStone2Storage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("JW Stone 2.0 no-account wishlist storage", () => {
  it("persists stable named IDs in a minimal versioned payload across reloads", () => {
    const storage = memoryStorage();
    expect(saveJwStone2Wishlist(["amazonic-green", "taj-mahal"], storage)).toEqual({
      ok: true,
      ids: ["amazonic-green", "taj-mahal"],
    });
    expect(storage.values.get(JW_STONE_2_WISHLIST_STORAGE_KEY)).toBe(
      '{"version":1,"ids":["amazonic-green","taj-mahal"]}'
    );
    expect(storage.values.get(JW_STONE_2_WISHLIST_STORAGE_KEY)).not.toMatch(
      /Amazonic Green|price|origin|finish/i
    );
    expect(loadJwStone2Wishlist(storage)).toEqual({
      ids: ["amazonic-green", "taj-mahal"],
      removedIds: [],
      status: "ok",
    });
  });

  it("never saves anonymous inventory and reconciles duplicates and removed IDs", () => {
    expect(
      reconcileJwStone2Wishlist([
        "amazonic-green",
        "trending-selection-05",
        "removed-stone",
        "amazonic-green",
      ])
    ).toEqual({
      ids: ["amazonic-green"],
      removedIds: ["trending-selection-05", "removed-stone", "amazonic-green"],
    });
    const storage = memoryStorage();
    saveJwStone2Wishlist(["trending-selection-05"], storage);
    expect(loadJwStone2Wishlist(storage).ids).toEqual([]);
  });

  it("toggles eligibility without storage or contact side effects", () => {
    expect(toggleJwStone2Wishlist([], "taj-mahal")).toEqual(["taj-mahal"]);
    expect(toggleJwStone2Wishlist(["taj-mahal"], "taj-mahal")).toEqual([]);
    expect(toggleJwStone2Wishlist([], "trending-selection-01")).toEqual([]);
  });

  it("fails safely for malformed and unsupported payloads", () => {
    const storage = memoryStorage();
    storage.values.set(JW_STONE_2_WISHLIST_STORAGE_KEY, "not json");
    expect(loadJwStone2Wishlist(storage)).toEqual({
      ids: [],
      removedIds: [],
      status: "corrupt",
    });
    storage.values.set(JW_STONE_2_WISHLIST_STORAGE_KEY, '{"version":2,"ids":[]}');
    expect(loadJwStone2Wishlist(storage).status).toBe("unsupported-version");
    storage.values.set(JW_STONE_2_WISHLIST_STORAGE_KEY, '{"version":1,"ids":"bad"}');
    expect(loadJwStone2Wishlist(storage).status).toBe("corrupt");
  });

  it("fails safely when browser storage is blocked, unavailable, or full", () => {
    const blockedRead: JwStone2Storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    expect(loadJwStone2Wishlist(blockedRead).status).toBe("unavailable");
    expect(saveJwStone2Wishlist(["taj-mahal"], null)).toEqual({
      ok: false,
      ids: ["taj-mahal"],
      reason: "unavailable",
    });

    const full: JwStone2Storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
      }),
      removeItem: vi.fn(),
    };
    expect(saveJwStone2Wishlist(["taj-mahal"], full)).toEqual({
      ok: false,
      ids: ["taj-mahal"],
      reason: "full",
    });
  });

  it("clears storage safely", () => {
    const storage = memoryStorage();
    saveJwStone2Wishlist(["taj-mahal"], storage);
    expect(clearJwStone2Wishlist(storage)).toBe(true);
    expect(loadJwStone2Wishlist(storage).status).toBe("empty");
  });
});
