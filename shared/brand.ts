export const TRADESCOUT_BRAND_NAME = "TradeScout";
export const TRADESCOUT_TAGLINE = "Connection Without Compromise";

/**
 * Ensures the brand appears consistently as "TradeScout — Connection Without Compromise"
 * while allowing targeting pages to keep their specific leading context.
 */
export function formatTradeScoutTitle(rawTitle: string): string {
  const title = String(rawTitle || "").trim();
  if (!title) return `${TRADESCOUT_BRAND_NAME} — ${TRADESCOUT_TAGLINE}`;

  // If the title already includes the full brand+tagline, don't touch it.
  // Note: we intentionally do NOT early-return if the tagline appears elsewhere
  // (e.g. "How TradeScout Works — Connection Without Compromise | TradeScout"),
  // because we still want the brand token to carry the tagline too.
  const hasBrandWithTagline = new RegExp(
    `${TRADESCOUT_BRAND_NAME}\\s*[—-]\\s*${TRADESCOUT_TAGLINE}`,
    "i"
  ).test(title);
  if (hasBrandWithTagline) return title;

  // Common pattern: "... | TradeScout"
  if (/\|\s*tradescout\s*$/i.test(title)) {
    return title.replace(
      /\|\s*tradescout\s*$/i,
      `| ${TRADESCOUT_BRAND_NAME} — ${TRADESCOUT_TAGLINE}`
    );
  }

  // Common pattern: "... - TradeScout"
  if (/[-–]\s*tradescout\s*$/i.test(title)) {
    return title.replace(
      /[-–]\s*tradescout\s*$/i,
      `— ${TRADESCOUT_BRAND_NAME} — ${TRADESCOUT_TAGLINE}`
    );
  }

  // If the title is just the brand, add tagline.
  if (/^tradescout$/i.test(title)) return `${TRADESCOUT_BRAND_NAME} — ${TRADESCOUT_TAGLINE}`;

  // If it already mentions TradeScout somewhere, append the tagline.
  if (/\btradescout\b/i.test(title)) return `${title} — ${TRADESCOUT_TAGLINE}`;

  // Otherwise, add brand + tagline.
  return `${title} | ${TRADESCOUT_BRAND_NAME} — ${TRADESCOUT_TAGLINE}`;
}
