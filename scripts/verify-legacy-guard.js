#!/usr/bin/env node

/**
 * Legacy AI Surface Guard
 *
 * Purpose:
 * - Ensure legacy AI entrypoints (legacy/App-legacy.tsx, components/Chatbot.tsx)
 *   cannot be accidentally wired into the live app shell.
 * - Fails CI if these files are imported or routed from the canonical
 *   client entrypoints (client/src/main.tsx, client/src/App.tsx).
 *
 * Exit codes:
 * - 0: All checks passed
 * - 1: Critical violations found (blocks merge)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ERRORS = [];

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("\n🔍 Legacy AI Surface Guard\n");

function readFileSafe(relativePath) {
  const fullPath = path.join(__dirname, "..", relativePath);
  if (!fs.existsSync(fullPath)) {
    ERRORS.push(`❌ CRITICAL: Expected file not found: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf-8");
}

// 1) Guard main entrypoint from importing legacy/App-legacy
console.log("✓ Checking client/src/main.tsx for legacy imports...");
const mainSource = readFileSafe("client/src/main.tsx");

if (/legacy\/App-legacy/.test(mainSource)) {
  ERRORS.push(
    "❌ CRITICAL: client/src/main.tsx imports legacy/App-legacy.tsx.\n" +
      "   The legacy app shell is archived and must not be wired into the live runtime."
  );
}

if (/\.\/components\/(Chatbot|Chatbot\.tsx)/.test(mainSource)) {
  ERRORS.push(
    "❌ CRITICAL: client/src/main.tsx imports components/Chatbot.tsx.\n" +
      "   The legacy Chatbot surface is archived; use /scout or /_scout-lite instead."
  );
}

// 2) Guard App shell routing from legacy Chatbot / App-legacy
console.log("✓ Checking client/src/App.tsx for legacy wiring...");
const appSource = readFileSafe("client/src/App.tsx");

// Import-pattern checks
if (/legacy\/App-legacy/.test(appSource)) {
  ERRORS.push(
    "❌ CRITICAL: client/src/App.tsx imports legacy/App-legacy.tsx.\n" +
      "   The legacy app shell must remain detached from production routing."
  );
}

if (/from ['"]\.\/components\/Chatbot['"]/.test(appSource)) {
  ERRORS.push(
    "❌ CRITICAL: client/src/App.tsx imports components/Chatbot.tsx.\n" +
      "   The legacy Chatbot UI must not be reintroduced into the main router."
  );
}

// JSX / route-pattern checks (defensive)
if (/<Chatbot\b/.test(appSource)) {
  ERRORS.push(
    "❌ CRITICAL: <Chatbot /> detected in client/src/App.tsx.\n" +
      "   Route chat experiences through ScoutOS (/scout) or dedicated pages, not the legacy Chatbot component."
  );
}

// 3) Results
console.log("\n" + "=".repeat(60));

if (ERRORS.length > 0) {
  console.error("\n🚨 CRITICAL LEGACY GUARD VIOLATIONS:\n");
  for (const err of ERRORS) {
    console.error(err + "\n");
  }
  console.error("❌ CI FAILED: Legacy AI surfaces were wired into production entrypoints.\n" +
    "   Detach legacy/App-legacy.tsx and components/Chatbot.tsx from main.tsx/App.tsx before merging.\n");
  process.exit(1);
}

console.log("✅ Legacy AI surfaces are not wired into main entrypoints.\n");
process.exit(0);
