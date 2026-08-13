import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STEEL_HOME_BUILDER_PAGE_METADATA,
  STEEL_HOME_BUILDER_ROUTE_SLUGS,
} from "../../shared/steelHomeBuilderRoutes";

const mocks = vi.hoisted(() => ({
  profiles: new Map<string, any>(),
}));

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async (slug: string) => mocks.profiles.get(slug) || null),
    getBusinessPublicById: vi.fn(async () => null),
  },
}));

import { buildPublicProfileHtml } from "../publicProfileHtml";
import {
  buildSteelHomeBuilderProfilePageMetadata,
  serveSteelHomeBuilderProfileRoute,
} from "../steelHomeBuilderProfileRoute";
import { sendPublicPageNotFound } from "../utils/publicPageResponse";

const PLATFORM_ORIGIN = "https://www.thetradescout.com";

const builderMetadataCases = [
  {
    slug: "countertops",
    ...STEEL_HOME_BUILDER_PAGE_METADATA.countertops,
  },
  {
    slug: "cabinets",
    ...STEEL_HOME_BUILDER_PAGE_METADATA.cabinets,
  },
  {
    slug: "metal-buildings",
    ...STEEL_HOME_BUILDER_PAGE_METADATA.building,
  },
] as const;

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="${PLATFORM_ORIGIN}" />
    <meta property="og:image" content="${PLATFORM_ORIGIN}/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="${PLATFORM_ORIGIN}/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="${PLATFORM_ORIGIN}/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="${PLATFORM_ORIGIN}" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const steelHomeProfile = {
  id: "profile-steel-home-packages",
  ownerUserId: "operator",
  slug: "steel-home-packages",
  displayName: "Steel Home Planning Tools",
  headline: "Plan a steel home project",
  roleContext: "planning tools",
  servicesDescription: "Plan countertops, cabinets, and metal buildings.",
  businessId: null,
  seoMeta: {
    title: "Steel Home Planning Tools",
    description: "Plan countertops, cabinets, and metal buildings.",
  },
  ctaConfig: {},
  profileBooking: null,
  contentBlocks: [],
};

function runtimeApp() {
  const app = express();

  app.get(
    ["/u/:slug/:collection/:itemSlug", "/p/:slug/:collection/:itemSlug"],
    async (req, res) => {
      const slug = String(req.params.slug || "");
      if (!mocks.profiles.has(slug)) {
        return sendPublicPageNotFound(res, "Profile not found");
      }

      const handled = await serveSteelHomeBuilderProfileRoute({
        req,
        res,
        slug,
        collection: req.params.collection,
        itemSlug: req.params.itemSlug,
        origin: PLATFORM_ORIGIN,
        templateHtml,
        renderProfileHtml: buildPublicProfileHtml,
      });
      if (handled) return;

      return sendPublicPageNotFound(res, "Profile destination not found");
    }
  );

  return app;
}

describe("Steel Home shareable builder profile routes", () => {
  beforeEach(() => {
    mocks.profiles.clear();
    mocks.profiles.set(steelHomeProfile.slug, steelHomeProfile);
  });

  it("serves distinct builder canonical, title, and social metadata in unlisted server HTML", async () => {
    const bodies: string[] = [];

    for (const { slug: builderSlug, title, description } of builderMetadataCases) {
      const canonical = `${PLATFORM_ORIGIN}/u/steel-home-packages/builders/${builderSlug}`;
      const response = await request(runtimeApp())
        .get(`/u/steel-home-packages/builders/${builderSlug}`)
        .expect(200)
        .expect("Content-Type", /html/);

      expect(response.headers["cache-control"]).toBe(
        "public, max-age=300, stale-while-revalidate=86400"
      );
      expect(response.text).toContain('<meta name="robots" content="noindex, nofollow" />');
      expect(response.text).toContain(`<title>${title}</title>`);
      expect(response.text).toContain(`<meta name="description" content="${description}" />`);
      expect(response.text).toContain(`<link rel="canonical" href="${canonical}" />`);
      expect(response.text).toContain('<meta property="og:type" content="website" />');
      expect(response.text).toContain(`<meta property="og:title" content="${title}" />`);
      expect(response.text).toContain(
        `<meta property="og:description" content="${description}" />`
      );
      expect(response.text).toContain(`<meta property="og:url" content="${canonical}" />`);
      expect(response.text).toContain(`<meta name="twitter:title" content="${title}" />`);
      expect(response.text).toContain(
        `<meta name="twitter:description" content="${description}" />`
      );
      expect(response.text).toContain(
        `<meta property="og:image:alt" content="${title} preview" />`
      );
      expect(response.text).toContain(
        `<meta name="twitter:image:alt" content="${title} preview" />`
      );
      expect(response.text).not.toContain(
        `<link rel="canonical" href="${PLATFORM_ORIGIN}/u/steel-home-packages" />`
      );
      expect(response.text).not.toContain(
        '<meta property="og:title" content="Steel Home Planning Tools" />'
      );
      expect(response.text).not.toContain(
        '<meta name="description" content="Plan countertops, cabinets, and metal buildings." />'
      );
      expect(response.text).not.toContain('type="application/ld+json"');
      bodies.push(response.text);
    }

    expect(new Set(bodies).size).toBe(3);
  });

  it("leaves the base Steel Home directory metadata unchanged", async () => {
    const html = await buildPublicProfileHtml({
      slug: steelHomeProfile.slug,
      origin: PLATFORM_ORIGIN,
      templateHtml,
    });

    expect(html).not.toBeNull();
    expect(html).toContain("<title>Steel Home Planning Tools | TradeScout</title>");
    expect(html).toContain(
      `<link rel="canonical" href="${PLATFORM_ORIGIN}/u/steel-home-packages" />`
    );
    expect(html).toContain('<meta property="og:type" content="profile" />');
    expect(html).toContain('<meta property="og:title" content="Steel Home Planning Tools" />');
    expect(html).toContain(
      `<meta property="og:url" content="${PLATFORM_ORIGIN}/u/steel-home-packages" />`
    );
    expect(html).toContain('<meta name="twitter:title" content="Steel Home Planning Tools" />');
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    for (const { title } of builderMetadataCases) {
      expect(html).not.toContain(title);
    }
  });

  it("uses a builder canonical for a published WebPage while retaining the base owner identity", async () => {
    const fixtureSlug = "published-builder-metadata-fixture";
    mocks.profiles.set(fixtureSlug, {
      ...steelHomeProfile,
      id: "profile-published-builder-metadata-fixture",
      slug: fixtureSlug,
      displayName: "Published builder metadata fixture",
      seoMeta: {
        ...steelHomeProfile.seoMeta,
        title: "Published builder metadata fixture",
      },
    });
    const pageMetadata = buildSteelHomeBuilderProfilePageMetadata("countertops", PLATFORM_ORIGIN);
    const html = await buildPublicProfileHtml({
      slug: fixtureSlug,
      origin: PLATFORM_ORIGIN,
      templateHtml,
      pageMetadata,
    });
    const encodedJsonLd = html?.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )?.[1];
    expect(encodedJsonLd).toBeTruthy();
    const jsonLd = JSON.parse(encodedJsonLd || "{}") as {
      "@graph"?: Array<Record<string, any>>;
    };
    const graph = jsonLd["@graph"] || [];
    const ownerUrl = `${PLATFORM_ORIGIN}/u/${fixtureSlug}`;
    const webpage = graph.find((node) => node["@type"] === "WebPage");
    const owner = graph.find((node) => node["@id"] === `${ownerUrl}#identity`);

    expect(webpage).toMatchObject({
      "@id": `${pageMetadata.canonical}#webpage`,
      url: pageMetadata.canonical,
      mainEntity: { "@id": `${ownerUrl}#identity` },
      about: { "@id": `${ownerUrl}#identity` },
    });
    expect(owner).toMatchObject({
      "@id": `${ownerUrl}#identity`,
      url: ownerUrl,
    });
    expect(webpage?.url).not.toBe(ownerUrl);
  });

  it.each(builderMetadataCases)(
    "redirects the /p alias for $slug to its exact /u builder metadata",
    async ({ slug: builderSlug, title, description }) => {
      const response = await request(runtimeApp())
        .get(`/p/steel-home-packages/builders/${builderSlug}?ref=shared-builder`)
        .expect(301);

      const location = `${PLATFORM_ORIGIN}/u/steel-home-packages/builders/${builderSlug}?ref=shared-builder`;
      expect(response.headers.location).toBe(location);

      const canonicalResponse = await request(runtimeApp())
        .get(new URL(location).pathname)
        .expect(200);
      expect(canonicalResponse.text).toContain(`<title>${title}</title>`);
      expect(canonicalResponse.text).toContain(
        `<link rel="canonical" href="${PLATFORM_ORIGIN}/u/steel-home-packages/builders/${builderSlug}" />`
      );
      expect(canonicalResponse.text).toContain(`<meta property="og:title" content="${title}" />`);
      expect(canonicalResponse.text).toContain(
        `<meta property="og:description" content="${description}" />`
      );
      expect(canonicalResponse.text).toContain(`<meta name="twitter:title" content="${title}" />`);
      expect(canonicalResponse.text).toContain(
        `<meta name="twitter:description" content="${description}" />`
      );
      expect(canonicalResponse.text).toContain(
        '<meta name="robots" content="noindex, nofollow" />'
      );
    }
  );

  it.each([
    "/u/steel-home-packages/builders/unknown-builder",
    "/p/steel-home-packages/builders/unknown-builder",
  ])("returns a non-indexable 404 for an unknown builder at %s", async (pathname) => {
    const response = await request(runtimeApp()).get(pathname).expect(404);

    expect(response.text).toBe("Profile destination not found");
    expect(response.headers["cache-control"]).toBe("private, no-store, max-age=0");
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(response.headers.location).toBeUndefined();
  });

  it("does not claim a builder-looking path owned by another profile", async () => {
    mocks.profiles.set("another-profile", {
      ...steelHomeProfile,
      id: "profile-other",
      slug: "another-profile",
    });

    const response = await request(runtimeApp())
      .get("/u/another-profile/builders/countertops")
      .expect(404);

    expect(response.text).toBe("Profile destination not found");
  });
});
