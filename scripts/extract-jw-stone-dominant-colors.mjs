#!/usr/bin/env node

/**
 * Canonical JW Stone color rebuild entrypoint.
 *
 * The legacy pass is retained only to reconcile the complete current cover
 * manifest. Its temporary color output is immediately replaced by the
 * slab-core pass, which is the only shopper-facing color authority.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const scriptsDir = import.meta.dirname;
const repoRoot = path.resolve(scriptsDir, "..");

function runNode(script) {
  execFileSync(process.execPath, [script], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

runNode(path.join(scriptsDir, "extract-jw-stone-cover-manifest-core.mjs"));
runNode(path.join(scriptsDir, "rebuild-jw-stone-face-colors.mjs"));
