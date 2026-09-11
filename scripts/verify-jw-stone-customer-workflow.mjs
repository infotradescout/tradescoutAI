import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import pg from 'pg';
import { chromium } from 'playwright';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';
import { proveJwStoneRequestJourney } from './jw-stone-request-journey.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = path.resolve(process.env.JW_WORKFLOW_OUTPUT || 'test-results/jw-workflow');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-workflow-'));
const base = 'http://127.0.0.1:5228';
const rootPath = '/u/jw-stone';
const itemPath = rootPath + '/stones/honey-onyx';
const report = { head, startedAt: new Date().toISOString(), checks: [], passed: false, liveCustomerWrites: false, actualEmailDeliveryProved: false, formalPricedQuoteProved: false, source: 'Synthetic localhost native database, actual application routes and built client' };
let database, client, server, browser, activePage, logFile;
function clean() { return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(); }
function note(name, detail = {}) { report.checks.push({ name, ...detail, passed: true }); console.log('JW_WORKFLOW_CHECK ' + JSON.stringify(report.checks.at(-1))); }
function run(name, args, env = {}) {
  const r = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 900000, maxBuffer: 60 * 1024 * 1024 });
  const text = ((r.stdout || '') + (r.stderr || '')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]');
  console.log(text); assert.equal(r.status, 0, name + ': ' + text.slice(-2500)); note(name);
}
async function stop() {
  if (!server || server.exitCode !== null || server.signalCode) return;
  const current = server; server = undefined;
  await new Promise(resolve => { const timer = setTimeout(() => { current.kill('SIGKILL'); resolve(); }, 5000); current.once('exit', () => { clearTimeout(timer); resolve(); }); current.kill('SIGTERM'); });
}
async function request(context, method, pathname, data) {
  assert.equal(new URL(pathname, base).origin, base); assert(pathname.startsWith('/api/'));
  return context.request.fetch(base + pathname, { method, ...(data === undefined ? {} : { data }) });
}
try {
  assert.equal(clean(), '', 'Fresh exact-head checkout required');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'SENDGRID_API_KEY', 'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'JW_STONE_PRICING_APPROVED_IMPORT']) assert(!process.env[key], 'No inherited data or provider credentials: ' + key);
  run('Typecheck', ['npm', 'run', 'check']);
  run('Production client and server build', ['npm', 'run', 'build']);
  run('Install Chromium', [process.execPath, 'node_modules/playwright/cli.js', 'install', 'chromium']);
  database = await startCabinetLoopbackTestDatabase(); report.database = database.evidence;
  client = new pg.Client({ connectionString: database.url }); await client.connect();
  await client.query('CREATE DATABASE ts_jw_workflow_test'); await client.end();
  const target = new URL(database.url); target.pathname = '/ts_jw_workflow_test'; assert.equal(target.hostname, '127.0.0.1');
  const env = { NODE_ENV: 'test', DATABASE_URL: target.href, TEST_DATABASE_URL: target.href, ALLOW_INSECURE_TEST_DATABASE: 'true', JW_WORKFLOW_FIXTURE: 'true', JW_WORKFLOW_PRIVATE_OUTPUT: temp };
  run('Fresh migrations', ['npm', 'run', 'db:migrate'], env);
  run('Required schema', ['npm', 'run', 'db:verify:required'], env);
  client = new pg.Client({ connectionString: target.href }); await client.connect();
  assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'ts_jw_workflow_test');
  logFile = await fs.open(path.join(temp, 'server.private.log'), 'w', 0o600);
  server = spawn(process.execPath, ['--import', 'tsx', 'scripts/jw-stone-workflow-fixture.ts'], { env: { ...process.env, ...env }, stdio: ['ignore', logFile.fd, logFile.fd] });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error('Local fixture exited: ' + server.exitCode);
    try { const r = await fetch(base + '/api/u/jw-stone/account', { signal: AbortSignal.timeout(1000) }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, 'Actual fixture routes did not start');
  const fixture = JSON.parse(await fs.readFile(path.join(temp, 'fixture.json'), 'utf8'));
  assert.equal(fixture.base, base);
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36` });
    const errors = [], failures = [];
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(45000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', r => { if (r.status() >= 500 && new URL(r.url()).pathname.startsWith('/api/')) failures.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (device === 'touch') await locator.tap(); else await locator.click(); };
    const initial = await page.goto(base + rootPath, { waitUntil: 'domcontentloaded', timeout: 60000 }); assert.equal(initial.status(), 200);
    await page.getByTestId('jw-marketplace-account-button').waitFor();
    const denied = await request(context, 'GET', '/api/u/jw-stone/member-pricing'); assert.equal(denied.status(), 401);
    assert(!(await denied.text()).includes('slabPriceCents')); note(device + ': guest pricing denied');
    await click(page.getByTestId('jw-marketplace-account-button'));
    await page.getByTestId('profile-account-business-name').waitFor();
    const email = 'jw-workflow-' + device + '-' + randomUUID() + '@example.test';
    const password = 'SyntheticOnly-123-' + randomUUID();
    const businessName = 'Synthetic Workflow ' + device + ' ' + randomUUID().slice(0, 8);
    for (const [field, value] of [['business-name', businessName], ['first-name', 'Synthetic'], ['last-name', 'Customer'], ['email', email], ['phone', '2025550147'], ['password', password], ['confirm-password', password]]) await page.getByTestId('profile-account-' + field).fill(value);
    await page.getByTestId('profile-account-terms').check();
    const registered = page.waitForResponse(r => new URL(r.url()).pathname === '/api/profile-accounts/register' && r.request().method() === 'POST');
    await click(page.getByTestId('profile-account-submit'));
    const registration = await registered; assert.equal(registration.status(), 201, 'Actual business registration failed');
    const registrationData = await registration.json();
    await page.getByTestId('profile-account-dialog-connected').waitFor();
    const user = (await client.query('SELECT id,email_verified,onboarding_completed,profile_visibility::text FROM users WHERE email=$1', [email])).rows[0];
    assert(user); assert.equal(user.email_verified, false); assert.equal(user.onboarding_completed, false); assert.equal(user.profile_visibility, 'private');
    const memberships = (await client.query('SELECT id,status,verification_status,business_profile_id FROM profile_accounts WHERE owner_user_id=$1', [user.id])).rows;
    assert.equal(memberships.length, 1); assert.equal(memberships[0].status, 'active'); assert.equal(memberships[0].verification_status, 'pending');
    assert.equal(registrationData.emailVerificationSent, false, 'No actual provider send is permitted');
    note(device + ': actual signup, private identity, pending business and one membership');
    await click(page.getByRole('button', { name: 'Continue browsing', exact: true }));
    const price = await request(context, 'GET', '/api/u/jw-stone/member-pricing'); assert.equal(price.status(), 200, 'New active membership cannot read prices');
    const pricing = await price.json(); assert.equal(pricing.access, 'member'); assert.equal(pricing.viewerId, user.id);
    assert.equal(pricing.prices.length, 1); assert.equal(pricing.prices[0].slabPriceCents, 10101); assert.equal(pricing.prices[0].bundlePriceCents, 9090);
    assert(!JSON.stringify(pricing).includes('landedCostCents')); assert.match(price.headers()['cache-control'], /private.*no-store/);
    // Open the actual named item rather than assuming its card is on the first catalog page.
    await page.goto(base + itemPath, { waitUntil: 'domcontentloaded' });
    await page.getByText('$101.01', { exact: false }).first().waitFor();
    const localState = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert(!localState.includes('slabPriceCents')); assert(!localState.includes('landedCostCents'));
    await page.screenshot({ path: path.join(out, device + '-synthetic-member-pricing.png'), fullPage: false });
    note(device + ': actual visible synthetic member rates; internal cost excluded; no persistent browser price storage');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByText('$101.01', { exact: false }).first().waitFor();
    const accountAgain = await request(context, 'POST', '/api/u/jw-stone/account', { businessName, sourcePath: rootPath }); assert.equal(accountAgain.status(), 201);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM profile_accounts WHERE owner_user_id=$1', [user.id])).rows[0].n, 1);
    note(device + ': reload and replay preserve membership without duplicate accounts');
    await context.clearCookies();
    const login = await request(context, 'POST', '/api/auth/login', { email, password }); assert.equal(login.status(), 200);
    assert.equal((await request(context, 'GET', '/api/u/jw-stone/member-pricing')).status(), 200);
    note(device + ': real returning-user login retains member pricing');
    const requestEvidence = await proveJwStoneRequestJourney({ page, context, database: client, fixture, email, userId: user.id, device, output: out, rootPath });
    note(device + ': material request reaches the selected supplier', requestEvidence);
    await client.query("UPDATE profile_account_entitlements SET status='revoked' WHERE profile_account_id=$1 AND product_key='jw_stone_member_pricing'", [memberships[0].id]);
    assert.equal((await request(context, 'GET', '/api/u/jw-stone/member-pricing')).status(), 403, 'Revoked pricing must remain denied');
    await request(context, 'POST', '/api/u/jw-stone/account', { businessName, sourcePath: rootPath });
    assert.equal((await request(context, 'GET', '/api/u/jw-stone/member-pricing')).status(), 403, 'Reconnect must not undo a revocation');
    await page.goto(base + itemPath, { waitUntil: 'domcontentloaded' }); await page.getByTestId('jw-marketplace-account-button').waitFor();
    assert.equal(await page.getByText('$101.01', { exact: false }).count(), 0);
    note(device + ': revocation and reconnect cannot recover private prices');
    assert.deepEqual(errors, [], 'Uncaught browser errors'); assert.deepEqual(failures, [], 'Unexpected server errors');
    await context.close(); activePage = undefined;
  }
  report.finalSourceStatus = clean(); assert.equal(report.finalSourceStatus, ''); report.passed = true;
} catch (error) {
  report.error = String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]');
  if (activePage) { report.failureText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 7000); report.failurePath = new URL(activePage.url()).pathname; await fs.mkdir(out, { recursive: true }); await activePage.screenshot({ path: path.join(out, 'failure.png'), fullPage: false }).catch(() => {}); }
  try { const log = await fs.readFile(path.join(temp, 'server.private.log'), 'utf8'); report.serverErrors = log.split('\n').filter(line => /Error:|error:|code:|detail:|column:|relation|schema.*failed/i.test(line)).map(line => line.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]').replace(/token[^\s]*[=:][^\s]+/gi, '[TOKEN]')).slice(-35); } catch {}
  console.error('JW_WORKFLOW_FAILURE ' + report.error);
} finally {
  await browser?.close(); await stop(); await logFile?.close(); await client?.end().catch(() => {}); await database?.stop();
  report.finishedAt = new Date().toISOString(); await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>' + (report.passed ? 'Declared synthetic customer journey passed' : 'FAILED - not release approval') + '</h1><p>Not real customer, production pricing or email-delivery proof.</p><a href="evidence.json">Evidence</a>');
  await fs.rm(temp, { recursive: true, force: true }); console.log('JW_WORKFLOW_SUMMARY ' + JSON.stringify(report));
}
