import { describe, expect, it } from "vitest";
import {
  parseHomeIdComposerHandoff,
  resolveHomeIdComposerHandoff,
} from "./homeIdComposerHandoff";

describe("HomeID Direct Connect composer handoff", () => {
  it("parses bounded HomeID references and defaults to an update intent", () => {
    expect(
      parseHomeIdComposerHandoff(
        "/direct-connect?homeId=home_123&homePacketId=packet_456&homeContextIntent=unknown"
      )
    ).toEqual({
      homeId: "home_123",
      homePacketId: "packet_456",
      homeContextIntent: "update_from_request",
    });
    expect(parseHomeIdComposerHandoff("/direct-connect?homeId=../../secret")).toBeNull();
  });

  it("attaches only details loaded from the selected server packet", () => {
    const handoff = parseHomeIdComposerHandoff(
      "/direct-connect?homeId=home_123&homePacketId=packet_456"
    );
    expect(handoff).not.toBeNull();

    expect(
      resolveHomeIdComposerHandoff(handoff!, {
        persistence: {
          requestPackets: [
            {
              id: "packet_456",
              requestType: "inspection",
              selectedDetailIds: ["detail_roof", "url_only_detail"],
              status: "ready_for_handoff",
            },
          ],
          propertyDetails: [
            {
              id: "detail_roof",
              category: "roof",
              note: "Shingles were installed in 2021.",
            },
          ],
        },
      })
    ).toMatchObject({
      homeId: "home_123",
      homePacketId: "packet_456",
      homePacketSelectedDetailIds: ["detail_roof"],
      homePacketReadinessState: "ready_for_handoff",
      suggestedTitle: "Inspection for my home",
      suggestedDescription: "Roof: Shingles were installed in 2021.",
    });
  });

  it("fails closed when the requested packet is absent", () => {
    const handoff = parseHomeIdComposerHandoff(
      "/direct-connect?homeId=home_123&homePacketId=missing_packet"
    );
    expect(handoff).not.toBeNull();
    expect(
      resolveHomeIdComposerHandoff(handoff!, {
        persistence: { requestPackets: [], propertyDetails: [] },
      })
    ).toBeNull();
  });
});
