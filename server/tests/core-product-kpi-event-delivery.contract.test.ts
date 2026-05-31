import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { logEventMock } = vi.hoisted(() => ({
  logEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../storage", () => ({
  storage: {
    logEvent: logEventMock,
  },
}));

import { registerAnalyticsRoutes } from "../routes/analytics-routes";

describe("core product KPI analytics delivery", () => {
  beforeEach(() => {
    logEventMock.mockClear();
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    registerAnalyticsRoutes(app);
    return app;
  }

  async function flushAsyncWork() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("persists HomeID and Direct Connect KPI events with key properties", async () => {
    const app = makeApp();

    const homeEvent = {
      type: "homeid_request_packet_ready",
      surface: "homes",
      userState: "authenticated",
      viewport: "desktop",
      source: "homeid_packet_readiness",
      homeId: "home_1",
      packetId: "packet_1",
      ts: new Date().toISOString(),
    };

    const directConnectEvent = {
      type: "direct_connect_homeid_link_selected",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: "mobile",
      source: "direct_connect_submit",
      homeId: "home_1",
      componentType: "hvac",
      ts: new Date().toISOString(),
    };

    const first = await request(app).post("/api/analytics/shell").send(homeEvent);
    const second = await request(app).post("/api/analytics/shell").send(directConnectEvent);
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(2);
    expect(logEventMock.mock.calls[0][0]).toBe("homeid_request_packet_ready");
    expect(logEventMock.mock.calls[0][1]).toMatchObject({
      type: "homeid_request_packet_ready",
      surface: "homes",
      homeId: "home_1",
      packetId: "packet_1",
      source: "homeid_packet_readiness",
    });
    expect(logEventMock.mock.calls[1][0]).toBe("direct_connect_homeid_link_selected");
    expect(logEventMock.mock.calls[1][1]).toMatchObject({
      type: "direct_connect_homeid_link_selected",
      surface: "direct_connect",
      homeId: "home_1",
      componentType: "hvac",
      source: "direct_connect_submit",
    });
  });

  it("persists Scout HomeID context and action-card KPI events", async () => {
    const app = makeApp();

    const contextViewedEvent = {
      type: "scout_homeid_context_viewed",
      surface: "scout",
      userState: "authenticated",
      viewport: "desktop",
      source: "scout_homeid_context_rail",
      homeId: "home_2",
      ts: new Date().toISOString(),
    };

    const actionCardClickedEvent = {
      type: "scout_homeid_action_card_clicked",
      surface: "scout",
      userState: "authenticated",
      viewport: "desktop",
      source: "maintenance_suggestion",
      homeId: "home_2",
      actionCardType: "create_request_packet",
      packetId: "packet_2",
      ts: new Date().toISOString(),
    };

    const first = await request(app).post("/api/analytics/shell").send(contextViewedEvent);
    const second = await request(app).post("/api/analytics/shell").send(actionCardClickedEvent);
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(2);
    expect(logEventMock.mock.calls[0][0]).toBe("scout_homeid_context_viewed");
    expect(logEventMock.mock.calls[0][1]).toMatchObject({
      type: "scout_homeid_context_viewed",
      surface: "scout",
      homeId: "home_2",
    });
    expect(logEventMock.mock.calls[1][0]).toBe("scout_homeid_action_card_clicked");
    expect(logEventMock.mock.calls[1][1]).toMatchObject({
      type: "scout_homeid_action_card_clicked",
      surface: "scout",
      actionCardType: "create_request_packet",
      packetId: "packet_2",
    });
  });
});
