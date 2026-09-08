#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(currentFile);

export const PRODUCTION_PREDEPLOY_STEPS = Object.freeze([
  Object.freeze({
    id: "database-migrate",
    entrypoint: "db-migrate-safe.mjs",
    phase: "schema",
  }),
  Object.freeze({
    id: "required-schema",
    entrypoint: "check-required-production-schema.mjs",
    phase: "schema",
  }),
  Object.freeze({
    id: "red-graniti-public-media",
    entrypoint: "migrate-red-graniti-public-media.mjs",
    phase: "media",
  }),
  Object.freeze({
    id: "jw-stone-public-media",
    entrypoint: "migrate-jw-stone-public-media.mjs",
    phase: "media",
  }),
  Object.freeze({
    id: "profile-public-media",
    entrypoint: "migrate-profile-public-media.mjs",
    phase: "media",
  }),
]);

function runReleaseStep(step) {
  const entrypoint = path.join(scriptDirectory, step.entrypoint);
  if (!fs.existsSync(entrypoint)) {
    return {
      ok: false,
      status: 1,
      detail: `release entrypoint is missing: ${entrypoint}`,
    };
  }

  const result = spawnSync(process.execPath, [entrypoint], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status ?? 1,
    detail: result.error?.message || "",
  };
}

export function executeProductionPredeploy({ runStep = runReleaseStep } = {}) {
  const executed = [];
  for (const step of PRODUCTION_PREDEPLOY_STEPS) {
    console.log(`[predeploy] ${step.id}: start`);
    const result = runStep(step);
    executed.push(step.id);
    if (!result?.ok) {
      return {
        ok: false,
        status: result?.status ?? 1,
        failedStep: step.id,
        detail: result?.detail || "",
        executed,
      };
    }
    console.log(`[predeploy] ${step.id}: pass`);
  }

  return { ok: true, status: 0, failedStep: null, detail: "", executed };
}

function main() {
  const result = executeProductionPredeploy();
  if (!result.ok) {
    console.error(
      `[predeploy] FAILED at ${result.failedStep}${result.detail ? `: ${result.detail}` : ""}`
    );
  } else {
    console.log("[predeploy] PASS: schema readiness preceded all public-media migrations");
  }
  process.exit(result.status);
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main();
}
