import { createHash } from "node:crypto";

const SAFE_RELATIVE_PATH = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const GIT_BLOB_SHA = /^[a-f0-9]{40}$/;

export function canonicalManifestEntries(assets) {
  return assets
    .map((asset) => `${asset.relativePath}\t${asset.gitBlobSha}\t${asset.bytes}\n`)
    .join("");
}

export function manifestEntryDigest(assets) {
  return createHash("sha256").update(canonicalManifestEntries(assets)).digest("hex");
}

export function gitBlobSha(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export function sourceAssetUrl(manifest, relativePath) {
  const encodedPath = `${manifest.source.pathPrefix}${relativePath}`
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${manifest.source.repository}/${manifest.source.revision}/${encodedPath}`;
}

export function targetObjectKey(manifest, relativePath) {
  return `${manifest.target.keyPrefix}${relativePath}`;
}

export function markerObjectKey(manifest) {
  return `public-media/manifests/${manifest.migrationId}.json`;
}

export function validateJwStonePublicMediaManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("Media manifest is missing");
  if (manifest.version !== 1) throw new Error("Unsupported media manifest version");
  if (manifest.migrationId !== "jw-stone-public-media-v1") {
    throw new Error("Unexpected JW Stone media migration id");
  }
  if (manifest.source?.repository !== "infotradescout/tradescoutAI") {
    throw new Error("Unexpected media source repository");
  }
  if (!GIT_BLOB_SHA.test(String(manifest.source?.revision || ""))) {
    throw new Error("Media source revision is not immutable");
  }
  if (manifest.source?.pathPrefix !== "client/public/images/businesses/jw-stone/") {
    throw new Error("Unexpected media source prefix");
  }
  if (manifest.target?.storage !== "server-object-storage") {
    throw new Error("JW Stone media must target production server object storage");
  }
  if (manifest.target?.keyPrefix !== "public-media/images/businesses/jw-stone/") {
    throw new Error("Unexpected public media object prefix");
  }
  if (manifest.target?.legacyUrlPrefix !== "/images/businesses/jw-stone/") {
    throw new Error("Legacy JW Stone image URL contract changed");
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
    if (!GIT_BLOB_SHA.test(String(asset.gitBlobSha || ""))) {
      throw new Error(`Invalid Git blob identity: ${relativePath}`);
    }
    if (!/^(?:image\/[a-z0-9.+-]+|video\/mp4)$/.test(String(asset.contentType || ""))) {
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
