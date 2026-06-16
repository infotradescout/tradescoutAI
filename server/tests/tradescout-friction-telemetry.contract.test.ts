import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  resetFrictionTelemetryForTests,
  sanitizeFrictionPayload,
  scheduleDirectConnectStallSignal,
  trackFrictionEvent,
  trackOncePerSession,
  trackRepeatedFrictionSignal,
} from "../../client/src/lib/telemetry";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function latestPayload(fetchMock: ReturnType<typeof vi.fn>) {
  const body = fetchMock.mock.calls.at(-1)?.[1]?.body;
  return JSON.parse(String(body || "{}")) as Record<string, unknown>;
}

describe("TradeScout Direct Connect passive friction telemetry", () => {
  beforeEach(() => {
    resetFrictionTelemetryForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetFrictionTelemetryForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sanitizes sensitive keys and nested sensitive fields before persistence", () => {
    const sanitized = sanitizeFrictionPayload({
      type: "direct_connect_api_request_failed",
      source: "/direct-connect",
      section: "submit",
      reason: "status_500",
      requestText: "private request body",
      message: "private message text",
      phone: "555-0000",
      address: "123 Private Street",
      email: "private@example.com",
      token: "payment-token",
      privateNotes: "private note",
      uploadedContent: "file contents",
      nested: {
        safe: "kept",
        description: "nested private description",
        paymentCard: "4111111111111111",
      },
    });

    expect(JSON.stringify(sanitized)).not.toContain("private request body");
    expect(JSON.stringify(sanitized)).not.toContain("private message text");
    expect(JSON.stringify(sanitized)).not.toContain("555-0000");
    expect(JSON.stringify(sanitized)).not.toContain("123 Private Street");
    expect(JSON.stringify(sanitized)).not.toContain("private@example.com");
    expect(JSON.stringify(sanitized)).not.toContain("payment-token");
    expect(JSON.stringify(sanitized)).not.toContain("private note");
    expect(JSON.stringify(sanitized)).not.toContain("file contents");
    expect(JSON.stringify(sanitized)).not.toContain("4111111111111111");
    expect(sanitized.nested).toMatchObject({ safe: "kept" });
  });

  it("dispatches non-blocking telemetry and strips sensitive mock values", () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("event store offline"));
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      trackFrictionEvent("direct_connect_draft_restore_failed", {
        source: "/direct-connect",
        section: "auth_handoff",
        reason: "parse_failed",
        description: "SMOKE PRIVATE REQUEST TEXT",
        message: "SMOKE PRIVATE MESSAGE",
        phone: "555-1212",
        address: "123 Smoke Lane",
      })
    ).not.toThrow();

    const payload = latestPayload(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/shell",
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(payload.type).toBe("direct_connect_draft_restore_failed");
    expect(JSON.stringify(payload)).not.toContain("SMOKE PRIVATE REQUEST TEXT");
    expect(JSON.stringify(payload)).not.toContain("SMOKE PRIVATE MESSAGE");
    expect(JSON.stringify(payload)).not.toContain("555-1212");
    expect(JSON.stringify(payload)).not.toContain("123 Smoke Lane");
  });

  it("dedupes repeated submit attempts until the threshold is crossed once", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 5; i += 1) {
      trackRepeatedFrictionSignal({
        key: "submit-window",
        type: "direct_connect_repeated_submit_attempt",
        threshold: 2,
        windowMs: 3000,
        payload: { source: "/direct-connect", section: "submit" },
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(latestPayload(fetchMock)).toMatchObject({
      type: "direct_connect_repeated_submit_attempt",
      dispatchCount: 3,
    });
  });

  it("dedupes repeated CTA clicks until the threshold is crossed once", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 8; i += 1) {
      trackRepeatedFrictionSignal({
        key: "cta-window",
        type: "direct_connect_repeated_cta_click",
        threshold: 5,
        windowMs: 4000,
        payload: { source: "/direct-connect", section: "first_task_prompt" },
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(latestPayload(fetchMock)).toMatchObject({
      type: "direct_connect_repeated_cta_click",
      dispatchCount: 6,
    });
  });

  it("emits empty-state seen once and not on every rerender", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    trackOncePerSession("empty-inbox", "direct_connect_empty_state_seen", {
      source: "/direct-connect/inbox",
      section: "inbox",
      reason: "no_replies",
    });
    trackOncePerSession("empty-inbox", "direct_connect_empty_state_seen", {
      source: "/direct-connect/inbox",
      section: "inbox",
      reason: "no_replies",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("emits auth-handoff stalled with fake timers and dedupes the same draft", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    scheduleDirectConnectStallSignal({
      key: "auth-draft",
      type: "direct_connect_auth_handoff_stalled",
      delayMs: 15 * 60 * 1000,
      shouldEmit: () => true,
      payload: { source: "/direct-connect", section: "auth_handoff", reason: "draft_pending" },
    });
    scheduleDirectConnectStallSignal({
      key: "auth-draft",
      type: "direct_connect_auth_handoff_stalled",
      delayMs: 15 * 60 * 1000,
      shouldEmit: () => true,
      payload: { source: "/direct-connect", section: "auth_handoff", reason: "draft_pending" },
    });

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(latestPayload(fetchMock)).toMatchObject({
      type: "direct_connect_auth_handoff_stalled",
      section: "auth_handoff",
    });
  });

  it("does not emit a funnel stall when the user has moved on", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    scheduleDirectConnectStallSignal({
      key: "step-post",
      type: "direct_connect_funnel_step_stalled",
      delayMs: 5 * 60 * 1000,
      shouldEmit: () => false,
      payload: { source: "/direct-connect", section: "post" },
    });

    vi.advanceTimersByTime(5 * 60 * 1000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emits draft restore and permission signals with safe reason codes only", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    trackFrictionEvent("direct_connect_draft_restore_failed", {
      source: "/direct-connect",
      section: "auth_handoff",
      reason: "invalid_shape",
      requestText: "private draft body",
    });
    trackFrictionEvent("direct_connect_permission_or_role_blocked", {
      source: "/direct-connect/inbox",
      section: "inbox",
      reason: "auth_required",
      email: "private@example.com",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const serializedCalls = JSON.stringify(fetchMock.mock.calls);
    expect(serializedCalls).toContain("invalid_shape");
    expect(serializedCalls).toContain("auth_required");
    expect(serializedCalls).not.toContain("private draft body");
    expect(serializedCalls).not.toContain("private@example.com");
  });

  it("route-gates ErrorBoundary Direct Connect friction logging", () => {
    const source = read("client/src/components/ui/error-boundary.tsx");

    expect(source).toContain("isDirectConnectRoute(path)");
    expect(source).toContain('"direct_connect_client_runtime_error"');
    expect(source).toContain('type: "client_runtime_error"');
  });

  it("wires Direct Connect-only friction signals without schema or dashboard work", () => {
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const telemetry = read("client/src/lib/telemetry.ts");

    for (const event of [
      "direct_connect_api_request_failed",
      "direct_connect_auth_handoff_stalled",
      "direct_connect_draft_restore_failed",
      "direct_connect_form_validation_blocked",
      "direct_connect_repeated_submit_attempt",
      "direct_connect_repeated_cta_click",
      "direct_connect_empty_state_seen",
      "direct_connect_permission_or_role_blocked",
      "direct_connect_funnel_step_stalled",
    ]) {
      expect(`${shell}\n${telemetry}`).toContain(event);
    }
    expect(telemetry).toContain('fetch("/api/analytics/shell"');
    expect(telemetry).not.toContain("session replay");
    expect(telemetry).not.toContain("stripe");
  });
});
