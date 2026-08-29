import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerEventRoutes, type EventRoutesStorage } from "../routes/events";
import { resolveAnonymousSessionId } from "../utils/anonymousSession";

async function flushEventWrite() {
  await new Promise((resolve) => setImmediate(resolve));
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    query: {},
    ...overrides,
  } as any;
}

describe("anonymous session resolution", () => {
  it("prefers the server-owned Express session over caller inputs", () => {
    expect(
      resolveAnonymousSessionId(
        createRequest({
          sessionID: "server-session-123",
          headers: {
            "x-anonymous-session-id": "caller-header",
            cookie: "ts_dc_session=caller-cookie",
          },
          query: { anonymousSessionId: "caller-query" },
        })
      )
    ).toBe("server-session-123");
  });

  it("retains existing first-party header and cookie fallbacks", () => {
    expect(
      resolveAnonymousSessionId(
        createRequest({ headers: { "x-anonymous-session-id": "header-session" } })
      )
    ).toBe("header-session");
    expect(
      resolveAnonymousSessionId(
        createRequest({ headers: { cookie: "ts_dc_session=cookie-session" } })
      )
    ).toBe("cookie-session");
  });
});

describe("anonymous Direct Connect funnel persistence", () => {
  function createApp(storage: EventRoutesStorage, authenticated = false) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.sessionID = "server-session-123";
      if (authenticated) {
        req.user = { id: "user-123", contractorId: "contractor-123" };
      }
      next();
    });
    registerEventRoutes(app, { storage });
    return app;
  }

  it("links an anonymous funnel event without IP or browser fingerprint", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(createApp({ logEvent }))
      .post("/api/analytics/shell")
      .set("X-Anonymous-Session-Id", "caller-spoof")
      .set("User-Agent", "private browser fingerprint")
      .send({
        type: "direct_connect_request_started",
        surface: "direct_connect",
        userState: "anonymous",
        category: "service_request",
        field: "title",
        source: "/direct-connect?email=private@example.com",
        message: "private request text",
        phone: "9856626247",
      });
    await flushEventWrite();

    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledWith("direct_connect_request_started", {
      surface: "direct_connect",
      userState: "anonymous",
      category: "service_request",
      field: "title",
      routeTemplate: "/direct-connect",
      userId: null,
      contractorId: null,
      anonymousSessionId: "server-session-123",
      deviceClass: "desktop",
    });
    const persisted = logEvent.mock.calls[0]?.[1];
    expect(persisted).not.toHaveProperty("ipAddress");
    expect(persisted).not.toHaveProperty("userAgent");
    expect(JSON.stringify(persisted)).not.toContain("private request text");
    expect(JSON.stringify(persisted)).not.toContain("9856626247");
    expect(JSON.stringify(persisted)).not.toContain("caller-spoof");
  });

  it("uses the authenticated server identity instead of anonymous continuity", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(createApp({ logEvent }, true))
      .post("/api/analytics/shell")
      .send({
        type: "direct_connect_request_review_opened",
        surface: "direct_connect",
        userState: "authenticated",
        category: "service_request",
        hasBudget: true,
        attachmentCount: 2,
        homeContextIntent: "link_existing",
      });
    await flushEventWrite();

    expect(response.status).toBe(204);
    const persisted = logEvent.mock.calls[0]?.[1];
    expect(persisted).toMatchObject({
      userId: "user-123",
      contractorId: "contractor-123",
      category: "service_request",
      hasBudget: true,
      attachmentCount: 2,
      homeContextIntent: "link_existing",
    });
    expect(persisted).not.toHaveProperty("anonymousSessionId");
  });
});
