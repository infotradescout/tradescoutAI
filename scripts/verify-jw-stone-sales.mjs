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
async function receipt(file) {
  const value = JSON.parse(await fs.readFile(path.join(out, file), 'utf8'));
  assert.equal(value.head, head);assert.equal(value.passed, true);
  assert.equal(value.productionWrites, false);assert.equal(value.providerNetworkUsed, false);
  return value;
}
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'STRIPE_SECRET_KEY', 'JW_STONE_STRIPE_WEBHOOK_SECRET', 'JW_STONE_PRICING_APPROVED_IMPORT']) assert(!process.env[key], 'Inherited credentials are forbidden: ' + key);
  database = await startCabinetLoopbackTestDatabase();report.database = database.evidence;
  client = new pg.Client({ connectionString: database.url });
  await client.connect();await client.query('CREATE DATABASE ts_jw_sales_test');await client.end();client = null;
  const target = new URL(database.url);target.pathname = '/ts_jw_sales_test';assert.equal(target.hostname, '127.0.0.1');
  const environment = { NODE_ENV: 'test', DATABASE_URL: target.href, TEST_DATABASE_URL: target.href, ALLOW_INSECURE_TEST_DATABASE: 'true', JW_SALES_FIXTURE: 'true', JW_SALES_OUTPUT: out };
  run('canonical migrations', ['npm', 'run', 'db:migrate'], environment);
  run('canonical required schema', ['npm', 'run', 'db:verify:required'], environment);
  run('native offer order payment and browser acceptance', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-sales.native.ts'], environment);
  report.native = await receipt('native-evidence.json');
  run('second-process historical payment recovery and atomic failure', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-sales-recovery.native.ts'], environment);
  report.recovery = await receipt('recovery-evidence.json');
  run('third-process ordinary purchases and atomic reserved-stock transfer', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-purchases.native.ts'], environment);
  report.purchase = await receipt('purchase-evidence.json');
  assert.deepEqual(report.purchase.devices.map(device => device.device).sort(), ['desktop', 'touch']);
  run('fourth-process quote confirmation and transactional notifications', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-quote-confirmation.native.ts'], environment);
  report.quoteConfirmation = await receipt('quote-confirmation-evidence.json');
  assert.deepEqual(report.quoteConfirmation.devices.map(device => device.device).sort(), ['desktop', 'touch']);
  report.finalSourceStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();assert.equal(report.finalSourceStatus, '');report.passed = true;
} catch (error) { report.error = String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]');process.exitCode = 1; }
finally {
  await client?.end().catch(() => {});await database?.stop();
  report.finishedAt = new Date().toISOString();await fs.mkdir(out, { recursive: true });await fs.writeFile(path.join(out, 'runner-evidence.json'), JSON.stringify(report, null, 2));
  console.log('JW_SALES_NATIVE_RUNNER ' + JSON.stringify(report));
}
// Cleanup must never turn an unsuccessful database/browser run into a successful command.
assert.equal(report.passed, true, 'Native sales verification failed; see matching source receipt');
