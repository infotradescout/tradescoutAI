import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { chromium } from 'playwright';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

// Requires npm run build and Playwright Chromium. No existing database, login,
// provider credentials, or public application is used. Faults are injected only
// into synthetic rows or a loopback browser response, never production handlers.
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'scout-flow-proof-'));
const proof = { head, startedAt: new Date().toISOString(), scope: 'Production-built Scout, real Express/session/auth and fresh native PostgreSQL; loopback-only synthetic users; controlled database and response faults', passed: false, checks: [], journeys: [] };
const base = 'https://127.0.0.1:5448';
const backend = 'http://127.0.0.1:5238';
let database, sql, child, proxy, browser, serverLog, runtimeCopy = false;
const secrets = [];
function redact(value) {
  let text = String(value).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[SYNTHETIC_DATABASE]');
  for (const secret of secrets) if (secret) text = text.replaceAll(secret, '[SYNTHETIC_SECRET]');
  return text;
}
function run(name, args, environment = {}) {
  const result = spawnSync(args[0], args.slice(1), { env: { ...process.env, ...environment }, encoding: 'utf8', timeout: 600000, maxBuffer: 50 * 1024 * 1024 });
  const output = redact((result.stdout || '') + (result.stderr || ''));
  console.log(output);
  proof.checks.push({ name, status: result.status, passed: result.status === 0 });
  console.log('SCOUT_FLOW_CHECK ' + JSON.stringify(proof.checks.at(-1)));
  assert.equal(result.status, 0, name + ': ' + output.slice(-2000));
}
async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null || child.signalCode) break;
    try {
      const response = await fetch(backend + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.commit, head);
        assert.equal(health.database, 'connected');
        assert.equal(health.migrations?.compatibility, 'compatible');
        proof.health = health;
        return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Actual compiled application did not become healthy');
}
async function stopChild() {
  if (!child || child.exitCode !== null || child.signalCode) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Use a clean exact-source checkout');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'STRIPE_SECRET_KEY', 'SENDGRID_API_KEY', 'RESEND_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY']) assert(!process.env[key], key + ' must not be inherited');
  assert(await fs.stat('dist/index.js').then(() => true, () => false), 'Build the production application first');
  proof.bundleSha256 = createHash('sha256').update(await fs.readFile('dist/index.js')).digest('hex');
  assert.equal(await fs.stat('runtime/database-url-security.mjs').then(() => true, () => false), false);
  await fs.copyFile('shared/database-url-security.mjs', 'runtime/database-url-security.mjs'); runtimeCopy = true;
  database = await startCabinetLoopbackTestDatabase(); proof.database = database.evidence;
  sql = new pg.Client({ connectionString: database.url }); await sql.connect();
  const cert = path.join(temp, 'server.crt'), key = path.join(temp, 'server.key');
  run('Ephemeral loopback TLS certificate', ['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1']);
  await fs.chmod(key, 0o600);
  await sql.query("ALTER SYSTEM SET ssl_cert_file = '" + cert.replaceAll("'", "''") + "'");
  await sql.query("ALTER SYSTEM SET ssl_key_file = '" + key.replaceAll("'", "''") + "'");
  await sql.query("ALTER SYSTEM SET ssl = 'on'"); await sql.query('SELECT pg_reload_conf()');
  await new Promise(resolve => setTimeout(resolve, 500));
  const url = new URL(database.url); url.searchParams.set('sslmode', 'verify-full'); url.searchParams.set('sslrootcert', cert);
  const environment = { NODE_ENV: 'production', DATABASE_URL: url.href };
  run('Fresh native production-mode migrations', ['npm', 'run', 'db:migrate'], environment);
  run('Independent required production schema', ['npm', 'run', 'db:verify:required'], environment);
  await sql.query(`CREATE TABLE scout_execution_proof_writes (id bigserial PRIMARY KEY, user_id text NOT NULL, first_name text);
    CREATE FUNCTION scout_execution_proof_observe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.email LIKE 'scout-execution-%@example.invalid' THEN
        IF NEW.first_name = 'Failurecase' THEN RAISE EXCEPTION 'Synthetic profile write failure'; END IF;
        INSERT INTO scout_execution_proof_writes(user_id, first_name) VALUES(NEW.id, NEW.first_name);
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER scout_execution_proof_update BEFORE UPDATE OF first_name ON users FOR EACH ROW EXECUTE FUNCTION scout_execution_proof_observe();`);
  const sessionSecret = randomBytes(48).toString('hex'); secrets.push(sessionSecret);
  serverLog = await fs.open(path.join(temp, 'application.private.log'), 'w', 0o600);
  child = spawn(process.execPath, ['dist/index.js'], { env: {
    PATH: process.env.PATH, HOME: temp, TMPDIR: temp, ...environment,
    SESSION_SECRET: sessionSecret, SESSION_COOKIE_DOMAIN: '127.0.0.1', PORT: '5238', HOST: '127.0.0.1',
    PUBLIC_WEB_URL: base, CORS_ALLOWED_ORIGINS: base, RENDER: 'false', GIT_COMMIT: head,
    NODE_OPTIONS: '--max-old-space-size=4096', EMAIL_MODE: 'account_creation_only', DISABLE_FACEBOOK_AUTH: 'true',
  }, stdio: ['ignore', serverLog.fd, serverLog.fd] });
  await waitForServer();
  proxy = https.createServer({ key: await fs.readFile(key), cert: await fs.readFile(cert) }, (request, response) => {
    const upstream = http.request(backend + request.url, { method: request.method, headers: { ...request.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' } }, incoming => {
      response.writeHead(incoming.statusCode || 502, incoming.headers); incoming.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end('Loopback upstream unavailable'); });
    request.pipe(upstream);
  });
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(5448, '127.0.0.1', resolve); });
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const cases = [['cancel', 'Cancelledcase'], ['approve', 'Approvedcase'], ['database-failure', 'Failurecase'], ['lost-acknowledgement', 'Lostack'], ['authorization-only', 'Unconfirmedcase']];
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    for (const [scenario, firstName] of cases) {
      const email = `scout-execution-${device}-${scenario}@example.invalid`, password = randomBytes(24).toString('hex'); secrets.push(password);
      run(`Seed synthetic ${device} ${scenario} user`, [process.execPath, '--import', 'tsx', 'scripts/seed-e2e-user.ts'], { ...environment, E2E_EMAIL: email, E2E_PASSWORD: password });
      const user = (await sql.query('SELECT id, first_name FROM users WHERE email=$1', [email])).rows[0]; assert(user?.id);
      await sql.query('DELETE FROM scout_execution_proof_writes WHERE user_id=$1', [user.id]);
      const context = await browser.newContext({ viewport, isMobile: device === 'mobile', hasTouch: device === 'mobile', ignoreHTTPSErrors: true, serviceWorkers: 'block' });
      const errors = [], deniedExternal = [], handlerErrors = []; let actionRequests = 0;
      await context.route('**/*', route => {
        const target = new URL(route.request().url());
        if (!['127.0.0.1', 'localhost'].includes(target.hostname)) { deniedExternal.push(target.hostname); return route.abort('blockedbyclient'); }
        return route.continue();
      });
      const login = await context.request.post(base + '/api/auth/login', { data: { email, password }, headers: { Origin: base } });
      assert.equal(login.status(), 200, 'Real synthetic account login: ' + (await login.text()).slice(0, 600));
      const auth = await context.request.get(base + '/api/auth/user');
      assert.equal(auth.status(), 200, 'Real session cookie must authenticate');
      const identity = await auth.json();
      assert.equal(identity?.id ?? identity?.user?.id, user.id, 'The real session must belong to the seeded account, not a guest');
      const page = await context.newPage(); page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
      await page.addLocatorHandler(page.getByRole('dialog', { name: 'What do you want to get done?' }), async () => {
        await page.getByRole('button', { name: 'Close Start here guide', exact: true }).click();
      });
      await page.route('**/api/scout/execute-action', async route => {
        actionRequests++;
        try {
          const submitted = route.request().postDataJSON(); assert.equal(submitted.action.type, 'SAVE_PROFILE');
          if (scenario === 'authorization-only') return await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, authorized: true, executed: false }) });
          if (scenario === 'lost-acknowledgement') {
            const actual = await route.fetch({ maxRetries: 0 });
            assert.equal(actual.status(), 200); assert.equal((await actual.json()).executed, true);
            return await route.abort('failed');
          }
          await route.continue();
        } catch (error) { handlerErrors.push(String(error)); await route.abort('failed').catch(() => {}); }
      });
      try {
        const document = await page.goto(base + '/scout', { waitUntil: 'domcontentloaded', timeout: 60000 }); assert(document?.ok());
        const input = page.locator('textarea:visible').first(); await input.waitFor();
        await input.fill(`Set my name to ${firstName} Tester`);
        const answer = page.waitForResponse(response => new URL(response.url()).pathname === '/api/scout' && response.request().method() === 'POST');
        await input.press('Enter'); const scoutResponse = await answer; assert.equal(scoutResponse.status(), 200);
        const saveButton = page.getByRole('button', { name: 'Save profile update', exact: true }).first(); await saveButton.waitFor();
        let dialogSeen = false;
        page.once('dialog', async dialog => { dialogSeen = true; scenario === 'cancel' ? await dialog.dismiss() : await dialog.accept(); });
        await saveButton.click();
        if (scenario === 'approve') await page.getByText('Saved. Your profile has been updated.', { exact: true }).waitFor();
        else if (scenario === 'cancel') await page.getByText('Cancelled. This action was not submitted.', { exact: true }).waitFor();
        else await page.getByText(/Scout could not confirm/).first().waitFor();
        assert.equal(dialogSeen, true);
        await page.waitForTimeout(1000);
        const body = await page.locator('body').innerText();
        assert.equal(body.includes('Saved. Your profile has been updated.'), scenario === 'approve');
        const persisted = (await sql.query('SELECT first_name FROM users WHERE id=$1', [user.id])).rows[0].first_name;
        const writes = Number((await sql.query('SELECT count(*) AS n FROM scout_execution_proof_writes WHERE user_id=$1', [user.id])).rows[0].n);
        const committed = scenario === 'approve' || scenario === 'lost-acknowledgement';
        assert.equal(persisted, committed ? firstName : user.first_name);
        assert.equal(writes, committed ? 1 : 0);
        assert.equal(actionRequests, scenario === 'cancel' ? 0 : 1);
        assert.deepEqual(handlerErrors, []); assert.deepEqual(errors, []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
        const screenshot = await page.screenshot({ fullPage: true });
        const entry = { device, scenario, passed: true, actionRequests, committedWrites: writes, savedAcknowledgement: scenario === 'approve', actualProfilePersisted: committed, pageErrors: errors.length, horizontalOverflow: false, blockedExternalHosts: [...new Set(deniedExternal)], screenshotSha256: createHash('sha256').update(screenshot).digest('hex') };
        proof.journeys.push(entry); console.log('SCOUT_FLOW_JOURNEY ' + JSON.stringify(entry));
      } catch (error) {
        proof.failedJourney = { device, scenario, actionRequests, pageErrors: errors, handlerErrors, url: page.url(), visibleText: redact((await page.locator('body').innerText().catch(() => '')).slice(-8000)) };
        throw error;
      } finally { await context.close(); }
    }
  }
  const guest = await browser.newContext({ ignoreHTTPSErrors: true });
  const rejected = await guest.request.post(base + '/api/scout/execute-action', { headers: { Origin: base }, data: { action: { type: 'SAVE_PROFILE', payload: { profilePatch: { firstName: 'Unauthorized' } } } } });
  assert.equal(rejected.status(), 401); await guest.close();
  proof.guestUnauthorized = true;
  assert.equal(createHash('sha256').update(await fs.readFile('dist/index.js')).digest('hex'), proof.bundleSha256, 'Production bundle must remain unmodified');
  proof.passed = true;
} catch (error) {
  proof.error = redact(error.stack || error);
  console.error('SCOUT_FLOW_FAILURE ' + proof.error);
  if (serverLog) console.error('SCOUT_FLOW_APPLICATION_TAIL ' + redact((await fs.readFile(path.join(temp, 'application.private.log'), 'utf8')).slice(-10000)));
} finally {
  await browser?.close();
  await stopChild();
  if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
  await serverLog?.close(); await sql?.end(); await database?.stop();
  if (runtimeCopy) await fs.rm('runtime/database-url-security.mjs');
  proof.finishedAt = new Date().toISOString();
  proof.finalSourceStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (proof.finalSourceStatus) proof.passed = false;
  console.log('SCOUT_FLOW_SUMMARY ' + JSON.stringify(proof));
  await fs.rm(temp, { recursive: true, force: true });
}
assert.equal(proof.passed, true, 'Scout browser/native execution proof failed; this is not release approval');
