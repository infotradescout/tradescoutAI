import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import pg from 'pg';
import { chromium } from 'playwright';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';
import { proveExchangeBatchBrowser } from './exchange-batch-browser-journey.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve(process.env.EXCHANGE_BATCH_OUTPUT || 'test-results/exchange-batch-native');
await fs.mkdir(output, { recursive: true });
const report = { head, passed: false, startedAt: new Date().toISOString(), productionProved: false, providerStorageProved: false, source: 'Native disposable PostgreSQL; actual registerRoutes, cookie login, local object upload bytes and production-built frontend. No production/customer/provider writes.', checks: [], devices: [], releaseGate: { status: 'not-run' } };
let privateOutput, database, client, server, browser, serverLog;
const note = (name, detail = {}) => report.checks.push({ name, ...detail, passed: true });
const scrub = text => String(text).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DISPOSABLE_DATABASE]');
async function run(label, args, env = {}) {
  const result = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 900000, maxBuffer: 80 * 1024 * 1024 });
  const log = scrub((result.stdout || '') + (result.stderr || ''));
  const logFile = `command-${report.checks.length + 1}.log`;
  await fs.writeFile(path.join(output, logFile), log);
  report.checks.push({ name: label, passed: result.status === 0, exitCode: result.status, logFile });
  assert.equal(result.status, 0, `${label}: ${log.slice(-4000)}`);
}
async function stopFixtureServer() {
  if (server && server.exitCode === null) {
    const current = server;
    await new Promise(resolve => {
      const timer = setTimeout(() => { current.kill('SIGKILL'); resolve(); }, 5000);
      current.once('exit', () => { clearTimeout(timer); resolve(); }); current.kill('SIGTERM');
    });
  }
  server = undefined;
}
try {
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'BREVO_API_KEY', 'SENDGRID_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'STRIPE_SECRET_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) assert(!process.env[key], 'No connected data/provider credentials: ' + key);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Exact committed clean source required');
  assert(process.platform === 'linux' && process.arch === 'x64' && process.getuid?.() !== 0, 'The isolated loopback database requires a non-root Linux x64 verification environment.');
  privateOutput = await fs.mkdtemp(path.join(os.tmpdir(), 'exchange-batch-native-'));
  await run('Parser and recovery cases', [process.execPath, '--experimental-strip-types', '--test', 'tests/exchange-batch-import.test.mjs', 'tests/exchange-batch-recovery.test.mjs']);
  await run('Private import identity and public redaction regressions', ['npm', 'run', 'test:run', '--', 'server/tests/exchange-import-identity.test.ts']);
  await run('Full TypeScript', ['npm', 'run', 'check']);
  await run('Full production build and unchanged budgets', ['npm', 'run', 'build']);
  database = await startCabinetLoopbackTestDatabase(); report.database = database.evidence;
  client = new pg.Client({ connectionString: database.url }); await client.connect();
  await client.query('CREATE DATABASE ts_exchange_batch_test'); await client.end();
  const url = new URL(database.url); url.pathname = '/ts_exchange_batch_test';
  const env = { NODE_ENV: 'test', DATABASE_URL: url.href, TEST_DATABASE_URL: url.href, ALLOW_INSECURE_TEST_DATABASE: 'true', EXCHANGE_BATCH_NATIVE_FIXTURE: 'true', EXCHANGE_BATCH_PRIVATE_OUTPUT: privateOutput };
  await run('Fresh canonical migrations including import uniqueness', ['npm', 'run', 'db:migrate'], env);
  await run('Independent required schema', ['npm', 'run', 'db:verify:required'], env);
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  const index = await client.query("SELECT indisunique, indisvalid FROM pg_index WHERE indexrelid='marketplace_listings_seller_import_key_unique'::regclass");
  assert.deepEqual(index.rows, [{ indisunique: true, indisvalid: true }]); note('Registered unique seller/import identity index is valid');
  serverLog = await fs.open(path.join(privateOutput, 'server.log'), 'w', 0o600);
  server = spawn(process.execPath, ['--import', 'tsx', 'scripts/exchange-batch-workflow-fixture.ts'], { env: { ...process.env, ...env }, stdio: ['ignore', serverLog.fd, serverLog.fd] });
  const base = 'http://127.0.0.1:5241';
  let fixture;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Native application fixture exited: ' + server.exitCode);
    try { fixture = JSON.parse(await fs.readFile(path.join(privateOutput, 'fixture.json'), 'utf8')); break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(fixture?.base, base, 'Actual application routes did not start');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const readListings = async sellerId => (await client.query('SELECT id,seller_id AS "sellerId",county,state,status,images,specifications FROM marketplace_listings WHERE seller_id=$1 ORDER BY created_at,id', [sellerId])).rows;
  const authenticate = async (context, device) => {
    const account = fixture.accounts[device];
    const response = await context.request.post(base + '/api/auth/login', { data: { email: account.email, password: account.password } });
    assert.equal(response.status(), 200, 'Real cookie login must succeed'); return account;
  };
  const guest = await browser.newContext();
  assert.equal((await guest.request.post(base + '/api/marketplace/listings', { data: {} })).status(), 401);
  assert.equal((await guest.request.post(base + '/api/objects/upload')).status(), 401);
  await guest.close(); note('Anonymous listing creation and upload are denied by actual middleware');
  for (const device of ['desktop', 'touch']) report.devices.push(await proveExchangeBatchBrowser({ browser, base, device, output, authenticate, readListings }));
  const unverified = await browser.newContext(); await authenticate(unverified, 'unverified');
  const category = (await client.query("SELECT id FROM marketplace_categories WHERE name='Tools & Hardware' LIMIT 1")).rows[0].id;
  const payload = { categoryId: category, title: 'Oak drafting table', description: 'Oak table with a solid adjustable worktop.', price: '400.00', condition: 'good', city: 'Pensacola', state: 'FL', zipCode: '32501', county: 'Escambia', images: [], specifications: {} };
  assert.equal((await unverified.request.post(base + '/api/marketplace/listings', { data: payload })).status(), 403);
  assert.equal((await readListings(fixture.accounts.unverified.id)).length, 0);
  await unverified.close(); note('Unverified ordinary seller cannot create a listing');
  const concurrentA = await browser.newContext(), concurrentB = await browser.newContext();
  await authenticate(concurrentA, 'desktop'); await authenticate(concurrentB, 'desktop');
  const saved = (await readListings(fixture.accounts.desktop.id))[0];
  const key = '0001234567890' + randomUUID().replaceAll('-', '');
  const numericFingerprint = '1234567890'.repeat(6) + '1234';
  const racing = suffix => ({ ...payload, title: 'Workshop cabinet ' + suffix, images: saved.images, specifications: { externalListingId: key, exchangeBatchFingerprint: numericFingerprint } });
  const responses = await Promise.all([concurrentA.request.post(base + '/api/marketplace/listings', { data: racing('left') }), concurrentB.request.post(base + '/api/marketplace/listings', { data: racing('right') })]);
  assert.equal(responses.filter(response => response.status() === 201).length, 1);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM marketplace_listings WHERE seller_id=$1 AND specifications->>'externalListingId'=$2", [fixture.accounts.desktop.id, key])).rows[0].n, 1);
  assert.equal((await client.query("SELECT specifications->>'exchangeBatchFingerprint' AS fingerprint FROM marketplace_listings WHERE seller_id=$1 AND specifications->>'externalListingId'=$2", [fixture.accounts.desktop.id, key])).rows[0].fingerprint, numericFingerprint);
  await concurrentA.close(); await concurrentB.close(); note('Two authenticated clients cannot create duplicate stable import identities');
  const publicResponse = await fetch(base + '/api/marketplace/listings');
  assert.equal(publicResponse.status, 200, 'Public browse must succeed before checking moderation privacy');
  const publicRows = await publicResponse.json();
  assert(Array.isArray(publicRows), 'Public browse must return the canonical listing array');
  const publicIds = JSON.stringify(publicRows);
  for (const device of ['desktop', 'touch']) for (const listing of await readListings(fixture.accounts[device].id)) assert(!publicIds.includes(listing.id), 'Pending imported stock must remain outside public browse');
  note('Pending imported listings are not exposed in public browse');

  // Mark one exclusively owned fixture row active to exercise the real public
  // serializer. This models a moderation result; it does not prove moderation UI.
  const moderated = await client.query("UPDATE marketplace_listings SET status='active' WHERE seller_id=$1 AND specifications->>'externalListingId'=$2 RETURNING id", [fixture.accounts.desktop.id, key]);
  assert.equal(moderated.rowCount, 1);
  const published = await fetch(base + '/api/marketplace/listings/' + moderated.rows[0].id);
  assert.equal(published.status, 200, 'The public route must return the fixture-approved listing');
  const publicDetail = JSON.stringify(await published.json());
  for (const privateValue of ['externalListingId', 'exchangeBatchFingerprint', key, numericFingerprint]) {
    assert(!publicDetail.includes(privateValue), 'Public route must exclude private import identity');
  }
  note('Actual public listing GET excludes numeric import identity and fingerprint after fixture moderation');

  assert.deepEqual(report.devices.map(device => device.device), ['desktop', 'touch']);
  assert(report.devices.every(device => device.passed === true && device.checks.length > 0));
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), head);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Browser/native proof may not change release source');
  await browser.close(); browser = undefined;
  await stopFixtureServer(); await serverLog.close(); serverLog = undefined;
  await client.end(); client = undefined;
  // Both owned clusters use the helper's fixed loopback port. Fully stop the
  // workflow cluster before starting a new clean cluster for the strict gate.
  await database.stop(); database = undefined;
  // Temporary Render clones can omit canonical main history required by the
  // unchanged readiness registry guard. Fetch the real ref without moving HEAD.
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() === 'true';
  execFileSync('git', ['fetch', '--no-tags', ...(shallow ? ['--unshallow'] : []),
    'https://github.com/infotradescout/tradescoutAI.git', 'main:refs/remotes/origin/main'], { stdio: 'inherit' });
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), head);
  report.canonicalMain = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
  database = await startCabinetLoopbackTestDatabase(); report.releaseDatabase = database.evidence;
  assert.equal(new URL(database.url).hostname, '127.0.0.1');
  assert.notEqual(new URL(database.url).pathname, '/ts_exchange_batch_test');
  report.releaseGate = { status: 'running' };
  const browserNote = `Exact commit ${head}: executed built Exchange batch upload on desktop and touch using real cookie authentication, canonical application routes, native disposable PostgreSQL and local object bytes. CSV validation, interrupted upload, lost successful create response, server-record resume, ordered image bytes, changed-image conflict, guest/unverified denial, concurrent import identity and pending-listing privacy passed. No live provider storage, customer actions or production acceptance.`;
  await run('Unchanged strict minimum release gate', ['npm', 'run', 'gate:minimum-release', '--', '--browser-proof=manual', `--browser-note=${browserNote}`], {
    NODE_ENV: 'test', DATABASE_URL: database.url, TEST_DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE: 'true',
    VITEST_SERIAL: 'true', SKIP_NPM_CI: '', BASE_URL: '', APP_URL: '', BROWSER_PROOF_NOTE: '',
  });
  const evidence = JSON.parse(await fs.readFile(path.resolve('artifacts/release-contract', head.slice(0, 12), 'evidence.json'), 'utf8'));
  await fs.writeFile(path.join(output, 'minimum-release-evidence.json'), JSON.stringify(evidence, null, 2));
  assert.equal(evidence.commit, head); assert.equal(evidence.mode, 'release');
  assert.equal(evidence.result, 'pass'); assert.equal(evidence.attestable, true);
  assert.equal(evidence.initialDirtyTree, false); assert.equal(evidence.dirtyTree, false);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), head);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Strict verification may not change release source');
  report.releaseGate = { status: 'pass', evidenceFile: 'minimum-release-evidence.json', commit: evidence.commit, attestable: true };
  report.passed = true;
} catch (error) {
  report.error = scrub(error.stack || error); process.exitCode = 1;
  if (report.releaseGate.status === 'running') report.releaseGate.status = 'fail';
}
finally {
  try {
    await browser?.close(); await stopFixtureServer();
    await serverLog?.close(); await client?.end().catch(() => {}); await database?.stop();
  } catch (error) { report.cleanupError = scrub(error.stack || error); report.passed = false; process.exitCode = 1; }
  if (report.error && privateOutput) { const log = await fs.readFile(path.join(privateOutput, 'server.log'), 'utf8').catch(() => ''); report.serverErrors = scrub(log).split('\n').filter(line => /Error:|error:|code:|detail:|column:|schema.*failed/i.test(line)).slice(-30); }
  if (privateOutput) await fs.rm(privateOutput, { recursive: true, force: true }); report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
