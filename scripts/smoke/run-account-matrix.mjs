import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { newLedger, recordCase, finishLedger, smokeProofClientId } from './account-matrix.mjs';
import { provisionAccounts } from './provision-accounts.mjs';

/** Called inside the EXISTING fresh-database driver, never against a deployed site. */
export async function runSmokeAccountMatrix({ base, sql, environment, proof, secrets, redact }) {
  const ledger = newLedger(proof.head);
  const runId = randomBytes(8).toString('hex');
  const artifactDirectory = path.resolve('test-results/scout-smoke-accounts', runId);
  await fs.mkdir(artifactDirectory, { recursive: true, mode: 0o700 });
  proof.smokeAccounts = ledger;
  let browser;
  try {
    const accounts = await provisionAccounts({ sql, base, environment, ledger, runId,
      hashPasswords: async passwords => {
        secrets.push(...passwords);
        const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/smoke/hash-passwords.ts'], {
          input: JSON.stringify(passwords), encoding: 'utf8', timeout: 120000,
          maxBuffer: 1024 * 1024,
          env: { PATH: process.env.PATH, HOME: process.env.HOME, ...environment },
        });
        assert.equal(result.status, 0, 'Canonical credential hashing failed; no accounts inserted');
        const line = result.stdout.split('\n').find(value => value.startsWith('SCOUT_SMOKE_HASHES '));
        assert(line, 'No canonical hash result');
        return JSON.parse(line.slice('SCOUT_SMOKE_HASHES '.length));
      },
    });
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    // Sequential by design: independent accounts are not a load test, and 429s
    // are recorded as failures, not bypassed with retries or disabled middleware.
    for (const [ordinal, actor] of accounts.entries()) {
      const context = await browser.newContext({
        viewport: { width: actor.viewport.width, height: actor.viewport.height },
        isMobile: actor.viewport.name === 'mobile', hasTouch: actor.viewport.name === 'mobile',
        ignoreHTTPSErrors: true, serviceWorkers: 'block',
        extraHTTPHeaders: { 'x-scout-proof-client': smokeProofClientId(ordinal) },
      });
      const pageErrors = [], blockedHosts = new Set();
      const other = accounts.find(account => account.id !== actor.id && account.viewport.name === actor.viewport.name);
      const observed = [];
      const check = async (journey, callback) => {
        let assertionCount = 0;
        const expect = (condition, description) => {
          assert(condition, description);
          assertionCount++;
        };
        try {
          await callback(expect);
          recordCase(ledger, actor, journey, assertionCount);
        } catch (error) {
          recordCase(ledger, actor, journey, assertionCount, redact(error.message));
        }
      };
      const call = async (method, route, data) => {
        assert(route.startsWith('/api/') && !route.includes('://'));
        const response = await context.request.fetch(`${base}${route}`, {
          method, ...(data ? { data } : {}), headers: { Origin: base },
          maxRedirects: 0, timeout: 15000,
        });
        observed.push({ method, path: route.split('?')[0], status: response.status() });
        return response;
      };
      try {
        await context.route('**/*', route => {
          const target = new URL(route.request().url());
          if (target.origin !== base) {
            blockedHosts.add(target.hostname);
            return route.abort('blockedbyclient');
          }
          return route.continue();
        });
        await check('wrong-password-denied', async expect => {
          const response = await call('POST', '/api/auth/login', { email: actor.email, password: 'incorrect-smoke-password' });
          expect([400, 401, 403].includes(response.status()), 'Incorrect credentials must not create a session');
          expect((await call('GET', '/api/scout/work')).status() === 401, 'Incorrect login must not expose private work');
        });
        await check('correct-password-owner', async expect => {
          const response = await call('POST', '/api/auth/login', { email: actor.email, password: actor.password });
          expect(response.status() === 200, 'Valid seeded identity should establish its own session');
          const current = await call('GET', '/api/auth/user');
          expect(current.status() === 200, 'Session owner must be readable');
          const identity = await current.json();
          expect((identity.id ?? identity.user?.id) === actor.id, 'The real session must belong to the seeded actor');
        });
        await check('private-work-owner-override', async expect => {
          const response = await call('GET', `/api/scout/work?ownerId=${encodeURIComponent(other.id)}`);
          expect(response.status() === 200, 'Authenticated work read should succeed');
          const overview = await response.json();
          expect(overview.ownerId === actor.id, 'Query owner override must be ignored');
          expect(/private.*no-store/.test(response.headers()['cache-control'] || ''), 'Private data must not enter shared caches');
        });
        await check('private-work-response-shape', async expect => {
          const response = await call('GET', '/api/scout/work');
          expect(response.status() === 200, 'Private work should be available');
          const overview = await response.json();
          expect(overview.contractVersion === 'scout_work.v1', 'Expected canonical work contract');
          expect(overview.ownerId === actor.id, 'Response owner must match');
          expect(Array.isArray(overview.sections) && overview.sections.length === 4, 'All four owned areas must be represented');
          expect(overview.sections.every(section => section.availability === 'ready' && section.items.length <= 8), 'No silent unavailable source or unbounded result');
        });
        const page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        await check('scout-browser-entry', async expect => {
          const response = await page.goto(`${base}/scout`, { waitUntil: 'domcontentloaded', timeout: 45000 });
          expect(response?.ok(), 'The actual Scout document must load');
          await page.locator('textarea:visible, [data-testid="scout-work-panel"]:visible').first().waitFor({ timeout: 15000 });
          expect(pageErrors.length === 0, 'No browser JavaScript errors');
          expect(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)), 'No horizontal overflow');
          ledger.browserJourneysExecuted++;
          await page.screenshot({ path: path.join(artifactDirectory, `${actor.viewport.name}-${actor.name}.png`), fullPage: true });
        });
        await check('session-reload-owner', async expect => {
          const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
          expect(response?.ok(), 'Reload should load the same application');
          const current = await call('GET', '/api/auth/user');
          expect(current.status() === 200, 'Authenticated session should survive page reload');
          const identity = await current.json();
          expect((identity.id ?? identity.user?.id) === actor.id, 'Reload must not switch account identity');
        });
        await check('logout-private-work-denied', async expect => {
          const response = await call('POST', '/api/auth/logout');
          expect([200, 204].includes(response.status()), 'Explicit logout should succeed');
          expect((await call('GET', `/api/scout/work?ownerId=${actor.id}`)).status() === 401, 'Logged-out session must lose private access');
        });
        ledger.accounts.find(account => account.id === actor.id).observed = { http: observed,
          blockedExternalHosts: [...blockedHosts], pageErrors: pageErrors.map(redact) };
      } finally {
        await context.close();
      }
    }
  } catch (error) {
    ledger.setupError = redact(error.message);
  } finally {
    await browser?.close();
    finishLedger(ledger);
    ledger.artifactDirectory = path.relative(process.cwd(), artifactDirectory);
    // This reports ACTUAL zero or partial execution as such. Planned cases cannot pass.
    await fs.writeFile(path.join(artifactDirectory, 'evidence.json'), JSON.stringify(ledger, null, 2), { mode: 0o600 });
    console.log('SCOUT_SMOKE_ACCOUNT_MATRIX ' + JSON.stringify(ledger));
  }
  assert(ledger.coreMatrixPassed, 'Smoke-account core matrix incomplete or failed; inspect evidence');
}
