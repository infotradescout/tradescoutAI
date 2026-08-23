import express from "express";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildClientDiscoveryLandingPayload,
  normalizeDiscoveryAttributionToken,
  normalizeDiscoveryReferrerClass,
  sanitizeDiscoveryLandingEvent,
  sanitizePublicProfileCtaEvent,
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
  entityType: "business_marketplace" | "business_profile" | "public_profile" = "business_profile"
): string {
  const token = issueDiscoveryAttributionToken({
    entitySlug: businessSlug,
    ...(entityType === "public_profile" ? { profileSlug: businessSlug } : { businessSlug }),
    canonicalRoute,
    entityType,
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
  });
  if (!token) throw new Error("Expected discovery attribution token");
  return token;
}

function tamperToken(token: string): string {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Expected signed discovery attribution token");
  return `${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
}

describe("signed discovery attribution", () => {
  it.each([
    "google",
    "bing",
    "chatgpt",
    "facebook",
    "linkedin",
    "search",
    "ai",
    "social",
    "referral",
  ] as const)("keeps finite referrer class %s idempotent", (referrerClass) => {
    expect(normalizeDiscoveryReferrerClass(referrerClass)).toBe(referrerClass);
  });

  it("buckets an arbitrary referrer host without retaining its subdomain", () => {
    expect(
      normalizeDiscoveryReferrerClass(
        "https://private-customer-5550100.unknown.example/path?email=person@example.com"
      )
    ).toBe("referral");
  });

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
      entitySlug: "business-a",
      businessSlug: "business-a",
      entryRequestId: verified?.entryRequestId,
      ts: verified?.issuedAt,
      sourceHint: "chatgpt",
      referrerClass: "chatgpt",
    });
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(JSON.stringify(safe)).not.toContain("thread-123");
    expect(JSON.stringify(safe)).not.toContain("leak@example.com");
    expect(JSON.stringify(safe)).not.toContain("discoveryAttributionToken");
  });

  it("keeps personal profile identity distinct from business identity", () => {
    const token = issueToken("jane-helper", "/u/jane-helper", "public_profile");
    const verified = verifyDiscoveryAttributionToken(token);
    const safe = sanitizeDiscoveryLandingEvent(
      {
        type: "discovery_landing",
        canonicalRoute: "/u/jane-helper",
        entityType: "public_profile",
        entitySlug: "jane-helper",
        profileSlug: "jane-helper",
        discoveryAttributionToken: token,
      },
      { verifiedAttribution: verified }
    );

    expect(verified).toMatchObject({
      entitySlug: "jane-helper",
      profileSlug: "jane-helper",
      entityType: "public_profile",
    });
    expect(safe).toMatchObject({
      entitySlug: "jane-helper",
      profileSlug: "jane-helper",
      entityType: "public_profile",
    });
    expect(safe).not.toHaveProperty("businessSlug");
  });

  it("accepts only fixed CTA kinds from a signed business-profile envelope", () => {
    const token = issueToken("business-a", "/u/business-a");
    const verified = verifyDiscoveryAttributionToken(token);
    const safe = sanitizePublicProfileCtaEvent(
      {
        type: "public_profile_cta",
        ctaKind: "direct_connect",
        canonicalRoute: "/u/business-a",
        entityType: "business_profile",
        businessSlug: "business-a",
        discoveryAttributionToken: token,
        label: "Call 555-0100",
        userAgent: "do-not-store",
      },
      { verifiedAttribution: verified, observedAt: "2026-08-23T12:00:00.000Z" }
    );

    expect(safe).toEqual({
      type: "public_profile_cta",
      serverVerified: true,
      ctaKind: "direct_connect",
      canonicalRoute: "/u/business-a",
      entityType: "business_profile",
      entitySlug: "business-a",
      businessSlug: "business-a",
      entryRequestId: verified?.entryRequestId,
      ts: "2026-08-23T12:00:00.000Z",
    });
    expect(
      sanitizePublicProfileCtaEvent(
        { type: "public_profile_cta", ctaKind: "call_555_0100" },
        { verifiedAttribution: verified }
      )
    ).toBeNull();
  });
});

describe("discovery_landing analytics delivery", () => {
  beforeEach(() => {
    logEventMock.mockClear();
  });

  function makeApp(withSession = false, authenticatedUserId?: string) {
    const app = express();
    if (withSession) {
      app.use(
        session({
          secret: "discovery-session-test-secret",
          resave: false,
          saveUninitialized: true,
        })
      );
    }
    app.use(express.json());
    if (authenticatedUserId) {
      app.use((req, _res, next) => {
        (req as any).user = { id: authenticatedUserId };
        next();
      });
    }
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
      serverVerified: true,
      canonicalRoute: "/jw-stone",
      entityType: "business_marketplace",
      entitySlug: "jw-stone",
      businessSlug: "jw-stone",
      entryRequestId: verified?.entryRequestId,
      sourceHint: "chatgpt",
      referrerClass: "chatgpt",
      ts: verified?.issuedAt,
    });
    expect(payload).not.toHaveProperty("ipAddress");
    expect(payload).not.toHaveProperty("userAgent");
    expect(payload).not.toHaveProperty("discoveryAttributionToken");
  });

  it("never persists attacker-supplied anonymous header, query, cookie, or body identifiers", async () => {
    const token = issueToken("jw-stone", "/jw-stone", "business_marketplace");
    const contactLikeId = "Jane_Doe_5550100";
    const res = await request(makeApp())
      .post(`/api/analytics/shell?anonymousSessionId=${contactLikeId}`)
      .set("x-anonymous-session-id", contactLikeId)
      .set("Cookie", `ts_session_id=${contactLikeId}`)
      .send({
        type: "discovery_landing",
        canonicalRoute: "/jw-stone",
        entityType: "business_marketplace",
        businessSlug: "jw-stone",
        discoveryAttributionToken: token,
        anonymousSessionId: contactLikeId,
      });

    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logEventMock.mock.calls[0][1])).not.toContain(contactLikeId);
    expect(logEventMock.mock.calls[0][1]).not.toHaveProperty("anonymousSessionId");
  });

  it.each([
    "acquisition.registration_completed",
    "acquisition.activation_completed",
    "public_profile_discovered",
  ])("reserves %s against authenticated client spoofing", async (type) => {
    const res = await request(makeApp(false, "spoof-target-user"))
      .post("/api/analytics/shell")
      .send({
        type,
        serverConfirmed: true,
        userId: "spoof-target-user",
        flow: "standard",
      });

    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it.each(["5551234567", "123-45-6789", "jane.doe", "jane@example.com", "stable_customer_019c77"])(
    "buckets untrusted utm_source %s without persisting the raw value",
    async (utmSource) => {
      const token = issueToken("business-a", "/business/business-a");
      const payload = buildClientDiscoveryLandingPayload({
        canonicalRoute: "/business/business-a",
        entityType: "business_profile",
        businessSlug: "business-a",
        discoveryAttributionToken: token,
        searchParams: new URLSearchParams({ utm_source: utmSource }),
        referrer: "https://customer-subdomain.unrecognized.example/private/path",
      });
      const safe = sanitizeDiscoveryLandingEvent(payload, {
        verifiedAttribution: verifyDiscoveryAttributionToken(token),
      });

      expect(safe).toMatchObject({
        sourceHint: "other",
        referrerClass: "referral",
      });
      expect(JSON.stringify(safe)).not.toContain(utmSource);
      expect(JSON.stringify(safe)).not.toContain("customer-subdomain");
      expect(safe).not.toHaveProperty("referrerHost");
    }
  );

  it("records one landing and one distinct public-profile discovery milestone", async () => {
    const token = issueToken("business-a", "/u/business-a");
    const res = await request(makeApp())
      .post("/api/analytics/shell")
      .set("User-Agent", "Mozilla/5.0 Chrome/140.0")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/u/business-a",
        entityType: "business_profile",
        businessSlug: "business-a",
        discoveryAttributionToken: token,
      });

    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock.mock.calls.map(([eventType]) => eventType)).toEqual([
      "discovery_landing",
      "public_profile_discovered",
    ]);
  });

  it("filters recognized automation without persisting raw user-agent", async () => {
    const token = issueToken("business-a", "/u/business-a");
    const res = await request(makeApp())
      .post("/api/analytics/shell")
      .set("User-Agent", "Googlebot/2.1 (+http://www.google.com/bot.html)")
      .send({
        type: "discovery_landing",
        canonicalRoute: "/u/business-a",
        entityType: "business_profile",
        businessSlug: "business-a",
        discoveryAttributionToken: token,
      });

    expect(res.status).toBe(204);
    await flushAsyncWork();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("dedupes landing, discovery, and CTA milestones in the server session", async () => {
    const token = issueToken("business-a", "/u/business-a");
    const agent = request.agent(makeApp(true));
    const landing = {
      type: "discovery_landing",
      canonicalRoute: "/u/business-a",
      entityType: "business_profile",
      businessSlug: "business-a",
      discoveryAttributionToken: token,
    };
    const cta = { ...landing, type: "public_profile_cta", ctaKind: "direct_connect" };

    await agent.post("/api/analytics/shell").send(landing).expect(204);
    await agent.post("/api/analytics/shell").send(landing).expect(204);
    await agent.post("/api/analytics/shell").send(cta).expect(204);
    await agent.post("/api/analytics/shell").send(cta).expect(204);
    await flushAsyncWork();

    expect(logEventMock.mock.calls.map(([eventType]) => eventType)).toEqual([
      "discovery_landing",
      "public_profile_discovered",
      "public_profile_cta",
    ]);
  });

  it.each([
    [
      "missing token",
      { businessSlug: "invented-business", canonicalRoute: "/business/invented-business" },
    ],
    [
      "tampered token",
      {
        discoveryAttributionToken: tamperToken(issueToken("business-a", "/business/business-a")),
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
    const res = await request(makeApp()).post("/api/analytics/shell").send({
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
