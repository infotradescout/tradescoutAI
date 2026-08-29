import { describe, expect, it } from "vitest";
import { buildHomeIdHandoffPreview } from "./homeidHandoffPreview";
import type { HomeIdPropertyDetail, HomeIdRequestPacket } from "./homeidPersistence";

function detail(id: string, category: string, note: string): HomeIdPropertyDetail {
  return {
    id,
    category,
    note,
    status: "known",
    createdAt: "2026-05-29T00:00:00.000Z",
    savedAt: "2026-05-29T00:00:00.000Z",
  };
}

function packet(status: HomeIdRequestPacket["status"]): HomeIdRequestPacket {
  return {
    id: "packet_1",
    requestType: "inspection",
    selectedDetailIds: ["detail_1"],
    missingHelpfulInfo: [],
    missingHelpfulInfoCount: 0,
    status,
    createdAt: "2026-05-29T00:00:00.000Z",
    savedAt: "2026-05-29T01:00:00.000Z",
  };
}

describe("buildHomeIdHandoffPreview", () => {
  it("builds preview for ready packet", () => {
    const preview = buildHomeIdHandoffPreview({
      homeId: "home_1",
      homeType: "single_family",
      creatorRole: "homeowner",
      packet: packet("ready_for_handoff"),
      propertyDetails: [detail("detail_1", "roof", "Roof replaced in 2021")],
      nonBlockingContext: ["Consider adding paint records"],
      now: "2026-05-29T02:00:00.000Z",
    });
    expect(preview).not.toBeNull();
    expect(preview?.requestType).toBe("inspection");
    expect(preview?.packetSavedAt).toBe("2026-05-29T01:00:00.000Z");
    expect(preview?.generatedAt).toBe("2026-05-29T02:00:00.000Z");
  });

  it("returns null for non-ready packet", () => {
    const preview = buildHomeIdHandoffPreview({
      homeId: "home_1",
      homeType: "single_family",
      creatorRole: "homeowner",
      packet: packet("needs_info"),
      propertyDetails: [detail("detail_1", "roof", "Roof replaced in 2021")],
      nonBlockingContext: [],
    });
    expect(preview).toBeNull();
  });

  it("includes selected details only and excludes unselected details", () => {
    const preview = buildHomeIdHandoffPreview({
      homeId: "home_1",
      homeType: "single_family",
      creatorRole: "homeowner",
      packet: packet("ready_for_handoff"),
      propertyDetails: [
        detail("detail_1", "roof", "Roof replaced in 2021"),
        detail("detail_2", "hvac", "HVAC serviced 2025"),
      ],
      nonBlockingContext: [],
    });
    expect(preview?.selectedPropertyDetails).toHaveLength(1);
    expect(preview?.selectedPropertyDetails[0]?.id).toBe("detail_1");
  });

  it("does not create side effects", () => {
    const preview = buildHomeIdHandoffPreview({
      homeId: "home_1",
      homeType: "single_family",
      creatorRole: "homeowner",
      packet: packet("ready_for_handoff"),
      propertyDetails: [detail("detail_1", "roof", "Roof replaced in 2021")],
      nonBlockingContext: [],
      now: "2026-05-29T02:00:00.000Z",
    });
    expect(preview && "dispatchId" in preview).toBe(false);
    expect(preview && "directConnectRequestId" in preview).toBe(false);
  });

  it("rejects a partial detail graph even when one selected detail resolves", () => {
    const partialPacket = {
      ...packet("ready_for_handoff"),
      selectedDetailIds: ["detail_1", "detail_missing"],
    };
    const preview = buildHomeIdHandoffPreview({
      homeId: "home_1",
      homeType: "single_family",
      creatorRole: "homeowner",
      packet: partialPacket,
      propertyDetails: [detail("detail_1", "roof", "Roof replaced in 2021")],
      nonBlockingContext: [],
    });
    expect(preview).toBeNull();
  });

  it("rejects shape-only detail and packet objects at the client boundary", () => {
    expect(
      buildHomeIdHandoffPreview({
        homeId: "home_1",
        homeType: "single_family",
        creatorRole: "homeowner",
        packet: packet("ready_for_handoff"),
        propertyDetails: [{ id: "detail_1" } as HomeIdPropertyDetail],
        nonBlockingContext: [],
      })
    ).toBeNull();

    expect(
      buildHomeIdHandoffPreview({
        homeId: "home_1",
        homeType: "single_family",
        creatorRole: "homeowner",
        packet: { id: "packet_1" } as HomeIdRequestPacket,
        propertyDetails: [detail("detail_1", "roof", "Roof replaced in 2021")],
        nonBlockingContext: [],
      })
    ).toBeNull();
  });
});
