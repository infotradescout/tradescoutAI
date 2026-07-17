import { storage } from "./storage";
import { formatTradeScoutTitle } from "@shared/brand";
import { resolveProfileItemShareMetadata } from "./profileItemShareMetadata";
import { createProfileGalleryItemShareMetadata } from "@shared/profileGalleryShare";
import type { ProfileInventoryItemShareMetadata } from "@shared/profileItemShare";
import type { ProfileGalleryItemShareMetadata } from "@shared/profileGalleryShare";

// Google typically truncates meta description snippets around ~155-160
// characters -- cap so descriptions never get cut off mid-word.
const MAX_DESCRIPTION_LENGTH = 160;

function capDescriptionLength(description: string): string {
  if (description.length <= MAX_DESCRIPTION_LENGTH) return description;
  const truncated = description.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd();
  return `${truncated}…`;
}

type PublicProfileHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
  itemSlug?: unknown;
  itemPhoto?: unknown;
  gallerySlug?: unknown;
};

type PublicProfileEarlyHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
};

type PublicProfileItemShareMetadata =
  | ProfileInventoryItemShareMetadata
  | ProfileGalleryItemShareMetadata;

type PublicProfileData = {
  profile: {
    id: string;
    slug: string;
    displayName: string;
    headline?: string | null;
    roleContext?: string | null;
    servicesDescription?: string | null;
    seoMeta?: {
      title?: string;
      description?: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      // Separate from imageUrl (the OG/share banner) -- browser tab icons
      // need a square mark, not a wide 1200x630 crop. Falls back to imageUrl
      // when unset so existing profiles keep working.
      faviconUrl?: string;
      customDomain?: string;
    };
    profileBooking?: {
      enabled?: boolean;
      paidBookings?: boolean;
      bookingPriceUsd?: number;
      pricingTableEnabled?: boolean;
      pricingRows?: Array<{ name?: string; priceLabel?: string }>;
    } | null;
    contentBlocks?: Array<{ type: string; data?: Record<string, any> }> | null;
  };
  business?: {
    name?: string;
    categories?: string[];
    serviceAreas?: string[];
    tradePartner?: boolean;
    website?: string;
    address?: string;
    city?: string;
    stateCode?: string;
    zipCode?: string;
  } | null;
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

// Business/profile pages should show their own icon in the browser tab
// instead of the generic TradeScout icon -- only when they actually have a
// custom share image set, so we never blank out the real TradeScout icon.
function injectFaviconOverride(html: string, imageUrl: string): string {
  const withoutIcons = html
    .replace(/<link rel="icon"[^>]*>\s*/gi, "")
    .replace(/<link rel="apple-touch-icon"[^>]*>\s*/gi, "");
  const tag = `<link rel="icon" href="${escapeHtml(imageUrl)}" />\n    <link rel="apple-touch-icon" href="${escapeHtml(imageUrl)}" />`;
  return withoutIcons.replace("</head>", `${tag}\n</head>`);
}

// The client-side router only recognizes profile pages by URL path
// (/u/:slug), so when this profile is served at its own custom domain's
// root -- no /u/:slug in the path at all -- React has no way to know which
// profile to render post-hydration and falls through to the generic
// landing page. This tells it directly.
function injectCustomDomainProfileSlug(html: string, slug: string): string {
  const script = `<script>window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__=${JSON.stringify(slug)};</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectProfileSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

export function buildPublicProfileEarlyHtml({
  slug,
  origin,
  templateHtml,
}: PublicProfileEarlyHtmlOptions): string {
  const title = formatTradeScoutTitle("You're here early");
  const description =
    "This profile isn't public yet, or the link has changed. Check back soon while it gets ready.";
  const canonical = `${origin}/u/${encodeURIComponent(slug)}`;
  let html = templateHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    `<meta name="robots" content="noindex,follow" />`
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
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );

  const earlySummary = `
<main data-public-profile-state="early" style="padding:3rem 1rem;max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <h1>You're here early</h1>
  <p>This profile isn't public yet, or the link has changed.</p>
  <p>Check back soon, or explore TradeScout while it gets ready.</p>
  <p><a href="/">Explore TradeScout</a></p>
</main>`;

  return injectProfileSummary(html, earlySummary);
}

function buildFaqJsonLd(profile: PublicProfileData) {
  const faqBlock = (profile.profile.contentBlocks || []).find((block) => block?.type === "faq");
  const faqs: Array<{ question?: string; answer?: string }> = Array.isArray(faqBlock?.data?.faqs)
    ? faqBlock!.data!.faqs
    : [];
  const validFaqs = faqs.filter(
    (faq) => typeof faq.question === "string" && typeof faq.answer === "string"
  );
  if (validFaqs.length === 0) return null;

  return {
    "@type": "FAQPage",
    mainEntity: validFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// A profile with a verified custom domain is canonically served there, not
// under /u/:slug -- Google and structured-data consumers should be pointed
// at the business's own domain regardless of which host the request came in on.
function resolveProfileUrl(profile: PublicProfileData, origin: string): string {
  const customDomain = profile.profile.seoMeta?.customDomain?.trim().toLowerCase();
  if (customDomain) return `https://${customDomain}/`;
  return `${origin}/u/${encodeURIComponent(profile.profile.slug)}`;
}

function withProfileItemJsonLd(
  baseJsonLd: Record<string, any>,
  itemShare: PublicProfileItemShareMetadata | null,
  displayName: string
) {
  if (!itemShare) return baseJsonLd;

  const baseGraph = Array.isArray(baseJsonLd["@graph"])
    ? baseJsonLd["@graph"]
    : [Object.fromEntries(Object.entries(baseJsonLd).filter(([key]) => key !== "@context"))];

  const itemJsonLd =
    itemShare.itemType === "inventory"
      ? {
          "@type": "Product",
          "@id": `${itemShare.canonical}#product`,
          name: itemShare.itemName,
          description: itemShare.description,
          image: [itemShare.imageUrl],
          category: itemShare.category || undefined,
          url: itemShare.canonical,
          brand: {
            "@type": "Organization",
            name: displayName,
          },
        }
      : {
          "@type": "ImageObject",
          "@id": `${itemShare.canonical}#image`,
          name: itemShare.itemTitle,
          description: itemShare.description,
          contentUrl: itemShare.imageUrl,
          url: itemShare.canonical,
          creator: {
            "@type": "Organization",
            name: displayName,
          },
        };

  return {
    "@context": "https://schema.org",
    "@graph": [...baseGraph, itemJsonLd],
  };
}

function buildJsonLd(
  profile: PublicProfileData,
  origin: string,
  itemShare: PublicProfileItemShareMetadata | null
) {
  const profileUrl = resolveProfileUrl(profile, origin);
  const displayName = profile.business?.name?.trim() || profile.profile.displayName;
  const description =
    profile.profile.seoMeta?.description ||
    profile.profile.headline ||
    profile.profile.servicesDescription ||
    profile.profile.roleContext ||
    "TradeScout public profile";

  const faqJsonLd = buildFaqJsonLd(profile);

  if (profile.business?.name) {
    const isTradePartner = profile.business.tradePartner === true;
    const localBusiness: Record<string, any> = {
      "@type": "LocalBusiness",
      name: displayName,
      description,
      url: profileUrl,
      areaServed: profile.business.serviceAreas?.slice(0, 10) || undefined,
      category: profile.business.categories?.slice(0, 5) || undefined,
    };

    // Website and location may remain crawlable, but phone is deliberately
    // excluded. Express Direct Connect reveals it only after an explicit CTA
    // click and Call decision, preventing passive scraping from page source.
    if (isTradePartner) {
      if (profile.business.website) {
        localBusiness.sameAs = [profile.business.website];
      }
      if (profile.business.address || profile.business.city || profile.business.stateCode) {
        localBusiness.address = {
          "@type": "PostalAddress",
          streetAddress: profile.business.address || undefined,
          addressLocality: profile.business.city || undefined,
          addressRegion: profile.business.stateCode || undefined,
          postalCode: profile.business.zipCode || undefined,
          addressCountry: "US",
        };
      }
    }

    const baseJsonLd = !faqJsonLd
      ? { "@context": "https://schema.org", ...localBusiness }
      : {
          "@context": "https://schema.org",
          "@graph": [localBusiness, faqJsonLd],
        };
    return withProfileItemJsonLd(baseJsonLd, itemShare, displayName);
  }

  return withProfileItemJsonLd(
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: displayName,
      description,
      jobTitle: profile.profile.roleContext || undefined,
      url: profileUrl,
    },
    itemShare,
    displayName
  );
}

function buildMeta(
  profile: PublicProfileData,
  origin: string,
  itemShare: PublicProfileItemShareMetadata | null
) {
  const displayName = profile.business?.name?.trim() || profile.profile.displayName;
  const title = formatTradeScoutTitle(
    itemShare?.title || profile.profile.seoMeta?.title || `${displayName} | TradeScout`
  );
  const description = capDescriptionLength(
    itemShare?.description ||
      profile.profile.seoMeta?.description ||
      profile.profile.headline ||
      profile.profile.servicesDescription ||
      profile.profile.roleContext ||
      "TradeScout public profile"
  );
  const profileImageUrl = profile.profile.seoMeta?.imageUrl || null;
  const imageUrl =
    itemShare?.imageUrl || profileImageUrl || `${origin}/tradescout-social-preview.png?v=12`;
  const faviconUrl = profile.profile.seoMeta?.faviconUrl || profileImageUrl;
  const canonical = itemShare?.canonical || resolveProfileUrl(profile, origin);
  const itemName =
    itemShare?.itemType === "inventory"
      ? itemShare.itemName
      : itemShare?.itemType === "gallery"
        ? itemShare.itemTitle
        : "";
  const keywords = [
    itemName,
    itemShare?.itemType === "inventory" ? itemShare.category || "" : "",
    displayName,
    profile.profile.roleContext || "",
    ...(profile.business?.categories || []),
    "TradeScout profile",
    "local services",
  ]
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
    .slice(0, 12)
    .join(", ");

  return {
    title,
    description,
    imageUrl,
    imageType: imageMimeType(imageUrl),
    imageAlt: itemShare?.imageAlt || `${displayName} preview`,
    imageWidth: itemShare
      ? undefined
      : profileImageUrl
        ? profile.profile.seoMeta?.imageWidth
        : 1200,
    imageHeight: itemShare
      ? undefined
      : profileImageUrl
        ? profile.profile.seoMeta?.imageHeight
        : 630,
    faviconUrl,
    canonical,
    keywords,
    ogType:
      itemShare?.itemType === "inventory"
        ? "product"
        : itemShare?.itemType === "gallery"
          ? "article"
          : "profile",
  };
}

export async function buildPublicProfileHtml({
  slug,
  origin,
  templateHtml,
  itemSlug,
  itemPhoto,
  gallerySlug,
}: PublicProfileHtmlOptions): Promise<string | null> {
  const profileRecord = await storage.getProfileBySlugPublic(slug);
  if (!profileRecord) return null;

  const businessRecord = profileRecord.businessId
    ? await storage.getBusinessPublicById(profileRecord.businessId)
    : null;

  const data: PublicProfileData = {
    profile: {
      id: profileRecord.id,
      slug: profileRecord.slug,
      displayName: profileRecord.displayName,
      headline: profileRecord.headline,
      roleContext: profileRecord.roleContext,
      servicesDescription: profileRecord.servicesDescription || undefined,
      seoMeta: profileRecord.seoMeta || undefined,
      profileBooking: profileRecord.profileBooking || undefined,
      contentBlocks: Array.isArray(profileRecord.contentBlocks)
        ? profileRecord.contentBlocks
        : undefined,
    },
    business: businessRecord
      ? {
          name: businessRecord.name,
          categories: businessRecord.categories || [],
          serviceAreas: businessRecord.serviceAreas || [],
          tradePartner: businessRecord.tradePartner === true,
          website: businessRecord.website,
          address: businessRecord.address,
          city: businessRecord.city,
          stateCode: businessRecord.stateCode,
          zipCode: businessRecord.zipCode,
        }
      : null,
  };

  const displayName = data.business?.name?.trim() || data.profile.displayName;
  const inventoryItemShare = resolveProfileItemShareMetadata({
    profileSlug: data.profile.slug,
    profileName: displayName,
    profileUrl: resolveProfileUrl(data, origin),
    assetOrigin: origin,
    contentBlocks: data.profile.contentBlocks,
    itemSlug,
    photo: itemPhoto,
  });
  const galleryItemShare = createProfileGalleryItemShareMetadata({
    profileName: displayName,
    profileUrl: resolveProfileUrl(data, origin),
    assetOrigin: origin,
    contentBlocks: data.profile.contentBlocks,
    itemSlug: gallerySlug,
  });
  // Existing inventory links win if conflicting query parameters are supplied.
  // Normal profile links carry only one item selector.
  const itemShare = inventoryItemShare || galleryItemShare;
  const meta = buildMeta(data, origin, itemShare);
  const jsonLd = buildJsonLd(data, origin, itemShare);

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
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${escapeHtml(meta.ogType)}" />`
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
  } else {
    html = html
      .replace(/<meta property="og:image:width"[^>]*>\s*/gi, "")
      .replace(/<meta property="og:image:height"[^>]*>\s*/gi, "");
  }
  html = upsertTag(
    html,
    /<meta property="og:locale"[^>]*>/i,
    `<meta property="og:locale" content="en_US" />`
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
    /<meta name="twitter:image:alt"[^>]*>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );
  if (meta.faviconUrl) {
    html = injectFaviconOverride(html, meta.faviconUrl);
  }

  const requestHost = (() => {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const customDomain = profileRecord.seoMeta?.customDomain?.trim().toLowerCase();
  if (customDomain && requestHost === customDomain) {
    html = injectCustomDomainProfileSlug(html, profileRecord.slug);
  }

  const bookingRows =
    profileRecord.profileBooking?.pricingTableEnabled &&
    Array.isArray(profileRecord.profileBooking?.pricingRows)
      ? profileRecord.profileBooking.pricingRows
          .map((row: any) =>
            [String(row?.name || "").trim(), String(row?.priceLabel || "").trim()]
              .filter((part) => part.length > 0)
              .join(": ")
          )
          .filter((line: string) => line.length > 0)
          .slice(0, 6)
      : [];
  const bookingSummary =
    profileRecord.profileBooking?.enabled === true
      ? profileRecord.profileBooking?.paidBookings
        ? `Appointments are available. Booking deposit: $${Number(profileRecord.profileBooking?.bookingPriceUsd || 0).toFixed(2)}.`
        : "Appointments are available."
      : "Appointments are coming soon.";
  const categoriesSummary = (businessRecord?.categories || []).slice(0, 6).join(", ");
  const areasSummary = (businessRecord?.serviceAreas || []).slice(0, 8).join(", ");
  const itemSummary = itemShare
    ? `<section data-seo-profile-item="${itemShare.itemType}">
      <h2>${escapeHtml(
        itemShare.itemType === "inventory" ? itemShare.itemName : itemShare.itemTitle
      )}</h2>
      <img src="${escapeHtml(itemShare.imageUrl)}" alt="${escapeHtml(itemShare.imageAlt)}" />
      <p>${escapeHtml(itemShare.description)}</p>
    </section>`
    : "";
  const rootSummary = `
<main data-seo-profile="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(profileRecord.displayName)}</h1>
    <p>${escapeHtml(meta.description)}</p>
    ${itemSummary}
    ${categoriesSummary ? `<p><strong>Categories:</strong> ${escapeHtml(categoriesSummary)}</p>` : ""}
    ${areasSummary ? `<p><strong>Service areas:</strong> ${escapeHtml(areasSummary)}</p>` : ""}
    ${profileRecord.servicesDescription ? `<p>${escapeHtml(profileRecord.servicesDescription)}</p>` : ""}
    <p>${escapeHtml(bookingSummary)}</p>
    ${bookingRows.length > 0 ? `<ul>${bookingRows.map((row: string) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>` : ""}
    <p>Send a private request when you are ready. Contact details stay private until both sides choose to connect.</p>
  </article>
</main>`;

  html = injectProfileSummary(html, rootSummary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
