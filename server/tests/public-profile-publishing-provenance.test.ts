import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import {
  TRADESCOUT_PUBLISHER_ID,
  TRADESCOUT_PUBLISHER_URL,
} from "@shared/profilePublishingProvenance";

const profileRecord = {
  id: "profile-owner-stone",
  isDiscoverable: true,
  slug: "owner-stone",
  displayName: "Owner Stone Account",
  headline: "Published stone inventory",
  roleContext: "supplier",
  servicesDescription: "Browse current stone and project imagery.",
  businessId: "business-owner-stone",
  updatedAt: "2026-07-28T12:00:00.000Z",
  seoMeta: {
    customDomain: "ownerstone.example",
  },
  ctaConfig: {},
  profileBooking: null,
  contentBlocks: [
    {
      type: "publicDiscovery",
      data: {
        routes: {
          inventory: "stones",
          gallery: "projects",
          categories: "materials",
        },
      },
    },
    {
      type: "inventoryCatalog",
      data: {
        categories: [
          {
            category: "Granite",
            categorySlug: "granite",
            stones: [
              {
                name: "Blue Ridge",
                slug: "blue-ridge",
                images: ["/uploads/owner-stone/blue-ridge.webp"],
              },
            ],
          },
        ],
      },
    },
    {
      id: "finished-projects",
      type: "gallery",
      data: {
        title: "Finished Projects",
        images: [
          {
            id: "blue-ridge-kitchen",
            url: "/uploads/owner-stone/blue-ridge-kitchen.webp",
            title: "Blue Ridge Kitchen",
          },
        ],
      },
    },
  ],
};

const businessRecord = {
  id: "business-owner-stone",
  name: "Owner Stone Co.",
  categories: ["Stone supplier"],
  serviceAreas: ["Gulf Coast"],
  tradePartner: true,
};

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async () => profileRecord),
    getBusinessPublicById: vi.fn(async () => businessRecord),
  },
}));

import { buildPublicProfileHtml } from "../publicProfileHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const OWNER_ID = "https://ownerstone.example/#identity";

function structuredData(html: string) {
  const raw =
    [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].at(-1)?.[1] || "";
  return JSON.parse(raw);
}

function graphNodes(html: string): Array<Record<string, any>> {
  const data = structuredData(html);
  return Array.isArray(data["@graph"]) ? data["@graph"] : [data];
}

function assertPublishingProvenance(args: {
  html: string;
  pageUrl: string;
  mainEntityId: string;
  mainEntityType: string;
}) {
  const nodes = graphNodes(args.html);
  const owner = nodes.find((node) => node["@id"] === OWNER_ID);
  const mainEntity = nodes.find((node) => node["@id"] === args.mainEntityId);
  const publisher = nodes.find((node) => node["@id"] === TRADESCOUT_PUBLISHER_ID);
  const page = nodes.find((node) => node.url === args.pageUrl && node.publisher);

  expect(owner).toMatchObject({
    "@type": "LocalBusiness",
    "@id": OWNER_ID,
    name: "Owner Stone Co.",
  });
  expect(mainEntity).toMatchObject({
    "@type": args.mainEntityType,
    "@id": args.mainEntityId,
  });
  expect(publisher).toEqual({
    "@type": "Organization",
    "@id": TRADESCOUT_PUBLISHER_ID,
    name: "TradeScout",
    url: TRADESCOUT_PUBLISHER_URL,
  });
  expect(page).toMatchObject({
    url: args.pageUrl,
    mainEntity: { "@id": args.mainEntityId },
    about: { "@id": OWNER_ID },
    publisher: { "@id": TRADESCOUT_PUBLISHER_ID },
    provider: { "@id": TRADESCOUT_PUBLISHER_ID },
  });
  expect(owner?.name).not.toBe("TradeScout");
  expect(mainEntity?.name).not.toBe("TradeScout");

  return mainEntity;
}

describe("public profile publishing provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the business as the root main entity while TradeScout publishes the page", async () => {
    const pageUrl = "https://ownerstone.example/";
    const html = await buildPublicProfileHtml({
      slug: "owner-stone",
      origin: pageUrl,
      templateHtml,
    });

    expect(html).not.toBeNull();
    assertPublishingProvenance({
      html: html!,
      pageUrl,
      mainEntityId: OWNER_ID,
      mainEntityType: "LocalBusiness",
    });
  });

  it("keeps exact inventory, gallery, and category ownership separate from TradeScout", async () => {
    const gallerySlug = listProfileGalleryItems(profileRecord.contentBlocks)[0].slug;
    const surfaces = [
      {
        options: { itemSlug: "blue-ridge" },
        pageUrl: "https://ownerstone.example/stones/blue-ridge",
        mainEntityId: "https://ownerstone.example/stones/blue-ridge#product",
        mainEntityType: "Product",
        ownershipProperty: "brand",
      },
      {
        options: { gallerySlug },
        pageUrl: `https://ownerstone.example/projects/${gallerySlug}`,
        mainEntityId: `https://ownerstone.example/projects/${gallerySlug}#image`,
        mainEntityType: "ImageObject",
        ownershipProperty: "creator",
      },
      {
        options: { categorySlug: "granite" },
        pageUrl: "https://ownerstone.example/materials/granite",
        mainEntityId: "https://ownerstone.example/materials/granite#collection",
        mainEntityType: "CollectionPage",
        ownershipProperty: "isPartOf",
      },
    ] as const;

    for (const surface of surfaces) {
      const html = await buildPublicProfileHtml({
        slug: "owner-stone",
        origin: "https://ownerstone.example",
        templateHtml,
        ...surface.options,
      });

      expect(html).not.toBeNull();
      const mainEntity = assertPublishingProvenance({
        html: html!,
        pageUrl: surface.pageUrl,
        mainEntityId: surface.mainEntityId,
        mainEntityType: surface.mainEntityType,
      });
      expect(mainEntity[surface.ownershipProperty]).toEqual({ "@id": OWNER_ID });
      expect(mainEntity[surface.ownershipProperty]).not.toEqual({
        "@id": TRADESCOUT_PUBLISHER_ID,
      });
    }
  });

  it("wires the same shared provenance helper into SSR and client SEO", () => {
    const serverSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/publicProfileHtml.ts"),
      "utf8"
    );
    const clientSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/ProfileSiteView.tsx"),
      "utf8"
    );

    for (const source of [serverSource, clientSource]) {
      expect(source).toContain(
        'import { withTradeScoutPublishingProvenance } from "@shared/profilePublishingProvenance"'
      );
      expect(source).toContain("withTradeScoutPublishingProvenance({");
      expect(source).toContain("ownerIdentityId:");
      expect(source).toContain("mainEntityId");
    }
  });
});
