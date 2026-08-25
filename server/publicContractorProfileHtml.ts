import { formatTradeScoutTitle } from "@shared/brand";
import {
  createContractorPhotoShareMetadata,
  listContractorProjectPhotos,
  resolveContractorProjectPhoto,
  type ContractorPhotoShareMetadata,
} from "@shared/contractorPhotoShare";
import type { Contractor } from "@shared/schema";
import { storage } from "./storage";

type PublicContractorProfileHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
  gallerySlug?: unknown;
};

export type PublicContractorProfileRecord = Pick<
  Contractor,
  | "id"
  | "userId"
  | "companyName"
  | "slug"
  | "website"
  | "yearsInBusiness"
  | "about"
  | "photos"
  | "verifiedLicensed"
  | "verifiedInsured"
  | "isActive"
>;

export type PublicContractorProfileHtmlResult =
  | { kind: "html"; html: string }
  | { kind: "redirect"; location: string };

/**
 * These old public entry paths share the `/contractors/:slug` server route.
 * Resolve them before contractor lookup so crawlers receive the same permanent
 * destination that browser-side compatibility routing already uses.
 */
const LEGACY_CONTRACTOR_ENTRY_REDIRECTS: Readonly<Record<string, string>> = Object.freeze({
  apply: "/claim-my-business?source=contractors_apply_legacy",
  signup: "/claim-my-business?source=contractors_signup_legacy",
  accelerator: "/claim-my-business?source=contractors_accelerator_legacy",
  dashboard: "/business-dashboard",
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string): string {
  if (regex.test(html)) return html.replace(regex, tag);
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

function resolvePublicImageUrl(value: unknown, origin: string): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  try {
    const resolved = new URL(candidate, origin);
    return resolved.protocol === "https:" || resolved.protocol === "http:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

function composeProfileDescription(contractor: PublicContractorProfileRecord): string {
  const source =
    String(contractor.about || "").trim() || `View project work for ${contractor.companyName}.`;
  return source.length <= 160 ? source : `${source.slice(0, 159).trimEnd()}…`;
}

function injectJsonLd(html: string, jsonLd: object): string {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
}

function buildStructuredData(args: {
  contractor: PublicContractorProfileRecord;
  profileCanonical: string;
  description: string;
  firstPhotoUrl: string | null;
  itemShare: ContractorPhotoShareMetadata | null;
}) {
  const localBusiness = {
    "@type": "LocalBusiness",
    name: args.contractor.companyName,
    description: args.description,
    url: args.profileCanonical,
    image: args.firstPhotoUrl || undefined,
    sameAs: args.contractor.website ? [args.contractor.website] : undefined,
    address: {
      "@type": "PostalAddress",
      addressCountry: "US",
    },
  };

  if (!args.itemShare) return { "@context": "https://schema.org", ...localBusiness };

  return {
    "@context": "https://schema.org",
    "@graph": [
      localBusiness,
      {
        "@type": "ImageObject",
        "@id": `${args.itemShare.canonical}#project-photo`,
        name: args.itemShare.itemTitle,
        description: args.itemShare.description,
        contentUrl: args.itemShare.imageUrl,
        url: args.itemShare.canonical,
        creator: { "@type": "LocalBusiness", name: args.contractor.companyName },
      },
    ],
  };
}

export function renderPublicContractorProfileHtml(args: {
  contractor: PublicContractorProfileRecord;
  origin: string;
  templateHtml: string;
  gallerySlug?: unknown;
}): string {
  const profileCanonical = `${args.origin}/contractors/${encodeURIComponent(args.contractor.slug)}`;
  const itemShare = createContractorPhotoShareMetadata({
    contractorName: args.contractor.companyName,
    contractorUrl: profileCanonical,
    assetOrigin: args.origin,
    photos: args.contractor.photos,
    itemSlug: args.gallerySlug,
  });
  const firstPhoto = listContractorProjectPhotos(args.contractor.photos)[0] || null;
  const firstPhotoUrl = resolvePublicImageUrl(firstPhoto?.imageUrl, args.origin);
  const description = itemShare?.description || composeProfileDescription(args.contractor);
  const title = formatTradeScoutTitle(
    itemShare?.title || `${args.contractor.companyName} - Verified Local Provider`
  );
  const canonical = itemShare?.canonical || profileCanonical;
  const imageUrl =
    itemShare?.imageUrl || firstPhotoUrl || `${args.origin}/tradescout-social-preview.png?v=12`;
  const imageAlt = itemShare?.imageAlt || `${args.contractor.companyName} profile preview`;
  const usesDefaultImage = !itemShare && !firstPhotoUrl;
  const structuredData = buildStructuredData({
    contractor: args.contractor,
    profileCanonical,
    description,
    firstPhotoUrl,
    itemShare,
  });

  let html = args.templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    '<meta name="robots" content="index, follow, max-image-preview:large" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${itemShare ? "article" : "profile"}" />`
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
    `<meta property="og:image:type" content="${imageMimeType(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
  );
  if (usesDefaultImage) {
    html = upsertTag(
      html,
      /<meta property="og:image:width"[^>]*>/i,
      '<meta property="og:image:width" content="1200" />'
    );
    html = upsertTag(
      html,
      /<meta property="og:image:height"[^>]*>/i,
      '<meta property="og:image:height" content="630" />'
    );
  } else {
    html = html
      .replace(/<meta property="og:image:width"[^>]*>\s*/gi, "")
      .replace(/<meta property="og:image:height"[^>]*>\s*/gi, "");
  }
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
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
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  html = injectJsonLd(html, structuredData);
  if (itemShare) {
    html = html.replace(
      "</head>",
      `<meta name="tradescout:profile-item" content="contractor-photo" data-seo-contractor-gallery="${escapeHtml(itemShare.itemSlug)}" />\n</head>`
    );
  }
  return html;
}

export async function buildPublicContractorProfileHtml({
  slug,
  origin,
  templateHtml,
  gallerySlug,
}: PublicContractorProfileHtmlOptions): Promise<PublicContractorProfileHtmlResult | null> {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug || safeSlug.length > 160 || /[\r\n\\/]/.test(safeSlug)) return null;

  const legacyDestination = LEGACY_CONTRACTOR_ENTRY_REDIRECTS[safeSlug.toLowerCase()];
  if (legacyDestination) {
    return { kind: "redirect", location: legacyDestination };
  }

  const contractor = await storage.getContractorBySlug(safeSlug);
  if (!contractor || contractor.isActive === false) return null;

  // An exact photo share is distinct content and must keep its exact preview.
  // Base legacy profiles still consolidate to the richer business profile.
  const selectedPhoto = resolveContractorProjectPhoto(contractor.photos, gallerySlug);
  const ownerUserId = String(contractor.userId || "").trim();
  if (!selectedPhoto && ownerUserId) {
    const canonicalBusinessProfile = await storage.getBusinessProfileByUserId(ownerUserId);
    const canonicalSlug =
      canonicalBusinessProfile?.visibility === "public" &&
      typeof canonicalBusinessProfile.slug === "string"
        ? canonicalBusinessProfile.slug.trim()
        : "";
    if (canonicalSlug) {
      return {
        kind: "redirect",
        location: `/business/${encodeURIComponent(canonicalSlug)}`,
      };
    }
  }

  return {
    kind: "html",
    html: renderPublicContractorProfileHtml({
      contractor,
      origin,
      templateHtml,
      gallerySlug: selectedPhoto?.slug,
    }),
  };
}
