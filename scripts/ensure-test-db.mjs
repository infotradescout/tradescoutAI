import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { securePostgresConnectionString } from "../shared/database-url-security.mjs";
import {
  assertDisposableDatabaseName,
  assertDisposableTestDatabaseUrl,
} from "./lib/test-db-safety.mjs";

class TestDatabaseConfigurationError extends Error {}

export function testDatabaseSetupErrorMessage(error) {
  return error instanceof TestDatabaseConfigurationError
    ? error.message
    : "Test database setup failed. Check the dedicated test server's availability and permissions.";
}

function readTestEnvironment(file, environment) {
  if (!fs.existsSync(file)) return;
  for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file, "utf8")))) {
    if (!environment[key]) environment[key] = value;
  }
}

function persistTestConnection(file, connectionString) {
  const original = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:export\s+)?TEST_DATABASE_URL\s*=/.test(line));
  while (lines.at(-1) === "") lines.pop();
  lines.push(`TEST_DATABASE_URL=${JSON.stringify(connectionString)}`, "");
  const temporary = `${file}.${randomUUID()}.tmp`;
  let descriptor;
  try {
    // Windows ignores POSIX mode bits. Supply the private DACL at file creation
    // so another user cannot retain a handle opened before permissions change.
    if (process.platform === "win32") {
      const systemRoot = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
      const protection = spawnSync(
        path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `
$ErrorActionPreference = 'Stop'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = [System.Security.AccessControl.FileSecurity]::new()
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow'))
if ($PSVersionTable.PSEdition -eq 'Core') {
  $stream = [System.IO.FileSystemAclExtensions]::Create([System.IO.FileInfo]::new($env:TRADESCOUT_PRIVATE_ENV_FILE), [System.IO.FileMode]::CreateNew, [System.Security.AccessControl.FileSystemRights]::FullControl, [System.IO.FileShare]::None, 4096, [System.IO.FileOptions]::None, $acl)
} else {
  $stream = [System.IO.FileStream]::new($env:TRADESCOUT_PRIVATE_ENV_FILE, [System.IO.FileMode]::CreateNew, [System.Security.AccessControl.FileSystemRights]::FullControl, [System.IO.FileShare]::None, 4096, [System.IO.FileOptions]::None, $acl)
}
try {
  $saved = if ($PSVersionTable.PSEdition -eq 'Core') { [System.IO.FileSystemAclExtensions]::GetAccessControl($stream) } else { $stream.GetAccessControl() }
  $rules = @($saved.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
  if (!$saved.AreAccessRulesProtected -or $saved.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $identity.Value -or $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $identity.Value -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].FileSystemRights -ne 'FullControl') { throw 'Private file ACL could not be verified' }
} finally { $stream.Dispose() }
`,
        ],
        {
          env: {
            SystemRoot: systemRoot,
            WINDIR: systemRoot,
            TEMP: process.env.TEMP,
            TMP: process.env.TMP,
            TRADESCOUT_PRIVATE_ENV_FILE: temporary,
          },
          encoding: "utf8",
          windowsHide: true,
          timeout: 15_000,
        }
      );
      if (protection.error || protection.status !== 0) {
        throw new TestDatabaseConfigurationError(
          "Could not protect the private test environment file. Existing settings were preserved."
        );
      }
      descriptor = fs.openSync(temporary, "r+");
    } else {
      descriptor = fs.openSync(temporary, "wx", 0o600);
    }
    fs.writeFileSync(descriptor, lines.join(newline));
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export async function ensureTestDatabase({
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  environment = process.env,
  Client = pg.Client,
  log = console.log,
} = {}) {
  const envTestPath = path.join(repoRoot, ".env.test");
  // Test setup never borrows the application's main connection or its env files.
  readTestEnvironment(envTestPath, environment);
  let testUrl;
  let adminUrl;
  let database;
  try {
    if (environment.TEST_DATABASE_URL) {
      testUrl = securePostgresConnectionString(environment.TEST_DATABASE_URL);
      assertDisposableTestDatabaseUrl(testUrl);
      environment.TEST_DATABASE_URL = testUrl;
      log("Using the configured disposable test database.");
      return testUrl;
    }
    if (!environment.TEST_DATABASE_ADMIN_URL) {
      throw new Error(
        "A dedicated TEST_DATABASE_URL or TEST_DATABASE_ADMIN_URL is required. The main DATABASE_URL is never used for test setup."
      );
    }
    database = assertDisposableDatabaseName(environment.TEST_DATABASE_NAME || "tradescout_test");
    adminUrl = securePostgresConnectionString(environment.TEST_DATABASE_ADMIN_URL);
    const target = new URL(adminUrl);
    target.pathname = `/${database}`;
    testUrl = target.toString();
    const safety = assertDisposableTestDatabaseUrl(testUrl);
    if (!safety.loopback && environment.ALLOW_REMOTE_TEST_DB_CREATE !== "true") {
      throw new Error(
        "Creating a remote test database requires ALLOW_REMOTE_TEST_DB_CREATE=true and a dedicated test-server connection."
      );
    }
  } catch (error) {
    throw new TestDatabaseConfigurationError(error.message);
  }

  const admin = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 10_000 });
  try {
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!exists.rowCount) {
      try {
        await admin.query(`CREATE DATABASE "${database}"`);
      } catch (error) {
        if (error.code !== "42P04") throw error;
      }
    }
  } finally {
    await admin.end();
  }

  const test = new Client({ connectionString: testUrl, connectionTimeoutMillis: 10_000 });
  try {
    await test.connect();
    const identity = await test.query("SELECT current_database() AS database_name");
    if (identity.rows[0]?.database_name !== database) {
      throw new TestDatabaseConfigurationError(
        "The connected database does not match the disposable target."
      );
    }
  } finally {
    await test.end();
  }

  persistTestConnection(envTestPath, testUrl);
  environment.TEST_DATABASE_URL = testUrl;
  log("Disposable test database is ready. Existing test settings were preserved.");
  return testUrl;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureTestDatabase().catch((error) => {
    console.error(testDatabaseSetupErrorMessage(error));
    process.exitCode = 1;
  });
}
