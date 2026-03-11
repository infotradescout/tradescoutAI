import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UnifiedScoutRouterClient,
  type UnifiedResolveOptions,
  type UnifiedRouterUserContext,
} from "./unifiedRouterClient";

const userContext: UnifiedRouterUserContext = {
  userId: "user-1",
  isAuthenticated: true,
  userRole: "homeowner",
  location: { county: "Harris", state: "TX" },
};

function mockFetchOnce(payload: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  });
  vi.stubGlobal("fetch", fetchMock as any);
  return fetchMock;
}

describe("UnifiedScoutRouterClient", () => {
  beforeEach(() => {
    UnifiedScoutRouterClient.clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolveIntent sends options payload to API", async () => {
    const fetchMock = mockFetchOnce({
      action: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" },
      confidence: 0.9,
      reasoning: "Matched",
      sourceLayer: "deterministic",
    });

    const options: UnifiedResolveOptions = {
      situation: {
        activeObjectives: [{ id: "obj-1", status: "active", progressPct: 40 }],
        recentEvents: [{ type: "message_sent", timestamp: "2026-03-10T00:00:00.000Z" }],
        urgencySignals: [{ source: "direct_user_signal", level: 2 }],
        now: "2026-03-10T00:00:00.000Z",
      },
      trust: {
        cvsScore: 80,
        verificationStatus: "approved",
      },
      tone: {
        scenario: "next_step_prompt",
        includeNextStep: true,
      },
    };

    const result = await UnifiedScoutRouterClient.resolveIntent(
      "open direct connect",
      userContext,
      options
    );

    expect(result?.action.to).toBe("/direct-connect");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(call.body));
    expect(body.situation).toBeDefined();
    expect(body.trust).toBeDefined();
    expect(body.tone).toBeDefined();
  });

  it("uses cache for repeated intent+options combination", async () => {
    const fetchMock = mockFetchOnce({
      action: { type: "NAVIGATE", to: "/community", label: "Community" },
      confidence: 0.85,
      reasoning: "Matched",
      sourceLayer: "deterministic",
    });

    const options: UnifiedResolveOptions = {
      tone: { scenario: "next_step_prompt" },
    };

    const first = await UnifiedScoutRouterClient.resolveIntent(
      "open community",
      userContext,
      options
    );
    const second = await UnifiedScoutRouterClient.resolveIntent(
      "open community",
      userContext,
      options
    );

    expect(first?.action.to).toBe("/community");
    expect(second?.action.to).toBe("/community");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not reuse cache when options signature differs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          action: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" },
          confidence: 0.9,
          reasoning: "Matched",
          sourceLayer: "deterministic",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          action: { type: "NAVIGATE", to: "/community", label: "Community" },
          confidence: 0.75,
          reasoning: "Matched",
          sourceLayer: "deterministic",
        }),
      });
    vi.stubGlobal("fetch", fetchMock as any);

    const first = await UnifiedScoutRouterClient.resolveIntent("open route", userContext, {
      tone: { scenario: "next_step_prompt" },
    });
    const second = await UnifiedScoutRouterClient.resolveIntent("open route", userContext, {
      tone: { scenario: "confidence_low" },
    });

    expect(first?.action.to).toBe("/direct-connect");
    expect(second?.action.to).toBe("/community");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when all routing bases return 404", async () => {
    const fetchMock = mockFetchOnce({ error: "Intent not matched" }, 404);

    const result = await UnifiedScoutRouterClient.resolveIntent(
      "unknown intent words",
      userContext
    );

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls through to backup routing base when primary returns 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: "Not found" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          action: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" },
          confidence: 0.9,
          reasoning: "Matched",
          sourceLayer: "deterministic",
        }),
      });
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await UnifiedScoutRouterClient.resolveIntent("open direct connect", userContext);

    expect(result?.action.to).toBe("/direct-connect");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back locally when resolve endpoint errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await UnifiedScoutRouterClient.resolveIntent(
      "open exchange marketplace",
      userContext
    );

    expect(result?.sourceLayer).toBe("fallback");
    expect(result?.action.to).toBe("/exchange");
  });

  it("falls back to jobs workspace for jobs-workspace phrasing when resolve errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await UnifiedScoutRouterClient.resolveIntent(
      "open my jobs workspace",
      userContext
    );

    expect(result?.sourceLayer).toBe("fallback");
    expect(result?.action.to).toBe("/finances/jobs");
    expect(result?.action.label).toBe("Open jobs workspace");
  });

  it("falls back to direct connect for quote/trade phrasing when resolve errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await UnifiedScoutRouterClient.resolveIntent(
      "I need a roofing quote",
      userContext
    );

    expect(result?.sourceLayer).toBe("fallback");
    expect(result?.action.to).toBe("/direct-connect");
  });

  it("validateAction falls back locally if api fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await UnifiedScoutRouterClient.validateAction(
      { type: "SEND_ADMIN_BROADCAST", payload: { title: "x", message: "y" } },
      { ...userContext, userRole: "homeowner" }
    );

    expect(result.valid).toBe(false);
    expect(result.metadata?.requiresRole).toBe("admin");
  });

  it("discoverFeatures returns empty on failed response", async () => {
    const fetchMock = mockFetchOnce({ error: "bad" }, 500);

    const result = await UnifiedScoutRouterClient.discoverFeatures("community", userContext);

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("generateFallbackActions returns local defaults on api failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock as any);

    const actions = await UnifiedScoutRouterClient.generateFallbackActions(
      "unknown",
      "route_unmatched",
      userContext
    );

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((action) => action.to === "/direct-connect")).toBe(true);
  });

  it("exposes cache stats and clear operations", () => {
    expect(UnifiedScoutRouterClient.getCacheStats().ttlMs).toBeGreaterThan(0);
    UnifiedScoutRouterClient.clearCache();
    expect(UnifiedScoutRouterClient.getCacheStats().size).toBe(0);
  });
});
