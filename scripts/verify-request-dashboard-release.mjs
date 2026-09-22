import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

// Adapt only candidate identity, affected tests and the browser scenario.
// Native PostgreSQL and the unchanged strict release gate remain mandatory.
const candidate = process.env.REQUEST_DASHBOARD_CANDIDATE_SHA || '';
assert.match(candidate, /^[a-f0-9]{40}$/);
const git = (args) => execFileSync('git', args, { encoding: 'utf8', timeout: 120000 }).trim();
assert.equal(git(['branch', '--show-current']), '', 'Expected owned detached verifier checkout');
const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
git(['fetch', '--no-tags', ...(shallow ? ['--unshallow'] : []), 'https://github.com/infotradescout/tradescoutAI.git', 'refs/heads/main:refs/heads/main', 'refs/heads/main:refs/remotes/origin/main']);
console.log('REQUEST_DASHBOARD_MAIN ' + git(['rev-parse', 'refs/heads/main']));
let source = fs.readFileSync(new URL('./verify-public-information-candidate.mjs', import.meta.url), 'utf8');
function replaceOnce(before, after) {
  assert.equal(source.split(before).length, 2, 'Reviewed runner seam changed: ' + before.slice(0, 90));
  source = source.replace(before, after);
}
replaceOnce("const reviewed = JSON.parse(fs.readFileSync(new URL('./public-information-candidate.json', import.meta.url), 'utf8'));", `const reviewed = {commit: candidate, blobs: ${JSON.stringify({ 'server/routes/admin-discovery-evidence.ts': '387c213374d5ffc45b63e5520f389ec5e7976493', 'client/src/pages/admin-discovery-evidence.tsx': 'e586cfb783df4f3bd2b0880a243f1f0fe8169279', 'scripts/report-discovery-request-stages.mjs': '6bf381b7026c6d00e52da0ff28e772ede353a175' })}};`);
replaceOnce("run('new-information-contract', process.execPath, ['--test', 'scripts/public-information-pages.contract.test.mjs']);", `run('request-dashboard-contracts', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'server/tests/discovery-request-stages-route.test.ts', 'server/tests/discovery-observatory.contract.test.ts', 'server/tests/profile-intent-session-linkage.contract.test.ts', 'server/tests/profile-request-intent-observatory.contract.test.ts', 'client/src/admin/admin-os-v2-insight-workspaces.contract.test.ts', '--maxWorkers=2']);
  run('request-report-bundle-contract', process.execPath, ['--test', 'scripts/report-discovery-request-stages-bundle.test.mjs']);`);
const browserStart = source.indexOf("  browser = await chromium.launch({ channel: 'chromium'");
const browserEnd = source.indexOf("  run('strict-minimum-release'", browserStart);
assert(browserStart > 0 && browserEnd > browserStart, 'Reviewed browser scenario seams missing');
source = source.slice(0, browserStart) + `  assert(!appLog.includes('Acquisition report failed'), 'Bundled CLI must not execute during server startup');
  assert.equal(app.exitCode, null, 'Compiled server must remain running');
  const denied = await fetch(base + '/api/admin/discovery-observatory/request-stages?from=2026-08-24T05:00:00Z&to=2026-09-21T05:00:00Z', {signal: AbortSignal.timeout(15000)});
  assert([401,403].includes(denied.status), 'Actual compiled server must deny anonymous acquisition reads');
  evidence.actualAnonymousReportStatus = denied.status;
  run('compiled-dashboard-browser', process.execPath, ['scripts/discovery-request-dashboard.browser.mjs'], {env: {...runtimeEnv, REQUEST_DASHBOARD_BROWSER_OUTPUT: path.join(output, 'request-dashboard')}});
  const dashboard = JSON.parse(fs.readFileSync(path.join(output, 'request-dashboard/browser-evidence.json'), 'utf8'));
  assert.equal(dashboard.passed, true); assert.equal(dashboard.cases.length, 2);
  evidence.browser = dashboard.cases; evidence.browserScope = dashboard.scope;
` + source.slice(browserEnd);
replaceOnce('Observed exact compiled candidate on desktop1440 and mobile390 for all five changed informational pages; 10 browser cases passed, app mounting and canonical preservation verified. Scope: public documents, not submitted customer actions.', 'Exact admin reporting wrapper/components with production CSS passed desktop1440/mobile390 isolated API-fixture browser scenarios: dates, switching views, loading, unavailable data, refresh/retry and malformed payloads. Compiled full server denied anonymous report access. Not a production authenticated operator session.');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'request-dashboard-node-'));
const executable = process.execPath.replace(/'/g, "'\\''");
fs.writeFileSync(path.join(directory, 'node'), `#!/bin/sh\nexec '${executable}' --max-old-space-size=3072 "$@"\n`, { mode: 0o700 });
const previousPath = process.env.PATH;
const previousCandidate = process.env.SEARCH_SURFACE_CANDIDATE_SHA;
const adapted = new URL(`./.request-dashboard-adapted-${randomUUID()}.mjs`, import.meta.url);
try {
  fs.writeFileSync(adapted, source, { flag: 'wx' });
  execFileSync(process.execPath, ['--check', adapted.pathname], { timeout: 30000, stdio: 'inherit' });
  process.env.PATH = directory + path.delimiter + previousPath;
  process.env.SEARCH_SURFACE_CANDIDATE_SHA = candidate;
  console.log('REQUEST_DASHBOARD_RELEASE_START ' + JSON.stringify({ candidate, harness: git(['rev-parse', 'HEAD']), nativeRunnerBlob: git(['hash-object', 'scripts/verify-public-information-candidate.mjs']), productionWrites: 0 }));
  await import(pathToFileURL(adapted.pathname).href);
} finally {
  process.env.PATH = previousPath;
  if (previousCandidate === undefined) delete process.env.SEARCH_SURFACE_CANDIDATE_SHA; else process.env.SEARCH_SURFACE_CANDIDATE_SHA = previousCandidate;
  fs.rmSync(adapted, { force: true });
  fs.rmSync(directory, { recursive: true, force: true });
}
