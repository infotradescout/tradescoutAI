import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

// The caller creates a fresh Git checkout before npm ci. Never reset a user's worktree.
const phase = process.env.CUSTOMER_PATH_PHASE || 'initial';
assert(['initial', 'release', 'production'].includes(phase));
const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve(process.env.CUSTOMER_PATH_OUTPUT || '.customer-path-proof');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'customer-path-validation-'));
const proof = { head, phase, startedAt: new Date().toISOString(), checks: [], passed: false, releaseAttested: false };
let database, server, browser;
let appDatabaseUrl = '';
function redact(value) {
  return String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]');
}
function check(name, command, args = [], extra = {}) {
  console.log('CUSTOMER_START ' + name);
  const started = new Date().toISOString();
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 900000 });
  const log = redact((result.stdout || '') + (result.stderr || ''));
  console.log(log);
  const entry = { name, command: [command, ...args].join(' '), startedAt: started, finishedAt: new Date().toISOString(), passed: result.status === 0, status: result.status, signal: result.signal, error: result.error?.message, tail: log.slice(-10000) };
  proof.checks.push(entry);
  console.log('CUSTOMER_CHECK ' + JSON.stringify(entry));
  assert.equal(result.status, 0, name + ' failed');
  return log;
}
function clean() { return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(); }
async function waitFor(url, child) {
  for (let i = 0; i < 180; i++) {
    if (child?.exitCode != null) throw new Error('Fixture server exited: ' + child.exitCode);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Fixture server did not become ready');
}
try {
  proof.initialSourceStatus = clean();
  assert.equal(proof.initialSourceStatus, '', 'Initial exact-source tree must be clean');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'SENDGRID_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'SMTP_PASSWORD', 'STRIPE_SECRET_KEY']) assert(!process.env[key], key + ' cannot be inherited into isolated verification');
  if (phase === 'production') {
    const deployed = process.env.CUSTOMER_PATH_DEPLOYED_SHA || '';
    assert.match(deployed, /^[a-f0-9]{40}$/);
    check('Read-only live customer paths', process.execPath, ['scripts/customer-path-browser-proof.mjs'], { CUSTOMER_PATH_PHASE: phase, CUSTOMER_PATH_DEPLOYED_SHA: deployed, CUSTOMER_PATH_BROWSER_OUTPUT: temporary });
    proof.browser = JSON.parse(await fs.readFile(path.join(temporary, 'browser-evidence.json'), 'utf8'));
    assert.equal(proof.browser.passed, true);
    const response = await fetch('https://www.thetradescout.com/api/health', { signal: AbortSignal.timeout(20000) });
    const health = await response.json();
    assert(response.ok); assert.equal(response.headers.get('x-tradescout-build'), deployed);
    assert.equal(health.commit, deployed); assert.equal(health.status, 'healthy'); assert.equal(health.database, 'connected'); assert.equal(health.migrations?.compatibility, 'compatible');
    proof.deployed = deployed; proof.health = health;
  } else {
    check('TypeScript', 'npm', ['run', 'check']);
    const tracked = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' }).trim().split('\n');
    const selected = tracked.filter(file => !file.startsWith('scripts/') && /recommendation|exchange|exposure-authority|pre-scout|preScout|progressiveFeature|ProtectedRoute|ProfileCompletionBanner|public-profile-trust|public-profile-operator|notification-email|emailService|conversation-participants|messageAuthor|oauthIdentity|direct-connect|infinity-text|userFacingError|required-production-schema|contractor-photo-sharing|steel-home-project-tools|SteelHomePackagesProfile|steel-home-builder-profile|features\/jw-stone/i.test(file));
    assert(selected.length >= 50, 'Affected test selection unexpectedly empty or incomplete');
    proof.selectedTests = selected;
    const testReport = path.join(temporary, 'vitest.json');
    check('Affected application tests', 'npm', ['run', 'test:run', '--', ...selected, '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + testReport]);
    const tests = JSON.parse(await fs.readFile(testReport, 'utf8'));
    proof.tests = Object.fromEntries(['numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTotalTestSuites','numPassedTestSuites'].map(key => [key, tests[key]]));
    check('Production build and unchanged guards', 'npm', ['run', 'build'], { NODE_ENV: 'production' });
    for (const command of ['guard:law-drift','guard:forbidden','audit:authority-gates','audit:trust-leaks']) check(command, 'npm', ['run', command]);
    database = await startCabinetLoopbackTestDatabase();
    proof.database = database.evidence;
    const environment = { NODE_ENV: 'test', DATABASE_URL: database.url, TEST_DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE: 'true', TZ: 'UTC' };
    check('Fresh native migrations', 'npm', ['run', 'db:migrate'], environment);
    check('Independent required schema', 'npm', ['run', 'db:verify:required'], environment);
    for (const file of ['scripts/tests/recovery-schema.native.mjs','scripts/tests/recommendation-runtime-schema.native.mjs','scripts/tests/notification-email-outbox.native.ts','scripts/tests/recovery-transactions.native.ts']) check(file, process.execPath, ['--import','tsx',file], environment);
    if (phase === 'release') {
      const { default: pg } = await import('pg');
      const client = new pg.Client({ connectionString: database.url });
      await client.connect();
      try { await client.query('CREATE DATABASE ts_operator_test'); } finally { await client.end(); }
      const url = new URL(database.url); url.pathname = '/ts_operator_test'; appDatabaseUrl = url.href;
      const appEnvironment = { ...environment, DATABASE_URL: appDatabaseUrl, TEST_DATABASE_URL: appDatabaseUrl, OPERATOR_HTTP_PROOF: 'true', OPERATOR_PROOF_BUILT_CLIENT: 'true' };
      check('Fresh application-fixture migrations', 'npm', ['run','db:migrate'], appEnvironment);
      check('Application-fixture required schema', 'npm', ['run','db:verify:required'], appEnvironment);
      check('Install Chromium', process.execPath, ['node_modules/playwright/cli.js','install','chromium']);
      server = spawn(process.execPath, ['--import','tsx','scripts/direct-connect-operator-http-proof.ts'], { cwd: root, env: { ...process.env, ...appEnvironment }, stdio: ['ignore','pipe','pipe'] });
      server.stdout.on('data', chunk => console.log(redact(chunk))); server.stderr.on('data', chunk => console.error(redact(chunk)));
      await waitFor('http://127.0.0.1:5218/api/auth/providers', server);
      check('Actual authenticated county request and contact HTTP journey', process.execPath, ['--import','tsx','scripts/verify-direct-connect-operator-http-proof.ts'], appEnvironment);
      check('Actual desktop/mobile built customer journeys', process.execPath, ['scripts/customer-path-browser-proof.mjs'], { ...appEnvironment, CUSTOMER_PATH_BROWSER_OUTPUT: temporary });
      proof.browser = JSON.parse(await fs.readFile(path.join(temporary,'browser-evidence.json'),'utf8')); assert.equal(proof.browser.passed,true);
      server.kill('SIGTERM'); await new Promise(resolve => server.once('exit',resolve)); server = undefined;
      proof.beforeGateSourceStatus = clean(); assert.equal(proof.beforeGateSourceStatus,'');
      check('Unchanged strict minimum-release contract', 'npm', ['run','gate:minimum-release','--','--browser-proof=manual','--browser-note=Current exact-head production-built desktop and touch customer journeys plus authenticated native county request/contact HTTP proof passed; synthetic loopback data only; no provider sends. See customer-path browser and HTTP evidence.'], { TEST_DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE:'true' });
      proof.minimumRelease = JSON.parse(await fs.readFile(path.join(root,'artifacts/release-contract',head.slice(0,12),'evidence.json'),'utf8'));
      assert.equal(proof.minimumRelease.result,'pass'); assert.equal(proof.minimumRelease.attestable,true); assert.equal(proof.minimumRelease.commit,head);
      proof.releaseAttested = true;
    }
    proof.finalSourceStatus = clean(); assert.equal(proof.finalSourceStatus,'');
  }
  proof.passed = true;
} catch (error) {
  proof.error = redact(error.stack || error); console.error('CUSTOMER_FAILURE ' + proof.error);
} finally {
  server?.kill('SIGTERM'); await browser?.close();
  await database?.stop();
  proof.finishedAt = new Date().toISOString();
  await fs.mkdir(output,{recursive:true});
  for (const file of await fs.readdir(temporary)) if (/\.png$/.test(file) || file === 'browser-evidence.json') await fs.copyFile(path.join(temporary,file),path.join(output,file));
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(proof,null,2));
  const title = proof.passed ? (proof.releaseAttested ? 'Release checks passed' : 'Declared checks passed; scope applies') : 'FAILED — not release approval';
  await fs.writeFile(path.join(output,'index.html'),'<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer path verification</title><h1>'+title+'</h1><p>'+phase+' '+head+'</p><a href="evidence.json">Exact-source evidence</a></html>');
  await fs.rm(temporary,{recursive:true,force:true});
  console.log('CUSTOMER_RESULT '+JSON.stringify(proof));
}
// A failed report is intentionally publishable. Its host being live is never test approval.
