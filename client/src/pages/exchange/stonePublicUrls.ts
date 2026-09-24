import { selectedStoneAudienceSearch } from "@shared/exchangeStoneBuyerFlow";
export { selectedStoneAudienceSearch } from "@shared/exchangeStoneBuyerFlow";

const STONE_ID_PREFIX = "tradescout-stone-";
const STONE_MEDIA_PREFIX = "/api/exchange/stone-media/";

export function isPublicStoneId(id: string | undefined): boolean {
  return Boolean(id?.startsWith(STONE_ID_PREFIX));
}

/** A public detail link is usable only for this stone and its selected market. */
export function verifiedStoneDetailPath(path: unknown, stoneId: string): string | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;
  const url = new URL(path, "https://www.thetradescout.com");
  if (url.pathname !== `/exchange/building-materials/${encodeURIComponent(stoneId)}`) return null;
  const search = selectedStoneAudienceSearch(url.search);
  return search ? `${url.pathname}${search}` : null;
}

/** Stone media needs the same selected market as the approved detail link. */
export function audienceQualifiedStoneMedia(image: unknown, publicDetailPath: unknown, stoneId: string): string | null {
  if (typeof image !== "string" || image !== `${STONE_MEDIA_PREFIX}${encodeURIComponent(stoneId)}`) return null;
  const path = verifiedStoneDetailPath(publicDetailPath, stoneId);
  return path ? `${image}${new URL(path, "https://www.thetradescout.com").search}` : null;
}
