import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureTestDatabase,
  testDatabaseSetupErrorMessage,
} from "../../scripts/ensure-test-db.mjs";
import { runE2eWithTestDatabase } from "../../scripts/run-e2e-with-testdb.mjs";

const directories: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.resolve(".test-db-setup-"));
  directories.push(root);
  return root;
}
afterEach(() => {
  for (const root of directories.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function databaseDriver({ wrongIdentity = false, failConnection = false } = {}) {
  const connections: any[] = [];
  class Client {
    config: any;
    queries: any[] = [];
    constructor(config: any) {
      this.config = config;
      connections.push(this);
    }
    async connect() {
      if (failConnection) throw new Error(`Connection failed: ${this.config.connectionString}`);
    }
    async end() {}
    async query(sql: string, values?: unknown[]) {
      this.queries.push({ sql, values });
      if (sql.startsWith("SELECT 1")) return { rowCount: 0, rows: [] };
      if (sql.startsWith("SELECT current_database")) {
        return {
          rows: [
            {
              database_name: wrongIdentity
                ? "production"
                : new URL(this.config.connectionString).pathname.slice(1),
            },
          ],
        };
      }
      return { rows: [] };
    }
  }
  return { Client, connections };
}

describe("isolated test database setup", () => {
  it("never borrows the main connection or production env files", async () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, ".env"),
      "DATABASE_URL=postgres://live:private@live.example/production\n"
    );
    const { Client, connections } = databaseDriver();
    await expect(
      ensureTestDatabase({
        repoRoot: root,
        environment: { DATABASE_URL: "postgres://live:private@live.example/production" },
        Client,
      })
    ).rejects.toThrow("dedicated TEST_DATABASE_URL");
    expect(connections).toHaveLength(0);
    expect(fs.existsSync(path.join(root, ".env.test"))).toBe(false);
  });

  it("reuses an explicit disposable connection without rewriting existing settings", async () => {
    const root = fixture();
    const original =
      '# Keep this setting\nTEST_DATABASE_URL="postgres://tester:synthetic@db.example/tradescout_test?sslmode=require"\nFEATURE_TEST=true\n';
    fs.writeFileSync(path.join(root, ".env.test"), original);
    const { Client, connections } = databaseDriver();
    const environment: any = {};
    const log = vi.fn();
    const url = await ensureTestDatabase({ repoRoot: root, environment, Client, log });
    expect(new URL(url).searchParams.get("sslmode")).toBe("verify-full");
    expect(environment.FEATURE_TEST).toBe("true");
    expect(connections).toHaveLength(0);
    expect(fs.readFileSync(path.join(root, ".env.test"), "utf8")).toBe(original);
    expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic");
  });

  it.each(["production", "tradescout_test_production", 'test";DROP DATABASE users;--'])(
    "rejects unsafe database names before connecting: %s",
    async (name) => {
      const { Client, connections } = databaseDriver();
      await expect(
        ensureTestDatabase({
          repoRoot: fixture(),
          environment: {
            TEST_DATABASE_ADMIN_URL: "postgres://tester:synthetic@127.0.0.1/postgres",
            TEST_DATABASE_NAME: name,
          },
          Client,
        })
      ).rejects.toThrow("disposable test database");
      expect(connections).toHaveLength(0);
    }
  );

  it("rejects a production-shaped explicit test URL", async () => {
    const { Client, connections } = databaseDriver();
    await expect(
      ensureTestDatabase({
        repoRoot: fixture(),
        environment: { TEST_DATABASE_URL: "postgres://tester:synthetic@127.0.0.1/production" },
        Client,
      })
    ).rejects.toThrow("disposable test database");
    expect(connections).toHaveLength(0);
  });

  it("requires explicit opt-in before creating on a remote test server", async () => {
    const { Client, connections } = databaseDriver();
    await expect(
      ensureTestDatabase({
        repoRoot: fixture(),
        environment: { TEST_DATABASE_ADMIN_URL: "postgres://tester:synthetic@db.example/postgres" },
        Client,
      })
    ).rejects.toThrow("ALLOW_REMOTE_TEST_DB_CREATE=true");
    expect(connections).toHaveLength(0);
  });

  it.each(["TEST_DATABASE_ADMIN_URL", "TEST_DATABASE_URL"])(
    "rejects a remote host hidden behind a loopback URL in %s",
    async (key) => {
      const { Client, connections } = databaseDriver();
      await expect(
        ensureTestDatabase({
          repoRoot: fixture(),
          environment: {
            [key]: "postgres://tester:synthetic@127.0.0.1/request_flow_test?host=remote.example",
          },
          Client,
        })
      ).rejects.toThrow("connection target overrides");
      expect(connections).toHaveLength(0);
    }
  );

  it("creates only the named test database and preserves private test settings", async () => {
    const root = fixture();
    fs.writeFileSync(
      path.join(root, ".env.test"),
      "# Existing settings\r\nFEATURE_TEST=true\r\nTEST_DATABASE_URL=\r\n"
    );
    const { Client, connections } = databaseDriver();
    const log = vi.fn();
    const environment: any = {
      TEST_DATABASE_ADMIN_URL: "postgres://tester:synthetic@127.0.0.1/postgres",
      TEST_DATABASE_NAME: "request_flow_test",
    };
    const url = await ensureTestDatabase({ repoRoot: root, environment, Client, log });
    expect(connections).toHaveLength(2);
    expect(connections[0].queries).toEqual([
      { sql: "SELECT 1 FROM pg_database WHERE datname = $1", values: ["request_flow_test"] },
      { sql: 'CREATE DATABASE "request_flow_test"', values: undefined },
    ]);
    expect(new URL(connections[1].config.connectionString).pathname).toBe("/request_flow_test");
    const saved = fs.readFileSync(path.join(root, ".env.test"), "utf8");
    expect(saved).toContain("# Existing settings\r\nFEATURE_TEST=true\r\n");
    expect(dotenv.parse(saved).TEST_DATABASE_URL).toBe(url);
    expect(fs.statSync(path.join(root, ".env.test")).mode & 0o777).toBe(0o600);
    expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic");
  });

  it.each([{ wrongIdentity: true }, { failConnection: true }])(
    "does not replace configuration after setup failure: %o",
    async (failure) => {
      const root = fixture();
      const original = "FEATURE_TEST=true\n";
      fs.writeFileSync(path.join(root, ".env.test"), original);
      const { Client } = databaseDriver(failure);
      const error = await ensureTestDatabase({
        repoRoot: root,
        environment: { TEST_DATABASE_ADMIN_URL: "postgres://tester:synthetic@127.0.0.1/postgres" },
        Client,
      }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(testDatabaseSetupErrorMessage(error)).not.toContain("synthetic");
      expect(testDatabaseSetupErrorMessage(error)).not.toContain("postgres://");
      expect(fs.readFileSync(path.join(root, ".env.test"), "utf8")).toBe(original);
    }
  );
});

describe("browser-test database handoff", () => {
  it("passes the dedicated target to both subprocesses even when a main URL is present", async () => {
    const url = "postgres://tester:synthetic@127.0.0.1/request_flow_test";
    const run = vi.fn().mockResolvedValue(0);
    const result = await runE2eWithTestDatabase({
      repoRoot: fixture(),
      environment: { DATABASE_URL: "postgres://live:private@live.example/production" },
      args: ["--project=chromium"],
      ensureDatabase: async () => url,
      run,
    });
    expect(result).toBe(0);
    expect(run).toHaveBeenCalledTimes(2);
    for (const call of run.mock.calls)
      expect(call[2].env).toMatchObject({
        DATABASE_URL: url,
        TEST_DATABASE_URL: url,
        NODE_ENV: "test",
      });
    expect(run.mock.calls[1][1]).toEqual(["playwright", "test", "--project=chromium"]);
  });

  it("does not start browser tests if database bootstrap fails", async () => {
    const run = vi.fn().mockResolvedValue(2);
    expect(
      await runE2eWithTestDatabase({
        repoRoot: fixture(),
        environment: {},
        ensureDatabase: async () => "postgres://tester:synthetic@127.0.0.1/request_flow_test",
        run,
      })
    ).toBe(2);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
