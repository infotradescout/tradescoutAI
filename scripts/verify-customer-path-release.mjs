import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

// Run from a fresh Git checkout before npm ci. Never reset a user's worktree.
const phase = process.env.CUSTOMER_PATH_PHASE || 'initial';
assert(['initial', 'release', 'production'].includes(phase));
const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve(process.env.CUSTOMER_PATH_OUTPUT || '.customer-path-proof');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'customer-path-validation-'));
const proof = { head, phase, startedAt: new Date().toISOString(), checks: [], passed: false, releaseAttested: false };
const testReport = path.join(temporary, 'vitest.json');
const browserReport = path.join(temporary, 'browser-evidence.json');
let database, server, serverLog;
function redact(value) {
  return String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]').replace(/token=[^&\s"']+/gi, 'token=[TEST_TOKEN]');
}
function check(name, command, args = [], extra = {}) {
  console.log('CUSTOMER_START ' + name);
  const started = new Date().toISOString();
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 900000 });
  const log = redact((result.stdout || '') + (result.stderr || ''));
  console.log(log);
  const entry = { name, command: [command, ...args].join(' '), startedAt: started, finishedAt: new Date().toISOString(), passed: result.status === 0, status: result.status, signal: result.signal, error: result.error?.message, tail: log.slice(-6000) };
  proof.checks.push(entry);
  console.log('CUSTOMER_CHECK ' + JSON.stringify({ ...entry, tail: undefined }));
  assert.equal(result.status, 0, name + ' failed');
  return log;
}
function clean() { return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(); }
async function stopServer() {
  const child = server;
  if (!child) return;
  server = undefined;
  if (child.exitCode != null || child.signalCode) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill('SIGTERM');
  });
}
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
    check('Install Chromium', process.execPath, ['node_modules/playwright/cli.js','install','chromium']);
    check('Read-only live customer paths', process.execPath, ['scripts/customer-path-browser-proof.mjs'], { CUSTOMER_PATH_PHASE: phase, CUSTOMER_PATH_DEPLOYED_SHA: deployed, CUSTOMER_PATH_BROWSER_OUTPUT: temporary });
    proof.browser = JSON.parse(await fs.readFile(browserReport, 'utf8'));
    assert.equal(proof.browser.passed, true);
    const response = await fetch('https://www.thetradescout.com/api/health', { signal: AbortSignal.timeout(20000) });
    const health = await response.json();
    assert(response.ok); assert.equal(response.headers.get('x-tradescout-build'), deployed);
    assert.equal(health.commit, deployed); assert.equal(health.status, 'healthy'); assert.equal(health.database, 'connected'); assert.equal(health.migrations?.compatibility, 'compatible');
    proof.deployed = deployed; proof.health = health;
  } else {
    // Preserve the separately released cabinet-library tree and its chunk configuration.
    assert.equal(execFileSync('git',['rev-parse','HEAD:client/src/pages/profile-sites'],{encoding:'utf8'}).trim(),'655badf1f60673d86a43e5764cb982be30d55de0');
    assert.equal(execFileSync('git',['rev-parse','HEAD:vite.config.ts'],{encoding:'utf8'}).trim(),'feac48dd18e12697f13d26509f41d5d122e9617f');
    const historicalBase = '64e99ca14db7553494265f7f1d8d3257ae0e3b86';
    if (spawnSync('git',['cat-file','-e',historicalBase+':migrations/meta/_journal.json'],{cwd:root}).status !== 0) {
      check('Recover exact migration-history objects','git',['fetch','--no-tags','--depth=1','https://github.com/infotradescout/tradescoutAI.git',historicalBase]);
    }
    assert.equal(execFileSync('git',['rev-parse',historicalBase+':migrations/meta/_journal.json'],{encoding:'utf8'}).trim(),'6ce1ef27cb1ddc165f8dc8234deb2ade1a37df57');
    check('TypeScript', 'npm', ['run', 'check']);
    const tracked = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' }).trim().split('\n');
    const selected = tracked.filter(file => !file.startsWith('scripts/') && /recommendation|exchange|exposure-authority|pre-scout|preScout|progressiveFeature|ProtectedRoute|ProfileCompletionBanner|public-profile-trust|public-profile-operator|notification-email|emailService|conversation-participants|messageAuthor|oauthIdentity|direct-connect|infinity-text|userFacingError|required-production-schema|contractor-photo-sharing|steel-home-project-tools|SteelHomePackagesProfile|steel-home-builder-profile|features\/jw-stone/i.test(file));
    assert(selected.length >= 50, 'Affected test selection unexpectedly incomplete');
    proof.selectedTests = selected;
    check('Affected application tests', 'npm', ['run', 'test:run', '--', ...selected, '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + testReport]);
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
      const url = new URL(database.url); url.pathname = '/ts_operator_test';
      const appEnvironment = { ...environment, DATABASE_URL: url.href, TEST_DATABASE_URL: url.href, OPERATOR_HTTP_PROOF: 'true', OPERATOR_PROOF_BUILT_CLIENT: 'true' };
      check('Fresh application-fixture migrations', 'npm', ['run','db:migrate'], appEnvironment);
      check('Application-fixture required schema', 'npm', ['run','db:verify:required'], appEnvironment);
      check('Install Chromium', process.execPath, ['node_modules/playwright/cli.js','install','chromium']);
      // A file avoids pipe backpressure while synchronous test subprocesses run.
      serverLog = await fs.open(path.join(temporary,'fixture-server.private.log'),'w',0o600);
      server = spawn(process.execPath, ['--import','tsx','scripts/direct-connect-operator-http-proof.ts'], { cwd: root, env: { ...process.env, ...appEnvironment }, stdio: ['ignore',serverLog.fd,serverLog.fd] });
      await waitFor('http://127.0.0.1:5218/api/auth/providers', server);
      check('Actual authenticated county request and contact HTTP journey', process.execPath, ['--import','tsx','scripts/verify-direct-connect-operator-http-proof.ts'], appEnvironment);
      check('Actual desktop/mobile built customer journeys', process.execPath, ['scripts/customer-path-browser-proof.mjs'], { ...appEnvironment, CUSTOMER_PATH_BROWSER_OUTPUT: temporary });
      proof.browser = JSON.parse(await fs.readFile(browserReport,'utf8')); assert.equal(proof.browser.passed,true);
      await stopServer();
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
  if (serverLog) console.error('CUSTOMER_FIXTURE_FAILURE_LOG ' + redact((await fs.readFile(path.join(temporary,'fixture-server.private.log'),'utf8')).slice(-14000)));
} finally {
  await stopServer(); await serverLog?.close(); await database?.stop();
  try { const tests = JSON.parse(await fs.readFile(testReport,'utf8')); proof.tests = Object.fromEntries(['numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTotalTestSuites','numPassedTestSuites'].map(key=>[key,tests[key]])); proof.testFiles = tests.testResults?.map(file=>({name:path.relative(root,file.name),status:file.status,pending:file.assertionResults.filter(test=>test.status==='pending').length})); } catch {}
  try { proof.browser = JSON.parse(await fs.readFile(browserReport,'utf8')); } catch {}
  proof.finishedAt = new Date().toISOString();
  await fs.mkdir(output,{recursive:true});
  for (const file of await fs.readdir(temporary)) if (/\.png$/.test(file) || file === 'browser-evidence.json') await fs.copyFile(path.join(temporary,file),path.join(output,file));
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(proof,null,2));
  const title = proof.passed ? (proof.releaseAttested ? 'Release checks passed' : 'Declared checks passed; scope applies') : 'FAILED — not release approval';
  await fs.writeFile(path.join(output,'index.html'),'<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Customer path verification</title><h1>'+title+'</h1><p>'+phase+' '+head+'</p><a href="evidence.json">Exact-source evidence</a></html>');
  await fs.rm(temporary,{recursive:true,force:true});
  console.log('CUSTOMER_SUMMARY '+JSON.stringify({...proof,selectedTests:undefined,testFiles:undefined,checks:proof.checks.map(({tail,...entry})=>entry)}));
}
// Failed reports remain publishable. A report host being live is never test approval.
