import rawManifest from "../scripts/data/red-graniti-public-media-manifest.json";

type RedGranitiPublicMediaAsset = Readonly<{
  relativePath: string;
  bytes: number;
  sha256: string;
  contentType: string;
}>;

type RedGranitiPublicMediaManifest = Readonly<{
  target: Readonly<{
    keyPrefix: string;
    legacyUrlPrefix: string;
  }>;
  expected: Readonly<{
    files: number;
    bytes: number;
  }>;
  assets: readonly RedGranitiPublicMediaAsset[];
}>;

export const RED_GRANITI_PUBLIC_MEDIA_MANIFEST = rawManifest as RedGranitiPublicMediaManifest;
export const RED_GRANITI_PUBLIC_MEDIA_FILE_COUNT = RED_GRANITI_PUBLIC_MEDIA_MANIFEST.expected.files;
export const RED_GRANITI_PUBLIC_MEDIA_BYTES = RED_GRANITI_PUBLIC_MEDIA_MANIFEST.expected.bytes;

const LEGACY_URL_PREFIX = RED_GRANITI_PUBLIC_MEDIA_MANIFEST.target.legacyUrlPrefix;
const OBJECT_KEY_PREFIX = RED_GRANITI_PUBLIC_MEDIA_MANIFEST.target.keyPrefix;
const ASSET_BY_RELATIVE_PATH: ReadonlyMap<string, RedGranitiPublicMediaAsset> = new Map(
  RED_GRANITI_PUBLIC_MEDIA_MANIFEST.assets.map((asset) => [asset.relativePath, asset])
);

function pathnameWithoutQueryOrHash(value: string): string {
  return value.split(/[?#]/, 1)[0] || "";
}

export function resolveRedGranitiPublicMediaAsset(
  publicUrlPath: unknown
): RedGranitiPublicMediaAsset | null {
  if (typeof publicUrlPath !== "string") return null;
  const pathname = pathnameWithoutQueryOrHash(publicUrlPath.trim());
  if (!pathname.startsWith(LEGACY_URL_PREFIX)) return null;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname.slice(LEGACY_URL_PREFIX.length));
  } catch {
    return null;
  }
  if (
    !relativePath ||
    relativePath.includes("..") ||
    relativePath.includes("\\") ||
    relativePath.includes("\0")
  ) {
    return null;
  }
  return ASSET_BY_RELATIVE_PATH.get(relativePath) ?? null;
}

export function resolveRedGranitiPublicMediaObjectKey(publicUrlPath: unknown): string | null {
  const asset = resolveRedGranitiPublicMediaAsset(publicUrlPath);
  return asset ? `${OBJECT_KEY_PREFIX}${asset.relativePath}` : null;
}
