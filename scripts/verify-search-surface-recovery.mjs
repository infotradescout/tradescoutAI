import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

if (process.env.REQUEST_DASHBOARD_OBSERVE_SHA) {
  await import('./observe-request-dashboard-release.mjs');
} else if (process.env.REQUEST_DASHBOARD_CANDIDATE_SHA) {
  await import('./verify-request-dashboard-release.mjs');
} else if (process.env.REQUEST_STAGES_CANDIDATE_SHA) {
  await import('./verify-request-stage-report.mjs');
} else if (process.env.SEARCH_SURFACE_CANDIDATE_SHA) {
  // The outer verifier owns this disposable detached checkout. A local clone
  // otherwise inherits stale/missing main history from the old audit branch,
  // which the unchanged production-readiness registry correctly rejects.
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', timeout: 120000 }).trim();
  if (git(['branch', '--show-current']) !== '') throw new Error('Expected owned detached verifier checkout');
  const shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
  git(['fetch', '--no-tags', ...(shallow ? ['--unshallow'] : []), 'https://github.com/infotradescout/tradescoutAI.git', 'refs/heads/main:refs/heads/main']);
  console.log('CANDIDATE_MAIN_AUTHORITY ' + git(['rev-parse', 'refs/heads/main']));

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'search-candidate-node-'));
  const previousPath = process.env.PATH;
  const executable = process.execPath.replace(/'/g, "'\\''");
  fs.writeFileSync(path.join(directory, 'node'), `#!/bin/sh\nexec '${executable}' --max-old-space-size=3072 "$@"\n`, { mode: 0o700 });
  process.env.PATH = directory + path.delimiter + previousPath;
  console.log('CANDIDATE_MEMORY_BOUND node_cli_max_old_space_mib=3072; no service plan or release policy change');
  try { await import('./verify-public-information-candidate.mjs'); }
  finally { process.env.PATH = previousPath; fs.rmSync(directory, { recursive: true, force: true }); }
} else {
  await import('./verify-search-surface-observations.mjs');
}
