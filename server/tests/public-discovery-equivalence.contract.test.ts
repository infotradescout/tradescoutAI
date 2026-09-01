import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profiles: new Map<string, any>(),
  businesses: new Map<string, any>(),
}));

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async (slug: string) => mocks.profiles.get(slug) || null),
    getBusinessPublicById: vi.fn(async (id: string) => mocks.businesses.get(id) || null),
  },
}));

import { buildPublicProfileHtml } from "../publicProfileHtml";
import {
  isFactBearingPublicDiscoveryHtml,
  preparePublicSeoHtmlForUserAgent,
} from "../publicSeoHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="keywords" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" crossorigin src="/assets/index-test.js"></script>
  </body>
</html>`;

const USER_AGENTS = [
  "Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
] as const;

const BUSINESS_FIXTURES = [
  {
    slug: "river-city-auto-glass",
    name: "JR's Auto Glass",
    headline: "Mobile auto glass service for daily drivers.",
    servicesDescription: "Windshield replacement, chip repair, and camera recalibration.",
    categories: ["Auto glass"],
    serviceAreas: ["Hamilton County"],
    tradePartner: true,
    profileBooking: null,
  },
  {
    slug: "la-plumbing",
    name: "LA Plumbing",
    headline: "Residential plumbing help with clear next steps.",
    servicesDescription: "Leak repair, drain service, and fixture installation.",
    categories: ["Plumbing", "Home services"],
    serviceAreas: ["East Baton Rouge Parish", "Ascension Parish"],
    tradePartner: false,
    profileBooking: { enabled: true, paidBookings: false },
  },
  {
    slug: "hill-country-fabrication",
    name: "Pro Fab Specialty Services LLC",
    headline: "Specialty fabrication for practical jobsite needs.",
    servicesDescription: "Custom fabrication, repair, and specialty metal work.",
    categories: ["Fabrication", "Metal work", "Specialty services"],
    serviceAreas: ["Travis County"],
    tradePartner: false,
    profileBooking: { enabled: false, pricingTableEnabled: true },
  },
] as const;

function registerFixture(fixture: (typeof BUSINESS_FIXTURES)[number]) {
  const businessId = `business-${fixture.slug}`;
  mocks.profiles.set(fixture.slug, {
    id: `profile-${fixture.slug}`,
    slug: fixture.slug,
    displayName: fixture.name,
    headline: fixture.headline,
    roleContext: "contractor",
    servicesDescription: fixture.servicesDescription,
    contentBlocks: [],
    ctaConfig: { primary: { label: "Start a Request" } },
    seoMeta: {},
    businessId,
    updatedAt: "2026-08-08T12:00:00.000Z",
    profileSections: null,
    profileBooking: fixture.profileBooking,
    ownerFirstName: null,
    ownerLastName: null,
    ownerProfileImageUrl: null,
    ownerCity: null,
    ownerState: null,
    ownerRoles: ["contractor"],
  });
  mocks.businesses.set(businessId, {
    id: businessId,
    name: fixture.name,
    categories: fixture.categories,
    serviceAreas: fixture.serviceAreas,
    tradePartner: fixture.tradePartner,
    website: null,
    address: null,
    city: "Austin",
    stateCode: "TX",
    zipCode: null,
    brandColors: null,
  });
}

function extractCanonical(html: string): string | null {
  return (
    html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)?.[1] || null
  );
}

function extractH1(html: string): string | null {
  return (
    html
      .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim() || null
  );
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const source = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
  if (!source) return null;
  const parsed = JSON.parse(source) as Record<string, unknown>;
  const graph = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [];
  return (graph.find(
    (node) =>
      node && typeof node === "object" && ("name" in node || "url" in node || "@type" in node)
  ) || parsed) as Record<string, unknown>;
}

function extractPublicFacts(html: string) {
  const jsonLd = extractJsonLd(html);
  return {
    canonical: extractCanonical(html),
    h1: extractH1(html),
    jsonLdType: jsonLd?.["@type"] || null,
    jsonLdName: jsonLd?.name || null,
    jsonLdUrl: jsonLd?.url || null,
    hasFactBearingSummary: /data-seo-profile="true"/.test(html),
  };
}

describe("platform-wide public discovery equivalence", () => {
  beforeEach(() => {
    mocks.profiles.clear();
    mocks.businesses.clear();
  });

  it("keeps three structurally different public business profiles fact-bearing for every UA class", async () => {
    for (const fixture of BUSINESS_FIXTURES) {
      registerFixture(fixture);
      const rawHtml = await buildPublicProfileHtml({
        slug: fixture.slug,
        origin: "https://www.thetradescout.com",
        templateHtml,
      });

      expect(rawHtml).toBeTruthy();
      expect(isFactBearingPublicDiscoveryHtml(rawHtml || "")).toBe(true);

      const prepared = USER_AGENTS.map((userAgent) =>
        preparePublicSeoHtmlForUserAgent(rawHtml || "", userAgent)
      );
      const factSets = prepared.map(extractPublicFacts);

      expect(factSets).toEqual([factSets[0], factSets[0], factSets[0], factSets[0]]);
      expect(factSets[0]).toMatchObject({
        canonical: `https://www.thetradescout.com/u/${fixture.slug}`,
        h1: fixture.name,
        jsonLdName: fixture.name,
        jsonLdUrl: `https://www.thetradescout.com/u/${fixture.slug}`,
        hasFactBearingSummary: true,
      });
      expect(prepared[0]).toMatch(/type=["']module["']/i);
      expect(prepared[1]).not.toMatch(/type=["']module["'][^>]*src=/i);
    }
  });

  it("keeps an eligible business-directory summary while keeping stale entries non-fact-bearing", () => {
    const eligible = `<div id="root"><main data-seo-business="true"><h1>River City Masonry</h1><p>Stonework and patios.</p></main></div>`;
    const stale = `<div id="root"><main data-seo-business="stale"><h1>Private onboarding</h1></main></div>`;

    expect(isFactBearingPublicDiscoveryHtml(eligible)).toBe(true);
    expect(isFactBearingPublicDiscoveryHtml(stale)).toBe(false);
    expect(preparePublicSeoHtmlForUserAgent(eligible, USER_AGENTS[0])).toContain(
      "River City Masonry"
    );
    expect(preparePublicSeoHtmlForUserAgent(stale, USER_AGENTS[0])).toBe('<div id="root"></div>');
  });

  it("submits concrete runtime profile streams so eligible public businesses are discoverable", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/generate-sitemap-core.mjs"),
      "utf8"
    );

    expect(source).toContain("'/sitemap-u-profiles.xml'");
    expect(source).toContain("'/sitemap-business-profiles.xml'");
    expect(source).toContain("'/sitemap-directory-businesses.xml'");
    expect(source).not.toContain("'/sitemap-profiles.xml'");
  });
});
