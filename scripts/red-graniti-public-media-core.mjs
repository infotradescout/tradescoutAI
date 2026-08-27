import { createHash } from "node:crypto";

const SAFE_RELATIVE_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;

export function canonicalManifestEntries(assets) {
  return assets.map((asset) => `${asset.relativePath}\t${asset.sha256}\t${asset.bytes}\n`).join("");
}

export function manifestEntryDigest(assets) {
  return createHash("sha256").update(canonicalManifestEntries(assets)).digest("hex");
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sourceAssetUrl(manifest, relativePath) {
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${manifest.source.origin}${manifest.source.legacyUrlPrefix}${encodedPath}`;
}

export function targetObjectKey(manifest, relativePath) {
  return `${manifest.target.keyPrefix}${relativePath}`;
}

export function markerObjectKey(manifest) {
  return `public-media/manifests/${manifest.migrationId}.json`;
}

export function validateRedGranitiPublicMediaManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("Media manifest is missing");
  if (manifest.version !== 1) throw new Error("Unsupported media manifest version");
  if (manifest.migrationId !== "red-graniti-public-media-v1") {
    throw new Error("Unexpected R.E.D. Graniti media migration id");
  }
  if (
    manifest.source?.kind !== "current-production" ||
    manifest.source?.origin !== "https://www.thetradescout.com"
  ) {
    throw new Error("Unexpected R.E.D. Graniti migration source");
  }
  if (manifest.source?.legacyUrlPrefix !== "/images/businesses/red-graniti/source/") {
    throw new Error("Unexpected R.E.D. Graniti source URL prefix");
  }
  if (manifest.target?.storage !== "cloudflare-r2") {
    throw new Error("R.E.D. Graniti media must target Cloudflare R2");
  }
  if (manifest.target?.keyPrefix !== "public-media/images/businesses/red-graniti/source/") {
    throw new Error("Unexpected R.E.D. Graniti object prefix");
  }
  if (manifest.target?.legacyUrlPrefix !== manifest.source.legacyUrlPrefix) {
    throw new Error("Legacy R.E.D. Graniti image URL contract changed");
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error("Media manifest has no assets");
  }

  const seen = new Set();
  let bytes = 0;
  for (const asset of manifest.assets) {
    const relativePath = String(asset?.relativePath || "");
    if (
      !SAFE_RELATIVE_PATH.test(relativePath) ||
      relativePath.includes("..") ||
      relativePath.includes("\\")
    ) {
      throw new Error(`Unsafe media path: ${relativePath || "(empty)"}`);
    }
    if (seen.has(relativePath)) throw new Error(`Duplicate media path: ${relativePath}`);
    seen.add(relativePath);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) {
      throw new Error(`Invalid media byte count: ${relativePath}`);
    }
    if (!SHA256.test(String(asset.sha256 || ""))) {
      throw new Error(`Invalid media digest: ${relativePath}`);
    }
    if (asset.contentType !== "image/svg+xml") {
      throw new Error(`Invalid public media content type: ${relativePath}`);
    }
    bytes += asset.bytes;
  }

  if (manifest.expected?.files !== manifest.assets.length) {
    throw new Error("Media manifest file count does not match its entries");
  }
  if (manifest.expected?.bytes !== bytes) {
    throw new Error("Media manifest byte count does not match its entries");
  }
  const digest = manifestEntryDigest(manifest.assets);
  if (manifest.expected?.entryDigestSha256 !== digest) {
    throw new Error("Media manifest digest does not match its entries");
  }
  return Object.freeze({ files: manifest.assets.length, bytes, digest });
}
