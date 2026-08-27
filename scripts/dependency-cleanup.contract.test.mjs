import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const removedDirectDependencies = Object.freeze([
  "@anthropic-ai/sdk",
  "@jridgewell/trace-mapping",
  "@uppy/aws-s3",
  "@uppy/core",
  "@uppy/dashboard",
  "@uppy/drag-drop",
  "@uppy/file-input",
  "@uppy/progress-bar",
  "@uppy/react",
  "axios",
  "google-auth-library",
  "memoizee",
  "memorystore",
  "next-themes",
  "openid-client",
  "tw-animate-css",
  "zod-validation-error",
]);

const compileOnlyDependencies = Object.freeze([
  "@types/bcrypt",
  "@types/jsonwebtoken",
  "@types/jszip",
  "@types/memoizee",
  "@types/node-fetch",
  "@types/passport-facebook",
  "@types/passport-google-oauth20",
  "@types/uuid",
]);

const sourceExtensions = new Set([
  ".bat", ".cjs", ".css", ".cts", ".js", ".json", ".jsx", ".mjs", ".mts",
  ".ps1", ".scss", ".sh", ".toml", ".ts", ".tsx", ".yaml", ".yml",
]);
const excludedPrefixes = [
  ".selective-intelligence/",
  "artifacts/",
  "client/public/",
  "dist/",
  "node_modules/",
  "scripts/data/",
  "test-results/",
];
const excludedFiles = new Set([
  "package-lock.json",
  "runtime/package-lock.json",
  "scripts/dependency-cleanup.contract.test.mjs",
]);
const reviewedGuardStrings = Object.freeze({
  axios: new Set([
    ".config/.semgrep/semgrep_rules.json",
    ".config/replit/.semgrep/semgrep_rules.json",
    "scripts/verify-scout-tiles.js",
    "server/utils/requestActor.ts",
  ]),
});

function trackedSourceFiles() {
  return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(root, file)))
    .filter((file) => sourceExtensions.has(path.extname(file)))
    .filter((file) => !/(?:^|\/)package-lock\.json$/.test(file))
    .filter((file) => !excludedFiles.has(file))
    .filter((file) => !excludedPrefixes.some((prefix) => file.startsWith(prefix)))
    .filter((file) => !/\.generated\.json$/.test(file));
}

function packageImportPattern(packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    String.raw`(?:from\s*["']|import\s*\(\s*["']|require\s*\(\s*["'])${escaped}(?:\/[^"']*)?["']`,
  );
}

function packageFixedStringPattern(packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(String.raw`(?:^|[\s"'\x60])${escaped}(?:$|[\s/"'\x60])`, "m");
}

function packageCliPattern(packageName) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    String.raw`(?:npx|npm\s+(?:exec|run)|pnpm|yarn)\s+(?:--[^\s]+\s+)*${escaped}(?:\s|$)`,
    "m",
  );
}

test("dependency cleanup changes only the declared zero-consumer package set", () => {
  for (const dependency of removedDirectDependencies) {
    assert.equal(packageJson.dependencies?.[dependency], undefined, dependency);
    assert.equal(packageJson.devDependencies?.[dependency], undefined, dependency);
  }
  for (const dependency of compileOnlyDependencies) {
    assert.equal(packageJson.dependencies?.[dependency], undefined, dependency);
    assert.equal(typeof packageJson.devDependencies?.[dependency], "string", dependency);
  }
});

test("projected lock preserves npm optional and devOptional counterexamples", () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  assert.deepEqual(lock.packages[""].optionalDependencies, packageJson.optionalDependencies);
  assert.equal(lock.packages["node_modules/bufferutil"]?.optional, true);
  assert.equal(lock.packages["node_modules/bufferutil"]?.dev, undefined);
  assert.equal(lock.packages["node_modules/pg"]?.optional, undefined);
  assert.equal(lock.packages["node_modules/pg"]?.dev, undefined);
  assert.equal(lock.packages["node_modules/@types/pg"]?.devOptional, true);
  assert.equal(lock.packages["node_modules/@types/pg"]?.dev, undefined);
  assert.equal(lock.packages["node_modules/@types/pg"]?.optional, undefined);
  assert.equal(lock.packages["node_modules/fsevents"]?.optional, true);
});

test("removed direct packages do not regain tracked source, config, test, tool, or CLI consumers", () => {
  const files = trackedSourceFiles();
  for (const dependency of removedDirectDependencies) {
    const importPattern = packageImportPattern(dependency);
    const fixedPattern = packageFixedStringPattern(dependency);
    const cliPattern = packageCliPattern(dependency);
    const consumers = files
      .filter((file) => {
        if (reviewedGuardStrings[dependency]?.has(file)) return false;
        const content = fs.readFileSync(path.join(root, file), "utf8");
        return importPattern.test(content) || cliPattern.test(content) || fixedPattern.test(content);
      });
    assert.deepEqual(consumers, [], `${dependency} has consumers: ${consumers.join(", ")}`);
  }
});
