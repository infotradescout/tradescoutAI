export const TRADESCOUT_BRAND_NAME = "TradeScout";
export const TRADESCOUT_TAGLINE = "Connection Without Compromise";

/**
 * Keep SEO titles concise and intent-first:
 * - "{Intent phrase} | TradeScout"
 * - "TradeScout" for bare brand contexts
 */
export function formatTradeScoutTitle(rawTitle: string): string {
  const title = String(rawTitle || "").trim();
  if (!title) return TRADESCOUT_BRAND_NAME;

  const withoutTagline = title
    .replace(new RegExp(`\\s*[—-]\\s*${TRADESCOUT_TAGLINE}`, "gi"), "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^tradescout$/i.test(withoutTagline)) return TRADESCOUT_BRAND_NAME;

  if (/\|\s*tradescout\s*$/i.test(withoutTagline)) {
    return withoutTagline.replace(/\|\s*tradescout\s*$/i, `| ${TRADESCOUT_BRAND_NAME}`);
  }

  if (/[-–]\s*tradescout\s*$/i.test(withoutTagline)) {
    return withoutTagline.replace(/[-–]\s*tradescout\s*$/i, `| ${TRADESCOUT_BRAND_NAME}`);
  }

  if (/\btradescout\b/i.test(withoutTagline)) return withoutTagline;

  return `${withoutTagline} | ${TRADESCOUT_BRAND_NAME}`;
}
