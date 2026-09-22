import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const expected = process.env.REQUEST_DASHBOARD_OBSERVE_SHA || '';
assert.match(expected, /^[a-f0-9]{40}$/);
const base = 'https://www.thetradescout.com';
const output = path.resolve(process.env.SEARCH_SURFACE_OUTPUT || '.search-proof');
const report = { expected, startedAt: new Date().toISOString(), result: 'fail', customerMutations: 0, diagnosticWrites: 0, authenticatedOperatorSessionObserved: false, audienceMeasured: false, checks: [] };
async function read(route) {
  const response = await fetch(base + route, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': 'TradeScout-Owned-Release-Check/1.0' } });
  assert(response.headers.get('content-type')?.includes('application/json'), 'Expected JSON response');
  return { response, body: await response.json() };
}
async function health() {
  const { response, body } = await read('/api/health');
  assert.equal(response.status, 200); assert.equal(response.headers.get('x-tradescout-build'), expected);
  assert.equal(body.commit, expected); assert.equal(body.status, 'healthy'); assert.equal(body.database, 'connected');
  assert.equal(body.migrations?.compatibility, 'compatible'); assert.equal(body.migrations?.requiredSchemaOk, true);
  return { status: response.status, commit: body.commit, database: body.database, migrationCompatibility: body.migrations.compatibility };
}
try {
  report.healthBefore = await health();
  const { response, body } = await read('/api/admin/discovery-observatory/request-stages?from=2026-08-24T05%3A00%3A00Z&to=2026-09-21T05%3A00%3A00Z');
  assert([401,403].includes(response.status), 'Anonymous report access must be denied');
  assert.equal(response.headers.get('x-tradescout-build'), expected);
  assert(!Object.hasOwn(body, 'report') && !Object.hasOwn(body, 'source_groups') && !Object.hasOwn(body, 'created_requests'), 'Denied response must not expose report data');
  report.checks.push({ name: 'anonymous-report-read-denied', status: response.status, reportDataExposed: false });
  report.healthAfter = await health();
  report.result = 'pass';
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  report.boundary = 'Exact healthy public release and unauthenticated denial only. Authenticated report rendering was tested with isolated identities/data before release, not a live production operator session. This probe creates no customer actions or analytics events and proves no growth.';
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'live-request-dashboard.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(output, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>Read-only release observation</h1><a href="live-request-dashboard.json">Execution receipt</a><p>Not an audience or indexing report.</p>');
  console.log('REQUEST_DASHBOARD_LIVE ' + JSON.stringify(report));
}
