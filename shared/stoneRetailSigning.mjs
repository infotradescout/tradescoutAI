/** Retail publication and acquisition signatures are domain-separated by their
 * existing HMAC protocols. Neither grants authentication or contact authority.
 * A dedicated key avoids rotating the application's existing login-session key.
 * A malformed explicit dedicated key fails closed, never silently falls back.
 * Legacy valid session keys remain supported only when no dedicated key is set.
 */
export function resolveStoneRetailSigningSecret(environment = process.env) {
  const dedicated = environment.STONE_RETAIL_SIGNING_SECRET;
  if (dedicated !== undefined) {
    return typeof dedicated === 'string' && dedicated.length >= 32 && dedicated.length <= 1000 && dedicated.trim() === dedicated ? dedicated : '';
  }
  const legacy = environment.SESSION_SECRET;
  return typeof legacy === 'string' && legacy.length >= 24 ? legacy : '';
}
