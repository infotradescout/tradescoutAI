import { formatTradeScoutTitle } from "@shared/brand";

type PublicLandingHtmlOptions = {
  origin: string;
  templateHtml: string;
  requestPath?: string;
  variant?: string | null;
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string) {
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function injectSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function titleCaseSlug(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCanonicalPath(requestPath?: string) {
  const pathOnly =
    String(requestPath || "/")
      .split("?")[0]
      .replace(/\/+$/, "") || "/";
  if (pathOnly === "/" || pathOnly === "/landing" || pathOnly === "/lp") return "/landing";
  if (pathOnly.startsWith("/lp/")) return pathOnly.replace(/^\/lp\//, "/landing/");
  if (pathOnly.startsWith("/landing/")) return pathOnly;
  return "/landing";
}

function buildMeta(opts: PublicLandingHtmlOptions) {
  const canonicalPath = normalizeCanonicalPath(opts.requestPath);
  const canonical = `${opts.origin}${canonicalPath}`;
  const normalizedVariant = String(opts.variant || "")
    .trim()
    .toLowerCase();
  const displayVariant = normalizedVariant ? titleCaseSlug(normalizedVariant) : "";
  const title = formatTradeScoutTitle(
    displayVariant
      ? `${displayVariant} | TradeScout`
      : "TradeScout | Find Any Local Business Near You"
  );
  const description = displayVariant
    ? `TradeScout for ${displayVariant}. Scout coordinates discovery, trust, intent, decision, and contact so local work moves forward without lead spam, pay-to-play ranking, or platform confusion.`
    : "Find trusted local businesses near you. Scout coordinates discovery, trust, and contact without lead spam, pay-to-play ranking, or platform confusion.";

  return {
    title,
    description,
    canonical,
    imageUrl: `${opts.origin}/tradescout-social-preview.png?v=11`,
    keywords: [
      "TradeScout",
      "local business directory",
      "find local businesses",
      "trusted local businesses",
      "restaurants near me",
      "retail near me",
      "home services",
      "direct connect",
      "community interaction",
      displayVariant,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .slice(0, 18)
      .join(", "),
  };
}

export async function buildPublicLandingHtml(opts: PublicLandingHtmlOptions): Promise<string> {
  const meta = buildMeta(opts);

  const summary = `
<main data-seo-landing="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <h1>Find Any Local Business Near You</h1>
    <p>${escapeHtml(meta.description)}</p>
    <p>TradeScout is a trusted local business directory, not a lead funnel. Scout runs the local operating flow from discovery to governed action for all types of businesses.</p>
    <h2>How TradeScout works</h2>
    <ol>
      <li>Ask Scout what you need.</li>
      <li>Scout interprets the request using trust, trade fit, and location context.</li>
      <li>Scout routes the right next step.</li>
      <li>Contact opens only when fit and intent are clear.</li>
    </ol>
    <h2>What makes it different</h2>
    <ul>
      <li>No lead reselling.</li>
      <li>No pay-to-play ranking.</li>
      <li>Trust signals stay visible.</li>
      <li>Contact stays governed instead of chaotic.</li>
    </ul>
    <p><a href="/pre-scout-setup?mode=create">Get started with Scout</a></p>
  </article>
</main>`;

  let html = opts.templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="viewport"[^>]*>/i,
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
  );
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="keywords"[^>]*>/i,
    `<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />'
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`
  );

  html = injectSummary(html, summary);
  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TradeScout",
    description: meta.description,
    url: meta.canonical,
    potentialAction: {
      "@type": "SearchAction",
      target: `${opts.origin}/scout?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  });
  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TradeScout",
    url: opts.origin,
    logo: `${opts.origin}/tradescout-logo.jpg`,
    description:
      "The trusted local business directory. Find any local business near you, from restaurants and retail to home services.",
    sameAs: ["https://www.thetradescout.com"],
  });
  return html;
}
