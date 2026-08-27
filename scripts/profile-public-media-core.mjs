import { createHash } from "node:crypto";

const SAFE_PUBLIC_PATH = /^\/images\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const SAFE_OBJECT_KEY = /^public-media\/images\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const GIT_BLOB_SHA = /^[a-f0-9]{40}$/;

export function canonicalProfilePublicMediaEntries(assets) {
  return assets
    .map(
      (asset) => `${asset.publicPath}\t${asset.objectKey}\t${asset.gitBlobSha}\t${asset.bytes}\n`
    )
    .join("");
}

export function profilePublicMediaEntryDigest(assets) {
  return createHash("sha256").update(canonicalProfilePublicMediaEntries(assets)).digest("hex");
}

export function profilePublicMediaSourceUrl(manifest, asset) {
  const sourcePath = `${manifest.source.pathPrefix}${asset.publicPath}`;
  const encodedPath = sourcePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://raw.githubusercontent.com/${manifest.source.repository}/${manifest.source.revision}/${encodedPath}`;
}

export function profilePublicMediaMarkerObjectKey(manifest) {
  return `public-media/manifests/${manifest.migrationId}.json`;
}

async function objectBodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body || []) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function profilePublicMediaObjectMatches(asset, object, migrationId) {
  if (
    Number(object?.ContentLength) !== asset.bytes ||
    String(object?.Metadata?.["source-blob-sha"] || "") !== asset.gitBlobSha ||
    String(object?.ContentType || "").toLowerCase() !== asset.contentType ||
    String(object?.CacheControl || "").toLowerCase() !== "public, max-age=31536000, immutable"
  ) {
    return false;
  }
  if (
    asset.aliasOfExistingObject !== true &&
    String(object?.Metadata?.["migration-id"] || "") !== migrationId
  ) {
    return false;
  }
  const body = await objectBodyToBuffer(object?.Body);
  return body.length === asset.bytes && gitBlobSha(body) === asset.gitBlobSha;
}

export function gitBlobSha(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export function validateProfilePublicMediaManifest(manifest) {
  if (!manifest || typeof manifest !== "object")
    throw new Error("Profile media manifest is missing");
  if (manifest.version !== 1) throw new Error("Unsupported profile media manifest version");
  if (manifest.migrationId !== "profile-public-media-v1") {
    throw new Error("Unexpected profile public media migration id");
  }
  if (manifest.source?.repository !== "infotradescout/tradescoutAI") {
    throw new Error("Unexpected profile media source repository");
  }
  if (!GIT_BLOB_SHA.test(String(manifest.source?.revision || ""))) {
    throw new Error("Profile media source revision is not immutable");
  }
  if (manifest.source?.pathPrefix !== "client/public") {
    throw new Error("Unexpected profile media source prefix");
  }
  if (manifest.target?.storage !== "server-object-storage") {
    throw new Error("Profile media must target production server object storage");
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error("Profile media manifest has no assets");
  }

  const publicPaths = new Set();
  const objectIdentities = new Map();
  let bytes = 0;
  let aliases = 0;
  let newObjects = 0;
  let newObjectBytes = 0;
  for (const asset of manifest.assets) {
    const publicPath = String(asset?.publicPath || "");
    const objectKey = String(asset?.objectKey || "");
    if (
      !SAFE_PUBLIC_PATH.test(publicPath) ||
      publicPath.includes("..") ||
      publicPath.includes("\\")
    ) {
      throw new Error(`Unsafe profile media public path: ${publicPath || "(empty)"}`);
    }
    if (!SAFE_OBJECT_KEY.test(objectKey) || objectKey.includes("..") || objectKey.includes("\\")) {
      throw new Error(`Unsafe profile media object key: ${objectKey || "(empty)"}`);
    }
    if (publicPaths.has(publicPath)) throw new Error(`Duplicate profile media path: ${publicPath}`);
    publicPaths.add(publicPath);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) {
      throw new Error(`Invalid profile media byte count: ${publicPath}`);
    }
    if (!GIT_BLOB_SHA.test(String(asset.gitBlobSha || ""))) {
      throw new Error(`Invalid profile media Git blob identity: ${publicPath}`);
    }
    const identity = `${asset.gitBlobSha}\t${asset.bytes}\t${asset.contentType}`;
    const existingIdentity = objectIdentities.get(objectKey);
    if (existingIdentity && existingIdentity !== identity) {
      throw new Error(`Conflicting profile media object aliases: ${objectKey}`);
    }
    objectIdentities.set(objectKey, identity);
    if (!/^(?:image\/[a-z0-9.+-]+|video\/mp4)$/.test(String(asset.contentType || ""))) {
      throw new Error(`Invalid profile media content type: ${publicPath}`);
    }
    bytes += asset.bytes;
    if (asset.aliasOfExistingObject === true) {
      aliases += 1;
      if (!objectKey.startsWith("public-media/images/businesses/jw-stone/")) {
        throw new Error(
          `Profile media alias does not target the pinned JW namespace: ${publicPath}`
        );
      }
    } else if (asset.aliasOfExistingObject === false) {
      newObjects += 1;
      newObjectBytes += asset.bytes;
      if (objectKey !== `public-media${publicPath}`) {
        throw new Error(`Profile media object key changed its compatibility path: ${publicPath}`);
      }
    } else {
      throw new Error(`Profile media alias identity is missing: ${publicPath}`);
    }
  }

  const digest = profilePublicMediaEntryDigest(manifest.assets);
  const expected = manifest.expected || {};
  const actual = {
    files: manifest.assets.length,
    bytes,
    newObjects,
    newObjectBytes,
    aliases,
    digest,
  };
  if (
    expected.paths !== actual.files ||
    expected.bytes !== bytes ||
    expected.newObjects !== newObjects ||
    expected.newObjectBytes !== newObjectBytes ||
    expected.aliases !== aliases ||
    expected.entryDigestSha256 !== digest
  ) {
    throw new Error("Profile media manifest totals do not match its entries");
  }
  if (
    actual.files !== 56 ||
    bytes !== 24_531_208 ||
    aliases !== 13 ||
    newObjects !== 43 ||
    newObjectBytes !== 20_585_139
  ) {
    throw new Error("Profile media migration contract changed without an explicit version bump");
  }
  return Object.freeze(actual);
}
