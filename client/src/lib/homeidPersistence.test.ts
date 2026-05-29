import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadHomeIdPersistence,
  saveHomeIdPersistence,
  type HomeIdPersistenceState,
} from "./homeidPersistence";

const HOME_ID = "home_123";

function installWindowStorage() {
  const memory = new Map<string, string>();
  const localStorageMock = {
    getItem(key: string) {
      return memory.has(key) ? memory.get(key)! : null;
    },
    setItem(key: string, value: string) {
      memory.set(key, String(value));
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: localStorageMock },
    configurable: true,
    writable: true,
  });
  return localStorageMock;
}

function makeState(): HomeIdPersistenceState {
  return {
    propertyDetails: [
      {
        id: "detail_1",
        category: "hvac",
        note: "Serviced in 2025",
        status: "known",
        createdAt: "2026-05-29T00:00:00.000Z",
        savedAt: "2026-05-29T00:00:00.000Z",
      },
    ],
    requestPackets: [
      {
        id: "packet_1",
        requestType: "inspection",
        selectedDetailIds: ["detail_1"],
        missingHelpfulInfo: ["Add roof"],
        missingHelpfulInfoCount: 1,
        status: "needs_info",
        createdAt: "2026-05-29T00:00:00.000Z",
        savedAt: "2026-05-29T00:00:00.000Z",
      },
    ],
    updatedAt: "2026-05-29T00:00:00.000Z",
  };
}

describe("homeidPersistence", () => {
  beforeEach(() => {
    const storage = installWindowStorage();
    storage.clear();
    vi.restoreAllMocks();
  });

  it("saves and loads persistence state", () => {
    const state = makeState();
    const saveResult = saveHomeIdPersistence(HOME_ID, state);
    expect(saveResult.ok).toBe(true);

    const loaded = loadHomeIdPersistence(HOME_ID);
    expect(loaded.warning).toBeUndefined();
    expect(loaded.state?.propertyDetails).toHaveLength(1);
    expect(loaded.state?.requestPackets).toHaveLength(1);
    expect(loaded.state?.propertyDetails[0]?.category).toBe("hvac");
    expect(loaded.state?.requestPackets[0]?.requestType).toBe("inspection");
  });

  it("returns non-blocking warning when stored JSON is invalid", () => {
    (window as any).localStorage.setItem("homeid:persistence:v1:home_123", "{invalid json");
    const loaded = loadHomeIdPersistence(HOME_ID);
    expect(loaded.state).toBeNull();
    expect(loaded.warning).toContain("could not be loaded");
  });

  it("returns non-blocking warning when localStorage write fails", () => {
    const setItemSpy = vi.spyOn((window as any).localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const result = saveHomeIdPersistence(HOME_ID, makeState());
    expect(setItemSpy).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.warning).toContain("could not be saved");
  });
});
