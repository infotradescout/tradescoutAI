import { formatTradeScoutTitle } from "@shared/brand";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import { storage } from "./storage";

export type PublicHomeScoutCountyHtmlOptions = {
  origin: string;
  templateHtml: string;
  stateCode: string;
  countyFips: string;
};

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

function normalizeOrigin(value: unknown): string | null {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function injectSummary(html: string, summaryHtml: string): string {
  return html.replace(/<div id="root">\s*<\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

export async function buildPublicHomeScoutCountyHtml({
  origin: rawOrigin,
  templateHtml,
  stateCode: rawStateCode,
  countyFips: rawCountyFips,
}: PublicHomeScoutCountyHtmlOptions): Promise<string | null> {
  const origin = normalizeOrigin(rawOrigin);
  const stateCode = String(rawStateCode || "")
    .trim()
    .toUpperCase();
  const countyFips = String(rawCountyFips || "").trim();
  if (!origin || !templateHtml || !/^[A-Z]{2}$/.test(stateCode) || !/^\d{5}$/.test(countyFips)) {
    return null;
  }

  let county: any;
  try {
    county = await storage.getCountyByFips(countyFips);
  } catch {
    return null;
  }
  if (
    !county ||
    String(county.fips || "").trim() !== countyFips ||
    String(county.stateCode || "")
      .trim()
      .toUpperCase() !== stateCode
  ) {
    return null;
  }

  const countyName = sanitizePublicDiscoveryText(county.name, 100);
  if (!countyName) return null;

  const locationLabel = `${countyName}, ${stateCode}`;
  const title = formatTradeScoutTitle(`Homes for sale in ${locationLabel}`);
  const description = `Browse active HomeScout property listings in ${locationLabel}. Compare local homes and request details through TradeScout Direct Connect.`;
  const canonical = `${origin}/homescout/${stateCode}/${countyFips}`;
  const imageUrl = `${origin}/tradescout-social-preview.png?v=12`;
  const imageAlt = `HomeScout listings in ${locationLabel}`;

  let html = templateHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );
  const tags: Array<[RegExp, string]> = [
    [
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta name="robots"[^>]*>/i,
      '<meta name="robots" content="index, follow, max-image-preview:large" />',
    ],
    [/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`],
    [/<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="website" />'],
    [
      /<meta property="og:site_name"[^>]*>/i,
      '<meta property="og:site_name" content="HomeScout" />',
    ],
    [
      /<meta property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    ],
    [
      /<meta property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:secure_url"[^>]*>/i,
      `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:type"[^>]*>/i,
      '<meta property="og:image:type" content="image/png" />',
    ],
    [/<meta property="og:image:width"[^>]*>/i, '<meta property="og:image:width" content="1200" />'],
    [
      /<meta property="og:image:height"[^>]*>/i,
      '<meta property="og:image:height" content="630" />',
    ],
    [
      /<meta property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    ],
    [
      /<meta name="twitter:card"[^>]*>/i,
      '<meta name="twitter:card" content="summary_large_image" />',
    ],
    [
      /<meta name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta name="twitter:image:alt"[^>]*>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`,
    ],
  ];
  for (const [pattern, tag] of tags) html = upsertTag(html, pattern, tag);

  const summary = `
<main data-seo-homescout-county="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(`HomeScout listings in ${locationLabel}`)}</h1>
    <p>${escapeHtml(description)}</p>
    <p>Property contact remains protected until you choose to request details.</p>
  </article>
</main>`;

  return injectSummary(html, summary);
}
