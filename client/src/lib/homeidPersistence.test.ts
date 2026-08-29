import { beforeEach, describe, expect, it, vi } from "vitest";
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
      return memory.has(key) ? (memory.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      memory.set(key, String(value));
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
    installWindowStorage().clear();
    vi.restoreAllMocks();
  });

  it("loads from server and writes local cache when server data exists", async () => {
    const state = makeState();
    const fetcher = vi.fn(async () => ({ persistence: state }));

    const loaded = await loadHomeIdPersistence(HOME_ID, fetcher);
    expect(fetcher).toHaveBeenCalledWith("GET", "/api/homeid/home_123/persistence");
    expect(loaded.state?.propertyDetails).toHaveLength(1);
    expect(loaded.warning).toBeUndefined();
  });

  it("falls back to local when server load fails", async () => {
    const state = makeState();
    await saveHomeIdPersistence(HOME_ID, state);
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });

    const loaded = await loadHomeIdPersistence(HOME_ID, fetcher);
    expect(loaded.state?.requestPackets).toHaveLength(1);
    expect(loaded.warning).toBeUndefined();
  });

  it("saves to server and keeps local fallback warning on server error", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("server unavailable"));
    const result = await saveHomeIdPersistence(HOME_ID, makeState(), fetcher);

    expect(fetcher).toHaveBeenCalledWith("PUT", "/api/homeid/home_123/property-details", {
      propertyDetails: makeState().propertyDetails,
    });
    expect(result.warning).toContain("Server save unavailable");
  });

  it("rejects shape-only detail and packet objects returned by the server", async () => {
    const shapeOnlyDetail = vi.fn(async () => ({
      persistence: {
        ...makeState(),
        propertyDetails: [{ id: "detail_1" }],
      },
    }));
    const detailResult = await loadHomeIdPersistence(HOME_ID, shapeOnlyDetail);
    expect(detailResult.state).toBeNull();
    expect(detailResult.source).toBe("none");

    const shapeOnlyPacket = vi.fn(async () => ({
      persistence: {
        ...makeState(),
        requestPackets: [{ id: "packet_1" }],
      },
    }));
    const packetResult = await loadHomeIdPersistence(HOME_ID, shapeOnlyPacket);
    expect(packetResult.state).toBeNull();
    expect(packetResult.source).toBe("none");
  });

  it("rejects a packet graph whose selected detail is not complete and present", async () => {
    const state = makeState();
    state.requestPackets[0].selectedDetailIds = ["detail_missing"];
    const fetcher = vi.fn(async () => ({ persistence: state }));
    const loaded = await loadHomeIdPersistence(HOME_ID, fetcher);
    expect(loaded.state).toBeNull();
    expect(loaded.source).toBe("none");
  });
});
