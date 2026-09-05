import { formatTradeScoutTitle } from "@shared/brand";
import { resolvePublicLandingIndexability } from "@shared/publicLandingIndexability";
import { LOCAL_BUSINESS_DISCOVERY } from "../client/src/lib/popularSearchQueries";
import {
  explainerChapters,
  type ExplainerCard,
  type ExplainerChapter,
  type ExplainerTopic,
} from "../client/src/pages/tradescoutExplainerData";

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
  const withRootSummary = html.replace(
    /<div\b([^>]*\bid=["']root["'][^>]*)>\s*<\/div>/i,
    (_match, rootAttributes: string) => `<div${rootAttributes}>${summaryHtml}</div>`
  );
  if (withRootSummary !== html) return withRootSummary;
  return html.replace(/<\/body>/i, `${summaryHtml}\n</body>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

export function buildPublicFindLocalBusinessesHtml(
  opts: Pick<PublicLandingHtmlOptions, "origin" | "templateHtml">
): string {
  const content = LOCAL_BUSINESS_DISCOVERY;
  const canonical = `${opts.origin}/find-local-businesses`;
  let html = upsertTag(
    opts.templateHtml,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(content.title)}</title>`
  );
  for (const [name, value, attribute] of [
    ["description", content.description, "name"],
    [
      "robots",
      "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      "name",
    ],
    ["og:title", content.title, "property"],
    ["og:description", content.description, "property"],
    ["og:url", canonical, "property"],
    ["og:type", "website", "property"],
    ["twitter:title", content.title, "name"],
    ["twitter:description", content.description, "name"],
  ]) {
    html = upsertTag(
      html,
      new RegExp(`<meta ${attribute}="${name}"[^>]*>`, "i"),
      `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`
    );
  }
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  const links = content.browseLinks
    .map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`)
    .join("\n");
  html = injectSummary(
    html,
    `<main data-seo-find-local-businesses="true">
    <h1>${escapeHtml(content.heading)}</h1>
    <p>${escapeHtml(content.introduction)}</p>
    <nav aria-label="Browse local businesses"><ul>${links}</ul></nav>
    <p><a href="${escapeHtml(content.tangipahoaRequestHref)}">Start a Request</a></p>
    <p><a href="${escapeHtml(content.tangipahoaRecentHref)}">View Tangipahoa activity</a></p>
  </main>`
  );
  return injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: content.title,
    description: content.description,
    url: canonical,
  });
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
  if (pathOnly === "/" || pathOnly === "/landing" || pathOnly === "/lp") return "/";
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
    displayVariant ? `${displayVariant} | TradeScout` : "TradeScout | Connection Without Compromise"
  );
  const description = displayVariant
    ? `TradeScout for ${displayVariant}. Find what you need or show what you offer without sold leads, paid ranking, or contact before acceptance.`
    : "Find what you need. Show what you offer. TradeScout connects people and local businesses without sold leads, paid ranking, or contact before acceptance.";

  return {
    title,
    description,
    canonical,
    imageUrl: `${opts.origin}/tradescout-social-preview.png?v=12`,
    keywords: [
      "TradeScout",
      "Connection Without Compromise",
      "local businesses",
      "local products and services",
      "Direct Connect request",
      "free local operating system",
      displayVariant,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .slice(0, 18)
      .join(", "),
  };
}

function renderExplainerCard(card: ExplainerCard) {
  const bullets = card.bullets?.length
    ? `<ul>${card.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
    : "";
  const chips = card.chips?.length
    ? `<p><strong>Key conditions:</strong> ${card.chips.map((chip) => escapeHtml(chip)).join("; ")}</p>`
    : "";

  return `<article>
    ${card.eyebrow ? `<p><strong>${escapeHtml(card.eyebrow)}</strong></p>` : ""}
    <h4>${escapeHtml(card.title)}</h4>
    ${card.body ? `<p>${escapeHtml(card.body)}</p>` : ""}
    ${bullets}
    ${chips}
  </article>`;
}

function renderExplainerTopic(
  chapter: ExplainerChapter,
  topic: ExplainerTopic,
  topicIndex: number
) {
  const topicId = `${chapter.id}-${topic.id}`;
  const moments = topic.moments?.length
    ? `<ol>${topic.moments
        .map(
          (moment) => `<li>
            <h4>${escapeHtml(moment.number)}. ${escapeHtml(moment.title)}</h4>
            <p><strong>For the requester:</strong> ${escapeHtml(moment.requester.title)} ${escapeHtml(moment.requester.body || "")}</p>
            <p><strong>For the business:</strong> ${escapeHtml(moment.business.title)} ${escapeHtml(moment.business.body || "")}</p>
          </li>`
        )
        .join("")}</ol>`
    : "";
  const cards = topic.cards?.length
    ? topic.cards.map((card) => renderExplainerCard(card)).join("")
    : "";
  const features = topic.features?.length
    ? `<ul>${topic.features
        .map(
          (feature) => `<li data-explainer-feature="true">
            <p><strong>${escapeHtml(feature.number)}. ${escapeHtml(feature.name)}</strong> — ${escapeHtml(feature.action)}</p>
            <p>${escapeHtml(feature.description)}</p>
          </li>`
        )
        .join("")}</ul>`
    : "";

  return `<section id="${escapeHtml(topicId)}" data-explainer-topic="true">
    <p>Topic ${String(topicIndex + 1).padStart(2, "0")} of ${String(chapter.topics.length).padStart(2, "0")}</p>
    <h3>${escapeHtml(topic.label)}</h3>
    ${topic.intro ? renderExplainerCard(topic.intro) : ""}
    ${moments}
    ${cards}
    ${features}
  </section>`;
}

function renderFullExplainer() {
  return explainerChapters
    .map(
      (chapter) => `<section id="${escapeHtml(chapter.id)}" data-explainer-chapter="true">
        <p>${escapeHtml(chapter.kicker)}</p>
        <h2>${escapeHtml(chapter.title)}</h2>
        ${chapter.description ? `<p>${escapeHtml(chapter.description)}</p>` : ""}
        ${chapter.topics
          .map((topic, topicIndex) => renderExplainerTopic(chapter, topic, topicIndex))
          .join("")}
        ${chapter.boundary ? `<aside><p>${escapeHtml(chapter.boundary)}</p></aside>` : ""}
      </section>`
    )
    .join("");
}

export async function buildPublicLandingHtml(opts: PublicLandingHtmlOptions): Promise<string> {
  const landingIndexability = resolvePublicLandingIndexability({
    requestPath: opts.requestPath,
    variant: opts.variant,
  });
  const meta = buildMeta({ ...opts, requestPath: landingIndexability.canonicalPath });

  const summary = `
<main data-seo-landing="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
  <article>
    <p style="margin:0 0 1rem;display:flex;align-items:center;gap:.6rem;font-weight:800;">
      <img src="/tradescout-logo-circle.png?v=10" alt="TradeScout logo" width="40" height="40" style="display:block;border-radius:8px;" />
      <span>TradeScout</span>
    </p>
    <h1>Connection Without Compromise</h1>
    <h2>Find what you need. Show what you offer.</h2>
    <p>${escapeHtml(meta.description)}</p>
    <p>Use normal TradeScout pages or open Scout for guidance. Both paths keep the same businesses, requests, jobs, properties, and outcomes connected.</p>
    <p>Recommendations drive TradeScout. Direct Connect sends one protected request only to businesses the requester chooses, and contact information opens after acceptance.</p>
    <h2>TradeScout, in plain language</h2>
    <ol>
      <li><a href="/#scout">Scout</a> helps people understand a need, compare reasonable paths, and prepare a next step.</li>
      <li><a href="/#connect">Requests and contact</a> stay protected until the requester sends and the business accepts.</li>
      <li><a href="/#businesses">The business home</a> keeps offers, proof, availability, requests, work, and outcomes together.</li>
      <li><a href="/#property">Home and property</a> keep useful records and work history with the property.</li>
      <li><a href="/#money">Money</a> explains how TradeScout stays free without selling leads or trust.</li>
      <li><a href="/#impact">Community</a> turns local participation and completed outcomes into useful context.</li>
      <li><a href="/#trust">CVS</a> reflects verified standing and real performance; payment cannot buy it.</li>
      <li><a href="/#system">Every feature</a> shows the connected tools available to requesters and businesses.</li>
    </ol>
    <div data-full-explainer="true">
      ${renderFullExplainer()}
    </div>
    <h2>For people</h2>
    <ol>
      <li>Start with a need, question, product, service, property, or local opportunity.</li>
      <li>Compare useful options and real proof.</li>
      <li>Choose who receives a Direct Connect request.</li>
      <li>Keep the completed outcome for next time.</li>
    </ol>
    <h2>For businesses</h2>
    <ul>
      <li>Claim or create a public business profile.</li>
      <li>Show products, services, availability, proof, and completed work.</li>
      <li>Review chosen requests before contact opens.</li>
      <li>Never buy a resold lead.</li>
    </ul>
    <p><strong>Selective Inheritance</strong> lets a business carry forward useful, provable information from an outside source without importing unsupported claims.</p>
    <h2>Made you look.</h2>
    <p>TradeScout is free forever. Verified TradePartners and local businesses may present relevant offers only when they provide value and quality. Sponsored offers cannot buy CVS, organic ranking, routing, or contact access.</p>
    <p><a href="/pricing#how-tradescout-earns">See how we earn revenue here</a></p>
    <nav aria-label="Public entry actions">
      <a href="/scout?source=landing_scout">Open Scout</a>
      <a href="/find-local-businesses">Find local businesses</a>
      <a href="/direct-connect?source=landing_primary_cta">Make A Request</a>
      <a href="/claim-my-business?source=landing_business">Claim my business</a>
    </nav>
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
    landingIndexability.indexable
      ? '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />'
      : '<meta name="robots" content="noindex,follow" />'
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
  });
  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TradeScout",
    url: opts.origin,
    logo: `${opts.origin}/tradescout-logo.jpg`,
    description:
      "Connection Without Compromise. Find what you need or show what you offer without sold leads, paid ranking, or contact before acceptance.",
    sameAs: ["https://www.thetradescout.com"],
  });
  return html;
}
