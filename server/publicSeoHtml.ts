import { detectActorFromUserAgent } from "./utils/requestActor";
import { upgradePublicSocialPreviewHtml } from "./publicSocialPreviewHtml";

const SEO_ROOT_SUMMARY_PATTERN = /<div id="root">\s*<main data-seo-[\s\S]*?<\/main>\s*<\/div>/i;
const BOOT_FALLBACK_PATTERN = /\s*<div id="ts-boot-fallback"[\s\S]*?<\/section>\s*<\/div>\s*/i;
const LANDING_FALLBACK_PATTERN = /\s*<div id="ts-landing-fallback"[\s\S]*?<\/div>\s*/i;
const NOSCRIPT_FALLBACK_PATTERN =
  /\s*<noscript>\s*<div id="ts-boot-fallback-noscript"[\s\S]*?<\/noscript>\s*/i;
const CLIENT_MODULE_SCRIPT_PATTERN =
  /\s*<script\b[^>]*\btype\s*=\s*(["'])module\1[^>]*\bsrc\s*=\s*(["'])[^"']+\2[^>]*><\/script>\s*/gi;
const SIGNED_SOCIAL_CARD_PATTERN = /\/images\/social\/card\//i;
const JW_STONE_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-jw-stone-marketplace\b/i;
/** Clip SEO chrome for human clients so createRoot can replace #root without a crawler-style flash. */
const JW_STONE_SEO_CLIENT_SUPPRESS =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

export function isJwStonePublicDiscoveryHtml(html: string): boolean {
  return JW_STONE_PUBLIC_DISCOVERY_MARKER.test(String(html || ""));
}

/**
 * Keep JW public facts in the initial HTML for browser UAs while preventing a
 * visible system-ui SEO document from flashing before the luxury SPA mounts.
 * Facts remain in the document; presentation is suppressed only for client paint.
 */
export function suppressJwStoneSeoSummaryPaint(html: string): string {
  return String(html || "").replace(
    /<main\b([^>]*\bdata-seo-jw-stone-marketplace\b[^>]*)>/i,
    (_match, attrs: string) => {
      if (/\bstyle\s*=/i.test(attrs)) {
        const nextAttrs = attrs.replace(
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
        return `<main${nextAttrs}>`;
      }
      return `<main${attrs} style="${JW_STONE_SEO_CLIENT_SUPPRESS}">`;
    }
  );
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
  const actor = detectActorFromUserAgent(userAgent);
  const isBot = actor.actorType === "bot";

  // JW Stone Phase 3A: public facts must not depend on crawler UA retention.
  // Same fact-bearing summary for all UAs; bots keep crawlable visible SSR without
  // client modules; humans keep client boot and suppress SEO chrome to avoid flash.
  if (isJwStonePublicDiscoveryHtml(html)) {
    const upgradedHtml = upgradePublicSocialPreviewHtml(html);
    if (isBot) {
      return stripPublicSeoBootPlaceholders(upgradedHtml).replace(CLIENT_MODULE_SCRIPT_PATTERN, "");
    }
    return suppressJwStoneSeoSummaryPaint(upgradedHtml);
  }

  return preparePublicSeoHtmlForResponse(html, {
    retainSeoSummary: isBot,
  });
}
