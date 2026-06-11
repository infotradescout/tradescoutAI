#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_ORIGIN = "https://www.thetradescout.com";
const ARTIFACT_PATH = path.resolve(
  process.cwd(),
  "artifacts/tradescout-production-public-entry-smoke-latest.json"
);

const shouldRun = process.env.RUN_TRADESCOUT_PRODUCTION_PUBLIC_ENTRY_SMOKE === "1";
const configuredOrigins = [
  process.env.TRADESCOUT_PUBLIC_BASE_URL,
  process.env.TRADESCOUT_PRODUCTION_ORIGIN,
  process.env.PUBLIC_WEB_URL,
  process.env.APP_URL,
  process.env.APP_BASE_URL,
]
  .flatMap((value) => String(value || "").split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const origins = Array.from(new Set(configuredOrigins.length ? configuredOrigins : [DEFAULT_ORIGIN]))
  .map((origin) => origin.replace(/\/+$/, ""))
  .filter((origin) => /^https?:\/\//i.test(origin));

const expectedCommit =
  String(process.env.TRADESCOUT_EXPECTED_COMMIT || "").trim() || resolveLocalGitHead();

const requiredCopy = [
  "Connection Without Compromise",
  "Direct Connect",
  "Start a Request",
  "Claim Provider Profile",
];

const requiredHtmlFragments = [
  'href="/direct-connect?source=landing_primary_cta"',
  'href="/register?role=provider"',
];

const forbiddenCopy = [
  "Ask Scout",
  "Scout chatbot",
  "lead marketplace",
  "lead-selling",
  "tool catalog",
  "standalone tools",
  "routing algorithm",
  "authority layer",
  "handoff doctrine",
  "backend routing system",
  "operating system architecture",
];

const publicEntryPaths = ["/", "/landing", "/lp"];
const markerPaths = ["/api/version", "/api/public/config"];
const results = [];

function resolveLocalGitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function safeBodyPreview(body) {
  return String(body || "").replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

function commitsMatch(deployedCommit, expected) {
  const deployed = String(deployedCommit || "").trim();
  const wanted = String(expected || "").trim();
  if (!deployed || !wanted || deployed === "unknown") return false;
  if (deployed === wanted) return true;
  const minPrefixLength = 7;
  return (
    deployed.length >= minPrefixLength &&
    wanted.length >= minPrefixLength &&
    (deployed.startsWith(wanted) || wanted.startsWith(deployed))
  );
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/json",
        "User-Agent": "TradeScout production public-entry freshness smoke",
      },
      signal: controller.signal,
    });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

function recordResult(result) {
  results.push(result);
  return result;
}

function evaluatePublicEntryResponse(origin, routePath, response, body) {
  const buildHeader = response.headers.get("x-tradescout-build") || "";
  const missingCopy = requiredCopy.filter((phrase) => !body.includes(phrase));
  const missingHtmlFragments = requiredHtmlFragments.filter((fragment) => !body.includes(fragment));
  const presentForbiddenCopy = forbiddenCopy.filter((phrase) => body.includes(phrase));
  const markerOk = commitsMatch(buildHeader, expectedCommit);
  const lpCanonicalOk =
    routePath !== "/lp" ||
    response.url.replace(/\/+$/, "").endsWith("/landing") ||
    body.includes('<link rel="canonical" href="https://www.thetradescout.com/landing"') ||
    body.includes(`<link rel="canonical" href="${origin}/landing"`);

  const ok =
    response.ok &&
    missingCopy.length === 0 &&
    missingHtmlFragments.length === 0 &&
    presentForbiddenCopy.length === 0 &&
    markerOk &&
    lpCanonicalOk;

  return recordResult({
    label: `public_entry:${origin}${routePath}`,
    origin,
    path: routePath,
    finalUrl: response.url,
    status: response.status,
    ok,
    buildHeader,
    expectedCommit,
    missingCopy,
    missingHtmlFragments,
    presentForbiddenCopy,
    lpCanonicalOk,
    bodyPreview: safeBodyPreview(body),
  });
}

function evaluateMarkerResponse(origin, markerPath, response, body) {
  const buildHeader = response.headers.get("x-tradescout-build") || "";
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }
  const markerCommit = String(parsed?.commit || parsed?.buildRevision || buildHeader || "").trim();
  const ok = response.ok && commitsMatch(markerCommit, expectedCommit);

  return recordResult({
    label: `build_marker:${origin}${markerPath}`,
    origin,
    path: markerPath,
    status: response.status,
    ok,
    buildHeader,
    markerCommit,
    expectedCommit,
    bodyPreview: safeBodyPreview(body),
  });
}

async function writeArtifact(status) {
  const artifact = {
    generatedAt: new Date().toISOString(),
    status,
    origins,
    publicEntryPaths,
    markerPaths,
    expectedCommit,
    results,
  };
  await fs.mkdir(path.dirname(ARTIFACT_PATH), { recursive: true });
  await fs.writeFile(ARTIFACT_PATH, JSON.stringify(artifact, null, 2));
  return artifact;
}

async function main() {
  if (!shouldRun) {
    recordResult({
      label: "preconditions",
      status: "BLOCKED",
      ok: false,
      bodyPreview:
        "Set RUN_TRADESCOUT_PRODUCTION_PUBLIC_ENTRY_SMOKE=1 to run the live production freshness smoke.",
    });
    await writeArtifact("BLOCKED");
    console.log(`Artifact written: ${ARTIFACT_PATH}`);
    console.error("BLOCKED: live production freshness smoke is opt-in.");
    process.exitCode = 2;
    return;
  }

  if (!origins.length) {
    recordResult({
      label: "preconditions",
      status: "BLOCKED",
      ok: false,
      bodyPreview:
        "Set TRADESCOUT_PUBLIC_BASE_URL or TRADESCOUT_PRODUCTION_ORIGIN to a production URL.",
    });
    await writeArtifact("BLOCKED");
    console.log(`Artifact written: ${ARTIFACT_PATH}`);
    process.exitCode = 2;
    return;
  }

  if (!expectedCommit) {
    recordResult({
      label: "preconditions",
      status: "BLOCKED",
      ok: false,
      bodyPreview:
        "Set TRADESCOUT_EXPECTED_COMMIT or run from a git checkout so the smoke can detect stale production deploys.",
    });
    await writeArtifact("BLOCKED");
    console.log(`Artifact written: ${ARTIFACT_PATH}`);
    process.exitCode = 2;
    return;
  }

  for (const origin of origins) {
    for (const routePath of publicEntryPaths) {
      try {
        const { response, body } = await fetchWithTimeout(`${origin}${routePath}`);
        evaluatePublicEntryResponse(origin, routePath, response, body);
      } catch (error) {
        recordResult({
          label: `public_entry:${origin}${routePath}`,
          origin,
          path: routePath,
          status: "ERROR",
          ok: false,
          expectedCommit,
          bodyPreview: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const markerPath of markerPaths) {
      try {
        const { response, body } = await fetchWithTimeout(`${origin}${markerPath}`);
        evaluateMarkerResponse(origin, markerPath, response, body);
      } catch (error) {
        recordResult({
          label: `build_marker:${origin}${markerPath}`,
          origin,
          path: markerPath,
          status: "ERROR",
          ok: false,
          expectedCommit,
          bodyPreview: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const failed = results.filter((result) => result.ok === false);
  const status = failed.length ? "FAIL" : "PASS";
  await writeArtifact(status);
  console.log(`Artifact written: ${ARTIFACT_PATH}`);
  console.log(`tradescout-production-public-entry-smoke status: ${status}`);

  if (failed.length) {
    console.error(`Failed checks: ${failed.map((result) => result.label).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  recordResult({
    label: "fatal_error",
    status: "ERROR",
    ok: false,
    bodyPreview: error instanceof Error ? error.message : String(error),
  });
  await writeArtifact("FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
