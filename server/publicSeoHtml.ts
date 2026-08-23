import { detectActorFromUserAgent } from "./utils/requestActor";
import { upgradePublicSocialPreviewHtml } from "./publicSocialPreviewHtml";
import { issueDiscoveryAttributionToken } from "./utils/discoveryAttribution";

const SEO_ROOT_SUMMARY_PATTERN = /<div id="root">\s*<main data-seo-[\s\S]*?<\/main>\s*<\/div>/i;
const BOOT_FALLBACK_PATTERN = /\s*<div id="ts-boot-fallback"[\s\S]*?<\/section>\s*<\/div>\s*/i;
const LANDING_FALLBACK_PATTERN = /\s*<div id="ts-landing-fallback"[\s\S]*?<\/div>\s*/i;
const NOSCRIPT_FALLBACK_PATTERN =
  /\s*<noscript>\s*<div id="ts-boot-fallback-noscript"[\s\S]*?<\/noscript>\s*/i;
const SIGNED_SOCIAL_CARD_PATTERN = /\/images\/social\/card\//i;
const JW_STONE_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-jw-stone-marketplace\b/i;
const FACT_BEARING_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-(?:profile|business)\s*=\s*(["'])true\1/i;
const DISCOVERY_ATTRIBUTION_META_PATTERN =
  /<meta\b[^>]*\bname\s*=\s*(['"])tradescout-discovery-attribution\1[^>]*>/i;
export const DISCOVERY_ATTRIBUTION_CACHE_CONTROL = "private, no-store, max-age=0";
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

type ResponseHeaderWriter = {
  setHeader(name: string, value: string): unknown;
  getHeader?(name: string): unknown;
};

/**
 * SEO preparation deliberately differs by user-agent. Preserve any existing
 * Vary dimensions and make that response variance explicit to shared caches.
 */
export function enforcePublicSeoUserAgentVariation(response: ResponseHeaderWriter): void {
  const current = String(response.getHeader?.("Vary") || "").trim();
  if (
    current === "*" ||
    current.split(",").some((value) => value.trim().toLowerCase() === "user-agent")
  ) {
    return;
  }
  response.setHeader("Vary", current ? `${current}, User-Agent` : "User-Agent");
}

/**
 * A discovery envelope contains a fresh random entryRequestId. It must never
 * be shared by browser, CDN, or surrogate caches across visitors.
 */
export function enforceDiscoveryAttributionResponsePrivacy(
  html: string,
  response: ResponseHeaderWriter
): boolean {
  if (!DISCOVERY_ATTRIBUTION_META_PATTERN.test(String(html || ""))) return false;
  response.setHeader("Cache-Control", DISCOVERY_ATTRIBUTION_CACHE_CONTROL);
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Surrogate-Control", "no-store");
  return true;
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
  const profileSlug = readHtmlMetaContent(source, "tradescout-profile-slug") || "";
  const entityType =
    readHtmlMetaContent(source, "tradescout-business-entity-type") ||
    readHtmlMetaContent(source, "tradescout-profile-entity-type") ||
    "";
  const token = issueDiscoveryAttributionToken({
    entitySlug: profileSlug || businessSlug,
    businessSlug: businessSlug || undefined,
    profileSlug: profileSlug || undefined,
    entityType: entityType as "business_marketplace" | "business_profile" | "public_profile",
    canonicalRoute:
      readHtmlMetaContent(source, "tradescout-discovery-route") || readCanonicalRoute(source) || "",
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
    // A cache that ignores Vary must still deliver an interactive document to
    // a browser. Crawlers retain the SSR facts, while the module bootstrap is
    // harmless for non-executing bots and a recovery path for people.
    return stripPublicSeoBootPlaceholders(upgradedHtml);
  }

  return upgradedHtml.replace(SEO_ROOT_SUMMARY_PATTERN, '<div id="root"></div>');
}

export function preparePublicSeoHtmlForUserAgent(html: string, userAgent?: string | null): string {
  const actor = detectActorFromUserAgent(userAgent);
  const isBot = actor.actorType === "bot";
  // The signed envelope carries a fresh per-entry request ID. Only an actual
  // browser response can use it; crawler/social HTML must stay deterministic
  // and eligible for the route's existing safe public cache policy.
  const htmlWithDiscoveryAttribution =
    actor.actorType === "human" ? attachDiscoveryAttributionMeta(html) : String(html || "");
  const upgradedHtml = upgradePublicSocialPreviewHtml(htmlWithDiscoveryAttribution);

  // Public facts must not depend on crawler UA retention. Bots keep crawlable
  // visible SSR plus the cache-safety module bootstrap; browsers keep the same
  // facts while suppressing the SEO chrome until React mounts.
  if (isFactBearingPublicDiscoveryHtml(htmlWithDiscoveryAttribution)) {
    if (isBot) {
      return stripPublicSeoBootPlaceholders(upgradedHtml);
    }
    return isJwStonePublicDiscoveryHtml(htmlWithDiscoveryAttribution)
      ? suppressJwStoneSeoSummaryPaint(upgradedHtml)
      : suppressPublicSeoSummaryPaint(upgradedHtml);
  }

  return preparePublicSeoHtmlForResponse(htmlWithDiscoveryAttribution, {
    retainSeoSummary: isBot,
  });
}
