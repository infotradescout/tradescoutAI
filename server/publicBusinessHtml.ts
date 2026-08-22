import { storage } from "./storage";
import { db } from "./db";
import { counties, users } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { getTradeSeoMatch, slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "./publicationRules";
import { isPublicAndCrawlableBusiness } from "@shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
} from "./publicationBusiness";
import { formatTradeScoutTitle } from "@shared/brand";
import { createProfileGalleryItemShareMetadata } from "@shared/profileGalleryShare";
import { isPubliclyVerifiedProfileOwner } from "./services/ownerConfirmedDirectProfile";
import { normalizePublicCitySlug } from "./publicCityHtml";

type PublicBusinessHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
  gallerySlug?: unknown;
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

function imageMimeType(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function injectFaviconOverride(html: string, imageUrl: string): string {
  const withoutIcons = html
    .replace(/<link rel="icon"[^>]*>\s*/gi, "")
    .replace(/<link rel="apple-touch-icon"[^>]*>\s*/gi, "");
  const tag = `<link rel="icon" href="${escapeHtml(imageUrl)}" />\n    <link rel="apple-touch-icon" href="${escapeHtml(imageUrl)}" />`;
  return withoutIcons.replace("</head>", `${tag}\n</head>`);
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
  seoMeta?: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
  } | null;
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
  ]
    .filter(Boolean)
    .join(" ");

  // Google typically truncates meta description snippets around ~155-160
  // characters -- cap so descriptions never get cut off mid-word.
  const description = (rawDescription.length > 0 ? rawDescription : fallbackBits)
    .replace(/\s+/g, " ")
    .slice(0, 160);

  const canonical = `${args.origin}/business/${encodeURIComponent(args.slug)}`;
  const customImageUrl = args.seoMeta?.imageUrl || null;
  const imageUrl = customImageUrl || `${args.origin}/tradescout-social-preview.png?v=12`;
  const imageType = imageMimeType(imageUrl);
  const imageAlt = `${name} preview`;
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

  const imageWidth = customImageUrl ? args.seoMeta?.imageWidth || undefined : 1200;
  const imageHeight = customImageUrl ? args.seoMeta?.imageHeight || undefined : 630;

  return {
    title,
    description,
    canonical,
    imageUrl,
    imageType,
    imageAlt,
    imageWidth,
    imageHeight,
    customImageUrl,
    keywords,
  };
}

export async function buildPublicBusinessHtml({
  slug,
  origin,
  templateHtml,
  gallerySlug,
}: PublicBusinessHtmlOptions): Promise<string | null> {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug) return null;

  // First: published business profile (stored in user preferences for now).
  const published = await storage.getBusinessProfileBySlug(safeSlug);
  if (
    published?.visibility === "public" &&
    isPubliclyVerifiedProfileOwner({
      ownerVerifiedBadge: published.verifiedBadge,
      ownerVerificationStatus: published.verificationStatus,
    })
  ) {
    const baseMeta = buildBusinessMeta({
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
    const galleryMeta = createProfileGalleryItemShareMetadata({
      profileName: published.name,
      profileUrl: `${origin}/business/${encodeURIComponent(safeSlug)}`,
      assetOrigin: origin,
      contentBlocks: published.contentBlocks,
      itemSlug: gallerySlug,
    });
    const meta = galleryMeta
      ? {
          ...baseMeta,
          title: formatTradeScoutTitle(galleryMeta.title),
          description: galleryMeta.description,
          canonical: galleryMeta.canonical,
          imageUrl: galleryMeta.imageUrl,
          imageType: imageMimeType(galleryMeta.imageUrl),
          imageAlt: galleryMeta.imageAlt,
          imageWidth: undefined,
          imageHeight: undefined,
          customImageUrl: null,
        }
      : baseMeta;

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
    const galleryJsonLd = galleryMeta
      ? {
          "@context": "https://schema.org",
          "@type": "ImageObject",
          name: galleryMeta.itemTitle,
          description: galleryMeta.description,
          contentUrl: galleryMeta.imageUrl,
          url: galleryMeta.canonical,
        }
      : null;

    let html = templateHtml;
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
    html = upsertTag(
      html,
      /<meta name="tradescout-business-slug"[^>]*>/i,
      `<meta name="tradescout-business-slug" content="${escapeHtml(String(published.slug || safeSlug))}" />`
    );
    html = upsertTag(
      html,
      /<meta name="tradescout-business-entity-type"[^>]*>/i,
      '<meta name="tradescout-business-entity-type" content="business_profile" />'
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
      `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:type"[^>]*>/i,
      `<meta property="og:type" content="${galleryMeta ? "article" : "profile"}" />`
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
      /<meta property="og:image:secure_url"[^>]*>/i,
      `<meta property="og:image:secure_url" content="${escapeHtml(meta.imageUrl)}" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:image:type"[^>]*>/i,
      `<meta property="og:image:type" content="${escapeHtml(meta.imageType)}" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
    );
    if (Number.isFinite(meta.imageWidth) && Number.isFinite(meta.imageHeight)) {
      html = upsertTag(
        html,
        /<meta property="og:image:width"[^>]*>/i,
        `<meta property="og:image:width" content="${meta.imageWidth}" />`
      );
      html = upsertTag(
        html,
        /<meta property="og:image:height"[^>]*>/i,
        `<meta property="og:image:height" content="${meta.imageHeight}" />`
      );
    } else if (galleryMeta) {
      html = html
        .replace(/<meta property="og:image:width"[^>]*>\s*/i, "")
        .replace(/<meta property="og:image:height"[^>]*>\s*/i, "");
    }
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
      /<meta name="twitter:image:alt"[^>]*>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
    );
    html = upsertTag(
      html,
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
    );
    if (meta.customImageUrl) {
      html = injectFaviconOverride(html, meta.customImageUrl);
    }

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
    const citySlug =
      published.city && published.stateCode ? normalizePublicCitySlug(published.city) : "";
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
        return `<section data-block-type=\"proof\">${title}${body}${secondary}</section>`;
      if (type === "cta")
        return `<section data-block-type=\"cta\">${title}${body}${
          block?.ctaLabel ? `<p>${escapeHtml(String(block.ctaLabel))}</p>` : ""
        }</section>`;
      if (type === "gallery")
        return `<section data-block-type=\"gallery\">${title}${body}</section>`;
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
    const trustSummary = [
      published.verificationStatus ? `Verification: ${published.verificationStatus}.` : "",
      published.addressVerified ? "Address verified on TradeScout." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const summary = `
<main data-seo-business="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(published.name)}</h1>
    ${galleryMeta ? `<section data-seo-business-gallery="${escapeHtml(galleryMeta.itemSlug)}"><h2>${escapeHtml(galleryMeta.itemTitle)}</h2><p>${escapeHtml(galleryMeta.description)}</p></section>` : ""}
    ${published.headline ? `<p><strong>${escapeHtml(String(published.headline))}</strong></p>` : ""}
    <p>${escapeHtml(meta.description)}</p>
    ${servicesSummary.length > 0 ? `<p><strong>Services:</strong> ${escapeHtml(servicesSummary.join(", "))}</p>` : ""}
    ${(published.serviceAreas || []).length > 0 ? `<p><strong>Service areas:</strong> ${escapeHtml((published.serviceAreas || []).slice(0, 8).join(", "))}</p>` : ""}
    ${trustSummary ? `<p>${escapeHtml(trustSummary)}</p>` : ""}
    ${cityHref ? `<p><a href="${cityHref}">Browse ${escapeHtml(String(published.city || ""))}</a></p>` : ""}
    ${countyHref ? `<p><a href="${countyHref}">Browse ${escapeHtml(String(published.countyName || ""))}</a></p>` : ""}
    ${contentBlocks.length > 0 ? contentBlocks.map((block: any) => renderSeoContentBlock(block)).join("") : ""}
    <p>${escapeHtml(bookingSummary)}</p>
    ${bookingRows.length > 0 ? `<ul>${bookingRows.map((row: string) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>` : ""}
  </article>
</main>`;

    html = injectSummary(html, summary);
    html = injectJsonLd(html, jsonLd);
    if (galleryJsonLd) html = injectJsonLd(html, galleryJsonLd);
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

  const isStale = !canServePublicBusinessDetail({ publication: pub, tier });
  const verificationLabel = isStale ? "Inactive listing" : "Directory listing";
  const meta = buildBusinessMeta({
    origin,
    slug: safeSlug,
    name: String((directory as any).name || safeSlug),
    headline: isStale ? null : tagline || null,
    description: isStale
      ? "You're here early. This listing is being refreshed and will be back soon."
      : description || tagline || null,
    countyName: isStale ? null : countyNames[0] || null,
    stateCode: isStale ? null : stateCode,
    categories: isStale ? [] : categories,
    serviceAreas: isStale ? [] : countyNames,
    services: isStale ? [] : categories,
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
      profileData.publicWebsiteEnabled === true &&
      typeof profileData.website === "string" &&
      profileData.website.trim()
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
  const citySlug = rawCity && stateCode ? normalizePublicCitySlug(rawCity) : "";
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
  </article>
</main>`;

  if (isStale) {
    const staleSummary = `
<main data-seo-business="stale" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(String((directory as any).name || safeSlug))}</h1>
    <p>You're here early. This listing is being refreshed and will be back soon.</p>
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
