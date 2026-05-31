import { beforeEach, describe, expect, it, vi } from "vitest";

const { trackShellEventMock } = vi.hoisted(() => ({
  trackShellEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  getDeviceType: () => "desktop",
  trackShellEvent: trackShellEventMock,
}));

import {
  __resetCoreProductAnalyticsSeenForTests,
  trackDirectConnectHomeIdLinkSelected,
  trackDirectConnectRequestStarted,
  trackHomeIdRequestPacketCreated,
  trackHomeIdRequestPacketReady,
  trackScoutHomeIdActionCardClicked,
  trackScoutHomeIdContextViewed,
} from "./coreProductAnalytics";

describe("coreProductAnalytics", () => {
  beforeEach(() => {
    trackShellEventMock.mockClear();
    __resetCoreProductAnalyticsSeenForTests();
  });

  it("dedupes scout context viewed events", () => {
    trackScoutHomeIdContextViewed({
      userState: "authenticated",
      homeId: "home_1",
    });
    trackScoutHomeIdContextViewed({
      userState: "authenticated",
      homeId: "home_1",
    });

    const eventTypes = trackShellEventMock.mock.calls.map((c) => c[0]?.type);
    expect(eventTypes).toEqual(["scout_homeid_context_viewed"]);
  });

  it("does not dedupe click/create/ready events", () => {
    trackDirectConnectRequestStarted({ userState: "authenticated", source: "direct_connect_ui" });
    trackDirectConnectHomeIdLinkSelected({
      userState: "authenticated",
      homeId: "home_1",
      componentType: "hvac",
    });
    trackHomeIdRequestPacketCreated({
      userState: "authenticated",
      homeId: "home_1",
      packetId: "packet_1",
    });
    trackHomeIdRequestPacketReady({
      userState: "authenticated",
      homeId: "home_1",
      packetId: "packet_1",
    });
    trackScoutHomeIdActionCardClicked({
      userState: "authenticated",
      homeId: "home_1",
      actionCardType: "create_request_packet",
      packetId: "packet_1",
    });
    trackScoutHomeIdActionCardClicked({
      userState: "authenticated",
      homeId: "home_1",
      actionCardType: "create_request_packet",
      packetId: "packet_1",
    });

    const eventTypes = trackShellEventMock.mock.calls.map((c) => c[0]?.type);
    expect(eventTypes).toEqual([
      "direct_connect_request_started",
      "direct_connect_homeid_link_selected",
      "homeid_request_packet_created",
      "homeid_request_packet_ready",
      "scout_homeid_action_card_clicked",
      "scout_homeid_action_card_clicked",
    ]);
  });
});
