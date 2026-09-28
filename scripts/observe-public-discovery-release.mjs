import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const expected = String(process.env.PUBLIC_DISCOVERY_OBSERVE_SHA || '');
assert.equal(expected, '86e1d001f3b7e55d65c7c00561932cb33fb0412f', 'Reviewed merged release required');
const output = path.resolve(process.env.SEARCH_SURFACE_OUTPUT || '.search-proof');
fs.mkdirSync(output, { recursive: true });
const proof = { expectedCommit: expected, startedAt: new Date().toISOString(), mode: 'public GET only; no credentials, submissions, customer actions or database access', observations: [], result: 'fail', indexingConfirmed: false, acquisitionMeasured: false };
const sha = text => createHash('sha256').update(text).digest('hex');
const element = (html, regex) => html.match(regex)?.[1] || null;
async function read(url) {
  const response = await fetch(url, { method: 'GET', headers: { 'user-agent': 'TradeScout-public-release-check/1.0', 'cache-control': 'no-cache' }, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const text = await response.text();
  assert(text.length < 4000000, 'Unexpected public response size');
  return { response, text };
}
// Preserve the existing exact-candidate release receipt when this static output is republished.
try {
  const archive = await read('https://tradescout-search-surface-proof.onrender.com/candidate-evidence.json');
  const receipt = JSON.parse(archive.text);
  assert.equal(archive.response.status, 200);
  assert.equal(receipt.candidate, '6fc13c7c6dd6c577d0d74e03b31e928c400ce3d6');
  assert.equal(receipt.result, 'pass');
  fs.writeFileSync(path.join(output, 'candidate-evidence.json'), archive.text);
  proof.archivedCandidateReceiptSha256 = sha(archive.text);
} catch (error) { proof.archiveWarning = error.message; }
try {
  const origin = 'https://www.thetradescout.com';
  const health = await read(`${origin}/api/health?discovery_release=${expected}`);
  const body = JSON.parse(health.text);
  proof.health = { status: health.response.status, commit: body.commit, version: body.version, migrations: body.migrations, database: body.database };
  assert.equal(health.response.status, 200);
  assert.equal(body.commit, expected, 'Production must identify the reviewed merge');
  for (const pathname of ['/maps', '/county-directory']) {
    const { response, text } = await read(`${origin}${pathname}?discovery_release=${expected}`);
    const row = { url: origin + pathname, status: response.status, title: element(text, /<title[^>]*>([\s\S]*?)<\/title>/i), heading: element(text, /<h1[^>]*>([\s\S]*?)<\/h1>/i), canonicals: [...text.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]), readableFirstResponse: text.includes('data-public-information-page="true"'), applicationAssetsRetained: text.includes('/assets/'), hasDirectoryLink: text.includes('href="/find-local-businesses"'), oldStartupPlaceholder: text.includes('id="ts-boot-fallback"'), robotsHeader: response.headers.get('x-robots-tag'), sha256: sha(text) };
    proof.observations.push(row); console.log('DISCOVERY_LIVE_PAGE ' + JSON.stringify(row));
    assert.equal(row.status, 200); assert.equal(row.readableFirstResponse, true); assert.equal(row.applicationAssetsRetained, true); assert.equal(row.hasDirectoryLink, true); assert.equal(row.oldStartupPlaceholder, false); assert(row.heading); assert.deepEqual(row.canonicals, [origin + pathname]); assert(!/noindex/i.test(row.robotsHeader || ''));
    fs.writeFileSync(path.join(output, pathname.slice(1) + '-initial-response.html'), text);
  }
  proof.result = 'pass';
} catch (error) { proof.error = error.stack || error.message; }
// Read existing MealScout origins and production routes for comparison only; these are not booking actions.
for (const origin of ['https://mealscout.onrender.com', 'https://www.mealscout.us']) {
  for (const pathname of ['/food-truck-catering/pensacola', '/book-food-truck/pensacola']) {
    try {
      const { response, text } = await read(origin + pathname);
      proof.observations.push({ url: origin + pathname, status: response.status, title: element(text, /<title[^>]*>([\s\S]*?)<\/title>/i), heading: element(text, /<h1[^>]*>([\s\S]*?)<\/h1>/i), canonical: element(text, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i), resultLinks: [...text.matchAll(/<a\s+href=["']\/truck\//g)].length, sha256: sha(text), robotsHeader: response.headers.get('x-robots-tag') });
    } catch (error) { proof.observations.push({ url: origin + pathname, error: error.message }); }
  }
}
proof.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(output, 'discovery-live-evidence.json'), JSON.stringify(proof, null, 2));
fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(output, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>Public discovery release readback</h1><a href="discovery-live-evidence.json">Live readback</a><p>Public GET observations only. Search rankings, indexing and acquisition are not measured.</p>');
console.log('DISCOVERY_LIVE_SUMMARY ' + JSON.stringify(proof));
if (proof.result !== 'pass') process.exitCode = 1;
