import { storage } from "./storage";
import { formatTradeScoutTitle } from "@shared/brand";

type PublicProfileHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
};

type PublicProfileData = {
  profile: {
    id: string;
    slug: string;
    displayName: string;
    headline?: string | null;
    roleContext?: string | null;
    servicesDescription?: string | null;
    seoMeta?: { title?: string; description?: string; imageUrl?: string; customDomain?: string };
    profileBooking?: {
      enabled?: boolean;
      paidBookings?: boolean;
      bookingPriceUsd?: number;
      pricingTableEnabled?: boolean;
      pricingRows?: Array<{ name?: string; priceLabel?: string }>;
    } | null;
  };
  business?: {
    name?: string;
    categories?: string[];
    serviceAreas?: string[];
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

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectProfileSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

function buildJsonLd(profile: PublicProfileData, origin: string) {
  const profileUrl = `${origin}/u/${encodeURIComponent(profile.profile.slug)}`;
  const displayName = profile.business?.name?.trim() || profile.profile.displayName;
  const description =
    profile.profile.seoMeta?.description ||
    profile.profile.headline ||
    profile.profile.servicesDescription ||
    profile.profile.roleContext ||
    "TradeScout public profile";

  if (profile.business?.name) {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: displayName,
      description,
      url: profileUrl,
      areaServed: profile.business.serviceAreas?.slice(0, 10) || undefined,
      category: profile.business.categories?.slice(0, 5) || undefined,
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    description,
    jobTitle: profile.profile.roleContext || undefined,
    url: profileUrl,
  };
}

function buildMeta(profile: PublicProfileData, origin: string) {
  const displayName = profile.business?.name?.trim() || profile.profile.displayName;
  const title = formatTradeScoutTitle(
    profile.profile.seoMeta?.title || `${displayName} | TradeScout`
  );
  const description =
    profile.profile.seoMeta?.description ||
    profile.profile.headline ||
    profile.profile.servicesDescription ||
    profile.profile.roleContext ||
    "TradeScout public profile";
  const imageUrl = profile.profile.seoMeta?.imageUrl || `${origin}/tradescout-logo.png?v=4`;
  const canonical = `${origin}/u/${encodeURIComponent(profile.profile.slug)}`;
  const keywords = [
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
    canonical,
    keywords,
  };
}

export async function buildPublicProfileHtml({
  slug,
  origin,
  templateHtml,
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
    },
    business: businessRecord
      ? {
          name: businessRecord.name,
          categories: businessRecord.categories || [],
          serviceAreas: businessRecord.serviceAreas || [],
        }
      : null,
  };

  const meta = buildMeta(data, origin);
  const jsonLd = buildJsonLd(data, origin);

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
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );

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
        ? `Bookings enabled. Paid booking deposit: $${Number(profileRecord.profileBooking?.bookingPriceUsd || 0).toFixed(2)}.`
        : "Bookings enabled."
      : "Bookings not enabled.";
  const categoriesSummary = (businessRecord?.categories || []).slice(0, 6).join(", ");
  const areasSummary = (businessRecord?.serviceAreas || []).slice(0, 8).join(", ");
  const rootSummary = `
<main data-seo-profile="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(profileRecord.displayName)}</h1>
    <p>${escapeHtml(meta.description)}</p>
    ${categoriesSummary ? `<p><strong>Categories:</strong> ${escapeHtml(categoriesSummary)}</p>` : ""}
    ${areasSummary ? `<p><strong>Service areas:</strong> ${escapeHtml(areasSummary)}</p>` : ""}
    ${profileRecord.servicesDescription ? `<p>${escapeHtml(profileRecord.servicesDescription)}</p>` : ""}
    <p>${escapeHtml(bookingSummary)}</p>
    ${bookingRows.length > 0 ? `<ul>${bookingRows.map((row: string) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>` : ""}
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  html = injectProfileSummary(html, rootSummary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
