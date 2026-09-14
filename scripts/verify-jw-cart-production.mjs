import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const PLATFORM = 'https://www.thetradescout.com';
const JW = 'https://jwstonelogistics.com';
const JW_WWW = 'https://www.jwstonelogistics.com';
const STOREFRONT_PATHS = new Map([
  [PLATFORM, new Set(['/u/jw-stone', '/jw-stone'])],
  [JW, new Set(['/'])], [JW_WWW, new Set(['/'])],
]);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/** Fixed public origins and paths; injectable transport is only for isolated regression tests. */
export async function inspectJwCartProduction(expected, record, fetchImpl = fetch) {
  assert.match(expected, /^[a-f0-9]{40}$/, 'An exact deployed commit is required');
  async function get(url) {
    assert([PLATFORM, JW, JW_WWW].includes(url.origin), 'Unexpected public verification origin');
    const response = await fetchImpl(url, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0 TradeScoutReadOnlyReleaseCheck' },
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length <= 8 * 1024 * 1024, 'Public response exceeds the verification bound');
    return { response, bytes, text: bytes.toString('utf8'), url };
  }
  async function exactBackend(origin) {
    const { response, text } = await get(new URL('/api/health', origin));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-tradescout-build'), expected);
    const health = JSON.parse(text);
    assert.equal(health.commit, expected); assert.equal(health.status, 'healthy');
    assert.equal(health.database, 'connected');
    assert.equal(health.migrations?.compatibility, 'compatible');
    assert.equal(health.migrations?.requiredSchemaOk, true);
    assert.equal(health.migrations?.appliedCount, health.migrations?.expectedCount);
    assert(Number.isInteger(health.migrations?.expectedCount) && health.migrations.expectedCount > 0);
    const version = await get(new URL('/api/version', origin));
    assert.equal(version.response.status, 200);
    assert.equal(version.response.headers.get('x-tradescout-build'), expected);
    const versionBody = JSON.parse(version.text);
    assert.equal(versionBody.commit || versionBody.buildRevision, expected);
    record('Exact healthy deployed commit, compatible schema, and version', {
      origin, commit: health.commit, database: health.database, migrations: health.migrations,
    });
  }
  async function storefront(start) {
    let url = new URL(start);
    const redirects = [], seen = new Set();
    for (;;) {
      assert(STOREFRONT_PATHS.get(url.origin)?.has(url.pathname) && !url.search && !url.hash && !url.username && !url.password,
        'Storefront redirect must remain on an explicitly allowed JW route');
      assert(!seen.has(url.href), 'Storefront redirect loop'); seen.add(url.href);
      const page = await get(url);
      if (!REDIRECTS.has(page.response.status)) {
        assert.equal(page.response.status, 200);
        assert(url.origin === PLATFORM ? url.pathname === '/jw-stone' : url.pathname === '/', 'Legacy profile must redirect to the marketplace');
        assert.match(page.response.headers.get('content-type') || '', /^text\/html\b/i);
        const build = page.response.headers.get('x-tradescout-build');
        if (build !== null) assert.equal(build, expected);
        else {
          // The public custom-domain HTML can omit the build header.
          // Exact custom API and cross-host asset evidence below remain mandatory.
          assert(url.origin === JW || url.origin === JW_WWW, 'Platform HTML requires its build header');
          assert(/window\.__TS_JW_STONE_MARKETPLACE_SURFACE__\s*=\s*true\s*;/.test(page.text));
          assert(/window\.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__\s*=\s*["']jw-stone["']\s*;/.test(page.text));
        }
        assert(!/slabPriceCents|bundlePriceCents|landedCostCents/.test(page.text), 'Anonymous page must not embed protected prices');
        record('Public JW entry reaches the marketplace without protected prices', { entry: start, finalUrl: url.href, redirects, htmlBuildHeader: build });
        return page;
      }
      assert(redirects.length < 3, 'Too many storefront redirects');
      const location = page.response.headers.get('location'); assert(location, 'Missing storefront redirect location');
      const next = new URL(location, url);
      redirects.push({ from: url.href, status: page.response.status, to: next.href });
      url = next;
    }
  }
  await exactBackend(PLATFORM);
  await exactBackend(JW);
  const page = await storefront(new URL('/u/jw-stone', PLATFORM).href);
  if (page.url.origin === JW_WWW) await exactBackend(JW_WWW);
  const custom = page.url.origin === JW ? page : await storefront(JW + '/');
  for (const rendered of page === custom ? [page] : [page, custom]) {
    const assets = [...new Set([...rendered.text.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(match => match[1]))];
    assert(assets.length > 0 && assets.length <= 20 && assets.some(asset => asset.endsWith('.js')) && assets.some(asset => asset.endsWith('.css')),
      'Expected a bounded public application script and stylesheet set');
    const evidence = [];
    for (const asset of assets) {
      assert.match(asset, /^\/assets\/[a-zA-Z0-9_-]+\.(?:js|css)$/, 'Unexpected application asset path');
      const origins = [...new Set([PLATFORM, rendered.url.origin])];
      const fetched = await Promise.all(origins.map(origin => get(new URL(asset, origin))));
      for (const item of fetched) {
        assert.equal(item.response.status, 200, 'Public application asset: ' + item.url.href);
        assert.equal(item.response.headers.get('x-tradescout-build'), expected, 'Application asset must identify the exact release');
        assert.match(item.response.headers.get('content-type') || '', asset.endsWith('.css') ? /^text\/css\b/i : /^(?:application|text)\/javascript\b/i);
        assert(!/^\s*<!doctype html/i.test(item.text), 'An application asset must not return fallback HTML');
      }
      const hashes = fetched.map(item => createHash('sha256').update(item.bytes).digest('hex'));
      assert(hashes.every(hash => hash === hashes[0]), 'Custom-domain asset bytes must match the canonical release: ' + asset);
      evidence.push({ asset, sha256: hashes[0], origins });
    }
    record('Marketplace assets identify and match the exact canonical release', { origin: rendered.url.origin, assets: evidence });
  }
  for (const origin of new Set([PLATFORM, JW, page.url.origin])) {
    const pricing = await get(new URL('/api/u/jw-stone/member-pricing', origin));
    assert.equal(pricing.response.status, 401);
    assert(!/slabPriceCents|bundlePriceCents|landedCostCents/.test(pricing.text));
    record('Anonymous private-pricing request is denied without prices', { origin });
  }
}

/** Post-deploy smoke only. This never creates users, requests, holds or payments. */
export async function verifyJwCartProduction(expected) {
  assert.match(expected, /^[a-f0-9]{40}$/, 'An exact deployed commit is required');
  const output = path.resolve('test-results/jw-cart-release');
  const report = {
    scope: 'production-public-read-only', expected,
    verifierSource: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    startedAt: new Date().toISOString(), checks: [], passed: false,
    authenticatedShoppingTested: false, productionWrites: false,
  };
  function record(name, detail = {}) { report.checks.push({ name, ...detail, passed: true }); }
  try {
    await inspectJwCartProduction(expected, record);
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
