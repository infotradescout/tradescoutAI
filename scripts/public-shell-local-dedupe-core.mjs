import { createHash } from "node:crypto";

const SAFE_PATH = /^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const BLOB_SHA = /^[a-f0-9]{40}$/;
const DYNAMIC_LANDING_MEDIA = /\/landing\/\$\{[^}\r\n]+\}[^`'"\r\n]*\.(?:jpg|png|svg|webp)(?:[?#][^`'"\r\n]*)?/i;

export function assertNoUnreviewedDynamicLandingMedia(sourceByPath, reviewedAllowlist = []) {
  const allowed = new Set(reviewedAllowlist);
  for (const [sourcePath, source] of sourceByPath) {
    if (!allowed.has(sourcePath) && DYNAMIC_LANDING_MEDIA.test(source)) {
      throw new Error(`Dynamic landing media construction requires explicit review: ${sourcePath}`);
    }
  }
}

export function shellDedupeDigest(entries) {
  return createHash("sha256")
    .update(
      entries
        .map(
          (entry) =>
            `${entry.kind}\t${entry.publicPath}\t${entry.canonicalPath || ""}\t${entry.gitBlobSha}\t${entry.bytes}\t${entry.contentType}\n`
        )
        .join("")
    )
    .digest("hex");
}

export function gitBlobSha(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export function validatePublicShellDedupeManifest(manifest) {
  if (manifest?.version !== 3 || manifest?.contractId !== "public-shell-local-dedupe-v3") {
    throw new Error("Unexpected public shell dedupe contract");
  }
  if (
    manifest.source?.repository !== "infotradescout/tradescoutAI" ||
    manifest.source?.revision !== "2d2ff5539bf3505fd637524609a3725409dc7dc1" ||
    manifest.source?.pathPrefix !== "client/public"
  ) {
    throw new Error("Public shell dedupe source is not the pinned PR500 release");
  }
  const seen = new Set();
  let bytes = 0;
  let aliases = 0;
  let deadPinned = 0;
  for (const entry of manifest.entries || []) {
    if (!SAFE_PATH.test(entry.publicPath) || entry.publicPath.includes("..")) {
      throw new Error(`Unsafe public shell path: ${entry.publicPath || "(empty)"}`);
    }
    if (seen.has(entry.publicPath))
      throw new Error(`Duplicate public shell path: ${entry.publicPath}`);
    seen.add(entry.publicPath);
    if (
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !BLOB_SHA.test(entry.gitBlobSha)
    ) {
      throw new Error(`Invalid public shell identity: ${entry.publicPath}`);
    }
    if (!new Set(["image/png", "image/webp", "image/svg+xml"]).has(entry.contentType)) {
      throw new Error(`Invalid public shell content type: ${entry.publicPath}`);
    }
    if (entry.kind === "alias") {
      aliases += 1;
      if (!SAFE_PATH.test(entry.canonicalPath) || entry.canonicalPath === entry.publicPath) {
        throw new Error(`Unsafe public shell alias: ${entry.publicPath}`);
      }
    } else if (entry.kind === "dead-pinned") {
      deadPinned += 1;
      if (entry.canonicalPath) throw new Error(`Dead path cannot redirect: ${entry.publicPath}`);
    } else {
      throw new Error(`Unknown public shell entry kind: ${entry.publicPath}`);
    }
    bytes += entry.bytes;
  }
  const digest = shellDedupeDigest(manifest.entries);
  if (
    manifest.expected?.files !== 10 ||
    manifest.expected?.bytes !== 1_433_218 ||
    manifest.expected?.aliases !== 6 ||
    manifest.expected?.deadPinned !== 4 ||
    manifest.expected?.clientPublicFiles !== 200 ||
    // v3 adds only the reviewed 171-byte /pensacola sitemap entry; media identities are unchanged.
    manifest.expected?.clientPublicBytes !== 2_804_092 ||
    manifest.expected?.entryDigestSha256 !== digest ||
    manifest.entries.length !== 10 ||
    bytes !== 1_433_218 ||
    aliases !== 6 ||
    deadPinned !== 4
  ) {
    throw new Error("Public shell dedupe totals changed without a version bump");
  }
  const owners = manifest.liveLandingOwners || {};
  if (
    JSON.stringify(owners["/landing/hero.jpg"]) !==
      JSON.stringify(["client/src/index.css", "client/src/pages/landingVariants.ts"]) ||
    JSON.stringify(owners["/landing/community.jpg"]) !==
      JSON.stringify(["client/src/pages/landingVariants.ts"])
  ) {
    throw new Error("Live landing asset ownership changed without review");
  }
  return Object.freeze({ files: 10, bytes, aliases, deadPinned, digest });
}
