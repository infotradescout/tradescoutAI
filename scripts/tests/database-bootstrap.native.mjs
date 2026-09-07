import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Hosted builders may rewrite a lockfile or chmod scripts before the user build
// command starts. Never attest that mutated checkout. Test a new exact worktree.
if (process.env.DB598_ISOLATE_CHECKOUT !== "1") {
  await import("./database-bootstrap.scenarios.mjs");
} else {
  const root = process.cwd();
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "db598-clean-checkout-"));
  const candidate = path.join(temp, "candidate");
  let added = false;
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
    assert.match(process.env.DB598_EXPECTED_HEAD || "", /^[a-f0-9]{40}$/);
    assert.equal(head.output, process.env.DB598_EXPECTED_HEAD);
    const initial = await run("git", ["status", "--porcelain"], root, process.env, true);
    console.log("DB598_BUILDER_CHECKOUT " + JSON.stringify({ source: head.output, observedBuildEnvironmentChanges: initial.output, action: "create independent exact-source worktree; do not modify the original checkout" }));
    const created = await run("git", ["worktree", "add", "--detach", candidate, head.output]);
    assert.equal(created.code, 0); added = true;
    const installed = await run("npm", ["ci", "--include=dev"], candidate);
    assert.equal(installed.code, 0);
    const clean = await run("git", ["status", "--porcelain"], candidate, process.env, true);
    assert.equal(clean.output, "", "Freshly installed candidate must remain exactly clean");
    const proof = await run(process.execPath, ["scripts/tests/database-bootstrap.scenarios.mjs"], candidate, { ...process.env, DB598_ISOLATE_CHECKOUT: "0" });
    const evidence = path.join(candidate, ".db-bootstrap-proof");
    await fs.writeFile(path.join(evidence, "runner-environment.json"), JSON.stringify({ source: head.output, initialBuilderChanges: initial.output, verifiedCheckout: "independent exact-commit worktree", cleanAfterNpmCi: true }, null, 2));
    await fs.cp(evidence, path.join(root, ".db-bootstrap-proof"), { recursive: true });
    process.exitCode = proof.code;
  } catch (error) {
    console.error("DB598_CLEAN_CHECKOUT_FAILED", error.message); process.exitCode = 1;
  } finally {
    if (added) await run("git", ["worktree", "remove", "--force", candidate]);
    await fs.rm(temp, { recursive: true, force: true });
  }
}
