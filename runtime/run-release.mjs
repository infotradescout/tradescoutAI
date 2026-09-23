import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const bundledSecurityUrl = new URL("./database-url-security.mjs", import.meta.url);
const { allowExplicitInsecureTestDatabase, secureDatabaseEnvironment } = await import(
  fs.existsSync(bundledSecurityUrl)
    ? bundledSecurityUrl.href
    : new URL("../shared/database-url-security.mjs", import.meta.url).href
);

const [builtName, sourcePath, ...args] = process.argv.slice(2);
if (!builtName || !sourcePath || !/^[a-z0-9-]+$/i.test(builtName)) {
  throw new Error("Usage: run-release <built-name> <source-path> [...args]");
}

// Docker exec-style command overrides can pass the configured second command
// through npm as literal arguments. Recognize only this exact approved pair;
// never interpret arbitrary shell syntax or drop the independent schema check.
const canonicalTail = ["&&", "npm", "run", "db:verify:required"];
const canonicalPair = builtName === "db-migrate-safe"
  && sourcePath === "scripts/db-migrate-safe.mjs"
  && args.length === canonicalTail.length
  && args.every((arg, index) => arg === canonicalTail[index]);
if (!canonicalPair && args.some((arg) => ["&&", "||", ";", "|"].includes(arg))) {
  throw new Error("Unsupported release command sequence; no command was executed");
}

const requested = canonicalPair
  ? [
      { name: builtName, source: sourcePath, args: [] },
      { name: "check-required-production-schema", source: "scripts/check-required-production-schema.mjs", args: [] },
    ]
  : [{ name: builtName, source: sourcePath, args }];
// Extend the canonical schema gate for both pre-deploy and startup. Resolve every
// verifier before executing a migration so missing build artifacts cannot fail open.
const expanded = requested.flatMap((command) =>
  command.name === "check-required-production-schema" && command.source === "scripts/check-required-production-schema.mjs"
    ? [command, { name: "check-exchange-stone-schema", source: "scripts/check-exchange-stone-schema.mjs", args: [] }]
    : [command]
);
// Publication is off by default and uses only the fixed owner-approved batch.
// Repeated startup checks read its completed receipt; they cannot republish new
// products, substitute prices, or resurrect subsequently edited/sold listings.
if (expanded.some(command => command.name === "check-exchange-stone-schema") &&
    process.env.STONE_RETAIL_LAUNCH_MODE && process.env.STONE_RETAIL_LAUNCH_MODE !== "off") {
  if (!["inspect", "dry_run", "apply"].includes(process.env.STONE_RETAIL_LAUNCH_MODE)) throw new Error("Unknown stone launch mode");
  expanded.push({ name: "apply-exchange-stone-package", source: "scripts/apply-exchange-stone-package.mjs", args: [] });
}
const root = process.cwd();
// Resolve all targets before performing any migration. A missing verifier is
// a failed deployment, not permission to run only the first command.
const commands = expanded.map((command) => {
  const builtPath = path.join(root, "dist", "release", `${command.name}.mjs`);
  const fallbackPath = path.resolve(root, command.source);
  const target = fs.existsSync(builtPath) ? builtPath : fallbackPath;
  if (!fs.existsSync(target)) throw new Error(`Release entrypoint is missing: ${target}`);
  return { ...command, target };
});
const env = secureDatabaseEnvironment(process.env, {
  allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env),
});

for (const command of commands) {
  if (canonicalPair) console.log(`[release] Running canonical pre-deploy step: ${command.name}`);
  const result = spawnSync(process.execPath, [command.target, ...command.args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (canonicalPair) console.log("[release] Canonical migration and independent required-schema pair passed.");
process.exit(0);
