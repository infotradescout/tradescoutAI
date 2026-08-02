export const JW_STONE_MARKETPLACE_CANONICAL_URL = "https://www.thetradescout.com/jw-stone";

const JW_STONE_MARKETPLACE_TITLE = "Guided Natural Stone Discovery | JW Stone";
const JW_STONE_MARKETPLACE_DESCRIPTION =
  "Start with your project role and color direction to explore JW Stone's photographed stone collection, save named selections, and connect only when you choose.";
const JW_STONE_MARKETPLACE_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace(/<\/head>/i, `${tag}\n</head>`);
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
  return html.replace(/<\/head>/i, `<script type="application/ld+json">${json}</script>\n</head>`);
}

export function buildPublicJwStoneMarketplaceHtml(templateHtml: string): string {
  if (!String(templateHtml || "").trim()) return "";

  const summary = `
<main data-seo-jw-stone="marketplace" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <img src="/images/businesses/jw-stone/logo.svg" alt="JW Stone" width="240" height="72" />
    <h1>Stone selection built around your project</h1>
    <p>${escapeHtml(JW_STONE_MARKETPLACE_DESCRIPTION)}</p>
    <h2>Choose the way you work</h2>
    <ul>
      <li>Fabricator</li>
      <li>Builder</li>
      <li>Designer</li>
      <li>Homeowner</li>
    </ul>
    <p>Choose a project role and color direction before opening the matching selection workspace. Public galleries use photographed JW Stone inventory; availability is confirmed directly.</p>
    <p>Contact starts only when you choose Direct Connect.</p>
    <p><a href="/jw-stone">Explore JW Stone</a></p>
  </article>
</main>`;

  let html = templateHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(JW_STONE_MARKETPLACE_TITLE)}</title>`
  );
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(JW_STONE_MARKETPLACE_DESCRIPTION)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />'
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${JW_STONE_MARKETPLACE_CANONICAL_URL}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(JW_STONE_MARKETPLACE_TITLE)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(JW_STONE_MARKETPLACE_DESCRIPTION)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${JW_STONE_MARKETPLACE_CANONICAL_URL}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${JW_STONE_MARKETPLACE_IMAGE_URL}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:secure_url"[^>]*>/i,
    `<meta property="og:image:secure_url" content="${JW_STONE_MARKETPLACE_IMAGE_URL}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:type"[^>]*>/i,
    '<meta property="og:image:type" content="image/png" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    '<meta property="og:image:alt" content="JW Stone" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(JW_STONE_MARKETPLACE_TITLE)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(JW_STONE_MARKETPLACE_DESCRIPTION)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${JW_STONE_MARKETPLACE_IMAGE_URL}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image:alt"[^>]*>/i,
    '<meta name="twitter:image:alt" content="JW Stone" />'
  );

  html = injectSummary(html, summary);
  return injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "JW Stone",
    description: JW_STONE_MARKETPLACE_DESCRIPTION,
    url: JW_STONE_MARKETPLACE_CANONICAL_URL,
    image: JW_STONE_MARKETPLACE_IMAGE_URL,
  });
}
