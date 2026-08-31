import { formatTradeScoutTitle } from "@shared/brand";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { resolveJwStoneLegacyItemSlug } from "@shared/jwStoneLegacyAliases";
import {
  createProfileInventoryCategoryShareMetadata,
  listProfileInventoryCategories,
} from "@shared/profileCategoryShare";
import {
  createProfileInventoryItemShareMetadata,
  listProfileInventoryItems,
} from "@shared/profileItemShare";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "../client/src/data/jwStoneProfilePresentation";
import { JW_STONE_CANONICAL_INVENTORY_CATEGORIES } from "./jwStoneCanonicalInventory";

export const JW_STONE_MARKETPLACE_PLATFORM_URL = "https://www.thetradescout.com/jw-stone";
/** @deprecated Prefer JW_STONE_MARKETPLACE_PLATFORM_URL; kept for existing tests. */
export const JW_STONE_MARKETPLACE_CANONICAL_URL = JW_STONE_MARKETPLACE_PLATFORM_URL;

const JW_STONE_MARKETPLACE_TITLE = formatTradeScoutTitle("Natural stone slabs in Pensacola, FL");
const JW_STONE_MARKETPLACE_DESCRIPTION =
  "Natural stone slabs in Pensacola, Florida: browse named granite, marble, quartzite, engineered quartz, onyx, soapstone and basalt materials from JW Stone Logistics.";
const JW_STONE_MARKETPLACE_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

const JW_STONE_CUSTOM_DOMAIN_TITLE = "Natural Stone Slabs in Pensacola, FL | JW Stone Logistics";
const JW_STONE_CUSTOM_DOMAIN_DESCRIPTION =
  "Browse quarry-direct granite, marble, quartzite, onyx, soapstone and engineered quartz slabs from JW Stone Logistics in Pensacola, Florida.";
const JW_STONE_LEGACY_DOMAIN = "https://jwstonellc.com/";
const JW_STONE_DISCOVERY_PRIORITY_SLUGS = [
  "black-dunes",
  "avalanche",
  "cristalita-blue",
  "rhino-white",
  "blue-bahia",
  "calacatta-vaguili",
  "matarazzo",
  "calacatta-cremo",
  "casa-blanca",
  "white-santorini",
] as const;

export type PublicJwStoneMarketplaceHtmlOptions = {
  templateHtml: string;
  origin?: string;
  /** Absolute marketplace collection URL for this host (custom domain `/` or platform `/jw-stone`). */
  collectionUrl?: string;
  stoneSlug?: unknown;
  photo?: unknown;
  materialSlug?: unknown;
  /** When true, inject client flag so React mounts marketplace on the custom host. */
  marketplaceDomainSurface?: boolean;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function imageMimeType(url: string): string {
  const pathname = String(url || "")
    .split(/[?#]/, 1)[0]
    .toLowerCase();
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function upsertTag(html: string, regex: RegExp, tag: string): string {
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function injectSummary(html: string, summaryHtml: string): string {
  const withRootSummary = html.replace(
    /<div\b([^>]*\bid=["']root["'][^>]*)>\s*<\/div>/i,
    `<div$1>${summaryHtml}</div>`
  );
  if (withRootSummary !== html) return withRootSummary;
  return html.replace(/<\/body>/i, `${summaryHtml}\n</body>`);
}

function injectJsonLd(html: string, jsonLd: object): string {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
}

function injectMarketplaceDomainSurface(html: string): string {
  const script = `<script>window.__TS_JW_STONE_MARKETPLACE_SURFACE__=true;window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__="jw-stone";</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function normalizeOrigin(origin: string | undefined): string {
  const raw = String(origin || "https://www.thetradescout.com")
    .trim()
    .replace(/\/+$/, "");
  return raw || "https://www.thetradescout.com";
}

function resolveCollectionUrl(opts: PublicJwStoneMarketplaceHtmlOptions): string {
  if (opts.collectionUrl) {
    const raw = String(opts.collectionUrl).trim();
    if (!raw) return "/";
    try {
      const parsed = new URL(raw);
      if (parsed.pathname === "/" && !parsed.search && !parsed.hash) return `${parsed.origin}/`;
    } catch {
      // Relative collection paths use the existing trailing-slash normalization.
    }
    return raw.replace(/\/+$/, "") || "/";
  }
  const origin = normalizeOrigin(opts.origin);
  if (opts.marketplaceDomainSurface) return `${origin}/`;
  return JW_STONE_MARKETPLACE_PLATFORM_URL;
}

function withRequestQuery(url: string, request: "stone" | "collection"): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("request", request);
    return parsed.toString();
  } catch {
    return url;
  }
}

function customDomainItemTitle(itemName: string, category: string | null): string {
  const material = category ? ` ${category}` : " Natural Stone";
  return `${itemName}${material} Slabs | JW Stone Pensacola`;
}

function customDomainItemDescription(itemName: string, category: string | null): string {
  const material = category ? ` ${category}` : "";
  return `View ${itemName}${material} slab photos from JW Stone Logistics in Pensacola, Florida. Ask whether it is currently available.`;
}

function customDomainCategoryTitle(categoryName: string): string {
  return `${categoryName} Slabs in Pensacola, FL | JW Stone Logistics`;
}

function customDomainCategoryDescription(categoryName: string): string {
  return `Browse ${categoryName} slab photos from JW Stone Logistics in Pensacola, Florida. Compare selections and ask what is currently available.`;
}

/**
 * Injects crawler and share metadata for the JW Stone marketplace collection
 * and optional stone/material deep links. Direct contact is intentionally not
 * published here; customer contact stays behind Express Direct Connect.
 */
export function buildPublicJwStoneMarketplaceHtml(
  opts: PublicJwStoneMarketplaceHtmlOptions
): string {
  const origin = normalizeOrigin(opts.origin);
  const collectionUrl = resolveCollectionUrl(opts);
  const profileUrl = opts.marketplaceDomainSurface ? `${origin}/` : collectionUrl;
  const contentBlocks = [JW_STONE_PUBLIC_DISCOVERY_BLOCK];
  const organizationJsonLd = {
    "@type": opts.marketplaceDomainSurface ? "Store" : "Organization",
    ...(opts.marketplaceDomainSurface
      ? {
          "@id": `${profileUrl}#jw-stone-logistics`,
          alternateName: ["JW Stone", "JW Stone LLC"],
          foundingDate: JW_STONE_PUBLIC_IDENTITY.foundingDate,
          image: `${origin}/images/businesses/jw-stone/logo-social-preview.png`,
          logo: `${origin}/images/businesses/jw-stone/logo.svg`,
          hasMap: JW_STONE_PUBLIC_IDENTITY.address.mapUrl,
          areaServed: { "@type": "AdministrativeArea", name: "Gulf Coast" },
          knowsAbout: [
            "Natural stone slabs",
            "Granite",
            "Marble",
            "Quartzite",
            "Onyx",
            "Soapstone",
            "Engineered quartz",
          ],
        }
      : {}),
    name: JW_STONE_PUBLIC_IDENTITY.brandName,
    description: JW_STONE_PUBLIC_IDENTITY.about,
    url: profileUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: JW_STONE_PUBLIC_IDENTITY.address.streetAddress,
      addressLocality: JW_STONE_PUBLIC_IDENTITY.address.addressLocality,
      addressRegion: JW_STONE_PUBLIC_IDENTITY.address.addressRegion,
      postalCode: JW_STONE_PUBLIC_IDENTITY.address.postalCode,
      addressCountry: JW_STONE_PUBLIC_IDENTITY.address.addressCountry,
    },
    sameAs: [
      ...JW_STONE_PUBLIC_IDENTITY.socials.map((social) => social.href),
      ...(opts.marketplaceDomainSurface ? [JW_STONE_LEGACY_DOMAIN] : []),
    ],
  };

  const itemShare = opts.stoneSlug
    ? createProfileInventoryItemShareMetadata({
        profileName: "JW Stone Logistics",
        profileUrl,
        assetOrigin: `${origin}/`,
        categories: JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
        itemSlug: resolveJwStoneLegacyItemSlug(String(opts.stoneSlug)),
        photo: opts.photo,
        publicRouteContentBlocks: contentBlocks,
      })
    : null;

  const categoryShare =
    !itemShare && opts.materialSlug
      ? createProfileInventoryCategoryShareMetadata({
          profileName: "JW Stone Logistics",
          profileUrl,
          assetOrigin: `${origin}/`,
          categories: JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
          categorySlug: opts.materialSlug,
          publicRouteContentBlocks: contentBlocks,
        })
      : null;
  const collectionCategoryShares = listProfileInventoryCategories(
    JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
    contentBlocks
  )
    .filter((category) => category.indexable)
    .map((category) =>
      createProfileInventoryCategoryShareMetadata({
        profileName: "JW Stone Logistics",
        profileUrl,
        assetOrigin: `${origin}/`,
        categories: JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
        categorySlug: category.slug,
        publicRouteContentBlocks: contentBlocks,
      })
    )
    .filter((category): category is NonNullable<typeof category> => Boolean(category));
  const priorityItemShares = JW_STONE_DISCOVERY_PRIORITY_SLUGS.map((itemSlug) =>
    createProfileInventoryItemShareMetadata({
      profileName: "JW Stone Logistics",
      profileUrl,
      assetOrigin: `${origin}/`,
      categories: JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
      itemSlug,
      publicRouteContentBlocks: contentBlocks,
    })
  ).filter((item): item is NonNullable<typeof item> => Boolean(item?.hasPublicName));
  const categoryItemShares = categoryShare
    ? categoryShare.itemSlugs
        .map((itemSlug) =>
          createProfileInventoryItemShareMetadata({
            profileName: "JW Stone Logistics",
            profileUrl,
            assetOrigin: `${origin}/`,
            categories: JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
            itemSlug,
            publicRouteContentBlocks: contentBlocks,
          })
        )
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.hasPublicName))
    : [];
  const indexable = opts.stoneSlug
    ? Boolean(itemShare?.hasPublicName && itemShare.hasPublicSummary)
    : opts.materialSlug
      ? Boolean(categoryShare?.indexable)
      : true;

  const resolvedTitle = itemShare
    ? opts.marketplaceDomainSurface && itemShare.hasPublicName
      ? customDomainItemTitle(itemShare.itemName, itemShare.category)
      : itemShare.title
    : categoryShare
      ? opts.marketplaceDomainSurface
        ? customDomainCategoryTitle(categoryShare.categoryName)
        : categoryShare.title
      : opts.marketplaceDomainSurface
        ? JW_STONE_CUSTOM_DOMAIN_TITLE
        : JW_STONE_MARKETPLACE_TITLE;
  const resolvedDescription = itemShare
    ? opts.marketplaceDomainSurface && itemShare.hasPublicName
      ? customDomainItemDescription(itemShare.itemName, itemShare.category)
      : itemShare.description
    : categoryShare
      ? opts.marketplaceDomainSurface
        ? customDomainCategoryDescription(categoryShare.categoryName)
        : categoryShare.description
      : opts.marketplaceDomainSurface
        ? JW_STONE_CUSTOM_DOMAIN_DESCRIPTION
        : JW_STONE_MARKETPLACE_DESCRIPTION;

  const structuredDescription =
    itemShare && itemShare.hasPublicName
      ? "View " +
        itemShare.itemName +
        (itemShare.category ? " " + itemShare.category : "") +
        " slab photos from JW Stone Logistics in Pensacola, Florida."
      : categoryShare
        ? "Browse " +
          categoryShare.categoryName +
          " slab photos from JW Stone Logistics in Pensacola, Florida."
        : opts.marketplaceDomainSurface
          ? JW_STONE_CUSTOM_DOMAIN_DESCRIPTION
          : JW_STONE_MARKETPLACE_DESCRIPTION;

  const title = escapeHtml(resolvedTitle);
  const description = escapeHtml(resolvedDescription);
  const canonicalValue =
    itemShare && !indexable
      ? collectionUrl
      : itemShare?.canonical || categoryShare?.canonical || collectionUrl;
  const canonical = escapeHtml(canonicalValue);
  const imageUrl = escapeHtml(
    itemShare?.imageUrl || categoryShare?.imageUrl || JW_STONE_MARKETPLACE_IMAGE_URL
  );
  const imageAlt = escapeHtml(itemShare?.imageAlt || resolvedTitle || "JW Stone Logistics logo");

  const companySummary = `
  <section data-seo-jw-stone-company="true" aria-labelledby="seo-jw-stone-about">
    <h2 id="seo-jw-stone-about">About JW Stone</h2>
    <p>${escapeHtml(JW_STONE_PUBLIC_IDENTITY.about)}</p>
    <h2>Visit JW Stone</h2>
    <address>${escapeHtml(JW_STONE_PUBLIC_IDENTITY.address.formatted)}</address>
    <h2>Follow JW Stone</h2>
    <p>${JW_STONE_PUBLIC_IDENTITY.socials
      .map((social) => `${escapeHtml(social.label)}: ${escapeHtml(social.publicHandle)}`)
      .join(" · ")}</p>
  </section>`;

  const summary = itemShare
    ? `
<main data-seo-jw-stone-marketplace="true" data-seo-jw-stone-item="${escapeHtml(itemShare.itemSlug)}" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <p><img src="${escapeHtml(itemShare.imageUrl)}" alt="${imageAlt}" width="640" height="480" /></p>
    <h1>${escapeHtml(itemShare.hasPublicName ? itemShare.itemName : "Stone selection")}</h1>
    <p>${description}</p>
    ${itemShare.category ? `<p><strong>Material collection:</strong> ${escapeHtml(itemShare.category)}</p>` : ""}
    ${
      itemShare.hasPublicName
        ? `<p><a data-seo-jw-stone-request="stone" href="${escapeHtml(
            withRequestQuery(itemShare.canonical, "stone")
          )}">Ask about ${escapeHtml(itemShare.itemName)}</a></p>`
        : ""
    }
    <p><a href="${escapeHtml(collectionUrl)}">Browse the full JW Stone collection</a></p>
  </article>
${companySummary}
</main>`
    : categoryShare
      ? `
<main data-seo-jw-stone-marketplace="true" data-seo-jw-stone-category="${escapeHtml(categoryShare.categorySlug)}" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <h1>${escapeHtml(
      opts.marketplaceDomainSurface
        ? `${categoryShare.categoryName} slabs in Pensacola, Florida`
        : categoryShare.title
    )}</h1>
    <p>${description}</p>
    <h2>Browse ${escapeHtml(categoryShare.categoryName)} selections</h2>
    <ul>
      ${categoryItemShares
        .map(
          (item) =>
            `<li><a href="${escapeHtml(item.canonical)}">${escapeHtml(item.itemName)}</a></li>`
        )
        .join("\n")}
    </ul>
    <p><a href="${escapeHtml(collectionUrl)}">Browse the full JW Stone collection</a></p>
  </article>
${companySummary}
</main>`
      : `
<main data-seo-jw-stone-marketplace="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <p><img src="/images/businesses/jw-stone/logo.svg" alt="${imageAlt}" width="180" height="72" /></p>
    <h1>${escapeHtml(
      opts.marketplaceDomainSurface
        ? "Natural stone slabs in Pensacola, selected at the source."
        : "Natural stone, selected at the source."
    )}</h1>
    <p>${description}</p>
    ${
      opts.marketplaceDomainSurface
        ? `<h2>Granite, marble, quartzite and specialty slabs for the Gulf Coast</h2>
    <p>Browse granite, marble, quartzite, engineered quartz, onyx, soapstone and basalt slab photos from JW Stone Logistics in Pensacola, Florida. Compare named materials and ask JW Stone what is currently available for your project.</p>`
        : ""
    }
    <h2>Material Library: natural stone slabs in Pensacola, Florida</h2>
    <p>JW Stone Logistics helps fabricators, builders, architects, designers, and homeowners browse named material photos by material, aesthetic, or color. These offerings are not a claim of confirmed physical stock.</p>
    <p>Review named material photos, then ask JW Stone to confirm current pricing or availability for your project.</p>
    <p>Browse the collection, save stones, and ask JW Stone when you are ready. Saving never starts a request.</p>
    <h2>Browse by material</h2>
    <ul>
      ${collectionCategoryShares
        .map(
          (category) =>
            `<li><a href="${escapeHtml(category.canonical)}">${escapeHtml(category.categoryName)}</a> <small>(${category.itemCount} selections)</small></li>`
        )
        .join("\n")}
    </ul>
    <h2>Popular stone selections</h2>
    <ul>
      ${priorityItemShares
        .map(
          (item) =>
            `<li><a href="${escapeHtml(item.canonical)}">${escapeHtml(item.itemName)}</a></li>`
        )
        .join("\n")}
    </ul>
    <p><a data-seo-jw-stone-request="collection" href="${escapeHtml(
      withRequestQuery(collectionUrl, "collection")
    )}">Start a JW Stone request</a></p>
  </article>
${companySummary}
</main>`;

  let html = opts.templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${description}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    indexable
      ? '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />'
      : '<meta name="robots" content="noindex, follow" />'
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    '<meta property="og:type" content="website" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:site_name"[^>]*>/i,
    `<meta property="og:site_name" content="${
      opts.marketplaceDomainSurface ? "JW Stone Logistics" : "TradeScout"
    }" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${title}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${description}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${imageUrl}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:secure_url"[^>]*>/i,
    `<meta property="og:image:secure_url" content="${imageUrl}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:type"[^>]*>/i,
    `<meta property="og:image:type" content="${imageMimeType(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:width"[^>]*>/i,
    '<meta property="og:image:width" content="1200" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:image:height"[^>]*>/i,
    '<meta property="og:image:height" content="630" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="${imageAlt}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${description}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${imageUrl}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image:alt"[^>]*>/i,
    `<meta name="twitter:image:alt" content="${imageAlt}" />`
  );

  if (opts.marketplaceDomainSurface) {
    html = injectMarketplaceDomainSurface(html);
  }

  html = upsertTag(
    html,
    /<meta name="tradescout-business-slug"[^>]*>/i,
    '<meta name="tradescout-business-slug" content="jw-stone" />'
  );
  html = upsertTag(
    html,
    /<meta name="tradescout-business-entity-type"[^>]*>/i,
    '<meta name="tradescout-business-entity-type" content="business_marketplace" />'
  );

  html = injectSummary(html, summary);
  const jsonLd = itemShare
    ? {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: resolvedTitle,
        description: structuredDescription,
        url: canonicalValue,
        image: itemShare.imageUrl,
        isPartOf: { "@type": "CollectionPage", url: collectionUrl },
        about: organizationJsonLd,
        mainEntity: itemShare.hasPublicName
          ? {
              "@type": "Product",
              name: itemShare.itemName,
              description: structuredDescription,
              image: itemShare.imageUrl,
              category: itemShare.category || "Natural stone",
              brand: { "@type": "Brand", name: JW_STONE_PUBLIC_IDENTITY.brandName },
            }
          : undefined,
      }
    : categoryShare
      ? {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: resolvedTitle,
          description: structuredDescription,
          url: categoryShare.canonical,
          image: categoryShare.imageUrl,
          about: organizationJsonLd,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: categoryItemShares.length,
            itemListElement: categoryItemShares.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.itemName,
              url: item.canonical,
            })),
          },
        }
      : {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: opts.marketplaceDomainSurface
            ? JW_STONE_CUSTOM_DOMAIN_TITLE
            : "Natural stone slabs in Pensacola, FL | JW Stone Logistics",
          description: opts.marketplaceDomainSurface
            ? JW_STONE_CUSTOM_DOMAIN_DESCRIPTION
            : JW_STONE_MARKETPLACE_DESCRIPTION,
          url: collectionUrl,
          image: opts.marketplaceDomainSurface
            ? `${origin}/images/businesses/jw-stone/logo-social-preview.png`
            : JW_STONE_MARKETPLACE_IMAGE_URL,
          mainEntity: organizationJsonLd,
        };

  return injectJsonLd(html, jsonLd);
}

export function buildJwStoneMarketplaceSitemapXml(origin: string): string {
  const publicOrigin = normalizeOrigin(origin);
  const contentBlocks = [JW_STONE_PUBLIC_DISCOVERY_BLOCK];
  const categories = listProfileInventoryCategories(
    JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
    contentBlocks
  ).filter((category) => category.indexable);
  const itemSlugs = listProfileInventoryItems(JW_STONE_CANONICAL_INVENTORY_CATEGORIES)
    .filter((item) => item.hasPublicName && item.publicKind === "offering" && item.publicSummary)
    .map((item) => item.slug);

  const urls = [
    `${publicOrigin}/`,
    ...categories.map((category) => `${publicOrigin}/materials/${category.slug}`),
    ...itemSlugs.map((slug) => `${publicOrigin}/stones/${slug}`),
  ];

  const entries = urls
    .map((url) => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildJwStoneMarketplaceLlmsText(origin: string): string {
  const publicOrigin = normalizeOrigin(origin);
  const contentBlocks = [JW_STONE_PUBLIC_DISCOVERY_BLOCK];
  const categories = listProfileInventoryCategories(
    JW_STONE_CANONICAL_INVENTORY_CATEGORIES,
    contentBlocks
  ).filter((category) => category.indexable);

  return [
    "# JW Stone Logistics",
    "",
    "Natural stone supplier in Pensacola, Florida, serving fabricators, builders, designers and homeowners across the Gulf Coast.",
    "Materials include granite, marble, quartzite, onyx, soapstone and engineered quartz.",
    "",
    JW_STONE_PUBLIC_IDENTITY.about,
    "",
    `Address: ${JW_STONE_PUBLIC_IDENTITY.address.formatted}`,
    ...JW_STONE_PUBLIC_IDENTITY.socials.map((social) => `${social.label}: ${social.publicHandle}`),
    "",
    "Useful customer entry points:",
    "- Natural stone slabs in Pensacola: " + publicOrigin + "/",
    ...categories.map(
      (category) =>
        "- " +
        category.name +
        " slabs: " +
        publicOrigin +
        "/materials/" +
        category.slug +
        " — " +
        category.summary
    ),
    "",
    "Individual named materials:",
    "- " + publicOrigin + "/stones/{slug}",
    "",
    `Canonical: ${publicOrigin}/`,
    `Robots: ${publicOrigin}/robots.txt`,
    `Sitemap: ${publicOrigin}/sitemap.xml`,
    "",
    "Indexable surfaces:",
    `- Collection: ${publicOrigin}/`,
    `- Stones: ${publicOrigin}/stones/{slug}`,
    `- Materials: ${publicOrigin}/materials/{slug}`,
    "",
    "Priority named stone pages:",
    ...JW_STONE_DISCOVERY_PRIORITY_SLUGS.map((slug) => `- ${publicOrigin}/stones/${slug}`),
    "",
    "Calls and requests are available through Express Direct Connect on the profile.",
    "",
  ].join("\n");
}
