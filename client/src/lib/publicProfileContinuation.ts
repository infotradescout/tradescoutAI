export type PublicProfileContinuation = {
  profileSlug: string;
  profileName: string;
  itemName?: string;
};

const PROFILE_SOURCE = "public_profile";

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanSlug(value: unknown): string {
  const slug = cleanText(value, 128).toLowerCase();
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) ? slug : "";
}

export function appendPublicProfileContinuation(
  href: string,
  context: PublicProfileContinuation
): string {
  const slug = cleanSlug(context.profileSlug);
  const profileName = cleanText(context.profileName, 120);
  const itemName = cleanText(context.itemName, 120);
  if (!slug || !profileName) return href;

  const isAbsolute = /^https?:\/\//i.test(href);
  const url = new URL(href, "https://tradescout.local");
  url.searchParams.set("from", PROFILE_SOURCE);
  url.searchParams.set("profile", slug);
  url.searchParams.set("profileName", profileName);
  if (itemName) url.searchParams.set("item", itemName);

  if (isAbsolute) return url.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

export function parsePublicProfileContinuation(location: string): PublicProfileContinuation | null {
  const searchIndex = location.indexOf("?");
  if (searchIndex < 0) return null;
  const params = new URLSearchParams(location.slice(searchIndex + 1).split("#")[0]);
  if (params.get("from") !== PROFILE_SOURCE) return null;

  const profileSlug = cleanSlug(params.get("profile"));
  const profileName = cleanText(params.get("profileName"), 120);
  const itemName = cleanText(params.get("item"), 120);
  if (!profileSlug || !profileName) return null;

  return {
    profileSlug,
    profileName,
    ...(itemName ? { itemName } : {}),
  };
}
