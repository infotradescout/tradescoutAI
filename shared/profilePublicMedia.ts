import rawManifest from "../scripts/data/profile-public-media-manifest.json";

type ProfilePublicMediaAsset = Readonly<{
  publicPath: string;
  objectKey: string;
  bytes: number;
  gitBlobSha: string;
  contentType: string;
  aliasOfExistingObject: boolean;
}>;

type ProfilePublicMediaManifest = Readonly<{
  expected: Readonly<{ paths: number; bytes: number; aliases: number; newObjects: number }>;
  assets: readonly ProfilePublicMediaAsset[];
}>;

export const PROFILE_PUBLIC_MEDIA_MANIFEST = rawManifest as ProfilePublicMediaManifest;
const ASSET_BY_PUBLIC_PATH: ReadonlyMap<string, ProfilePublicMediaAsset> = new Map(
  PROFILE_PUBLIC_MEDIA_MANIFEST.assets.map((asset) => [asset.publicPath, asset])
);

function safePathname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const pathname = value.trim().split(/[?#]/, 1)[0] || "";
  if (
    !pathname.startsWith("/images/") ||
    /[\\\0]/.test(pathname) ||
    /%(?:2f|5c|25(?:2f|5c))/i.test(pathname)
  )
    return null;
  try {
    const decoded = decodeURIComponent(pathname);
    if (decoded.includes("..") || /[\\\0]/.test(decoded) || /%(?:2f|5c|25(?:2f|5c))/i.test(decoded))
      return null;
    return decoded;
  } catch {
    return null;
  }
}

export function resolveProfilePublicMediaAsset(value: unknown): ProfilePublicMediaAsset | null {
  const pathname = safePathname(value);
  return pathname ? (ASSET_BY_PUBLIC_PATH.get(pathname) ?? null) : null;
}

export function resolveProfilePublicMediaObjectKey(value: unknown): string | null {
  return resolveProfilePublicMediaAsset(value)?.objectKey ?? null;
}
