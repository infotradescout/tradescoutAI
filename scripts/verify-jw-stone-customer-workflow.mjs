import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

// A diagnostic pass is not a customer-workflow or release pass. Run it at the
// top-level output location so its patch is retained, without the workflow
// wrapper interpreting an intentionally short-circuited child as completion.
if (process.env.SUPPLIER_PREPARE_SUBTOTAL_FIX === 'true') {
  assert.equal(process.env.JW_WORKFLOW_PHASE || 'workflow', 'workflow');
  const { prepareSupplierSubtotalFix } = await import('./prepare-supplier-subtotal-fix.mjs');
  await prepareSupplierSubtotalFix();
  const diagnosticOutput = path.resolve(process.env.JW_WORKFLOW_OUTPUT || 'test-results/supplier-patch');
  const diagnostic = JSON.parse(await fs.readFile(path.join(diagnosticOutput, 'evidence.json'), 'utf8'));
  assert.equal(diagnostic.phase, 'isolated-subtotal-diagnosis');
  assert.equal(diagnostic.preparationOnly, true);
  assert.equal(diagnostic.productionChanged, false);
  console.log('JW_DIAGNOSIS_ONLY ' + JSON.stringify({ passed: diagnostic.passed, workflowExecuted: false, releaseApproved: false, productionChanged: false }));
  process.exit(diagnostic.passed ? 0 : 1);
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const phase = process.env.JW_WORKFLOW_PHASE || 'workflow';
assert(['workflow', 'release', 'production'].includes(phase));
const out = path.resolve(process.env.JW_WORKFLOW_OUTPUT || 'test-results/jw-workflow');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-verification-'));
const report = { head, phase, startedAt: new Date().toISOString(), checks: [], passed: false, liveCustomerWrites: false, actualEmailDeliveryProved: false, formalPricedQuoteProved: false };
let database, browser;
const clean = () => execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
function run(name, args, env = {}) {
  console.log('JW_RELEASE_START ' + name);
  const r = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 1200000, maxBuffer: 80 * 1024 * 1024 });
  const log = ((r.stdout || '') + (r.stderr || '')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]');
  console.log(log); report.checks.push({ name, passed: r.status === 0, status: r.status, tail: log.slice(-4000) });
  assert.equal(r.status, 0, name);
}
async function live() {
  const base = 'https://www.thetradescout.com';
  const expected = process.env.JW_EXPECTED_DEPLOYED_SHA || '';
  assert.match(expected, /^[a-f0-9]{40}$/); report.deployed = expected;
  const allowed = new Set([base, 'https://jwstonelogistics.com', 'https://www.jwstonelogistics.com']);
  async function health() {
    const r = await fetch(base + '/api/health', { signal: AbortSignal.timeout(20000) });
    assert.equal(r.status, 200); assert.equal(r.headers.get('x-tradescout-build'), expected);
    const h = await r.json(); assert.equal(h.commit, expected); assert.equal(h.status, 'healthy');
    assert.equal(h.database, 'connected'); assert.equal(h.migrations.compatibility, 'compatible'); assert.equal(h.migrations.requiredSchemaOk, true); return h;
  }
  report.healthBefore = await health();
  run('Install Chromium', [process.execPath, 'node_modules/playwright/cli.js', 'install', 'chromium']);
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  report.browser = [];
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36` });
    const errors = [], failedAssets = [], blockedWrites = [];
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) { blockedWrites.push(new URL(route.request().url()).pathname); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', r => { if (r.status() >= 400 && ['script', 'stylesheet'].includes(r.request().resourceType())) failedAssets.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    const response = await page.goto(base + '/u/jw-stone', { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200); const destination = new URL(page.url()); assert(allowed.has(destination.origin));
    if (response.headers()['x-tradescout-build']) assert.equal(response.headers()['x-tradescout-build'], expected);
    await page.getByTestId('jw-marketplace-account-button').waitFor();
    const guestPrices = await context.request.get(destination.origin + '/api/u/jw-stone/member-pricing');
    assert.equal(guestPrices.status(), 401); assert(!(await guestPrices.text()).includes('slabPriceCents'));
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); return device === 'touch' ? locator.tap() : locator.click(); };
    await click(page.getByTestId('jw-marketplace-account-button'));
    await page.getByTestId('profile-account-business-name').waitFor();
    await page.getByTestId('profile-account-email').waitFor(); await page.getByTestId('profile-account-password').waitFor();
    assert.equal(await page.getByTestId('profile-account-dialog-connected').count(), 0);
    await page.screenshot({ path: path.join(out, device + '-live-account-form.png'), fullPage: false });
    await click(page.getByRole('button', { name: 'Already have an account? Sign in', exact: true }));
    await page.getByRole('button', { name: 'Sign in and continue', exact: true }).waitFor();
    assert(await page.getByRole('link', { name: 'Forgot or need to set your password?', exact: true }).count());
    await page.keyboard.press('Escape');
    const requestUrl = new URL(destination.href); requestUrl.searchParams.set('request', 'collection');
    const requestPage = await page.goto(requestUrl.href, { waitUntil: 'domcontentloaded', timeout: 60000 }); assert.equal(requestPage.status(), 200);
    const dialog = page.getByRole('dialog', { name: 'JW Stone Logistics', exact: true });
    await dialog.getByLabel('Name', { exact: true }).waitFor();
    await dialog.getByRole('combobox', { name: /^I am a/ }).waitFor();
    assert.equal(await dialog.locator('input[type="checkbox"]').isChecked(), false);
    await page.screenshot({ path: path.join(out, device + '-live-request-form.png'), fullPage: false });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
    report.browser.push({ device, url: destination.href, accountForm: true, signInRecovery: true, requestForm: true, anonymousPriceStatus: 401, documentBuild: response.headers()['x-tradescout-build'] || null, errors, failedAssets, blockedWrites });
    await context.close();
  }
  report.healthAfter = await health();
}
try {
  assert.equal(clean(), '');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'SENDGRID_API_KEY', 'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'JW_STONE_PRICING_APPROVED_IMPORT']) assert(!process.env[key], 'No inherited data or provider credentials: ' + key);
  await fs.mkdir(out, { recursive: true });
  if (phase === 'production') await live();
  else {
    const nativeOut = path.join(temp, 'native');
    run('Actual native customer workflow', [process.execPath, 'scripts/jw-stone-customer-workflow.native.mjs'], { JW_WORKFLOW_OUTPUT: nativeOut });
    report.workflow = JSON.parse(await fs.readFile(path.join(nativeOut, 'evidence.json'), 'utf8'));
    assert.notEqual(report.workflow.preparationOnly, true, 'A preparation/diagnostic result cannot count as workflow completion');
    for (const file of await fs.readdir(nativeOut)) if (file.endsWith('.png')) await fs.copyFile(path.join(nativeOut, file), path.join(out, file));
    assert.equal(report.workflow.head, head); assert.equal(report.workflow.passed, true, 'Native workflow report failed');
    if (phase === 'release') {
      run('Canonical main ancestry', ['git', 'fetch', '--no-tags', '--depth=2048', 'https://github.com/infotradescout/tradescoutAI.git', 'refs/heads/main:refs/remotes/origin/main']);
      report.mainAtVerification = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
      const selected = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' }).trim().split('\n').filter(file => !file.startsWith('scripts/') && /profile-account|profileAccount|jw.*pricing|jw.*account|JWStoneMarketplace|JwStoneAccount|public-profile-registration/i.test(file));
      assert(selected.includes('client/src/components/profile/PublicProfileAccountDialog.session.test.tsx'));
      const tests = path.join(temp, 'affected.json');
      run('Affected membership, pricing, session and JW client tests', ['npm', 'run', 'test:run', '--', ...selected, '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + tests]);
      const result = JSON.parse(await fs.readFile(tests, 'utf8')); report.tests = Object.fromEntries(['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests'].map(key => [key, result[key]]));
      for (const guard of ['guard:law-drift', 'guard:forbidden', 'audit:authority-gates', 'audit:trust-leaks']) run(guard, ['npm', 'run', guard]);
      database = await startCabinetLoopbackTestDatabase();
      run('Unchanged strict minimum-release contract', ['npm', 'run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=Exact-head built desktop and touch JW signup, private member pricing, reload/login, actual synthetic supplier request persistence/assignment/notice and revoked-access denial passed against native loopback PostgreSQL. No production writes or provider email delivery claimed.'], { TEST_DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE: 'true' });
      report.release = JSON.parse(await fs.readFile(path.join('artifacts/release-contract', head.slice(0, 12), 'evidence.json'), 'utf8'));
      assert.equal(report.release.commit, head); assert.equal(report.release.attestable, true); assert.equal(report.release.result, 'pass');
    }
  }
  report.finalSourceStatus = clean(); assert.equal(report.finalSourceStatus, ''); report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); console.error('JW_RELEASE_FAILURE ' + report.error);
} finally {
  await browser?.close(); await database?.stop(); report.finishedAt = new Date().toISOString();
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>' + (report.passed ? 'Declared workflow checks passed' : 'FAILED - not release approval') + '</h1><p>' + phase + ' ' + head + '</p><p>Not actual email delivery, a formal priced quote or customer acquisition proof.</p><a href="evidence.json">Evidence</a>');
  await fs.rm(temp, { recursive: true, force: true });
  console.log('JW_RELEASE_SUMMARY ' + JSON.stringify({ ...report, checks: report.checks.map(({ tail, ...check }) => check) }));
}
