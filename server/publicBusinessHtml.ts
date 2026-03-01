import { storage } from "./storage";
import { db } from "./db";
import { counties } from "@shared/schema";
import { inArray } from "drizzle-orm";

type PublicBusinessHtmlOptions = {
  slug: string;
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

function injectSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

function buildBusinessMeta(args: {
  origin: string;
  slug: string;
  name: string;
  description?: string | null;
  countyName?: string | null;
  stateCode?: string | null;
  categories?: string[];
  serviceAreas?: string[];
  verificationLabel?: string;
}) {
  const name = args.name.trim();
  const place =
    args.countyName && args.stateCode ? ` in ${args.countyName}, ${args.stateCode}` : "";
  const title = `${name}${place} | TradeScout`;

  const rawDescription = String(args.description || "").trim();
  const fallbackBits = [
    args.categories?.length ? `Categories: ${args.categories.slice(0, 4).join(", ")}.` : "",
    args.serviceAreas?.length ? `Service areas: ${args.serviceAreas.slice(0, 6).join(", ")}.` : "",
    args.verificationLabel ? `Verification: ${args.verificationLabel}.` : "",
    "Contact is protected through TradeScout Direct Connect.",
  ]
    .filter(Boolean)
    .join(" ");

  const description = (rawDescription.length > 0 ? rawDescription : fallbackBits)
    .replace(/\s+/g, " ")
    .slice(0, 300);

  const canonical = `${args.origin}/business/${encodeURIComponent(args.slug)}`;
  const imageUrl = `${args.origin}/tradescout-logo.png?v=3`;
  const keywords = [
    name,
    args.countyName || "",
    args.stateCode || "",
    ...(args.categories || []),
    "TradeScout",
    "local services",
  ]
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
    .slice(0, 14)
    .join(", ");

  return { title, description, canonical, imageUrl, keywords };
}

export async function buildPublicBusinessHtml({
  slug,
  origin,
  templateHtml,
}: PublicBusinessHtmlOptions): Promise<string | null> {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug) return null;

  // First: published business profile (stored in user preferences for now).
  const published = await storage.getBusinessProfileBySlug(safeSlug);
  if (published) {
    const meta = buildBusinessMeta({
      origin,
      slug: safeSlug,
      name: published.name,
      description: published.description,
      countyName: published.countyName,
      stateCode: published.stateCode,
      serviceAreas: published.serviceAreas || [],
      verificationLabel: published.verificationStatus || undefined,
    });

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: published.name,
      description: meta.description,
      url: meta.canonical,
      areaServed: (published.serviceAreas || []).slice(0, 12),
      address: published.stateCode
        ? {
            "@type": "PostalAddress",
            addressRegion: published.stateCode,
            addressLocality: published.countyName || undefined,
            addressCountry: "US",
          }
        : undefined,
    };

    let html = templateHtml;
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
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
      `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
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
      /<meta property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`
    );
    html = upsertTag(
      html,
      /<meta name="twitter:card"[^>]*>/i,
      `<meta name="twitter:card" content="summary_large_image" />`
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
    html = upsertTag(
      html,
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
    );

    const summary = `
<main data-seo-business="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(published.name)}</h1>
    <p>${escapeHtml(meta.description)}</p>
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

    html = injectSummary(html, summary);
    html = injectJsonLd(html, jsonLd);
    return html;
  }

  // Second: directory/claimable business entry (businesses table).
  const directory = await storage.getBusinessBySlugPublic(safeSlug);
  if (!directory || (directory as any).status !== ("active" as any)) return null;

  const profileData: any = (directory as any).profileData || {};
  const tagline = typeof profileData.tagline === "string" ? profileData.tagline.trim() : "";
  const description =
    typeof profileData.description === "string" ? profileData.description.trim() : "";
  const category = typeof profileData.category === "string" ? profileData.category.trim() : "";
  const categories = category ? [category] : [];

  const countyIds = await storage.getBusinessCountyIds(directory.id);
  const countyRows = countyIds.length
    ? await db
        .select({
          name: counties.name,
          stateCode: counties.stateCode,
        })
        .from(counties)
        .where(inArray(counties.id, countyIds))
    : [];
  const countyNames = countyRows.map((row) => String(row.name || "")).filter(Boolean);
  const stateCode = countyRows[0]?.stateCode ? String(countyRows[0].stateCode) : null;

  const verificationLabel = "Directory listing (unclaimed)";
  const meta = buildBusinessMeta({
    origin,
    slug: safeSlug,
    name: String((directory as any).name || safeSlug),
    description: description || tagline || null,
    countyName: countyNames[0] || null,
    stateCode,
    categories,
    serviceAreas: countyNames,
    verificationLabel,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: String((directory as any).name || safeSlug),
    description: meta.description,
    url: meta.canonical,
    category: categories.length ? categories : undefined,
    areaServed: countyNames.slice(0, 12),
    address: stateCode
      ? {
          "@type": "PostalAddress",
          addressRegion: stateCode,
          addressLocality: countyNames[0] || undefined,
          addressCountry: "US",
        }
      : undefined,
  };

  let html = templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
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
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
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
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
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
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );

  const categoriesSummary = categories.length ? categories.join(", ") : "";
  const areasSummary = countyNames.slice(0, 8).join(", ");

  const summary = `
<main data-seo-business="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(String((directory as any).name || safeSlug))}</h1>
    <p>${escapeHtml(meta.description)}</p>
    ${categoriesSummary ? `<p><strong>Category:</strong> ${escapeHtml(categoriesSummary)}</p>` : ""}
    ${areasSummary ? `<p><strong>Service areas:</strong> ${escapeHtml(areasSummary)}</p>` : ""}
    <p><strong>Verification:</strong> ${escapeHtml(verificationLabel)}</p>
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
