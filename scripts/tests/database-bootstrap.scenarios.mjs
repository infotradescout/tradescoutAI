import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { provePublicationSafety } from "./clean-setup-publication.native.mjs";

const root = process.cwd();
const base = "908d2d4e2c76141ffe2cdcfa52e756dfb52fae84";
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "tradescout-db598-"));
const out = path.join(temp, "evidence");
await fs.mkdir(out, { recursive: true });
const password = crypto.randomBytes(24).toString("hex");
const scrub = (value) => String(value).replaceAll(password, "[disposable-password]").replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[disposable-postgres-url]");
const result = { source: null, base, startedAt: new Date().toISOString(), nativePostgres: null, scenarios: [], commands: [], passed: false,
  scope: "Actual full historical empty-database setup and repeat; business publication safety; separately prepared compatibility and recovery fixtures; no production database access." };
let cluster, clusterStarted = false, commandIndex = 0;
const worktrees = [];
const envBase = { ...process.env, NODE_ENV: "test", ALLOW_INSECURE_TEST_DATABASE: "true", ALLOW_TEST_DB_FULL_SYNC: "true", VITEST_SERIAL: "true" };
for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "BASE_URL", "APP_URL", "SKIP_NPM_CI", "SKIP_TEST_DB_BOOTSTRAP", "RUN_INTEGRATION_TESTS", "BROWSER_PROOF_NOTE"]) delete envBase[key];

async function command(label, executable, args, { cwd = root, env = envBase, expected = 0, timeout = 900000 } = {}) {
  const file = `${String(++commandIndex).padStart(2, "0")}-${label.replace(/[^a-z0-9-]/gi, "-")}.log`;
  const record = { label, startedAt: new Date().toISOString(), exit: null, log: file };
  result.commands.push(record);
  console.log("DB598_COMMAND_START " + JSON.stringify({ label }));
  let text = "", child;
  const status = await new Promise((resolve, reject) => {
    child = spawn(executable, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`${label} exceeded its safety timeout`)); }, timeout);
    const collect = (chunk) => { const clean = scrub(chunk); text += clean; process.stdout.write(clean); };
    child.stdout.on("data", collect); child.stderr.on("data", collect);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => { clearTimeout(timer); resolve(code ?? (signal ? 128 : 1)); });
  });
  record.exit = status; record.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, file), text);
  console.log("DB598_COMMAND_END " + JSON.stringify(record));
  if (expected === "failure") assert.notEqual(status, 0, `${label} must fail honestly`);
  else assert.equal(status, expected, `${label} failed; see ${file}`);
  return { status, text };
}
async function scenario(name, task) {
  const row = { name, passed: false }; result.scenarios.push(row);
  console.log("DB598_SCENARIO_START " + name);
  try { row.detail = await task(); row.passed = true; }
  catch (error) { row.failure = scrub(error.message); throw error; }
  finally { console.log("DB598_SCENARIO " + JSON.stringify(row)); }
}
async function gitText(args) {
  let text = "";
  const code = await new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { text += chunk; });
    child.once("error", reject); child.once("close", resolve);
  });
  assert.equal(code, 0); return text.trim();
}
async function checkout(name, ref) {
  const dir = path.join(temp, name);
  await command("checkout-" + name, "git", ["worktree", "add", "--detach", dir, ref]);
  worktrees.push(dir);
  await fs.symlink(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
  return dir;
}
const sha = (sql) => crypto.createHash("sha256").update(sql).digest("hex");
const journal = JSON.parse(await fs.readFile(path.join(root, "migrations/meta/_journal.json"), "utf8"));
const entries = journal.entries;
const canonical = ["0072_seo_publication_rules_and_freshness", "0115_profile_accounts", "0116_admin_live_stream_snapshots", "0117_managed_partner_intakes", "0118_profile_account_public_routes", "0129_restore_profile_account_identity_contract", "0130_business_managed_partner_contact", "0131_preserve_jw_stone_pricing_revocation"];
const renderPredeployArgs = ["run", "db:migrate", "&&", "npm", "run", "db:verify:required"];
async function sqlFor(tag) { return fs.readFile(path.join(root, "migrations", tag + ".sql"), "utf8"); }
async function connect(url) { const client = new pg.Client({ connectionString: url }); await client.connect(); return client; }
async function ledger(client) {
  const exists = (await client.query("select to_regclass('drizzle.__drizzle_migrations') is not null as present")).rows[0].present;
  return exists ? (await client.query("select hash, created_at from drizzle.__drizzle_migrations order by created_at, hash")).rows : [];
}
async function ensureLedger(client) {
  await client.query("create schema if not exists drizzle; create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)");
}
async function apply(client, tag, { crlf = false } = {}) {
  const entry = entries.find((item) => item.tag === tag); assert.ok(entry, tag);
  let sql = await sqlFor(tag); if (crlf) sql = sql.replace(/\r\n?/g, "\n").replace(/\n/g, "\r\n");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("insert into drizzle.__drizzle_migrations(hash, created_at) select $1, $2 where not exists(select 1 from drizzle.__drizzle_migrations where hash=$1)", [sha(sql), Number(entry.when)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}
async function focusedJournal(name, tags) {
  const dir = path.join(temp, name); await fs.mkdir(dir);
  await fs.cp(path.join(root, "migrations"), path.join(dir, "migrations"), { recursive: true });
  await fs.writeFile(path.join(dir, "migrations/meta/_journal.json"), JSON.stringify({ ...journal, entries: entries.filter((entry) => tags.includes(entry.tag)) }));
  return dir;
}
const dbEnv = (url) => ({ ...envBase, DATABASE_URL: url, TEST_DATABASE_URL: url });
const runScript = (label, script, url, options = {}) => command(label, process.execPath, [path.join(root, script), ...(options.args || [])], { env: dbEnv(url), ...options });
async function assertCurrentVerificationFunction(client) {
  const expected = (await sqlFor("0131_preserve_jw_stone_pricing_revocation")).match(/CREATE OR REPLACE FUNCTION sync_profile_account_business_verification\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/i)?.[1];
  assert.ok(expected);
  const row = (await client.query("select prosrc, obj_description(oid, 'pg_proc') as marker from pg_proc where oid=to_regprocedure('sync_profile_account_business_verification()')")).rows[0];
  assert.ok(row);
  assert.equal(row.marker, "tradescout-schema:0131:v1");
  const normalize = (value) => value.trim().replace(/\s+/g, " ");
  assert.equal(normalize(row.prosrc), normalize(expected));
}
async function assertCompleteEmptySetup(db) {
  const history = await ledger(db);
  assert.equal(history.length, entries.length);
  for (const entry of entries) {
    const sql = await sqlFor(entry.tag);
    const lf = sql.replace(/\r\n?/g, "\n");
    assert.ok(history.some((row) => [sha(lf), sha(lf.replace(/\n/g, "\r\n"))].includes(row.hash) && Number(row.created_at) === Number(entry.when)), `Missing actually executed migration ${entry.tag}`);
  }
  const rows = (await db.query("select (select count(*)::int from users) as users, (select count(*)::int from profiles) as profiles, (select count(*)::int from businesses) as businesses, (select count(*)::int from bidrock_listings) as listings, (select count(*)::int from stone_inventory_positions) as inventory")).rows[0];
  assert.deepEqual(rows, { users: 0, profiles: 0, businesses: 0, listings: 0, inventory: 0 });
  await assertCurrentVerificationFunction(db);
  return history;
}

try {
  assert.ok(process.env.EMBEDDED_POSTGRES_MODULE, "EMBEDDED_POSTGRES_MODULE is required; install the pinned native test dependency outside the repository");
  assert.ok(!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL, "This harness creates its own isolated targets; supplied database targets are refused");
  result.source = await gitText(["rev-parse", "HEAD"]);
  if (process.env.DB598_EXPECTED_HEAD) assert.equal(result.source, process.env.DB598_EXPECTED_HEAD);
  assert.equal(await gitText(["status", "--porcelain"]), "", "Start from the exact clean candidate");
  await command("unit-contracts", process.execPath, ["--test", "scripts/tests/database-bootstrap.contract.test.mjs"]);
  const { default: EmbeddedPostgres } = await import(pathToFileURL(process.env.EMBEDDED_POSTGRES_MODULE).href);
  const socket = net.createServer(); await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port; await new Promise((resolve) => socket.close(resolve));
  cluster = new EmbeddedPostgres({ databaseDir: path.join(temp, "pgdata"), user: "postgres", password, port,
    persistent: false, postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
    onLog: (value) => console.log("DB598_PG " + scrub(value)), onError: (value) => console.error("DB598_PG " + scrub(value)) });
  await cluster.initialise(); await cluster.start(); clusterStarted = true;
  const newDb = async (name) => {
    assert.match(name, /^db598_test_[a-z_]+$/); await cluster.createDatabase(name);
    return `postgresql://postgres:${password}@127.0.0.1:${port}/${name}?sslmode=disable`;
  };
  const emptyUrl = await newDb("db598_test_empty");
  const client = await connect(emptyUrl);
  try {
    result.nativePostgres = (await client.query("select version() as version, host(inet_server_addr()) as host")).rows[0];
    assert.equal(result.nativePostgres.host, "127.0.0.1");
  } finally { await client.end(); }

  await scenario("original false success reproduced on unchanged release base", async () => {
    const url = await newDb("db598_test_control"); const old = await checkout("original-control", base);
    await command("original-empty-migrate", "npm", ["run", "db:migrate"], { cwd: old, env: dbEnv(url) });
    await command("original-empty-schema-rejected", "npm", ["run", "db:verify:required"], { cwd: old, env: dbEnv(url), expected: "failure" });
    const db = await connect(url);
    try { assert.ok((await ledger(db)).some((row) => Number(row.created_at) === Number(entries.at(-1).when)), "original fallback stamps the newest entry"); }
    finally { await db.end(); }
    return "The unchanged baseline returned success while the independent native required-schema check failed.";
  });
  await scenario("fresh historical chain completes without business fixtures and repeat preserves actual history", async () => {
    await runScript("empty-migrate", "scripts/db-migrate-safe.mjs", emptyUrl);
    const db = await connect(emptyUrl);
    try {
      const first = await assertCompleteEmptySetup(db);
      await runScript("empty-required-schema", "scripts/check-required-production-schema.mjs", emptyUrl);
      await runScript("empty-migrate-repeat", "scripts/db-migrate-safe.mjs", emptyUrl);
      assert.deepEqual(await ledger(db), first);
      await runScript("baseline-refuses", "scripts/db-baseline-drizzle.mjs", emptyUrl, { expected: "failure" });
      assert.deepEqual(await ledger(db), first);
    } finally { await db.end(); }
    result.publicationCases = await provePublicationSafety({ newDb, connect, sqlFor, gitText, focusedJournal, runScript, ledger, ensureLedger, entries });
    assert.equal(result.publicationCases.length, 22);
    assert.ok(result.publicationCases.every((item) => item.passed));
    return `All ${entries.length} real journal migrations and the unchanged required-schema verifier passed from an empty database without business fixtures or schema push. Repeat preserves every actual migration identity. All 22 native publication and historical identity cases passed.`;
  });
  await scenario("gap preview makes no database objects or history", async () => {
    const url = await newDb("db598_test_preview"); const db = await connect(url);
    try {
      const before = (await db.query("select nspname from pg_namespace order by nspname")).rows;
      await runScript("empty-gap-preview", "scripts/db-migrate-fill-gaps.mjs", url, { args: ["--dry-run"] });
      assert.deepEqual((await db.query("select nspname from pg_namespace order by nspname")).rows, before);
      assert.equal((await ledger(db)).length, 0);
    } finally { await db.end(); }
    return "A successful read-only plan creates neither the migration ledger nor a schema.";
  });
  await scenario("failed canonical SQL rolls back, stays unrecorded, and retries after prerequisites", async () => {
    const url = await newDb("db598_test_partial");
    const cwd = await focusedJournal("partial-journal", [canonical[0]]); const db = await connect(url);
    try {
      await runScript("partial-sql-failure", "scripts/db-migrate-fill-gaps.mjs", url, { cwd, expected: "failure" });
      assert.equal((await ledger(db)).length, 0);
      assert.equal((await db.query("select to_regclass('public.ts_publication_rules') is null as absent")).rows[0].absent, true);
      assert.equal((await db.query("select count(*)::int as count from pg_type where typname='ts_claimed_status'")).rows[0].count, 0);
      await db.query("create table counties(id varchar primary key); create table businesses(id varchar primary key)");
      await runScript("partial-sql-retry", "scripts/db-migrate-fill-gaps.mjs", url, { cwd, expected: "failure" });
      assert.equal((await ledger(db)).length, 1);
      assert.equal((await db.query("select count(*)::int as count from ts_publication_rules where id='default'")).rows[0].count, 1);
      const prior = await ledger(db);
      await runScript("partial-sql-repeat", "scripts/db-migrate-fill-gaps.mjs", url, { cwd, expected: "failure" });
      assert.deepEqual(await ledger(db), prior);
    } finally { await db.end(); }
    return "Canonical 0072 rolls back completely on missing prerequisites, applies once after they exist, and still refuses overall success because the rest of the required schema is absent.";
  });

  const preparedUrl = await newDb("db598_test_prepared");
  await scenario("separate prepared-schema compatibility fixture", async () => {
    await command("guarded-full-fixture", "npm", ["run", "db:bootstrap:test", "--", "--full-sync"], { env: dbEnv(preparedUrl) });
    const db = await connect(preparedUrl);
    try { await ensureLedger(db); for (const tag of canonical) await apply(db, tag); await assertCurrentVerificationFunction(db); }
    finally { await db.end(); }
    await runScript("prepared-required-schema", "scripts/check-required-production-schema.mjs", preparedUrl);
    await runScript("prepared-normal-migrate", "scripts/db-migrate-safe.mjs", preparedUrl);
    const pair = await command("source-render-predeploy-pair", "npm", renderPredeployArgs, { env: dbEnv(preparedUrl) });
    assert.match(pair.text, /Canonical migration and independent required-schema pair passed/);
    assert.ok((pair.text.match(/Required production schema is present/g) || []).length >= 2);
    return "The guarded prepared fixture and eight actually executed canonical SQL files pass unchanged required-schema predicates. This existing-schema compatibility test is separate from the real empty-database success proved above.";
  });
  await scenario("later watermark cannot hide a required gap; reviewed canonical recovery succeeds", async () => {
    const cwd = await focusedJournal("required-journal", canonical); const db = await connect(preparedUrl);
    try {
      await db.query("delete from drizzle.__drizzle_migrations where hash=$1", [sha(await sqlFor(canonical[0]))]);
      await runScript("watermark-gap-rejected", "scripts/db-migrate-safe.mjs", preparedUrl, { expected: "failure" });
      await runScript("watermark-focused-recovery", "scripts/db-migrate-fill-gaps.mjs", preparedUrl, { cwd });
      const complete = await ledger(db);
      await runScript("watermark-recovery-repeat", "scripts/db-migrate-fill-gaps.mjs", preparedUrl, { cwd });
      assert.deepEqual(await ledger(db), complete); await assertCurrentVerificationFunction(db);
    } finally { await db.end(); }
    return "A deliberately lost 0072 test-ledger record is detected despite an actually applied 0131 watermark; executing canonical 0072 restores it without duplicate history or rule changes.";
  });
  await scenario("LF and CRLF migration identities remain accepted without duplicate replay", async () => {
    const cwd = await focusedJournal("line-ending-journal", canonical); const db = await connect(preparedUrl);
    try {
      await apply(db, canonical[0], { crlf: true });
      await db.query("delete from drizzle.__drizzle_migrations where hash=$1", [sha(await sqlFor(canonical[0]))]);
      const before = await ledger(db);
      await runScript("crlf-required-schema", "scripts/check-required-production-schema.mjs", preparedUrl);
      await runScript("crlf-gap-repeat", "scripts/db-migrate-fill-gaps.mjs", preparedUrl, { cwd });
      assert.deepEqual(await ledger(db), before);
    } finally { await db.end(); }
    return "The CRLF identity was recorded only after actual CRLF SQL executed; verification and gap recovery recognize it without adding another entry.";
  });
  await scenario("older membership replay cannot overwrite already recorded protections", async () => {
    const cwd = await focusedJournal("successor-journal", canonical); const db = await connect(preparedUrl);
    try {
      await db.query("delete from drizzle.__drizzle_migrations where hash=$1", [sha(await sqlFor(canonical[1]))]);
      const before = await ledger(db);
      const attempt = await runScript("predecessor-replay-refused", "scripts/db-migrate-fill-gaps.mjs", preparedUrl, { cwd, expected: "failure" });
      assert.match(attempt.text, /Unsafe predecessor replay refused before SQL or ledger changes/);
      assert.deepEqual(await ledger(db), before); await assertCurrentVerificationFunction(db);
      const again = await runScript("predecessor-retry-refused", "scripts/db-migrate-fill-gaps.mjs", preparedUrl, { cwd, expected: "failure" });
      assert.match(again.text, /Unsafe predecessor replay refused/);
      assert.deepEqual(await ledger(db), before); await assertCurrentVerificationFunction(db);
    } finally { await db.end(); }
    return "An incomplete migration history is not allowed to downgrade an existing 0131 membership function on initial attempt or retry.";
  });
  await scenario("0115 path regression reproduced and full current successor sequence restored", async () => {
    const db = await connect(preparedUrl);
    try {
      await apply(db, "0115_profile_accounts");
      const failure = await runScript("0115-path-contract-rejected", "scripts/check-required-production-schema.mjs", preparedUrl, { expected: "failure" });
      assert.match(failure.text, /profile_accounts\[canonical columns\/constraints\/indexes\]/);
      await apply(db, "0118_profile_account_public_routes");
      await apply(db, "0129_restore_profile_account_identity_contract");
      await apply(db, "0131_preserve_jw_stone_pricing_revocation");
      await assertCurrentVerificationFunction(db);
      await runScript("current-successor-schema", "scripts/check-required-production-schema.mjs", preparedUrl);
      await db.query("create temporary table path_probe (source_path text, resume_path text)");
      const constraints = (await db.query("select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='profile_accounts'::regclass and conname in ('profile_accounts_source_path_check','profile_accounts_resume_path_check') order by conname")).rows;
      assert.equal(constraints.length, 2);
      for (let i = 0; i < constraints.length; i++) await db.query(`alter table path_probe add constraint probe_${i} ${constraints[i].definition}`);
      for (const value of [null, "/", "/jw-stone", "/issa-build/onyx", "/u/example"]) await db.query("insert into path_probe(source_path,resume_path) values($1,$1)", [value]);
      for (const value of ["//example.invalid", "/\\example.invalid", "https://example.invalid"]) {
        await assert.rejects(db.query("insert into path_probe(source_path,resume_path) values($1,$1)", [value]), (error) => error.code === "23514");
      }
    } finally { await db.end(); }
    return "The older canonical SQL fails the unchanged path contract. The ordered current successors restore it; native constraints accept five local/null cases and reject three external/backslash cases.";
  });

  if (process.env.DB598_FULL_RELEASE === "1") {
    await scenario("exact-candidate built browser proof in a separate worktree", async () => {
      const browserDir = await checkout("browser-candidate", result.source);
      await command("install-chromium", process.execPath, [path.join(root, "node_modules/playwright/cli.js"), "install", "chromium"]);
      const browserEnv = { ...envBase, PROFILE_PROOF_MODE: "preview" };
      delete browserEnv.NODE_ENV;
      await command("candidate-browser", process.execPath, ["scripts/verify-business-profile-review.mjs"], { cwd: browserDir, env: browserEnv });
      const report = JSON.parse(await fs.readFile(path.join(browserDir, ".business-profile-proof/result.json"), "utf8"));
      assert.equal(report.source, result.source); assert.equal(report.passed, true);
      assert.equal(report.pages.length, 4); assert.ok(report.pages.every((page) => page.passed));
      await fs.cp(path.join(browserDir, ".business-profile-proof"), path.join(out, "browser"), { recursive: true });
      return "Four built-candidate viewport journeys passed, including gallery, request-panel opening and separate Onyx page; all live POSTs were blocked.";
    });
    await scenario("complete minimum release contract with production assets and guarded test database", async () => {
      assert.equal(await gitText(["status", "--porcelain"]), "", "The release checkout must remain clean before the full gate");
      await command("minimum-release-contract", "npm", ["run", "gate:minimum-release"], {
        env: { ...dbEnv(emptyUrl), BROWSER_PROOF_NOTE: `Exact candidate ${result.source}: four built-preview browser viewports passed in an independent worktree; report and captures preserved in database-bootstrap proof. The gate database was created by the complete real migration chain, not schema push.` },
      });
      const evidencePath = path.join(root, "artifacts/release-contract", result.source.slice(0, 12), "evidence.json");
      const evidence = JSON.parse(await fs.readFile(evidencePath, "utf8"));
      assert.equal(evidence.commit, result.source); assert.equal(evidence.result, "pass");
      assert.equal(evidence.dirtyTree, false); assert.ok(evidence.steps.every((step) => step.status === "pass"));
      await fs.copyFile(evidencePath, path.join(out, "release-evidence.json"));
      return "Exact clean source, fresh dependency installation, full typecheck/build, all required contract tests, native full-chain database migration/verification, browser evidence and health contract passed without skips.";
    });
    await scenario("built production migration entrypoint also rejects the incomplete database", async () => {
      const builtUrl = await newDb("db598_test_built_empty");
      const builtPair = await command("built-render-predeploy-initializes-empty", "npm", renderPredeployArgs, { env: dbEnv(builtUrl) });
      assert.match(builtPair.text, /Running canonical pre-deploy step: check-required-production-schema/);
      assert.match(builtPair.text, /Canonical migration and independent required-schema pair passed/);
      assert.ok((builtPair.text.match(/Required production schema is present/g) || []).length >= 2);
      const db = await connect(builtUrl);
      try {
        const before = await assertCompleteEmptySetup(db);
        await command("built-empty-repeat", "npm", ["run", "db:migrate"], { env: dbEnv(builtUrl) });
        assert.deepEqual(await ledger(db), before);
        // Corrupt only this disposable database after successful setup. A latest
        // ledger marker must never hide genuinely missing required structure.
        await db.query("ALTER TABLE profile_accounts DROP CONSTRAINT profile_accounts_source_path_check");
        const rejectedPair = await command("built-render-predeploy-rejects-damaged-schema", "npm", renderPredeployArgs, { env: dbEnv(builtUrl), expected: "failure" });
        assert.match(rejectedPair.text, /Running canonical pre-deploy step: db-migrate-safe/);
        assert.doesNotMatch(rejectedPair.text, /Running canonical pre-deploy step: check-required-production-schema/);
        assert.doesNotMatch(rejectedPair.text, /Canonical migration and independent required-schema pair passed/);
        assert.deepEqual(await ledger(db), before);
      } finally { await db.end(); }
      return "The compiled Docker-style command pair creates a second empty database through all actual migrations and both verifiers. Repeating changes no history. Deliberately removing a required constraint then fails without continuing or fabricating a repair.";
    });
  }
  result.passed = result.scenarios.every((row) => row.passed);
} catch (error) {
  result.failure = scrub(error.stack || error.message); console.error("DB598_FAILURE " + result.failure);
} finally {
  if (cluster && clusterStarted) {
    try { await cluster.stop(); result.databaseCleanup = "stopped"; }
    catch (error) { result.databaseCleanup = "failed: " + scrub(error.message); result.passed = false; }
  }
  for (const dir of worktrees) await command("remove-worktree", "git", ["worktree", "remove", "--force", dir]).catch((error) => { result.cleanupWarning = scrub(error.message); });
  result.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2));
  const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await fs.writeFile(path.join(out, "index.html"), `<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TradeScout database repair verification</title><main style="max-width:1000px;margin:auto;padding:24px;font:16px/1.6 system-ui"><h1>Database repair verification</h1><p>${result.passed ? "All recorded checks passed." : "Verification failed. This is not a production release."}</p><p>No production database or customer records were used.</p><a href="result.json">Detailed result</a>${result.scenarios.map((row) => `<section><h2>${esc(row.name)}</h2><p>${esc(row.passed ? row.detail : row.failure || "Not completed")}</p></section>`).join("")}</main></html>`);
  await fs.cp(out, path.join(root, ".db-bootstrap-proof"), { recursive: true });
  console.log("DB598_FINAL " + JSON.stringify({ source: result.source, passed: result.passed, nativePostgres: result.nativePostgres, scenarios: result.scenarios, publicationCases: result.publicationCases, failure: result.failure, databaseCleanup: result.databaseCleanup, completedAt: result.completedAt }));
  await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
}
process.exitCode = result.passed ? 0 : 1;