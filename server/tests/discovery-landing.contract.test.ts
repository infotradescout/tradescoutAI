import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildClientDiscoveryLandingPayload,
  normalizeDiscoveryAttributionToken,
  sanitizeDiscoveryLandingEvent,
} from "@shared/discoveryLanding";
import {
  issueDiscoveryAttributionToken,
  verifyDiscoveryAttributionToken,
} from "../utils/discoveryAttribution";

process.env.DISCOVERY_ATTRIBUTION_SECRET = "discovery-landing-contract-secret";

const { logEventMock } = vi.hoisted(() => ({
  logEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../storage", () => ({
  storage: {
    logEvent: logEventMock,
  },
}));

import { registerAnalyticsRoutes } from "../routes/analytics-routes";

function issueToken(
  businessSlug: string,
  canonicalRoute: string,
  entityType: "business_marketplace" | "business_profile" = "business_profile"
): string {
  const token = issueDiscoveryAttributionToken({
    businessSlug,
    canonicalRoute,
    entityType,
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
  });
  if (!token) throw new Error("Expected discovery attribution token");
  return token;
}

describe("signed discovery attribution", () => {
  it("issues a separate identifier instead of reusing an HTTP request id", () => {
    const token = issueToken("jw-stone", "/jw-stone", "business_marketplace");
    const verified = verifyDiscoveryAttributionToken(token);

    expect(verified).toMatchObject({
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
      canonicalRoute: "/jw-stone",
    });
    expect(verified?.entryRequestId).toBeTruthy();
    expect(verified?.entryRequestId).not.toBe("incoming-http-request-id");
    expect(normalizeDiscoveryAttributionToken(token)).toBe(token);
  });

  it("rejects tampered tokens and tokens bound to another business or route", () => {
    const businessAToken = issueToken("business-a", "/business/business-a");
    const [payload, signature] = businessAToken.split(".");
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const tamperedToken = `${payload}.${tamperedSignature}`;

    expect(verifyDiscoveryAttributionToken(tamperedToken)).toBeNull();
    expect(
      verifyDiscoveryAttributionToken(businessAToken, { businessSlug: "business-b" })
    ).toBeNull();
    expect(
      verifyDiscoveryAttributionToken(businessAToken, {
        canonicalRoute: "/business/business-b",
      })
    ).toBeNull();
  });

  it("does not accept invented identity without a verified envelope", () => {
    expect(
      sanitizeDiscoveryLandingEvent({
        type: "discovery_landing",
        canonicalRoute: "/business/acme-stone",
        entityType: "business_profile",
        businessSlug: "acme-stone",
        entryRequestId: "invented-entry-id",
      })
    ).toBeNull();
  });

  it("derives stored identity from the verified envelope and keeps client fields as checks only", () => {
    const token = issueToken("business-a", "/business/business-a");
    const verified = verifyDiscoveryAttributionToken(token);
    expect(verified).not.toBeNull();

    const payload = buildClientDiscoveryLandingPayload({
      canonicalRoute: "/business/business-a",
      entityType: "business_profile",
      businessSlug: "business-a",
      discoveryAttributionToken: token,
      searchParams: new URLSearchParams(
        "utm_source=chatgpt.com&utm_campaign=secret&email=leak@example.com"
      ),
      referrer: "https://chatgpt.com/c/thread-123?q=business-a",
      ts: "2099-01-01T00:00:00.000Z",
    });
    const safe = sanitizeDiscoveryLandingEvent(payload, {
      verifiedAttribution: verified,
    });

    expect(safe).toMatchObject({
      type: "discovery_landing",
      canonicalRoute: "/business/business-a",
      entityType: "business_profile",
      businessSlug: "business-a",
      entryRequestId: verified?.entryRequestId,
      ts: verified?.issuedAt,
      sourceHint: "chatgpt",
      referrerHost: "chatgpt.com",
    });
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(JSON.stringify(safe)).not.toContain("thread-123");
    expect(JSON.stringify(safe)).not.toContain("leak@example.com");
    expect(JSON.stringify(safe)).not.toContain("discoveryAttributionToken");
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

  it("persists only verified attribution without raw IP or user-agent", async () => {
    const token = issueToken("jw-stone", "/jw-stone", "business_marketplace");
    const res = await request(makeApp())
      .post("/api/analytics/shell")
      .set("User-Agent", "Mozilla/5.0 SecretBrowser/1.0")
      .set("X-Forwarded-For", "203.0.113.50")
      .set("Referer", "https://chatgpt.com/c/abc")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
        discoveryAttributionToken: token,
        sourceHint: "chatgpt",
        referrerHost: "chatgpt.com",
        ts: "2099-01-01T00:00:00.000Z",
        landingUrl: "https://www.thetradescout.com/jw-stone?phone=555",
        queryString: "phone=555",
        messageText: "I want this stone",
        phoneNumber: "555-0100",
        email: "buyer@example.com",
        userAgent: "should-not-persist",
        ipAddress: "should-not-persist",
      });

    expect(res.status).toBe(204);
    await flushAsyncWork();

    const verified = verifyDiscoveryAttributionToken(token);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [eventType, payload] = logEventMock.mock.calls[0];
    expect(eventType).toBe("discovery_landing");
    expect(payload).toEqual({
      type: "discovery_landing",
      canonicalRoute: "/jw-stone",
      entityType: "business_marketplace",
      businessSlug: "jw-stone",
      entryRequestId: verified?.entryRequestId,
      sourceHint: "chatgpt",
      referrerHost: "chatgpt.com",
      ts: verified?.issuedAt,
    });
    expect(payload).not.toHaveProperty("ipAddress");
    expect(payload).not.toHaveProperty("userAgent");
    expect(payload).not.toHaveProperty("discoveryAttributionToken");
  });

  it.each([
    [
      "missing token",
      { businessSlug: "invented-business", canonicalRoute: "/business/invented-business" },
    ],
    [
      "tampered token",
      {
        discoveryAttributionToken: `${issueToken("business-a", "/business/business-a").slice(0, -1)}x`,
        businessSlug: "business-a",
        canonicalRoute: "/business/business-a",
        entityType: "business_profile",
      },
    ],
    [
      "changed slug",
      {
        discoveryAttributionToken: issueToken("business-a", "/business/business-a"),
        businessSlug: "business-b",
        canonicalRoute: "/business/business-a",
        entityType: "business_profile",
      },
    ],
    [
      "changed route",
      {
        discoveryAttributionToken: issueToken("business-a", "/business/business-a"),
        businessSlug: "business-a",
        canonicalRoute: "/business/business-b",
        entityType: "business_profile",
      },
    ],
    [
      "business A token submitted to business B",
      {
        discoveryAttributionToken: issueToken("business-a", "/business/business-a"),
        businessSlug: "business-b",
        canonicalRoute: "/business/business-b",
        entityType: "business_profile",
      },
    ],
  ])("rejects %s", async (_name, event) => {
    const res = await request(makeApp())
      .post("/api/analytics/shell")
      .send({
        type: "discovery_landing",
        ...event,
      });
    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("does not persist a direct client entryRequestId", async () => {
    const token = issueToken("business-a", "/business/business-a");
    const res = await request(makeApp()).post("/api/analytics/shell").send({
      type: "discovery_landing",
      canonicalRoute: "/business/business-a",
      entityType: "business_profile",
      businessSlug: "business-a",
      discoveryAttributionToken: token,
      entryRequestId: "attacker-controlled-id",
    });
    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("keeps a browser-tab session id and rejects crawler analytics", async () => {
    const token = issueToken("jw-stone", "/jw-stone", "business_marketplace");
    const humanResponse = await request(makeApp())
      .post("/api/analytics/shell")
      .set("User-Agent", "Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36")
      .set("X-Anonymous-Session-Id", "discovery-browser-session")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
        discoveryAttributionToken: token,
        anonymousSessionId: "discovery-browser-session",
      });
    expect(humanResponse.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).toHaveBeenCalledTimes(1);
    expect(logEventMock.mock.calls[0][1]).toMatchObject({
      anonymousSessionId: "discovery-browser-session",
    });

    logEventMock.mockClear();
    const crawlerResponse = await request(makeApp())
      .post("/api/analytics/shell")
      .set("User-Agent", "Mozilla/5.0 Chrome/139.0.0.0 Safari/605.1.15")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
        discoveryAttributionToken: token,
      });
    expect(crawlerResponse.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("returns 204 and skips persistence for unrelated routes", async () => {
    const token = issueToken("jw-stone", "/jw-stone", "business_marketplace");
    const res = await request(makeApp()).post("/api/analytics/shell").send({
      type: "discovery_landing",
      discoveryAttributionToken: token,
      canonicalRoute: "/dashboard",
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
    });
    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("stays non-blocking when persistence fails", async () => {
    const token = issueToken("jw-stone", "/jw-stone", "business_marketplace");
    logEventMock.mockRejectedValueOnce(new Error("db down"));
    const res = await request(makeApp())
      .post("/api/analytics/shell")
      .set("User-Agent", "Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
        discoveryAttributionToken: token,
      });
    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).toHaveBeenCalledTimes(1);
  });
});
