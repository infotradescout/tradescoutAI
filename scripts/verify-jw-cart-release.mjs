import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve('test-results/jw-cart-release');
const report = { head, startedAt: new Date().toISOString(), passed: false, steps: [], productionDataUsed: false, productionPaymentsCreated: false };
let database;
function run(name, command, args, env = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 1500000, maxBuffer: 100 * 1024 * 1024 });
  const text = ((result.stdout || '') + (result.stderr || '')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]');
  console.log(text.slice(-20000));
  report.steps.push({ name, passed: result.status === 0, exitCode: result.status });
  console.log('JW_CART_RELEASE_STEP ' + JSON.stringify(report.steps.at(-1)));
  assert.equal(result.status, 0, name + ' failed: ' + text.slice(-4000));
}
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'A clean exact-commit checkout is required');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'SENDGRID_API_KEY', 'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'STRIPE_SECRET_KEY', 'JW_STONE_PRICING_APPROVED_IMPORT', 'JW_STONE_DRIVE_REFRESH_TOKEN']) assert(!process.env[key], 'Verification must not inherit live credentials: ' + key);
  run('TypeScript', 'npm', ['run', 'check']);
  run('Affected JW cart, pricing, inventory and account tests', 'npm', ['run', 'test:run', '--',
    'client/src/features/jw-stone', 'server/tests/jw-stone', 'server/tests/stone-inventory', 'server/tests/profile-account', '--maxWorkers=2']);
  run('Native desktop and touch signup, cart, quote request, and revocation', process.execPath, ['scripts/jw-stone-customer-workflow.native.mjs']);
  const browser = JSON.parse(await fs.readFile('test-results/jw-workflow/evidence.json', 'utf8'));
  assert.equal(browser.head, head); assert.equal(browser.passed, true, 'The native workflow report must pass, not merely exit');
  assert.equal(browser.checks.filter(check => check.nativeCartQuoteSubmitted && check.privateRequestPersisted && check.selectedSupplierNotifiedInApp).length, 2);
  // Some hosted clean checkouts omit their remote. Fetch real history rather than inventing main ancestry.
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  if (remote.status !== 0) execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/infotradescout/tradescoutAI.git']);
  run('Canonical main history', 'git', ['fetch', '--no-tags', 'origin', 'main']);
  database = await startCabinetLoopbackTestDatabase();
  assert.equal(new URL(database.url).hostname, '127.0.0.1');
  run('Unchanged strict minimum release gate', 'npm', ['run', 'gate:minimum-release', '--',
    '--browser-proof=manual', '--browser-note=Exact built client and actual native routes passed desktop and touch JW signup, exact-stock cart, quantity pricing, reload, native private quote submission, supplier notification, and revocation. Synthetic loopback data only.'],
    { NODE_ENV: 'test', TEST_DATABASE_URL: database.url, DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE: 'true' });
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Verification may not alter source files');
  await fs.mkdir(output, { recursive: true });
  await fs.cp('test-results/jw-workflow', path.join(output, 'browser'), { recursive: true });
  report.passed = true;
} catch (error) {
  report.error = String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]');
  console.error('JW_CART_RELEASE_FAILURE ' + report.error);
  process.exitCode = 1;
} finally {
  await database?.stop();
  report.finishedAt = new Date().toISOString();
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><meta name="robots" content="noindex,nofollow"><title>JW cart verification</title><h1>' + (report.passed ? 'Synthetic JW cart verification passed' : 'Verification failed — not release approval') + '</h1><p>No production customer data, payments, or real delivery promises.</p><a href="evidence.json">Release checks</a><br><a href="browser/evidence.json">Native workflow evidence</a><br><a href="browser/desktop-synthetic-cart-review.png">Desktop cart</a><br><a href="browser/touch-synthetic-cart-review.png">Touch cart</a>');
  console.log('JW_CART_RELEASE_SUMMARY ' + JSON.stringify(report));
}
