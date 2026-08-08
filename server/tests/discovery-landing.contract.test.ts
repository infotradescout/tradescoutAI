import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildClientDiscoveryLandingPayload,
  normalizeDiscoverySourceHint,
  sanitizeDiscoveryLandingEvent,
} from "@shared/discoveryLanding";

const { logEventMock } = vi.hoisted(() => ({
  logEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../storage", () => ({
  storage: {
    logEvent: logEventMock,
  },
}));

import { registerAnalyticsRoutes } from "../routes/analytics-routes";

describe("discovery_landing sanitizer", () => {
  it("normalizes chatgpt.com utm to chatgpt without mechanism claims", () => {
    expect(normalizeDiscoverySourceHint("chatgpt.com")).toBe("chatgpt");
    expect(normalizeDiscoverySourceHint("ChatGPT")).toBe("chatgpt");
  });

  it("builds a sanitized payload without full URL or query string", () => {
    const payload = buildClientDiscoveryLandingPayload({
      canonicalRoute: "/jw-stone",
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
      searchParams: new URLSearchParams(
        "utm_source=chatgpt.com&utm_campaign=secret&stone=blue-dunes&email=leak@example.com"
      ),
      referrer: "https://chatgpt.com/c/thread-123?q=stone",
    });
    const safe = sanitizeDiscoveryLandingEvent(payload);

    expect(safe).toMatchObject({
      type: "discovery_landing",
      canonicalRoute: "/jw-stone",
      entityType: "business_marketplace",
      businessSlug: "jw-stone",
      sourceHint: "chatgpt",
      referrerHost: "chatgpt.com",
    });
    expect(JSON.stringify(safe)).not.toContain("utm_campaign");
    expect(JSON.stringify(safe)).not.toContain("blue-dunes");
    expect(JSON.stringify(safe)).not.toContain("leak@example.com");
    expect(JSON.stringify(safe)).not.toContain("thread-123");
    expect(JSON.stringify(safe)).not.toMatch(
      /ChatGPT Search definitely|OAI-SearchBot indexed|GPTBot caused/i
    );
  });

  it("rejects sensitive or out-of-scope payloads", () => {
    expect(
      sanitizeDiscoveryLandingEvent({
        type: "discovery_landing",
        canonicalRoute: "/admin",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
      })
    ).toBeNull();
    expect(
      sanitizeDiscoveryLandingEvent({
        type: "discovery_landing",
        canonicalRoute: "/business/acme-stone",
        entityType: "business_profile",
        businessSlug: "acme-stone",
        entryRequestId: "entry-123",
      })
    ).toMatchObject({
      canonicalRoute: "/business/acme-stone",
      entityType: "business_profile",
      businessSlug: "acme-stone",
      entryRequestId: "entry-123",
    });
    expect(
      sanitizeDiscoveryLandingEvent({
        type: "discovery_landing",
        canonicalRoute: "/business/acme-stone",
        entityType: "business_profile",
        businessSlug: "../other-biz",
      })
    ).toBeNull();
    expect(
      sanitizeDiscoveryLandingEvent({
        type: "discovery_landing",
        canonicalRoute: "/business/acme-stone",
        entityType: "business_profile",
        businessSlug: "other-biz",
      })
    ).toBeNull();
    // Query strings are stripped to the path — never persisted as part of the route.
    expect(
      sanitizeDiscoveryLandingEvent({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone?utm_source=chatgpt.com&phone=555",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
      })
    ).toMatchObject({
      canonicalRoute: "/jw-stone",
      businessSlug: "jw-stone",
    });
    expect(
      JSON.stringify(
        sanitizeDiscoveryLandingEvent({
          type: "discovery_landing",
          canonicalRoute: "/jw-stone?utm_source=chatgpt.com&phone=555",
          entityType: "business_marketplace",
          businessSlug: "jw-stone",
        })
      )
    ).not.toContain("phone");
  });
});

describe("discovery_landing analytics delivery", () => {
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

  it("persists one sanitized discovery_landing without raw IP or user-agent", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/analytics/shell")
      .set("User-Agent", "Mozilla/5.0 SecretBrowser/1.0")
      .set("X-Forwarded-For", "203.0.113.50")
      .set("Referer", "https://chatgpt.com/c/abc")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
        sourceHint: "chatgpt",
        referrerHost: "chatgpt.com",
        entryRequestId: "entry-request-123",
        ts: "2026-08-07T12:00:00.000Z",
        // Forbidden fields that must be dropped:
        landingUrl: "https://www.thetradescout.com/jw-stone?utm_source=chatgpt.com&phone=555",
        queryString: "utm_source=chatgpt.com&phone=555",
        messageText: "I want this stone",
        phoneNumber: "555-0100",
        email: "buyer@example.com",
        userAgent: "should-not-persist",
        ipAddress: "should-not-persist",
      });

    expect(res.status).toBe(204);
    await flushAsyncWork();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [eventType, payload] = logEventMock.mock.calls[0];
    expect(eventType).toBe("discovery_landing");
    expect(payload).toEqual({
      type: "discovery_landing",
      canonicalRoute: "/jw-stone",
      entityType: "business_marketplace",
      businessSlug: "jw-stone",
      sourceHint: "chatgpt",
      referrerHost: "chatgpt.com",
      entryRequestId: "entry-request-123",
      ts: "2026-08-07T12:00:00.000Z",
    });
    expect(payload).not.toHaveProperty("ipAddress");
    expect(payload).not.toHaveProperty("userAgent");
    expect(payload).not.toHaveProperty("landingUrl");
    expect(payload).not.toHaveProperty("queryString");
    expect(payload).not.toHaveProperty("phoneNumber");
    expect(JSON.stringify(payload)).not.toMatch(/mechanism|indexed this page|caused this lead/i);
  });

  it("returns 204 and skips persistence when sanitize rejects the event", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/analytics/shell").send({
      type: "discovery_landing",
      canonicalRoute: "/dashboard",
      entityType: "business_marketplace",
      businessSlug: "jw-stone",
    });
    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("stays non-blocking when persistence fails", async () => {
    logEventMock.mockRejectedValueOnce(new Error("db down"));
    const app = makeApp();
    const res = await request(app).post("/api/analytics/shell").send({
      type: "discovery_landing",
      canonicalRoute: "/jw-stone",
      entityType: "business_marketplace",
      businessSlug: "jw-stone",
      ts: "2026-08-07T12:00:00.000Z",
    });
    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).toHaveBeenCalledTimes(1);
  });
});
