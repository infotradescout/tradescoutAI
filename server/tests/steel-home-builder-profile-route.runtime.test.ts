import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEEL_HOME_BUILDER_ROUTE_SLUGS } from "../../shared/steelHomeBuilderRoutes";

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
import { serveSteelHomeBuilderProfileRoute } from "../steelHomeBuilderProfileRoute";
import { sendPublicPageNotFound } from "../utils/publicPageResponse";

const PLATFORM_ORIGIN = "https://www.thetradescout.com";

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

  it("serves the same unlisted profile HTML at each canonical builder path", async () => {
    const bodies: string[] = [];

    for (const builderSlug of Object.values(STEEL_HOME_BUILDER_ROUTE_SLUGS)) {
      const response = await request(runtimeApp())
        .get(`/u/steel-home-packages/builders/${builderSlug}`)
        .expect(200)
        .expect("Content-Type", /html/);

      expect(response.headers["cache-control"]).toBe(
        "public, max-age=300, stale-while-revalidate=86400"
      );
      expect(response.text).toContain('<meta name="robots" content="noindex, follow" />');
      expect(response.text).toContain("Steel Home Planning Tools");
      bodies.push(response.text);
    }

    expect(new Set(bodies).size).toBe(1);
  });

  it.each(Object.values(STEEL_HOME_BUILDER_ROUTE_SLUGS))(
    "redirects the /p alias for %s to its exact /u builder path",
    async (builderSlug) => {
      const response = await request(runtimeApp())
        .get(`/p/steel-home-packages/builders/${builderSlug}?ref=shared-builder`)
        .expect(301);

      expect(response.headers.location).toBe(
        `${PLATFORM_ORIGIN}/u/steel-home-packages/builders/${builderSlug}?ref=shared-builder`
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
