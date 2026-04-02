export const PRIMARY_SUPPORT_EMAIL = "contact@thetradescout.com";
export const LEGACY_SUPPORT_EMAIL = "info.tradescout@gmail.com";

export const SUPPORT_EMAIL_ALIASES = [PRIMARY_SUPPORT_EMAIL, LEGACY_SUPPORT_EMAIL] as const;

export function normalizeSupportInboxEmail(email: unknown): string {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) return "";
  if (normalized === PRIMARY_SUPPORT_EMAIL || normalized === LEGACY_SUPPORT_EMAIL) {
    return PRIMARY_SUPPORT_EMAIL;
  }
  return normalized;
}

export function isSupportInboxEmail(email: unknown): boolean {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  return SUPPORT_EMAIL_ALIASES.includes(normalized as (typeof SUPPORT_EMAIL_ALIASES)[number]);
}
