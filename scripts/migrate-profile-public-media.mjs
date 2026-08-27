#!/usr/bin/env node

import fs from "node:fs";
import {
  gitBlobSha,
  profilePublicMediaMarkerObjectKey,
  profilePublicMediaObjectMatches,
  profilePublicMediaSourceUrl,
  validateProfilePublicMediaManifest,
} from "./profile-public-media-core.mjs";
import {
  createDeploymentVerificationMarker,
  deploymentMarkerObjectKey,
  deploymentRevisionFromEnvironment,
  deploymentVerificationMarkerMatches,
} from "./public-media-deployment-gate-core.mjs";
import {
  createServerObjectStorageClient,
  requireServerObjectStorageConfiguration,
} from "./server-object-storage.mjs";
import { resolvePublicMediaManifest } from "./public-media-manifest-path.mjs";

const manifest = JSON.parse(
  fs.readFileSync(resolvePublicMediaManifest("profile-public-media-manifest.json"), "utf8")
);
const summary = validateProfilePublicMediaManifest(manifest);
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const verifyOnly = args.has("--verify-only");
const revision = deploymentRevisionFromEnvironment(process.env);
const concurrency = Math.max(
  1,
  Math.min(8, Number(process.env.PROFILE_MEDIA_MIGRATION_CONCURRENCY) || 4)
);

function isNotFound(error) {
  const status = Number(error?.$metadata?.httpStatusCode || 0);
  const code = String(error?.Code || error?.code || error?.name || "");
  return status === 404 || code === "NoSuchKey" || code === "NotFound";
}

async function bodyToBuffer(body) {
  if (body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body || [])
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function getObject(client, bucketName, key) {
  try {
    return await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function fetchPinned(asset) {
  const response = await fetch(profilePublicMediaSourceUrl(manifest, asset), {
    signal: AbortSignal.timeout(120_000),
    headers: { "User-Agent": "TradeScout-Profile-Public-Media-Migration/1" },
  });
  if (!response.ok)
    throw new Error(`${asset.publicPath}: immutable source responded ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  const blobSha = gitBlobSha(body);
  if (body.length !== asset.bytes || blobSha !== asset.gitBlobSha) {
    throw new Error(`${asset.publicPath}: immutable source identity did not match the manifest`);
  }
  return body;
}

async function readJson(client, bucketName, key) {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    return JSON.parse((await bodyToBuffer(response.Body)).toString("utf8"));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function migrationMarkerMatches(marker) {
  return (
    marker?.migrationId === manifest.migrationId &&
    marker?.entryDigestSha256 === summary.digest &&
    marker?.files === summary.files &&
    marker?.bytes === summary.bytes &&
    marker?.newObjects === summary.newObjects &&
    marker?.aliases === summary.aliases &&
    marker?.sourceRevision === manifest.source.revision
  );
}

async function runPool(items, limit, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    })
  );
}

if (dryRun) {
  console.log(
    `[profile-public-media-migration] dry run verified ${summary.files} paths, ${summary.newObjects} new objects, ${summary.aliases} aliases`
  );
  process.exit(0);
}

const { GetObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");
const configuration = requireServerObjectStorageConfiguration(process.env);
const client = await createServerObjectStorageClient(configuration);
const totals = { migrated: 0, reused: 0, aliases: 0, bytes: 0 };
const uniqueAssets = [
  ...new Map(manifest.assets.map((asset) => [asset.objectKey, asset])).values(),
];

await runPool(uniqueAssets, concurrency, async (asset) => {
  const existing = await getObject(client, configuration.bucketName, asset.objectKey);
  if (await profilePublicMediaObjectMatches(asset, existing, manifest.migrationId)) {
    totals.reused += asset.aliasOfExistingObject ? 0 : 1;
    return;
  }
  if (asset.aliasOfExistingObject) {
    throw new Error(
      `${asset.publicPath}: required existing JW alias object is missing or unverified`
    );
  }
  if (verifyOnly) throw new Error(`${asset.publicPath}: server object is missing or unverified`);
  const body = await fetchPinned(asset);
  await client.send(
    new PutObjectCommand({
      Bucket: configuration.bucketName,
      Key: asset.objectKey,
      Body: body,
      ContentType: asset.contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        "source-blob-sha": asset.gitBlobSha,
        "source-revision": manifest.source.revision,
        "migration-id": manifest.migrationId,
      },
    })
  );
  if (
    !(await profilePublicMediaObjectMatches(
      asset,
      await getObject(client, configuration.bucketName, asset.objectKey),
      manifest.migrationId
    ))
  ) {
    throw new Error(`${asset.publicPath}: uploaded object failed verification`);
  }
  totals.migrated += 1;
});

totals.aliases = summary.aliases;
totals.bytes = summary.bytes;

if (
  totals.bytes !== summary.bytes ||
  totals.aliases !== summary.aliases ||
  totals.migrated + totals.reused !== summary.newObjects
)
  throw new Error("Profile public media migration totals did not match the manifest");

const markerKey = profilePublicMediaMarkerObjectKey(manifest);
const existingMarker = await readJson(client, configuration.bucketName, markerKey);
if (!verifyOnly && (!migrationMarkerMatches(existingMarker) || totals.migrated > 0)) {
  const marker = {
    version: 1,
    migrationId: manifest.migrationId,
    sourceRevision: manifest.source.revision,
    entryDigestSha256: summary.digest,
    files: summary.files,
    bytes: summary.bytes,
    newObjects: summary.newObjects,
    aliases: summary.aliases,
    migratedAt: new Date().toISOString(),
  };
  await client.send(
    new PutObjectCommand({
      Bucket: configuration.bucketName,
      Key: markerKey,
      Body: JSON.stringify(marker),
      ContentType: "application/json",
      CacheControl: "no-store",
      Metadata: { "migration-id": manifest.migrationId },
    })
  );
  if (!migrationMarkerMatches(await readJson(client, configuration.bucketName, markerKey))) {
    throw new Error("Profile public media migration marker verification failed");
  }
}

if (revision) {
  const marker = createDeploymentVerificationMarker(manifest, summary, revision);
  const key = deploymentMarkerObjectKey(manifest, revision);
  await client.send(
    new PutObjectCommand({
      Bucket: configuration.bucketName,
      Key: key,
      Body: JSON.stringify(marker),
      ContentType: "application/json",
      CacheControl: "no-store",
      Metadata: { "migration-id": manifest.migrationId },
    })
  );
  const written = await readJson(client, configuration.bucketName, key);
  if (!deploymentVerificationMarkerMatches(written, manifest, summary, revision)) {
    throw new Error("Deployment-specific profile media verification marker failed");
  }
}

await client.close?.();
console.log(
  `[profile-public-media-migration] verified ${summary.files} paths (${summary.bytes} bytes); new migrated=${totals.migrated} reused=${totals.reused} aliases=${totals.aliases} backend=${configuration.provider}`
);
