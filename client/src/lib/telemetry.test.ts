import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIRECT_CONNECT_FRICTION_EVENTS,
  installDirectConnectRuntimeErrorCapture,
  resetFrictionTelemetryForTests,
  sanitizeFrictionPayload,
  toDirectConnectRouteTemplate,
  trackFrictionEvent,
  trackRepeatedFrictionSignal,
} from "./telemetry";

type FakeWindow = EventTarget & {
  location: { pathname: string; search: string };
};

function installBrowser(pathname = "/direct-connect") {
  const target = new EventTarget() as FakeWindow;
  target.location = { pathname, search: "" };
  vi.stubGlobal("window", target);
  return target;
}

function readFetchBody(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, options] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, options, body: JSON.parse(String(options.body)) };
}

beforeEach(() => resetFrictionTelemetryForTests());

afterEach(() => {
  resetFrictionTelemetryForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Direct Connect friction registry", () => {
  it("keeps only the nine browser-observed signals in the client registry", () => {
    expect(DIRECT_CONNECT_FRICTION_EVENTS).toEqual([
      "direct_connect_client_runtime_error",
      "direct_connect_api_request_failed",
      "direct_connect_auth_handoff_stalled",
      "direct_connect_draft_restore_failed",
      "direct_connect_form_validation_blocked",
      "direct_connect_repeated_submit_attempt",
      "direct_connect_repeated_cta_click",
      "direct_connect_empty_state_seen",
      "direct_connect_permission_or_role_blocked",
    ]);
    expect(DIRECT_CONNECT_FRICTION_EVENTS).not.toContain(
      "direct_connect_funnel_step_stalled" as any
    );
  });

  it("removes query strings and replaces identifying route segments", () => {
    expect(
      toDirectConnectRouteTemplate(
        "/direct-connect/requests/12345678-1234-1234-1234-123456789abc?phone=9856626247"
      )
    ).toBe("/direct-connect/requests/:id");
    expect(toDirectConnectRouteTemplate("/community/private-user-id")).toBe(
      "/direct-connect"
    );
  });
});

describe("Direct Connect payload safety", () => {
  it("keeps only flat safe metadata and rejects phone-like IDs", () => {
    installBrowser("/direct-connect/requests/1234567890123456");

    expect(
      sanitizeFrictionPayload({
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
        route: "/direct-connect/requests/1234567890123456?email=private@example.com",
        message: "private request text",
        requestText: "private request text",
        phone: "9856626247",
        email: "private@example.com",
        address: "private address",
        privateNotes: "private note",
        upload: { name: "private.pdf" },
        nested: { secret: true },
        rawError: new Error("private stack"),
      })
    ).toEqual({
      source: "request_submit",
      section: "post",
      reason: "validation_failed",
      field: "title",
      funnelStep: "review",
      requestId: "req_123",
      blocked: true,
      statusCode: 422,
      retryCount: 2,
      routeTemplate: "/direct-connect/requests/:id",
    });
  });

  it("rejects contact values placed in allowed fields", () => {
    installBrowser();
    expect(
      sanitizeFrictionPayload({
        source: "private@example.com",
        reason: "+1 (985) 662-6247",
        requestId: "9856626247",
        section: "post",
      })
    ).toEqual({
      section: "post",
      routeTemplate: "/direct-connect",
    });
  });
});

describe("Direct Connect friction transport", () => {
  it("uses the hardened endpoint and never sends raw content", () => {
    installBrowser();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    trackFrictionEvent("direct_connect_api_request_failed", {
      source: "request_submit",
      section: "post",
      statusCode: 500,
      errorCode: "server_error",
      blocked: true,
      requestId: "req_123",
      message: "private message",
      phone: "9856626247",
      userAgent: "private fingerprint",
      stack: "private stack",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, options, body } = readFetchBody(fetchMock);
    expect(url).toBe("/api/events");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
    expect(body).toEqual({
      eventType: "direct_connect_api_request_failed",
      data: {
        source: "request_submit",
        section: "post",
        errorCode: "server_error",
        requestId: "req_123",
        blocked: true,
        statusCode: 500,
        routeTemplate: "/direct-connect",
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("private message");
    expect(serialized).not.toContain("9856626247");
    expect(serialized).not.toContain("fingerprint");
    expect(serialized).not.toContain("private stack");
  });

  it("records repeated CTA clicks as clickCount", () => {
    installBrowser();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < 5; index += 1) {
      trackRepeatedFrictionSignal({
        key: "start-request",
        type: "direct_connect_repeated_cta_click",
        threshold: 2,
        windowMs: 2_000,
        payload: { section: "post" },
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readFetchBody(fetchMock).body).toMatchObject({
      eventType: "direct_connect_repeated_cta_click",
      data: {
        section: "post",
        reason: "start-request",
        clickCount: 3,
      },
    });
  });

  it("records repeated submissions as attemptCount", () => {
    installBrowser();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < 4; index += 1) {
      trackRepeatedFrictionSignal({
        key: "submit-request",
        type: "direct_connect_repeated_submit_attempt",
        threshold: 2,
        windowMs: 2_000,
        payload: { section: "review" },
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readFetchBody(fetchMock).body).toMatchObject({
      eventType: "direct_connect_repeated_submit_attempt",
      data: {
        section: "review",
        reason: "submit-request",
        attemptCount: 3,
      },
    });
  });
});

describe("Direct Connect runtime evidence", () => {
  it("captures one controlled runtime signal without reading error details", () => {
    const target = installBrowser();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    installDirectConnectRuntimeErrorCapture(target as unknown as Window);

    const first = new Event("error");
    Object.defineProperty(first, "message", { value: "private runtime message" });
    Object.defineProperty(first, "error", { value: new Error("private stack") });
    target.dispatchEvent(first);
    target.dispatchEvent(new Event("error"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(readFetchBody(fetchMock).body);
    expect(serialized).toContain("direct_connect_client_runtime_error");
    expect(serialized).not.toContain("private runtime message");
    expect(serialized).not.toContain("private stack");
  });

  it("does not report runtime failures outside Direct Connect", () => {
    const target = installBrowser("/community");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    installDirectConnectRuntimeErrorCapture(target as unknown as Window);
    target.dispatchEvent(new Event("error"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
