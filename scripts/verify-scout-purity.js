#!/usr/bin/env node

/**
 * Scout Tool Side-Effect Guard
 *
 * Goal:
 * - Ensure Scout-adjacent tool modules stay free of write-capable HTTP calls
 *   (POST/PUT/PATCH/DELETE).
 * - Fail fast in CI if a Scout tool attempts to perform a write directly.
 *
 * This is a static, best-effort check – it does not execute code.
 *
 * Exit codes:
 * - 0: All checks passed
 * - 1: Violations found (blocks merge)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("\n🔍 Scout Tool Purity Guard\n");

// Scout-adjacent tool modules that must not perform writes directly.
// These are the primary tool layers used by ScoutOS.
const SCOUT_TOOL_FILES = [
  "client/src/agent/tools/scoutTools.ts",
  "client/src/agent/tools/providers.ts",
];

const ERRORS = [];

function readFileIfExists(relativePath) {
  const fullPath = path.join(__dirname, "..", relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Skipping missing scout tool file: ${relativePath}`);
    return null;
  }
  return fs.readFileSync(fullPath, "utf-8");
}

// Simple static patterns to catch obvious write calls.
// We intentionally look for HTTP verbs inside string literals to avoid
// most false positives from comments or variable names.
const MUTATING_VERB_PATTERN = /['"`](POST|PUT|PATCH|DELETE)['"`]/g;
const APIREQUEST_MUTATION_PATTERN = /apiRequest\s*\(\s*['"`](POST|PUT|PATCH|DELETE)['"`]/g;

for (const relativePath of SCOUT_TOOL_FILES) {
  console.log(`✓ Checking ${relativePath} for write-capable calls...`);
  const source = readFileIfExists(relativePath);
  if (source == null) continue;

  const violations = [];

  if (MUTATING_VERB_PATTERN.test(source)) {
    violations.push(
      "Contains HTTP mutation verb strings (POST/PUT/PATCH/DELETE). Scout tools should not perform direct writes; use proposal helpers and UI-owned submit flows instead."
    );
  }

  if (APIREQUEST_MUTATION_PATTERN.test(source)) {
    violations.push(
      "Uses apiRequest() with a mutating verb (POST/PUT/PATCH/DELETE). Scout tools must not call mutating endpoints directly."
    );
  }

  if (violations.length > 0) {
    ERRORS.push(
      `❌ ${relativePath}:\n  - ` + violations.join("\n  - ")
    );
  }
}

console.log("\n" + "=".repeat(60));

if (ERRORS.length > 0) {
  console.error("\n🚨 SCOUT TOOL PURITY VIOLATIONS:\n");
  for (const err of ERRORS) {
    console.error(err + "\n");
  }
  console.error(
    "❌ CI FAILED: One or more Scout-adjacent tool modules appear to perform writes (HTTP POST/PUT/PATCH/DELETE)." +
      "\n   Refactor these into proposal-only helpers and move persistence behind explicit UI confirmation flows before merging.\n"
  );
  process.exit(1);
}

console.log("✅ All checked Scout tool modules are free of direct write calls.\n");
process.exit(0);
