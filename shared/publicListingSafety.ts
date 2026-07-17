const PUBLIC_CONTACT_REPLACEMENT = "Continue through TradeScout";

/**
 * Removes direct-contact and exact-address vectors from user-authored text
 * rendered on public listing and profile surfaces. Visibility never grants
 * contact authority.
 */
export function sanitizePublicListingText(value: unknown, maxLength = 4000): string {
  const safeMaxLength = Math.max(0, Math.min(20_000, Number(maxLength) || 0));
  return (typeof value === "string" ? value : "")
    .trim()
    .slice(0, safeMaxLength)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, PUBLIC_CONTACT_REPLACEMENT)
    .replace(/\bP\.?\s*O\.?\s+Box\s+\d+[A-Z0-9-]*\b/gi, PUBLIC_CONTACT_REPLACEMENT)
    .replace(
      /\b\d{1,6}\s+(?:[A-Z0-9.'-]+\s+){0,6}(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Highway|Hwy|Trail|Trl|Parkway|Pkwy)\b(?:\s*(?:Apt|Apartment|Unit|Suite|#)\s*[A-Z0-9-]+)?/gi,
      PUBLIC_CONTACT_REPLACEMENT
    )
    .replace(
      /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
      PUBLIC_CONTACT_REPLACEMENT
    )
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, PUBLIC_CONTACT_REPLACEMENT)
    .replace(/\s+/g, " ")
    .trim();
}
