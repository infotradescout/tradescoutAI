import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeDemandEventPayload, trackDemandEvent } from "./demandEngine";

function stubBrowser(url = "https://www.thetradescout.com/?utm_campaign=launch") {
  const parsed = new URL(url);
  const stored = new Map<string, string>();
  vi.stubGlobal("window", {
    location: {
      href: parsed.toString(),
      origin: parsed.origin,
      pathname: parsed.pathname,
      search: parsed.search,
    },
    localStorage: {
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => stored.set(key, value)),
    },
  });
  return stored;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("demand event transport", () => {
  it("keeps only the bounded current demand fields", () => {
    stubBrowser();
    expect(
      sanitizeDemandEventPayload({
        placement: "hero_primary",
        variant: "hybrid_public_landing",
        href: "/direct-connect?email=private@example.com#secret",
        target: "/scout?prompt=private",
        mode: "create",
        verificationRequired: true,
        presenceType: "personal",
        intent: "home_readiness",
        source: "landing_primary_cta",
        hasPrompt: false,
        surface: "public_landing",
        cta: "make_a_request",
        stateCode: "la",
        county_fips: "22105",
        requestText: "private request",
        message: "private message",
        phone: "9855550100",
        email: "private@example.com",
        address: "private address",
        nested: { private: true },
      })
    ).toEqual({
      placement: "hero_primary",
      variant: "hybrid_public_landing",
      mode: "create",
      presenceType: "personal",
      intent: "home_readiness",
      source: "landing_primary_cta",
      surface: "public_landing",
      cta: "make_a_request",
      verificationRequired: true,
      hasPrompt: false,
      href: "/direct-connect",
      target: "/scout",
      stateCode: "LA",
      countyFips: "22105",
    });
  });

  it("rejects external targets and malformed safe fields", () => {
    stubBrowser();
    expect(
      sanitizeDemandEventPayload({
        href: "https://evil.example/private",
        target: "javascript:alert(1)",
        stateCode: "Louisiana",
        countyFips: "2210",
        placement: "contains@email",
        verificationRequired: "true",
      })
    ).toEqual({});
  });

  it("never sends raw search or private caller content", async () => {
    stubBrowser(
      "https://www.thetradescout.com/?utm_source=facebook&utm_campaign=launch&email=private@example.com"
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await trackDemandEvent("cta_click", {
      placement: "hero_primary",
      variant: "hybrid_public_landing",
      href: "/direct-connect?email=private@example.com",
      source: "landing_primary_cta",
      message: "private message",
      requestText: "private request",
      phone: "9855550100",
      email: "private@example.com",
      address: "private address",
      upload: { name: "private.pdf" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      eventType: "demand.cta_click",
      data: {
        placement: "hero_primary",
        variant: "hybrid_public_landing",
        href: "/direct-connect",
        source: "landing_primary_cta",
        route: "/",
        segmentCategory: "mixed",
        segmentIntentLevel: "problem_aware",
        attribution: {
          utmSource: "facebook",
          utmCampaign: "launch",
          campaignKey: "launch",
        },
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("private message");
    expect(serialized).not.toContain("private request");
    expect(serialized).not.toContain("9855550100");
    expect(body.data).not.toHaveProperty("search");
    expect(body.data).not.toHaveProperty("timestamp");
  });
});
