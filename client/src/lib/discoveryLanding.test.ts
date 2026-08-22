/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
  DISCOVERY_LANDING_SESSION_STORAGE_KEY,
  getOrCreateDiscoveryAnonymousSessionId,
  getStoredDiscoveryLandingAttribution,
  resetDiscoveryLandingDedupeForTests,
  trackDiscoveryLandingOnce,
} from "./discoveryLanding";

const discoveryAttributionToken = "signed-payload.signed-signature";

describe("trackDiscoveryLandingOnce", () => {
  beforeEach(() => {
    resetDiscoveryLandingDedupeForTests();
    for (const [name, content] of [
      ["tradescout-business-slug", "jw-stone"],
      ["tradescout-business-entity-type", "business_marketplace"],
      ["tradescout-discovery-attribution", discoveryAttributionToken],
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
        'meta[name="tradescout-business-slug"], meta[name="tradescout-business-entity-type"], meta[name="tradescout-discovery-attribution"]'
      )
      .forEach((meta) => meta.remove());
    sessionStorage.removeItem(DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY);
    sessionStorage.removeItem(DISCOVERY_LANDING_SESSION_STORAGE_KEY);
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
      discoveryAttributionToken,
    });
    expect(body).not.toHaveProperty("entryRequestId");
    expect(body).not.toHaveProperty("sourceHint");
    expect(body.anonymousSessionId).toMatch(/^discovery-/);
    expect((fetch as any).mock.calls[0][1].headers["X-Anonymous-Session-Id"]).toBe(
      body.anonymousSessionId
    );
    expect(getStoredDiscoveryLandingAttribution("jw-stone")).toEqual({
      discoveryAttributionToken,
      businessSlug: "jw-stone",
    });
  });

  it("keeps one anonymous discovery session for the browser tab", () => {
    const first = getOrCreateDiscoveryAnonymousSessionId();
    const second = getOrCreateDiscoveryAnonymousSessionId();

    expect(first).toMatch(/^discovery-/);
    expect(second).toBe(first);
    expect(sessionStorage.getItem(DISCOVERY_LANDING_SESSION_STORAGE_KEY)).toBe(first);
  });

  it("does not reuse a stored attribution envelope for another profile", async () => {
    await trackDiscoveryLandingOnce({ canonicalRoute: "/jw-stone" });

    expect(getStoredDiscoveryLandingAttribution("jrs-auto-glass")).toBeNull();
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

  it("sends the server-issued envelope rather than a request header id", async () => {
    await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
    });

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.discoveryAttributionToken).toBe(discoveryAttributionToken);
    expect(body).not.toHaveProperty("entryRequestId");
  });

  it("projects a custom-domain root landing onto the profile-scoped route", async () => {
    const slugMeta = document.querySelector('meta[name="tradescout-business-slug"]');
    const entityTypeMeta = document.querySelector('meta[name="tradescout-business-entity-type"]');
    slugMeta?.setAttribute("content", "example-profile");
    entityTypeMeta?.setAttribute("content", "business_profile");

    await trackDiscoveryLandingOnce({ canonicalRoute: "/" });

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body).toMatchObject({
      canonicalRoute: "/u/example-profile",
      businessSlug: "example-profile",
      entityType: "business_profile",
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
