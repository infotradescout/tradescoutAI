import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

export function assertDatabaseProof(report, { source, fullRelease, startedAfter }) {
  assert.equal(report.source, source, "Proof must cover the exact candidate");
  assert.equal(report.passed, true, "A successful process exit cannot override a failed report");
  assert.ok(!report.failure && !report.cleanupWarning, "Proof must have no failure or cleanup warning");
  assert.equal(report.databaseCleanup, "stopped", "Disposable database cleanup must be confirmed");
  assert.ok(Date.parse(report.startedAt) >= startedAfter, "Stale proof must not be reused");
  assert.ok(Date.parse(report.completedAt) >= Date.parse(report.startedAt), "Proof must have a valid completion time");
  assert.ok(Array.isArray(report.scenarios));
  assert.equal(report.scenarios.length, fullRelease ? 12 : 9, "Every required scenario must complete");
  assert.equal(new Set(report.scenarios.map((row) => row.name)).size, report.scenarios.length);
  assert.ok(report.scenarios.every((row) => row.passed === true), "Every scenario must pass");
  if (fullRelease) {
    for (const name of [
      "exact-candidate built browser proof in a separate worktree",
      "complete minimum release contract with production assets and guarded test database",
      "built production migration entrypoint also rejects the incomplete database",
    ]) assert.ok(report.scenarios.some((row) => row.name === name), `Missing ${name}`);
  }
}

async function main() {
  const root = process.cwd();
  const isolated = process.env.DB598_ISOLATE_CHECKOUT === "1";
  const temp = isolated ? await fs.mkdtemp(path.join(os.tmpdir(), "db598-clean-checkout-")) : null;
  const candidate = isolated ? path.join(temp, "candidate") : root;
  const base = "908d2d4e2c76141ffe2cdcfa52e756dfb52fae84";
  let added = false, exitStatus = 1;
  const run = async (executable, args, cwd = root, env = process.env, capture = false) => {
    let output = "";
    const code = await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { cwd, env, stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit" });
      if (capture) child.stdout.on("data", (chunk) => { output += chunk; });
      child.once("error", reject); child.once("close", (status) => resolve(status ?? 1));
    });
    return { code, output: output.trim() };
  };
  try {
    const head = await run("git", ["rev-parse", "HEAD"], root, process.env, true);
    assert.equal(head.code, 0);
    if (isolated || process.env.DB598_EXPECTED_HEAD) {
      assert.match(process.env.DB598_EXPECTED_HEAD || "", /^[a-f0-9]{40}$/);
      assert.equal(head.output, process.env.DB598_EXPECTED_HEAD);
    }
    const initial = await run("git", ["status", "--porcelain"], root, process.env, true);
    if (isolated) {
      console.log("DB598_BUILDER_CHECKOUT " + JSON.stringify({ source: head.output, observedBuildEnvironmentChanges: initial.output, action: "create independent exact-source worktree; do not modify the original checkout" }));
      const available = await run("git", ["cat-file", "-e", `${base}^{commit}`], root, process.env, true);
      if (available.code !== 0) {
        const fetched = await run("git", ["fetch", "--no-tags", "--depth=1", "origin", base]);
        assert.equal(fetched.code, 0, "The genuine unchanged control revision is required");
      }
      const created = await run("git", ["worktree", "add", "--detach", candidate, head.output]);
      assert.equal(created.code, 0); added = true;
      assert.equal((await run("npm", ["ci", "--include=dev"], candidate)).code, 0);
    }
    const clean = await run("git", ["status", "--porcelain"], candidate, process.env, true);
    assert.equal(clean.output, "", "The candidate must remain exactly clean");
    assert.equal((await run(process.execPath, ["--test", "scripts/tests/database-bootstrap-report.test.mjs"], candidate)).code, 0);
    const startedAfter = Date.now();
    // Keep the native dependency and its shutdown hooks in a child process.
    // The parent independently validates the report, not only the exit code.
    const proof = await run(process.execPath, ["scripts/tests/database-bootstrap.scenarios.mjs"], candidate, { ...process.env, DB598_ISOLATE_CHECKOUT: "0" });
    const evidence = path.join(candidate, ".db-bootstrap-proof");
    const report = JSON.parse(await fs.readFile(path.join(evidence, "result.json"), "utf8"));
    assert.equal(proof.code, 0, "The native process must exit successfully");
    assertDatabaseProof(report, { source: head.output, fullRelease: process.env.DB598_FULL_RELEASE === "1", startedAfter });
    if (process.env.DB598_FULL_RELEASE === "1") {
      const release = JSON.parse(await fs.readFile(path.join(evidence, "release-evidence.json"), "utf8"));
      assert.equal(release.commit, head.output);
      assert.equal(release.result, "pass");
      assert.equal(release.dirtyTree, false);
      assert.ok(release.steps.length > 0 && release.steps.every((step) => step.status === "pass"));
    }
    if (isolated) {
      const publish = path.join(root, ".db-bootstrap-proof");
      // Only sanitized passing results and public-page screenshots are served.
      // Raw SQL/command output remains in authenticated build logs.
      await fs.rm(publish, { recursive: true, force: true });
      await fs.mkdir(publish, { recursive: true });
      report.commands = report.commands.map(({ log, ...item }) => ({ ...item, logLocation: "authenticated build record" }));
      await fs.writeFile(path.join(publish, "result.json"), JSON.stringify(report, null, 2));
      for (const name of ["index.html", "release-evidence.json"]) {
        await fs.copyFile(path.join(evidence, name), path.join(publish, name)).catch((error) => { if (error.code !== "ENOENT") throw error; });
      }
      await fs.cp(path.join(evidence, "browser"), path.join(publish, "browser"), { recursive: true }).catch((error) => { if (error.code !== "ENOENT") throw error; });
      await fs.writeFile(path.join(publish, "runner-environment.json"), JSON.stringify({ source: head.output, initialBuilderChanges: initial.output, verifiedCheckout: "independent exact-commit worktree", cleanAfterNpmCi: true }, null, 2));
    }
    exitStatus = 0;
    console.log("DB598_ACCEPTED " + JSON.stringify({ source: head.output, scenarioCount: report.scenarios.length, passed: true }));
  } catch (error) {
    console.error("DB598_PROOF_REJECTED", error.message);
  } finally {
    if (added) {
      const cleanup = await run("git", ["worktree", "remove", "--force", candidate]);
      if (cleanup.code !== 0) exitStatus = 1;
    }
    if (temp) await fs.rm(temp, { recursive: true, force: true }).catch(() => { exitStatus = 1; });
  }
  return exitStatus;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const status = await main().catch((error) => { console.error("DB598_PROOF_REJECTED", error.message); return 1; });
  process.exit(status);
}
