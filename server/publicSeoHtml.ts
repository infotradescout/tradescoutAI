import { detectActorFromUserAgent } from "./utils/requestActor";
import { upgradePublicSocialPreviewHtml } from "./publicSocialPreviewHtml";
import { issueDiscoveryAttributionToken } from "./utils/discoveryAttribution";
import { normalizeDiscoveryRouteForBusiness } from "../shared/discoveryLanding";

const SEO_ROOT_SUMMARY_PATTERN = /<div id="root">\s*<main data-seo-[\s\S]*?<\/main>\s*<\/div>/i;
const BOOT_FALLBACK_PATTERN = /\s*<div id="ts-boot-fallback"[\s\S]*?<\/section>\s*<\/div>\s*/i;
const LANDING_FALLBACK_PATTERN = /\s*<div id="ts-landing-fallback"[\s\S]*?<\/div>\s*/i;
const NOSCRIPT_FALLBACK_PATTERN =
  /\s*<noscript>\s*<div id="ts-boot-fallback-noscript"[\s\S]*?<\/noscript>\s*/i;
const CLIENT_MODULE_SCRIPT_PATTERN =
  /\s*<script\b[^>]*\btype\s*=\s*(["'])module\1[^>]*\bsrc\s*=\s*(["'])[^"']+\2[^>]*><\/script>\s*/gi;
const SIGNED_SOCIAL_CARD_PATTERN = /\/images\/social\/card\//i;
const JW_STONE_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-jw-stone-marketplace\b/i;
const FACT_BEARING_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-(?:profile|business)\s*=\s*(["'])true\1/i;
const DISCOVERY_ATTRIBUTION_META_PATTERN =
  /<meta\b[^>]*\bname\s*=\s*(['"])tradescout-discovery-attribution\1[^>]*>/i;
const HTML_META_CONTENT_PATTERN = (name: string) =>
  new RegExp(
    `<meta\\b(?=[^>]*\\bname\\s*=\\s*(["'])${name}\\1)(?=[^>]*\\bcontent\\s*=\\s*(["'])([^"']*)\\2)[^>]*>`,
    "i"
  );
const CANONICAL_LINK_PATTERN =
  /<link\b(?=[^>]*\brel\s*=\s*(['"])canonical\1)(?=[^>]*\bhref\s*=\s*(['"])([^"']*)\2)[^>]*>/i;
/** Clip SEO chrome for human clients so createRoot can replace #root without a crawler-style flash. */
const JW_STONE_SEO_CLIENT_SUPPRESS =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

export function isJwStonePublicDiscoveryHtml(html: string): boolean {
  return JW_STONE_PUBLIC_DISCOVERY_MARKER.test(String(html || ""));
}

export function isFactBearingPublicDiscoveryHtml(html: string): boolean {
  const source = String(html || "");
  return isJwStonePublicDiscoveryHtml(source) || FACT_BEARING_PUBLIC_DISCOVERY_MARKER.test(source);
}

function mergeSeoSummaryPaintSuppression(attrs: string): string {
  if (/\bstyle\s*=/i.test(attrs)) {
    return attrs.replace(
      /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i,
      (_styleMatch, quote: string, styleValue: string) => {
        const trimmed = String(styleValue || "")
          .trim()
          .replace(/;?\s*$/, "");
        const merged = trimmed
          ? `${trimmed};${JW_STONE_SEO_CLIENT_SUPPRESS}`
          : JW_STONE_SEO_CLIENT_SUPPRESS;
        return `style=${quote}${merged}${quote}`;
      }
    );
  }
  return `${attrs} style="${JW_STONE_SEO_CLIENT_SUPPRESS}"`;
}

function suppressSeoSummaryPaint(html: string, marker: RegExp): string {
  return String(html || "").replace(/<main\b([^>]*)>/i, (match, attrs: string) => {
    if (!marker.test(attrs)) return match;
    return `<main${mergeSeoSummaryPaintSuppression(attrs)}>`;
  });
}

/**
 * Keep JW public facts in the initial HTML for browser UAs while preventing a
 * visible system-ui SEO document from flashing before the luxury SPA mounts.
 * Facts remain in the document; presentation is suppressed only for client paint.
 */
export function suppressJwStoneSeoSummaryPaint(html: string): string {
  return suppressSeoSummaryPaint(html, JW_STONE_PUBLIC_DISCOVERY_MARKER);
}

export function suppressPublicSeoSummaryPaint(html: string): string {
  return suppressSeoSummaryPaint(html, FACT_BEARING_PUBLIC_DISCOVERY_MARKER);
}

export function publicSocialMetadataCacheControl(html: string): string | null {
  return SIGNED_SOCIAL_CARD_PATTERN.test(String(html || ""))
    ? "public, max-age=60, must-revalidate"
    : null;
}

export function stripPublicSeoBootPlaceholders(html: string): string {
  return html
    .replace(BOOT_FALLBACK_PATTERN, "")
    .replace(LANDING_FALLBACK_PATTERN, "")
    .replace(NOSCRIPT_FALLBACK_PATTERN, "");
}

function readHtmlMetaContent(html: string, name: string): string | null {
  const match = String(html || "").match(HTML_META_CONTENT_PATTERN(name));
  return match?.[3] ? String(match[3]).trim() : null;
}

function readCanonicalRoute(html: string): string | null {
  const match = String(html || "").match(CANONICAL_LINK_PATTERN);
  const raw = match?.[3] ? String(match[3]).trim() : "";
  if (!raw) return null;
  try {
    return new URL(raw, "https://www.thetradescout.com").pathname || "/";
  } catch {
    return null;
  }
}

export function attachDiscoveryAttributionMeta(html: string): string {
  const source = String(html || "");
  if (
    !isFactBearingPublicDiscoveryHtml(source) ||
    DISCOVERY_ATTRIBUTION_META_PATTERN.test(source)
  ) {
    return source;
  }

  const businessSlug = readHtmlMetaContent(source, "tradescout-business-slug") || "";
  const canonicalRoute = normalizeDiscoveryRouteForBusiness(
    businessSlug,
    readCanonicalRoute(source) || ""
  );
  if (!canonicalRoute) return source;

  const token = issueDiscoveryAttributionToken({
    businessSlug,
    entityType: readHtmlMetaContent(source, "tradescout-business-entity-type") as
      | "business_marketplace"
      | "business_profile",
    canonicalRoute,
  });
  if (!token) return source;

  const tag = `<meta name="tradescout-discovery-attribution" content="${token}" />`;
  return source.replace(/<\/head>/i, `${tag}\n</head>`);
}

export function preparePublicSeoHtmlForResponse(
  html: string,
  options: { retainSeoSummary: boolean }
): string {
  const upgradedHtml = upgradePublicSocialPreviewHtml(html);
  if (options.retainSeoSummary) {
    return stripPublicSeoBootPlaceholders(upgradedHtml).replace(CLIENT_MODULE_SCRIPT_PATTERN, "");
  }

  return upgradedHtml.replace(SEO_ROOT_SUMMARY_PATTERN, '<div id="root"></div>');
}

export function preparePublicSeoHtmlForUserAgent(html: string, userAgent?: string | null): string {
  const htmlWithDiscoveryAttribution = attachDiscoveryAttributionMeta(html);
  const actor = detectActorFromUserAgent(userAgent);
  const isBot = actor.actorType === "bot";
  const upgradedHtml = upgradePublicSocialPreviewHtml(htmlWithDiscoveryAttribution);

  // Public facts must not depend on crawler UA retention. Bots keep crawlable
  // visible SSR without client modules; browsers keep the same facts in the
  // initial document while suppressing the SEO chrome until React mounts.
  if (isFactBearingPublicDiscoveryHtml(htmlWithDiscoveryAttribution)) {
    if (isBot) {
      return stripPublicSeoBootPlaceholders(upgradedHtml).replace(CLIENT_MODULE_SCRIPT_PATTERN, "");
    }
    return isJwStonePublicDiscoveryHtml(htmlWithDiscoveryAttribution)
      ? suppressJwStoneSeoSummaryPaint(upgradedHtml)
      : suppressPublicSeoSummaryPaint(upgradedHtml);
  }

  return preparePublicSeoHtmlForResponse(htmlWithDiscoveryAttribution, {
    retainSeoSummary: isBot,
  });
}
