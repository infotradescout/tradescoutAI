import express from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  PUBLIC_DEMAND_EVENT_TYPES,
  normalizeEventType,
  registerEventRoutes,
  sanitizeDemandAttribution,
  sanitizeEventData,
  type EventRoutesStorage,
} from "../routes/events";
import {
  handleCorsOriginDeniedError,
  isCorsOriginDeniedError,
  isUnsupportedCmsProbeRequest,
  rejectUnsupportedCmsProbe,
} from "../http/publicRequestGuards";

function createEventApp(storage: EventRoutesStorage, user?: { id?: string; contractorId?: string }) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));
  if (user) app.use((req: any, _res, next) => { req.user = user; next(); });
  registerEventRoutes(app, { storage });
  return app;
}

async function flushEventWrite() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("event route extraction contract", () => {
  it("registers one public demand route with limiter and handler", () => {
    const registrations: Array<[string, string, number]> = [];
    registerEventRoutes(
      {
        post: (route: string, ...handlers: unknown[]) =>
          registrations.push(["POST", route, handlers.length]),
      } as any,
      { storage: { logEvent: vi.fn() } }
    );
    expect(registrations).toEqual([["POST", "/api/events", 2]]);
  });

  it("keeps the event owner narrow and mounts HTTP guards before body parsing and routes", () => {
    const root = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const eventModule = fs.readFileSync(path.resolve("server/routes/events.ts"), "utf8");
    const appModule = fs.readFileSync(path.resolve("server/app.ts"), "utf8");

    expect(root.match(/registerEventRoutes\(app, \{ storage \}\);/g)).toHaveLength(1);
    expect(root).not.toContain('app.post("/api/events"');
    expect(eventModule).toContain('Pick<IStorage, "logEvent">');
    expect(eventModule).toContain("PUBLIC_EVENT_LIMIT_1M");
    expect(eventModule).toContain("PUBLIC_DEMAND_EVENT_TYPES");
    expect(eventModule).not.toContain("isCorsOriginDeniedError");
    expect(eventModule).not.toContain("isUnsupportedCmsProbeRequest");
    expect(eventModule).not.toMatch(/from ["']\.\.\/storage["']/);
    expect(eventModule).not.toMatch(/from ["']\.\.\/routes["']/);

    const cors = appModule.indexOf("app.use(cors(corsOptions));");
    const corsGuard = appModule.indexOf("app.use(handleCorsOriginDeniedError);");
    const cmsGuard = appModule.indexOf("app.use(rejectUnsupportedCmsProbe);");
    const jsonBody = appModule.indexOf("app.use(express.json");
    const routes = appModule.indexOf("await registerRoutes(app)");
    expect(cors).toBeGreaterThan(-1);
    expect(corsGuard).toBeGreaterThan(cors);
    expect(cmsGuard).toBeGreaterThan(corsGuard);
    expect(jsonBody).toBeGreaterThan(cmsGuard);
    expect(routes).toBeGreaterThan(jsonBody);
  });
});

describe("HTTP failure classification", () => {
  it("recognizes only the CORS package denial error", () => {
    expect(isCorsOriginDeniedError(new Error("CORS: Origin not allowed: null"))).toBe(true);
    expect(isCorsOriginDeniedError(new Error("database failed"))).toBe(false);
    expect(isCorsOriginDeniedError("CORS: Origin not allowed: null")).toBe(false);
  });

  it("converts a rejected origin into 403 instead of 500", async () => {
    const app = express();
    app.use((_req, _res, next) => next(new Error("CORS: Origin not allowed: null")));
    app.use(handleCorsOriginDeniedError);

    const response = await request(app).get("/api/health");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Origin not allowed", code: "CORS_ORIGIN_DENIED" });
  });

  it.each([
    { path: "/wp-json/batch/v1", query: {} },
    { path: "/wordpress/wp-json/batch/v1", query: {} },
    { path: "/blog/wp-json/batch/v1", query: {} },
    { path: "/index.php", query: { rest_route: "/batch/v1" } },
    { path: "/", query: { rest_route: "/batch/v1" } },
  ])("recognizes unsupported CMS probe $path", ({ path: requestPath, query }) => {
    expect(isUnsupportedCmsProbeRequest({ path: requestPath, query })).toBe(true);
  });

  it("does not classify an ordinary TradeScout route as a CMS probe", () => {
    expect(isUnsupportedCmsProbeRequest({ path: "/", query: {} })).toBe(false);
    expect(isUnsupportedCmsProbeRequest({ path: "/direct-connect", query: {} })).toBe(false);
  });

  it.each([
    "/wp-json/batch/v1",
    "/wordpress/wp-json/batch/v1",
    "/blog/wp-json/batch/v1",
    "/index.php?rest_route=/batch/v1",
    "/?rest_route=/batch/v1",
  ])("returns a clean 404 for unsupported CMS probe %s", async (probeUrl) => {
    const app = express();
    app.use(rejectUnsupportedCmsProbe);
    app.post("*", (_req, res) => res.status(200).end());

    const response = await request(app).post(probeUrl).send({ requests: [] });
    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("public demand event safety", () => {
  it("accepts exactly the current seven public demand event types", () => {
    expect(Array.from(PUBLIC_DEMAND_EVENT_TYPES)).toEqual([
      "demand.landing_view",
      "demand.cta_click",
      "demand.auth_view",
      "demand.signin_success",
      "demand.create_success",
      "demand.setup_complete",
      "demand.intent_submitted",
    ]);
    expect(normalizeEventType(" demand.cta_click ")).toBe("demand.cta_click");
  });

  it.each([
    undefined,
    null,
    "",
    42,
    "event.test",
    "direct_connect_api_request_failed",
    "demand.unknown",
    "demand.cta_click private",
  ])("rejects unknown public event type %p", (eventType) => {
    expect(normalizeEventType(eventType)).toBeNull();
  });

  it("preserves bounded demand fields and rejects unrelated/private fields", () => {
    expect(
      sanitizeEventData({
        placement: "hero_primary",
        variant: "hybrid_public_landing",
        href: "/direct-connect?email=private@example.com#secret",
        target: "/scout?prompt=private",
        mode: "create",
        verificationRequired: true,
        presenceType: "personal",
        intent: "home_readiness",
        source: "landing_primary_cta",
        hasPrompt: false,
        surface: "public_landing",
        cta: "make_a_request",
        path: "/landing/homeowner?email=private@example.com",
        search: "?email=private@example.com",
        timestamp: "2026-08-29T16:00:00.000Z",
        county_fips: "22105",
        segment_category: "homeowner",
        segment_intent_level: "actively_looking",
        attribution: {
          ref: "partner_123",
          utmSource: "facebook",
          utmMedium: "social",
          utmCampaign: "gulf_coast_launch",
          utmContent: "hero_a",
          utmTerm: "private search wording",
          variant: "homeowner",
          campaignKey: "gulf_coast_launch",
          firstSeenAt: "2026-08-29T15:00:00.000Z",
          lastSeenAt: "2026-08-29T16:00:00.000Z",
          email: "private@example.com",
          nested: { secret: true },
        },
        requestId: "req_123",
        statusCode: 500,
        message: "private request text",
        phone: "9856626247",
        address: "private address",
        note: "private note",
        userId: "spoofed-user",
        contractorId: "spoofed-contractor",
      })
    ).toEqual({
      route: "/landing/homeowner",
      href: "/direct-connect",
      target: "/scout",
      surface: "public_landing",
      placement: "hero_primary",
      variant: "hybrid_public_landing",
      mode: "create",
      presenceType: "personal",
      intent: "home_readiness",
      source: "landing_primary_cta",
      cta: "make_a_request",
      verificationRequired: true,
      hasPrompt: false,
      countyFips: "22105",
      segmentCategory: "homeowner",
      segmentIntentLevel: "actively_looking",
      attribution: {
        ref: "partner_123",
        utmSource: "facebook",
        utmMedium: "social",
        utmCampaign: "gulf_coast_launch",
        utmContent: "hero_a",
        variant: "homeowner",
        campaignKey: "gulf_coast_launch",
        firstSeenAt: "2026-08-29T15:00:00.000Z",
        lastSeenAt: "2026-08-29T16:00:00.000Z",
      },
    });
  });

  it("sanitizes attribution field by field and never stores UTM search terms", () => {
    expect(
      sanitizeDemandAttribution({
        ref: "partner_123",
        utmSource: "facebook",
        utmTerm: "private search wording",
        campaignKey: "launch__facebook__ref_partner_123",
        firstSeenAt: "not-a-time",
        lastSeenAt: "2026-08-29T16:00:00Z",
        email: "private@example.com",
        requestText: "private request",
        nested: { secret: true },
      })
    ).toEqual({
      ref: "partner_123",
      utmSource: "facebook",
      campaignKey: "launch__facebook__ref_partner_123",
      lastSeenAt: "2026-08-29T16:00:00.000Z",
    });
  });

  it("rejects malformed routes, geography, private-looking tokens, and arbitrary nesting", () => {
    expect(
      sanitizeEventData({
        route: "https://example.com/private?token=secret",
        href: "/call/985-662-6247",
        placement: "private@example.com",
        source: { nested: true },
        countyFips: "2210",
        stateCode: "Louisiana",
        attribution: ["not", "an", "object"],
      })
    ).toEqual({});
  });
});

describe("public demand route behavior", () => {
  it("responds 204 before an unresolved telemetry write", async () => {
    const logEvent = vi.fn().mockReturnValue(new Promise(() => undefined));
    const response = await request(createEventApp({ logEvent })).post("/api/events").send({
      eventType: "demand.landing_view",
      data: { source: "home" },
    });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("silently drops an unknown event name", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(createEventApp({ logEvent })).post("/api/events").send({
      eventType: "direct_connect_api_request_failed",
      data: { source: "public" },
    });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("uses only server session identity and coarse device class", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(
      createEventApp({ logEvent }, { id: "session-user", contractorId: "session-contractor" })
    )
      .post("/api/events")
      .set("User-Agent", "Mozilla/5.0 desktop route-test")
      .send({
        eventType: "demand.cta_click",
        data: {
          userId: "spoofed-user",
          contractorId: "spoofed-contractor",
          ipAddress: "spoofed-ip",
          userAgent: "spoofed-agent",
          source: "landing_primary_cta",
        },
      });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledWith(
      "demand.cta_click",
      expect.objectContaining({
        source: "landing_primary_cta",
        userId: "session-user",
        contractorId: "session-contractor",
        deviceClass: "desktop",
      })
    );
    const persisted = logEvent.mock.calls[0]?.[1];
    expect(persisted).not.toHaveProperty("ipAddress");
    expect(persisted).not.toHaveProperty("userAgent");
  });

  it("never accepts caller identity for an anonymous event", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    await request(createEventApp({ logEvent })).post("/api/events").send({
      eventType: "demand.cta_click",
      data: { userId: "body-user", contractorId: "body-contractor", source: "public" },
    });
    await flushEventWrite();
    expect(logEvent).toHaveBeenCalledWith(
      "demand.cta_click",
      expect.objectContaining({ source: "public", userId: null, contractorId: null })
    );
  });

  it("keeps campaign attribution while removing raw search and private fields", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    await request(createEventApp({ logEvent })).post("/api/events").send({
      eventType: "demand.cta_click",
      data: {
        placement: "hero_primary",
        variant: "hybrid_public_landing",
        href: "/direct-connect?email=private@example.com",
        path: "/?utm_campaign=launch&email=private@example.com",
        search: "?utm_campaign=launch&email=private@example.com",
        message: "private message",
        phone: "9856626247",
        attribution: {
          campaignKey: "launch",
          variant: "hybrid_public_landing",
          utmSource: "facebook",
          utmTerm: "private search wording",
          email: "private@example.com",
        },
      },
    });
    await flushEventWrite();

    expect(logEvent).toHaveBeenCalledWith(
      "demand.cta_click",
      expect.objectContaining({
        placement: "hero_primary",
        variant: "hybrid_public_landing",
        href: "/direct-connect",
        route: "/",
        attribution: {
          campaignKey: "launch",
          variant: "hybrid_public_landing",
          utmSource: "facebook",
        },
        userId: null,
        contractorId: null,
      })
    );
    const persisted = logEvent.mock.calls[0]?.[1];
    expect(JSON.stringify(persisted)).not.toContain("private@example.com");
    expect(JSON.stringify(persisted)).not.toContain("private message");
    expect(JSON.stringify(persisted)).not.toContain("9856626247");
    expect(persisted).not.toHaveProperty("search");
  });

  it("drops oversized payloads instead of persisting partial data", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(createEventApp({ logEvent })).post("/api/events").send({
      eventType: "demand.cta_click",
      data: { source: "public", message: "x".repeat(9 * 1024) },
    });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("keeps rejected telemetry promises fail-soft", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request(
      createEventApp({ logEvent: vi.fn().mockRejectedValue(new Error("db")) })
    ).post("/api/events").send({ eventType: "demand.cta_click" });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error persisting /api/events telemetry", expect.any(Error));
    error.mockRestore();
  });

  it("turns synchronous storage failures into fail-soft promise rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logEvent = vi.fn(() => { throw new Error("sync"); });
    const response = await request(createEventApp({ logEvent } as any))
      .post("/api/events")
      .send({ eventType: "demand.cta_click" });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error persisting /api/events telemetry", expect.any(Error));
    error.mockRestore();
  });
});
