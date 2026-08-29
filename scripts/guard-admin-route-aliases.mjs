#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOTS = [path.resolve("client", "src"), path.resolve("server"), path.resolve("shared")];
const INCLUDE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "test-results",
  "docs",
  "exports",
  "__trash_candidate__",
  "_archive",
  "tests",
]);

const FORBIDDEN_ROUTE_ALIASES = [
  "/admin-panel",
  "/admin-dashboard",
  "/admin/dashboard",
  "/admin-users",
  "/admin-observability",
  "/admin/workspace",
  "/staff/hardrock-directory",
  "/staff/share-links",
  "/staff/inspection-intelligence",
  "/contractor-verification",
  "/content-moderation",
  "/system-settings",
  "/admin/contractors",
  "/admin/contractor-settings",
  "/support-tickets",
  "/platform-analytics",
  "/manage-users",
  "/payment-processing",
  "/file-management",
];

const ALLOWLIST_FILES = new Set([
  "client/src/AppRoutes.tsx",
  "client/src/admin/adminTools.tsx",
  "client/src/lib/postOnboardingRoute.ts",
  "client/src/lib/routes.ts",
  "client/src/routing/compatibilityRedirects.ts",
  "client/src/routing/compatibilityRedirects.test.ts",
]);

// These top-level names used to collapse two distinct admin surfaces. Runtime
// code must not restore them, including in the compatibility registry.
const RUNTIME_RETIRED_ALIASES = new Set(["/admin-panel", "/admin-dashboard"]);

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDE_EXT.has(ext)) continue;
    out.push(abs);
  }
}

function rel(p) {
  return path.relative(process.cwd(), p).replace(/\\/g, "/");
}

function escapeRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const files = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  walk(root, files);
}

const rules = FORBIDDEN_ROUTE_ALIASES.map((route) => ({
  route,
  // No global flag: RegExp.test must be stateless across files and lines.
  re: new RegExp(`[\"'\`]${escapeRegex(route)}(?=[\"'\`/?#])`, "i"),
}));

const violations = [];
for (const file of files) {
  const relative = rel(file);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of rules) {
      if (!rule.re.test(line)) continue;
      if (ALLOWLIST_FILES.has(relative) && !RUNTIME_RETIRED_ALIASES.has(rule.route)) continue;
      violations.push(`${relative}:${i + 1} uses legacy route alias "${rule.route}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("[guard:admin-route-aliases] FAIL");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`[guard:admin-route-aliases] OK (scanned ${files.length} files)`);
