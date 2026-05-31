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

describe("first-use KPI analytics delivery", () => {
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

  it("persists first-use guidance and launcher lifecycle events for anonymous users", async () => {
    const app = makeApp();
    const event = {
      type: "first_use_guidance_viewed",
      surface: "landing",
      userState: "anonymous",
      viewport: "mobile",
      ts: new Date().toISOString(),
    };

    const res = await request(app).post("/api/analytics/shell").send(event);
    expect(res.status).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [eventType, payload] = logEventMock.mock.calls[0];
    expect(eventType).toBe("first_use_guidance_viewed");
    expect(payload).toMatchObject({
      type: "first_use_guidance_viewed",
      surface: "landing",
      userState: "anonymous",
      viewport: "mobile",
    });
  });

  it("persists first-use option click and task prompt click for authenticated users", async () => {
    const app = makeApp();
    const optionEvent = {
      type: "first_use_option_clicked",
      surface: "home",
      optionId: "keep_track",
      targetRoute: "/homes",
      userState: "authenticated",
      viewport: "desktop",
      ts: new Date().toISOString(),
    };

    const promptEvent = {
      type: "first_use_task_prompt_clicked",
      surface: "direct_connect",
      promptMessage: "Start a local work request.",
      ctaLabel: "Start request",
      targetRoute: "/direct-connect",
      userState: "authenticated",
      viewport: "desktop",
      ts: new Date().toISOString(),
    };

    const first = await request(app).post("/api/analytics/shell").send(optionEvent);
    const second = await request(app).post("/api/analytics/shell").send(promptEvent);
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(2);
    expect(logEventMock.mock.calls[0][0]).toBe("first_use_option_clicked");
    expect(logEventMock.mock.calls[0][1]).toMatchObject({
      optionId: "keep_track",
      targetRoute: "/homes",
      userState: "authenticated",
    });
    expect(logEventMock.mock.calls[1][0]).toBe("first_use_task_prompt_clicked");
    expect(logEventMock.mock.calls[1][1]).toMatchObject({
      ctaLabel: "Start request",
      targetRoute: "/direct-connect",
      userState: "authenticated",
    });
  });
});
