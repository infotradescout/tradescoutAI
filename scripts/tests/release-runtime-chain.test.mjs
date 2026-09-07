import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const launcher = path.resolve("runtime/run-release.mjs");
const tail = ["&&", "npm", "run", "db:verify:required"];
function fixture(options, check) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-chain-contract-"));
  const log = path.join(dir, "executed.jsonl");
  const env = { ...process.env };
  delete env.DATABASE_URL; delete env.TEST_DATABASE_URL;
  if (options.databaseUrl) env.DATABASE_URL = options.databaseUrl;
  const names = ["db-migrate-safe", "check-required-production-schema"];
  for (const [index, name] of names.entries()) {
    if (options.missingVerifier && index === 1) continue;
    for (const location of options.built ? ["scripts", "dist/release"] : ["scripts"]) {
      const file = path.join(dir, location, name + ".mjs");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const code = options.built && location === "scripts" ? 71 : (index === 0 ? options.first : options.second) || 0;
      fs.writeFileSync(file, `import fs from 'node:fs';\nfs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({step:${JSON.stringify(name)},location:${JSON.stringify(location)},args:process.argv.slice(2),database:process.env.DATABASE_URL||null})+'\\n');\nprocess.exit(${code});\n`);
    }
  }
  const invoke = (args = tail, name = names[0], source = "scripts/db-migrate-safe.mjs") => spawnSync(process.execPath, [launcher, name, source, ...args], { cwd: dir, env, encoding: "utf8", timeout: 10000 });
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  try { check({ invoke, calls }); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("literal Render pair executes both source commands in order without forwarding operators", () => fixture({}, ({ invoke, calls }) => {
  const result = invoke(); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls().map(row => row.step), ["db-migrate-safe", "check-required-production-schema"]);
  assert.ok(calls().every(row => row.args.length === 0));
  assert.match(result.stdout, /Canonical migration and independent required-schema pair passed/);
}));
test("literal Render pair prefers both built entrypoints over source fallbacks", () => fixture({ built: true }, ({ invoke, calls }) => {
  const result = invoke(); assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls().map(row => row.location), ["dist/release", "dist/release"]);
}));
test("a migration failure retains its exit code and prevents the second command", () => fixture({ first: 23 }, ({ invoke, calls }) => {
  const result = invoke(); assert.equal(result.status, 23);
  assert.deepEqual(calls().map(row => row.step), ["db-migrate-safe"]);
  assert.doesNotMatch(result.stdout, /pair passed/);
}));
test("independent verification failure prevents a successful deployment", () => fixture({ second: 29 }, ({ invoke, calls }) => {
  const result = invoke(); assert.equal(result.status, 29); assert.equal(calls().length, 2);
  assert.doesNotMatch(result.stdout, /pair passed/);
}));
test("a missing verifier stops before any migration is executed", () => fixture({ missingVerifier: true }, ({ invoke, calls }) => {
  const result = invoke(); assert.notEqual(result.status, 0); assert.equal(calls().length, 0);
  assert.match(result.stderr, /Release entrypoint is missing/);
}));
test("unknown shell sequences are rejected before any child process", () => fixture({}, ({ invoke, calls }) => {
  for (const operator of ["&&", "||", ";", "|"]) {
    const result = invoke([operator, "npm", "run", "unapproved"]);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Unsupported release command sequence/);
  }
  assert.equal(calls().length, 0);
}));
test("extra commands after the approved pair are not silently ignored", () => fixture({}, ({ invoke, calls }) => {
  const result = invoke([...tail, "&&", "anything-else"]);
  assert.notEqual(result.status, 0); assert.equal(calls().length, 0);
}));
test("ordinary release arguments remain unchanged", () => fixture({}, ({ invoke, calls }) => {
  const result = invoke(["--no-repair"]); assert.equal(result.status, 0);
  assert.deepEqual(calls().map(row => row.args), [["--no-repair"]]);
}));
test("both approved commands receive the same certificate-verified database environment", () => fixture({ databaseUrl: "postgresql://synthetic:synthetic@db.example.invalid/test?sslmode=require" }, ({ invoke, calls }) => {
  const result = invoke(); assert.equal(result.status, 0, result.stderr);
  const values = calls().map(row => row.database);
  assert.equal(values.length, 2); assert.equal(values[0], values[1]);
  assert.equal(new URL(values[0]).searchParams.get("sslmode"), "verify-full");
}));
test("the approved tail cannot be attached to another release command", () => fixture({}, ({ invoke, calls }) => {
  const result = invoke(tail, "ensure-public-media-ready", "scripts/ensure-public-media-ready.mjs");
  assert.notEqual(result.status, 0); assert.equal(calls().length, 0);
  assert.match(result.stderr, /Unsupported release command sequence/);
}));
