import express from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerEventRoutes, type EventRoutesStorage } from "../routes/events";

function createApp(storage: EventRoutesStorage, user?: { id?: string; contractorId?: string }) {
  const app = express();
  app.use(express.json());
  if (user) app.use((req: any, _res, next) => { req.user = user; next(); });
  registerEventRoutes(app, { storage });
  return app;
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

describe("event route behavior", () => {
  it("responds 204 before an unresolved telemetry write", async () => {
    const logEvent = vi.fn().mockReturnValue(new Promise(() => undefined));
    const response = await request(createApp({ logEvent })).post("/api/events").send({
      eventType: "page.view",
      data: { source: "home" },
    });
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("trims event types and lets session identity override body identity", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(
      createApp({ logEvent }, { id: "session-user", contractorId: "session-contractor" })
    )
      .post("/api/events")
      .set("User-Agent", "route-test")
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
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledWith(
      "scout.opened",
      expect.objectContaining({
        source: "scout",
        userId: "session-user",
        contractorId: "session-contractor",
        ipAddress: expect.any(String),
        userAgent: "route-test",
      })
    );
  });

  it.each([undefined, null, "", 42])("normalizes %p event type to event.unknown", async (eventType) => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    const response = await request(createApp({ logEvent })).post("/api/events").send({ eventType });
    expect(response.status).toBe(204);
    expect(logEvent).toHaveBeenCalledWith(
      "event.unknown",
      expect.objectContaining({ userId: null, contractorId: null })
    );
  });

  it("uses body identity as the unauthenticated fallback", async () => {
    const logEvent = vi.fn().mockResolvedValue(undefined);
    await request(createApp({ logEvent })).post("/api/events").send({
      eventType: "event.test",
      data: { userId: "body-user", contractorId: "body-contractor" },
    });
    expect(logEvent).toHaveBeenCalledWith(
      "event.test",
      expect.objectContaining({ userId: "body-user", contractorId: "body-contractor" })
    );
  });

  it("keeps rejected telemetry promises fail-soft", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await request(
      createApp({ logEvent: vi.fn().mockRejectedValue(new Error("db")) })
    ).post("/api/events").send({ eventType: "event.test" });
    await new Promise((resolve) => setImmediate(resolve));
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error persisting /api/events telemetry", expect.any(Error));
    error.mockRestore();
  });

  it("keeps synchronous storage failures fail-soft", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logEvent = vi.fn(() => { throw new Error("sync"); });
    const response = await request(createApp({ logEvent } as any)).post("/api/events").send();
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("Error logging event:", expect.any(Error));
    error.mockRestore();
  });
});
