import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SCOUT_CONTEXT_CACHE_KEY,
  SCOUT_CONTEXT_CACHE_TTL_MS,
  clearScoutContextCache,
  getScoutContextCache,
  hasMaterialInScoutContext,
  patchScoutContextCache,
  readScoutContextPrefill,
  seedFromProfileMaterial,
  setScoutContextCache,
} from "./scoutContextCache";
import {
  nextMissingExplorerContextKey,
  resolveExplorerContextTurn,
  tryParseExplorerContextAnswer,
} from "@/scout/scoutExplorerContext";

describe("scoutContextCache", () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    });
    vi.stubGlobal("window", { localStorage: globalThis.localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("seeds profile material context with stone mirror and 30-minute TTL", () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const entry = seedFromProfileMaterial({
      profileSlug: "issa-build",
      profileName: "ISSA Build",
      itemId: "multi-green-onyx",
      itemName: "Multi Green Onyx",
      source: "lux_material_toggle",
    });

    expect(entry).toMatchObject({
      profileSlug: "issa-build",
      profileName: "ISSA Build",
      itemId: "multi-green-onyx",
      itemName: "Multi Green Onyx",
      stone: "multi-green-onyx",
      source: "lux_material_toggle",
      savedAt: now,
      expiresAt: now + SCOUT_CONTEXT_CACHE_TTL_MS,
    });
    expect(getScoutContextCache()).toEqual(entry);
    expect(readScoutContextPrefill()?.itemId).toBe("multi-green-onyx");
    expect(localStorage.getItem(SCOUT_CONTEXT_CACHE_KEY)).toContain("multi-green-onyx");
  });

  it("expires after 30 minutes and clears malformed payloads", () => {
    const now = 1_700_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    setScoutContextCache({
      source: "public_profile",
      profileSlug: "issa-build",
      itemId: "honey-onyx",
    });

    vi.setSystemTime(now + SCOUT_CONTEXT_CACHE_TTL_MS + 1);
    expect(getScoutContextCache()).toBeNull();

    localStorage.setItem(SCOUT_CONTEXT_CACHE_KEY, "{not-json");
    expect(getScoutContextCache()).toBeNull();
    clearScoutContextCache();
    expect(localStorage.getItem(SCOUT_CONTEXT_CACHE_KEY)).toBeNull();
  });

  it("rejects unsafe profile slugs", () => {
    expect(
      seedFromProfileMaterial({
        profileSlug: "../../admin",
        itemId: "honey-onyx",
      })
    ).toBeNull();
  });

  it("preserves explorer answers when seeding material and skips re-asking material", () => {
    patchScoutContextCache({
      city: "Austin",
      stateCode: "TX",
      source: "scout_explorer",
    });
    const seeded = seedFromProfileMaterial({
      profileSlug: "issa-build",
      itemId: "honey-onyx",
      itemName: "Honey Onyx",
      source: "lux_material_toggle",
    });
    expect(seeded?.city).toBe("Austin");
    expect(seeded?.stateCode).toBe("TX");
    expect(hasMaterialInScoutContext(seeded)).toBe(true);
    expect(
      nextMissingExplorerContextKey(seeded, "Tell me about this onyx stone for my kitchen")
    ).not.toBe("material");
  });

  it("asks for missing area, then resumes deferred Scout ask after answer", () => {
    const ask = resolveExplorerContextTurn({
      message: "Find a plumber near me",
      locality: null,
    });
    expect(ask.kind).toBe("ask");
    if (ask.kind !== "ask") return;
    expect(ask.key).toBe("area");
    expect(ask.cache.deferredMessage).toBe("Find a plumber near me");

    const answered = resolveExplorerContextTurn({
      message: "Austin, TX",
      locality: null,
    });
    expect(answered.kind).toBe("answered");
    if (answered.kind !== "answered") return;
    expect(answered.cache.city).toBe("Austin");
    expect(answered.cache.stateCode).toBe("TX");
    expect(answered.continueMessage).toBe("Find a plumber near me");
    expect(answered.cache.pendingAskKey).toBeUndefined();
    expect(readScoutContextPrefill()?.city).toBe("Austin");
  });

  it("parses material answers into the shared cache", () => {
    expect(tryParseExplorerContextAnswer("material", "Honey Onyx")).toMatchObject({
      itemName: "Honey Onyx",
      itemId: "honey-onyx",
      stone: "honey-onyx",
    });
  });
});
