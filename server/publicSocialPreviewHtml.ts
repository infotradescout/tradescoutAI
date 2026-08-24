import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import { buildSignedSocialPreviewImageUrl } from "./signedSocialPreview";
import type { SocialPreviewCardContext } from "./socialPreviewCardRenderer";

const DEFAULT_SOCIAL_IMAGE_PATTERN =
  /(?:tradescout-social-preview|tradescout-logo)\.(?:png|jpe?g)(?:[?#]|$)/i;
const JW_STONE_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-jw-stone-marketplace\b/i;

type SurfacePresentation = Pick<
  SocialPreviewCardContext,
  "kind" | "brandName" | "eyebrow" | "ctaLabel" | "accentColor"
>;

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value: string): string {
  return String(value || "")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagAttribute(tag: string, attribute: string): string {
  const match = tag.match(new RegExp(`\\b${escapeRegExp(attribute)}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return decodeHtml(match?.[2] || "");
}

function metaTagPattern(attribute: "property" | "name", value: string): RegExp {
  return new RegExp(
    `<meta\\b[^>]*\\b${attribute}\\s*=\\s*(["'])${escapeRegExp(value)}\\1[^>]*>`,
    "i"
  );
}

function metaContent(html: string, attribute: "property" | "name", value: string): string {
  const tag = html.match(metaTagPattern(attribute, value))?.[0] || "";
  return tagAttribute(tag, "content");
}

function canonicalHref(html: string): string {
  const tag = html.match(/<link\b[^>]*\brel\s*=\s*(["'])canonical\1[^>]*>/i)?.[0] || "";
  return tagAttribute(tag, "href");
}

function upsertTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function humanizeSlug(value: string): string {
  return decodeURIComponent(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim()
    .slice(0, 50);
}

function isPathRootOrChild(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function surfacePresentation(canonical: string): SurfacePresentation {
  let pathname = "/";
  let searchParams = new URLSearchParams();
  try {
    const parsed = new URL(canonical);
    pathname = parsed.pathname.toLowerCase();
    searchParams = parsed.searchParams;
  } catch {
    // Use the generic page presentation below.
  }
  const segments = pathname.split("/").filter(Boolean);

  if (pathname === "/groups") {
    return {
      kind: "directory",
      brandName: "TradeScout Groups",
      eyebrow: "Local community",
      ctaLabel: "Explore local groups",
      accentColor: "#f97316",
    };
  }
  if (isPathRootOrChild(pathname, "/group")) {
    const isPost = searchParams.has("post");
    return {
      kind: isPost ? "community_post" : "group",
      brandName: "TradeScout Groups",
      eyebrow: isPost ? "Group post" : "Community group",
      ctaLabel: isPost ? "View post · Join the conversation" : "View group · Join the conversation",
      accentColor: "#f97316",
    };
  }
  if (isPathRootOrChild(pathname, "/community")) {
    const isCommunityRoot = pathname === "/community";
    return {
      kind: isCommunityRoot ? "directory" : "community_post",
      brandName: "TradeScout Community",
      eyebrow: "Community",
      ctaLabel: isCommunityRoot ? "Explore the community" : "View post · Join the conversation",
      accentColor: "#f97316",
    };
  }
  if (isPathRootOrChild(pathname, "/exchange")) {
    const hasLegacyListing = Boolean(searchParams.get("item")?.trim());
    const hasLegacyPromotion = Boolean(searchParams.get("promo")?.trim());
    const hasLegacyCompanyPromotion = Boolean(searchParams.get("companyPromo")?.trim());
    if (hasLegacyCompanyPromotion || hasLegacyPromotion) {
      return {
        kind: "offer",
        brandName: "TradeScout Exchange",
        eyebrow: hasLegacyCompanyPromotion ? "Exchange sale" : "Exchange promotion",
        ctaLabel: hasLegacyCompanyPromotion
          ? "View sale · Connect safely"
          : "View promotion · Connect safely",
        accentColor: "#f97316",
      };
    }
    const isListing = segments.length >= 3 || hasLegacyListing;
    return {
      kind: isListing ? "listing" : "directory",
      brandName: "TradeScout Exchange",
      eyebrow: humanizeSlug(segments[1] || "Local exchange"),
      ctaLabel: isListing ? "View listing · Connect safely" : "Explore the local exchange",
      accentColor: "#f97316",
    };
  }
  if (pathname === "/handmade-marketplace" || isPathRootOrChild(pathname, "/handmade")) {
    const isHandmadeRoot = pathname === "/handmade" || pathname === "/handmade-marketplace";
    return {
      kind: isHandmadeRoot ? "directory" : "product",
      brandName: "TradeScout Handmade",
      eyebrow: isHandmadeRoot ? "Local makers" : "Made locally",
      ctaLabel: isHandmadeRoot ? "Explore local handmade" : "View product · Contact maker",
      accentColor: "#f97316",
    };
  }
  if (isPathRootOrChild(pathname, "/homescout") || isPathRootOrChild(pathname, "/homes")) {
    const isHomeScoutRoot = pathname === "/homescout" || pathname === "/homes";
    const isHomeScoutCounty =
      segments[0] === "homescout" &&
      /^[a-z]{2}$/.test(segments[1] || "") &&
      /^\d{5}$/.test(segments[2] || "");
    const isHomeScoutDirectory = isHomeScoutRoot || isHomeScoutCounty;
    return {
      kind: isHomeScoutDirectory ? "directory" : "property",
      brandName: "HomeScout",
      eyebrow: isHomeScoutCounty
        ? "County listings"
        : isHomeScoutRoot
          ? "Local properties"
          : "Property",
      ctaLabel: isHomeScoutCounty
        ? "Browse county listings"
        : isHomeScoutRoot
          ? "Explore local properties"
          : "View property · Request details",
      accentColor: "#2563eb",
    };
  }
  if (isPathRootOrChild(pathname, "/services")) {
    const isServicesRoot = pathname === "/services";
    return {
      kind: isServicesRoot ? "directory" : "offer",
      brandName: "TradeScout Services",
      eyebrow: isServicesRoot ? "Local services" : "Service offer",
      ctaLabel: isServicesRoot ? "Explore local services" : "View service · Direct Connect",
      accentColor: "#f97316",
    };
  }
  if (isPathRootOrChild(pathname, "/r")) {
    return {
      kind: "offer",
      brandName: "TradeScout Direct Connect",
      eyebrow: "Project request",
      ctaLabel: "Review request · Respond privately",
      accentColor: "#f97316",
    };
  }
  if (pathname.startsWith("/promo/")) {
    return {
      kind: "offer",
      brandName: "TradeScout Local Offer",
      eyebrow: "Local promotion",
      ctaLabel: "View offer · Contact provider",
      accentColor: "#f97316",
    };
  }
  if (pathname.startsWith("/business/")) {
    const hasGalleryItem = searchParams.has("gallery");
    return {
      kind: hasGalleryItem ? "gallery" : "business",
      brandName: "TradeScout",
      eyebrow: hasGalleryItem ? "Featured work" : "Local business",
      ctaLabel: hasGalleryItem ? "View work · Direct Connect" : "View business · Direct Connect",
      accentColor: "#f97316",
    };
  }
  if (pathname.startsWith("/helpers/")) {
    const hasPortfolioItem = searchParams.has("portfolio");
    return {
      kind: hasPortfolioItem ? "portfolio" : "helper",
      brandName: "TradeScout",
      eyebrow: hasPortfolioItem ? "Portfolio" : "Local helper",
      ctaLabel: hasPortfolioItem ? "View work · Request help" : "View profile · Request help",
      accentColor: "#f97316",
    };
  }
  if (pathname.startsWith("/contractors/") || pathname.startsWith("/u/")) {
    const hasSharedItem =
      searchParams.has("gallery") || searchParams.has("stone") || searchParams.has("portfolio");
    return {
      kind: hasSharedItem ? "gallery" : "profile",
      brandName: "TradeScout",
      eyebrow: hasSharedItem ? "Featured work" : "Public profile",
      ctaLabel: hasSharedItem ? "View details · Direct Connect" : "View profile · Direct Connect",
      accentColor: "#f97316",
    };
  }
  if (
    [
      "/best",
      "/city",
      "/cities",
      "/county",
      "/counties",
      "/datasets",
      "/recent",
      "/trade",
      "/trades",
    ].some((root) => isPathRootOrChild(pathname, root))
  ) {
    return {
      kind: "directory",
      brandName: "TradeScout Local",
      eyebrow: "Local intelligence",
      ctaLabel: "Explore local results",
      accentColor: "#f97316",
    };
  }
  return {
    kind: "page",
    brandName: "TradeScout",
    eyebrow: "Connection without compromise",
    ctaLabel: "Open TradeScout",
    accentColor: "#f97316",
  };
}

function cardTitle(value: string, fallback: string): string {
  const sanitized = sanitizePublicDiscoveryText(decodeHtml(value), 180)
    .replace(/\s+[|·]\s+TradeScout(?:\s+[A-Za-z ]+)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || fallback || "TradeScout").slice(0, 100);
}

function cardSupportingText(value: string): string {
  return sanitizePublicDiscoveryText(decodeHtml(value), 220)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function sourceImage(value: string, pageOrigin: string): string | null {
  const imageUrl = decodeHtml(value).trim().slice(0, 2_048);
  if (
    !imageUrl ||
    DEFAULT_SOCIAL_IMAGE_PATTERN.test(imageUrl) ||
    /\/images\/social\//i.test(imageUrl)
  ) {
    return null;
  }
  try {
    const parsed = new URL(imageUrl, pageOrigin);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function upgradePublicSocialPreviewHtml(html: string): string {
  if (/\bnoindex\b/i.test(metaContent(html, "name", "robots"))) return html;

  const existingImage = metaContent(html, "property", "og:image");
  if (!existingImage || /\/images\/social\//i.test(existingImage)) return html;
  // JW Stone owns a finished brand preview image. Keep that direct asset for
  // its public link instead of wrapping it in the generic TradeScout card.
  if (JW_STONE_PUBLIC_DISCOVERY_MARKER.test(html)) return html;

  const canonical = canonicalHref(html) || metaContent(html, "property", "og:url");
  const presentation = surfacePresentation(canonical);
  const rawTitle =
    metaContent(html, "property", "og:title") ||
    metaContent(html, "name", "twitter:title") ||
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
    "";
  const description =
    metaContent(html, "property", "og:description") || metaContent(html, "name", "description");
  const title = cardTitle(rawTitle, presentation.brandName);
  const supportingText = cardSupportingText(description);
  let pageOrigin = "https://www.thetradescout.com";
  try {
    pageOrigin = new URL(canonical).origin;
  } catch {
    // The signed image remains on the canonical TradeScout image host.
  }
  const context: SocialPreviewCardContext = {
    ...presentation,
    title,
    supportingText: supportingText || null,
    sourceImageUrl: sourceImage(existingImage, pageOrigin),
  };

  const previewImageUrl = buildSignedSocialPreviewImageUrl({
    pageOrigin,
    context,
    versionSeed: [canonical, description, existingImage].join("|"),
  });
  if (!previewImageUrl) return html;

  let upgraded = html;
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("property", "og:image"),
    `<meta property="og:image" content="${escapeHtml(previewImageUrl)}" />`
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("property", "og:image:secure_url"),
    `<meta property="og:image:secure_url" content="${escapeHtml(previewImageUrl)}" />`
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("property", "og:image:type"),
    '<meta property="og:image:type" content="image/png" />'
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("property", "og:image:width"),
    '<meta property="og:image:width" content="1200" />'
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("property", "og:image:height"),
    '<meta property="og:image:height" content="630" />'
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("property", "og:image:alt"),
    `<meta property="og:image:alt" content="${escapeHtml(`${title} preview`)}" />`
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("name", "twitter:card"),
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("name", "twitter:image"),
    `<meta name="twitter:image" content="${escapeHtml(previewImageUrl)}" />`
  );
  upgraded = upsertTag(
    upgraded,
    metaTagPattern("name", "twitter:image:alt"),
    `<meta name="twitter:image:alt" content="${escapeHtml(`${title} preview`)}" />`
  );
  return upgraded;
}
