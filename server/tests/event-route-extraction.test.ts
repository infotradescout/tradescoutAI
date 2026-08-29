import express from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeEventType,
  registerEventRoutes,
  sanitizeEventData,
  type EventRoutesStorage,
} from "../routes/events";

function createApp(storage: EventRoutesStorage, user?: { id?: string; contractorId?: string }) {
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
  it("registers the exact public POST route with one handler", () => {
    const registrations: Array<[string, string, number]> = [];
    registerEventRoutes(
      { post: (route: string, ...handlers: unknown[]) => registrations.push(["POST", route, handlers.length]) } as any,
      { storage: { logEvent: vi.fn() } }
    );
    expect(registrations).toEqual([["POST", "/api/events", 1]]);
  });

  it("keeps one in-place root registration and a narrow acyclic boundary", () => {
    const root = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const module = fs.readFileSync(path.resolve("server/routes/events.ts"), "utf8");
    expect(root.match(/registerEventRoutes\(app, \{ storage \}\);/g)).toHaveLength(1);
    expect(root).not.toContain('app.post("/api/events"');
    const completedLead = root.indexOf('app.post("/api/leads/:id/complete"');
    const registration = root.indexOf("registerEventRoutes(app, { storage });");
    const proAnalytics = root.indexOf('"/api/pro/analytics/summary"');
    expect(registration).toBeGreaterThan(completedLead);
    expect(proAnalytics).toBeGreaterThan(registration);
    expect(module).toContain('Pick<IStorage, "logEvent">');
    expect(module).not.toMatch(/from ["']\.\.\/storage["']/);
    expect(module).not.toMatch(/from ["']\.\.\/routes["']/);
  });
});

describe("event payload safety", () => {
  it.each([undefined, null, "", 42, "contains private text"]) (
    "normalizes unsafe event type %p to event.unknown",
    (eventType) => {
      expect(normalizeEventType(eventType)).toBe("event.unknown");
    }
  );

  it("keeps only flat allowlisted metadata", () => {
    expect(
      sanitizeEventData({
        route: "/direct-connect/review?email=private@example.com#secret",
        surface: "request composer",
        funnelStep: "review",
        requestId: "req_123",
        statusCode: 422,
        errorCode: "VALIDATION_BLOCKED",
        blocked: true,
        retryCount: 2.9,
        stateCode: "la",
        countyFips: "22105",
        message: "private request text",
        phone: "985-555-0100",
        address: "private address",
        note: "private note",
        userId: "spoofed-user",
        contractorId: "spoofed-contractor",
        nested: { secret: true },
        items: ["private"],
      })
    ).toEqual({
      route: "/direct-connect/review",
      surface: "request composer",
      funnelStep: "review",
      requestId: "req_123",
      statusCode: 422,
      errorCode: "VALIDATION_BLOCKED",
      blocked: true,
      retryCount: 2,
      stateCode: "LA",
      countyFips: "22105",
    });
  });

  it("rejects malformed identifiers, routes, status codes, and nested values", () => {
    expect(
      sanitizeEventData({
        route: "https://example.com/private?token=secret",
        requestId: "request id with spaces",
        statusCode: 42,
        retryCount: -1,
        blocked: "yes",
        source: { nested: true },
        countyFips: "2210",
        stateCode: "Louisiana",
      })
    ).toEqual({});
  });
});

describe("event route behavior", () => {
  it("responds 204 before an unresolved telemetry write", async () => {
    const logEvent = vi.fn().mockReturnValue(new Promise(() => undefined));
    const response = await request(createApp({ logEvent })).post("/api/events").send({
      eventType: "page.view",
      data: { source: "home" },
    });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("uses only server session identity and coarse device class", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(
      createApp({ logEvent }, { id: "session-user", contractorId: "session-contractor" })
    )
      .post("/api/events")
      .set("User-Agent", "Mozilla/5.0 desktop route-test")
      .send({
        eventType: "  scout.opened  ",
        data: {
          userId: "spoofed-user",
          contractorId: "spoofed-contractor",
          ipAddress: "spoofed-ip",
          userAgent: "spoofed-agent",
          source: "scout",
        },
      });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledWith(
      "scout.opened",
      expect.objectContaining({
        source: "scout",
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
    await request(createApp({ logEvent })).post("/api/events").send({
      eventType: "event.test",
      data: { userId: "body-user", contractorId: "body-contractor", source: "public" },
    });
    await flushEventWrite();
    expect(logEvent).toHaveBeenCalledWith(
      "event.test",
      expect.objectContaining({ source: "public", userId: null, contractorId: null })
    );
  });

  it("strips private content and query values before persistence", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    await request(createApp({ logEvent })).post("/api/events").send({
      eventType: "direct_connect_api_request_failed",
      data: {
        route: "/direct-connect?email=private@example.com&phone=9855550100",
        funnelStep: "submit",
        statusCode: 500,
        errorCode: "REQUEST_FAILED",
        blocked: true,
        requestId: "req_123",
        message: "full private request",
        requestText: "full private request",
        phone: "9855550100",
        email: "private@example.com",
        address: "private address",
        privateNotes: "private note",
        upload: { name: "private.pdf" },
      },
    });
    await flushEventWrite();
    const persisted = logEvent.mock.calls[0]?.[1];
    expect(persisted).toMatchObject({
      route: "/direct-connect",
      funnelStep: "submit",
      statusCode: 500,
      errorCode: "REQUEST_FAILED",
      blocked: true,
      requestId: "req_123",
      userId: null,
      contractorId: null,
    });
    expect(JSON.stringify(persisted)).not.toContain("private");
    expect(JSON.stringify(persisted)).not.toContain("9855550100");
  });

  it("drops oversized payloads instead of persisting partial private data", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(createApp({ logEvent })).post("/api/events").send({
      eventType: "event.test",
      data: { source: "public", message: "x".repeat(9 * 1024) },
    });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("keeps rejected telemetry promises fail-soft", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request(
      createApp({ logEvent: vi.fn().mockRejectedValue(new Error("db")) })
    ).post("/api/events").send({ eventType: "event.test" });
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error persisting /api/events telemetry", expect.any(Error));
    error.mockRestore();
  });

  it("turns synchronous storage failures into fail-soft promise rejection", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logEvent = vi.fn(() => { throw new Error("sync"); });
    const response = await request(createApp({ logEvent } as any)).post("/api/events").send();
    await flushEventWrite();
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error persisting /api/events telemetry", expect.any(Error));
    error.mockRestore();
  });
});
