import express, { type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "../../client/src/data/jwStoneProfilePresentation";

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
import { buildPublicJwStoneMarketplaceHtml } from "../publicJwStoneMarketplaceHtml";
import {
  buildPublicProfileCanonicalRedirectTarget,
  resolvePublicProfileCategoryRequest,
  resolvePublicProfileItemRequest,
  type PublicProfileCategoryRequestResolution,
  type PublicProfileItemRequestResolution,
} from "../publicProfileItemRouting";

const PLATFORM_ORIGIN = "https://www.thetradescout.com";
const OWNER_HOST = "jwstonelogistics.com";
const OWNER_ORIGIN = `https://${OWNER_HOST}`;

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

const genericContentBlocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Widgets",
          categorySlug: "widgets",
          stones: [
            {
              name: "Blue Widget",
              slug: "blue-widget",
              images: ["/uploads/blue-widget-1.webp", "/uploads/blue-widget-2.webp"],
            },
          ],
        },
      ],
    },
  },
];

const ownerProfile = {
  id: "profile-jw",
  ownerUserId: "owner-jw",
  slug: "jw-stone",
  displayName: "JW Stone Logistics",
  headline: "Natural stone inventory",
  roleContext: "wholesaler",
  servicesDescription: "Browse current stone inventory.",
  businessId: "business-jw",
  updatedAt: "2026-07-28T12:00:00.000Z",
  seoMeta: {
    title: "JW Stone Logistics",
    description: "Natural stone inventory.",
    customDomain: OWNER_HOST,
  },
  ctaConfig: {},
  profileBooking: null,
  contentBlocks: [JW_STONE_PUBLIC_DISCOVERY_BLOCK],
};

const genericProfile = {
  id: "profile-generic",
  ownerUserId: "owner-generic",
  slug: "example-supplier",
  displayName: "Example Supplier",
  headline: "Current product inventory",
  roleContext: "supplier",
  servicesDescription: "Browse current products.",
  businessId: "business-generic",
  updatedAt: "2026-07-28T12:00:00.000Z",
  seoMeta: {
    title: "Example Supplier",
    description: "Current product inventory.",
  },
  ctaConfig: {},
  profileBooking: null,
  contentBlocks: genericContentBlocks,
};

function profileBasePath(slug: string): string {
  return `/u/${encodeURIComponent(slug)}`;
}

function destinationSuffix(canonicalPath: string, basePath: string): string {
  return canonicalPath.startsWith(`${basePath}/`)
    ? canonicalPath.slice(basePath.length)
    : canonicalPath;
}

function redirectTarget(args: {
  origin: string;
  canonicalPath: string;
  referral: unknown;
  request?: unknown;
}): string {
  const destination = buildPublicProfileCanonicalRedirectTarget(args);
  if (!destination) throw new Error("Expected a valid canonical profile redirect");
  return destination;
}

async function renderResolvedProfile(args: {
  res: Response;
  profile: any;
  origin: string;
  itemRequest: PublicProfileItemRequestResolution;
  categoryRequest: PublicProfileCategoryRequestResolution;
}) {
  const { itemRequest, categoryRequest } = args;

  // JW Stone custom domain serves marketplace HTML (replace-profile cutover).
  if (String(args.profile.slug || "").toLowerCase() === "jw-stone") {
    const html = buildPublicJwStoneMarketplaceHtml({
      templateHtml,
      origin: args.origin,
      collectionUrl: `${args.origin}/`,
      marketplaceDomainSurface: true,
      stoneSlug:
        itemRequest.kind === "item" && itemRequest.itemType === "inventory"
          ? itemRequest.itemSlug
          : undefined,
      photo:
        itemRequest.kind === "item" && itemRequest.itemType === "inventory"
          ? String(itemRequest.imageIndex + 1)
          : undefined,
      materialSlug: categoryRequest.kind === "category" ? categoryRequest.categorySlug : undefined,
    });
    return args.res.status(200).type("html").send(html);
  }

  const html = await buildPublicProfileHtml({
    slug: args.profile.slug,
    origin: args.origin,
    templateHtml,
    itemSlug:
      itemRequest.kind === "item" && itemRequest.itemType === "inventory"
        ? itemRequest.itemSlug
        : undefined,
    itemPhoto:
      itemRequest.kind === "item" && itemRequest.itemType === "inventory"
        ? String(itemRequest.imageIndex + 1)
        : undefined,
    gallerySlug:
      itemRequest.kind === "item" && itemRequest.itemType === "gallery"
        ? itemRequest.itemSlug
        : undefined,
    categorySlug: categoryRequest.kind === "category" ? categoryRequest.categorySlug : undefined,
  });
  if (!html) return args.res.status(404).send("Profile destination not found");
  return args.res.status(200).type("html").send(html);
}

function runtimeApp() {
  const app = express();

  // The production entrypoint cannot be imported without booting the full
  // service. This runtime harness composes its production resolvers, redirect
  // target builder, and SSR HTML builder behind the same observable HTTP paths.
  app.use(async (req, res, next) => {
    if (req.hostname.toLowerCase() !== OWNER_HOST) return next();

    const profile = mocks.profiles.get("jw-stone");
    const itemRequest = resolvePublicProfileItemRequest({
      profile,
      pathname: req.path,
      profileBasePath: "/",
      stone: req.query.stone,
      gallery: req.query.gallery,
      photo: req.query.photo,
    });
    const categoryRequest = resolvePublicProfileCategoryRequest({
      profile,
      pathname: req.path,
      profileBasePath: "/",
      category: req.query.category,
    });

    if (
      itemRequest.kind === "invalid-item-route" ||
      categoryRequest.kind === "invalid-category-route"
    ) {
      return res.status(404).send("Profile destination not found");
    }
    if (itemRequest.kind === "item" && itemRequest.source === "legacy-query") {
      return res.redirect(
        301,
        redirectTarget({
          origin: OWNER_ORIGIN,
          canonicalPath: itemRequest.canonicalPath,
          referral: req.query.ref,
          request: req.query.request,
        })
      );
    }
    if (categoryRequest.kind === "category" && categoryRequest.source === "legacy-query") {
      return res.redirect(
        301,
        redirectTarget({
          origin: OWNER_ORIGIN,
          canonicalPath: categoryRequest.canonicalPath,
          referral: req.query.ref,
          request: req.query.request,
        })
      );
    }

    return renderResolvedProfile({
      res,
      profile,
      origin: OWNER_ORIGIN,
      itemRequest,
      categoryRequest,
    });
  });

  app.get("/u/:slug/:collection/:itemSlug", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    const profile = mocks.profiles.get(slug);
    if (!profile) return res.status(404).send("Profile not found");

    const basePath = profileBasePath(slug);
    const itemRequest = resolvePublicProfileItemRequest({
      profile,
      pathname: req.path,
      profileBasePath: basePath,
      photo: req.query.photo,
    });
    const categoryRequest = resolvePublicProfileCategoryRequest({
      profile,
      pathname: req.path,
      profileBasePath: basePath,
    });
    if (itemRequest.kind !== "item" && categoryRequest.kind !== "category") {
      return res.status(404).send("Profile destination not found");
    }

    const resolvedPath =
      itemRequest.kind === "item"
        ? itemRequest.canonicalPath
        : categoryRequest.kind === "category"
          ? categoryRequest.canonicalPath
          : "";
    const customDomain = String(profile.seoMeta?.customDomain || "")
      .trim()
      .toLowerCase();
    if (customDomain) {
      return res.redirect(
        301,
        redirectTarget({
          origin: `https://${customDomain}`,
          canonicalPath: destinationSuffix(resolvedPath, basePath),
          referral: req.query.ref,
          request: req.query.request,
        })
      );
    }

    return renderResolvedProfile({
      res,
      profile,
      origin: PLATFORM_ORIGIN,
      itemRequest,
      categoryRequest,
    });
  });

  app.get("/u/:slug", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "");
    const profile = mocks.profiles.get(slug);
    if (!profile) return res.status(404).send("Profile not found");

    const basePath = profileBasePath(slug);
    const itemRequest = resolvePublicProfileItemRequest({
      profile,
      pathname: basePath,
      profileBasePath: basePath,
      stone: req.query.stone,
      gallery: req.query.gallery,
      photo: req.query.photo,
    });
    const categoryRequest = resolvePublicProfileCategoryRequest({
      profile,
      pathname: basePath,
      profileBasePath: basePath,
      category: req.query.category,
    });
    if (
      itemRequest.kind === "invalid-item-route" ||
      categoryRequest.kind === "invalid-category-route"
    ) {
      return res.status(404).send("Profile destination not found");
    }

    if (itemRequest.kind === "item" || categoryRequest.kind === "category") {
      const canonicalPath =
        itemRequest.kind === "item"
          ? itemRequest.canonicalPath
          : categoryRequest.kind === "category"
            ? categoryRequest.canonicalPath
            : "";
      const customDomain = String(profile.seoMeta?.customDomain || "")
        .trim()
        .toLowerCase();
      return res.redirect(
        301,
        redirectTarget({
          origin: customDomain ? `https://${customDomain}` : PLATFORM_ORIGIN,
          canonicalPath: customDomain ? destinationSuffix(canonicalPath, basePath) : canonicalPath,
          referral: req.query.ref,
          request: req.query.request,
        })
      );
    }

    return renderResolvedProfile({
      res,
      profile,
      origin: PLATFORM_ORIGIN,
      itemRequest,
      categoryRequest,
    });
  });

  return app;
}

describe("public profile domain routing runtime", () => {
  beforeEach(() => {
    mocks.profiles.clear();
    mocks.businesses.clear();
    mocks.profiles.set(ownerProfile.slug, ownerProfile);
    mocks.profiles.set(genericProfile.slug, genericProfile);
    mocks.businesses.set("business-jw", {
      id: "business-jw",
      name: "JW Stone Logistics",
      categories: ["Natural stone supplier"],
      serviceAreas: ["Gulf Coast"],
      tradePartner: true,
    });
    mocks.businesses.set("business-generic", {
      id: "business-generic",
      name: "Example Supplier",
      categories: ["Product supplier"],
      serviceAreas: ["Sample County"],
      tradePartner: true,
    });
  });

  it("serves exact owner-domain item and category pages with owner-domain canonicals", async () => {
    const app = runtimeApp();
    const itemResponse = await request(app).get("/stones/blue-dunes").set("Host", OWNER_HOST);
    const categoryResponse = await request(app).get("/materials/granite").set("Host", OWNER_HOST);

    expect(itemResponse.status).toBe(200);
    expect(itemResponse.text).toContain(
      'rel="canonical" href="https://jwstonelogistics.com/stones/blue-dunes"'
    );
    expect(itemResponse.text).toContain('data-seo-jw-stone-marketplace="true"');
    expect(itemResponse.text).toContain('data-seo-jw-stone-item="blue-dunes"');
    expect(itemResponse.text).toContain("__TS_JW_STONE_MARKETPLACE_SURFACE__");
    expect(categoryResponse.status).toBe(200);
    expect(categoryResponse.text).toContain(
      'rel="canonical" href="https://jwstonelogistics.com/materials/granite"'
    );
    expect(categoryResponse.text).toContain('data-seo-jw-stone-category="granite"');
  });

  it("redirects scoped TradeScout item and category paths to their owner domain", async () => {
    const app = runtimeApp();
    const itemResponse = await request(app)
      .get("/u/jw-stone/stones/blue-dunes?photo=2&ref=partner-7&request=stone")
      .set("Host", "www.thetradescout.com");
    const categoryResponse = await request(app)
      .get("/u/jw-stone/materials/granite?ref=partner-7&request=collection")
      .set("Host", "www.thetradescout.com");

    expect(itemResponse.status).toBe(301);
    expect(itemResponse.headers.location).toBe(
      "https://jwstonelogistics.com/stones/blue-dunes?photo=2&ref=partner-7&request=stone"
    );
    expect(categoryResponse.status).toBe(301);
    expect(categoryResponse.headers.location).toBe(
      "https://jwstonelogistics.com/materials/granite?ref=partner-7&request=collection"
    );
  });

  it("canonicalizes legacy selectors without losing item, photo, ref, or request intent", async () => {
    const app = runtimeApp();
    const ownerResponse = await request(app)
      .get("/?stone=blue-dunes&photo=2&ref=partner-7&request=stone")
      .set("Host", OWNER_HOST);
    const platformResponse = await request(app)
      .get("/u/jw-stone?stone=blue-dunes&photo=2&ref=partner-7&request=stone")
      .set("Host", "www.thetradescout.com");

    const canonical =
      "https://jwstonelogistics.com/stones/blue-dunes?photo=2&ref=partner-7&request=stone";
    expect(ownerResponse.status).toBe(301);
    expect(ownerResponse.headers.location).toBe(canonical);
    expect(platformResponse.status).toBe(301);
    expect(platformResponse.headers.location).toBe(canonical);
  });

  it("drops unknown request intent instead of reflecting arbitrary query values", () => {
    expect(
      buildPublicProfileCanonicalRedirectTarget({
        origin: OWNER_ORIGIN,
        canonicalPath: "/stones/blue-dunes",
        request: "unexpected-mode",
      })
    ).toBe("https://jwstonelogistics.com/stones/blue-dunes");
  });

  it("serves generic TradeScout-only item and category pages without owner redirects", async () => {
    const app = runtimeApp();
    const itemResponse = await request(app)
      .get("/u/example-supplier/inventory/blue-widget?photo=2")
      .set("Host", "www.thetradescout.com");
    const categoryResponse = await request(app)
      .get("/u/example-supplier/categories/widgets")
      .set("Host", "www.thetradescout.com");

    expect(itemResponse.status).toBe(200);
    expect(itemResponse.headers.location).toBeUndefined();
    expect(itemResponse.text).toContain(
      'rel="canonical" href="https://www.thetradescout.com/u/example-supplier/inventory/blue-widget?photo=2"'
    );
    expect(itemResponse.text).toContain('data-seo-profile-item="inventory"');
    expect(categoryResponse.status).toBe(200);
    expect(categoryResponse.headers.location).toBeUndefined();
    expect(categoryResponse.text).toContain(
      'rel="canonical" href="https://www.thetradescout.com/u/example-supplier/categories/widgets"'
    );
    expect(categoryResponse.text).toContain('data-seo-profile-category="widgets"');
  });
});
