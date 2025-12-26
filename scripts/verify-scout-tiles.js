#!/usr/bin/env node

/**
 * Scout Contextual Tiles - CI Enforcement
 * 
 * This script enforces hard invariants in CI/CD to prevent AI-UX bullshit from merging.
 * Runs as part of GitHub Actions or pre-commit hooks.
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Critical violations found (blocks merge)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ERRORS = [];
const WARNINGS = [];

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔍 Scout Tiles - CI Enforcement\n");

// =======================
// 1. Single Choke Point Verification
// =======================
console.log("✓ Checking single choke points...");

function countFileMatches(pattern) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const result = execSync(`rg "${pattern}" -g "client/src/**/*.ts" -g "client/src/**/*.tsx" --files-with-matches`, {
      cwd: path.join(__dirname, ".."),
      encoding: "utf-8",
    });
    return result.trim().split("\n").filter(Boolean);
  } catch (error) {
    if (error.status === 1) return []; // No matches
    throw error;
  }
}

const tileDefFiles = countFileMatches("export const scoutActionTiles");
if (tileDefFiles.length > 1) {
  ERRORS.push(
    `❌ CRITICAL: scoutActionTiles defined in ${tileDefFiles.length} files (must be exactly 1):\n` +
    tileDefFiles.map((f) => `   - ${f}`).join("\n")
  );
}

const resolverFiles = countFileMatches("function resolveTile");
if (resolverFiles.length > 1) {
  ERRORS.push(
    `❌ CRITICAL: resolveTile defined in ${resolverFiles.length} files (must be exactly 1):\n` +
    resolverFiles.map((f) => `   - ${f}`).join("\n")
  );
}

// =======================
// 2. Provenance Comment Verification
// =======================
console.log("✓ Checking provenance comments...");

const tilesFilePath = path.join(__dirname, "../client/src/scout/scoutActionTiles.ts");
if (!fs.existsSync(tilesFilePath)) {
  ERRORS.push("❌ CRITICAL: scoutActionTiles.ts not found");
} else {
  const tilesContent = fs.readFileSync(tilesFilePath, "utf-8");
  const variantCount = (tilesContent.match(/variants:\s*\[/g) || []).length;
  const provenanceCount = (tilesContent.match(/\/\/\s*Proven by:/gi) || []).length;

  if (variantCount > 0 && provenanceCount === 0) {
    ERRORS.push(
      `❌ CRITICAL: ${variantCount} variant blocks found but 0 provenance comments.\n` +
      `   Every variant MUST have a "// Proven by:" comment documenting its data source.`
    );
  } else if (provenanceCount < variantCount) {
    WARNINGS.push(
      `⚠️  WARNING: ${variantCount} variant blocks but only ${provenanceCount} provenance comments.\n` +
      `   Verify all variants document their data sources.`
    );
  }

  // Invoices-specific provenance: if activeInvoices variants exist, enforce explicit GET /api/invoices mention
  const usesActiveInvoices = /activeInvoices\s*\./.test(tilesContent) || /activeInvoices\s*:\s*\[/.test(tilesContent);
  const mentionsInvoicesProvenance = /GET\s+\/api\/invoices/.test(tilesContent);
  if (usesActiveInvoices && !mentionsInvoicesProvenance) {
    ERRORS.push(
      "❌ CRITICAL: Invoice variants detected without explicit provenance comment for GET /api/invoices.\n" +
      "   Add '// Proven by: GET /api/invoices' near invoice variant(s)."
    );
  }
}

// =======================
// 3. Intent Immutability Tests
// =======================
console.log("✓ Running intent immutability tests...");

try {
  execSync("npm run test:run -- scoutTiles.test.ts", {
    cwd: path.join(__dirname, ".."),
    stdio: "pipe",
  });
  console.log("  ✓ All determinism tests passed");
} catch (error) {
  ERRORS.push(
    "❌ CRITICAL: Scout tile tests failed.\n" +
    "   Intent immutability or determinism tests did not pass.\n" +
    "   Run: npm run test:run -- scoutTiles.test.ts"
  );
}

// =======================
// 4. No Async in Resolver
// =======================
console.log("✓ Checking for async/await in resolver...");

const resolverPath = path.join(__dirname, "../client/src/scout/resolveScoutTiles.ts");
if (fs.existsSync(resolverPath)) {
  const resolverContent = fs.readFileSync(resolverPath, "utf-8");
  
  if (/async\s+function|await\s+/.test(resolverContent)) {
    ERRORS.push(
      "❌ CRITICAL: Resolver contains async/await.\n" +
      "   Tile resolution must be synchronous (no API calls, no LLM)."
    );
  }

  if (/fetch\(|axios\.|http\./.test(resolverContent)) {
    ERRORS.push(
      "❌ CRITICAL: Resolver contains HTTP calls.\n" +
      "   Variants must use pre-fetched context only."
    );
  }
}

// =======================
// 5. Tile Count Stability
// =======================
console.log("✓ Verifying tile count stability...");

const expectedTileCount = 4;
try {
  const content = fs.readFileSync(tilesFilePath, "utf-8");
  // Count id: entries within the scoutActionTiles array
  const ids = Array.from(content.matchAll(/\bid\s*:\s*['"][^'"]+['"]/g)).length;
  if (ids !== expectedTileCount) {
    WARNINGS.push(
      `⚠️  WARNING: Expected ${expectedTileCount} tiles, found ${ids}.\n` +
      `   If this is intentional, update SCOUT_TILES_VERIFICATION.md.`
    );
  }
} catch (error) {
  WARNINGS.push("⚠️  WARNING: Unable to read scoutActionTiles.ts for tile count check");
}

// =======================
// Results
// =======================
console.log("\n" + "=".repeat(60));

if (ERRORS.length > 0) {
  console.error("\n🚨 CRITICAL VIOLATIONS FOUND:\n");
  ERRORS.forEach((err) => console.error(err + "\n"));
}

if (WARNINGS.length > 0) {
  console.warn("\n⚠️  WARNINGS:\n");
  WARNINGS.forEach((warn) => console.warn(warn + "\n"));
}

if (ERRORS.length === 0 && WARNINGS.length === 0) {
  console.log("✅ All Scout tile invariants verified successfully!\n");
  process.exit(0);
} else if (ERRORS.length > 0) {
  console.error("❌ CI FAILED: Critical violations must be fixed before merge.\n");
  process.exit(1);
} else {
  console.warn("⚠️  CI PASSED with warnings. Review before merge.\n");
  process.exit(0);
}
