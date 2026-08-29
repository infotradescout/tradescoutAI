import express from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  DIRECT_CONNECT_FRICTION_EVENT_TYPES,
  PUBLIC_DEMAND_EVENT_TYPES,
  normalizeEventType,
  registerEventRoutes,
  sanitizeDemandAttribution,
  sanitizeDirectConnectEventData,
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

describe("first-party event ownership", () => {
  it("mounts runtime guards and the legacy bridge before the hardened endpoint", () => {
    const registrations: Array<[string, string | null, number]> = [];
    registerEventRoutes(
      {
        use: (...handlers: unknown[]) => registrations.push(["USE", null, handlers.length]),
        post: (route: string, ...handlers: unknown[]) =>
          registrations.push(["POST", route, handlers.length]),
      } as any,
      { storage: { logEvent: vi.fn() } }
    );

    expect(registrations).toEqual([
      ["USE", null, 1],
      ["USE", null, 1],
      ["POST", "/api/analytics/shell", 1],
      ["POST", "/api/events", 2],
    ]);
  });

  it("mounts before broad analytics and starts the server-derived detector", () => {
    const root = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const eventModule = fs.readFileSync(path.resolve("server/routes/events.ts"), "utf8");

    expect(root.match(/registerEventRoutes\(app, \{ storage \}\);/g)).toHaveLength(1);
    expect(root.indexOf("registerEventRoutes(app, { storage });")).toBeLessThan(
      root.indexOf("registerAnalyticsRoutes(app);")
    );
    expect(eventModule).toContain("app.use(handleCorsOriginDeniedError)");
    expect(eventModule).toContain("app.use(rejectUnsupportedCmsProbe)");
    expect(eventModule).toContain("startDirectConnectFunnelStallDetector");
    expect(eventModule).toContain('Pick<IStorage, "logEvent">');
    expect(eventModule).not.toMatch(/from ["']\.\.\/storage["']/);
  });
});

describe("HTTP failure classification", () => {
  it("converts only a denied CORS origin into 403", async () => {
    expect(isCorsOriginDeniedError(new Error("CORS: Origin not allowed: null"))).toBe(true);
    expect(isCorsOriginDeniedError(new Error("database failed"))).toBe(false);

    const app = express();
    app.use((_req, _res, next) => next(new Error("CORS: Origin not allowed: null")));
    app.use(handleCorsOriginDeniedError);
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Origin not allowed", code: "CORS_ORIGIN_DENIED" });
  });

  it("recognizes and cleanly rejects unsupported CMS probes", async () => {
    expect(isUnsupportedCmsProbeRequest({ path: "/wp-json/batch/v1", query: {} })).toBe(true);
    expect(isUnsupportedCmsProbeRequest({ path: "/", query: { rest_route: "/batch/v1" } })).toBe(true);
    expect(isUnsupportedCmsProbeRequest({ path: "/direct-connect", query: {} })).toBe(false);

    const app = express();
    app.use(rejectUnsupportedCmsProbe);
    app.post("*", (_req, res) => res.status(200).end());
    const response = await request(app).post("/wp-json/batch/v1").send({ requests: [] });
    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
  });
});

describe("event registries", () => {
  it("keeps the seven public demand events and exact ten friction signals", () => {
    expect(Array.from(PUBLIC_DEMAND_EVENT_TYPES)).toEqual([
      "demand.landing_view",
      "demand.cta_click",
      "demand.auth_view",
      "demand.signin_success",
      "demand.create_success",
      "demand.setup_complete",
      "demand.intent_submitted",
    ]);
    expect(Array.from(DIRECT_CONNECT_FRICTION_EVENT_TYPES)).toEqual([
      "direct_connect_client_runtime_error",
      "direct_connect_api_request_failed",
      "direct_connect_auth_handoff_stalled",
      "direct_connect_draft_restore_failed",
      "direct_connect_form_validation_blocked",
      "direct_connect_repeated_submit_attempt",
      "direct_connect_repeated_cta_click",
      "direct_connect_empty_state_seen",
      "direct_connect_permission_or_role_blocked",
      "direct_connect_funnel_step_stalled",
    ]);
  });

  it("accepts client events but refuses a client-submitted stall", () => {
    expect(normalizeEventType(" demand.cta_click ")).toBe("demand.cta_click");
    expect(normalizeEventType(" direct_connect_api_request_failed ")).toBe(
      "direct_connect_api_request_failed"
    );
    expect(normalizeEventType("direct_connect_funnel_step_stalled")).toBeNull();
    expect(normalizeEventType("event.test")).toBeNull();
  });
});

describe("sanitization", () => {
  it("keeps bounded demand attribution and removes private fields", () => {
    expect(
      sanitizeDemandAttribution({
        ref: "partner_123",
        utmSource: "facebook",
        utmTerm: "private search wording",
        campaignKey: "gulf_coast_launch",
        lastSeenAt: "2026-08-29T16:00:00Z",
        email: "private@example.com",
      })
    ).toEqual({
      ref: "partner_123",
      utmSource: "facebook",
      campaignKey: "gulf_coast_launch",
      lastSeenAt: "2026-08-29T16:00:00.000Z",
    });

    expect(
      sanitizeEventData({
        placement: "hero_primary",
        href: "/direct-connect?email=private@example.com",
        path: "/landing/homeowner?phone=9856626247",
        source: "landing_primary_cta",
        message: "private message",
        phone: "9856626247",
      })
    ).toEqual({
      route: "/landing/homeowner",
      href: "/direct-connect",
      placement: "hero_primary",
      source: "landing_primary_cta",
    });
  });

  it("keeps only safe Direct Connect metadata and rejects phone-like IDs", () => {
    expect(
      sanitizeDirectConnectEventData({
        source: "request_submit",
        section: "post",
        reason: "validation_failed",
        field: "title",
        funnelStep: "review",
        requestId: "req_123",
        assignmentId: "9856626247",
        statusCode: 422,
        retryCount: 2.9,
        blocked: true,
        route: "/direct-connect/requests/12345678-1234-1234-1234-123456789abc?email=private@example.com",
        message: "private request text",
        phone: "9856626247",
        address: "private address",
        upload: { name: "private.pdf" },
        stack: "private stack",
        userAgent: "private fingerprint",
        ipAddress: "127.0.0.1",
        userId: "spoofed-user",
      })
    ).toEqual({
      surface: "direct_connect",
      source: "request_submit",
      section: "post",
      reason: "validation_failed",
      field: "title",
      funnelStep: "review",
      requestId: "req_123",
      blocked: true,
      retryCount: 2,
      statusCode: 422,
      routeTemplate: "/direct-connect/requests/:id",
    });
  });

  it("rejects contact values hidden in allowed fields", () => {
    expect(
      sanitizeDirectConnectEventData({
        source: "private@example.com",
        reason: "+1 (985) 662-6247",
        requestId: "9856626247",
        routeTemplate: "/direct-connect",
      })
    ).toEqual({ surface: "direct_connect", routeTemplate: "/direct-connect" });
  });
});

describe("first-party route behavior", () => {
  it("persists a signal with server identity and coarse device only", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(
      createEventApp({ logEvent }, { id: "session-user", contractorId: "session-contractor" })
    )
      .post("/api/events")
      .set("User-Agent", "Mozilla/5.0 Mobile private fingerprint")
      .send({
        eventType: "direct_connect_api_request_failed",
        data: {
          source: "request_submit",
          section: "post",
          statusCode: 500,
          errorCode: "server_error",
          blocked: true,
          requestId: "req_123",
          message: "private request text",
          userId: "spoofed-user",
          ipAddress: "spoofed-ip",
          userAgent: "spoofed-agent",
        },
      });
    await flushEventWrite();

    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledWith("direct_connect_api_request_failed", {
      surface: "direct_connect",
      source: "request_submit",
      section: "post",
      errorCode: "server_error",
      requestId: "req_123",
      blocked: true,
      statusCode: 500,
      routeTemplate: "/direct-connect",
      userId: "session-user",
      contractorId: "session-contractor",
      deviceClass: "mobile",
    });
  });

  it("intercepts old cached clients without raw browser enrichment", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const app = createEventApp({ logEvent });
    app.post("/api/analytics/shell", (_req, res) => res.status(202).end());

    const response = await request(app)
      .post("/api/analytics/shell")
      .set("User-Agent", "legacy-browser private fingerprint")
      .send({
        type: "direct_connect_empty_state_seen",
        source: "/direct-connect/inbox?requestId=private",
        section: "inbox",
        reason: "no_assignments",
        message: "private message",
        ipAddress: "spoofed-ip",
      });
    await flushEventWrite();

    expect(response.status).toBe(204);
    const persisted = logEvent.mock.calls[0]?.[1];
    expect(persisted).toMatchObject({
      surface: "direct_connect",
      section: "inbox",
      reason: "no_assignments",
      routeTemplate: "/direct-connect/inbox",
    });
    expect(persisted).not.toHaveProperty("ipAddress");
    expect(persisted).not.toHaveProperty("userAgent");
    expect(JSON.stringify(persisted)).not.toContain("private message");
  });

  it("drops browser-submitted stalls while unrelated shell events continue", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const app = createEventApp({ logEvent });
    app.post("/api/analytics/shell", (_req, res) => res.status(202).end());

    const legacyStall = await request(app)
      .post("/api/analytics/shell")
      .send({ type: "direct_connect_funnel_step_stalled", funnelStep: "review" });
    const hardenedStall = await request(app)
      .post("/api/events")
      .send({ eventType: "direct_connect_funnel_step_stalled" });
    const unrelated = await request(app)
      .post("/api/analytics/shell")
      .send({ type: "community_shell_load" });

    expect(legacyStall.status).toBe(204);
    expect(hardenedStall.status).toBe(204);
    expect(unrelated.status).toBe(202);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("drops unknown or oversized payloads and keeps storage failures fail-soft", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const app = createEventApp({ logEvent });

    expect((await request(app).post("/api/events").send({ eventType: "event.unknown" })).status).toBe(204);
    expect(
      (
        await request(app).post("/api/events").send({
          eventType: "direct_connect_api_request_failed",
          data: { source: "request_submit", message: "x".repeat(9 * 1024) },
        })
      ).status
    ).toBe(204);
    await flushEventWrite();
    expect(logEvent).not.toHaveBeenCalled();

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rejected = await request(
      createEventApp({ logEvent: vi.fn().mockRejectedValue(new Error("db")) })
    )
      .post("/api/events")
      .send({ eventType: "direct_connect_api_request_failed" });
    await flushEventWrite();
    expect(rejected.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error persisting first-party telemetry", expect.any(Error));
    error.mockRestore();
  });
});
