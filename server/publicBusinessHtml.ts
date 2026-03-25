import { storage } from "./storage";
import { db } from "./db";
import { counties, users } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { getTradeSeoMatch, slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "./publicationRules";
import { isPublicAndCrawlableBusiness } from "@shared/publication";
import {
  buildPublicBusinessSignals,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
} from "./publicationBusiness";
import { formatTradeScoutTitle } from "@shared/brand";

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

function slugifyCityName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

function applyNoIndex(html: string) {
  return upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    `<meta name="robots" content="noindex,nofollow" />`
  );
}

function buildBusinessMeta(args: {
  origin: string;
  slug: string;
  name: string;
  headline?: string | null;
  description?: string | null;
  seoMeta?: { title?: string | null; description?: string | null; imageUrl?: string | null } | null;
  countyName?: string | null;
  stateCode?: string | null;
  categories?: string[];
  serviceAreas?: string[];
  services?: string[];
  verificationLabel?: string;
}) {
  const name = args.name.trim();
  const place =
    args.countyName && args.stateCode ? ` in ${args.countyName}, ${args.stateCode}` : "";
  const title = formatTradeScoutTitle(args.seoMeta?.title || `${name}${place} | TradeScout`);

  const rawDescription = String(
    args.seoMeta?.description || args.description || args.headline || ""
  ).trim();
  const fallbackBits = [
    args.categories?.length ? `Categories: ${args.categories.slice(0, 4).join(", ")}.` : "",
    args.services?.length ? `Services: ${args.services.slice(0, 6).join(", ")}.` : "",
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
  const imageUrl = args.seoMeta?.imageUrl || `${args.origin}/tradescout-social-preview.png?v=10`;
  const keywords = [
    name,
    args.countyName || "",
    args.stateCode || "",
    ...(args.categories || []),
    ...(args.services || []),
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
      headline: published.headline,
      description: published.description,
      seoMeta: published.seoMeta || null,
      countyName: published.countyName,
      stateCode: published.stateCode,
      serviceAreas: published.serviceAreas || [],
      services: published.services || [],
      verificationLabel: published.verificationStatus || undefined,
    });

    const jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: published.name,
      description: meta.description,
      url: meta.canonical,
      slogan: published.headline || undefined,
      areaServed: (published.serviceAreas || []).slice(0, 12),
      makesOffer: Array.isArray(published.services)
        ? published.services.slice(0, 8).map((service) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: String(service),
            },
          }))
        : undefined,
      sameAs: published.website ? [published.website] : undefined,
      hasCredential: published.verificationStatus
        ? {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "Verification",
            name: String(published.verificationStatus),
          }
        : undefined,
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

    const countySlug =
      published.countyName && published.stateCode
        ? slugifyCountyName(
            published.countyName.replace(/\s+County$/i, "").trim() || published.countyName
          )
        : "";
    const countyHref =
      published.countyName && published.stateCode && countySlug
        ? `/county/${encodeURIComponent(published.stateCode.toLowerCase())}/${encodeURIComponent(
            countySlug
          )}`
        : "";
    const citySlug = published.city && published.stateCode ? slugifyCityName(published.city) : "";
    const cityHref =
      citySlug && published.stateCode
        ? `/city/${encodeURIComponent(published.stateCode.toLowerCase())}/${encodeURIComponent(
            citySlug
          )}`
        : "";

    const servicesSummary = Array.isArray(published.services)
      ? published.services.filter(Boolean).slice(0, 8)
      : [];
    const contentBlocks = Array.isArray(published.contentBlocks)
      ? published.contentBlocks
          .filter((block: any) => block && typeof block === "object")
          .slice(0, 6)
      : [];
    const renderSeoContentBlock = (block: any) => {
      const type = String(block?.type || "text").toLowerCase();
      const title = block?.title ? `<h2>${escapeHtml(String(block.title))}</h2>` : "";
      const body = block?.body ? `<p>${escapeHtml(String(block.body))}</p>` : "";
      const secondary = block?.secondaryBody
        ? `<p>${escapeHtml(String(block.secondaryBody))}</p>`
        : "";
      if (type === "faq")
        return `<section data-block-type=\"faq\">${title}${body}${secondary}</section>`;
      if (type === "proof")
        return `<section data-block-type=\"proof\">${title}${body}${secondary}<p>Trust signal published on TradeScout.</p></section>`;
      if (type === "cta")
        return `<section data-block-type=\"cta\">${title}${body}<p>${escapeHtml(String(block?.ctaLabel || "Contact through TradeScout Direct Connect."))}</p></section>`;
      if (type === "gallery")
        return `<section data-block-type=\"gallery\">${title}${body}${block?.imageUrl ? `<p>Featured image available.</p>` : ""}</section>`;
      if (type === "hero") return `<section data-block-type=\"hero\">${title}${body}</section>`;
      return `<section data-block-type=\"text\">${title}${body}</section>`;
    };
    const bookingRows =
      published.bookingConfig?.pricingTableEnabled &&
      Array.isArray(published.bookingConfig?.pricingRows)
        ? published.bookingConfig.pricingRows
            .map((row: any) =>
              [String(row?.name || "").trim(), String(row?.priceLabel || "").trim()]
                .filter((part) => part.length > 0)
                .join(": ")
            )
            .filter((line: string) => line.length > 0)
            .slice(0, 6)
        : [];
    const bookingSummary =
      published.bookingConfig?.enabled === true
        ? published.bookingConfig?.paidBookings
          ? `Bookings enabled. Paid booking deposit: $${Number(published.bookingConfig?.bookingPriceUsd || 0).toFixed(2)}.`
          : "Bookings enabled."
        : "Bookings not enabled.";
    const websiteReadySummary =
      published.customDomainVerification?.state === "verified"
        ? "This public TradeScout business page has a connected custom domain and can function as the business website."
        : "This public TradeScout business page is website-ready by default and can be connected to a custom domain.";
    const trustSummary = [
      published.verificationStatus
        ? `Verification: ${published.verificationStatus}.`
        : "Verification details available on TradeScout.",
      published.addressVerified
        ? "Address verified on TradeScout."
        : "Address verification can improve trust on this page.",
      Array.isArray(published.services) && published.services.length > 0
        ? `Services are listed directly on this business page.`
        : "Business services can be added directly on this page.",
    ].join(" ");

    const summary = `
<main data-seo-business="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(published.name)}</h1>
    ${published.headline ? `<p><strong>${escapeHtml(String(published.headline))}</strong></p>` : ""}
    <p>${escapeHtml(meta.description)}</p>
    ${servicesSummary.length > 0 ? `<p><strong>Services:</strong> ${escapeHtml(servicesSummary.join(", "))}</p>` : ""}
    ${(published.serviceAreas || []).length > 0 ? `<p><strong>Service areas:</strong> ${escapeHtml((published.serviceAreas || []).slice(0, 8).join(", "))}</p>` : ""}
    <p>${escapeHtml(websiteReadySummary)}</p>
    <p>${escapeHtml(trustSummary)}</p>
    ${cityHref ? `<p><a href="${cityHref}">Browse ${escapeHtml(String(published.city || ""))}</a></p>` : ""}
    ${countyHref ? `<p><a href="${countyHref}">Browse ${escapeHtml(String(published.countyName || ""))}</a></p>` : ""}
    ${contentBlocks.length > 0 ? contentBlocks.map((block: any) => renderSeoContentBlock(block)).join("") : ""}
    <p>${escapeHtml(bookingSummary)}</p>
    ${bookingRows.length > 0 ? `<ul>${bookingRows.map((row: string) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>` : ""}
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
  const tradeMatch = category ? getTradeSeoMatch(category) : null;

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

  const ownerUserId = (directory as any).ownerUserId
    ? String((directory as any).ownerUserId)
    : null;
  let ownerVerificationStatus: string | null = null;
  let ownerAddressVerified: boolean | null = null;
  if (ownerUserId) {
    const ownerRows = await db
      .select({
        verificationStatus: users.verificationStatus,
        addressVerified: users.addressVerified,
      })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);
    ownerVerificationStatus = ownerRows[0]?.verificationStatus
      ? String(ownerRows[0].verificationStatus)
      : null;
    ownerAddressVerified =
      typeof ownerRows[0]?.addressVerified === "boolean" ? ownerRows[0].addressVerified : null;
  }

  const tier = derivePublicationTier({
    ownerUserId,
    claimStatus: String((directory as any).claimStatus || ""),
    ownerVerificationStatus,
    ownerAddressVerified,
  });
  const tradeSlug = deriveTradeSlugFromProfileData(profileData);
  const rules = await getPublicationRules();
  const pub = isPublicAndCrawlableBusiness(
    buildPublicBusinessSignals({
      id: String((directory as any).id),
      name: String((directory as any).name || ""),
      slug: String((directory as any).slug || ""),
      updatedAt:
        (directory as any).updatedAt instanceof Date ? (directory as any).updatedAt : new Date(),
      publicDiscoveryEnabled: Boolean((directory as any).publicDiscoveryEnabled),
      stateCode,
      countyName: countyNames[0] || null,
      city: typeof profileData.city === "string" ? profileData.city : null,
      tradeSlug,
      tier,
    }),
    rules,
    new Date()
  );

  const isStale = !pub.ok;
  const verificationLabel = isStale ? "Inactive listing" : "Directory listing";
  const meta = buildBusinessMeta({
    origin,
    slug: safeSlug,
    name: String((directory as any).name || safeSlug),
    headline: tagline || null,
    description: isStale
      ? "This listing is inactive or out of date."
      : description || tagline || null,
    countyName: countyNames[0] || null,
    stateCode,
    categories,
    serviceAreas: countyNames,
    services: categories,
    verificationLabel,
  });

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: String((directory as any).name || safeSlug),
    description: meta.description,
    url: meta.canonical,
    category: categories.length ? categories : undefined,
    areaServed: countyNames.slice(0, 12),
    sameAs:
      typeof profileData.website === "string" && profileData.website.trim()
        ? [profileData.website.trim()]
        : undefined,
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Verification",
      name: verificationLabel,
    },
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

  const countySlug =
    countyNames[0] && stateCode
      ? slugifyCountyName(
          String(countyNames[0])
            .replace(/\s+County$/i, "")
            .trim() || String(countyNames[0])
        )
      : "";
  const countyHref =
    countySlug && stateCode
      ? `/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(countySlug)}`
      : "";
  const tradeHref =
    tradeMatch && stateCode && countySlug
      ? `/trade/${encodeURIComponent(tradeMatch.canonicalSlug)}/${encodeURIComponent(
          stateCode.toLowerCase()
        )}/${encodeURIComponent(countySlug)}`
      : "";
  const rawCity = typeof profileData.city === "string" ? profileData.city.trim() : "";
  const citySlug = rawCity && stateCode ? slugifyCityName(rawCity) : "";
  const cityHref =
    citySlug && stateCode
      ? `/city/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(citySlug)}`
      : "";

  const summary = `
<main data-seo-business="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(String((directory as any).name || safeSlug))}</h1>
    <p>${escapeHtml(meta.description)}</p>
    ${categoriesSummary ? `<p><strong>Category:</strong> ${escapeHtml(categoriesSummary)}</p>` : ""}
    ${areasSummary ? `<p><strong>Service areas:</strong> ${escapeHtml(areasSummary)}</p>` : ""}
    ${cityHref ? `<p><a href="${cityHref}">Browse ${escapeHtml(rawCity)}</a></p>` : ""}
    ${
      countyHref
        ? `<p><a href="${countyHref}">Browse ${escapeHtml(String(countyNames[0] || ""))}</a></p>`
        : ""
    }
    ${
      tradeHref && tradeMatch
        ? `<p><a href="${tradeHref}">Browse ${escapeHtml(tradeMatch.trade.name)} in ${escapeHtml(
            String(countyNames[0] || "")
          )}</a></p>`
        : ""
    }
    <p><strong>Verification:</strong> ${escapeHtml(verificationLabel)}</p>
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  if (isStale) {
    const staleSummary = `
<main data-seo-business="stale" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(String((directory as any).name || safeSlug))}</h1>
    <p>This listing is inactive or out of date and is not shown in public discovery.</p>
    <p>Contact remains protected through TradeScout Direct Connect.</p>
  </article>
</main>`;
    html = applyNoIndex(html);
    html = injectSummary(html, staleSummary);
    return html;
  }

  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
