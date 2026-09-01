import { describe, expect, it } from "vitest";
import { resolveHomeIdDirectConnectHandoff } from "./homeIdDirectConnectHandoff";

describe("HomeID Direct Connect handoff", () => {
  it("resolves only details selected by the owned packet", () => {
    const result = resolveHomeIdDirectConnectHandoff(
      {
        requestPackets: [
          {
            id: "packet-1",
            requestType: "repair",
            selectedDetailIds: ["detail-2", "detail-1", "detail-2"],
            status: "ready_for_handoff",
          },
        ],
        propertyDetails: [
          { id: "detail-1", note: "Roof leak over the back room" },
          { id: "detail-2", note: "Metal roof installed in 2016" },
          { id: "detail-3", note: "Private detail that was not selected" },
        ],
      },
      "packet-1"
    );

    expect(result).toEqual({
      packetId: "packet-1",
      selectedDetailIds: ["detail-2", "detail-1"],
      selectedDetailCount: 2,
      requestType: "service_request",
      title: "Repair request",
      description:
        "HomeID details:\n- Roof leak over the back room\n- Metal roof installed in 2016",
      readinessState: "ready_for_handoff",
    });
    expect(result?.description).not.toContain("Private detail");
  });

  it("does not claim readiness for a packet that still needs information", () => {
    const result = resolveHomeIdDirectConnectHandoff(
      {
        requestPackets: [
          {
            id: "packet-2",
            requestType: "other",
            selectedDetailIds: [],
            status: "needs_info",
          },
        ],
      },
      "packet-2"
    );

    expect(result).toMatchObject({
      packetId: "packet-2",
      requestType: "other",
    });
    expect(result).not.toHaveProperty("readinessState");
  });

  it("rejects a packet reference absent from the persistence response", () => {
    expect(
      resolveHomeIdDirectConnectHandoff({ requestPackets: [] }, "not-owned-or-missing")
    ).toBeNull();
  });
});
