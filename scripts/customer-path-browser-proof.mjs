import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const production = process.env.CUSTOMER_PATH_PHASE === 'production';
const output = path.resolve(process.env.CUSTOMER_PATH_BROWSER_OUTPUT || 'test-results/customer-path-browser');
const base = production ? 'https://www.thetradescout.com' : 'http://127.0.0.1:5218';
const result = { phase: production ? 'production-read-only' : 'isolated-built-client', startedAt: new Date().toISOString(), checks: [], passed: false, providerDeliveryTested: false };
await fs.mkdir(output, { recursive: true });
let fixture, database, browser, activePage;
const apiFailures = [];
const record = (name, detail) => { result.checks.push({ name, detail, passed: true }); console.log('CUSTOMER_BROWSER_CHECK ' + JSON.stringify(result.checks.at(-1))); };
function assertLocalFixture() {
  assert.equal(production, false, 'Account writes are forbidden in production proof');
  assert.equal(base, 'http://127.0.0.1:5218');
  assert.equal(process.env.NODE_ENV, 'test');
  const target = new URL(process.env.TEST_DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.pathname, '/ts_operator_test');
  assert.equal(fixture?.baseUrl, base);
}
async function api(context, method, pathname, data) {
  const url = new URL(pathname, base); assert.equal(url.origin, base);
  assert(url.pathname.startsWith('/api/'));
  if (!['GET', 'HEAD'].includes(method)) assertLocalFixture();
  return context.request.fetch(url.href, { method, ...(data === undefined ? {} : { data }) });
}
try {
  if (!production) {
    fixture = JSON.parse(await fs.readFile('test-results/operator-http-proof/fixture.private.json', 'utf8'));
    assertLocalFixture();
    assert.match(fixture.profileSlug, /^operator-proof-[0-9a-f]{8}$/);
    assert.match(fixture.identities.operator.email, /^operator-proof-[0-9a-f]{8}-operator@example\.test$/);
    for (const key of ['SENDGRID_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'SMTP_PASSWORD']) assert(!process.env[key], 'No external mail credentials allowed');
    const { default: pg } = await import('pg');
    database = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }); await database.connect();
    assert.equal((await database.query('select current_database() as name')).rows[0].name, 'ts_operator_test');
  }
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', userAgent: `Mozilla/5.0 (${device === 'touch' ? 'Linux; Android 13; Pixel 7' : 'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36` });
    const errors = [], failedAssets = [], blockedWrites = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) {
        if (production || url.origin !== base) { blockedWrites.push({ method: request.method(), path: url.pathname }); return route.abort('blockedbyclient'); }
        assertLocalFixture();
      }
      if (!production && url.origin !== base) return route.abort('blockedbyclient');
      return route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname;
      if (response.status() >= 400 && pathname.startsWith('/api/')) apiFailures.push({ path: pathname, status: response.status() });
      if (response.status() >= 400 && ['script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push({ path: pathname, status: response.status() });
    });
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (device === 'touch') await locator.tap(); else await locator.click(); };
    const navigate = async pathname => {
      const url = new URL(pathname, base); assert.equal(url.origin, base);
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' }); assert(response?.ok(), 'Document failed: ' + url.pathname);
      if (production) assert.equal(response.headers()['x-tradescout-build'], process.env.CUSTOMER_PATH_DEPLOYED_SHA);
    };
    const snapshot = async name => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Horizontal overflow: ' + name);
      await page.screenshot({ path: path.join(output, device + '-' + name + '.png'), fullPage: true });
    };
    await navigate('/exchange'); await page.getByRole('heading', { name: /Exchange/i }).first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/exchange'); await snapshot('exchange');
    await navigate('/exchange/building-materials'); await page.getByRole('heading', { name: /Building Materials/i }).first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/exchange/building-materials');
    const materialResponse = await api(context, 'GET', '/api/exchange/items?categoryId=building-materials&limit=48&offset=0');
    assert.equal(materialResponse.status(), 200);
    const firstPage = await materialResponse.json(); assert(Array.isArray(firstPage));
    assert(firstPage.length > 0, 'Actual material discovery unexpectedly empty');
    assert(firstPage.every(item => item.category === 'building-materials'));
    if (!production) {
      assert.equal(firstPage.length, 48);
      await page.getByText('Synthetic material 001', { exact: true }).first().waitFor();
      await click(page.getByRole('button', { name: /Load more/i }).first()); await page.getByText('Synthetic material 049', { exact: true }).first().waitFor();
      await click(page.getByRole('button', { name: /Load more/i }).first()); await page.getByText('Synthetic material 105', { exact: true }).first().waitFor();
      assert.equal(await page.getByText(/^Synthetic material \d{3}$/).count(), fixture.materialCount);
      const all = [...firstPage];
      for (const offset of [48, 96]) {
        const response = await api(context, 'GET', `/api/exchange/items?categoryId=building-materials&limit=48&offset=${offset}`);
        assert.equal(response.status(), 200); all.push(...await response.json());
      }
      assert.equal(all.length, fixture.materialCount); assert.equal(new Set(all.map(item => item.id)).size, fixture.materialCount);
      assert(all.every(item => item.sourceType === 'profile_catalog' && item.price === null));
      const filtered = await api(context, 'GET', '/api/exchange/items?categoryId=building-materials&search=Synthetic%20material%20105&limit=48');
      assert.equal(filtered.status(), 200); const items = await filtered.json(); assert.equal(items.length, 1); assert.equal(items[0].title, 'Synthetic material 105');
    }
    await snapshot('materials');
    record(device + ': actual public material discovery', production ? { visibleApiItems: firstPage.length, scope: 'Actual public production category GET; no writes' } : 'Actual built UI and native API traverse 48, 96 and 105 synthetic catalog records exactly once; exact material search returns one item and prices remain unknown.');
    const first = firstPage.find(item => item.profileItemSlug && item.publicProfilePath);
    assert(first, 'An individual public profile material must be reachable'); assert(first.publicProfilePath.startsWith('/u/'));
    if (!production) {
      await click(page.getByRole('button', { name: 'View item', exact: true }).first());
      await page.waitForURL(url => url.pathname === first.publicProfilePath);
      await page.getByText(first.title, { exact: true }).first().waitFor(); await snapshot('exact-material');
      record(device + ': exact catalog destination', 'Actual View item action reaches its canonical published profile item with material identity preserved; no inquiry submitted.');
      const destination = `/contractors/${fixture.profileSlug}?trustAction=recommend`;
      const publicContractor = await api(context, 'GET', '/api/contractors/' + fixture.profileSlug);
      assert.equal(publicContractor.status(), 200, 'Public contractor slug must resolve');
      const profile = await publicContractor.json(); assert.equal(profile.contractor.id, fixture.providerId); assert(profile.canonicalBusinessProfileUrl, 'Linked-profile regression must be exercised');
      const text = `Synthetic private ${device} recommendation ${randomUUID()}. The installer discussed the measured kitchen plan.`;
      await navigate(destination); await page.getByTestId('textarea-comment').fill(text);
      await page.reload({ waitUntil: 'domcontentloaded' }); assert.equal(await page.getByTestId('textarea-comment').inputValue(), text);
      await click(page.getByTestId('button-submit-recommendation')); await page.getByTestId('recommendation-guest-saved').waitFor(); await snapshot('guest-draft');
      await click(page.getByRole('button', { name: 'Continue with a free account', exact: true }));
      await page.waitForURL(url => url.pathname === '/pre-scout-setup'); assert.equal(new URL(page.url()).searchParams.get('next'), destination); assert(!page.url().includes(text));
      assertLocalFixture();
      const email = `customer-path-${device}-${randomUUID()}@example.test`;
      assert.match(email, /^customer-path-(desktop|touch)-[0-9a-f-]+@example\.test$/);
      await page.locator('[name="firstName"]').fill('Synthetic Neighbor'); await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill('SyntheticOnly-' + randomUUID() + '!');
      await page.getByRole('checkbox').first().check();
      const registered = page.waitForResponse(response => new URL(response.url()).origin === base && /\/api\/auth\/register(?:-multi)?$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
      await click(page.locator('form button[type="submit"]').first());
      const registration = await registered; assert.equal(registration.status(), 200, 'Actual fixture signup failed'); const registrationPayload = await registration.json();
      await page.getByTestId('recommendation-saved').waitFor({ timeout: 90000 }); assert.equal(new URL(page.url()).pathname, '/contractors/' + fixture.profileSlug);
      let user = (await database.query('select id,email_verified,onboarding_completed from users where email=$1', [email])).rows[0];
      assert(user); assert.equal(user.email_verified, false); assert.equal(user.onboarding_completed, false);
      const rows = (await database.query('select id,comment,is_public,moderation_status from recommendations where user_id=$1 and contractor_id=$2', [user.id, fixture.providerId])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].comment, text); assert.equal(rows[0].is_public, false);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('recommendation-saved').waitFor();
      assert.equal((await database.query('select count(*)::int as n from recommendations where user_id=$1 and contractor_id=$2', [user.id, fixture.providerId])).rows[0].n, 1);
      await snapshot('signup-return'); record(device + ': actual signup and durable recommendation', 'Real local signup returns to the retained draft and creates one private recommendation, without falsely completing onboarding. Reload does not duplicate it.');
      await click(page.getByRole('button', { name: 'Confirm email to continue', exact: true })); await page.waitForURL(url => url.pathname === '/verification');
      assert.equal(new URL(page.url()).searchParams.get('next'), destination);
      const verification = await api(context, 'POST', '/api/auth/request-email-verification', { email, next: destination });
      assert.equal(verification.status(), 200); const verificationPayload = await verification.json();
      const token = verificationPayload.verificationToken || registrationPayload.verificationToken;
      assert.equal(typeof token, 'string', 'Actual test-only token issuance must succeed'); assert(token.length > 10);
      await navigate('/verify-email?token=' + encodeURIComponent(token) + '&next=' + encodeURIComponent(destination));
      await page.getByTestId('recommendation-saved').waitFor({ timeout: 90000 });
      user = (await database.query('select email_verified,onboarding_completed from users where email=$1', [email])).rows[0];
      assert.equal(user.email_verified, true); assert.equal(user.onboarding_completed, false);
      assert.equal((await database.query('select is_public from recommendations where id=$1', [rows[0].id])).rows[0].is_public, false);
      await snapshot('verification-return'); record(device + ': actual verification and moderation boundary', 'Actual local token issuance and page consumption return to the saved action; verified author remains unpublished pending moderation. No external email delivery claimed.');
      await context.clearCookies();
      const publicResponse = await api(context, 'GET', `/api/contractors/${fixture.providerId}/recommendations`);
      assert.equal(publicResponse.status(), 200); assert(!(await publicResponse.text()).includes(text));
      const denied = await api(context, 'POST', `/api/contractors/${fixture.providerId}/recommendations`, { submissionId: randomUUID(), recommendationType: 'positive', comment: 'Synthetic unauthorized attempt' });
      assert.equal(denied.status(), 401);
      const login = await api(context, 'POST', '/api/auth/login', { email: fixture.identities.operator.email, password: fixture.password }); assert.equal(login.status(), 200);
      await navigate('/admin/direct-connect-requests?requestId=' + encodeURIComponent(fixture.requestId));
      await page.getByText('Synthetic Alachua installation request', { exact: false }).first().waitFor(); await snapshot('operator-request');
      record(device + ': recipient operations and denial', 'The actual authenticated operator page shows the request created in the native HTTP proof. Anonymous writes are denied and pending recommendation text is not public.');
    }
    assert.deepEqual(errors, [], 'Uncaught browser errors'); assert.deepEqual(failedAssets, [], 'Failed built scripts/styles');
    result.checks.push({ name: device + ': browser integrity', passed: true, errors, failedAssets, blockedWrites });
    await context.close(); activePage = undefined;
  }
  result.passed = true;
} catch (error) {
  result.error = String(error.stack || error).replace(/token=[^&\s]+/g, 'token=[LOCAL_TEST_TOKEN]'); result.apiFailures = apiFailures;
  if (activePage) {
    result.visibleFailureText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 5000);
    await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  }
  console.error('CUSTOMER_BROWSER_FAILURE ' + result.error);
} finally {
  await browser?.close(); await database?.end(); result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'browser-evidence.json'), JSON.stringify(result, null, 2));
  console.log('CUSTOMER_BROWSER_RESULT ' + JSON.stringify(result));
}
if (!result.passed) process.exitCode = 1;
