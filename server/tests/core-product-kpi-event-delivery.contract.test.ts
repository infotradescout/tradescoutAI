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

  it("persists Direct Connect home-record prompt conversion KPI events", async () => {
    const app = makeApp();
    const ts = new Date().toISOString();

    const promptViewedEvent = {
      type: "direct_connect_home_record_prompt_viewed",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: "desktop",
      source: "direct_connect_home_record_prompt_with_saved_home",
      homeId: "home_3",
      ts,
    };

    const linkSelectedEvent = {
      type: "direct_connect_home_record_link_selected",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: "desktop",
      source: "home_record_select_saved_home",
      homeId: "home_3",
      componentType: "hvac",
      ts,
    };

    const createSelectedEvent = {
      type: "direct_connect_home_record_create_selected",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: "desktop",
      source: "home_record_intent_select_create",
      componentType: "roof",
      ts,
    };

    const skippedEvent = {
      type: "direct_connect_home_record_skipped",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: "mobile",
      source: "home_record_intent_select_skip",
      componentType: "other",
      ts,
    };

    const submitAfterSkipEvent = {
      type: "direct_connect_request_submitted_after_home_record_skip",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: "mobile",
      source: "direct_connect_submit_after_home_record_skip",
      ts,
    };

    expect((await request(app).post("/api/analytics/shell").send(promptViewedEvent)).status).toBe(
      204
    );
    expect((await request(app).post("/api/analytics/shell").send(linkSelectedEvent)).status).toBe(
      204
    );
    expect((await request(app).post("/api/analytics/shell").send(createSelectedEvent)).status).toBe(
      204
    );
    expect((await request(app).post("/api/analytics/shell").send(skippedEvent)).status).toBe(204);
    expect(
      (await request(app).post("/api/analytics/shell").send(submitAfterSkipEvent)).status
    ).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(5);
    expect(logEventMock.mock.calls[0][0]).toBe("direct_connect_home_record_prompt_viewed");
    expect(logEventMock.mock.calls[1][0]).toBe("direct_connect_home_record_link_selected");
    expect(logEventMock.mock.calls[2][0]).toBe("direct_connect_home_record_create_selected");
    expect(logEventMock.mock.calls[3][0]).toBe("direct_connect_home_record_skipped");
    expect(logEventMock.mock.calls[4][0]).toBe(
      "direct_connect_request_submitted_after_home_record_skip"
    );
  });

  it("persists landing-attributed Direct Connect request-start KPI events", async () => {
    const app = makeApp();
    const event = {
      type: "direct_connect_request_started",
      surface: "direct_connect",
      userState: "anonymous",
      viewport: "desktop",
      source: "landing_primary_cta",
      ts: new Date().toISOString(),
    };

    const response = await request(app).post("/api/analytics/shell").send(event);
    expect(response.status).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    expect(logEventMock.mock.calls[0][0]).toBe("direct_connect_request_started");
    expect(logEventMock.mock.calls[0][1]).toMatchObject({
      type: "direct_connect_request_started",
      surface: "direct_connect",
      userState: "anonymous",
      source: "landing_primary_cta",
    });
  });

  it("persists landing-attributed Direct Connect request-submitted KPI events", async () => {
    const app = makeApp();
    const event = {
      type: "direct_connect_request_submitted",
      category: "roofing",
      hasBudget: true,
      attachmentCount: 1,
      dispatchMode: "top_count",
      dispatchCount: 2,
      directTargets: 0,
      source: "landing_primary_cta",
      deviceType: "desktop",
      ts: new Date().toISOString(),
    };

    const response = await request(app).post("/api/analytics/shell").send(event);
    expect(response.status).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    expect(logEventMock.mock.calls[0][0]).toBe("direct_connect_request_submitted");
    expect(logEventMock.mock.calls[0][1]).toMatchObject({
      type: "direct_connect_request_submitted",
      category: "roofing",
      source: "landing_primary_cta",
    });
  });
});
