const PUBLIC_CONTACT_REPLACEMENT = "Continue through TradeScout";

/**
 * Removes direct-contact vectors from user-authored text rendered on public
 * listing and profile surfaces. Visibility never grants contact authority.
 */
export function sanitizePublicListingText(value: unknown, maxLength = 4000): string {
  const safeMaxLength = Math.max(0, Math.min(20_000, Number(maxLength) || 0));
  return (typeof value === "string" ? value : "")
    .trim()
    .slice(0, safeMaxLength)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, PUBLIC_CONTACT_REPLACEMENT)
    .replace(
      /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
      PUBLIC_CONTACT_REPLACEMENT
    )
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, PUBLIC_CONTACT_REPLACEMENT)
    .replace(/\s+/g, " ")
    .trim();
}
