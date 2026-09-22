import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Adapt only the reviewed candidate identity, affected tests and browser scenario.
// The original runner's native PostgreSQL, clean-install, type/build, cleanup and
// strict minimum release execution remain intact. Candidate files are never patched.
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
replaceOnce("const reviewed = JSON.parse(fs.readFileSync(new URL('./public-information-candidate.json', import.meta.url), 'utf8'));", `const reviewed = {commit: candidate, blobs: ${JSON.stringify({ 'server/routes/admin-discovery-evidence.ts': '387c213374d5ffc45b63e5520f389ec5e7976493', 'client/src/pages/admin-discovery-evidence.tsx': 'e586cfb783df4f3bd2b0880a243f1f0fe8169279', 'scripts/report-discovery-request-stages.mjs': '9086efa81f834edfe7364f16c79cee616e276551' })}};`);
replaceOnce("run('new-information-contract', process.execPath, ['--test', 'scripts/public-information-pages.contract.test.mjs']);", `run('request-dashboard-contracts', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'server/tests/discovery-request-stages-route.test.ts', 'server/tests/discovery-observatory.contract.test.ts', 'server/tests/profile-intent-session-linkage.contract.test.ts', 'server/tests/profile-request-intent-observatory.contract.test.ts', 'client/src/admin/admin-os-v2-insight-workspaces.contract.test.ts', '--maxWorkers=2']);`);
const browserStart = source.indexOf("  browser = await chromium.launch({ channel: 'chromium'");
const browserEnd = source.indexOf("  run('strict-minimum-release'", browserStart);
assert(browserStart > 0 && browserEnd > browserStart, 'Reviewed browser scenario seams missing');
source = source.slice(0, browserStart) + `  const denied = await fetch(base + '/api/admin/discovery-observatory/request-stages?from=2026-08-24T05:00:00Z&to=2026-09-21T05:00:00Z', {signal: AbortSignal.timeout(15000)});
  assert([401,403].includes(denied.status), 'Actual compiled server must deny anonymous acquisition reads');
  evidence.actualAnonymousReportStatus = denied.status;
  run('compiled-dashboard-browser', process.execPath, ['scripts/discovery-request-dashboard.browser.mjs'], {env: {...runtimeEnv, REQUEST_DASHBOARD_BROWSER_OUTPUT: path.join(output, 'request-dashboard')}});
  const dashboard = JSON.parse(fs.readFileSync(path.join(output, 'request-dashboard/browser-evidence.json'), 'utf8'));
  assert.equal(dashboard.passed, true); assert.equal(dashboard.cases.length, 2);
  evidence.browser = dashboard.cases; evidence.browserScope = dashboard.scope;
` + source.slice(browserEnd);
replaceOnce('Observed exact compiled candidate on desktop1440 and mobile390 for all five changed informational pages; 10 browser cases passed, app mounting and canonical preservation verified. Scope: public documents, not submitted customer actions.', 'Exact admin reporting wrapper/components with production CSS passed desktop1440/mobile390 isolated API-fixture browser scenarios: dates, switching views, loading, unavailable data, refresh/retry and malformed payloads. Compiled full server denied anonymous report access. Not a production authenticated operator session.');
replaceOnce("scope", "scope");
