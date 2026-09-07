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
const root = process.cwd();
// Resolve both targets before performing any migration. A missing verifier is
// a failed deployment, not permission to run only the first command.
const commands = requested.map((command) => {
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
