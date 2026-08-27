#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  gitBlobSha,
  markerObjectKey,
  sourceAssetUrl,
  targetObjectKey,
  validateJwStonePublicMediaManifest,
} from "./jw-stone-public-media-core.mjs";
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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "scripts/data/jw-stone-public-media-manifest.json"), "utf8")
);
const summary = validateJwStonePublicMediaManifest(manifest);
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const verifyOnly = args.has("--verify-only");
const concurrency = Math.max(
  1,
  Math.min(12, Number.parseInt(process.env.JW_STONE_MEDIA_MIGRATION_CONCURRENCY || "4", 10) || 4)
);
const fetchTimeoutMs = Math.max(
  10_000,
  Number.parseInt(process.env.JW_STONE_MEDIA_FETCH_TIMEOUT_MS || "120000", 10) || 120_000
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
    String(object?.Metadata?.["source-blob-sha"] || "") === asset.gitBlobSha &&
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
    marker?.sourceRevision === manifest.source.revision
  );
}

async function fetchSourceAsset(asset) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceAssetUrl(manifest, asset.relativePath), {
        signal: AbortSignal.timeout(fetchTimeoutMs),
        headers: { "User-Agent": "TradeScout-JW-Stone-Media-Migration/1" },
      });
      if (!response.ok) throw new Error(`source responded ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length !== asset.bytes) {
        throw new Error(`expected ${asset.bytes} bytes, received ${buffer.length}`);
      }
      const actualBlobSha = gitBlobSha(buffer);
      if (actualBlobSha !== asset.gitBlobSha) {
        throw new Error("source Git blob identity did not match the pinned manifest");
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(
    `${asset.relativePath}: failed to fetch immutable source (${lastError instanceof Error ? lastError.message : "unknown error"})`
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
        "source-blob-sha": asset.gitBlobSha,
        "source-revision": manifest.source.revision,
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
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

if (dryRun) {
  console.log(
    `[jw-stone-media-migration] dry run verified manifest: ${summary.files} files, ${summary.bytes} bytes, ${summary.digest}`
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
await runPool(manifest.assets, concurrency, async (asset, index) => {
  await processAsset(client, configuration.bucketName, asset, totals);
  const completed = index + 1;
  if (completed % 50 === 0 || completed === summary.files) {
    console.log(`[jw-stone-media-migration] processed ${completed}/${summary.files}`);
  }
});

if (totals.bytes !== summary.bytes || totals.migrated + totals.reused !== summary.files) {
  throw new Error("JW Stone media migration totals did not match the manifest");
}

if (!verifyOnly && (!existingMarkerMatches || totals.migrated > 0)) {
  const marker = {
    version: 1,
    migrationId: manifest.migrationId,
    sourceRevision: manifest.source.revision,
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
    throw new Error("Deployment-specific JW Stone media verification marker failed");
  }
}

await client.close?.();
console.log(
  `[jw-stone-media-migration] verified ${summary.files} files (${summary.bytes} bytes); migrated=${totals.migrated} reused=${totals.reused} backend=${configuration.provider}`
);
