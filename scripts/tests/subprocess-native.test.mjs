import assert from "node:assert/strict";
import test from "node:test";
import { spawnCommand, runCommand } from "../lib/subprocess.mjs";

test("native executable arguments reach the child intact without shell interpretation", async () => {
  const args = ["two words", 'embedded "quotes"', "& | < > ^ %PATH%", "", "trailing\\"];
  const child = await spawnCommand(process.execPath, [
    "-e", "process.stdout.write(JSON.stringify(process.argv.slice(1)))", "--", ...args,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "", error = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { error += chunk; });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  assert.equal(code, 0, error);
  assert.deepEqual(JSON.parse(output), args);
});

test("native child failure remains a nonzero verifier result", async () => {
  assert.equal(await runCommand(process.execPath, ["-e", "process.exit(7)"], { stdio: "ignore" }), 7);
});
