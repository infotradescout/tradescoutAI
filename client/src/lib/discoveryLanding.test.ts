/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendDiscoveryAttributionHandoff,
  DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
  getPublishedDiscoveryCanonicalRoute,
  getStoredDiscoveryLandingAttribution,
  resetDiscoveryLandingDedupeForTests,
  trackDiscoveryLandingOnce,
  trackPublicProfileCtaOnce,
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
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = "https://www.thetradescout.com/u/jw-stone";
    document.head.appendChild(canonical);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204 }));
  });

  afterEach(() => {
    document.head
      .querySelectorAll(
        'meta[name="tradescout-business-slug"], meta[name="tradescout-business-entity-type"], meta[name="tradescout-profile-slug"], meta[name="tradescout-profile-entity-type"], meta[name="tradescout-discovery-route"], meta[name="tradescout-discovery-attribution"]'
      )
      .forEach((meta) => meta.remove());
    document.head.querySelectorAll('link[rel="canonical"]').forEach((link) => link.remove());
    sessionStorage.removeItem(DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY);
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
      entitySlug: "jw-stone",
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
      discoveryAttributionToken,
    });
    expect(body).not.toHaveProperty("entryRequestId");
    expect(body).not.toHaveProperty("sourceHint");
    expect(getStoredDiscoveryLandingAttribution("jw-stone")).toEqual({
      discoveryAttributionToken,
      entitySlug: "jw-stone",
      businessSlug: "jw-stone",
    });
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
    expect(body.referrerClass).toBe("chatgpt");
    expect(body).not.toHaveProperty("referrerHost");
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

  it("does not block when analytics fetch fails", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("network down"));
    const ok = await trackDiscoveryLandingOnce({
      canonicalRoute: "/jw-stone",
      search: "?utm_source=chatgpt.com",
    });
    expect(ok).toBe(false);
  });

  it("records one allowlisted profile CTA per signed landing", async () => {
    document
      .querySelector('meta[name="tradescout-business-entity-type"]')
      ?.setAttribute("content", "business_profile");

    const first = await trackPublicProfileCtaOnce({ ctaKind: "direct_connect" });
    const duplicate = await trackPublicProfileCtaOnce({ ctaKind: "direct_connect" });

    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body).toEqual({
      type: "public_profile_cta",
      ctaKind: "direct_connect",
      canonicalRoute: "/u/jw-stone",
      entitySlug: "jw-stone",
      businessSlug: "jw-stone",
      entityType: "business_profile",
      discoveryAttributionToken,
    });
    expect(body).not.toHaveProperty("userAgent");
    expect(body).not.toHaveProperty("ipAddress");
    expect(body).not.toHaveProperty("label");
  });

  it("uses the signed profile identity route on a custom-domain canonical and hands it to signup", async () => {
    document
      .querySelector('meta[name="tradescout-business-slug"]')
      ?.setAttribute("content", "business-a");
    document
      .querySelector('meta[name="tradescout-business-entity-type"]')
      ?.setAttribute("content", "business_profile");
    const discoveryRoute = document.createElement("meta");
    discoveryRoute.name = "tradescout-discovery-route";
    discoveryRoute.content = "/u/business-a";
    document.head.appendChild(discoveryRoute);
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", "https://business-a.example/");

    expect(getPublishedDiscoveryCanonicalRoute()).toBe("/u/business-a");
    await trackDiscoveryLandingOnce({
      canonicalRoute: getPublishedDiscoveryCanonicalRoute() || "",
      referrer: "https://chatgpt.com/c/private-thread",
    });
    await trackPublicProfileCtaOnce({ ctaKind: "account_create" });

    const landing = JSON.parse((fetch as any).mock.calls[0][1].body);
    const cta = JSON.parse((fetch as any).mock.calls[1][1].body);
    expect(landing).toMatchObject({
      canonicalRoute: "/u/business-a",
      entitySlug: "business-a",
      businessSlug: "business-a",
    });
    expect(cta).toMatchObject({
      canonicalRoute: "/u/business-a",
      ctaKind: "account_create",
      entitySlug: "business-a",
    });

    const signupHref = appendDiscoveryAttributionHandoff(
      "https://www.thetradescout.com/pre-scout-setup?mode=create"
    );
    expect(new URL(signupHref).searchParams.get("ts_discovery")).toBe(discoveryAttributionToken);
    expect(appendDiscoveryAttributionHandoff("https://evil.example/pre-scout-setup")).toBe(
      "https://evil.example/pre-scout-setup"
    );
  });
});
