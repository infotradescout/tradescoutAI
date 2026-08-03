import { formatTradeScoutTitle } from "@shared/brand";

export const JW_STONE_MARKETPLACE_CANONICAL_URL = "https://www.thetradescout.com/jw-stone";

const JW_STONE_MARKETPLACE_TITLE = formatTradeScoutTitle("JW Stone | Guided Stone Discovery");
const JW_STONE_MARKETPLACE_DESCRIPTION =
  "Explore JW Stone inventory by buyer and color direction, save named selections in a browser wishlist, and choose when to start a request.";
const JW_STONE_MARKETPLACE_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

type PublicJwStoneMarketplaceHtmlOptions = {
  templateHtml: string;
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

/**
 * Injects crawler and share metadata for the separate JW Stone marketplace.
 * This renderer intentionally has no inventory dependency: individual stones,
 * anonymous reconciliation groups, First Cut placeholders, commercial terms,
 * and origin claims do not belong in this collection-level document.
 */
export function buildPublicJwStoneMarketplaceHtml(
  opts: PublicJwStoneMarketplaceHtmlOptions
): string {
  const title = escapeHtml(JW_STONE_MARKETPLACE_TITLE);
  const description = escapeHtml(JW_STONE_MARKETPLACE_DESCRIPTION);
  const canonical = escapeHtml(JW_STONE_MARKETPLACE_CANONICAL_URL);
  const imageUrl = escapeHtml(JW_STONE_MARKETPLACE_IMAGE_URL);
  const imageAlt = "JW Stone Logistics logo";

  const summary = `
<main data-seo-jw-stone-marketplace="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <p><img src="/images/businesses/jw-stone/logo.svg" alt="${imageAlt}" width="180" height="72" /></p>
    <h1>JW Stone</h1>
    <p>${description}</p>
    <h2>Choose a project path</h2>
    <ul>
      <li>Fabricators can focus on supplied stone specifications and source counts.</li>
      <li>Builders can organize supplied inventory facts for a project.</li>
      <li>Designers can review imagery and build a selection board.</li>
      <li>Homeowners can explore stone in plain language.</li>
    </ul>
    <h2>Browse on your terms</h2>
    <p>Country of origin appears only when JW Stone supplies a verified country. Saving a named stone does not contact JW Stone; starting a request is a separate choice.</p>
  </article>
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

  html = injectSummary(html, summary);
  return injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "JW Stone | Guided Stone Discovery",
    description: JW_STONE_MARKETPLACE_DESCRIPTION,
    url: JW_STONE_MARKETPLACE_CANONICAL_URL,
    image: JW_STONE_MARKETPLACE_IMAGE_URL,
  });
}
