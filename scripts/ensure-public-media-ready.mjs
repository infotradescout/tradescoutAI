#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  deploymentMarkerObjectKey,
  deploymentRevisionFromEnvironment,
  deploymentVerificationMarkerMatches,
  migrationArgumentsForReadiness,
} from "./public-media-deployment-gate-core.mjs";
import { validateJwStonePublicMediaManifest } from "./jw-stone-public-media-core.mjs";
import { validateRedGranitiPublicMediaManifest } from "./red-graniti-public-media-core.mjs";
import { validateProfilePublicMediaManifest } from "./profile-public-media-core.mjs";
import {
  createServerObjectStorageClient,
  requireServerObjectStorageConfiguration,
} from "./server-object-storage.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function findRuntimeRoot(start) {
  let current = start;
  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

const repoRoot = findRuntimeRoot(scriptDirectory);

function readManifest(relativePath) {
  const manifestDirectory = String(process.env.PUBLIC_MEDIA_MANIFEST_DIR || "").trim();
  const filename = path.basename(relativePath);
  const bundledPath = path.join(scriptDirectory, "manifests", filename);
  const configuredPath = manifestDirectory ? path.join(manifestDirectory, filename) : null;
  const sourcePath = path.join(repoRoot, relativePath);
  const manifestPath = configuredPath || (fs.existsSync(bundledPath) ? bundledPath : sourcePath);
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function envValue(key) {
  return String(process.env[key] || "").trim();
}

async function bodyToJson(body, contentLength) {
  if (Number(contentLength || 0) > 32 * 1024) {
    throw new SyntaxError("Public media deployment marker is unexpectedly large");
  }
  if (body && typeof body.transformToString === "function") {
    return JSON.parse(await body.transformToString("utf8"));
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of body || []) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 32 * 1024) {
      throw new SyntaxError("Public media deployment marker is unexpectedly large");
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function markerIsReady(client, GetObjectCommand, bucketName, contract, revision) {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: deploymentMarkerObjectKey(contract.manifest, revision),
      })
    );
    const marker = await bodyToJson(response.Body, response.ContentLength);
    return deploymentVerificationMarkerMatches(
      marker,
      contract.manifest,
      contract.summary,
      revision
    );
  } catch (error) {
    const status = Number(error?.$metadata?.httpStatusCode || 0);
    const code = String(error?.Code || error?.code || error?.name || "");
    if (
      error instanceof SyntaxError ||
      status === 404 ||
      code === "NoSuchKey" ||
      code === "NotFound"
    ) {
      return false;
    }
    throw error;
  }
}

function runMigration(scriptName, args = []) {
  const bundledPath = path.join(scriptDirectory, scriptName);
  const sourcePath = path.join(repoRoot, "scripts", scriptName);
  const executablePath = fs.existsSync(bundledPath) ? bundledPath : sourcePath;
  const result = spawnSync(process.execPath, [executablePath, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status ?? "unknown"}`);
  }
}

if (envValue("RENDER") !== "true") {
  console.log("[public-media-readiness] non-Render runtime; deployment gate skipped");
  process.exit(0);
}

const revision = deploymentRevisionFromEnvironment(process.env);
if (!revision) throw new Error("Render did not provide RENDER_GIT_COMMIT");

const jwManifest = readManifest("scripts/data/jw-stone-public-media-manifest.json");
const redManifest = readManifest("scripts/data/red-graniti-public-media-manifest.json");
const profileManifest = readManifest("scripts/data/profile-public-media-manifest.json");
const contracts = [
  {
    manifest: redManifest,
    summary: validateRedGranitiPublicMediaManifest(redManifest),
    migrationScript: "migrate-red-graniti-public-media.mjs",
  },
  {
    manifest: jwManifest,
    summary: validateJwStonePublicMediaManifest(jwManifest),
    migrationScript: "migrate-jw-stone-public-media.mjs",
  },
  {
    manifest: profileManifest,
    summary: validateProfilePublicMediaManifest(profileManifest),
    migrationScript: "migrate-profile-public-media.mjs",
    alwaysVerify: true,
  },
];

const { GetObjectCommand } = await import("@aws-sdk/client-s3");
const configuration = requireServerObjectStorageConfiguration(process.env);
const client = await createServerObjectStorageClient(configuration);

const initialReadiness = await Promise.all(
  contracts.map((contract) =>
    markerIsReady(client, GetObjectCommand, configuration.bucketName, contract, revision)
  )
);

for (let index = 0; index < contracts.length; index += 1) {
  const migrationArgs = migrationArgumentsForReadiness(
    initialReadiness[index],
    contracts[index].alwaysVerify
  );
  if (migrationArgs) runMigration(contracts[index].migrationScript, migrationArgs);
}

const finalReadiness = await Promise.all(
  contracts.map((contract) =>
    markerIsReady(client, GetObjectCommand, configuration.bucketName, contract, revision)
  )
);
if (finalReadiness.some((ready) => !ready)) {
  throw new Error("Public media deployment verification is incomplete; refusing to start");
}

await client.close?.();
console.log(
  `[public-media-readiness] exact release verified: ${revision.slice(0, 12)} backend=${configuration.provider}`
);
