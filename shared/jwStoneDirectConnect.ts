import { JW_STONE_PROFILE_SLUG, resolveJwStonePublicRequestName } from "./jwStonePresentation";

export const JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT = 50;

export type JwStoneDirectConnectSelection = {
  itemId: string;
  stoneName: string;
};

const MATERIAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Treat selection context as untrusted even when it came from our own UI.
 * Only named JW inventory may enter the multi-stone request handoff.
 */
export function sanitizeJwStoneDirectConnectSelections(args: {
  profileSlug?: unknown;
  selections?: readonly unknown[] | null;
}): JwStoneDirectConnectSelection[] {
  if (
    String(args.profileSlug || "")
      .trim()
      .toLowerCase() !== JW_STONE_PROFILE_SLUG ||
    !Array.isArray(args.selections)
  ) {
    return [];
  }

  const seen = new Set<string>();
  const sanitized: JwStoneDirectConnectSelection[] = [];

  for (const candidate of args.selections) {
    if (!candidate || typeof candidate !== "object") continue;
    const itemId = String((candidate as { itemId?: unknown }).itemId || "")
      .trim()
      .toLowerCase();
    const submittedName = String((candidate as { stoneName?: unknown }).stoneName || "").trim();
    if (!MATERIAL_SLUG_PATTERN.test(itemId) || itemId.length > 120 || seen.has(itemId)) continue;

    const stoneName = resolveJwStonePublicRequestName({
      profileSlug: JW_STONE_PROFILE_SLUG,
      itemId,
      stoneName: submittedName,
    });
    if (!stoneName || stoneName.length > 180) continue;

    seen.add(itemId);
    sanitized.push({ itemId, stoneName });
    if (sanitized.length >= JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT) break;
  }

  return sanitized;
}
