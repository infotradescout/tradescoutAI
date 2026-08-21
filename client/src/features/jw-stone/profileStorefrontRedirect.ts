import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";

/**
 * Maps legacy JW Stone public profile storefront URLs to marketplace paths.
 * Admin edit (`/edit`) and booking (`?book=1`) stay on the profile surface.
 */
export function resolveJwStonePublicStorefrontRedirect(pathWithSearch: string): string | null {
  const raw = String(pathWithSearch || "");
  const hashIndex = raw.indexOf("#");
  const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const pathOnly = (queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash)
    .replace(/\/+$/, "")
    .toLowerCase();
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);

  if (params.get("book") === "1") return null;

  const profilePrefix = `/u/${JW_STONE_PROFILE_SLUG}`;
  const legacyPrefix = `/p/${JW_STONE_PROFILE_SLUG}`;
  let remainder = "";
  if (pathOnly === profilePrefix || pathOnly === legacyPrefix) {
    remainder = "";
  } else if (pathOnly.startsWith(`${profilePrefix}/`)) {
    remainder = pathOnly.slice(profilePrefix.length);
  } else if (pathOnly.startsWith(`${legacyPrefix}/`)) {
    remainder = pathOnly.slice(legacyPrefix.length);
  } else {
    return null;
  }

  if (remainder === "/edit" || remainder.startsWith("/edit/")) return null;

  const stoneMatch = remainder.match(/^\/stones\/([^/]+)$/);
  if (stoneMatch?.[1]) {
    const photo = params.get("photo");
    const photoSuffix = photo && /^\d+$/.test(photo) ? `?photo=${photo}` : "";
    return `/jw-stone/stones/${encodeURIComponent(decodeURIComponent(stoneMatch[1]))}${photoSuffix}${hash}`;
  }

  const materialMatch = remainder.match(/^\/materials\/([^/]+)$/);
  if (materialMatch?.[1]) {
    return `/jw-stone/materials/${encodeURIComponent(decodeURIComponent(materialMatch[1]))}${hash}`;
  }

  // Bare profile home (and unknown leftovers under the profile) → marketplace home.
  if (!remainder || remainder === "/") {
    if (params.get("profileAccount") === "1") {
      const resumeParams = new URLSearchParams({ profileAccount: "1" });
      if (params.get("profileAccountMode") === "signin") {
        resumeParams.set("profileAccountMode", "signin");
      }
      return `/jw-stone?${resumeParams.toString()}${hash}`;
    }
    const legacyStone = params.get("stone")?.trim().toLowerCase() || "";
    if (legacyStone) {
      const photo = params.get("photo");
      const photoSuffix = photo && /^\d+$/.test(photo) ? `?photo=${photo}` : "";
      return `/jw-stone/stones/${encodeURIComponent(legacyStone)}${photoSuffix}${hash}`;
    }
    const legacyCategory = params.get("category")?.trim().toLowerCase() || "";
    if (legacyCategory) {
      return `/jw-stone/materials/${encodeURIComponent(legacyCategory)}${hash}`;
    }
    return `/jw-stone${hash}`;
  }

  return `/jw-stone${hash}`;
}
