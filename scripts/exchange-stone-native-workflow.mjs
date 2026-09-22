import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync, spawnSync, fork } from 'node:child_process';
import pg from 'pg';
import { chromium } from 'playwright';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(head, process.env.EXCHANGE_STONE_CANDIDATE);
const output = path.resolve(process.env.EXCHANGE_BATCH_OUTPUT, 'native');
await fs.mkdir(output, { recursive: true });
const report = { head, startedAt: new Date().toISOString(), passed: false, productionPublished: false,
  scope: 'Disposable full-schema fixture, compiled importer, native PostgreSQL, two actual registerRoutes processes, real session-cookie login and production-built buyer screen. Synthetic accounts/photos only; no production or external provider transaction.', checks: [], browser: [] };
const record = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); console.log('STONE_NATIVE_CHECK ' + JSON.stringify(report.checks.at(-1))); };
const scrub = value => String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOOPBACK_TEST_DATABASE]');
let database, client, browser, working;
const children = [], logs = [];
async function stopChildren() {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM');
  });
}
function startApp(config, env, setup, port) {
  return new Promise((resolve, reject) => {
    const child = fork(path.resolve('scripts/exchange-stone-native-fixture.ts'), [], { execArgv: ['--import', 'tsx'],
      env: { ...env, EXCHANGE_STONE_NATIVE_FIXTURE: 'true', EXCHANGE_STONE_NATIVE_PRIVATE: working,
        EXCHANGE_STONE_NATIVE_TOKEN: config.token, EXCHANGE_STONE_NATIVE_SETUP: String(setup), EXCHANGE_STONE_NATIVE_PORT: String(port) }, silent: true });
    children.push(child);
    const log = { port, text: '' }; logs.push(log);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { log.text += bytes; if (log.text.length > 3000000) log.text = log.text.slice(-3000000); });
    const timer = setTimeout(() => reject(new Error('Application process startup timed out: ' + port)), 180000);
    child.on('message', message => { if (message?.ready) { clearTimeout(timer); resolve(message.base); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Application process exited before readiness: ' + port + ' exit=' + code + '\n' + scrub(log.text.slice(-10000)))); });
  });
}
try {
  for (const key of ['DATABASE_URL','TEST_DATABASE_URL','SESSION_SECRET','STONE_METRICS_SECRET','BREVO_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','SMTP_PASS','STRIPE_SECRET_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY']) assert(!process.env[key], 'No inherited live credentials: ' + key);
  working = await fs.mkdtemp(path.join(os.tmpdir(), 'exchange-stone-native-'));
  database = await startCabinetLoopbackTestDatabase(); report.database = database.evidence;
  const admin = new pg.Client({ connectionString: database.url }); await admin.connect();
  await admin.query('CREATE DATABASE ts_exchange_stone_test'); await admin.end();
  const url = new URL(database.url); url.pathname = '/ts_exchange_stone_test';
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: url.href, TEST_DATABASE_URL: url.href,
    ALLOW_INSECURE_TEST_DATABASE: 'true', ALLOW_TEST_DB_FULL_SYNC: 'true', TZ: 'UTC' };
  const boot = spawnSync(process.execPath, ['scripts/bootstrap-test-db.mjs', '--full-sync'], { env, encoding: 'utf8', timeout: 600000, maxBuffer: 30000000 });
  await fs.writeFile(path.join(output, 'schema-bootstrap.log'), scrub((boot.stdout || '') + (boot.stderr || '')));
  assert.equal(boot.status, 0, 'Disposable full-schema bootstrap failed: ' + scrub((boot.stderr || boot.stdout || '').slice(-4000)));
  record('Guarded disposable full-schema fixture created', { historicalEmptyMigrationChainProved: false });
  client = new pg.Client({ connectionString: url.href }); await client.connect();
  assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'ts_exchange_stone_test');
  for (const migration of ['0127_public_media_objects.sql', '0140_exchange_stone_funnel.sql', '0141_exchange_stone_inquiry_receipts.sql']) {
    await client.query(await fs.readFile(path.join('migrations', migration), 'utf8'));
  }
  record('Canonical retail and media DDL executed on the full fixture; no ledger stamping');
  const config = { token: randomUUID(), databaseUrl: url.href, sessionSecret: randomUUID() + randomUUID(), metricsSecret: randomUUID() + randomUUID() };
  await fs.writeFile(path.join(working, 'configuration.json'), JSON.stringify(config), { mode: 0o600 });
  const firstBase = await startApp(config, env, true, 5241);
  const fixture = JSON.parse(await fs.readFile(path.join(working, 'fixture.json'), 'utf8'));
  record('Compiled operator dry run, simultaneous native imports and identical replay', fixture.importer);
  const secondBase = await startApp(config, env, false, 5242);
  record('Two independent actual application processes ready', { processes: 2 });
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`;
  const context = () => browser.newContext({ userAgent, serviceWorkers: 'block' });
  const login = async (ctx, kind, base = firstBase) => {
    const account = fixture.accounts[kind];
    const response = await ctx.request.post(base + '/api/auth/login', { data: { email: account.email, password: account.password } });
    assert.equal(response.status(), 200, 'Real session login failed: ' + kind + ' ' + await response.text());
  };
  const id = 'tradescout-stone-matrix-basalt';
  const listingPath = `/exchange/building-materials/${id}`;
  const guest = await context();
  const publicCatalog = await guest.request.get(firstBase + '/api/exchange/stone?audienceState=TX');
  assert.equal(publicCatalog.status(), 200); assert.equal((await publicCatalog.json()).items.length, 3);
  assert.match(publicCatalog.headers()['cache-control'], /no-store/);
  const feed = await guest.request.get(firstBase + '/api/exchange/items?audienceState=TX');
  assert.equal(feed.status(), 200); assert((await feed.text()).includes(id));
  const detail = await guest.request.get(firstBase + '/api/marketplace/listings/' + id);
  assert.equal(detail.status(), 200); assert((await detail.text()).includes('TradeScout'));
  const image = await guest.request.get(firstBase + '/api/exchange/stone-media/' + id);
  assert.equal(image.status(), 200); assert.equal(createHash('sha256').update(await image.body()).digest('hex'), fixture.digest);
  assert.equal((await guest.request.post(firstBase + '/api/marketplace/inquiries', { data: { listingId: id } })).status(), 401);
  const excludedCatalog = await guest.request.get(firstBase + '/api/exchange/stone?audienceState=FL&audienceCity=Pensacola');
  assert.equal((await excludedCatalog.json()).items.length, 0);
  assert.equal((await guest.request.get(firstBase + '/api/exchange/stone-media/' + id)).status(), 404);
  const adjacent = await guest.request.get(firstBase + '/api/exchange/stone?audienceState=FL&audienceCity=Gulf%20Breeze');
  assert.equal((await adjacent.json()).items.length, 3);
  await guest.close();
  record('Actual guest catalog/feed/detail/media work; Pensacola alone is excluded and guest inquiry denied');

  for (const device of ['desktop', 'touch']) {
    const viewport = device === 'touch' ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const ctx = await browser.newContext({ userAgent, viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block' });
    await ctx.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort('blockedbyclient'));
    const page = await ctx.newPage(); page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const intent = device === 'touch' ? 'callback' : 'availability';
    const exactMessage = `Native ${device} buyer asks about the listed material and separate delivery charges.`;
    await page.goto(firstBase + '/exchange/stone?audienceState=TX&utm_source=facebook_marketplace&utm_medium=marketplace', { waitUntil: 'domcontentloaded' });
    const card = page.locator('article.stone-card').filter({ hasText: 'Matrix Basalt' });
    await card.getByRole('link', { name: intent === 'callback' ? 'Request a call' : 'Check availability', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.match(await dialog.locator('textarea').inputValue(), /\$36\.00 \/ sq ft/);
    await dialog.locator('textarea').fill(exactMessage);
    await dialog.getByRole('button', { name: 'Sign in to send', exact: true }).click();
    await page.waitForURL('**/pre-scout-setup?**');
    const next = new URL(page.url()).searchParams.get('next'); assert(next?.startsWith(listingPath));
    // Authenticate through the real cookie API, then use the actual saved return URL and draft restoration.
    await login(ctx, device);
    await page.goto(firstBase + next, { waitUntil: 'domcontentloaded' });
    await dialog.waitFor(); assert.equal(await dialog.locator('textarea').inputValue(), exactMessage);
    await page.screenshot({ path: path.join(output, device + '-restored-inquiry.png'), fullPage: false });
    let savedAfterLostResponse;
    if (device === 'desktop') {
      let resolveLost; const lost = new Promise(resolve => { resolveLost = resolve; });
      await page.route('**/api/marketplace/inquiries', async route => {
        const response = await route.fetch();
        if (!savedAfterLostResponse && response.status() === 201) {
          savedAfterLostResponse = await response.json(); await route.abort('failed'); resolveLost();
        } else await route.fulfill({ response });
      });
      await dialog.getByRole('button', { name: 'Confirm & Send', exact: true }).click();
      await Promise.race([lost, new Promise((_, reject) => setTimeout(() => reject(new Error('Initial inquiry was not committed')), 30000))]);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Confirm & Send' && !button.disabled));
    }
    const sent = page.waitForResponse(response => response.url().includes('/api/marketplace/inquiries') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Confirm & Send', exact: true }).click();
    const response = await sent;
    assert.equal(response.status(), device === 'desktop' ? 200 : 201, await response.text());
    const receipt = await response.json();
    if (savedAfterLostResponse) assert.equal(receipt.id, savedAfterLostResponse.id);
    const inquiry = await client.query('SELECT id,seller_id,message FROM marketplace_inquiries WHERE buyer_id=$1', [fixture.accounts[device].id]);
    assert.equal(inquiry.rows.length, 1); assert.equal(inquiry.rows[0].seller_id, fixture.accounts.seller.id); assert.equal(inquiry.rows[0].message, exactMessage);
    assert.equal(Number((await client.query('SELECT count(*) AS n FROM marketplace_messages WHERE conversation_id=$1', [receipt.conversationId])).rows[0].n), 1);
    assert.equal(Number((await client.query('SELECT count(*) AS n FROM notifications WHERE id=$1 AND user_id=$2', [receipt.notificationId, fixture.accounts.seller.id])).rows[0].n), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []);
    report.browser.push({ device, passed: true, restoredExactDraft: true, connectedToSeller: true, lostResponseReplay: device === 'desktop' });
    await ctx.close();
    record(device + ': actual built screen preserves draft through cookie sign-in and sends one saved seller inquiry');
  }

  const parallel = await context();
  await parallel.request.get(firstBase + '/exchange/stone?audienceState=TX&utm_source=facebook_marketplace&utm_medium=marketplace');
  await login(parallel, 'parallel');
  const decisionScope = `marketplace_listing:${id}`;
  const createCard = async ctx => {
    const response = await ctx.request.post(firstBase + '/api/decision-cards', { data: { intent: 'collaborate', decisionScope, title: 'Exchange inquiry: Matrix Basalt', description: 'Review a protected in-platform inquiry about Matrix Basalt.' } });
    assert([200, 201].includes(response.status()), await response.text());
    const card = await response.json(); assert.equal(typeof card.id, 'string'); return card;
  };
  const card = await createCard(parallel);
  const command = { listingId: id, message: 'Please call about this stone through TradeScout.', inquiryIntent: 'callback', authorityGate: 'decision_card', sourceDecisionCardId: card.id, decisionScope, requestKey: randomUUID() };
  const replies = await Promise.all([firstBase, secondBase, firstBase, secondBase].map(base => parallel.request.post(base + '/api/marketplace/inquiries', { data: command })));
  const receipts = [];
  for (const response of replies) { assert([200, 201].includes(response.status()), await response.text()); receipts.push(await response.json()); }
  assert.equal(replies.filter(response => response.status() === 201).length, 1);
  assert.equal(new Set(receipts.map(receipt => receipt.id)).size, 1);
  const counts = await client.query('SELECT count(*)::int AS n FROM marketplace_inquiries WHERE buyer_id=$1', [fixture.accounts.parallel.id]); assert.equal(counts.rows[0].n, 1);
  const events = await client.query('SELECT stage,payload FROM exchange_stone_funnel_events WHERE evidence_id=$1 ORDER BY stage', [receipts[0].id]);
  assert.deepEqual(events.rows.map(row => row.stage), ['callback_requested', 'inquiry_submitted']);
  assert(events.rows.every(row => row.payload.acquisition.channel === 'facebook_marketplace'));
  const conflict = await parallel.request.post(secondBase + '/api/marketplace/inquiries', { data: { ...command, message: 'Changed message' } }); assert.equal(conflict.status(), 409);
  await parallel.close(); record('Two real application processes return one inquiry/message identity; attribution and callback evidence preserved');
  const excluded = await context(); await login(excluded, 'excluded');
  assert.equal((await (await excluded.request.get(firstBase + '/api/exchange/stone?audienceState=TX')).json()).items.length, 0);
  const excludedCard = await createCard(excluded);
  assert.equal((await excluded.request.post(firstBase + '/api/marketplace/inquiries', { data: { ...command, requestKey: randomUUID(), sourceDecisionCardId: excludedCard.id } })).status(), 404);
  assert.equal(Number((await client.query('SELECT count(*) AS n FROM marketplace_inquiries WHERE buyer_id=$1', [fixture.accounts.excluded.id])).rows[0].n), 0);
  await excluded.close(); record('Known Pensacola account cannot override discovery or submit by using another market');
  const seller = await context(); await login(seller, 'seller');
  const inbox = await seller.request.get(firstBase + '/api/marketplace/conversations');
  assert.equal(inbox.status(), 200, await inbox.text()); assert((await inbox.text()).includes(receipts[0].conversationId));
  await seller.close(); record('Seller can retrieve the saved conversation through the real authenticated inbox API');
  report.passed = true;
} catch (error) { report.error = scrub(error.stack || error); }
finally {
  await browser?.close().catch(() => {}); await stopChildren(); await client?.end().catch(() => {});
  try { await database?.stop(); } catch (error) { report.cleanupError = scrub(error); report.passed = false; }
  for (const log of logs) await fs.writeFile(path.join(output, `application-${log.port}.log`), scrub(log.text));
  if (working) await fs.rm(working, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('STONE_NATIVE_RESULT ' + JSON.stringify(report)); process.exitCode = report.passed ? 0 : 1;
}
