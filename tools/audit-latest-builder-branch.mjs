#!/usr/bin/env node
import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}

function trySh(cmd) {
  try {
    return sh(cmd);
  } catch {
    return "";
  }
}

function getLatestBuilderBranch() {
  const out = trySh(
    `git for-each-ref --sort=-committerdate --format="%(refname:short)" refs/heads/builder-*`
  );
  const lines = out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return lines[0];
}

function getChangedFiles(ref) {
  const out = trySh(`git show --name-only --pretty="" ${ref}`);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function classify(files) {
  const normalized = files.map((f) => f.replace(/\\/g, "/"));
  const nonTrivial = normalized.filter((f) => f.length > 0);

  const isAgentStubFile = (f) =>
    f.startsWith("tests/agent/") ||
    f.includes("/tests/agent/") ||
    (f.endsWith(".spec.ts") && f.includes("agent"));

  const stubOnly = nonTrivial.length > 0 && nonTrivial.every(isAgentStubFile);

  const touchesRuntime = nonTrivial.some(
    (f) =>
      f.startsWith("client/") ||
      f.startsWith("server/") ||
      f.startsWith("shared/") ||
      f.startsWith("src/") ||
      f.includes("/client/") ||
      f.includes("/server/") ||
      f.includes("/shared/") ||
      f.includes("/src/")
  );

  return { stubOnly, touchesRuntime, normalized };
}

function main() {
  const branch = getLatestBuilderBranch();
  if (!branch) {
    console.log("No builder-* branches found.");
    process.exit(2);
  }

  const commit = sh(`git rev-parse ${branch}`);
  const files = getChangedFiles(branch);
  const { stubOnly, touchesRuntime, normalized } = classify(files);

  console.log("=== Builder Artifact Audit ===");
  console.log(`Branch: ${branch}`);
  console.log(`Commit: ${commit}`);
  console.log("Files changed:");
  if (!normalized.length) console.log("  (none)");
  for (const f of normalized) console.log(`  - ${f}`);

  if (stubOnly && !touchesRuntime) {
    console.log("\nRESULT: FAIL — stub-only artifact (tests/agent or agent spec).");
    process.exit(1);
  }

  console.log("\nRESULT: PASS — artifact touches non-stub surfaces.");
  process.exit(0);
}

main();
