const STONE_ID_PREFIX = "tradescout-stone-";
const STONE_MEDIA_PREFIX = "/api/exchange/stone-media/";

export function isPublicStoneId(id: string | undefined): boolean {
  return Boolean(id?.startsWith(STONE_ID_PREFIX));
}

/** Only carry a selected market, never unrelated URL parameters, into stone requests. */
export function selectedStoneAudienceSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const state = params.get("audienceState");
  const country = params.get("audienceCountry");
  const city = params.get("audienceCity");
  if (!state || !/^[A-Z]{2}$/.test(state) || country !== "US") return null;
  if (state === "FL" && (!city?.trim() || city.length > 100)) return null;
  if (["audienceState", "audienceCountry", "audienceCity"].some((key) => params.getAll(key).length > 1)) return null;
  const selected = new URLSearchParams({ audienceState: state });
  if (state === "FL" && city) selected.set("audienceCity", city);
  selected.set("audienceCountry", country);
  return `?${selected.toString()}`;
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
