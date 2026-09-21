import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Keep production observations separate from exact-candidate release execution.
if (process.env.SEARCH_SURFACE_CANDIDATE_SHA) {
  // The observed full tsc run exhausted Node's default 2 GiB heap. This owned
  // CLI shim supplies a bounded heap to npm/tsc/build subprocesses even though
  // the candidate harness intentionally strips ambient NODE_OPTIONS.
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
