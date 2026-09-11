import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const production = process.env.CUSTOMER_PATH_PHASE === 'production';
const output = path.resolve(process.env.CUSTOMER_PATH_BROWSER_OUTPUT || 'test-results/customer-path-browser');
await fs.mkdir(output, { recursive: true });
const result = { phase: production ? 'production' : 'isolated-built-client', startedAt: new Date().toISOString(), checks: [], passed: false, providerDeliveryTested: false };
let fixture, database, browser, activePage;
const base = production ? 'https://www.thetradescout.com' : 'http://127.0.0.1:5218';
const record = (name, detail) => { result.checks.push({ name, detail, passed: true }); console.log('CUSTOMER_BROWSER_CHECK ' + JSON.stringify(result.checks.at(-1))); };
try {
  if (!production) {
    assert.equal(process.env.NODE_ENV, 'test');
    const url = new URL(process.env.TEST_DATABASE_URL || '');
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.pathname, '/ts_operator_test');
    fixture = JSON.parse(await fs.readFile('test-results/operator-http-proof/fixture.private.json', 'utf8'));
    assert.equal(fixture.baseUrl, base);
    const { default: pg } = await import('pg');
    database = new pg.Client({ connectionString: url.href }); await database.connect();
    assert.equal((await database.query('select current_database() as name')).rows[0].name, 'ts_operator_test');
  }
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', userAgent: `Mozilla/5.0 (${device === 'touch' ? 'Linux; Android 13; Pixel 7' : 'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36` });
    const errors = [], failedAssets = [], blockedWrites = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (production && !['GET','HEAD'].includes(request.method())) { blockedWrites.push({ method: request.method(), path: url.pathname }); return route.abort('blockedbyclient'); }
      if (!production && url.origin !== base) return route.abort('blockedbyclient');
      return route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && ['script','stylesheet'].includes(response.request().resourceType())) failedAssets.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (device === 'touch') await locator.tap(); else await locator.click(); };
    const navigate = async pathname => {
      const response = await page.goto(base + pathname, { waitUntil: 'domcontentloaded' }); assert(response?.ok(), 'Document failed: ' + pathname.split('?')[0]);
      if (production) assert.equal(response.headers()['x-tradescout-build'], process.env.CUSTOMER_PATH_DEPLOYED_SHA);
    };
    const snapshot = async name => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, 'Horizontal overflow: ' + name); await page.screenshot({ path: path.join(output, device + '-' + name + '.png'), fullPage: true }); };
    await navigate('/exchange');
    await page.getByRole('heading', { name: /Exchange/i }).first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/exchange');
    await snapshot('exchange');
    await navigate('/exchange/building-materials');
    await page.getByRole('heading', { name: /Building Materials/i }).first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/exchange/building-materials');
    await snapshot('materials');
    record(device + ': fresh guest discovery', 'Actual built Exchange and Building Materials routes remain reachable without activity or signup; screenshots and overflow checks passed.');
    if (production) {
      const response = await context.request.get(base + '/api/exchange/items?category=Building%20Materials&limit=48&offset=0');
      assert.equal(response.status(), 200);
      const payload = await response.json();
      assert(Array.isArray(payload) || Array.isArray(payload.items), 'Exchange response must contain items');
      const items = Array.isArray(payload) ? payload : payload.items;
      assert(items.length > 0, 'Live Building Materials unexpectedly empty');
      record(device + ': live material discovery', { visibleApiItems: items.length, source: 'Actual public production GET; no request submission or customer data changed' });
    } else {
      const destination = `/contractors/${fixture.providerId}?trustAction=recommend`;
      const text = `Synthetic private ${device} recommendation ${randomUUID()}. The installer discussed the measured kitchen plan.`;
      await navigate(destination);
      await page.getByTestId('textarea-comment').fill(text);
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.getByTestId('textarea-comment').inputValue(), text);
      await click(page.getByTestId('button-submit-recommendation'));
      await page.getByTestId('recommendation-guest-saved').waitFor();
      await snapshot('guest-draft');
      await click(page.getByRole('button', { name: 'Continue with a free account', exact: true }));
      await page.waitForURL(url => url.pathname === '/pre-scout-setup');
      assert.equal(new URL(page.url()).searchParams.get('next'), destination);
      assert(!page.url().includes(text));
      const email = `customer-path-${device}-${randomUUID()}@example.test`;
      const password = 'SyntheticOnly-' + randomUUID() + '!';
      await page.locator('[name="firstName"]').fill('Synthetic Neighbor');
      await page.locator('[name="email"]').fill(email);
      await page.locator('[name="password"]').fill(password);
      await page.locator('input[type="checkbox"]').first().check();
      const registered = page.waitForResponse(response => /\/api\/auth\/register(?:-multi)?$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
      await click(page.locator('form button[type="submit"]').first());
      const registration = await registered; assert.equal(registration.status(), 200, 'Actual signup failed');
      const registrationPayload = await registration.json();
      await page.getByTestId('recommendation-saved').waitFor({ timeout: 90000 });
      assert.equal(new URL(page.url()).pathname, '/contractors/' + fixture.providerId);
      let user = (await database.query('select id,email_verified,onboarding_completed from users where email=$1', [email])).rows[0];
      assert(user); assert.equal(user.email_verified, false); assert.equal(user.onboarding_completed, false);
      let rows = (await database.query('select id,comment,is_public,moderation_status from recommendations where user_id=$1 and contractor_id=$2', [user.id, fixture.providerId])).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].comment, text); assert.equal(rows[0].is_public, false);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('recommendation-saved').waitFor();
      assert.equal((await database.query('select count(*)::int as n from recommendations where user_id=$1 and contractor_id=$2', [user.id, fixture.providerId])).rows[0].n, 1);
      await snapshot('signup-return');
      record(device + ': actual signup and durable recommendation', 'Guest draft survived reload, real signup established the session and returned to the same action; one private database recommendation persisted without falsely completing onboarding.');
      await click(page.getByRole('button', { name: 'Confirm email to continue', exact: true }));
      await page.waitForURL(url => url.pathname === '/verification');
      assert.equal(new URL(page.url()).searchParams.get('next'), destination);
      const verification = await context.request.post(base + '/api/auth/request-email-verification', { data: { email, next: destination } });
      assert.equal(verification.status(), 200);
      const verificationPayload = await verification.json();
      const token = verificationPayload.verificationToken || registrationPayload.verificationToken;
      assert.equal(typeof token, 'string', 'No test-only verification token returned; email verification is not proved');
      assert(token.length > 10);
      await navigate('/verify-email?token=' + encodeURIComponent(token) + '&next=' + encodeURIComponent(destination));
      await page.getByTestId('recommendation-saved').waitFor({ timeout: 90000 });
      user = (await database.query('select email_verified,onboarding_completed from users where email=$1', [email])).rows[0];
      assert.equal(user.email_verified, true); assert.equal(user.onboarding_completed, false);
      assert.equal((await database.query('select is_public from recommendations where id=$1', [rows[0].id])).rows[0].is_public, false);
      await snapshot('verification-return');
      record(device + ': actual verification and moderation boundary', 'Server-issued test token consumed through the actual verification page; return preserved, author verified, onboarding unchanged and publication still withheld pending moderation. No external email delivery is claimed.');
      await context.clearCookies();
      const publicResponse = await context.request.get(base + `/api/contractors/${fixture.providerId}/recommendations`);
      assert.equal(publicResponse.status(), 200); assert(!(await publicResponse.text()).includes(text));
      const denied = await context.request.post(base + `/api/contractors/${fixture.providerId}/recommendations`, { data: { submissionId: randomUUID(), recommendationType: 'positive', comment: 'Synthetic unauthorized attempt' } });
      assert.equal(denied.status(), 401);
      const login = await context.request.post(base + '/api/auth/login', { data: { email: fixture.identities.operator.email, password: fixture.password } });
      assert.equal(login.status(), 200);
      await navigate('/admin/direct-connect-requests?requestId=' + encodeURIComponent(fixture.requestId));
      await page.getByText('Synthetic Alachua installation request', { exact: false }).first().waitFor();
      await snapshot('operator-request');
      record(device + ': recipient operations and denial', 'The actual authenticated operator screen renders the request created and routed in the native HTTP proof; anonymous recommendation write was denied and pending content stayed private.');
    }
    assert.deepEqual(errors, [], 'Uncaught browser errors'); assert.deepEqual(failedAssets, [], 'Failed built scripts/styles');
    result.checks.push({ name: device + ': browser integrity', passed: true, errors, failedAssets, blockedWrites });
    await context.close(); activePage = undefined;
  }
  result.passed = true;
} catch (error) {
  result.error = String(error.stack || error).replace(/token=[^&\s]+/g, 'token=[TEST_TOKEN]');
  if (activePage) { result.visibleFailureText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 5000); await activePage.screenshot({ path: path.join(output,'failure.png'), fullPage:true }).catch(() => {}); }
  console.error('CUSTOMER_BROWSER_FAILURE ' + result.error);
} finally {
  await browser?.close(); await database?.end();
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output,'browser-evidence.json'),JSON.stringify(result,null,2));
  console.log('CUSTOMER_BROWSER_RESULT ' + JSON.stringify(result));
}
if (!result.passed) process.exitCode = 1;
