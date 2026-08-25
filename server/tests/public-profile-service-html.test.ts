import { describe, expect, it } from "vitest";
import { listFactBearingProfileServices } from "@shared/profileServiceShare";
import { buildPublicProfileServiceHtml } from "../publicProfileServiceHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-test.js"></script>
  </body>
</html>`;

const contentBlocks = [
  {
    type: "localServiceProfile",
    data: {
      heroImage: "/images/plumbing/hero.jpg",
      services: [
        {
          title: "Drain clearing and diagnostics",
          description:
            "Locate the cause of blocked or slow drains, explain the findings, and identify the least disruptive repair path for the property.",
        },
        {
          title: "Water heater installation",
          description:
            "Plan tank or tankless water-heating equipment around demand, utilities, available space, and the existing replacement conditions.",
        },
      ],
    },
  },
] as const;

function profile(customDomain = "") {
  return {
    slug: "local-plumbing",
    displayName: "Local Plumbing",
    headline: "Residential and commercial plumbing.",
    contentBlocks,
    seoMeta: {
      imageUrl: "/images/plumbing/profile.jpg",
      faviconUrl: "/images/plumbing/favicon.png",
      customDomain,
    },
  };
}

const business = {
  name: "Local Plumbing",
  categories: ["Plumber"],
  serviceAreas: ["Hammond", "Ponchatoula"],
  city: "Hammond",
  stateCode: "LA",
  brandColors: { primary: "#0878a6" },
};

describe("public profile service HTML", () => {
  it("renders a standalone, indexable service page with Service schema", () => {
    const service = listFactBearingProfileServices(contentBlocks)[0];
    const html = buildPublicProfileServiceHtml({
      templateHtml,
      origin: "https://www.thetradescout.com",
      profile: profile(),
      business,
      service,
    });

    expect(html).toContain("Drain clearing and diagnostics");
    expect(html).toContain(
      'href="https://www.thetradescout.com/u/local-plumbing/services/drain-clearing-and-diagnostics"'
    );
    expect(html).toContain(
      'link rel="canonical" href="https://www.thetradescout.com/u/local-plumbing/services/drain-clearing-and-diagnostics"'
    );
    expect(html).toContain('meta name="robots" content="index, follow');
    expect(html).toContain('data-public-profile-service-page="true"');
    expect(html).toContain('data-seo-profile="true"');
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('"provider":{"@id":"https://www.thetradescout.com/u/local-plumbing#identity"}');
    expect(html).toContain('"areaServed":["Hammond","Ponchatoula"]');
    expect(html).not.toContain('type="module"');
  });

  it("hands Start a Request to the exact profile and service without exposing contact data", () => {
    const service = listFactBearingProfileServices(contentBlocks)[0];
    const html = buildPublicProfileServiceHtml({
      templateHtml,
      origin: "https://www.thetradescout.com",
      profile: profile(),
      business,
      service,
    });

    expect(html).toContain("https://www.thetradescout.com/direct-connect?");
    expect(html).toContain("profile=local-plumbing");
    expect(html).toContain("item=Drain+clearing+and+diagnostics");
    expect(html).toContain("subject=service");
    expect(html).toContain("source=profile_service_page");
    expect(html).toContain("intent=fix_improve");
    expect(html).not.toMatch(/\b\d{3}[-.)\s]+\d{3}[-.\s]+\d{4}\b|@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("keeps a custom-domain service page on the verified profile host", () => {
    const service = listFactBearingProfileServices(contentBlocks)[1];
    const html = buildPublicProfileServiceHtml({
      templateHtml,
      origin: "https://localplumbing.example",
      profile: profile("localplumbing.example"),
      business,
      service,
    });

    expect(html).toContain(
      'link rel="canonical" href="https://localplumbing.example/landing/service/water-heater-installation"'
    );
    expect(html).toContain('href="https://localplumbing.example/"');
    expect(html).not.toContain(
      'link rel="canonical" href="https://www.thetradescout.com/u/local-plumbing'
    );
  });

  it("links sibling service pages and the parent profile", () => {
    const service = listFactBearingProfileServices(contentBlocks)[0];
    const html = buildPublicProfileServiceHtml({
      templateHtml,
      origin: "https://www.thetradescout.com",
      profile: profile(),
      business,
      service,
    });

    expect(html).toContain('href="https://www.thetradescout.com/u/local-plumbing"');
    expect(html).toContain(
      'href="https://www.thetradescout.com/u/local-plumbing/services/water-heater-installation"'
    );
  });
});
