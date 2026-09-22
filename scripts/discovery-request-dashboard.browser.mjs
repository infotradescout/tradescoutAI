import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { build } from 'esbuild';
import express from 'express';
import { chromium } from 'playwright';

const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'request-dashboard-browser-'));
const output = path.resolve(process.env.REQUEST_DASHBOARD_BROWSER_OUTPUT || 'test-results/request-dashboard');
await fs.mkdir(output, { recursive: true });
const result = { passed: false, scope: 'Whole admin Discovery wrapper and actual components with production CSS, intercepted API fixtures and isolated loopback HTTP only. No production login, database writes or audience events.', cases: [] };
let server, browser;
try {
  await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query'; import Page from './client/src/pages/admin-discovery-observatory'; const client=new QueryClient({defaultOptions:{queries:{retry:false}}}); createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Page/></QueryClientProvider>);`, resolveDir: root, sourcefile: 'request-dashboard-entry.tsx', loader: 'tsx' }, bundle: true, outfile: path.join(temp, 'entry.js'), platform: 'browser', format: 'esm', jsx: 'automatic', alias: { '@': path.join(root, 'client/src'), '@shared': path.join(root, 'shared') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"PROD":true,"DEV":false,"MODE":"production"}' } });
  const assets = path.join(root, 'dist/public/assets');
  const styles = (await fs.readdir(assets)).filter(name => name.endsWith('.css'));
  assert(styles.length > 0, 'Production CSS must exist before browser validation');
  const app = express();
  app.get('/__qa/entry.js', (_req, res) => res.type('js').sendFile(path.join(temp, 'entry.js')));
  app.use('/assets', express.static(assets));
  app.get('/__qa', (_req, res) => res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map(name => `<link rel="stylesheet" href="/assets/${name}">`).join('')}</head><body style="background:#111827;margin:0"><main style="max-width:1400px;margin:auto;padding:16px"><div id="root"></div></main><script type="module" src="/__qa/entry.js"></script></body></html>`));
  server = await new Promise(resolve => { const owned = app.listen(0, '127.0.0.1', () => resolve(owned)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    let mode = 'ok'; let apiCalls = 0; const errors = [], blocked = [];
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin || !['GET', 'HEAD'].includes(req.method())) { blocked.push({ method: req.method(), path: url.pathname }); return route.abort('blockedbyclient'); }
      if (url.pathname === '/api/admin/discovery-observatory/request-stages') {
        apiCalls++; await new Promise(resolve => setTimeout(resolve, 250));
        if (mode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture database unavailable' }) });
        const report = { schema_version: 1, window: { from: url.searchParams.get('from'), to: url.searchParams.get('to') }, created_requests: 3, linked_created_requests: 3, unlinked_created_requests: 0, requests_with_conflicting_creation_attribution: 0, linked_submitted_requests: 3, requests_with_provider_response: 1, requester_confirmed_completions: 0, source_groups: [{ source_group: 'search_labeled', linked_created_requests: 3, linked_submitted_requests: 3, requests_with_provider_response: 1, requester_confirmed_completions: 0 }], qualified_requests: null, verified_unique_people: null, search_console_impressions: null, search_console_clicks: null };
        if (mode === 'malformed') delete report.created_requests;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report, generatedAt: new Date().toISOString() }) });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Unrelated evidence fixture unavailable' }) });
      return route.continue();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/__qa', { waitUntil: 'domcontentloaded' });
    const panel = page.getByTestId('admin-request-stages');
    await panel.getByRole('status').waitFor();
    assert.equal(await panel.getByTestId('request-stages-results').count(), 0, 'Loading must not invent zero results');
    await panel.getByTestId('request-stages-results').waitFor({ state: 'visible' });
    assert.match(await panel.innerText(), /Qualified requests: unavailable/);
    assert.match(await panel.innerText(), /Includes declines; not a hire/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(output, `request-stages-${width}.png`), fullPage: true });
    await page.getByLabel('From (UTC)', { exact: true }).fill('2026-08-24');
    await page.getByRole('tab', { name: 'Discovery evidence', exact: true }).click();
    await page.getByTestId('admin-discovery-observatory-v2').waitFor({ state: 'visible' });
    await page.getByRole('tab', { name: 'Request outcomes', exact: true }).click();
    assert.equal(await page.getByLabel('From (UTC)', { exact: true }).inputValue(), '2026-08-24', 'Draft filters survive switching reporting views');
    await page.getByLabel('Through (UTC, inclusive)', { exact: true }).fill('2026-09-20');
    const beforeApply = apiCalls;
    await panel.getByRole('button', { name: 'Apply dates', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="request-stages-results"]')?.textContent.includes('2026-08-24T00:00:00.000Z to 2026-09-21T00:00:00.000Z'));
    assert(apiCalls >= beforeApply);
    mode = 'error'; await panel.getByRole('button', { name: 'Refresh outcomes', exact: true }).click();
    await panel.getByRole('button', { name: 'Retry outcomes', exact: true }).waitFor();
    assert.equal(await panel.getByTestId('request-stages-results').count(), 0, 'A failed refresh must hide stale counts');
    mode = 'ok'; await panel.getByRole('button', { name: 'Retry outcomes', exact: true }).click();
    await panel.getByTestId('request-stages-results').waitFor({ state: 'visible' });
    mode = 'malformed'; await panel.getByRole('button', { name: 'Refresh outcomes', exact: true }).click();
    await panel.getByRole('button', { name: 'Retry outcomes', exact: true }).waitFor();
    assert.equal(await panel.getByTestId('request-stages-results').count(), 0, 'Malformed counts stay unavailable');
    mode = 'ok'; await panel.getByRole('button', { name: 'Retry outcomes', exact: true }).click();
    await panel.getByTestId('request-stages-results').waitFor({ state: 'visible' });
    await page.getByLabel('Through (UTC, inclusive)', { exact: true }).fill('2099-01-01');
    const beforeInvalid = apiCalls; await panel.getByRole('button', { name: 'Apply dates', exact: true }).click();
    await panel.getByRole('alert').filter({ hasText: 'Choose 1–90 complete UTC days' }).waitFor();
    assert.equal(apiCalls, beforeInvalid, 'Invalid date windows must not reach the API');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    result.cases.push({ width, passed: true, apiCalls, loadingNoFakeZeros: true, validDateWindow: true, dateDraftPreservedAcrossTabs: true, failedRefreshHidesStaleCounts: true, retry: true, malformedPayloadRejected: true, invalidDatesNoRequest: true, horizontalOverflow: false, pageErrors: errors });
    console.log('REQUEST_DASHBOARD_BROWSER_CASE ' + JSON.stringify(result.cases.at(-1)));
    await context.close();
  }
  result.passed = true;
} catch (error) { result.error = String(error.stack || error); process.exitCode = 1; }
finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
  await fs.writeFile(path.join(output, 'browser-evidence.json'), JSON.stringify(result, null, 2));
  console.log('REQUEST_DASHBOARD_BROWSER_SUMMARY ' + JSON.stringify(result));
}
