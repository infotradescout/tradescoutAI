/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
  resetDiscoveryLandingDedupeForTests,
  trackDiscoveryLandingOnce,
} from "./discoveryLanding";

describe("trackDiscoveryLandingOnce", () => {
  beforeEach(() => {
    resetDiscoveryLandingDedupeForTests();
    for (const [name, content] of [
      ["tradescout-business-slug", "jw-stone"],
      ["tradescout-business-entity-type", "business_marketplace"],
    ]) {
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
  });

  afterEach(() => {
    document.head
      .querySelectorAll(
        'meta[name="tradescout-business-slug"], meta[name="tradescout-business-entity-type"], meta[name="tradescout-entry-request-id"]'
      )
      .forEach((meta) => meta.remove());
    sessionStorage.removeItem(DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY);
    document.head.querySelector('meta[name="tradescout-entry-request-id"]')?.remove();
    vi.unstubAllGlobals();
    resetDiscoveryLandingDedupeForTests();
  });

  it("records a normal public landing once and ignores rerender duplicates", async () => {
    const first = await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
      search: "",
      referrer: "",
    });
    const second = await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
      search: "",
      referrer: "",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body).toMatchObject({
      type: "discovery_landing",
      canonicalRoute: "/jw-stone",
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
    });
    expect(body).not.toHaveProperty("sourceHint");
  });

  it("records sanitized chatgpt source hint without full query persistence", async () => {
    await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
      search: "?utm_source=chatgpt.com&utm_content=secret-thread&phone=555",
      referrer: "https://chatgpt.com/c/abc?q=full",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.sourceHint).toBe("chatgpt");
    expect(body.referrerHost).toBe("chatgpt.com");
    expect(JSON.stringify(body)).not.toContain("secret-thread");
    expect(JSON.stringify(body)).not.toContain("phone");
    expect(JSON.stringify(body)).not.toContain("utm_content");
    expect(JSON.stringify(body)).not.toContain("/c/abc");
  });

  it("links the landing event to the server request that rendered the page", async () => {
    const meta = document.createElement("meta");
    meta.name = "tradescout-entry-request-id";
    meta.content = "entry-123";
    document.head.appendChild(meta);

    await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
    });

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body).toMatchObject({
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
      entryRequestId: "entry-123",
    });
  });

  it("does not block when analytics fetch fails", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("network down"));
    const ok = await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
      search: "?utm_source=chatgpt.com",
    });
    expect(ok).toBe(false);
  });
});
