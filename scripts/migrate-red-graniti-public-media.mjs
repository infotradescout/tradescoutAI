#!/usr/bin/env node

import fs from "node:fs";
import {
  markerObjectKey,
  sha256,
  sourceAssetUrl,
  targetObjectKey,
  validateRedGranitiPublicMediaManifest,
} from "./red-graniti-public-media-core.mjs";
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
  fs.readFileSync(resolvePublicMediaManifest("red-graniti-public-media-manifest.json"), "utf8")
);
const summary = validateRedGranitiPublicMediaManifest(manifest);
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const verifyOnly = args.has("--verify-only");
const concurrency = Math.max(
  1,
  Math.min(6, Number.parseInt(process.env.RED_GRANITI_MEDIA_MIGRATION_CONCURRENCY || "3", 10) || 3)
);
const fetchTimeoutMs = Math.max(
  10_000,
  Number.parseInt(process.env.RED_GRANITI_MEDIA_FETCH_TIMEOUT_MS || "60000", 10) || 60_000
);
const deploymentRevision = deploymentRevisionFromEnvironment(process.env);

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
  for await (const chunk of body || []) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function objectMatches(asset, object) {
  return (
    Number(object?.ContentLength) === asset.bytes &&
    String(object?.Metadata?.["source-sha256"] || "") === asset.sha256 &&
    String(object?.Metadata?.["migration-id"] || "") === manifest.migrationId
  );
}

async function headObject(client, bucketName, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function readMarker(client, bucketName) {
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: markerObjectKey(manifest) })
    );
    return JSON.parse((await bodyToBuffer(response.Body)).toString("utf8"));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function markerMatches(marker) {
  return (
    marker?.migrationId === manifest.migrationId &&
    marker?.entryDigestSha256 === summary.digest &&
    marker?.files === summary.files &&
    marker?.bytes === summary.bytes &&
    marker?.sourceOrigin === manifest.source.origin
  );
}

async function fetchSourceAsset(asset) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceAssetUrl(manifest, asset.relativePath), {
        signal: AbortSignal.timeout(fetchTimeoutMs),
        headers: { "User-Agent": "TradeScout-Red-Graniti-Media-Migration/1" },
      });
      if (!response.ok) throw new Error(`source responded ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== asset.bytes) {
        throw new Error(`expected ${asset.bytes} bytes, received ${buffer.length}`);
      }
      if (sha256(buffer) !== asset.sha256) {
        throw new Error("source digest did not match the pinned manifest");
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(
    `${asset.relativePath}: failed to fetch pinned production source (${lastError instanceof Error ? lastError.message : "unknown error"})`
  );
}

async function processAsset(client, bucketName, asset, totals) {
  const key = targetObjectKey(manifest, asset.relativePath);
  const existing = await headObject(client, bucketName, key);
  if (objectMatches(asset, existing)) {
    totals.reused += 1;
    totals.bytes += asset.bytes;
    return;
  }
  if (verifyOnly) {
    throw new Error(`${asset.relativePath}: server object is missing or unverified`);
  }

  const body = await fetchSourceAsset(asset);
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: asset.contentType,
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        "source-sha256": asset.sha256,
        "source-origin": "thetradescout-production",
        "migration-id": manifest.migrationId,
      },
    })
  );
  const verified = await headObject(client, bucketName, key);
  if (!objectMatches(asset, verified)) {
    throw new Error(`${asset.relativePath}: uploaded object failed verification`);
  }
  totals.migrated += 1;
  totals.bytes += asset.bytes;
}

async function runPool(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

if (dryRun) {
  console.log(
    `[red-graniti-media-migration] dry run verified manifest: ${summary.files} files, ${summary.bytes} bytes, ${summary.digest}`
  );
  process.exit(0);
}

const { GetObjectCommand, HeadObjectCommand, PutObjectCommand } =
  await import("@aws-sdk/client-s3");
const configuration = requireServerObjectStorageConfiguration(process.env);
const client = await createServerObjectStorageClient(configuration);

const existingMarker = await readMarker(client, configuration.bucketName);
const existingMarkerMatches = markerMatches(existingMarker);

const totals = { migrated: 0, reused: 0, bytes: 0 };
await runPool(manifest.assets, concurrency, async (asset) => {
  await processAsset(client, configuration.bucketName, asset, totals);
});

if (totals.bytes !== summary.bytes || totals.migrated + totals.reused !== summary.files) {
  throw new Error("R.E.D. Graniti media migration totals did not match the manifest");
}

if (!verifyOnly && (!existingMarkerMatches || totals.migrated > 0)) {
  const marker = {
    version: 1,
    migrationId: manifest.migrationId,
    sourceOrigin: manifest.source.origin,
    entryDigestSha256: summary.digest,
    files: summary.files,
    bytes: summary.bytes,
    migratedAt: new Date().toISOString(),
  };
  await client.send(
    new PutObjectCommand({
      Bucket: configuration.bucketName,
      Key: markerObjectKey(manifest),
      Body: JSON.stringify(marker),
      ContentType: "application/json",
      CacheControl: "no-store",
      Metadata: { "migration-id": manifest.migrationId },
    })
  );
  const writtenMarker = await readMarker(client, configuration.bucketName);
  if (!markerMatches(writtenMarker)) throw new Error("Migration marker verification failed");
}

if (deploymentRevision) {
  const deploymentMarker = createDeploymentVerificationMarker(
    manifest,
    summary,
    deploymentRevision
  );
  const deploymentKey = deploymentMarkerObjectKey(manifest, deploymentRevision);
  await client.send(
    new PutObjectCommand({
      Bucket: configuration.bucketName,
      Key: deploymentKey,
      Body: JSON.stringify(deploymentMarker),
      ContentType: "application/json",
      CacheControl: "no-store",
      Metadata: { "migration-id": manifest.migrationId },
    })
  );
  const writtenDeploymentMarker = JSON.parse(
    (
      await bodyToBuffer(
        (
          await client.send(
            new GetObjectCommand({ Bucket: configuration.bucketName, Key: deploymentKey })
          )
        ).Body
      )
    ).toString("utf8")
  );
  if (
    !deploymentVerificationMarkerMatches(
      writtenDeploymentMarker,
      manifest,
      summary,
      deploymentRevision
    )
  ) {
    throw new Error("Deployment-specific R.E.D. Graniti media verification marker failed");
  }
}

await client.close?.();
console.log(
  `[red-graniti-media-migration] verified ${summary.files} files (${summary.bytes} bytes); migrated=${totals.migrated} reused=${totals.reused} backend=${configuration.provider}`
);
