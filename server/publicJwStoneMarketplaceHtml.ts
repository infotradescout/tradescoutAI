import { formatTradeScoutTitle } from "@shared/brand";
import {
  JW_STONE_MANAGED_CONTACT,
  JW_STONE_PUBLIC_IDENTITY,
} from "@shared/jwStonePresentation";
import { resolveJwStoneLegacyItemSlug } from "@shared/jwStoneLegacyAliases";
import {
  createProfileInventoryCategoryShareMetadata,
  listProfileInventoryCategories,
} from "@shared/profileCategoryShare";
import { createProfileInventoryItemShareMetadata } from "@shared/profileItemShare";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "../client/src/data/jwStoneProfilePresentation";
import { JW_STONE_CANONICAL_INVENTORY_CATEGORIES } from "./jwStoneCanonicalInventory";

export const JW_STONE_MARKETPLACE_PLATFORM_URL = "https://www.thetradescout.com/jw-stone";
/** @deprecated Prefer JW_STONE_MARKETPLACE_PLATFORM_URL; kept for existing tests. */
export const JW_STONE_MARKETPLACE_CANONICAL_URL = JW_STONE_MARKETPLACE_PLATFORM_URL;

const JW_STONE_MARKETPLACE_TITLE = formatTradeScoutTitle("JW Stone | Stone Discovery");
const JW_STONE_MARKETPLACE_DESCRIPTION =
  "Browse JW Stone's stone collection, open full photo galleries, save selections, and ask about a material when you are ready.";
const JW_STONE_MARKETPLACE_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

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
  if (opts.collectionUrl) return String(opts.collectionUrl).replace(/\/+$/, "") || "/";
  const origin = normalizeOrigin(opts.origin);
  if (opts.marketplaceDomainSurface) return `${origin}/`;
  return JW_STONE_MARKETPLACE_PLATFORM_URL;
}

/**
 * Injects crawler and share metadata for the JW Stone marketplace collection
 * and optional stone/material deep links.
 */
export function buildPublicJwStoneMarketplaceHtml(
  opts: PublicJwStoneMarketplaceHtmlOptions
): string {
  const origin = normalizeOrigin(opts.origin);
  const collectionUrl = resolveCollectionUrl(opts);
  const profileUrl = opts.marketplaceDomainSurface ? `${origin}/` : collectionUrl;
  const contentBlocks = [JW_STONE_PUBLIC_DISCOVERY_BLOCK];
  const organizationJsonLd = {
    "@type": "Organization",
    name: JW_STONE_PUBLIC_IDENTITY.brandName,
    description: JW_STONE_PUBLIC_IDENTITY.about,
    url: profileUrl,
    telephone: JW_STONE_MANAGED_CONTACT.phone,
    email: JW_STONE_MANAGED_CONTACT.email,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: JW_STONE_MANAGED_CONTACT.phone,
      email: JW_STONE_MANAGED_CONTACT.email,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: JW_STONE_PUBLIC_IDENTITY.address.streetAddress,
      addressLocality: JW_STONE_PUBLIC_IDENTITY.address.addressLocality,
      addressRegion: JW_STONE_PUBLIC_IDENTITY.address.addressRegion,
      postalCode: JW_STONE_PUBLIC_IDENTITY.address.postalCode,
      addressCountry: JW_STONE_PUBLIC_IDENTITY.address.addressCountry,
    },
    sameAs: JW_STONE_PUBLIC_IDENTITY.socials.map((social) => social.href),
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

  const title = escapeHtml(itemShare?.title || categoryShare?.title || JW_STONE_MARKETPLACE_TITLE);
  const description = escapeHtml(
    itemShare?.description || categoryShare?.description || JW_STONE_MARKETPLACE_DESCRIPTION
  );
  const canonical = escapeHtml(itemShare?.canonical || categoryShare?.canonical || collectionUrl);
  const imageUrl = escapeHtml(
    itemShare?.imageUrl || categoryShare?.imageUrl || JW_STONE_MARKETPLACE_IMAGE_URL
  );
  const imageAlt = escapeHtml(
    itemShare?.imageAlt || categoryShare?.title || "JW Stone Logistics logo"
  );

  const companySummary = `
  <section data-seo-jw-stone-company="true" aria-labelledby="seo-jw-stone-about">
    <h2 id="seo-jw-stone-about">About JW Stone</h2>
    <p>${escapeHtml(JW_STONE_PUBLIC_IDENTITY.about)}</p>
    <h2>${escapeHtml(JW_STONE_MANAGED_CONTACT.label)}</h2>
    <p>Phone: ${escapeHtml(JW_STONE_MANAGED_CONTACT.phone)} · Email: ${escapeHtml(JW_STONE_MANAGED_CONTACT.email)}</p>
    <h2>Visit JW Stone</h2>
    <address>${escapeHtml(JW_STONE_PUBLIC_IDENTITY.address.formatted)}</address>
    <h2>Follow JW Stone</h2>
    <p>${JW_STONE_PUBLIC_IDENTITY.socials
      .map(
        (social) =>
          `${escapeHtml(social.label)}: ${escapeHtml(social.publicHandle)}`
      )
      .join(" · ")}</p>
  </section>`;

  const summary = itemShare
    ? `
<main data-seo-jw-stone-marketplace="true" data-seo-jw-stone-item="${escapeHtml(itemShare.itemSlug)}" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <p><img src="${escapeHtml(itemShare.imageUrl)}" alt="${imageAlt}" width="640" height="480" /></p>
    <h1>${escapeHtml(itemShare.hasPublicName ? itemShare.itemName : "Stone selection")}</h1>
    <p>${description}</p>
    <p><a href="${escapeHtml(collectionUrl)}">Browse the full JW Stone collection</a></p>
  </article>
${companySummary}
</main>`
    : categoryShare
      ? `
<main data-seo-jw-stone-marketplace="true" data-seo-jw-stone-category="${escapeHtml(categoryShare.categorySlug)}" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <h1>${escapeHtml(categoryShare.title)}</h1>
    <p>${description}</p>
    <p><a href="${escapeHtml(collectionUrl)}">Browse the full JW Stone collection</a></p>
  </article>
${companySummary}
</main>`
      : `
<main data-seo-jw-stone-marketplace="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <p><img src="/images/businesses/jw-stone/logo.svg" alt="${imageAlt}" width="180" height="72" /></p>
    <h1>Natural stone, selected at the source.</h1>
    <p>${description}</p>
    <h2>Material Library</h2>
    <p>Browse reference selections by photo. Filter by aesthetic or color, then ask JW Stone about the material for your project.</p>
    <p>Browse the collection, save stones, and ask JW Stone when you are ready. Saving never starts a request.</p>
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
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />'
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
    '<meta property="og:site_name" content="TradeScout" />'
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
    '<meta property="og:image:type" content="image/png" />'
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
        name: itemShare.title,
        description: itemShare.description,
        url: itemShare.canonical,
        image: itemShare.imageUrl,
        isPartOf: { "@type": "CollectionPage", url: collectionUrl },
        about: organizationJsonLd,
      }
    : categoryShare
      ? {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: categoryShare.title,
          description: categoryShare.description,
          url: categoryShare.canonical,
          image: categoryShare.imageUrl,
          about: organizationJsonLd,
        }
      : {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "JW Stone | Stone Discovery",
          description: JW_STONE_MARKETPLACE_DESCRIPTION,
          url: collectionUrl,
          image: JW_STONE_MARKETPLACE_IMAGE_URL,
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
  const items = JW_STONE_CANONICAL_INVENTORY_CATEGORIES.flatMap((category) =>
    category.stones.map((stone) => stone.slug)
  );

  const urls = [
    `${publicOrigin}/`,
    ...categories.map((category) => `${publicOrigin}/materials/${category.slug}`),
    ...items.map((slug) => `${publicOrigin}/stones/${slug}`),
  ];

  const entries = urls
    .map((url) => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export function buildJwStoneMarketplaceLlmsText(origin: string): string {
  const publicOrigin = normalizeOrigin(origin);
  return [
    "# JW Stone",
    "",
    "Natural stone marketplace on TradeScout.",
    "",
    JW_STONE_PUBLIC_IDENTITY.about,
    "",
    `TradeScout managed phone: ${JW_STONE_MANAGED_CONTACT.phone}`,
    `TradeScout managed email: ${JW_STONE_MANAGED_CONTACT.email}`,
    `Address: ${JW_STONE_PUBLIC_IDENTITY.address.formatted}`,
    ...JW_STONE_PUBLIC_IDENTITY.socials.map(
      (social) => `${social.label}: ${social.publicHandle}`
    ),
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
    "Calls and requests are handled through TradeScout.",
    "",
  ].join("\n");
}
