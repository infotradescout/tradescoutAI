/** Digit-length gate for Express Direct Connect requester phones. */
export function extractDirectConnectPhoneDigits(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "");
}

/**
 * Real phone numbers are required for Direct Connect requests.
 * Matches the callable-length gate used for business number reveal.
 */
export function isValidDirectConnectRequestPhone(raw: unknown): boolean {
  const digits = extractDirectConnectPhoneDigits(raw);
  return digits.length >= 10 && digits.length <= 15;
}
