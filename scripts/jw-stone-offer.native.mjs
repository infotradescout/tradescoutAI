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
import { saveNativeOfferPreflight, reuseNativeOfferPreflight } from './jw-stone-native-preflight.mjs';
import { proveJwStoneFeatureJourney } from './jw-stone-feature-journey.mjs';
import { proveJwStoneOfferJourney } from './jw-stone-offer-journey.mjs';
import { proveJwStoneCartHoldJourney } from './jw-stone-cart-hold-journey.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const defaultOutput = process.argv.includes('--cart-hold-actions')
  ? 'test-results/jw-cart-hold-actions'
  : process.argv.includes('--feature-control')
    ? 'test-results/jw-feature-control'
    : 'test-results/jw-offers';
const out = path.resolve(process.env.JW_WORKFLOW_OUTPUT || defaultOutput);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-workflow-'));
const base = 'http://127.0.0.1:5228';
const rootPath = '/u/jw-stone';
const itemPath = rootPath + '/stones/honey-onyx';
const report = { head, startedAt: new Date().toISOString(), checks: [], passed: false, liveCustomerWrites: false, productionWrites: false, actualEmailDeliveryProved: false, formalPricedQuoteProved: false, customerReservationActionsProved: false, customerReservationDevices: [], source: 'Synthetic localhost native database, actual application routes and built client' };
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
  if (process.argv.includes('--reuse-preflight')) {
    report.reusedPreflight = reuseNativeOfferPreflight(head);
    note('Unchanged compiled application and fixture preflight reused', report.reusedPreflight);
  } else {
  run('Profile account customer-session isolation', ['npm', 'run', 'test:run', '--', 'client/src/components/profile/PublicProfileAccountDialog.session.test.tsx', '--maxWorkers=1']);
  if (process.argv.includes('--feature-control') || process.argv.includes('--cart-hold-actions')) {
    run('JW Stone feature access policy contracts', [
      process.execPath, '--test', 'scripts/tests/jw-stone-feature-control.test.cjs',
    ]);
  }
  if (process.argv.includes('--cart-hold-actions')) {
    const backendProof = run(
      'Native cart-hold ledger, expiry and compatibility proof',
      [process.execPath, 'scripts/verify-jw-cart-holds.mjs', '--exact-copy']
    );
    const backendSummary = backendProof
      .split('\n')
      .find(value => value.startsWith('JW_HOLD_PROOF_SUMMARY '));
    assert(backendSummary, 'Native cart-hold proof receipt missing');
    report.backendCartHoldProof = JSON.parse(
      backendSummary.slice('JW_HOLD_PROOF_SUMMARY '.length)
    );
    assert.equal(report.backendCartHoldProof.passed, true);
    assert.equal(report.backendCartHoldProof.productionWrites, false);
    run('Customer cart reservation contracts', [
      'npm', 'run', 'test:run', '--',
      'client/src/features/jw-stone/JwStoneMemberCart.test.tsx',
      'client/src/features/jw-stone/JwStoneReservationStatus.test.tsx',
      'server/tests/jw-stone-cart-hold-recovery.test.ts',
      'server/tests/jw-stone-cart-hold-route.behavior.test.ts',
      'server/tests/jw-stone-cart-hold-production-composition.test.ts',
      'server/tests/jw-stone-cart-hold-worker.test.ts',
      'server/tests/jw-stone-hold-countdown.test.ts',
      '--maxWorkers=2',
    ]);
  } else {
    run('Typecheck', ['npm', 'run', 'check']);
  }
  run('Production client and server build', ['npm', 'run', 'build']);
  run('Install Chromium', [process.execPath, 'node_modules/playwright/cli.js', 'install', 'chromium']);
  saveNativeOfferPreflight(head, report.checks);
  }
  database = await startCabinetLoopbackTestDatabase(); report.database = database.evidence;
  client = new pg.Client({ connectionString: database.url }); await client.connect();
  await client.query('CREATE DATABASE ts_jw_workflow_test'); await client.end();
  const target = new URL(database.url); target.pathname = '/ts_jw_workflow_test'; assert.equal(target.hostname, '127.0.0.1');
  const env = { NODE_ENV: 'test', DATABASE_URL: target.href, TEST_DATABASE_URL: target.href, ALLOW_INSECURE_TEST_DATABASE: 'true', JW_WORKFLOW_FIXTURE: 'true', JW_WORKFLOW_OFFERS: 'true', JW_WORKFLOW_FEATURE_CONTROL: String(process.argv.includes('--feature-control')), JW_WORKFLOW_PRIVATE_OUTPUT: temp };
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
  const fixture = JSON.parse(await fs.readFile(path.join(temp, 'fixture.json'), 'utf8')); assert.equal(fixture.base, base);
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const devices = [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]];
  // Each scenario has its own browser and genuine signup. The existing one-pending-
  // contact guard must not be bypassed or reset just to send a second test request.
  for (const [device, viewport, journey] of devices.flatMap(([device, viewport]) =>
    (process.argv.includes('--feature-control') ? ['cart'] : ['stone', 'cart']).map(journey => [device, viewport, journey]))) {
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
    const registrationData = await registration.json(); await page.getByTestId('profile-account-dialog-connected').waitFor();
    const user = (await client.query('SELECT id,email_verified,onboarding_completed,profile_visibility::text FROM users WHERE email=$1', [email])).rows[0];
    assert(user); assert.equal(user.email_verified, false); assert.equal(user.onboarding_completed, false); assert.equal(user.profile_visibility, 'private');
    const memberships = (await client.query('SELECT id,status,verification_status,business_profile_id FROM profile_accounts WHERE owner_user_id=$1', [user.id])).rows;
    assert.equal(memberships.length, 1); assert.equal(memberships[0].status, 'active'); assert.equal(memberships[0].verification_status, 'pending');
    assert.equal(registrationData.emailVerificationSent, false, 'No actual provider send is permitted');
    note(device + ': actual signup, private identity, pending business and one membership');
    await click(page.getByRole('button', { name: 'Continue browsing', exact: true }));
    const price = await request(context, 'GET', '/api/u/jw-stone/member-pricing'); assert.equal(price.status(), 200, 'New active membership cannot read prices');
    const pricing = await price.json(); assert.equal(pricing.access, 'member'); assert.equal(pricing.viewerId, user.id);
    assert.equal(pricing.prices.length, 2); const honey = pricing.prices.find(p => p.stoneName === "Honey Onyx"); assert.equal(honey.slabPriceCents, 10101); assert.equal(honey.bundlePriceCents, 9090);
    assert(!JSON.stringify(pricing).includes('landedCostCents')); assert.match(price.headers()['cache-control'], /private.*no-store/);
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
    const offerEvidence = await proveJwStoneOfferJourney({ page, context, database: client, fixture, email, userId: user.id, device, output: out, rootPath, scope: journey });
    note(device + ': native ' + journey + ' offer', offerEvidence);
    if (process.argv.includes('--cart-hold-actions') && journey === 'cart') {
      const holdEvidence = await proveJwStoneCartHoldJourney({
        page,
        database: client,
        fixture,
        userId: user.id,
        device,
        output: out,
      });
      note(device + ': native customer cart reserve-recover-release', holdEvidence);
      report.customerReservationDevices.push(device);
    }
    const ownedStatusMode = process.argv.includes('--owned-hold-status');
    const heldEnv = { ...env, JW_STATUS_BUYER: user.id, JW_STATUS_SELLER: fixture.businessId, JW_STATUS_STOCK: fixture.cartStockId };
    let ownedReservationId;
    if (ownedStatusMode) {
      run('Create synthetic existing hold for status acceptance', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-owned-hold.fixture.ts', '--create'], heldEnv);
      const recovery = await request(context, 'GET', '/api/u/jw-stone/member-pricing/holds/active');
      assert.equal(recovery.status(),200); const result = await recovery.json(); ownedReservationId=result.hold.reservationId;
      await page.goto(base + rootPath); await page.getByTestId('jw-owned-reservation-status').waitFor();
      assert((await page.getByTestId('jw-owned-reservation-status').innerText()).includes(ownedReservationId));
      await page.reload(); await page.getByTestId('jw-owned-reservation-status').waitFor();
      await page.screenshot({path:path.join(out,device+'-owned-hold-reloaded.png')});
      note(device+': existing owned reservation recovered in actual application', {reservationId:ownedReservationId, actualAppRecovery:true});
    }
    if (process.argv.includes('--feature-control')) {
      note(device + ': native feature ON-OFF-ON', await proveJwStoneFeatureJourney({ page, context, database: client, fixture, device, output: out, browser, run, env, userId: user.id, offerRequestId: offerEvidence.requestId, ownedReservationId }));
    }
    await client.query("UPDATE profile_account_entitlements SET status='revoked' WHERE profile_account_id=$1 AND product_key='jw_stone_member_pricing'", [memberships[0].id]);
    assert.equal((await request(context, 'GET', '/api/u/jw-stone/member-pricing')).status(), 403, 'Revoked pricing must remain denied');
    await request(context, 'POST', '/api/u/jw-stone/account', { businessName, sourcePath: rootPath });
    assert.equal((await request(context, 'GET', '/api/u/jw-stone/member-pricing')).status(), 403, 'Reconnect must not undo a revocation');
    await page.goto(base + itemPath, { waitUntil: 'domcontentloaded' }); await page.getByTestId('jw-marketplace-account-button').waitFor();
    assert.equal(await page.getByText('$101.01', { exact: false }).count(), 0);
    assert.equal(await page.getByTestId('jw-stone-member-cart-button').count(), 0);
    note(device + ': revocation and reconnect cannot recover private prices or cart access');
    if (ownedStatusMode) {
      await page.goto(base + rootPath, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('jw-owned-reservation-status').waitFor();
      await page.screenshot({path:path.join(out,device+'-owned-hold-revoked-membership.png')});
      if (process.argv.includes('--cart-hold-actions')) {
        const releaseResponse = page.waitForResponse(
          response =>
            new URL(response.url()).pathname ===
              '/api/u/jw-stone/member-pricing/holds/' + ownedReservationId + '/release' &&
            response.request().method() === 'POST'
        );
        await click(page.getByTestId('jw-release-reservation'));
        await page.getByText('Release these slabs back to available stock now?', {exact:true}).waitFor();
        await click(page.getByRole('button',{name:'Confirm release',exact:true}));
        const released = await releaseResponse;
        assert.equal(released.status(),200,'Original owner must be able to release after pricing revocation');
        const releaseReceipt = await released.json();
        assert.deepEqual(releaseReceipt,{reservationId:ownedReservationId,status:'released'});
        await page.getByTestId('jw-owned-reservation-status').waitFor({state:'detached'});
        const terminal=(await client.query('SELECT status,released_at FROM jw_stone_cart_holds WHERE public_id=$1',[ownedReservationId])).rows[0];
        assert.equal(terminal.status,'released'); assert(terminal.released_at);
        const position=(await client.query(
          `SELECT held_quantity FROM stone_inventory_positions position
           JOIN stone_asset_passports passport ON passport.id=position.asset_passport_id
           WHERE position.holder_business_id=$1 AND passport.public_id=$2`,
          [fixture.businessId,fixture.cartStockId]
        )).rows[0];
        assert.equal(Number(position.held_quantity),0);
        note(device+': original owner releases owned hold through actual UI after membership revocation', {
          actualRecoveryUi:true,
          actualCustomerReleaseUi:true,
          releaseAfterMembershipRevocation:true,
          paymentStarted:false,
        });
      } else {
        run('Release synthetic owned hold after status acceptance', [process.execPath, '--import', 'tsx', 'scripts/jw-stone-owned-hold.fixture.ts', '--release'], heldEnv);
        await page.getByRole('button',{name:'Refresh reservation status',exact:true}).click();
        await page.getByTestId('jw-owned-reservation-status').waitFor({state:'detached'});
        note(device+': original owner retains price-free status after revocation and UI refresh follows service release', {actualRecoveryUi:true, releaseViaFixtureService:true, noCustomerReserveOrReleaseUi:true});
      }
    }
    assert.deepEqual(errors, [], 'Uncaught browser errors'); assert.deepEqual(failures, [], 'Unexpected server errors');
    await context.close(); activePage = undefined;
  }
  if (process.argv.includes('--cart-hold-actions')) {
    assert.deepEqual(
      [...new Set(report.customerReservationDevices)].sort(),
      ['desktop', 'touch'],
      'Customer reservation acceptance must pass on desktop and touch'
    );
    assert.equal(report.backendCartHoldProof?.passed, true);
    assert.equal(report.backendCartHoldProof?.productionWrites, false);
    report.customerReservationActionsProved = true;
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
  await fs.rm(temp, { recursive: true }); console.log('JW_WORKFLOW_SUMMARY ' + JSON.stringify(report));
}

assert.equal(report.passed, true, 'Native offer verification failed; not release approval');
