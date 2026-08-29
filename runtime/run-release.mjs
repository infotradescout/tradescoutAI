import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  allowExplicitInsecureTestDatabase,
  secureDatabaseEnvironment,
} from "./database-url-security.mjs";

const [builtName, sourcePath, ...args] = process.argv.slice(2);
if (!builtName || !sourcePath || !/^[a-z0-9-]+$/i.test(builtName)) {
  throw new Error("Usage: run-release <built-name> <source-path> [...args]");
}

const root = process.cwd();
const builtPath = path.join(root, "dist", "release", `${builtName}.mjs`);
const fallbackPath = path.resolve(root, sourcePath);
const target = fs.existsSync(builtPath) ? builtPath : fallbackPath;
if (!fs.existsSync(target)) throw new Error(`Release entrypoint is missing: ${target}`);

const env = secureDatabaseEnvironment(process.env, {
  allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env),
});

const result = spawnSync(process.execPath, [target, ...args], {
  cwd: root,
  env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
