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
  const base = "908d2d4e2c76141ffe2cdcfa52e756dfb52fae84";
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
    const available = await run("git", ["cat-file", "-e", `${base}^{commit}`], root, process.env, true);
    if (available.code !== 0) {
      const fetched = await run("git", ["fetch", "--no-tags", "--depth=1", "origin", base]);
      assert.equal(fetched.code, 0, "The genuine unchanged control revision is required; no test may substitute current code");
    }
    const created = await run("git", ["worktree", "add", "--detach", candidate, head.output]);
    assert.equal(created.code, 0); added = true;
    const installed = await run("npm", ["ci", "--include=dev"], candidate);
    assert.equal(installed.code, 0);
    const clean = await run("git", ["status", "--porcelain"], candidate, process.env, true);
    assert.equal(clean.output, "", "Freshly installed candidate must remain exactly clean");
    const proof = await run(process.execPath, ["scripts/tests/database-bootstrap.scenarios.mjs"], candidate, { ...process.env, DB598_ISOLATE_CHECKOUT: "0" });
    const evidence = path.join(candidate, ".db-bootstrap-proof");
    const publish = path.join(root, ".db-bootstrap-proof");
    // Raw command output stays in authenticated build logs, never on the public
    // static site. This directory is exclusively this disposable proof output.
    await fs.rm(publish, { recursive: true, force: true });
    await fs.mkdir(publish, { recursive: true });
    const report = JSON.parse(await fs.readFile(path.join(evidence, "result.json"), "utf8"));
    report.commands = report.commands.map(({ log, ...item }) => ({ ...item, logLocation: "authenticated build record" }));
    if (report.failure) report.failure = report.failure.split("\n")[0];
    await fs.writeFile(path.join(publish, "result.json"), JSON.stringify(report, null, 2));
    for (const name of ["index.html", "release-evidence.json"]) {
      await fs.copyFile(path.join(evidence, name), path.join(publish, name)).catch((error) => { if (error.code !== "ENOENT") throw error; });
    }
    await fs.cp(path.join(evidence, "browser"), path.join(publish, "browser"), { recursive: true }).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await fs.writeFile(path.join(publish, "runner-environment.json"), JSON.stringify({ source: head.output, initialBuilderChanges: initial.output, verifiedCheckout: "independent exact-commit worktree", cleanAfterNpmCi: true }, null, 2));
    process.exitCode = proof.code;
  } catch (error) {
    console.error("DB598_CLEAN_CHECKOUT_FAILED", error.message); process.exitCode = 1;
  } finally {
    if (added) await run("git", ["worktree", "remove", "--force", candidate]);
    await fs.rm(temp, { recursive: true, force: true });
  }
}
