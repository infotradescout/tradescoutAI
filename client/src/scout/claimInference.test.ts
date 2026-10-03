import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConfirmationOptions, inferClaimsFromIntent } from "./claimInference";

const fetchMock = vi.fn();
const suggestion = { claimType: "find_help", confidence: 0.85, evidence: "I need help" };
const result = { suggestions: [suggestion], summary: "Seeking help", followups: [] };
function respond(content: unknown) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content }) });
}

describe("claim inference client and fallback", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns advisory suggestions without granting model-asserted eligibility or taking another action", async () => {
    respond(JSON.stringify({ ...result, summary: "Model asserts verified eligibility" }));
    const inferred = await inferClaimsFromIntent("I need help", [], "Synthetic County");
    expect(inferred.suggestions).toEqual([suggestion]);
    expect(buildConfirmationOptions(inferred)[0]).toMatchObject({
      claimType: "find_help",
      defaultChecked: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ai/inference");
    expect(options.credentials).toBe("include");
    const payload = JSON.parse(options.body);
    expect(payload).not.toHaveProperty("model");
    expect(payload.maxTokens).toBe(500);
    expect(payload.temperature).toBe(0.3);
    expect(payload.systemPrompt).toContain(
      "Never infer admin privileges, verification, licenses, or badges."
    );
    // This inference path makes no claim-write, contact, purchase, or trust-gate request.
  });

  it("preserves object-form inference responses", async () => {
    respond(result);
    expect(await inferClaimsFromIntent("I need help")).toEqual(result);
  });

  it("uses keyword suggestions on an HTTP failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const inferred = await inferClaimsFromIntent("I need someone to repair a sink");
    expect(inferred.suggestions.some((s) => s.claimType === "find_help")).toBe(true);
    expect(inferred.summary).toContain("Keyword-based inference");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the existing service-provider fallback on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("synthetic network unavailable"));
    const inferred = await inferClaimsFromIntent("I offer plumbing services");
    expect(inferred.suggestions.some((s) => s.claimType === "offer_services")).toBe(true);
    expect(inferred.summary).toContain("Keyword-based inference");
  });

  it("aborts at the unchanged five-second budget and falls back", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        })
    );
    const pending = inferClaimsFromIntent("I need someone to repair a sink");
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const inferred = await pending;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(inferred.suggestions.some((s) => s.claimType === "find_help")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["I cannot provide that", '{"suggestions":[', '{"invalid":true}'])(
    "falls back on unusable output %s",
    async (content) => {
      respond(content);
      const inferred = await inferClaimsFromIntent("Just browsing");
      expect(inferred.suggestions[0].claimType).toBe("exploring");
      expect(inferred.summary).toContain("Keyword-based inference");
    }
  );

  it("caps suggestions at five and supplies an empty followup array", async () => {
    respond(
      JSON.stringify({
        suggestions: Array.from({ length: 7 }, () => suggestion),
        summary: "Synthetic suggestions",
      })
    );
    const inferred = await inferClaimsFromIntent("I need help");
    expect(inferred.suggestions).toHaveLength(5);
    expect(inferred.followups).toEqual([]);
  });

  it("clears the timeout after successful inference", async () => {
    vi.useFakeTimers();
    respond(JSON.stringify(result));
    await inferClaimsFromIntent("I need help");
    expect(vi.getTimerCount()).toBe(0);
  });
});
