import { describe, expect, it } from "vitest";
import {
  parseHomeIdPersistenceGraph,
  resolveReadyHomeIdPacketGraph,
} from "../../shared/homeIdPacketAuthority";

const detail = (id: string) => ({
  id,
  category: "roof",
  note: "Roof replaced in 2024",
  status: "known" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  savedAt: "2026-08-01T00:00:00.000Z",
});

const packet = (selectedDetailIds = ["detail_1"]) => ({
  id: "packet_1",
  requestType: "repair",
  selectedDetailIds,
  missingHelpfulInfo: [],
  missingHelpfulInfoCount: 0,
  status: "ready_for_handoff" as const,
  createdAt: "2026-08-01T00:00:00.000Z",
  savedAt: "2026-08-01T00:00:00.000Z",
});

const persistence = (overrides: Record<string, unknown> = {}) => ({
  propertyDetails: [detail("detail_1")],
  requestPackets: [packet()],
  ...overrides,
});

describe("HomeID request-packet graph authority", () => {
  it("resolves only a complete ready packet and its exact details", () => {
    const result = resolveReadyHomeIdPacketGraph({
      persistence: persistence(),
      packetId: "packet_1",
      claimedSelectedDetailIds: ["detail_1"],
    });
    expect(result).toMatchObject({
      ok: true,
      graph: {
        packet: { id: "packet_1", selectedDetailIds: ["detail_1"] },
        selectedDetails: [{ id: "detail_1", category: "roof" }],
      },
    });
  });

  it("rejects a shape-only detail instead of treating its id as authority", () => {
    const result = resolveReadyHomeIdPacketGraph({
      persistence: persistence({ propertyDetails: [{ id: "detail_1" }] }),
      packetId: "packet_1",
      claimedSelectedDetailIds: ["detail_1"],
    });
    expect(result).toEqual({ ok: false, reason: "invalid_persistence_graph" });
  });

  it("rejects a shape-only packet instead of treating its id as authority", () => {
    const result = resolveReadyHomeIdPacketGraph({
      persistence: persistence({ requestPackets: [{ id: "packet_1" }] }),
      packetId: "packet_1",
      claimedSelectedDetailIds: ["detail_1"],
    });
    expect(result).toEqual({ ok: false, reason: "invalid_persistence_graph" });
  });

  it("rejects partial graphs when any selected detail is unresolved", () => {
    expect(
      parseHomeIdPersistenceGraph(
        persistence({ requestPackets: [packet(["detail_1", "detail_missing"])] })
      )
    ).toBeNull();
  });

  it("rejects claimed detail sets that do not exactly match the saved packet", () => {
    const result = resolveReadyHomeIdPacketGraph({
      persistence: persistence(),
      packetId: "packet_1",
      claimedSelectedDetailIds: ["detail_other"],
    });
    expect(result).toEqual({ ok: false, reason: "claimed_detail_set_mismatch" });
  });

  it("rejects non-ready and internally inconsistent packets", () => {
    const notReady = { ...packet(), status: "needs_info" as const };
    expect(
      resolveReadyHomeIdPacketGraph({
        persistence: persistence({ requestPackets: [notReady] }),
        packetId: "packet_1",
      })
    ).toEqual({ ok: false, reason: "packet_not_ready" });

    const inconsistent = {
      ...packet(),
      missingHelpfulInfo: ["Add an inspection date"],
      missingHelpfulInfoCount: 0,
    };
    expect(
      resolveReadyHomeIdPacketGraph({
        persistence: persistence({ requestPackets: [inconsistent] }),
        packetId: "packet_1",
      })
    ).toEqual({ ok: false, reason: "invalid_persistence_graph" });
  });
});
