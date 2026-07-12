export const TRADESCOUT_BRAND_NAME = "TradeScout";
export const TRADESCOUT_TAGLINE = "Connection Without Compromise";

// Google typically truncates title tags around ~580px, roughly 60 characters
// for a proportional font. Keep a hard cap so titles never get cut mid-word
// in search results.
const MAX_TITLE_LENGTH = 60;
const BRAND_SUFFIX = ` | ${TRADESCOUT_BRAND_NAME}`;

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${truncated}…`;
}

function capTitleLength(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;

  // Preserve the "| TradeScout" suffix when present and truncate the
  // descriptive prefix instead, so the brand name never gets cut off.
  if (title.endsWith(BRAND_SUFFIX)) {
    const prefix = title.slice(0, title.length - BRAND_SUFFIX.length);
    const budget = MAX_TITLE_LENGTH - BRAND_SUFFIX.length;
    if (budget > 10) {
      return `${truncateWithEllipsis(prefix, budget)}${BRAND_SUFFIX}`;
    }
  }

  return truncateWithEllipsis(title, MAX_TITLE_LENGTH);
}

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
    return capTitleLength(
      withoutTagline.replace(/\|\s*tradescout\s*$/i, `| ${TRADESCOUT_BRAND_NAME}`)
    );
  }

  if (/[-–]\s*tradescout\s*$/i.test(withoutTagline)) {
    return capTitleLength(
      withoutTagline.replace(/[-–]\s*tradescout\s*$/i, `| ${TRADESCOUT_BRAND_NAME}`)
    );
  }

  if (/\btradescout\b/i.test(withoutTagline)) return capTitleLength(withoutTagline);

  return capTitleLength(`${withoutTagline} | ${TRADESCOUT_BRAND_NAME}`);
}
