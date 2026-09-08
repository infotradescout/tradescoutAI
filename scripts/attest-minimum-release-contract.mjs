#!/usr/bin/env node
/**
 * Posts a GitHub commit status for tradescout/minimum-release-contract
 * from a local evidence.json — no GitHub Actions required.
 *
 * Requires: gh auth, or GITHUB_TOKEN with statuses:write.
 *
 *   node scripts/attest-minimum-release-contract.mjs artifacts/release-contract/<sha>/evidence.json
 */

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasCompleteReleaseEvidence } from "./run-minimum-release-contract.mjs";

const CONTEXT = "tradescout/minimum-release-contract";
const DEFAULT_REPO = "infotradescout/tradescoutAI";
const currentFile = fileURLToPath(import.meta.url);

export function validateAttestationEvidence(evidence) {
  const failures = [];
  if (!/^[0-9a-f]{7,40}$/i.test(String(evidence?.commit || "").trim())) {
    failures.push("evidence.commit missing or invalid");
  }
  if (evidence?.dirtyTree) failures.push("working tree is dirty");
  if (evidence?.contract !== "tradescout-minimum-release-v2") {
    failures.push("evidence contract is not the fail-closed v2 contract");
  }
  if (evidence?.mode !== "release") failures.push("evidence mode is not release");
  if (evidence?.result !== "pass") failures.push("evidence result is not pass");
  if (evidence?.attestable !== true) failures.push("evidence is marked non-attestable");
  if (evidence?.steps?.some((step) => step.status === "skipped")) {
    failures.push("evidence contains skipped steps");
  }
  if (!hasCompleteReleaseEvidence(evidence?.steps)) {
    failures.push("required release evidence steps are incomplete");
  }
  return failures;
}

function main() {
  const evidencePath = process.argv[2];
  if (!evidencePath || !fs.existsSync(evidencePath)) {
    console.error(
      "[attest] Usage: node scripts/attest-minimum-release-contract.mjs <evidence.json>"
    );
    process.exit(2);
  }

  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const sha = String(evidence.commit || "").trim();
  const evidenceFailures = validateAttestationEvidence(evidence);
  if (evidenceFailures.length > 0) {
    console.error(`[attest] refusing non-attestable evidence: ${evidenceFailures.join("; ")}`);
    process.exit(2);
  }

  const state = "success";
  const description = `Minimum release contract ${evidence.result} @ ${sha.slice(0, 12)}`.slice(
    0,
    140
  );
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const targetUrl =
    process.env.RELEASE_CONTRACT_TARGET_URL || `https://github.com/${repo}/commit/${sha}`;

  const body = {
    state,
    context: CONTEXT,
    description,
    target_url: targetUrl,
  };

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    const result = spawnSync(
      "curl",
      [
        "-sS",
        "-X",
        "POST",
        "-H",
        `Authorization: Bearer ${token}`,
        "-H",
        "Accept: application/vnd.github+json",
        "-H",
        "Content-Type: application/json",
        `https://api.github.com/repos/${repo}/statuses/${sha}`,
        "-d",
        JSON.stringify(body),
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }
    console.log("[attest] Posted via token:", result.stdout);
    return;
  }

  const gh = spawnSync(
    "gh",
    [
      "api",
      "-X",
      "POST",
      `repos/${repo}/statuses/${sha}`,
      "-f",
      `state=${state}`,
      "-f",
      `context=${CONTEXT}`,
      "-f",
      `description=${description}`,
      "-f",
      `target_url=${targetUrl}`,
    ],
    { encoding: "utf8" }
  );
  if (gh.status !== 0) {
    console.error(gh.stderr || gh.stdout);
    console.error("[attest] Failed. Authenticate with `gh auth login` or set GITHUB_TOKEN.");
    process.exit(gh.status ?? 1);
  }
  console.log("[attest] Posted via gh:", gh.stdout);
  console.log(`[attest] context=${CONTEXT} state=${state} sha=${sha}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main();
}
