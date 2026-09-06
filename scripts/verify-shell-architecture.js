// Verify page shell architecture invariants:
// - Page components ending in "Shell" belong to client/src/shells or an explicit owner below.
// - No shell file may import from another shell file.
// - No file may import the legacy CommunityShell.
//
// This script is intentionally simple and fast; it runs as part of `npm run verify`.

import fs from "fs";
import path from "path";

const projectRoot = path.resolve(process.cwd());
const clientSrcRoot = path.join(projectRoot, "client", "src");
const shellsRoot = path.join(clientSrcRoot, "shells");

// AppRoutes mounts these existing feature workspaces inside the shared AppShell.
// Match both path and export name so this is not a general exemption for pages.
const featureWorkspaceOwners = new Map([
  ["client/src/pages/admin.tsx", "AdminShell"],
  ["client/src/pages/direct-connect/DirectConnectShell.tsx", "DirectConnectShell"],
]);

/** @typedef {{ file: string; message: string }} Violation */

/** @type {Violation[]} */
const violations = [];

/**
 * Recursively walk a directory and collect .ts/.tsx/.js/.jsx files.
 * @param {string} dir
 * @returns {string[]}
 */
function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile()) {
      if (/\.(t|j)sx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  }
  return files;
}

/**
 * Return true if this absolute path is under the shells root.
 * @param {string} absPath
 */
function isShellFile(absPath) {
  return absPath.startsWith(shellsRoot + path.sep);
}

/**
 * Record a violation.
 * @param {string} absPath
 * @param {string} message
 */
function addViolation(absPath, message) {
  const rel = path.relative(projectRoot, absPath).replace(/\\/g, "/");
  violations.push({ file: rel, message });
}

/**
 * Check PascalCase runtime exports ending in `Shell`.
 * Types and lower-camel-case domain helpers describe data, not page components.
 * @param {string} absPath
 * @param {string} source
 */
function checkExports(absPath, source) {
  const isShell = isShellFile(absPath);
  const rel = path.relative(projectRoot, absPath).replace(/\\/g, "/");

  const isGlobalAppShellFile =
    rel === "client/src/components/layout/AppShell.tsx" ||
    rel === "client/src/components/layout/AppShellCore.tsx";
  const isLegacyCommunityShellFile = rel === "client/src/components/layout/CommunityShell.tsx";

  // Matches patterns like:
  //   export const FooShell = ...
  //   export function FooShell(...)
  //   export class FooShell { ... }
  const exportNameRegex =
    /export\s+(?:default\s+)?(?:async\s+)?(?:const|function|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  let match;
  while ((match = exportNameRegex.exec(source)) !== null) {
    const name = match[1];
    if (name.endsWith("Shell") && !isShell) {
      // Allow the public AppShell wrapper and its preserved implementation
      // core to live in components/layout. CommunityShell may remain defined
      // only as legacy code as long as nothing imports it.
      if (isGlobalAppShellFile && name === "AppShell") continue;
      if (isLegacyCommunityShellFile && name === "CommunityShell") continue;
      if (featureWorkspaceOwners.get(rel) === name) continue;
      addViolation(
        absPath,
        `Exports name \`${name}\` ending in "Shell" outside client/src/shells. Move this component into client/src/shells and import it from there.`
      );
    }
  }
}

/**
 * Check that shell files do not import from other shell files.
 * @param {string} absPath
 * @param {string} source
 */
function checkShellImports(absPath, source) {
  if (!isShellFile(absPath)) return;

  const importRegex = /import\s+[^;]*?from\s+["']([^"']+)["'];?/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const spec = match[1];
    if (!spec.startsWith(".")) continue; // only care about relative imports

    const resolved = path.resolve(path.dirname(absPath), spec);
    if (isShellFile(resolved)) {
      addViolation(
        absPath,
        `Shell file imports another shell file via \"${spec}\". Shells must not depend on other shells; share primitives via regular components instead.`
      );
    }
  }
}

/**
 * Check that no file imports the legacy CommunityShell.
 * @param {string} absPath
 * @param {string} source
 */
function checkCommunityShellImport(absPath, source) {
  const importRegex = /import\s+[^;]*CommunityShell[^;]*from\s+["']([^"']+)["'];?/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const spec = match[1];
    addViolation(
      absPath,
      `Imports CommunityShell from \"${spec}\". CommunityShell is legacy-only; routes must use their own *Shell in client/src/shells.`
    );
  }
}

function main() {
  if (!fs.existsSync(clientSrcRoot)) {
    console.error("client/src directory not found; shell verification skipped.");
    process.exit(0);
  }

  const allFiles = walkFiles(clientSrcRoot);

  for (const absPath of allFiles) {
    const source = fs.readFileSync(absPath, "utf8");
    checkExports(absPath, source);
    checkShellImports(absPath, source);
    checkCommunityShellImport(absPath, source);
  }

  if (violations.length > 0) {
    console.error("\nShell architecture violations detected:\n");
    for (const v of violations) {
      console.error(`- ${v.file}: ${v.message}`);
    }
    console.error("\nFix the issues above to restore the page shell invariants.\n");
    process.exit(1);
  }

  process.exit(0);
}

main();
