import rawManifest from "../scripts/data/jw-stone-public-media-manifest.json";

type JwStonePublicMediaAsset = Readonly<{
  relativePath: string;
  bytes: number;
  gitBlobSha: string;
  contentType: string;
}>;

type JwStonePublicMediaManifest = Readonly<{
  version: number;
  migrationId: string;
  source: Readonly<{
    repository: string;
    revision: string;
    pathPrefix: string;
  }>;
  target: Readonly<{
    storage: string;
    keyPrefix: string;
    legacyUrlPrefix: string;
  }>;
  expected: Readonly<{
    files: number;
    bytes: number;
    entryDigestSha256: string;
  }>;
  assets: readonly JwStonePublicMediaAsset[];
}>;

export const JW_STONE_PUBLIC_MEDIA_MANIFEST = rawManifest as JwStonePublicMediaManifest;
export const JW_STONE_PUBLIC_MEDIA_FILE_COUNT = JW_STONE_PUBLIC_MEDIA_MANIFEST.expected.files;
export const JW_STONE_PUBLIC_MEDIA_BYTES = JW_STONE_PUBLIC_MEDIA_MANIFEST.expected.bytes;

const LEGACY_URL_PREFIX = JW_STONE_PUBLIC_MEDIA_MANIFEST.target.legacyUrlPrefix;
const OBJECT_KEY_PREFIX = JW_STONE_PUBLIC_MEDIA_MANIFEST.target.keyPrefix;
const ASSET_BY_RELATIVE_PATH: ReadonlyMap<string, JwStonePublicMediaAsset> = new Map(
  JW_STONE_PUBLIC_MEDIA_MANIFEST.assets.map((asset) => [asset.relativePath, asset])
);

/**
 * The original generated white collage derivative returns bytes that Chromium
 * cannot decode reliably. Preserve the public URL, but serve a verified white
 * slab photo already present in the same pinned JW Stone media manifest.
 */
const PUBLIC_MEDIA_REPLACEMENT_BY_RELATIVE_PATH: ReadonlyMap<string, string> = new Map([
  [
    "color-collage/01-white.webp",
    "inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp",
  ],
]);

function pathnameWithoutQueryOrHash(value: string): string {
  return value.split(/[?#]/, 1)[0] || "";
}

export function resolveJwStonePublicMediaAsset(
  publicUrlPath: unknown
): JwStonePublicMediaAsset | null {
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

  const resolvedRelativePath =
    PUBLIC_MEDIA_REPLACEMENT_BY_RELATIVE_PATH.get(relativePath) ?? relativePath;
  return ASSET_BY_RELATIVE_PATH.get(resolvedRelativePath) ?? null;
}

export function isJwStonePublicMediaPath(publicUrlPath: unknown): boolean {
  return resolveJwStonePublicMediaAsset(publicUrlPath) !== null;
}

export function resolveJwStonePublicMediaObjectKey(publicUrlPath: unknown): string | null {
  const asset = resolveJwStonePublicMediaAsset(publicUrlPath);
  return asset ? `${OBJECT_KEY_PREFIX}${asset.relativePath}` : null;
}
