export const TRADESCOUT_PUBLIC_ORIGIN = "https://www.thetradescout.com";

/**
 * Returns the platform-owned TradeScout origin used by shared platform schema.
 *
 * Custom-domain profile metadata must supply its server-verified canonical URL
 * through the profile-specific canonical field; browser host headers are never
 * treated as proof that a mapped domain is authorized.
 */
export function canonicalPublicOrigin(runtimeOrigin?: string) {
  if (!runtimeOrigin) return TRADESCOUT_PUBLIC_ORIGIN;

  try {
    const parsed = new URL(runtimeOrigin);
    const host = parsed.hostname.toLowerCase();
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    if (isHttp && (host === "localhost" || host === "127.0.0.1")) {
      return parsed.origin;
    }
  } catch {
    // Invalid and proxy-influenced origins must not enter public metadata.
  }

  return TRADESCOUT_PUBLIC_ORIGIN;
}
