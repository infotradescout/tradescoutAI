import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import pg from 'pg';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve('test-results/jw-sales');
const report = { head, startedAt: new Date().toISOString(), passed: false, productionWrites: false, providerNetworkUsed: false, steps: [] };
let database, client;
function run(name, args, environment) {
  const r = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...environment }, stdio: 'inherit', timeout: 900000 });
  report.steps.push({ name, exitCode: r.status, passed: r.status === 0 });
  assert.equal(r.status, 0, name + ' failed');
}
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'STRIPE_SECRET_KEY', 'JW_STONE_STRIPE_WEBHOOK_SECRET', 'JW_STONE_PRICING_APPROVED_IMPORT']) assert(!process.env[key], 'Inherited credentials are forbidden: ' + key);
  database = await startCabinetLoopbackTestDatabase();
  report.database = database.evidence;
  client = new pg.Client({ connectionString: database.url });
  await client.connect();await client.query('CREATE DATABASE ts_jw_sales_test');await client.end();client = null;
  const target = new URL(database.url);target.pathname = '/ts_jw_sales_test';assert.equal(target.hostname, '127.0.0.1');
  const environment = { NODE_ENV: 'test', DATABASE_URL: target.href, TEST_DATABASE_URL: target.href, ALLOW_INSECURE_TEST_DATABASE: 'true', JW_SALES_FIXTURE: 'true', JW_SALES_OUTPUT: out };
  run('canonical migrations', ['npm', 'run', 'db:migrate'], environment);
  run('canonical required schema', ['npm', 'run', 'db:verify:required'], environment);
  run('native offer order payment and browser acceptance', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-sales.native.ts'], environment);
  const native = JSON.parse(await fs.readFile(path.join(out, 'native-evidence.json'), 'utf8'));
  assert.equal(native.head, head);assert.equal(native.passed, true);
  report.native = native;
  run('second-process historical payment recovery and atomic failure', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-sales-recovery.native.ts'], environment);
  const recovery = JSON.parse(await fs.readFile(path.join(out, 'recovery-evidence.json'), 'utf8'));
  assert.equal(recovery.head, head);assert.equal(recovery.passed, true);
  assert.equal(recovery.productionWrites, false);assert.equal(recovery.providerNetworkUsed, false);
  report.recovery = recovery;
  report.finalSourceStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();assert.equal(report.finalSourceStatus, '');
  report.passed = true;
} catch (error) { report.error = String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]');process.exitCode = 1; }
finally {
  await client?.end().catch(() => {});await database?.stop();
  report.finishedAt = new Date().toISOString();await fs.mkdir(out, { recursive: true });await fs.writeFile(path.join(out, 'runner-evidence.json'), JSON.stringify(report, null, 2));
  console.log('JW_SALES_NATIVE_RUNNER ' + JSON.stringify(report));
}
