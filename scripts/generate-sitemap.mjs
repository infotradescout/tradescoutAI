#!/usr/bin/env node

/**
 * Production prebuild entrypoint.
 *
 * Color evidence is rebuilt and contract-checked before Vite reads the JW Stone
 * catalog. The original sitemap generator then runs unchanged.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const scriptsDir = import.meta.dirname;
const repoRoot = path.resolve(scriptsDir, "..");

function runNode(args) {
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

runNode(["--test", path.join(scriptsDir, "jw-stone-face-color-core.contract.test.mjs")]);
runNode([path.join(scriptsDir, "extract-jw-stone-dominant-colors.mjs")]);

await import("./generate-sitemap-core.mjs");
