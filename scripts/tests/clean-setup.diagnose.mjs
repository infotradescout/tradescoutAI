import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

// Diagnostic only: no supplied database, customer data, or production connection.
assert.ok(!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL, 'Supplied database targets are forbidden');
const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ts-clean-diagnose-'));
const output = path.join(root, '.clean-setup-diagnostic');
const report = { kind: 'diagnostic-not-release-proof', source: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), startedAt: new Date().toISOString(), attempts: [], cleanup: false };
const password = crypto.randomBytes(24).toString('hex');
const scrub = (text) => String(text).replaceAll(password, '[disposable-password]').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[disposable-url]');
const requireNative = createRequire('/tmp/tradescout-clean-dependencies/package.json');
const { default: EmbeddedPostgres } = await import(pathToFileURL(requireNative.resolve('embedded-postgres')).href);
const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const cluster = new EmbeddedPostgres({ databaseDir: path.join(temp, 'pgdata'), user: 'postgres', password, port, persistent: false, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog: () => {}, onError: (text) => console.error(scrub(text)) });
let started = false;
try {
  await cluster.initialise(); await cluster.start(); started = true;
  const entries = JSON.parse(await fs.readFile('migrations/meta/_journal.json', 'utf8')).entries;
  await cluster.createDatabase('ts_clean_test_diagnostic');
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/ts_clean_test_diagnostic?sslmode=disable`;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    report.postgres = (await client.query('select version() as version')).rows[0].version;
    // Commit complete files separately to identify the exact failing file/statement.
    for (const entry of entries) {
      const sql = await fs.readFile(path.join('migrations', entry.tag + '.sql'), 'utf8');
      const step = { tag: entry.tag, applied: false };
      report.attempts.push(step);
      await client.query('BEGIN');
      try {
        const statements = sql.split('--> statement-breakpoint');
        for (let i = 0; i < statements.length; i++) {
          step.statement = i + 1;
          await client.query(statements[i]);
        }
        await client.query('COMMIT'); step.applied = true;
        console.log('CLEAN_SETUP_APPLIED ' + entry.tag);
      } catch (error) {
        await client.query('ROLLBACK');
        step.error = scrub(error.message); step.code = error.code; step.position = error.position;
        console.error('CLEAN_SETUP_ROOT_FAILURE ' + JSON.stringify(step));
        break;
      }
    }
    report.tables = (await client.query("select count(*)::int as count from pg_tables where schemaname='public'")).rows[0].count;
    report.allMigrationsExecuted = report.attempts.length === entries.length && report.attempts.every((step) => step.applied);
  } finally { await client.end(); }
} catch (error) {
  report.infrastructureFailure = scrub(error.message);
  console.error('CLEAN_SETUP_DIAGNOSTIC_ERROR ' + scrub(error.stack));
  process.exitCode = 1;
} finally {
  try { if (started) await cluster.stop(); await fs.rm(temp, { recursive: true, force: true }); report.cleanup = true; }
  catch (error) { report.cleanupError = scrub(error.message); process.exitCode = 1; }
  report.completedAt = new Date().toISOString();
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><title>Clean setup diagnostic</title><h1>Diagnostic only — not release proof</h1><a href="result.json">Sanitized diagnostic result</a>');
  console.log('CLEAN_SETUP_DIAGNOSTIC ' + JSON.stringify(report));
}
