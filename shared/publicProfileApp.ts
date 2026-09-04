const PROFILE_MANIFEST_PREFIX = "/profile-manifests/";
const PROFILE_ICON_PREFIX = "/profile-app-icons/";

export function normalizePublicProfileAppSlug(value: unknown): string | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(normalized)) return null;
  return normalized;
}

export function buildPublicProfileAppManifestPath(slug: unknown): string | null {
  const normalized = normalizePublicProfileAppSlug(slug);
  return normalized
    ? `${PROFILE_MANIFEST_PREFIX}${encodeURIComponent(normalized)}.webmanifest`
    : null;
}

export function buildPublicProfileAppIconPath(slug: unknown, size: 192 | 512): string | null {
  const normalized = normalizePublicProfileAppSlug(slug);
  return normalized ? `${PROFILE_ICON_PREFIX}${encodeURIComponent(normalized)}/${size}.png` : null;
}

export function parsePublicProfileAppManifestFile(value: unknown): string | null {
  const file = String(value || "").trim();
  if (!file.toLowerCase().endsWith(".webmanifest")) return null;
  const rawSlug = file.slice(0, -".webmanifest".length);
  try {
    return normalizePublicProfileAppSlug(decodeURIComponent(rawSlug));
  } catch {
    return null;
  }
}
