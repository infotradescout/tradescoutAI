import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetFrictionTelemetryForTests,
  toDirectConnectRouteTemplate,
  trackConversionIntegrityEvent,
  trackConversionIntegrityRepeatedSignal,
} from "../../client/src/lib/telemetry";
import {
  DIRECT_CONNECT_INTEGRITY_EVENT_NAMES,
  DIRECT_CONNECT_INTEGRITY_LANE,
  sanitizeConversionIntegrityEvent,
} from "../routes/analytics-routes";
import {
  computeDirectConnectFunnelStalls,
  DIRECT_CONNECT_FUNNEL_ORDER,
} from "../services/directConnectFunnelIntegrity";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

function latestPayload(fetchMock: ReturnType<typeof vi.fn>) {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;
  return JSON.parse(String(body || "{}")) as Record<string, unknown>;
}

describe("Direct Connect conversion-integrity lane", () => {
  beforeEach(() => {
    resetFrictionTelemetryForTests();
  });

  afterEach(() => {
    resetFrictionTelemetryForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("payload allowlist and PII discarding (server)", () => {
    it("keeps only the reviewed field vocabulary and discards everything else, including nested PII", () => {
      const safe = sanitizeConversionIntegrityEvent(
        {
          eventName: "direct_connect_integrity_blocked_action",
          lane: DIRECT_CONNECT_INTEGRITY_LANE,
          routeTemplate: "/direct-connect/inbox",
          funnelStep: "request_review_opened",
          safeErrorCode: "validation_failed",
          statusCode: 422,
          blocked: true,
          retryCount: 2,
          clickCount: 3,
          // Everything below must be discarded even though it rides along
          // in the same POST body.
          email: "private@example.com",
          phone: "555-0000",
          message: "raw exception: TypeError at line 42",
          stack: "Error\n  at foo (bar.ts:1:1)",
          queryParams: { token: "secret" },
          responseBody: { card: "4111111111111111" },
          nested: { description: "private free text", safe: "kept-but-not-allowlisted" },
        },
        { userId: null, anonymousSessionId: null },
        false
      );

      expect(safe).not.toBeNull();
      const serialized = JSON.stringify(safe);
      expect(serialized).not.toContain("private@example.com");
      expect(serialized).not.toContain("555-0000");
      expect(serialized).not.toContain("TypeError");
      expect(serialized).not.toContain("bar.ts");
      expect(serialized).not.toContain("secret");
      expect(serialized).not.toContain("4111111111111111");
      expect(serialized).not.toContain("private free text");
      expect(serialized).not.toContain("kept-but-not-allowlisted");

      expect(safe).toMatchObject({
        eventName: "direct_connect_integrity_blocked_action",
        routeTemplate: "/direct-connect/inbox",
        funnelStep: "request_review_opened",
        safeErrorCode: "validation_failed",
        statusCode: 422,
        blocked: true,
        retryCount: 2,
        clickCount: 3,
        severity: "high",
      });
      expect(Object.keys(safe as object).sort()).toEqual(
        [
          "blocked",
          "clickCount",
          "client_build",
          "eventName",
          "funnelStep",
          "lane",
          "release_sha",
          "retryCount",
          "routeTemplate",
          "safeErrorCode",
          "schema_version",
          "severity",
          "statusCode",
          "ts",
        ].sort()
      );
    });

    it("rejects an unknown event name outright", () => {
      const safe = sanitizeConversionIntegrityEvent(
        { eventName: "direct_connect_integrity_made_up_event" },
        { userId: null, anonymousSessionId: null },
        false
      );
      expect(safe).toBeNull();
    });

    it("rejects a client-submitted funnel-stall event -- that event is server-derived only", () => {
      const fromClient = sanitizeConversionIntegrityEvent(
        { eventName: "direct_connect_funnel_step_stalled" },
        { userId: null, anonymousSessionId: null },
        false
      );
      expect(fromClient).toBeNull();

      const fromServer = sanitizeConversionIntegrityEvent(
        {
          eventName: "direct_connect_funnel_step_stalled",
          funnelStep: "direct_connect_request_started",
        },
        { userId: null, anonymousSessionId: "anon-123" },
        true
      );
      expect(fromServer).not.toBeNull();
      expect(fromServer?.anonymousSessionId).toBe("anon-123");
    });

    it("clamps out-of-range statusCode and unknown safeErrorCode rather than passing them through", () => {
      const safe = sanitizeConversionIntegrityEvent(
        {
          eventName: "direct_connect_integrity_request_failed",
          statusCode: 999999,
          safeErrorCode: "raw sql error: relation does not exist",
        },
        { userId: "user-1", anonymousSessionId: null },
        false
      );
      expect(safe?.statusCode).toBeUndefined();
      expect(safe?.safeErrorCode).toBeUndefined();
      expect(safe?.userId).toBe("user-1");
    });
  });

  describe("route templating over full URLs (client)", () => {
    it("strips query strings and replaces id-shaped segments", () => {
      expect(toDirectConnectRouteTemplate("/direct-connect/inbox?requestId=abc123")).toBe(
        "/direct-connect/inbox"
      );
      expect(
        toDirectConnectRouteTemplate(
          "/direct-connect/550e8400-e29b-41d4-a716-446655440000?tab=details"
        )
      ).toBe("/direct-connect/:id");
      expect(toDirectConnectRouteTemplate("/direct-connect/12345")).toBe("/direct-connect/:id");
      expect(toDirectConnectRouteTemplate("/direct-connect/board")).toBe("/direct-connect/board");
    });
  });

  describe("failure-loop protection (client)", () => {
    it("never fires a second telemetry event when the beacon itself fails", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
      vi.stubGlobal("fetch", fetchMock);

      expect(() =>
        trackConversionIntegrityEvent("direct_connect_integrity_request_failed", {
          safeErrorCode: "network_error",
          statusCode: 0,
        })
      ).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("never includes setTimeout/setInterval-based retry logic", () => {
      const telemetry = read("client/src/lib/telemetry.ts");
      expect(telemetry).not.toContain("setTimeout");
      expect(telemetry).not.toContain("setInterval");
    });
  });

  describe("repeated-action cooldown accuracy (client)", () => {
    it("fires once per threshold crossing, then withholds re-firing until the cooldown elapses", () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      for (let i = 0; i < 3; i += 1) {
        trackConversionIntegrityRepeatedSignal({
          surface: "submit_button",
          eventName: "direct_connect_integrity_repeated_submit",
          minCount: 2,
          windowMs: 50,
          cooldownMs: 10_000,
          payload: { routeTemplate: "/direct-connect" },
        });
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(latestPayload(fetchMock)).toMatchObject({
        eventName: "direct_connect_integrity_repeated_submit",
        clickCount: 2,
      });

      // A brand-new window starts immediately (windowMs elapsed conceptually
      // isn't required here -- the point is the cooldown, not the window),
      // but the mandatory cooldown must still suppress re-emission.
      for (let i = 0; i < 3; i += 1) {
        trackConversionIntegrityRepeatedSignal({
          surface: "submit_button",
          eventName: "direct_connect_integrity_repeated_submit",
          minCount: 2,
          windowMs: 50,
          cooldownMs: 10_000,
          payload: { routeTemplate: "/direct-connect" },
        });
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("dedupes independently per route template", () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      trackConversionIntegrityRepeatedSignal({
        surface: "cta",
        eventName: "direct_connect_integrity_repeated_click",
        minCount: 1,
        windowMs: 1000,
        cooldownMs: 1000,
        payload: { routeTemplate: "/direct-connect/board" },
      });
      trackConversionIntegrityRepeatedSignal({
        surface: "cta",
        eventName: "direct_connect_integrity_repeated_click",
        minCount: 1,
        windowMs: 1000,
        cooldownMs: 1000,
        payload: { routeTemplate: "/direct-connect/inbox" },
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("server-derived funnel-stall accuracy", () => {
    const baseNow = new Date("2026-07-20T12:00:00.000Z");
    const windowMs = 30 * 60 * 1000;

    it("flags an attempt that started and never advanced once the window elapses", () => {
      const startedAt = new Date(baseNow.getTime() - windowMs - 1000);
      const stalls = computeDirectConnectFunnelStalls({
        events: [
          { identityKey: "u:1", eventType: "direct_connect_request_started", createdAt: startedAt },
        ],
        alreadyStalled: [],
        windowMs,
        now: baseNow,
      });
      expect(stalls).toHaveLength(1);
      expect(stalls[0]).toMatchObject({
        identityKey: "u:1",
        funnelStep: "direct_connect_request_started",
      });
    });

    it("does not flag an attempt still inside the window", () => {
      const startedAt = new Date(baseNow.getTime() - 5000);
      const stalls = computeDirectConnectFunnelStalls({
        events: [
          { identityKey: "u:1", eventType: "direct_connect_request_started", createdAt: startedAt },
        ],
        alreadyStalled: [],
        windowMs,
        now: baseNow,
      });
      expect(stalls).toHaveLength(0);
    });

    it("flags the highest stage when that later stage also exceeds the window", () => {
      const startedAt = new Date(baseNow.getTime() - windowMs - 1000);
      const submittedAt = new Date(startedAt.getTime() + 1000);
      const stalls = computeDirectConnectFunnelStalls({
        events: [
          { identityKey: "u:1", eventType: "direct_connect_request_started", createdAt: startedAt },
          {
            identityKey: "u:1",
            eventType: "direct_connect_request_submitted",
            createdAt: submittedAt,
          },
        ],
        alreadyStalled: [],
        windowMs,
        now: baseNow,
      });
      expect(stalls).toHaveLength(1);
      expect(stalls[0]).toMatchObject({
        identityKey: "u:1",
        funnelStep: "direct_connect_request_submitted",
      });
    });

    it("is idempotent -- does not re-flag an attempt already logged as stalled", () => {
      const startedAt = new Date(baseNow.getTime() - windowMs - 1000);
      const stalls = computeDirectConnectFunnelStalls({
        events: [
          { identityKey: "u:1", eventType: "direct_connect_request_started", createdAt: startedAt },
        ],
        alreadyStalled: [{ identityKey: "u:1", startedAt }],
        windowMs,
        now: baseNow,
      });
      expect(stalls).toHaveLength(0);
    });

    it("evaluates a second, later attempt independently of a completed earlier one", () => {
      const firstStart = new Date(baseNow.getTime() - 3 * windowMs);
      const firstSubmit = new Date(firstStart.getTime() + 1000);
      const secondStart = new Date(baseNow.getTime() - windowMs - 1000);

      const stalls = computeDirectConnectFunnelStalls({
        events: [
          {
            identityKey: "u:1",
            eventType: "direct_connect_request_started",
            createdAt: firstStart,
          },
          {
            identityKey: "u:1",
            eventType: "direct_connect_request_submitted",
            createdAt: firstSubmit,
          },
          {
            identityKey: "u:1",
            eventType: "direct_connect_requester_reply_viewed",
            createdAt: new Date(firstSubmit.getTime() + 1000),
          },
          {
            identityKey: "u:1",
            eventType: "direct_connect_request_started",
            createdAt: secondStart,
          },
        ],
        alreadyStalled: [],
        windowMs,
        now: baseNow,
      });

      expect(stalls).toHaveLength(1);
      expect(stalls[0].startedAt.getTime()).toBe(secondStart.getTime());
    });

    it("only reasons about the contract-locked funnel event vocabulary", () => {
      expect(DIRECT_CONNECT_FUNNEL_ORDER).toContain("direct_connect_request_started");
      expect(DIRECT_CONNECT_FUNNEL_ORDER).toContain("direct_connect_request_submitted");
      expect(DIRECT_CONNECT_FUNNEL_ORDER).toContain("direct_connect_requester_reply_viewed");
    });
  });

  describe("no client-side stall emission (defers to server)", () => {
    it("keeps the funnel-stall event name and timer-based capture out of the client bundle", () => {
      const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
      const telemetry = read("client/src/lib/telemetry.ts");
      const combined = `${shell}\n${telemetry}`;

      expect(combined).not.toContain("direct_connect_funnel_step_stalled");
      expect(telemetry).not.toContain("setTimeout");
      expect(telemetry).not.toContain("setInterval");
    });
  });

  describe("rate limiting and payload-size guardrails are wired up", () => {
    it("applies a rate limiter and a payload size cap to the shell analytics endpoint", () => {
      const analyticsSource = read("server/routes/analytics-routes.ts");
      expect(analyticsSource).toContain("shellAnalyticsLimiter");
      expect(analyticsSource).toContain("createPostgresRateLimitStore");
      expect(analyticsSource).toContain("MAX_SHELL_EVENT_BYTES");
      expect(analyticsSource).toContain('app.post("/api/analytics/shell", shellAnalyticsLimiter');
    });
  });

  describe("scope discipline", () => {
    it("keeps the integrity event vocabulary strictly Direct-Connect-shaped, not a general observability pipeline", () => {
      for (const eventName of DIRECT_CONNECT_INTEGRITY_EVENT_NAMES) {
        expect(eventName.startsWith("direct_connect_")).toBe(true);
      }
      expect(DIRECT_CONNECT_INTEGRITY_EVENT_NAMES.size).toBeLessThanOrEqual(5);
    });
  });
});
