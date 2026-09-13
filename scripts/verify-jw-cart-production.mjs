import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** Post-deploy smoke only. This never creates users, requests, holds or payments. */
export async function verifyJwCartProduction(expected) {
  assert.match(expected, /^[a-f0-9]{40}$/, 'An exact deployed commit is required');
  const origin = 'https://www.thetradescout.com';
  const output = path.resolve('test-results/jw-cart-release');
  const report = {
    scope: 'production-public-read-only', expected,
    verifierSource: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    startedAt: new Date().toISOString(), checks: [], passed: false,
    authenticatedShoppingTested: false, productionWrites: false,
  };
  async function get(route) {
    const url = new URL(route, origin);
    assert.equal(url.origin, origin);
    const response = await fetch(url, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0 TradeScoutReadOnlyReleaseCheck' },
    });
    return { response, text: await response.text() };
  }
  function record(name, detail = {}) { report.checks.push({ name, ...detail, passed: true }); }
  try {
    const { response, text } = await get('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-tradescout-build'), expected);
    const health = JSON.parse(text);
    assert.equal(health.commit, expected); assert.equal(health.status, 'healthy');
    assert.equal(health.database, 'connected');
    assert.equal(health.migrations?.compatibility, 'compatible');
    assert.equal(health.migrations?.requiredSchemaOk, true);
    assert.equal(health.migrations?.appliedCount, health.migrations?.expectedCount);
    record('Exact healthy deployed commit and compatible schema', {
      commit: health.commit, database: health.database, migrations: health.migrations,
    });
    const version = await get('/api/version'); assert.equal(version.response.status, 200);
    const versionBody = JSON.parse(version.text);
    assert.equal(versionBody.commit || versionBody.buildRevision, expected);
    record('Version endpoint identifies the release');
    let pageRoute = '/u/jw-stone';
    let page;
    const redirects = [];
    for (let hop = 0; hop < 4; hop++) {
      page = await get(pageRoute);
      if (![301, 302, 307, 308].includes(page.response.status)) break;
      const location = page.response.headers.get('location');
      assert(location, 'A redirect must identify its destination');
      const destination = new URL(location, origin + pageRoute);
      assert.equal(destination.origin, origin, 'Never follow a cross-origin release-check redirect');
      assert(['/u/jw-stone', '/jw-stone'].includes(destination.pathname.replace(/\/$/, '')), 'JW entry must remain on its own profile');
      redirects.push({ from: pageRoute, status: page.response.status, to: destination.pathname });
      pageRoute = destination.pathname + destination.search;
    }
    assert(page); assert.equal(page.response.status, 200);
    assert.equal(page.response.headers.get('x-tradescout-build'), expected);
    assert(!/slabPriceCents|landedCostCents/.test(page.text), 'Anonymous page must not embed protected prices');
    record('Public JW Stone entry serves the release without protected prices', { pageRoute, redirects });
    const assets = [...new Set([...page.text.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(match => match[1]))];
    assert(assets.length > 0 && assets.length <= 20, 'Expected a bounded public application asset set');
    for (const asset of assets) {
      const fetched = await get(asset);
      assert.equal(fetched.response.status, 200, 'Public application asset: ' + asset);
      assert(!/^\s*<!doctype html/i.test(fetched.text), 'An application asset must not return fallback HTML');
    }
    record('Public application assets load', { count: assets.length });
    const pricing = await get('/api/u/jw-stone/member-pricing');
    assert.equal(pricing.response.status, 401);
    assert(!/slabPriceCents|bundlePriceCents|landedCostCents/.test(pricing.text));
    record('Anonymous private-pricing request is denied without prices');
    report.passed = true;
  } catch (error) { report.error = String(error.stack || error); }
  report.finishedAt = new Date().toISOString();
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>Production public read-only checks</h1><p>' + (report.passed ? 'Passed for ' + expected : 'FAILED — see evidence') + '</p><p>No authenticated shopping or live customer writes performed.</p><a href="evidence.json">Evidence</a>');
  await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  console.log('JW_CART_PRODUCTION_SUMMARY ' + JSON.stringify(report));
  assert.equal(report.passed, true, 'Public production verification failed');
}
