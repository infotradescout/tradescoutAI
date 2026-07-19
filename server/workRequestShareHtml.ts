import { eq } from "drizzle-orm";
import { db } from "./db";
import { workRequests } from "@shared/schema";
import { storage } from "./storage";
import { formatTradeScoutTitle } from "@shared/brand";
import {
  buildWorkRequestPreviewTitle,
  buildWorkRequestScopeSummary,
  formatBudgetRange,
} from "./utils/workRequestShare";

type WorkRequestShareHtmlOptions = {
  shareToken: string;
  origin: string;
  templateHtml: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string) {
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `${tag}\n</head>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

export async function buildWorkRequestShareHtml({
  shareToken,
  origin,
  templateHtml,
}: WorkRequestShareHtmlOptions): Promise<string | null> {
  const [requestRow] = await db
    .select()
    .from(workRequests)
    .where(eq(workRequests.shareToken, shareToken))
    .limit(1);

  if (!requestRow || (requestRow.source as string | null) !== "direct_connect") {
    return null;
  }

  const status = String((requestRow as any).status || "").toLowerCase();
  const shareable = status === "open" || status === "routed" || status === "in_progress";
  if (!shareable) {
    await db
      .update(workRequests)
      .set({ shareToken: null, updatedAt: new Date() })
      .where(eq(workRequests.id, String((requestRow as any).id)));
    return null;
  }

  const trade = requestRow.tradeId
    ? await storage.getTradeBySlug(String(requestRow.tradeId))
    : null;
  const county = requestRow.countyFips
    ? await storage.getCountyByFips(String(requestRow.countyFips))
    : null;

  const tradeLabel = String((trade as any)?.name || requestRow.tradeId || "Project");
  const countyName = String((county as any)?.name || "");
  const stateCode = requestRow.stateCode ? String(requestRow.stateCode) : "";
  const locationLabel = countyName
    ? stateCode
      ? `${countyName}, ${stateCode}`
      : countyName
    : stateCode || "Local area";

  const scopeSummary = buildWorkRequestScopeSummary(String(requestRow.description || ""));
  const budgetLabel = formatBudgetRange(requestRow.budgetMin, requestRow.budgetMax);

  const previewTitle = buildWorkRequestPreviewTitle(String(requestRow.title || ""), tradeLabel);
  const title = formatTradeScoutTitle(`${previewTitle} request | TradeScout`);
  const descriptionParts = [
    `${tradeLabel} scope in ${locationLabel}.`,
    scopeSummary || "Shared project scope available.",
    budgetLabel ? `Budget: ${budgetLabel}.` : "",
    "Join TradeScout and complete verification to request access.",
  ].filter(Boolean);
  const description = descriptionParts.join(" ");

  const canonical = `${origin}/r/${encodeURIComponent(shareToken)}`;
  const imageUrl = `${origin}/tradescout-social-preview.png?v=12`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: previewTitle,
    description,
    url: canonical,
    areaServed: locationLabel,
  };

  let html = templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:secure_url"[^>]*>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:type"[^>]*>/i,
    `<meta property="og:image:type" content="image/png" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:width"[^>]*>/i,
    `<meta property="og:image:width" content="1200" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:height"[^>]*>/i,
    `<meta property="og:image:height" content="630" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="TradeScout preview image" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image:alt"[^>]*>/i,
    `<meta name="twitter:image:alt" content="TradeScout preview image" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  html = injectJsonLd(html, structuredData);
  return html;
}
