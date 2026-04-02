import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  frontendItems,
  backendItems,
  ignoredDirNames,
  ignoredFileSuffixes,
} from "./split-workspaces.config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.resolve(repoRoot, "exports", "workspaces");

const frontendRoot = path.join(outputRoot, "frontend");
const backendRoot = path.join(outputRoot, "backend");

function assertStringArray(value, keyName) {
  if (!Array.isArray(value)) {
    throw new Error(`${keyName} must be an array of strings`);
  }
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`${keyName} must contain only non-empty strings`);
    }
  }
}

function validateSplitConfig() {
  assertStringArray(frontendItems, "frontendItems");
  assertStringArray(backendItems, "backendItems");
  assertStringArray(ignoredDirNames, "ignoredDirNames");
  assertStringArray(ignoredFileSuffixes, "ignoredFileSuffixes");
}

function normalizeRelPath(relPath) {
  return relPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function findDuplicates(items) {
  const counts = new Map();
  for (const item of items) {
    const normalized = normalizeRelPath(item);
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function findParentChildCollisions(items) {
  const normalizedItems = Array.from(new Set(items.map(normalizeRelPath))).sort();
  const collisions = [];

  for (let i = 0; i < normalizedItems.length; i += 1) {
    for (let j = i + 1; j < normalizedItems.length; j += 1) {
      const a = normalizedItems[i];
      const b = normalizedItems[j];
      if (b.startsWith(`${a}/`)) {
        collisions.push({ parent: a, child: b });
      }
    }
  }

  return collisions;
}

function buildConfigSanityReport() {
  const warnings = [];
  const errors = [];
  const frontendSet = new Set(frontendItems.map(normalizeRelPath));
  const backendSet = new Set(backendItems.map(normalizeRelPath));

  const overlap = Array.from(frontendSet).filter((item) => backendSet.has(item)).sort();
  if (overlap.length > 0) {
    warnings.push(`Shared entries across frontend/backend: ${overlap.join(", ")}`);
  }

  const frontendDuplicates = findDuplicates(frontendItems);
  if (frontendDuplicates.length > 0) {
    errors.push(
      `Duplicate frontend entries: ${frontendDuplicates
        .map((item) => `${item.value} (x${item.count})`)
        .join(", ")}`
    );
  }

  const backendDuplicates = findDuplicates(backendItems);
  if (backendDuplicates.length > 0) {
    errors.push(
      `Duplicate backend entries: ${backendDuplicates
        .map((item) => `${item.value} (x${item.count})`)
        .join(", ")}`
    );
  }

  const frontendCollisions = findParentChildCollisions(frontendItems);
  if (frontendCollisions.length > 0) {
    errors.push(
      `Frontend parent-child entries detected: ${frontendCollisions
        .map((item) => `${item.parent} -> ${item.child}`)
        .join(", ")}`
    );
  }

  const backendCollisions = findParentChildCollisions(backendItems);
  if (backendCollisions.length > 0) {
    errors.push(
      `Backend parent-child entries detected: ${backendCollisions
        .map((item) => `${item.parent} -> ${item.child}`)
        .join(", ")}`
    );
  }

  return { warnings, errors };
}

function parseEnvBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const ignoredDirNameSet = new Set(ignoredDirNames);

function shouldCopy(sourcePath) {
  const normalized = sourcePath.replace(/\\/g, "/");
  const baseName = path.basename(sourcePath);

  if (ignoredDirNameSet.has(baseName)) {
    return false;
  }

  if (ignoredFileSuffixes.some((suffix) => normalized.endsWith(suffix))) {
    return false;
  }

  return true;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyRelPath(relPath, destinationRoot) {
  const sourcePath = path.resolve(repoRoot, relPath);
  const destinationPath = path.resolve(destinationRoot, relPath);

  if (!(await pathExists(sourcePath))) {
    return { relPath, copied: false, reason: "missing" };
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.cp(sourcePath, destinationPath, {
    recursive: true,
    force: true,
    filter: shouldCopy,
  });

  return { relPath, copied: true };
}

async function writeWorkspaceReadme(targetRoot, type, copied, missing) {
  const readmePath = path.join(targetRoot, "WORKSPACE_SPLIT_README.md");
  const now = new Date().toISOString();

  const text = [
    `# ${type} workspace export`,
    "",
    `Generated at: ${now}`,
    `Source repo: ${repoRoot}`,
    "",
    "## Included paths",
    ...copied.map((item) => `- ${item}`),
    "",
    "## Missing paths (not copied)",
    ...(missing.length > 0 ? missing.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Notes",
    "- This export is generated for out-of-repo editing.",
    "- It excludes caches/build artifacts and dependency folders.",
    "- Re-run npm run split:workspaces from the main repo to refresh this export.",
    "- Optional CI strict checks: set SPLIT_WORKSPACES_STRICT=true (errors) or SPLIT_WORKSPACES_STRICT_WARNINGS=true (warnings).",
    "",
  ].join("\n");

  await fs.writeFile(readmePath, text, "utf8");
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function pickFrontendScripts(sourceScripts = {}) {
  const scripts = {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
  };

  if (sourceScripts.lint) {
    scripts.lint = sourceScripts.lint;
  }

  return scripts;
}

function pickBackendScripts(_sourceScripts = {}) {
  return {
    dev: "cross-env NODE_ENV=development tsx -r dotenv/config server/index.ts",
    build: "node build-server.mjs",
    start: "cross-env NODE_ENV=production node dist/index.js",
    test: "cross-env NODE_ENV=test vitest run",
  };
}

function buildWorkspacePackage(args) {
  return {
    name: args.name,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: args.scripts,
    dependencies: args.sourcePkg.dependencies || {},
    devDependencies: args.sourcePkg.devDependencies || {},
    overrides: args.sourcePkg.overrides || {},
  };
}

async function writeWorkspaceSupportFiles(args) {
  const packagePath = path.join(args.targetRoot, "package.json");
  const gitignorePath = path.join(args.targetRoot, ".gitignore");
  const handoffPath = path.join(args.targetRoot, "HANDOFF.md");

  await writeJson(packagePath, args.pkg);
  await fs.writeFile(
    gitignorePath,
    [
      "node_modules/",
      "dist/",
      "build/",
      ".env",
      ".env.local",
      ".env.*.local",
      "*.log",
      ".DS_Store",
      "Thumbs.db",
      "",
    ].join("\n"),
    "utf8"
  );

  await fs.writeFile(handoffPath, args.handoffText, "utf8");
}

async function buildWorkspace(items, targetRoot, label) {
  await fs.rm(targetRoot, { recursive: true, force: true });
  await fs.mkdir(targetRoot, { recursive: true });

  const copied = [];
  const missing = [];

  for (const relPath of items) {
    const result = await copyRelPath(relPath, targetRoot);
    if (result.copied) {
      copied.push(relPath);
    } else {
      missing.push(relPath);
    }
  }

  await writeWorkspaceReadme(targetRoot, label, copied, missing);

  return { copied, missing };
}

async function main() {
  validateSplitConfig();
  const sanity = buildConfigSanityReport();
  if (sanity.warnings.length > 0) {
    console.warn("[split-workspaces] Config sanity warnings:");
    for (const warning of sanity.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (sanity.errors.length > 0) {
    console.error("[split-workspaces] Config sanity errors:");
    for (const error of sanity.errors) {
      console.error(`  - ${error}`);
    }
  }

  const strictMode = parseEnvBoolean(process.env.SPLIT_WORKSPACES_STRICT);
  const strictWarnings = parseEnvBoolean(process.env.SPLIT_WORKSPACES_STRICT_WARNINGS);
  if (strictMode && sanity.errors.length > 0) {
    throw new Error("Strict mode failed due to split config errors");
  }
  if (strictWarnings && sanity.warnings.length > 0) {
    throw new Error("Strict warnings mode failed due to split config warnings");
  }

  const sourcePkgPath = path.resolve(repoRoot, "package.json");
  const sourcePkg = JSON.parse(await fs.readFile(sourcePkgPath, "utf8"));

  await fs.mkdir(outputRoot, { recursive: true });

  const frontend = await buildWorkspace(frontendItems, frontendRoot, "Frontend");
  const backend = await buildWorkspace(backendItems, backendRoot, "Backend");

  await writeWorkspaceSupportFiles({
    targetRoot: frontendRoot,
    pkg: buildWorkspacePackage({
      name: "tradescout-frontend-workspace",
      scripts: pickFrontendScripts(sourcePkg.scripts),
      sourcePkg,
    }),
    handoffText: [
      "# Frontend Handoff",
      "",
      "This workspace is isolated for frontend iteration.",
      "",
      "## Quick start",
      "1. npm install",
      "2. npm run dev",
      "3. Open http://localhost:5173",
      "",
      "## Backend API",
      "- Vite proxy in vite.config.ts points /api and /ws to http://localhost:5000.",
      "- Run backend separately from the backend workspace or your main repo.",
      "",
      "## Important",
      "- This workspace is generated. Re-run npm run split:workspaces in the main repo to refresh.",
      "- Optional strict mode in source repo: SPLIT_WORKSPACES_STRICT=true npm run split:workspaces",
      "",
    ].join("\n"),
  });

  await writeWorkspaceSupportFiles({
    targetRoot: backendRoot,
    pkg: buildWorkspacePackage({
      name: "tradescout-backend-workspace",
      scripts: pickBackendScripts(sourcePkg.scripts),
      sourcePkg,
    }),
    handoffText: [
      "# Backend Handoff",
      "",
      "This workspace is isolated for backend/server iteration.",
      "",
      "## Quick start",
      "1. npm install",
      "2. npm run dev",
      "3. Verify /api/health on your configured port",
      "",
      "## Important",
      "- This workspace is generated. Re-run npm run split:workspaces in the main repo to refresh.",
      "- Optional strict mode in source repo: SPLIT_WORKSPACES_STRICT=true npm run split:workspaces",
      "",
    ].join("\n"),
  });

  const summary = {
    outputRoot,
    frontend: {
      root: frontendRoot,
      copied: frontend.copied.length,
      missing: frontend.missing,
    },
    backend: {
      root: backendRoot,
      copied: backend.copied.length,
      missing: backend.missing,
    },
  };

  console.log("Workspace split complete:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Failed to split workspaces", error);
  process.exitCode = 1;
});
