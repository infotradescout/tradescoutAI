import { beforeEach, describe, expect, it } from "vitest";
import { upgradePublicSocialPreviewHtml } from "../publicSocialPreviewHtml";
import { resolveSignedSocialPreviewToken } from "../signedSocialPreview";

function htmlFor(args: {
  canonical: string;
  title: string;
  description: string;
  image: string;
  visibleImage?: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <title>${args.title}</title>
    <meta name="description" content="${args.description}" />
    <link rel="canonical" href="${args.canonical}" />
    <meta property="og:title" content="${args.title}" />
    <meta property="og:description" content="${args.description}" />
    <meta property="og:url" content="${args.canonical}" />
    <meta property="og:image" content="${args.image}" />
    <meta name="twitter:image" content="${args.image}" />
  </head>
  <body>
    <div id="root"><main data-seo-test="true">
      ${args.visibleImage ? `<img src="${args.visibleImage}" alt="Source" />` : ""}
    </main></div>
    <script type="application/ld+json">{"image":"${args.visibleImage || args.image}"}</script>
  </body>
</html>`;
}

function signedTokenFromHtml(html: string): string {
  const encodedUrl = html.match(
    /<meta property="og:image" content="([^"]*\/images\/social\/card\/([^"]+)\.png)"/
  )?.[1];
  expect(encodedUrl).toBeTruthy();
  const decodedUrl = String(encodedUrl).replace(/&amp;/g, "&");
  return new URL(decodedUrl).pathname
    .replace(/^\/images\/social\/card\//, "")
    .replace(/\.png$/, "");
}

describe("public HTML social-preview upgrade", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "public-social-preview-test-secret";
  });

  it.each([
    {
      canonical: "https://www.thetradescout.com/community/posts/post-1",
      title: "Need a local roofer | TradeScout Community",
      expectedKind: "community_post",
      expectedBrand: "TradeScout Community",
      expectedCta: "View post · Join the conversation",
    },
    {
      canonical: "https://www.thetradescout.com/community",
      title: "TradeScout Community",
      expectedKind: "directory",
      expectedBrand: "TradeScout Community",
      expectedCta: "Explore the community",
    },
    {
      canonical: "https://www.thetradescout.com/group/group-1",
      title: "Escambia Makers | TradeScout Groups",
      expectedKind: "group",
      expectedBrand: "TradeScout Groups",
      expectedCta: "View group · Join the conversation",
    },
    {
      canonical: "https://www.thetradescout.com/group/group-1?post=post-1",
      title: "Workbench restoration | Escambia Makers | TradeScout Groups",
      expectedKind: "community_post",
      expectedBrand: "TradeScout Groups",
      expectedCta: "View post · Join the conversation",
    },
    {
      canonical: "https://www.thetradescout.com/groups",
      title: "Local groups | TradeScout",
      expectedKind: "directory",
      expectedBrand: "TradeScout Groups",
      expectedCta: "Explore local groups",
    },
    {
      canonical: "https://www.thetradescout.com/exchange/tools/listing-1",
      title: "Table saw — $250 | TradeScout Exchange",
      expectedKind: "listing",
      expectedBrand: "TradeScout Exchange",
      expectedCta: "View listing · Connect safely",
    },
    {
      canonical: "https://www.thetradescout.com/exchange",
      title: "Buy, sell, and discover locally | TradeScout Exchange",
      expectedKind: "directory",
      expectedBrand: "TradeScout Exchange",
      expectedCta: "Explore the local exchange",
    },
    {
      canonical: "https://www.thetradescout.com/exchange?item=listing-1",
      title: "Table saw — $250 | TradeScout Exchange | TradeScout",
      expectedKind: "listing",
      expectedBrand: "TradeScout Exchange",
      expectedCta: "View listing · Connect safely",
    },
    {
      canonical:
        "https://www.thetradescout.com/exchange?tab=promotions&promo=summer-roof-special",
      title: "Exchange Promotion | TradeScout",
      expectedKind: "offer",
      expectedBrand: "TradeScout Exchange",
      expectedCta: "View promotion · Connect safely",
    },
    {
      canonical:
        "https://www.thetradescout.com/exchange?tab=sales&companyPromo=warehouse-clearance",
      title: "Exchange Sale | TradeScout",
      expectedKind: "offer",
      expectedBrand: "TradeScout Exchange",
      expectedCta: "View sale · Connect safely",
    },
    {
      canonical: "https://www.thetradescout.com/handmade/products/product-1",
      title: "Oak serving board | Handmade | TradeScout",
      expectedKind: "product",
      expectedBrand: "TradeScout Handmade",
      expectedCta: "View product · Contact maker",
    },
    {
      canonical: "https://www.thetradescout.com/handmade",
      title: "Local handmade goods | TradeScout",
      expectedKind: "directory",
      expectedBrand: "TradeScout Handmade",
      expectedCta: "Explore local handmade",
    },
    {
      canonical: "https://www.thetradescout.com/handmade-marketplace",
      title: "Handmade Marketplace | Local Artisan Products",
      expectedKind: "directory",
      expectedBrand: "TradeScout Handmade",
      expectedCta: "Explore local handmade",
    },
    {
      canonical: "https://www.thetradescout.com/homescout/listings/home-1",
      title: "3-bedroom home in Pensacola | HomeScout | TradeScout",
      expectedKind: "property",
      expectedBrand: "HomeScout",
      expectedCta: "View property · Request details",
    },
    {
      canonical: "https://www.thetradescout.com/homescout",
      title: "HomeScout | TradeScout",
      expectedKind: "directory",
      expectedBrand: "HomeScout",
      expectedCta: "Explore local properties",
    },
    {
      canonical: "https://www.thetradescout.com/homescout/FL/12033",
      title: "Homes for sale in Escambia County, FL | TradeScout",
      expectedKind: "directory",
      expectedBrand: "HomeScout",
      expectedCta: "Browse county listings",
    },
    {
      canonical: "https://www.thetradescout.com/services",
      title: "Local services | TradeScout",
      expectedKind: "directory",
      expectedBrand: "TradeScout Services",
      expectedCta: "Explore local services",
    },
    {
      canonical: "https://www.thetradescout.com/r/public-share-token",
      title: "Kitchen remodel request | TradeScout",
      expectedKind: "offer",
      expectedBrand: "TradeScout Direct Connect",
      expectedCta: "Review request · Respond privately",
    },
    {
      canonical: "https://www.thetradescout.com/helpers/helper-1?portfolio=kitchen-remodel",
      title: "Kitchen remodel | Jordan Helper | TradeScout",
      expectedKind: "portfolio",
      expectedBrand: "TradeScout",
      expectedCta: "View work · Request help",
    },
    {
      canonical: "https://www.thetradescout.com/best/roofers/escambia-county-fl",
      title: "Best roofers in Escambia County | TradeScout",
      expectedKind: "directory",
      expectedBrand: "TradeScout Local",
      expectedCta: "Explore local results",
    },
    {
      canonical: "https://www.thetradescout.com/city/FL/pensacola",
      title: "Pensacola local services | TradeScout",
      expectedKind: "directory",
      expectedBrand: "TradeScout Local",
      expectedCta: "Explore local results",
    },
    {
      canonical: "https://www.thetradescout.com/trade",
      title: "Local trade directory | TradeScout",
      expectedKind: "directory",
      expectedBrand: "TradeScout Local",
      expectedCta: "Explore local results",
    },
  ])(
    "builds a signed $expectedKind card from existing public metadata",
    ({ canonical, title, expectedKind, expectedBrand, expectedCta }) => {
      const sourceImage = "https://www.thetradescout.com/uploads/public/source-image.webp";
      const input = htmlFor({
        canonical,
        title,
        description: "Public context that helps someone understand what this shared link contains.",
        image: sourceImage,
        visibleImage: sourceImage,
      });

      const upgraded = upgradePublicSocialPreviewHtml(input);
      const token = signedTokenFromHtml(upgraded);
      const resolved = resolveSignedSocialPreviewToken(token);

      expect(resolved?.context).toMatchObject({
        kind: expectedKind,
        brandName: expectedBrand,
        ctaLabel: expectedCta,
        sourceImageUrl: sourceImage,
      });
      expect(upgraded).toContain('property="og:image:type" content="image/png"');
      expect(upgraded).toContain('property="og:image:width" content="1200"');
      expect(upgraded).toContain('property="og:image:height" content="630"');
      expect(upgraded).toContain('name="twitter:card" content="summary_large_image"');
      expect(upgraded).toContain(
        '<meta name="twitter:image" content="https://www.thetradescout.com/images/social/card/'
      );
      expect(upgraded).toContain(`<img src="${sourceImage}"`);
      expect(upgraded).toContain(`{"image":"${sourceImage}"}`);
      expect(upgraded).not.toContain(`property="og:image" content="${sourceImage}"`);
    }
  );

  it.each([
    {
      canonical: "https://www.thetradescout.com/exchange?item=listing-1",
      title: "Table saw — $250 | TradeScout Exchange | TradeScout",
      description: "A table saw listed for sale on TradeScout Exchange.",
      expectedKind: "listing",
      expectedCta: "View listing · Connect safely",
    },
    {
      canonical:
        "https://www.thetradescout.com/exchange?tab=promotions&promo=summer-roof-special",
      title: "Exchange Promotion | TradeScout",
      description: "Check out this exclusive promotion on TradeScout Exchange.",
      expectedKind: "offer",
      expectedCta: "View promotion · Connect safely",
    },
    {
      canonical:
        "https://www.thetradescout.com/exchange?tab=sales&companyPromo=warehouse-clearance",
      title: "Exchange Sale | TradeScout",
      description: "Check out this sale on TradeScout Exchange.",
      expectedKind: "offer",
      expectedCta: "View sale · Connect safely",
    },
    {
      canonical: "https://www.thetradescout.com/handmade-marketplace",
      title: "Handmade Marketplace | Local Artisan Products",
      description: "Discover handmade products from local artisans in the TradeScout marketplace.",
      expectedKind: "directory",
      expectedCta: "Explore local handmade",
    },
  ])(
    "classifies the production-shaped legacy URL $canonical",
    ({ canonical, title, description, expectedKind, expectedCta }) => {
      const encodedCanonical = canonical.replace(/&/g, "&amp;");
      const genericImage =
        "https://www.thetradescout.com/tradescout-social-preview.png?v=12";
      const input = htmlFor({
        canonical,
        title,
        description,
        image: genericImage,
      }).replaceAll(canonical, encodedCanonical);

      const resolved = resolveSignedSocialPreviewToken(
        signedTokenFromHtml(upgradePublicSocialPreviewHtml(input))
      );

      expect(resolved?.context).toMatchObject({
        kind: expectedKind,
        ctaLabel: expectedCta,
        sourceImageUrl: null,
      });
    }
  );

  it("uses the dedicated community-group presentation", () => {
    const input = htmlFor({
      canonical: "https://www.thetradescout.com/group/group-1",
      title: "Escambia Makers | TradeScout Groups",
      description: "A public group for local makers.",
      image: "https://www.thetradescout.com/uploads/groups/escambia-makers.webp",
    });

    const resolved = resolveSignedSocialPreviewToken(
      signedTokenFromHtml(upgradePublicSocialPreviewHtml(input))
    );

    expect(resolved?.context).toMatchObject({
      kind: "group",
      brandName: "TradeScout Groups",
      eyebrow: "Community group",
      ctaLabel: "View group · Join the conversation",
    });
  });

  it("uses a text-led card instead of nesting the old generic preview image", () => {
    const input = htmlFor({
      canonical: "https://www.thetradescout.com/landing",
      title: "TradeScout | Connection Without Compromise",
      description: "Find trusted local help and move work forward.",
      image: "https://www.thetradescout.com/tradescout-social-preview.png?v=12",
    });

    const upgraded = upgradePublicSocialPreviewHtml(input);
    const resolved = resolveSignedSocialPreviewToken(signedTokenFromHtml(upgraded));

    expect(resolved?.context.kind).toBe("page");
    expect(resolved?.context.sourceImageUrl).toBeNull();
  });

  it("upgrades metadata regardless of quote style or attribute order", () => {
    const sourceImage = "https://www.thetradescout.com/uploads/public/source-image.webp";
    const input = htmlFor({
      canonical: "https://www.thetradescout.com/services/profile-1/offer-1",
      title: "Custom cabinet installation | TradeScout",
      description: "Review this service and contact the provider.",
      image: sourceImage,
    })
      .replace(
        `<meta property="og:image" content="${sourceImage}" />`,
        `<meta content='${sourceImage}' property='og:image' />`
      )
      .replace(
        `<meta name="twitter:image" content="${sourceImage}" />`,
        `<meta content='${sourceImage}' name='twitter:image' />`
      );

    const upgraded = upgradePublicSocialPreviewHtml(input);
    const resolved = resolveSignedSocialPreviewToken(signedTokenFromHtml(upgraded));

    expect(resolved?.context.kind).toBe("offer");
    expect(upgraded.match(/property="og:image"/g)).toHaveLength(1);
    expect(upgraded.match(/name="twitter:image"/g)).toHaveLength(1);
  });

  it("resolves a relative source image against the canonical public origin", () => {
    const input = htmlFor({
      canonical: "https://www.thetradescout.com/exchange/tools/listing-1",
      title: "Table saw | TradeScout Exchange",
      description: "A public local listing.",
      image: "/uploads/public/table-saw.webp",
    });

    const resolved = resolveSignedSocialPreviewToken(
      signedTokenFromHtml(upgradePublicSocialPreviewHtml(input))
    );

    expect(resolved?.context.sourceImageUrl).toBe(
      "https://www.thetradescout.com/uploads/public/table-saw.webp"
    );
  });

  it("does not wrap an entity-specific dynamic card a second time", () => {
    const dynamicImage =
      "https://www.thetradescout.com/images/social/profile/jw-stone/inventory/blue-mare.png?v=3-test";
    const input = htmlFor({
      canonical: "https://jwstonelogistics.com/?stone=blue-mare",
      title: "Blue Mare Quartzite | JW Stone Logistics",
      description: "View Blue Mare photos and request current pricing.",
      image: dynamicImage,
    });

    expect(upgradePublicSocialPreviewHtml(input)).toBe(input);
  });
});
