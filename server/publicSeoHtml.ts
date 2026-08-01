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
  return preparePublicSeoHtmlForResponse(html, {
    retainSeoSummary: detectActorFromUserAgent(userAgent).actorType === "bot",
  });
}
